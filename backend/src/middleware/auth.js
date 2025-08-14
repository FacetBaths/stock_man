const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check if user has admin or warehouse manager permissions
const requireWriteAccess = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'warehouse_manager') {
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
  next();
};

// Middleware to check if user has admin permissions only
const requireAdminAccess = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin permissions required.' });
  }
  next();
};

module.exports = {
  auth,
  requireWriteAccess,
  requireAdminAccess
};
