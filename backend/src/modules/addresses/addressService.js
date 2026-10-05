const { pool } = require('../../config/database');

const FIELDS = `id, user_id, name, phone, address_line, city, state, postal_code, country, created_at, updated_at`;

const getAll = async (userId) => {
  const { rows } = await pool.query(
    `SELECT ${FIELDS} FROM addresses WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return { addresses: rows };
};

const getById = async (userId, addressId) => {
  const { rows: [address] } = await pool.query(
    `SELECT ${FIELDS} FROM addresses WHERE id = $1 AND user_id = $2`,
    [addressId, userId]
  );

  if (!address) {
    const err = new Error('Address not found');
    err.statusCode = 404;
    err.code = 'ADDRESS_NOT_FOUND';
    throw err;
  }

  return { address };
};

const create = async (userId, data) => {
  const { name, phone, address_line, city, state, postal_code, country } = data;

  const { rows: [address] } = await pool.query(
    `INSERT INTO addresses (user_id, name, phone, address_line, city, state, postal_code, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${FIELDS}`,
    [userId, name, phone, address_line, city, state, postal_code, country || 'India']
  );

  return { address };
};

const update = async (userId, addressId, data) => {
  const existing = await getById(userId, addressId);

  const merged = { ...existing.address, ...data };
  const { name, phone, address_line, city, state, postal_code, country } = merged;

  const { rows: [address] } = await pool.query(
    `UPDATE addresses
     SET name=$1, phone=$2, address_line=$3, city=$4, state=$5,
         postal_code=$6, country=$7, updated_at=now()
     WHERE id=$8 AND user_id=$9
     RETURNING ${FIELDS}`,
    [name, phone, address_line, city, state, postal_code, country, addressId, userId]
  );

  return { address };
};

const remove = async (userId, addressId) => {
  await getById(userId, addressId); // throws 404 if not found / not owned

  await pool.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
};

module.exports = { getAll, getById, create, update, remove };
