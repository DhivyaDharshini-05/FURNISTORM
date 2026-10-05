const validateRecommendations = (req, res, next) => {
  const filters = req.method === 'POST' ? req.body : req.query;

  if (filters.budget !== undefined) {
    if (isNaN(Number(filters.budget)) || Number(filters.budget) < 0) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Budget must be a non-negative number'
        }
      });
    }
  }

  next();
};

module.exports = {
  validateRecommendations
};
