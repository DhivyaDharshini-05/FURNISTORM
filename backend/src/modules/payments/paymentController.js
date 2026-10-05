const svc = require('./paymentService');

const getById = async (req, res, next) => {
  try {
    const result = await svc.getById(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const success = async (req, res, next) => {
  try {
    const result = await svc.processSuccess(req.user.id, Number(req.params.id), req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const failed = async (req, res, next) => {
  try {
    const result = await svc.processFailed(req.user.id, Number(req.params.id), req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const timeout = async (req, res, next) => {
  try {
    const result = await svc.processTimeout(req.user.id, Number(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const retry = async (req, res, next) => {
  try {
    const result = await svc.retryPayment(req.user.id, Number(req.params.id));
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const reconcile = async (req, res, next) => {
  try {
    const result = await svc.reconcile(req.user.id, Number(req.params.id), req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { getById, success, failed, timeout, retry, reconcile };
