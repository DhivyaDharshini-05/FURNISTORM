const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateSuccess, validateReconcile } = require('./paymentValidator');
const ctrl = require('./paymentController');

const router = Router();

router.use(authenticate);

router.get('/:id',             ctrl.getById);
router.patch('/:id/success',   validateSuccess,    ctrl.success);
router.patch('/:id/failed',    ctrl.failed);
router.patch('/:id/timeout',   ctrl.timeout);
router.post('/:id/retry',      ctrl.retry);
router.patch('/:id/reconcile', validateReconcile,  ctrl.reconcile);

module.exports = router;
