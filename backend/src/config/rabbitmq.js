const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection;
let channel;

const connectRabbitMQ = async () => {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createConfirmChannel();
  logger.info('RabbitMQ connected');

  connection.on('error', (err) => logger.error('RabbitMQ connection error:', err));
};

const getChannel = () => channel;

module.exports = { connectRabbitMQ, getChannel };
