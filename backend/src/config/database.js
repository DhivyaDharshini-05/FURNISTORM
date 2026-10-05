const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => logger.error('PostgreSQL pool error:', err));

const connectDB = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  logger.info('PostgreSQL connected');
};

module.exports = { pool, connectDB };
