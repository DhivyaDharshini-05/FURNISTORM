const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Authentication token required');
    err.statusCode = 401;
    err.code = 'TOKEN_MISSING';
    return next(err);
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    const err = new Error(
      e.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token'
    );
    err.statusCode = 401;
    err.code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    next(err);
  }
};

module.exports = { authenticate };
