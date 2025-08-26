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
  console.log('=== AUTH MIDDLEWARE CALLED ===')
  console.log('Request URL:', req.originalUrl)
  console.log('Request method:', req.method)
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('Token extracted:', !!token)
    
    if (!token) {
      console.log('No token found, returning 401')
      await logSecurityEvent(null, 'AUTH_MISSING_TOKEN', req);
      return res.status(401).json({ 
        message: 'No token provided, access denied',
        code: 'NO_TOKEN'
      });
    }

    console.log('Verifying token...')
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully, user ID:', decoded.id)
    } catch (error) {
      console.log('Token verification failed:', error.name)
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

    console.log('Finding user in database...')
    // Verify user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    console.log('User found:', !!user)
    
    if (!user || !user.isActive) {
      console.log('User not found or inactive')
      await logSecurityEvent(decoded.id, 'AUTH_USER_NOT_FOUND', req);
      return res.status(401).json({ 
        message: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      console.log('User account is locked')
      await logSecurityEvent(user._id, 'AUTH_ACCOUNT_LOCKED', req);
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      console.log('Password changed after token was issued')
      await logSecurityEvent(user._id, 'AUTH_PASSWORD_CHANGED', req);
      return res.status(401).json({ 
        message: 'Password recently changed. Please log in again.',
        code: 'PASSWORD_CHANGED'
      });
    }

    console.log('Auth checks passed, attaching user to request')
    // Attach user to request - Need to attach the full user object for logout route
    req.user = user; // Use full user object instead of just data
    
    console.log('Calling next() to continue to route handler')
    next();
  } catch (error) {
    console.error('=== AUTH MIDDLEWARE ERROR ===')
    console.error('Error details:', error)
    console.error('Error stack:', error.stack)
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
      event_type: 'authentication',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId || 'anonymous',
      user_name: 'Unknown User', // Default for security events
      action: event,
      description: `Authentication event: ${event} from ${req.ip || req.connection?.remoteAddress}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent'),
        api_endpoint: req.originalUrl,
        method: req.method,
        response_status: 401, // Most security events are 401s
        ...additionalData
      },
      severity: 'medium',
      category: 'security',
      status: 'failure' // Security events are typically failures
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
      event_type: 'login',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId,
      user_name: additionalData.username || 'Unknown User',
      action: action,
      description: `Successful authentication: ${action}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent'),
        api_endpoint: req.originalUrl,
        method: req.method,
        response_status: 200,
        ...additionalData
      },
      severity: 'low',
      category: 'security',
      status: 'success'
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
            event_type: 'info',
            entity_type: 'system',
            user_id: req.user?.id || 'anonymous',
            user_name: req.user?.username || 'Anonymous User',
            action: 'API_ACCESS',
            description: `API access: ${req.method} ${req.originalUrl}`,
            metadata: {
              ip_address: req.ip || req.connection?.remoteAddress,
              user_agent: req.get('User-Agent'),
              api_endpoint: req.originalUrl,
              method: req.method,
              response_status: res.statusCode,
              response_time_ms: responseTime,
              request_size: req.get('content-length') || 0,
              response_size: data ? JSON.stringify(data).length : 0
            },
            severity: 'low',
            category: 'system',
            status: res.statusCode < 400 ? 'success' : 'failure'
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
