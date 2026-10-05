const { pool }       = require('../config/database');
const { getChannel } = require('../config/rabbitmq');
const { ORDER_QUEUE, setupTopology } = require('../config/topology');
const logger         = require('../utils/logger');

// ── handler ───────────────────────────────────────────────────────────────────

const handleOrderConfirmed = async (event) => {
  const { payment } = event.payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // idempotency — skip if already processed
    const { rows: [order] } = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [payment.order_id]
    );

    if (!order) {
      logger.warn(`Order consumer: order ${payment.order_id} not found, skipping`);
      await client.query('ROLLBACK');
      return;
    }

    if (order.status !== 'CONFIRMED') {
      logger.info(`Order consumer: order ${order.id} already in status ${order.status}, skipping`);
      await client.query('ROLLBACK');
      return;
    }

    // advance order to PROCESSING
    await client.query(
      `UPDATE orders SET status = 'PROCESSING', updated_at = now() WHERE id = $1`,
      [order.id]
    );

    // write downstream outbox event for fulfilment / notification services
    await client.query(
      `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
       VALUES ('order.processing', 'order', $1, $2)`,
      [String(order.id), JSON.stringify({ order_id: order.id, payment_id: payment.id })]
    );

    await client.query('COMMIT');
    logger.info(`Order consumer: order ${order.id} → PROCESSING`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // bubble up so the message is nacked and requeued
  } finally {
    client.release();
  }
};

// ── consumer loop ─────────────────────────────────────────────────────────────

const startOrderConsumer = async () => {
  const channel = getChannel();
  await setupTopology(channel);

  // one message at a time — prevents overwhelming the DB pool
  channel.prefetch(1);

  await channel.consume(ORDER_QUEUE, async (msg) => {
    if (!msg) return;

    let event;
    try {
      event = JSON.parse(msg.content.toString());
    } catch {
      logger.error('Order consumer: invalid JSON, dead-lettering message');
      channel.nack(msg, false, false); // discard unparseable messages
      return;
    }

    try {
      await handleOrderConfirmed(event);
      channel.ack(msg);
    } catch (err) {
      logger.error(`Order consumer: failed to process event ${event.event_id}:`, err);
      // requeue once; if it fails again it will be dead-lettered
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  });

  logger.info(`Order consumer: listening on queue "${ORDER_QUEUE}"`);
};

module.exports = { startOrderConsumer };
