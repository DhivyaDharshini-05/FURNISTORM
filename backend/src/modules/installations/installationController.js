const installationService = require('./installationService');

const requestInstallation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    const { service_type, scheduled_date, time_slot, notes } = req.body;
    
    const result = await installationService.requestInstallation(userId, orderId, { service_type, scheduled_date, time_slot, notes });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const getOrderInstallation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    const result = await installationService.getOrderInstallation(userId, orderId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getInstallationById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const installationId = req.params.installationId;
    const result = await installationService.getInstallationById(userId, installationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const cancelInstallation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const installationId = req.params.installationId;
    
    const result = await installationService.cancelInstallation(userId, installationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requestInstallation,
  getOrderInstallation,
  getInstallationById,
  cancelInstallation
};
