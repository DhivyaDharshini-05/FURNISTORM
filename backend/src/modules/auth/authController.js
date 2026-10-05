const authService = require('./authService');

const register = async (req, res, next) => {
  try {
    const { user, token } = await authService.register(req.body);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me };
