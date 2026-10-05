const { pool } = require('../config/database');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = 60000; // Run every minute
let timer;

const expireReservations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find and lock expired reservations (skip locked so concurrent workers don't block each other)
    const { rows: reservations } = await client.query(
      `SELECT id, product_variant_id, quantity, status 
       FROM reservations 
       WHERE status IN ('RESERVED', 'PAYMENT_PENDING') 
         AND expires_at < now()
       FOR UPDATE SKIP LOCKED
       LIMIT 100`
    );

    if (reservations.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    let expiredCount = 0;

    for (const res of reservations) {
      // Re-verify eligibility (in case it changed right before we locked)
      if (!['RESERVED', 'PAYMENT_PENDING'].includes(res.status)) {
        continue;
      }

      // Lock the inventory row
      const { rows: [inv] } = await client.query(
        `SELECT id FROM inventory WHERE product_variant_id = $1 FOR UPDATE`,
        [res.product_variant_id]
      );

      if (inv) {
        // Return inventory
        await client.query(
          `UPDATE inventory
           SET available_quantity = available_quantity + $1,
               reserved_quantity  = reserved_quantity  - $1,
               updated_at         = now()
           WHERE id = $2`,
          [res.quantity, inv.id]
        );
      }

      // Change status to TIMEOUT
      await client.query(
        `UPDATE reservations SET status = 'TIMEOUT', updated_at = now() WHERE id = $1`,
        [res.id]
      );
      
      // Write outbox event
      await client.query(
        `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('reservation.released', 'reservation', $1, $2)`,
        [String(res.id), JSON.stringify({ reservation: res, reason: 'TIMEOUT' })]
      );
      
      expiredCount++;
    }

    await client.query('COMMIT');
    if (expiredCount > 0) {
      logger.info(`Reservation expiry worker: expired ${expiredCount} reservation(s)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Reservation expiry worker error:', err);
  } finally {
    client.release();
  }
};

const startReservationExpiryWorker = async () => {
  logger.info('Reservation expiry worker started');

  const poll = async () => {
    await expireReservations();
    timer = setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
};

const stopReservationExpiryWorker = () => {
  if (timer) clearTimeout(timer);
};

module.exports = { startReservationExpiryWorker, stopReservationExpiryWorker, expireReservations };
