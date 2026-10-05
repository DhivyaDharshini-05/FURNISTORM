const productService = require('./productService');

const getAll = async (req, res, next) => {
  try {
    const result = await productService.getAll(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await productService.getById(Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getVariants = async (req, res, next) => {
  try {
    const result = await productService.getVariants(Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getFilterOptions = async (req, res, next) => {
  try {
    const result = await productService.getFilterOptions();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, getVariants, getFilterOptions };
