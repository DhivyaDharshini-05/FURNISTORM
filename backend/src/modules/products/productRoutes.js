const { Router } = require('express');
const { getAll, getById, getVariants, getFilterOptions } = require('./productController');

const router = Router();

router.get('/filters',       getFilterOptions);
router.get('/',              getAll);
router.get('/:id',           getById);
router.get('/:id/variants',  getVariants);

const { productRouter } = require('../reviews/reviewRoutes');

router.use('/:productId/reviews', productRouter);

module.exports = router;
