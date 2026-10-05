const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateAddItem, validateUpdateItem } = require('./cartValidator');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('./cartController');

const router = Router();

router.use(authenticate);

router.get('/',                    getCart);
router.post('/items',              validateAddItem,    addItem);
router.patch('/items/:itemId',     validateUpdateItem, updateItem);
router.delete('/items/:itemId',    removeItem);
router.delete('/',                 clearCart);

module.exports = router;
