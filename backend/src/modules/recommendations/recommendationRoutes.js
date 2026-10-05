const { Router } = require('express');
const { getRecommendations } = require('./recommendationController');
const { validateRecommendations } = require('./recommendationValidator');

const router = Router();

router.get('/', validateRecommendations, getRecommendations);
router.post('/', validateRecommendations, getRecommendations);

module.exports = router;
