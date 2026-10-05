const { pool } = require('../../config/database');

const throwErr = (msg, status, code) => {
  const err = new Error(msg);
  err.statusCode = status;
  err.code = code;
  throw err;
};

const createReview = async (userId, productId, { rating, comment }) => {
  // Check if product exists
  const { rows: [product] } = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (!product) throwErr('Product not found', 404, 'PRODUCT_NOT_FOUND');

  // Verify purchase
  const { rows: [purchase] } = await pool.query(
    `SELECT oi.order_id 
     FROM order_items oi
     JOIN product_variants pv ON pv.id = oi.product_variant_id
     JOIN orders o ON o.id = oi.order_id
     WHERE pv.product_id = $1 AND o.user_id = $2 AND o.status = 'DELIVERED'`,
    [productId, userId]
  );

  if (!purchase) {
    throwErr('You can only review products you have purchased and received', 403, 'PURCHASE_REQUIRED');
  }

  try {
    const { rows: [review] } = await pool.query(
      `INSERT INTO reviews (user_id, product_id, order_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, productId, purchase.order_id, rating, comment]
    );
    return { review };
  } catch (err) {
    if (err.code === '23505') { // unique violation
      throwErr('You have already reviewed this product', 409, 'DUPLICATE_REVIEW');
    }
    throw err;
  }
};

const getProductReviews = async (productId) => {
  const { rows: reviews } = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, 
            u.name as reviewer_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC`,
    [productId]
  );
  return { reviews };
};

const updateReview = async (userId, reviewId, { rating, comment }) => {
  const { rows: [review] } = await pool.query('SELECT user_id FROM reviews WHERE id = $1', [reviewId]);
  if (!review) throwErr('Review not found', 404, 'REVIEW_NOT_FOUND');
  if (review.user_id !== userId) throwErr('Unauthorized to update this review', 403, 'UNAUTHORIZED');

  const { rows: [updated] } = await pool.query(
    `UPDATE reviews SET rating = $1, comment = $2
     WHERE id = $3 RETURNING *`,
    [rating, comment, reviewId]
  );
  return { review: updated };
};

const deleteReview = async (userId, reviewId) => {
  const { rows: [review] } = await pool.query('SELECT user_id FROM reviews WHERE id = $1', [reviewId]);
  if (!review) throwErr('Review not found', 404, 'REVIEW_NOT_FOUND');
  if (review.user_id !== userId) throwErr('Unauthorized to delete this review', 403, 'UNAUTHORIZED');

  await pool.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
  return { success: true };
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview
};
