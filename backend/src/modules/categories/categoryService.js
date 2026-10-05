const { pool } = require('../../config/database');
const { cacheGet, cacheSet } = require('../../utils/cache');

const CACHE_KEY = 'categories:all';
const CACHE_TTL = 600; // 10 minutes — categories rarely change

const getAll = async () => {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return { categories: cached, fromCache: true };

  const { rows } = await pool.query(
    'SELECT id, name, description, created_at FROM categories ORDER BY name ASC'
  );

  await cacheSet(CACHE_KEY, rows, CACHE_TTL);
  return { categories: rows, fromCache: false };
};

const getById = async (id) => {
  const cacheKey = `categories:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { category: cached, fromCache: true };

  const { rows } = await pool.query(
    'SELECT id, name, description, created_at FROM categories WHERE id = $1',
    [id]
  );

  if (!rows.length) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  await cacheSet(cacheKey, rows[0], CACHE_TTL);
  return { category: rows[0], fromCache: false };
};

module.exports = { getAll, getById };
