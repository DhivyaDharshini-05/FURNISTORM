const { pool } = require('../../config/database');

const throwErr = (msg, status, code) => {
  const err = new Error(msg);
  err.statusCode = status;
  err.code = code;
  throw err;
};

const writeOutbox = (client, eventType, aggregateId, payload) =>
  client.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, 'installation', $2, $3)`,
    [eventType, String(aggregateId), JSON.stringify(payload)]
  );

const requestInstallation = async (userId, orderId, { service_type, scheduled_date, time_slot, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify order exists, belongs to user, and is DELIVERED
    const { rows: [order] } = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [orderId, userId]
    );

    if (!order) throwErr('Order not found', 404, 'ORDER_NOT_FOUND');
    if (order.status !== 'DELIVERED') throwErr('Installation can only be requested for delivered orders', 403, 'ORDER_NOT_DELIVERED');

    // Prevent duplicate
    const { rows: [existing] } = await client.query(
      `SELECT id FROM installations WHERE order_id = $1`,
      [orderId]
    );
    if (existing) throwErr('Installation already requested for this order', 409, 'DUPLICATE_INSTALLATION');

    // Insert installation
    const { rows: [installation] } = await client.query(
      `INSERT INTO installations (order_id, user_id, service_type, scheduled_date, time_slot, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orderId, userId, service_type, scheduled_date, time_slot, notes]
    );

    await writeOutbox(client, 'installation.requested', installation.id, { installation });

    await client.query('COMMIT');
    return { installation };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getOrderInstallation = async (userId, orderId) => {
  const { rows: [installation] } = await pool.query(
    `SELECT * FROM installations WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (!installation) throwErr('Installation not found', 404, 'INSTALLATION_NOT_FOUND');
  return { installation };
};

const getInstallationById = async (userId, installationId) => {
  const { rows: [installation] } = await pool.query(
    `SELECT * FROM installations WHERE id = $1 AND user_id = $2`,
    [installationId, userId]
  );
  if (!installation) throwErr('Installation not found', 404, 'INSTALLATION_NOT_FOUND');
  return { installation };
};

const cancelInstallation = async (userId, installationId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [installation] } = await client.query(
      `SELECT * FROM installations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [installationId, userId]
    );

    if (!installation) throwErr('Installation not found', 404, 'INSTALLATION_NOT_FOUND');
    if (['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(installation.status)) {
      throwErr(`Cannot cancel installation in status ${installation.status}`, 409, 'INVALID_INSTALLATION_STATUS');
    }

    const { rows: [updated] } = await client.query(
      `UPDATE installations SET status = 'CANCELLED', updated_at = now() WHERE id = $1 RETURNING *`,
      [installationId]
    );

    await writeOutbox(client, 'installation.cancelled', installationId, { installation: updated });

    await client.query('COMMIT');
    return { installation: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  requestInstallation,
  getOrderInstallation,
  getInstallationById,
  cancelInstallation
};
