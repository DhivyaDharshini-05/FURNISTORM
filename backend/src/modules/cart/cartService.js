const { pool } = require('../../config/database');

// get or create the user's cart, return cart with items
const getCart = async (userId) => {
  // upsert cart
  await pool.query(
    `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const { rows: [cart] } = await pool.query(
    'SELECT id, user_id, created_at, updated_at FROM carts WHERE user_id = $1',
    [userId]
  );

  const { rows: items } = await pool.query(
    `SELECT
       ci.id, ci.quantity, ci.created_at, ci.updated_at,
       pv.id   AS variant_id,
       pv.sku,
       pv.size,
       pv.color,
       pv.additional_price,
       p.id    AS product_id,
       p.name  AS product_name,
       p.base_price,
       p.discount_price,
       p.brand,
       i.available_quantity
     FROM cart_items ci
     JOIN product_variants pv ON pv.id = ci.product_variant_id
     JOIN products p           ON p.id  = pv.product_id
     LEFT JOIN inventory i     ON i.product_variant_id = pv.id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cart.id]
  );

  return { cart: { ...cart, items } };
};

// add a variant to cart (or increment quantity if already present)
const addItem = async (userId, { product_variant_id, quantity }) => {
  // verify variant exists
  const { rows: [variant] } = await pool.query(
    `SELECT pv.id, i.available_quantity
     FROM product_variants pv
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE pv.id = $1`,
    [product_variant_id]
  );

  if (!variant) {
    const err = new Error('Product variant not found');
    err.statusCode = 404;
    err.code = 'VARIANT_NOT_FOUND';
    throw err;
  }

  if (variant.available_quantity < quantity) {
    const err = new Error(`Only ${variant.available_quantity} units available`);
    err.statusCode = 409;
    err.code = 'INSUFFICIENT_STOCK';
    throw err;
  }

  // ensure cart exists
  await pool.query(
    `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const { rows: [cart] } = await pool.query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );

  // upsert cart item
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_variant_id)
     DO UPDATE SET quantity   = cart_items.quantity + EXCLUDED.quantity,
                   updated_at = now()`,
    [cart.id, product_variant_id, quantity]
  );

  // bump cart updated_at
  await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);

  return getCart(userId);
};

// update quantity of a specific cart item
const updateItem = async (userId, cartItemId, quantity) => {
  const { rows: [cart] } = await pool.query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );

  if (!cart) {
    const err = new Error('Cart not found');
    err.statusCode = 404;
    err.code = 'CART_NOT_FOUND';
    throw err;
  }

  const { rows: [item] } = await pool.query(
    'SELECT id FROM cart_items WHERE id = $1 AND cart_id = $2',
    [cartItemId, cart.id]
  );

  if (!item) {
    const err = new Error('Cart item not found');
    err.statusCode = 404;
    err.code = 'CART_ITEM_NOT_FOUND';
    throw err;
  }

  await pool.query(
    'UPDATE cart_items SET quantity = $1, updated_at = now() WHERE id = $2',
    [quantity, cartItemId]
  );

  await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);

  return getCart(userId);
};

// remove a specific item from cart
const removeItem = async (userId, cartItemId) => {
  const { rows: [cart] } = await pool.query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );

  if (!cart) {
    const err = new Error('Cart not found');
    err.statusCode = 404;
    err.code = 'CART_NOT_FOUND';
    throw err;
  }

  const { rowCount } = await pool.query(
    'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
    [cartItemId, cart.id]
  );

  if (!rowCount) {
    const err = new Error('Cart item not found');
    err.statusCode = 404;
    err.code = 'CART_ITEM_NOT_FOUND';
    throw err;
  }

  await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);

  return getCart(userId);
};

// clear all items from cart
const clearCart = async (userId) => {
  const { rows: [cart] } = await pool.query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );

  if (cart) {
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);
  }

  return getCart(userId);
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
