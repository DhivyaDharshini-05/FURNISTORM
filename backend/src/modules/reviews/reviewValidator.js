const validateReview = (req, res, next) => {
  const { rating, comment } = req.body;

  if (rating === undefined || rating === null || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Rating must be an integer between 1 and 5'
      }
    });
  }

  if (comment !== undefined && typeof comment !== 'string') {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Comment must be a string'
      }
    });
  }

  if (comment && comment.length > 2000) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Comment exceeds maximum length of 2000 characters'
      }
    });
  }

  next();
};

module.exports = {
  validateReview
};
