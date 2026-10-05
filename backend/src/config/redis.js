const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const connectRedis = () => {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error('Redis error:', err));

  return redis.connect();
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };
