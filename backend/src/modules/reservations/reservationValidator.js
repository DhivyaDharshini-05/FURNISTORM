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

const validateReserve = validate(
  Joi.object({
    product_variant_id: Joi.number().integer().positive().required(),
    quantity:           Joi.number().integer().min(1).max(100).required(),
    idempotency_key:    Joi.string().max(255).optional(),
  })
);

module.exports = { validateReserve };
