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

const validateSuccess = validate(
  Joi.object({
    transaction_reference: Joi.string().trim().max(255).required(),
  })
);

const validateReconcile = validate(
  Joi.object({
    actual_status:         Joi.string().valid('COMPLETED', 'FAILED').required(),
    transaction_reference: Joi.string().trim().max(255).optional(),
  })
);

module.exports = { validateSuccess, validateReconcile };
