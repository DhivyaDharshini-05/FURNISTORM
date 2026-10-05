const cartService = require('./cartService');

const getCart = async (req, res, next) => {
  try {
    const result = await cartService.getCart(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const addItem = async (req, res, next) => {
  try {
    const result = await cartService.addItem(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
  try {
    const result = await cartService.updateItem(req.user.id, Number(req.params.itemId), req.body.quantity);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
  try {
    const result = await cartService.removeItem(req.user.id, Number(req.params.itemId));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const clearCart = async (req, res, next) => {
  try {
    const result = await cartService.clearCart(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
