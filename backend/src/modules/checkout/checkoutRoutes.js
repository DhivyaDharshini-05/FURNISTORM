const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateCheckout } = require('./checkoutValidator');
const { initiateCheckout } = require('./checkoutController');

const router = Router();

router.use(authenticate);
router.post('/', validateCheckout, initiateCheckout);

module.exports = router;
