const express = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const orderController = require('./orderController');

const router = express.Router();

router.use(authenticate);

// Customer endpoints
router.get('/', orderController.getCustomerOrders);
router.get('/:orderId', orderController.getCustomerOrderById);
router.get('/:orderId/status', orderController.getOrderStatus);

// Internal/Admin endpoints
router.patch('/:orderId/transition', orderController.transitionOrderStatus);

const { orderInstallationRouter } = require('../installations/installationRoutes');
router.use('/:orderId/installation', orderInstallationRouter);

module.exports = router;
