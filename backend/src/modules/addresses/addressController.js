const addressService = require('./addressService');

const getAll = async (req, res, next) => {
  try {
    const result = await addressService.getAll(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await addressService.getById(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await addressService.create(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const result = await addressService.update(req.user.id, Number(req.params.id), req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await addressService.remove(req.user.id, Number(req.params.id));
    res.json({ success: true, message: 'Address deleted' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };
