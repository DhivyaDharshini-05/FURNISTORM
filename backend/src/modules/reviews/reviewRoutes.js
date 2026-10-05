const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { createReview, getProductReviews, updateReview, deleteReview } = require('./reviewController');
const { validateReview } = require('./reviewValidator');

// Note: /api/products/:productId/reviews and /api/reviews
const productRouter = Router({ mergeParams: true });
const reviewRouter = Router();

// /api/products/:productId/reviews
productRouter.get('/', getProductReviews);
productRouter.post('/', authenticate, validateReview, createReview);

// /api/reviews
reviewRouter.put('/:reviewId', authenticate, validateReview, updateReview);
reviewRouter.delete('/:reviewId', authenticate, deleteReview);

module.exports = {
  productRouter,
  reviewRouter
};
