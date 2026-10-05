const { pool } = require('../../config/database');
const { claimIdempotencyKey, completeIdempotencyKey } = require('../../utils/idempotency');

const RESERVATION_TTL_MINUTES = 15;

const throwErr = (msg, status, code) => {
  const err = new Error(msg);
  err.statusCode = status;
  err.code = code;
  throw err;
};

const writeOutbox = (client, eventType, aggregateId, payload) =>
  client.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, 'order', $2, $3)`,
    [eventType, String(aggregateId), JSON.stringify(payload)]
  );

// ── coupon helpers ────────────────────────────────────────────────────────────

const applyCoupon = (coupon, subtotal) => {
  if (coupon.discount_type === 'PERCENTAGE') {
    const disc = (subtotal * parseFloat(coupon.discount_value)) / 100;
    return coupon.maximum_discount
      ? Math.min(disc, parseFloat(coupon.maximum_discount))
      : disc;
  }
  return Math.min(parseFloat(coupon.discount_value), subtotal);
};

// ── main checkout ─────────────────────────────────────────────────────────────

const checkout = async (userId, { address_id, coupon_code, payment_method, idempotency_key }) => {

  // ── idempotency guard ─────────────────────────────────────────────────────
  const claim = await claimIdempotencyKey(idempotency_key, userId, 'checkout');
  if (claim && claim.response) return claim.response;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── STEP 1: load cart ─────────────────────────────────────────────────
    const { rows: [cart] } = await client.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );
    if (!cart) throwErr('Cart not found', 404, 'CART_NOT_FOUND');

    const { rows: items } = await client.query(
      `SELECT
         ci.id, ci.quantity,
         pv.id   AS variant_id,
         pv.additional_price,
         p.base_price,
         p.discount_price,
         p.name  AS product_name
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.product_variant_id
       JOIN products p           ON p.id  = pv.product_id
       WHERE ci.cart_id = $1
       ORDER BY pv.id ASC`,
      [cart.id]
    );

    // ── STEP 2: validate cart ─────────────────────────────────────────────
    if (!items.length) throwErr('Cart is empty', 422, 'CART_EMPTY');

    // ── STEP 3: validate stock for every item ─────────────────────────────
    for (const item of items) {
      const { rows: [inv] } = await client.query(
        `SELECT available_quantity, version FROM inventory
         WHERE product_variant_id = $1 FOR UPDATE`,
        [item.variant_id]
      );
      if (!inv || inv.available_quantity < item.quantity)
        throwErr(
          `Insufficient stock for "${item.product_name}"`,
          409,
          'INSUFFICIENT_STOCK'
        );
      item._inv = inv; // carry forward for reservation step
    }

    // ── STEP 4: validate address ──────────────────────────────────────────
    const { rows: [address] } = await client.query(
      'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
      [address_id, userId]
    );
    if (!address) throwErr('Address not found', 404, 'ADDRESS_NOT_FOUND');

    // ── STEP 5: coupon ────────────────────────────────────────────────────
    let coupon     = null;
    let couponId   = null;
    let subtotal   = items.reduce((sum, i) => {
      const unit = parseFloat(i.discount_price || i.base_price) + parseFloat(i.additional_price);
      return sum + unit * i.quantity;
    }, 0);

    if (coupon_code) {
      const { rows: [c] } = await client.query(
        `SELECT * FROM coupons
         WHERE code = $1
           AND active = true
           AND start_date <= now()
           AND expiry_date >= now()
           AND (usage_limit IS NULL OR used_count < usage_limit)
         FOR UPDATE`,
        [coupon_code]
      );
      if (!c) throwErr('Invalid or expired coupon', 422, 'INVALID_COUPON');
      if (subtotal < parseFloat(c.minimum_order_amount))
        throwErr(
          `Minimum order amount for this coupon is ₹${c.minimum_order_amount}`,
          422,
          'COUPON_MIN_ORDER'
        );

      coupon   = c;
      couponId = c.id;

      await client.query(
        'UPDATE coupons SET used_count = used_count + 1 WHERE id = $1',
        [c.id]
      );
    }

    const discountAmount = coupon ? applyCoupon(coupon, subtotal) : 0;
    const totalAmount    = Math.max(0, subtotal - discountAmount);

    // ── STEP 6: reserve inventory for every cart item ─────────────────────
    const expiresAt    = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
    const reservations = [];

    for (const item of items) {
      const { rowCount } = await client.query(
        `UPDATE inventory
         SET available_quantity = available_quantity - $1,
             reserved_quantity  = reserved_quantity  + $1,
             version            = version + 1,
             updated_at         = now()
         WHERE product_variant_id = $2 AND version = $3`,
        [item.quantity, item.variant_id, item._inv.version]
      );
      if (!rowCount) throwErr('Concurrent update detected, please retry', 409, 'OPTIMISTIC_LOCK_FAILURE');

      const { rows: [res] } = await client.query(
        `INSERT INTO reservations
           (user_id, product_variant_id, quantity, status, expires_at)
         VALUES ($1, $2, $3, 'RESERVED', $4) RETURNING *`,
        [userId, item.variant_id, item.quantity, expiresAt]
      );
      reservations.push(res);
    }

    // ── STEP 7: create order ──────────────────────────────────────────────
    const { rows: [order] } = await client.query(
      `INSERT INTO orders
         (user_id, address_id, coupon_id, status, subtotal, discount_amount, total_amount)
       VALUES ($1, $2, $3, 'PAYMENT_PENDING', $4, $5, $6)
       RETURNING *`,
      [userId, address_id, couponId, subtotal, discountAmount, totalAmount]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, status, created_at)
       VALUES ($1, 'CREATED', $2), ($1, 'PAYMENT_PENDING', now())`,
      [order.id, order.created_at]
    );

    // order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const res  = reservations[i];
      const unitPrice = parseFloat(item.discount_price || item.base_price) + parseFloat(item.additional_price);

      await client.query(
        `INSERT INTO order_items
           (order_id, product_variant_id, reservation_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.variant_id, res.id, item.quantity, unitPrice]
      );
    }

    // ── STEP 8: create payment intent ─────────────────────────────────────
    const { rows: [payment] } = await client.query(
      `INSERT INTO payments
         (user_id, order_id, amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [userId, order.id, totalAmount, payment_method]
    );

    // outbox
    await writeOutbox(client, 'checkout.initiated', order.id, {
      order, payment, reservations,
    });

    // clear cart
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    // idempotency record
    if (idempotency_key) {
      const response = { order, payment, reservations };
      await completeIdempotencyKey(client, idempotency_key, userId, 'checkout', response);
    }

    await client.query('COMMIT');

    return { order, payment, reservations };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { checkout };
