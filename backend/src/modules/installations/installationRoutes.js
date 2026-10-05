const { Router } = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { requestInstallation, getOrderInstallation, getInstallationById, cancelInstallation } = require('./installationController');
const { validateInstallation } = require('./installationValidator');

// /api/orders/:orderId/installation
const orderInstallationRouter = Router({ mergeParams: true });
// /api/installations
const installationRouter = Router();

orderInstallationRouter.use(authenticate);
orderInstallationRouter.post('/', validateInstallation, requestInstallation);
orderInstallationRouter.get('/', getOrderInstallation);

installationRouter.use(authenticate);
installationRouter.get('/:installationId', getInstallationById);
installationRouter.patch('/:installationId/cancel', cancelInstallation);

module.exports = {
  orderInstallationRouter,
  installationRouter
};
