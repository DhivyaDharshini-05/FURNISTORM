const { pool }       = require('../config/database');
const { getChannel } = require('../config/rabbitmq');
const { EXCHANGE, ROUTING_KEYS, setupTopology } = require('../config/topology');
const logger         = require('../utils/logger');

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE       = 50;

let timer;

const publishBatch = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // lock pending rows so concurrent relays don't double-publish
    const { rows: events } = await client.query(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload
       FROM outbox_events
       WHERE status = 'PENDING'
       ORDER BY id ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    );

    if (!events.length) {
      await client.query('ROLLBACK');
      return;
    }

    const channel    = getChannel();
    const published  = [];
    const failed     = [];

    for (const event of events) {
      const routingKey = ROUTING_KEYS[event.event_type] || event.event_type;
      const message    = Buffer.from(JSON.stringify({
        event_id:       event.id,
        event_type:     event.event_type,
        aggregate_type: event.aggregate_type,
        aggregate_id:   event.aggregate_id,
        payload:        event.payload,
        published_at:   new Date().toISOString(),
      }));

      try {
        await new Promise((resolve, reject) => {
          const success = channel.publish(EXCHANGE, routingKey, message, {
            persistent:    true,
            contentType:   'application/json',
            messageId:     String(event.id),
          }, (err, ok) => {
            if (err) reject(err);
            else resolve(ok);
          });
          if (!success) reject(new Error('Channel buffer full'));
        });
        published.push(event.id);
      } catch (err) {
        logger.error(`Outbox relay: failed to publish event ${event.id}:`, err);
        failed.push(event.id);
      }
    }

    if (published.length) {
      await client.query(
        `UPDATE outbox_events
         SET status = 'PROCESSED', processed_at = now()
         WHERE id = ANY($1)`,
        [published]
      );
      logger.info(`Outbox relay: published ${published.length} event(s)`);
    }

    if (failed.length) {
      await client.query(
        `UPDATE outbox_events SET status = 'FAILED' WHERE id = ANY($1)`,
        [failed]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Outbox relay: batch error:', err);
  } finally {
    client.release();
  }
};

const startOutboxRelay = async () => {
  const channel = getChannel();
  await setupTopology(channel);

  logger.info('Outbox relay started');

  const poll = async () => {
    await publishBatch();
    timer = setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
};

const stopOutboxRelay = () => {
  if (timer) clearTimeout(timer);
};

module.exports = { startOutboxRelay, stopOutboxRelay };
