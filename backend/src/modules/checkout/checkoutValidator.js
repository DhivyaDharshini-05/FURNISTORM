const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const err = new Error(error.details.map((d) => d.message).join(', '));
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    return next(err);
  }
  req.body = value;
  next();
};

const validateCheckout = validate(
  Joi.object({
    address_id:      Joi.number().integer().positive().required(),
    payment_method:  Joi.string().valid('CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'NET_BANKING', 'WALLET', 'COD').required(),
    coupon_code:     Joi.string().trim().uppercase().optional(),
    idempotency_key: Joi.string().max(255).optional(),
  })
);

module.exports = { validateCheckout };
