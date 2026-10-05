const { pool } = require('../config/database');

const throwErr = (msg, status, code) => {
  const err = new Error(msg);
  err.statusCode = status;
  err.code = code;
  throw err;
};

const claimIdempotencyKey = async (key, userId, operation) => {
  if (!key) return null;
  
  try {
    await pool.query(
      `INSERT INTO idempotency_keys (key, user_id, operation, status)
       VALUES ($1, $2, $3, 'PROCESSING')`,
      [key, userId, operation]
    );
    return true; // Claimed successfully
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      const { rows: [existing] } = await pool.query(
        `SELECT status, response FROM idempotency_keys
         WHERE key = $1 AND user_id = $2 AND operation = $3`,
        [key, userId, operation]
      );
      
      if (existing) {
        if (existing.status === 'COMPLETED') {
          return { response: existing.response };
        } else if (existing.status === 'PROCESSING') {
          throwErr('Request already in progress', 409, 'IDEMPOTENCY_CONFLICT');
        }
      }
      throwErr('Idempotency key conflict', 409, 'IDEMPOTENCY_CONFLICT');
    }
    throw err;
  }
};

const completeIdempotencyKey = async (client, key, userId, operation, response) => {
  if (!key) return;
  await client.query(
    `UPDATE idempotency_keys
     SET status = 'COMPLETED', response = $1, updated_at = now()
     WHERE key = $2 AND user_id = $3 AND operation = $4`,
    [JSON.stringify(response), key, userId, operation]
  );
};

module.exports = { claimIdempotencyKey, completeIdempotencyKey };
