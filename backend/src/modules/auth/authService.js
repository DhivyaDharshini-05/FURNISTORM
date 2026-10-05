const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');

const SALT_ROUNDS = 12;

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const register = async ({ name, email, password, phone }) => {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('Email is already registered');
    err.statusCode = 409;
    err.code = 'EMAIL_TAKEN';
    throw err;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, created_at`,
    [name, email, password_hash, phone || null]
  );

  const user = rows[0];
  const token = signToken(user);
  return { user, token };
};

const login = async ({ email, password }) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, password_hash, created_at FROM users WHERE email = $1',
    [email]
  );

  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.password_hash));

  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(safeUser);
  return { user: safeUser, token };
};

const getById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, created_at FROM users WHERE id = $1',
    [id]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  return rows[0];
};

module.exports = { register, login, getById };
