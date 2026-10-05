const reviewService = require('./reviewService');

const createReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;
    const { rating, comment } = req.body;
    
    const result = await reviewService.createReview(userId, productId, { rating, comment });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const result = await reviewService.getProductReviews(productId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const updateReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reviewId = req.params.reviewId;
    const { rating, comment } = req.body;
    
    const result = await reviewService.updateReview(userId, reviewId, { rating, comment });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reviewId = req.params.reviewId;
    
    const result = await reviewService.deleteReview(userId, reviewId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview
};
