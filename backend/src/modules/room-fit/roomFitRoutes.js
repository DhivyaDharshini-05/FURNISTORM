const { Router } = require('express');
const { analyzeFit } = require('./roomFitController');
const { validateAnalyzeFit } = require('./roomFitValidator');

const router = Router();

router.post('/analyze', validateAnalyzeFit, analyzeFit);

module.exports = router;
