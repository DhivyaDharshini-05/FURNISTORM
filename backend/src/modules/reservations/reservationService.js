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
     VALUES ($1, 'reservation', $2, $3)`,
    [eventType, String(aggregateId), JSON.stringify(payload)]
  );

// ── AVAILABLE → RESERVED ──────────────────────────────────────────────────────

const reserve = async (userId, { product_variant_id, quantity, idempotency_key }) => {
  if (idempotency_key) {
    const claim = await claimIdempotencyKey(idempotency_key, userId, 'reserve');
    if (claim && claim.response) return claim.response;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [inv] } = await client.query(
      `SELECT id, available_quantity, version FROM inventory
       WHERE product_variant_id = $1 FOR UPDATE`,
      [product_variant_id]
    );

    if (!inv)                              throwErr('Variant not found', 404, 'VARIANT_NOT_FOUND');
    if (inv.available_quantity < quantity) throwErr(`Only ${inv.available_quantity} units available`, 409, 'INSUFFICIENT_STOCK');

    const { rowCount } = await client.query(
      `UPDATE inventory
       SET available_quantity = available_quantity - $1,
           reserved_quantity  = reserved_quantity  + $1,
           version            = version + 1,
           updated_at         = now()
       WHERE id = $2 AND version = $3`,
      [quantity, inv.id, inv.version]
    );
    if (!rowCount) throwErr('Concurrent update detected, please retry', 409, 'OPTIMISTIC_LOCK_FAILURE');

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    const { rows: [reservation] } = await client.query(
      `INSERT INTO reservations (user_id, product_variant_id, quantity, status, idempotency_key, expires_at)
       VALUES ($1, $2, $3, 'RESERVED', $4, $5) RETURNING *`,
      [userId, product_variant_id, quantity, idempotency_key || null, expiresAt]
    );

    await writeOutbox(client, 'reservation.reserved', reservation.id, { reservation });

    if (idempotency_key) {
      await completeIdempotencyKey(client, idempotency_key, userId, 'reserve', { reservation });
    }

    await client.query('COMMIT');
    return { reservation };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── RESERVED → PAYMENT_PENDING ────────────────────────────────────────────────

const markPaymentPending = async (userId, reservationId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [res] } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reservationId, userId]
    );

    if (!res)                      throwErr('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    if (res.status !== 'RESERVED') throwErr(`Cannot move to PAYMENT_PENDING from ${res.status}`, 409, 'INVALID_TRANSITION');
    if (new Date(res.expires_at) < new Date()) throwErr('Reservation has expired', 410, 'RESERVATION_EXPIRED');

    const { rows: [updated] } = await client.query(
      `UPDATE reservations SET status = 'PAYMENT_PENDING', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [reservationId]
    );

    await writeOutbox(client, 'reservation.payment_pending', reservationId, { reservation: updated });

    await client.query('COMMIT');
    return { reservation: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── PAYMENT_PENDING → CONFIRMED ───────────────────────────────────────────────

const confirm = async (userId, reservationId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [res] } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reservationId, userId]
    );

    if (!res)                             throwErr('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    if (res.status !== 'PAYMENT_PENDING') throwErr(`Cannot confirm from ${res.status}`, 409, 'INVALID_TRANSITION');

    const { rows: [updated] } = await client.query(
      `UPDATE reservations SET status = 'CONFIRMED', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [reservationId]
    );

    await writeOutbox(client, 'reservation.confirmed', reservationId, { reservation: updated });

    await client.query('COMMIT');
    return { reservation: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── CONFIRMED → SOLD ──────────────────────────────────────────────────────────

const markSold = async (userId, reservationId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [res] } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reservationId, userId]
    );

    if (!res)                       throwErr('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    if (res.status !== 'CONFIRMED') throwErr(`Cannot mark SOLD from ${res.status}`, 409, 'INVALID_TRANSITION');

    await client.query(
      `UPDATE inventory
       SET reserved_quantity = reserved_quantity - $1,
           sold_quantity     = sold_quantity     + $1,
           updated_at        = now()
       WHERE product_variant_id = $2`,
      [res.quantity, res.product_variant_id]
    );

    const { rows: [updated] } = await client.query(
      `UPDATE reservations SET status = 'SOLD', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [reservationId]
    );

    await writeOutbox(client, 'reservation.sold', reservationId, { reservation: updated });

    await client.query('COMMIT');
    return { reservation: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── RELEASE (timeout / payment failure) ──────────────────────────────────────

const release = async (userId, reservationId, reason = 'RELEASED') => {
  const RELEASABLE = ['RESERVED', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'TIMEOUT'];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [res] } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reservationId, userId]
    );

    if (!res)                             throwErr('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
    if (!RELEASABLE.includes(res.status)) throwErr(`Cannot release from ${res.status}`, 409, 'INVALID_TRANSITION');

    await client.query(
      `UPDATE inventory
       SET available_quantity = available_quantity + $1,
           reserved_quantity  = reserved_quantity  - $1,
           updated_at         = now()
       WHERE product_variant_id = $2`,
      [res.quantity, res.product_variant_id]
    );

    const { rows: [updated] } = await client.query(
      `UPDATE reservations SET status = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [reason, reservationId]
    );

    await writeOutbox(client, 'reservation.released', reservationId, { reservation: updated, reason });

    await client.query('COMMIT');
    return { reservation: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── GET ───────────────────────────────────────────────────────────────────────

const getById = async (userId, reservationId) => {
  const { rows: [reservation] } = await pool.query(
    `SELECT r.*, pv.sku, p.name AS product_name
     FROM reservations r
     JOIN product_variants pv ON pv.id = r.product_variant_id
     JOIN products p           ON p.id  = pv.product_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [reservationId, userId]
  );

  if (!reservation) throwErr('Reservation not found', 404, 'RESERVATION_NOT_FOUND');
  return { reservation };
};

module.exports = { reserve, markPaymentPending, confirm, markSold, release, getById };
