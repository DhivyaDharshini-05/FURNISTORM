const { pool } = require('../../config/database');

const PAYMENT_TIMEOUT_MINUTES = 30;
const MAX_RETRY_ATTEMPTS      = 3;

const throwErr = (msg, status, code) => {
  const err = new Error(msg);
  err.statusCode = status;
  err.code = code;
  throw err;
};

const writeOutbox = (client, eventType, aggregateId, payload) =>
  client.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, 'payment', $2, $3)`,
    [eventType, String(aggregateId), JSON.stringify(payload)]
  );

// ── helpers ───────────────────────────────────────────────────────────────────

const loadPayment = async (client, paymentId, userId) => {
  const { rows: [payment] } = await client.query(
    `SELECT p.*, o.status AS order_status
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.id = $1 AND p.user_id = $2
     FOR UPDATE`,
    [paymentId, userId]
  );
  if (!payment) throwErr('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  return payment;
};

const releaseOrderReservations = async (client, orderId) => {
  const { rows: reservations } = await client.query(
    `SELECT r.id, r.product_variant_id, r.quantity, r.status
     FROM reservations r
     JOIN order_items oi ON oi.reservation_id = r.id
     WHERE oi.order_id = $1
       AND r.status IN ('RESERVED','PAYMENT_PENDING')`,
    [orderId]
  );

  for (const res of reservations) {
    await client.query(
      `UPDATE inventory
       SET available_quantity = available_quantity + $1,
           reserved_quantity  = reserved_quantity  - $1,
           updated_at         = now()
       WHERE product_variant_id = $2`,
      [res.quantity, res.product_variant_id]
    );
    await client.query(
      `UPDATE reservations SET status = 'RELEASED', updated_at = now() WHERE id = $1`,
      [res.id]
    );
  }
};

const confirmOrderReservations = async (client, orderId) => {
  const { rows: reservations } = await client.query(
    `SELECT r.id, r.product_variant_id, r.quantity
     FROM reservations r
     JOIN order_items oi ON oi.reservation_id = r.id
     WHERE oi.order_id = $1 AND r.status IN ('RESERVED','PAYMENT_PENDING')`,
    [orderId]
  );

  for (const res of reservations) {
    await client.query(
      `UPDATE inventory
       SET reserved_quantity = reserved_quantity - $1,
           sold_quantity     = sold_quantity     + $1,
           updated_at        = now()
       WHERE product_variant_id = $2`,
      [res.quantity, res.product_variant_id]
    );
    await client.query(
      `UPDATE reservations SET status = 'SOLD', updated_at = now() WHERE id = $1`,
      [res.id]
    );
  }
};

// ── SUCCESS ───────────────────────────────────────────────────────────────────

const processSuccess = async (userId, paymentId, { transaction_reference }) => {
  // duplicate payment guard — same transaction_reference already COMPLETED
  const { rows: [dup] } = await pool.query(
    `SELECT id FROM payments
     WHERE transaction_reference = $1 AND status = 'COMPLETED'`,
    [transaction_reference]
  );
  if (dup) throwErr('Duplicate payment: transaction already completed', 409, 'DUPLICATE_PAYMENT');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await loadPayment(client, paymentId, userId);

    if (payment.order_status === 'CONFIRMED') {
      const { rows: [existing] } = await client.query(
        `SELECT * FROM payments WHERE order_id = $1 AND status = 'COMPLETED'`,
        [payment.order_id]
      );
      return { payment: existing };
    }

    if (payment.status === 'COMPLETED')
      throwErr('Payment already completed', 409, 'ALREADY_COMPLETED');
    if (!['PENDING', 'FAILED'].includes(payment.status))
      throwErr(`Cannot complete payment in status ${payment.status}`, 409, 'INVALID_PAYMENT_STATUS');

    // stamp transaction reference — unique constraint prevents duplicates
    const { rows: [updated] } = await client.query(
      `UPDATE payments
       SET status                = 'COMPLETED',
           transaction_reference = $1,
           updated_at            = now()
       WHERE id = $2
       RETURNING *`,
      [transaction_reference, paymentId]
    );

    // order → CONFIRMED
    await client.query(
      `UPDATE orders SET status = 'CONFIRMED', updated_at = now() WHERE id = $1`,
      [payment.order_id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'CONFIRMED')`,
      [payment.order_id]
    );

    // reservations → SOLD, inventory reserved → sold
    await confirmOrderReservations(client, payment.order_id);

    await writeOutbox(client, 'payment.success', paymentId, { payment: updated });

    await client.query('COMMIT');
    return { payment: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── FAILED ────────────────────────────────────────────────────────────────────

const processFailed = async (userId, paymentId, { reason } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await loadPayment(client, paymentId, userId);

    if (!['PENDING', 'FAILED'].includes(payment.status))
      throwErr(`Cannot fail payment in status ${payment.status}`, 409, 'INVALID_PAYMENT_STATUS');

    const { rows: [updated] } = await client.query(
      `UPDATE payments SET status = 'FAILED', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [paymentId]
    );

    // order → CANCELLED, release inventory
    await client.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
      [payment.order_id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'CANCELLED')`,
      [payment.order_id]
    );
    await releaseOrderReservations(client, payment.order_id);

    await writeOutbox(client, 'payment.failed', paymentId, { payment: updated, reason });

    await client.query('COMMIT');
    return { payment: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── TIMEOUT ───────────────────────────────────────────────────────────────────

const processTimeout = async (userId, paymentId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await loadPayment(client, paymentId, userId);

    if (payment.status !== 'PENDING')
      throwErr(`Cannot timeout payment in status ${payment.status}`, 409, 'INVALID_PAYMENT_STATUS');

    const createdAt  = new Date(payment.created_at);
    const timeoutAt  = new Date(createdAt.getTime() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
    if (new Date() < timeoutAt)
      throwErr('Payment has not yet timed out', 422, 'PAYMENT_NOT_TIMED_OUT');

    const { rows: [updated] } = await client.query(
      `UPDATE payments SET status = 'FAILED', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [paymentId]
    );

    await client.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
      [payment.order_id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'CANCELLED')`,
      [payment.order_id]
    );
    await releaseOrderReservations(client, payment.order_id);

    await writeOutbox(client, 'payment.timeout', paymentId, { payment: updated });

    await client.query('COMMIT');
    return { payment: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── RETRY ─────────────────────────────────────────────────────────────────────

const retryPayment = async (userId, paymentId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await loadPayment(client, paymentId, userId);

    if (payment.status !== 'FAILED')
      throwErr('Only FAILED payments can be retried', 409, 'INVALID_PAYMENT_STATUS');

    // count prior attempts for this order
    const { rows: [{ attempts }] } = await client.query(
      `SELECT COUNT(*) AS attempts FROM payments
       WHERE order_id = $1 AND status = 'FAILED'`,
      [payment.order_id]
    );
    if (parseInt(attempts) >= MAX_RETRY_ATTEMPTS)
      throwErr(`Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached`, 429, 'MAX_RETRIES_EXCEEDED');

    // re-open order
    await client.query(
      `UPDATE orders SET status = 'PAYMENT_PENDING', updated_at = now() WHERE id = $1`,
      [payment.order_id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'PAYMENT_PENDING')`,
      [payment.order_id]
    );

    // create a fresh PENDING payment for the same order
    const { rows: [newPayment] } = await client.query(
      `INSERT INTO payments (user_id, order_id, amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
      [userId, payment.order_id, payment.amount, payment.payment_method]
    );

    // re-reserve inventory (restore reservations to RESERVED)
    const { rows: orderItems } = await client.query(
      `SELECT oi.reservation_id, r.product_variant_id, r.quantity
       FROM order_items oi
       JOIN reservations r ON r.id = oi.reservation_id
       WHERE oi.order_id = $1
       ORDER BY r.product_variant_id ASC`,
      [payment.order_id]
    );

    for (const item of orderItems) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      const { rows: [inv] } = await client.query(
        `SELECT id, available_quantity FROM inventory WHERE product_variant_id = $1 FOR UPDATE`,
        [item.product_variant_id]
      );
      
      if (!inv || inv.available_quantity < item.quantity) {
        throwErr('Insufficient stock for retry', 409, 'OUT_OF_STOCK');
      }

      await client.query(
        `UPDATE inventory
         SET available_quantity = available_quantity - $1,
             reserved_quantity  = reserved_quantity  + $1,
             updated_at         = now()
         WHERE id = $2`,
        [item.quantity, inv.id]
      );
      await client.query(
        `UPDATE reservations SET status = 'RESERVED', expires_at = $1, updated_at = now()
         WHERE id = $2`,
        [expiresAt, item.reservation_id]
      );
    }

    await writeOutbox(client, 'payment.retry', newPayment.id, {
      original_payment_id: paymentId,
      new_payment: newPayment,
    });

    await client.query('COMMIT');
    return { payment: newPayment };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── RECONCILIATION ────────────────────────────────────────────────────────────

const reconcile = async (userId, paymentId, { actual_status, transaction_reference }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await loadPayment(client, paymentId, userId);

    if (payment.status !== 'PENDING')
      throwErr('Only PENDING payments can be reconciled', 409, 'INVALID_PAYMENT_STATUS');

    let updated;

    if (actual_status === 'COMPLETED') {
      // duplicate guard
      if (transaction_reference) {
        const { rows: [dup] } = await client.query(
          `SELECT id FROM payments
           WHERE transaction_reference = $1 AND status = 'COMPLETED' AND id != $2`,
          [transaction_reference, paymentId]
        );
        if (dup) throwErr('Duplicate payment: transaction already completed', 409, 'DUPLICATE_PAYMENT');
      }

      ({ rows: [updated] } = await client.query(
        `UPDATE payments
         SET status = 'COMPLETED', transaction_reference = $1, updated_at = now()
         WHERE id = $2 RETURNING *`,
        [transaction_reference || null, paymentId]
      ));

      await client.query(
        `UPDATE orders SET status = 'CONFIRMED', updated_at = now() WHERE id = $1`,
        [payment.order_id]
      );
      await client.query(
        `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'CONFIRMED')`,
        [payment.order_id]
      );
      await confirmOrderReservations(client, payment.order_id);

    } else {
      ({ rows: [updated] } = await client.query(
        `UPDATE payments SET status = 'FAILED', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [paymentId]
      ));

      await client.query(
        `UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`,
        [payment.order_id]
      );
      await client.query(
        `INSERT INTO order_status_history (order_id, status) VALUES ($1, 'CANCELLED')`,
        [payment.order_id]
      );
      await releaseOrderReservations(client, payment.order_id);
    }

    await writeOutbox(client, 'payment.reconciled', paymentId, {
      payment: updated, actual_status,
    });

    await client.query('COMMIT');
    return { payment: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── GET ───────────────────────────────────────────────────────────────────────

const getById = async (userId, paymentId) => {
  const { rows: [payment] } = await pool.query(
    `SELECT p.*, o.status AS order_status
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [paymentId, userId]
  );
  if (!payment) throwErr('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  return { payment };
};

module.exports = { processSuccess, processFailed, processTimeout, retryPayment, reconcile, getById };
