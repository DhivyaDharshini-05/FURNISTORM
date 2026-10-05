const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateCreate, validateUpdate } = require('./addressValidator');
const { getAll, getById, create, update, remove } = require('./addressController');

const router = Router();

router.use(authenticate);

router.get('/',     getAll);
router.post('/',    validateCreate, create);
router.get('/:id',  getById);
router.patch('/:id', validateUpdate, update);
router.delete('/:id', remove);

module.exports = router;
