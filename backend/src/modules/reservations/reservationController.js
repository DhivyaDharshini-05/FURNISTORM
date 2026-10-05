const svc = require('./reservationService');

const reserve = async (req, res, next) => {
  try {
    const result = await svc.reserve(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await svc.getById(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const markPaymentPending = async (req, res, next) => {
  try {
    const result = await svc.markPaymentPending(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const confirm = async (req, res, next) => {
  try {
    const result = await svc.confirm(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const markSold = async (req, res, next) => {
  try {
    const result = await svc.markSold(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const release = async (req, res, next) => {
  try {
    const result = await svc.release(req.user.id, Number(req.params.id), req.body.reason);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { reserve, getById, markPaymentPending, confirm, markSold, release };
