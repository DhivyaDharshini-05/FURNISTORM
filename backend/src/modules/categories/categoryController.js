const categoryService = require('./categoryService');

const getAll = async (req, res, next) => {
  try {
    const result = await categoryService.getAll();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await categoryService.getById(Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById };
