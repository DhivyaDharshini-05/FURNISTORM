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

const addressFields = {
  name:         Joi.string().trim().min(2).max(150).required(),
  phone:        Joi.string().trim().max(20).required(),
  address_line: Joi.string().trim().max(500).required(),
  city:         Joi.string().trim().max(100).required(),
  state:        Joi.string().trim().max(100).required(),
  postal_code:  Joi.string().trim().max(20).required(),
  country:      Joi.string().trim().max(100).optional(),
};

const validateCreate = validate(Joi.object(addressFields));

const validateUpdate = validate(
  Joi.object(
    Object.fromEntries(
      Object.entries(addressFields).map(([k, v]) => [k, v.optional()])
    )
  ).min(1)
);

module.exports = { validateCreate, validateUpdate };
