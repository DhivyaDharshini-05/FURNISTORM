const orderService = require('./orderService');

const getCustomerOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orders } = await orderService.getCustomerOrders(userId);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
};

const getCustomerOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    const { order } = await orderService.getCustomerOrderById(userId, orderId);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
};

const getOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    const statusData = await orderService.getOrderStatus(userId, orderId);
    res.status(200).json(statusData);
  } catch (err) {
    next(err);
  }
};

const transitionOrderStatus = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const { status } = req.body;
    
    if (!status) {
      const err = new Error('Status is required');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const { order } = await orderService.transitionOrderStatus(orderId, status);
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCustomerOrders,
  getCustomerOrderById,
  getOrderStatus,
  transitionOrderStatus
};
