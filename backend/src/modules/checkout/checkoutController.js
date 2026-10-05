const { checkout } = require('./checkoutService');

const initiateCheckout = async (req, res, next) => {
  try {
    const result = await checkout(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { initiateCheckout };
