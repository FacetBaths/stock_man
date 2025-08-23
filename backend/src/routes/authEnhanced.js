const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { 
  auth, 
  requireRole,
  requireAdminAccess,
  rateLimitAuth,
  generateAccessToken,
  generateRefreshToken,
  logAuthSuccess,
  logSecurityEvent
} = require('../middleware/authEnhanced');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Last name is required and must be less than 50 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'warehouse_manager', 'sales_rep', 'viewer'])
    .withMessage('Invalid role specified')
];

const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const passwordChangeValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// POST /api/auth/register - Register a new user (admin only)
router.post('/register', [
  auth,
  requireAdminAccess,
  ...registerValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, role = 'viewer' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      await logSecurityEvent(req.user.id, 'AUTH_REGISTRATION_DUPLICATE', req, {
        attemptedUsername: username,
        attemptedEmail: email
      });
      
      return res.status(409).json({
        message: 'User already exists with that username or email',
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      role,
      isActive: true,
      isEmailVerified: false // In production, send verification email
    });

    await user.save();

    // Log the registration
    await logAuthSuccess(req.user.id, 'USER_REGISTERED', req, {
      newUserId: user._id,
      newUsername: username,
      newUserRole: role
    });

    await AuditLog.logEvent({
      event_type: 'create',
      entity_type: 'user',
      entity_id: user._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'User Registration',
      description: `User ${username} registered with role ${role}`,
      metadata: {
        registeredUserRole: role,
        registeredByAdmin: req.user.username
      },
      category: 'security',
      severity: 'medium'
    });

    // Return user info without sensitive data
    const userResponse = user.toSafeObject();
    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    await AuditLog.logError({
      error,
      user_id: req.user?.id || 'system',
      user_name: req.user?.username || 'System',
      action: 'User Registration Failed',
      description: `Failed to register user: ${error.message}`,
      entity_type: 'user',
      metadata: { requestBody: req.body }
    });
    
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/auth/login - User login with enhanced security
router.post('/login', [
  rateLimitAuth(15 * 60 * 1000, 10), // 10 attempts per 15 minutes per IP
  ...loginValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      isActive: true
    });

    if (!user) {
      await logSecurityEvent(null, 'AUTH_LOGIN_USER_NOT_FOUND', req, {
        attemptedUsername: username
      });
      
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      await logSecurityEvent(user._id, 'AUTH_LOGIN_ACCOUNT_LOCKED', req);
      
      return res.status(423).json({
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      await logSecurityEvent(user._id, 'AUTH_LOGIN_INVALID_PASSWORD', req);
      
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    await user.addRefreshToken(
      refreshToken,
      req.get('User-Agent'),
      req.ip || req.connection?.remoteAddress
    );

    // Update last login
    await user.updateLastLogin();

    // Log successful login
    await logAuthSuccess(user._id, 'AUTH_LOGIN_SUCCESS', req, {
      loginMethod: 'password'
    });

    await AuditLog.logEvent({
      event_type: 'login',
      entity_type: 'user',
      entity_id: user._id,
      user_id: user._id.toString(),
      user_name: user.username,
      action: 'User Login',
      description: `User ${user.username} logged in successfully`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent'),
        login_method: 'password'
      },
      category: 'security',
      severity: 'low'
    });

    // Return user info and tokens
    const userResponse = user.toSafeObject();
    res.json({
      message: 'Login successful',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    await AuditLog.logError({
      error,
      action: 'User Login Failed',
      description: `Login attempt failed: ${error.message}`,
      entity_type: 'user',
      metadata: { username: req.body.username }
    });
    
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { refreshToken } = req.body;

    // Find user by refresh token
    const user = await User.findByRefreshToken(refreshToken);

    if (!user) {
      await logSecurityEvent(null, 'AUTH_REFRESH_INVALID_TOKEN', req);
      
      return res.status(401).json({
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Log token refresh
    await logAuthSuccess(user._id, 'AUTH_TOKEN_REFRESHED', req);

    res.json({
      message: 'Token refreshed successfully',
      accessToken,
      expiresIn: 15 * 60 // 15 minutes
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

// POST /api/auth/logout - User logout
router.post('/logout', [
  auth,
  body('refreshToken').optional()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Remove specific refresh token
      const user = await User.findById(req.user.id);
      if (user) {
        await user.removeRefreshToken(refreshToken);
      }
    }

    // Log logout
    await logAuthSuccess(req.user.id, 'AUTH_LOGOUT', req);

    await AuditLog.logEvent({
      event_type: 'logout',
      entity_type: 'user',
      entity_id: req.user.id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'User Logout',
      description: `User ${req.user.username} logged out`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent')
      },
      category: 'security',
      severity: 'low'
    });

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// POST /api/auth/logout-all - Logout from all devices
router.post('/logout-all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      await user.removeAllRefreshTokens();
    }

    // Log logout from all devices
    await logAuthSuccess(req.user.id, 'AUTH_LOGOUT_ALL_DEVICES', req);

    await AuditLog.logEvent({
      event_type: 'logout',
      entity_type: 'user',
      entity_id: req.user.id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'Logout All Devices',
      description: `User ${req.user.username} logged out from all devices`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent')
      },
      category: 'security',
      severity: 'medium'
    });

    res.json({ message: 'Logged out from all devices' });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Logout from all devices failed' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const userResponse = user.toSafeObject();
    res.json({ user: userResponse });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ message: 'Failed to get user information' });
  }
});

// PUT /api/auth/me - Update current user profile
router.put('/me', [
  auth,
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, preferences } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const changes = { before: {}, after: {} };

    // Update allowed fields
    if (firstName && firstName !== user.firstName) {
      changes.before.firstName = user.firstName;
      changes.after.firstName = firstName;
      user.firstName = firstName;
    }

    if (lastName && lastName !== user.lastName) {
      changes.before.lastName = user.lastName;
      changes.after.lastName = lastName;
      user.lastName = lastName;
    }

    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(409).json({
          message: 'Email already in use',
          code: 'EMAIL_EXISTS'
        });
      }

      changes.before.email = user.email;
      changes.after.email = email;
      user.email = email;
      user.isEmailVerified = false; // Reset email verification
    }

    if (preferences) {
      changes.before.preferences = user.preferences;
      changes.after.preferences = { ...user.preferences, ...preferences };
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    // Log profile update
    if (Object.keys(changes.after).length > 0) {
      await AuditLog.logEvent({
        event_type: 'update',
        entity_type: 'user',
        entity_id: user._id,
        user_id: user._id.toString(),
        user_name: user.username,
        action: 'Profile Updated',
        description: `User ${user.username} updated their profile`,
        changes,
        metadata: {
          ip_address: req.ip || req.connection?.remoteAddress,
          fields_updated: Object.keys(changes.after)
        },
        category: 'business',
        severity: 'low'
      });
    }

    const userResponse = user.toSafeObject();
    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// PUT /api/auth/change-password - Change password
router.put('/change-password', [
  auth,
  rateLimitAuth(60 * 60 * 1000, 3), // 3 attempts per hour
  ...passwordChangeValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      await logSecurityEvent(user._id, 'AUTH_CHANGE_PASSWORD_INVALID_CURRENT', req);
      
      return res.status(401).json({
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save(); // This will trigger the pre-save hook to hash the password

    // Remove all refresh tokens (force re-login)
    await user.removeAllRefreshTokens();

    // Log password change
    await logAuthSuccess(user._id, 'AUTH_PASSWORD_CHANGED', req);

    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'user',
      entity_id: user._id,
      user_id: user._id.toString(),
      user_name: user.username,
      action: 'Password Changed',
      description: `User ${user.username} changed their password`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        forced_relogin: true
      },
      category: 'security',
      severity: 'medium'
    });

    res.json({
      message: 'Password changed successfully. Please log in again with your new password.',
      requiresReauth: true
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Password change failed' });
  }
});

module.exports = router;
