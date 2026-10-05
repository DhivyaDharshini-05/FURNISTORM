const { pool } = require('../../config/database');
const { canTransition } = require('./orderStateMachine');

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

const getCustomerOrders = async (userId) => {
  const { rows: orders } = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return { orders };
};

const getCustomerOrderById = async (userId, orderId) => {
  const { rows: [order] } = await pool.query(
    `SELECT o.*,
            json_build_object(
              'id', a.id,
              'name', a.name,
              'phone', a.phone,
              'address_line', a.address_line,
              'city', a.city,
              'state', a.state,
              'postal_code', a.postal_code,
              'country', a.country
            ) AS shipping_address
     FROM orders o
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId]
  );

  if (!order) throwErr('Order not found', 404, 'ORDER_NOT_FOUND');

  const { rows: items } = await pool.query(
    `SELECT oi.id, oi.quantity, oi.unit_price, 
            pv.sku, pv.size, pv.color,
            p.name AS product_name
     FROM order_items oi
     JOIN product_variants pv ON pv.id = oi.product_variant_id
     JOIN products p ON p.id = pv.product_id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  
  const { rows: [payment] } = await pool.query(
    `SELECT status, payment_method, transaction_reference FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
    [orderId]
  );

  order.items = items;
  order.payment = payment || null;

  return { order };
};

const getOrderStatus = async (userId, orderId) => {
  const { rows: [order] } = await pool.query(
    `SELECT status FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (!order) throwErr('Order not found', 404, 'ORDER_NOT_FOUND');

  const { rows: timeline } = await pool.query(
    `SELECT status, created_at AS timestamp
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );

  return {
    orderId,
    status: order.status,
    timeline
  };
};

// Transition endpoint (Internal/Admin)
const transitionOrderStatus = async (orderId, nextStatus) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) throwErr('Order not found', 404, 'ORDER_NOT_FOUND');

    if (!canTransition(order.status, nextStatus)) {
      throwErr(`Invalid transition from ${order.status} to ${nextStatus}`, 409, 'INVALID_TRANSITION');
    }

    const { rows: [updated] } = await client.query(
      `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [nextStatus, orderId]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1, $2)`,
      [orderId, nextStatus]
    );

    const eventName = `order.${nextStatus.toLowerCase()}`;
    await writeOutbox(client, eventName, orderId, { order: updated });

    await client.query('COMMIT');
    return { order: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getCustomerOrders,
  getCustomerOrderById,
  getOrderStatus,
  transitionOrderStatus
};
