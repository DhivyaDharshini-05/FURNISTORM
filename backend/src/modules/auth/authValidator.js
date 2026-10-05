const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/[A-Z]/, 'uppercase letter')
    .pattern(/[a-z]/, 'lowercase letter')
    .pattern(/[0-9]/, 'number')
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.name': 'Password must contain at least one {#name}',
    }),
  phone: Joi.string().trim().max(20).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().required(),
});

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

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
};
