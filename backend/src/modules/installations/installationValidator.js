const validateInstallation = (req, res, next) => {
  const { service_type } = req.body;

  const validTypes = ['BASIC', 'FULL', 'PREMIUM', 'SELF_GUIDED'];
  
  if (!validTypes.includes(service_type)) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid service_type'
      }
    });
  }

  next();
};

module.exports = {
  validateInstallation
};
