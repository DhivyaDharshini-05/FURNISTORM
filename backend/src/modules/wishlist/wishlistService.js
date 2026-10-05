const { pool } = require('../../config/database');

const getWishlist = async (userId) => {
  await pool.query(
    `INSERT INTO wishlists (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const { rows: [wishlist] } = await pool.query(
    'SELECT id, user_id, created_at FROM wishlists WHERE user_id = $1',
    [userId]
  );

  const { rows: items } = await pool.query(
    `SELECT
       wi.id, wi.created_at,
       pv.id    AS variant_id,
       pv.sku,
       pv.size,
       pv.color,
       pv.additional_price,
       p.id     AS product_id,
       p.name   AS product_name,
       p.base_price,
       p.discount_price,
       p.brand,
       i.available_quantity
     FROM wishlist_items wi
     JOIN product_variants pv ON pv.id = wi.product_variant_id
     JOIN products p           ON p.id  = pv.product_id
     LEFT JOIN inventory i     ON i.product_variant_id = pv.id
     WHERE wi.wishlist_id = $1
     ORDER BY wi.created_at DESC`,
    [wishlist.id]
  );

  return { wishlist: { ...wishlist, items } };
};

const addItem = async (userId, product_variant_id) => {
  // verify variant exists
  const { rows: [variant] } = await pool.query(
    'SELECT id FROM product_variants WHERE id = $1',
    [product_variant_id]
  );

  if (!variant) {
    const err = new Error('Product variant not found');
    err.statusCode = 404;
    err.code = 'VARIANT_NOT_FOUND';
    throw err;
  }

  await pool.query(
    `INSERT INTO wishlists (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const { rows: [wishlist] } = await pool.query(
    'SELECT id FROM wishlists WHERE user_id = $1',
    [userId]
  );

  const { rowCount } = await pool.query(
    `INSERT INTO wishlist_items (wishlist_id, product_variant_id)
     VALUES ($1, $2)
     ON CONFLICT (wishlist_id, product_variant_id) DO NOTHING`,
    [wishlist.id, product_variant_id]
  );

  if (!rowCount) {
    const err = new Error('Item already in wishlist');
    err.statusCode = 409;
    err.code = 'ALREADY_IN_WISHLIST';
    throw err;
  }

  return getWishlist(userId);
};

const removeItem = async (userId, wishlistItemId) => {
  const { rows: [wishlist] } = await pool.query(
    'SELECT id FROM wishlists WHERE user_id = $1',
    [userId]
  );

  if (!wishlist) {
    const err = new Error('Wishlist not found');
    err.statusCode = 404;
    err.code = 'WISHLIST_NOT_FOUND';
    throw err;
  }

  const { rowCount } = await pool.query(
    'DELETE FROM wishlist_items WHERE id = $1 AND wishlist_id = $2',
    [wishlistItemId, wishlist.id]
  );

  if (!rowCount) {
    const err = new Error('Wishlist item not found');
    err.statusCode = 404;
    err.code = 'WISHLIST_ITEM_NOT_FOUND';
    throw err;
  }

  return getWishlist(userId);
};

module.exports = { getWishlist, addItem, removeItem };
