const logger = require('../utils/logger');

const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  if (statusCode >= 500) logger.error(err);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode >= 500 ? 'An unexpected error occurred' : err.message,
    },
  });
};

module.exports = { notFound, errorHandler };
