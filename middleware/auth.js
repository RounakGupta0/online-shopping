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

    if (decoded.role && decoded.email) {
      // Decode user details directly from token without DB lookup
      req.user = {
        _id: decoded.id,
        email: decoded.email,
        phoneNumber: decoded.phoneNumber,
        role: decoded.role,
      };
    } else {
      // Fallback for older tokens that only contain ID
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authorization Error',
          error: 'Unauthorized',
        });
      }
      req.user = user;
    }

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
