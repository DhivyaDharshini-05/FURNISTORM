const { getRedis } = require('../config/redis');
const logger = require('./logger');

const DEFAULT_TTL = 300; // 5 minutes

const cacheGet = async (key) => {
  try {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Cache GET error:', err);
    return null;
  }
};

const cacheSet = async (key, value, ttl = DEFAULT_TTL) => {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.error('Cache SET error:', err);
  }
};

const cacheInvalidate = async (pattern) => {
  try {
    const keys = await getRedis().keys(pattern);
    if (keys.length) await getRedis().del(...keys);
  } catch (err) {
    logger.error('Cache INVALIDATE error:', err);
  }
};

module.exports = { cacheGet, cacheSet, cacheInvalidate };
