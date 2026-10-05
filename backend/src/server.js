require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startOutboxRelay } = require('./workers/outboxRelay');
const { startOrderConsumer } = require('./workers/orderConsumer');
const { startReservationExpiryWorker } = require('./workers/reservationExpiryWorker');

const PORT = process.env.PORT || 3000;

const start = async () => {
  const degradedServices = [];

  const safeStartService = async (name, callback) => {
    try {
      await callback();
    } catch (err) {
      const message = err?.message || String(err);
      degradedServices.push(`${name}: ${message}`);
      logger.warn(`${name} unavailable; continuing in degraded mode: ${message}`);
    }
  };

  await safeStartService('PostgreSQL', connectDB);
  await safeStartService('Redis', connectRedis);
  await safeStartService('RabbitMQ', connectRabbitMQ);
  await safeStartService('Order consumer', startOrderConsumer);
  await safeStartService('Outbox relay', startOutboxRelay);
  await safeStartService('Reservation expiry worker', startReservationExpiryWorker);

  if (degradedServices.length > 0) {
    logger.warn(`Server started in degraded mode. External services unavailable: ${degradedServices.join('; ')}`);
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      resolve(server);
    });

    server.on('error', (err) => {
      logger.error('Failed to bind server:', err);
      reject(err);
    });
  });
};

if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
