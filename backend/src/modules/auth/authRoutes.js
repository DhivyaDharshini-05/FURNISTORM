const { Router } = require('express');
const { validateRegister, validateLogin } = require('./authValidator');
const { authenticate } = require('../../middleware/authMiddleware');
const { register, login, me } = require('./authController');

const router = Router();

router.post('/register', validateRegister, register);
router.post('/login',    validateLogin,    login);
router.get('/me',        authenticate,     me);

module.exports = router;
