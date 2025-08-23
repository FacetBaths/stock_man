const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Generate access token (short-lived)
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );
};

// Generate refresh token (long-lived)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      tokenType: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' } // Long-lived refresh token
  );
};

// Enhanced JWT verification middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      await logSecurityEvent(null, 'AUTH_MISSING_TOKEN', req);
      return res.status(401).json({ 
        message: 'No token provided, access denied',
        code: 'NO_TOKEN'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        await logSecurityEvent(null, 'AUTH_TOKEN_EXPIRED', req);
        return res.status(401).json({ 
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      } else {
        await logSecurityEvent(null, 'AUTH_INVALID_TOKEN', req);
        return res.status(401).json({ 
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user || !user.isActive) {
      await logSecurityEvent(decoded.id, 'AUTH_USER_NOT_FOUND', req);
      return res.status(401).json({ 
        message: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      await logSecurityEvent(user._id, 'AUTH_ACCOUNT_LOCKED', req);
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      await logSecurityEvent(user._id, 'AUTH_PASSWORD_CHANGED', req);
      return res.status(401).json({ 
        message: 'Password recently changed. Please log in again.',
        code: 'PASSWORD_CHANGED'
      });
    }

    // Attach user to request
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      preferences: user.preferences
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    await logSecurityEvent(null, 'AUTH_SYSTEM_ERROR', req, { error: error.message });
    res.status(500).json({ 
      message: 'Authentication system error',
      code: 'SYSTEM_ERROR'
    });
  }
};

// Optional auth middleware (doesn't require authentication but adds user info if present)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next(); // Continue without user info
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive && !user.isLocked && !user.changedPasswordAfter(decoded.iat)) {
        req.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          preferences: user.preferences
        };
      }
    } catch (error) {
      // Silently ignore token errors in optional auth
    }
    
    next();
  } catch (error) {
    next(); // Continue even if there's an error
  }
};

// Role-based permission middleware
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!userRoles.includes(req.user.role)) {
        await logSecurityEvent(req.user.id, 'AUTH_INSUFFICIENT_PERMISSIONS', req, {
          requiredRoles: userRoles,
          userRole: req.user.role
        });
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: userRoles,
          current: req.user.role
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ 
        message: 'Permission check failed',
        code: 'PERMISSION_ERROR'
      });
    }
  };
};

// Specific permission middlewares for backward compatibility
const requireWriteAccess = requireRole(['admin', 'warehouse_manager']);
const requireAdminAccess = requireRole(['admin']);
const requireWarehouseAccess = requireRole(['admin', 'warehouse_manager']);
const requireAnyAccess = requireRole(['admin', 'warehouse_manager', 'sales_rep', 'viewer']);

// Rate limiting middleware for sensitive operations
const rateLimitAuth = (windowMs = 15 * 60 * 1000, maxAttempts = 5) => {
  const attempts = new Map();
  
  return async (req, res, next) => {
    const key = req.ip + ':' + (req.user?.id || 'anonymous');
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    const userAttempts = attempts.get(key) || [];
    const recentAttempts = userAttempts.filter(time => time > windowStart);
    
    if (recentAttempts.length >= maxAttempts) {
      await logSecurityEvent(req.user?.id, 'AUTH_RATE_LIMIT_EXCEEDED', req);
      return res.status(429).json({
        message: 'Too many attempts. Please try again later.',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    // Record this attempt
    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    
    next();
  };
};

// Helper function to log security events
const logSecurityEvent = async (userId, event, req, additionalData = {}) => {
  try {
    const auditData = {
      userId,
      action: event,
      resource: 'authentication',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      success: false, // Security events are typically failures
      details: {
        method: req.method,
        url: req.originalUrl,
        ...additionalData
      }
    };

    // Only log if AuditLog model exists (to prevent circular dependency issues)
    if (AuditLog) {
      await AuditLog.create(auditData);
    } else {
      console.log('Security Event:', auditData);
    }
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// Helper function to log successful auth events
const logAuthSuccess = async (userId, action, req, additionalData = {}) => {
  try {
    const auditData = {
      userId,
      action,
      resource: 'authentication',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      success: true,
      details: {
        method: req.method,
        url: req.originalUrl,
        ...additionalData
      }
    };

    if (AuditLog) {
      await AuditLog.create(auditData);
    } else {
      console.log('Auth Success:', auditData);
    }
  } catch (error) {
    console.error('Failed to log auth success:', error);
  }
};

// Middleware to log API access (for audit trail)
const logApiAccess = async (req, res, next) => {
  // Skip logging for health checks and static assets
  if (req.path === '/api/health' || req.path.startsWith('/static/')) {
    return next();
  }

  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log API access asynchronously to avoid blocking the response
    process.nextTick(async () => {
      try {
        if (AuditLog) {
          await AuditLog.create({
            userId: req.user?.id,
            action: 'API_ACCESS',
            resource: req.originalUrl,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            success: res.statusCode < 400,
            details: {
              method: req.method,
              statusCode: res.statusCode,
              responseTime,
              requestSize: req.get('content-length') || 0,
              responseSize: data ? JSON.stringify(data).length : 0
            }
          });
        }
      } catch (error) {
        console.error('Failed to log API access:', error);
      }
    });

    originalSend.call(this, data);
  };

  next();
};

module.exports = {
  auth,
  optionalAuth,
  requireRole,
  requireWriteAccess,
  requireAdminAccess,
  requireWarehouseAccess,
  requireAnyAccess,
  rateLimitAuth,
  generateAccessToken,
  generateRefreshToken,
  logSecurityEvent,
  logAuthSuccess,
  logApiAccess
};
