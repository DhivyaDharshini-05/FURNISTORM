const wishlistService = require('./wishlistService');

const getWishlist = async (req, res, next) => {
  try {
    const result = await wishlistService.getWishlist(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const addItem = async (req, res, next) => {
  try {
    const { product_variant_id } = req.body;
    if (!product_variant_id || !Number.isInteger(Number(product_variant_id))) {
      const err = new Error('product_variant_id must be a positive integer');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      return next(err);
    }
    const result = await wishlistService.addItem(req.user.id, Number(product_variant_id));
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
  try {
    const result = await wishlistService.removeItem(req.user.id, Number(req.params.itemId));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { getWishlist, addItem, removeItem };
