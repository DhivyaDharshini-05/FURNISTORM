const { Router } = require('express');
const { getAll, getById } = require('./categoryController');

const router = Router();

router.get('/',    getAll);
router.get('/:id', getById);

module.exports = router;
