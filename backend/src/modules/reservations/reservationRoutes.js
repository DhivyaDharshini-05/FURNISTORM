const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateReserve } = require('./reservationValidator');
const ctrl = require('./reservationController');

const router = Router();

router.use(authenticate);

router.post('/',                          validateReserve,       ctrl.reserve);
router.get('/:id',                                               ctrl.getById);
router.patch('/:id/payment-pending',                             ctrl.markPaymentPending);
router.patch('/:id/confirm',                                     ctrl.confirm);
router.patch('/:id/sold',                                        ctrl.markSold);
router.patch('/:id/release',                                     ctrl.release);

module.exports = router;
