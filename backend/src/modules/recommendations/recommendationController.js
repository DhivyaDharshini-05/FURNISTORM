const recommendationService = require('./recommendationService');

const getRecommendations = async (req, res, next) => {
  try {
    const filters = req.method === 'POST' ? req.body : req.query;
    
    // Convert budget to number if present
    if (filters.budget !== undefined) {
      filters.budget = Number(filters.budget);
    }

    const result = await recommendationService.getRecommendations(filters);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRecommendations
};
