const joi = require('joi');
const { ValidationError } = require('../errors');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    req[property] = value;
    next();
  };
};

// Schemas aligned with authController (username / email / password).
const registerSchema = joi.object({
  username: joi.string().min(3).max(50).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).max(100).required(),
  phone: joi.string().min(7).max(15).optional(),
  role: joi.string().valid('customer', 'admin').optional(),
});

const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

// Contact form schema — mirrors the client-side validation in ContactForm.jsx
// (name, phone, email, message are the existing form fields).
const contactSchema = joi.object({
  name: joi.string().trim().min(1).max(100).required(),
  phone: joi.string().trim().pattern(/^[0-9+\-\s]{7,15}$/).required(),
  email: joi.string().trim().email().max(150).required(),
  message: joi.string().trim().min(1).max(2000).required(),
});

const registerValidator = validate(registerSchema);
const loginValidator = validate(loginSchema);
const contactValidator = validate(contactSchema);

module.exports = {
  validate,
  registerValidator,
  loginValidator,
  contactValidator,
  registerSchema,
  loginSchema,
  contactSchema,
};