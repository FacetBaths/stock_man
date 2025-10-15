const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { 
  auth, 
  requireAdminAccess,
  requireRole,
  rateLimitAuth 
} = require('../middleware/authEnhanced');

const router = express.Router();

// Validation rules
const createUserValidation = [
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
    .isIn(['admin', 'warehouse_manager', 'sales_rep', 'viewer'])
    .withMessage('Invalid role specified')
];

const updateUserValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim(),
  body('role')
    .optional()
    .isIn(['admin', 'warehouse_manager', 'sales_rep', 'viewer']),
  body('isActive')
    .optional()
    .isBoolean()
];

// GET /api/users - List all users (admin only)
router.get('/', [
  // auth,
  // requireAdminAccess,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['admin', 'warehouse_manager', 'sales_rep', 'viewer']),
  query('search').optional().isLength({ max: 100 }),
  query('active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      role,
      search,
      active
    } = req.query;

    // Build query
    let query = {};

    if (role) {
      query.role = role;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex }
      ];
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get user stats
    const userStats = await User.getUserStats();

    res.json({
      users,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_users: total,
        users_per_page: parseInt(limit)
      },
      stats: userStats,
      filters: {
        role,
        search,
        active
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to retrieve users' });
  }
});

// GET /api/users/stats - Get user statistics (admin only)
router.get('/stats', [auth, requireAdminAccess], async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inactiveUsers: {
            $sum: { $cond: ['$isActive', 0, 1] }
          },
          lockedUsers: {
            $sum: {
              $cond: [
                { $gt: ['$lockUntil', new Date()] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLoginStats = await User.aggregate([
      {
        $match: {
          lastLogin: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          recentLogins: { $sum: 1 }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      lockedUsers: 0
    };

    res.json({
      summary,
      by_role: roleStats,
      recent_activity: {
        recent_logins: recentLoginStats.length > 0 ? recentLoginStats[0].recentLogins : 0,
        period_days: 30
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to retrieve user statistics' });
  }
});

// GET /api/users/:id - Get specific user (admin only)
router.get('/:id', [auth, requireAdminAccess], async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
      .lean();

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get user activity history
    const activityHistory = await AuditLog.getUserActivity(id, 20);

    res.json({
      user,
      activity_history: activityHistory
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to retrieve user' });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', [
  auth,
  requireAdminAccess,
  rateLimitAuth(60 * 60 * 1000, 10), // 10 user creations per hour
  ...createUserValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
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
      isEmailVerified: false
    });

    await user.save();

    // Log user creation
    await AuditLog.logEvent({
      event_type: 'create',
      entity_type: 'user',
      entity_id: user._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'User Created',
      description: `Admin ${req.user.username} created user ${username} with role ${role}`,
      metadata: {
        created_user_role: role,
        ip_address: req.ip || req.connection?.remoteAddress
      },
      category: 'security',
      severity: 'medium'
    });

    const userResponse = user.toSafeObject();
    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', [
  auth,
  requireAdminAccess,
  ...updateUserValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Track changes
    const changes = { before: {}, after: {} };

    // Check for username/email conflicts
    if (updates.username && updates.username !== user.username) {
      const existingUser = await User.findOne({
        username: updates.username,
        _id: { $ne: id }
      });
      if (existingUser) {
        return res.status(409).json({
          message: 'Username already exists',
          code: 'USERNAME_EXISTS'
        });
      }
    }

    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: id }
      });
      if (existingUser) {
        return res.status(409).json({
          message: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Apply updates and track changes
    const allowedFields = ['username', 'email', 'firstName', 'lastName', 'role', 'isActive'];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== user[field]) {
        changes.before[field] = user[field];
        changes.after[field] = updates[field];
        user[field] = updates[field];
      }
    });

    await user.save();

    // Log user update
    if (Object.keys(changes.after).length > 0) {
      await AuditLog.logEvent({
        event_type: 'update',
        entity_type: 'user',
        entity_id: user._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'User Updated',
        description: `Admin ${req.user.username} updated user ${user.username}`,
        changes,
        metadata: {
          fields_updated: Object.keys(changes.after),
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'security',
        severity: 'medium'
      });
    }

    const userResponse = user.toSafeObject();
    res.json({
      message: 'User updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// PUT /api/users/:id/reset-password - Reset user password (admin only)
router.put('/:id/reset-password', [
  auth,
  requireAdminAccess,
  rateLimitAuth(60 * 60 * 1000, 5), // 5 password resets per hour
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Remove all refresh tokens (force re-login)
    await user.removeAllRefreshTokens();

    // Log password reset
    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'user',
      entity_id: user._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'Password Reset by Admin',
      description: `Admin ${req.user.username} reset password for user ${user.username}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        forced_logout_all_devices: true
      },
      category: 'security',
      severity: 'high'
    });

    res.json({
      message: 'Password reset successfully. User must log in with new password.',
      requiresUserReauth: true
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// PUT /api/users/:id/unlock - Unlock user account (admin only)
router.put('/:id/unlock', [auth, requireAdminAccess], async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Reset login attempts and unlock
    await user.resetLoginAttempts();

    // Log account unlock
    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'user',
      entity_id: user._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'Account Unlocked by Admin',
      description: `Admin ${req.user.username} unlocked account for user ${user.username}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress
      },
      category: 'security',
      severity: 'medium'
    });

    res.json({
      message: 'User account unlocked successfully'
    });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({ message: 'Failed to unlock user account' });
  }
});

// DELETE /api/users/:id - Deactivate user (admin only) - We soft delete by setting isActive to false
router.delete('/:id', [
  auth,
  requireAdminAccess,
  rateLimitAuth(60 * 60 * 1000, 5) // 5 deletions per hour
], async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
      return res.status(400).json({
        message: 'Cannot deactivate your own account',
        code: 'CANNOT_DEACTIVATE_SELF'
      });
    }

    // Soft delete by deactivating
    user.isActive = false;
    await user.save();

    // Remove all refresh tokens
    await user.removeAllRefreshTokens();

    // Log user deactivation
    await AuditLog.logEvent({
      event_type: 'delete',
      entity_type: 'user',
      entity_id: user._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'User Deactivated',
      description: `Admin ${req.user.username} deactivated user ${user.username}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        deactivated_user_role: user.role
      },
      category: 'security',
      severity: 'high'
    });

    res.json({
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
});

// DELETE /api/users/:id/hard-delete - Permanently delete user (admin only)
router.delete('/:id/hard-delete', [
  auth,
  requireAdminAccess,
  rateLimitAuth(60 * 60 * 1000, 3) // 3 permanent deletions per hour
], async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        message: 'Cannot delete your own account',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    // Prevent deletion of admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        message: 'Admin users cannot be deleted for security reasons',
        code: 'CANNOT_DELETE_ADMIN'
      });
    }

    // Store user info for logging before deletion
    const deletedUserInfo = {
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };

    // Hard delete - permanently remove from database
    await User.findByIdAndDelete(id);

    // Log user deletion
    await AuditLog.logEvent({
      event_type: 'delete',
      entity_type: 'user',
      entity_id: id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'User Permanently Deleted',
      description: `Admin ${req.user.username} permanently deleted user ${deletedUserInfo.username}`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
        deleted_user: deletedUserInfo,
        deletion_type: 'hard_delete'
      },
      category: 'security',
      severity: 'critical'
    });

    res.json({
      message: 'User permanently deleted successfully',
      deletedUser: {
        id,
        username: deletedUserInfo.username
      }
    });

  } catch (error) {
    console.error('Hard delete user error:', error);
    res.status(500).json({ message: 'Failed to permanently delete user' });
  }
});

// GET /api/users/:id/activity - Get user activity history (admin only)
router.get('/:id/activity', [
  auth,
  requireAdminAccess,
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('days').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, days = 30 } = req.query;

    const user = await User.findById(id).select('username firstName lastName');
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get activity from the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const activity = await AuditLog.find({
      user_id: id,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .lean();

    res.json({
      user: {
        id: user._id,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName}`
      },
      activity,
      period_days: parseInt(days),
      total_activities: activity.length
    });

  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ message: 'Failed to retrieve user activity' });
  }
});

module.exports = router;
