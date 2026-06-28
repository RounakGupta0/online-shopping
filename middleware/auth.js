const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.toLowerCase().startsWith('bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authorization Error',
      error: 'Unauthorized',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authorization Error',
        error: 'Unauthorized',
      });
    }

    // Validate that if email or phone is passed in the request body, it matches the loaded user
    if (req.body && req.body.email && String(req.body.email).toLowerCase().trim() !== String(user.email).toLowerCase().trim()) {
      return res.status(401).json({
        success: false,
        message: 'Authorization Error',
        error: 'Unauthorized',
      });
    }
    if (req.body && req.body.phoneNumber && String(req.body.phoneNumber).trim() !== String(user.phoneNumber).trim()) {
      return res.status(401).json({
        success: false,
        message: 'Authorization Error',
        error: 'Unauthorized',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authorization Error',
      error: 'Unauthorized',
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this route`,
        error: 'Forbidden',
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
