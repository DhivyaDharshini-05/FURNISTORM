const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { getWishlist, addItem, removeItem } = require('./wishlistController');

const router = Router();

router.use(authenticate);

router.get('/',              getWishlist);
router.post('/items',        addItem);
router.delete('/items/:itemId', removeItem);

module.exports = router;
