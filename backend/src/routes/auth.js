const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const {
  auth,
  requireAdminAccess,
  rateLimitAuth,
} = require("../middleware/authEnhanced");

const router = express.Router();

router.get("/users", async (req, res) => {
  const users = await User.find({});
  res.json(users);
});
// Registration route (requires admin access for now)
router.post(
  "/register",
  [
    auth,
    requireAdminAccess,
    rateLimitAuth(60 * 60 * 1000, 5), // 5 registrations per hour
    body("username")
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage(
        "Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens"
      ),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("firstName")
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage(
        "First name is required and must be less than 50 characters"
      ),
    body("lastName")
      .isLength({ min: 1, max: 50 })
      .trim()
      .withMessage("Last name is required and must be less than 50 characters"),
    body("role")
      .isIn(["admin", "warehouse_manager", "sales_rep", "viewer"])
      .withMessage("Invalid role specified"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, email, password, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        return res.status(409).json({
          message: "User already exists with that username or email",
          code: "USER_EXISTS",
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
        isEmailVerified: false,
      });

      await user.save();

      // Log user creation
      await AuditLog.logEvent({
        event_type: "create",
        entity_type: "user",
        entity_id: user._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: "User Registration",
        description: `User ${username} registered by admin ${req.user.username}`,
        metadata: {
          user_role: role,
          registration_method: "admin_created",
          ip_address: req.ip || req.connection?.remoteAddress,
        },
        category: "security",
        severity: "medium",
      });

      const userResponse = user.toSafeObject();
      res.status(201).json({
        message: "User registered successfully",
        user: userResponse,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  }
);

// Login route
router.post(
  "/login",
  [
    rateLimitAuth(15 * 60 * 1000, 10), // 10 attempts per 15 minutes
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;
      const ipAddress = req.ip || req.connection?.remoteAddress;

      // Find user by username or email
      const user = await User.findOne({
        $or: [{ username }, { email: username }],
      }).select("+password");

      if (!user) {
        // Log failed login attempt
        await AuditLog.logEvent({
          event_type: "authentication",
          entity_type: "system",
          user_id: "anonymous",
          user_name: "Anonymous",
          action: "Login Failed - User Not Found",
          description: `Failed login attempt for username: ${username}`,
          metadata: {
            username,
            ip_address: ipAddress,
            reason: "user_not_found",
          },
          category: "security",
          severity: "medium",
        });

        return res.status(401).json({
          message: "Invalid credentials",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        await AuditLog.logEvent({
          event_type: "authentication",
          entity_type: "user",
          entity_id: user._id,
          user_id: user._id,
          user_name: user.username,
          action: "Login Failed - Account Locked",
          description: `Login attempt on locked account: ${user.username}`,
          metadata: {
            username: user.username,
            ip_address: ipAddress,
            lock_until: user.lockUntil,
          },
          category: "security",
          severity: "high",
        });

        return res.status(423).json({
          message:
            "Account temporarily locked due to too many failed login attempts",
          code: "ACCOUNT_LOCKED",
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          message: "Account is deactivated",
          code: "ACCOUNT_INACTIVE",
        });
      }

      // Validate password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        // Increment login attempts
        await user.incLoginAttempts();

        await AuditLog.logEvent({
          event_type: "authentication",
          entity_type: "user",
          entity_id: user._id,
          user_id: user._id,
          user_name: user.username,
          action: "Login Failed - Invalid Password",
          description: `Failed login attempt for user: ${user.username}`,
          metadata: {
            username: user.username,
            ip_address: ipAddress,
            login_attempts: user.loginAttempts + 1,
          },
          category: "security",
          severity: "medium",
        });

        return res.status(401).json({
          message: "Invalid credentials",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Generate tokens
      const { accessToken, refreshToken } = await user.generateTokens();

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Log successful login
      await AuditLog.logEvent({
        event_type: "authentication",
        entity_type: "user",
        entity_id: user._id,
        user_id: user._id,
        user_name: user.username,
        action: "Login Successful",
        description: `User ${user.username} logged in successfully`,
        metadata: {
          ip_address: ipAddress,
          user_agent: req.get("User-Agent"),
        },
        category: "security",
        severity: "low",
      });

      const userResponse = user.toSafeObject();
      res.json({
        message: "Login successful",
        accessToken,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error during login" });
    }
  }
);

// Token refresh route
router.post(
  "/refresh",
  [body("refreshToken").notEmpty().withMessage("Refresh token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { refreshToken } = req.body;

      const result = await User.refreshAccessToken(refreshToken);

      if (!result.success) {
        return res.status(401).json({
          message: result.message,
          code: result.code,
        });
      }

      res.json({
        message: "Token refreshed successfully",
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ message: "Server error during token refresh" });
    }
  }
);

// Get current user info
router.get("/me", auth, (req, res) => {
  const userResponse = req.user.toSafeObject
    ? req.user.toSafeObject()
    : {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        isActive: req.user.isActive,
      };

  res.json({
    user: userResponse,
  });
});

// Logout route
router.post(
  "/logout",
  [auth, body("refreshToken").optional()],
  async (req, res) => {
    console.log("=== LOGOUT ROUTE CALLED ===");
    console.log("User:", req.user?.username);
    console.log("Request body:", req.body);

    try {
      const { refreshToken } = req.body;
      console.log("Refresh token provided:", !!refreshToken);

      if (refreshToken) {
        console.log("Attempting to remove refresh token from user...");
        // Remove the specific refresh token
        await req.user.removeRefreshToken(refreshToken);
        console.log("Refresh token removed successfully");
      }

      console.log("Logging audit event...");
      // Log logout
      await AuditLog.logEvent({
        event_type: "authentication",
        entity_type: "user",
        entity_id: req.user._id,
        user_id: req.user._id,
        user_name: req.user.username,
        action: "Logout",
        description: `User ${req.user.username} logged out`,
        metadata: {
          ip_address: req.ip || req.connection?.remoteAddress,
          token_removed: !!refreshToken,
        },
        category: "security",
        severity: "low",
      });
      console.log("Audit event logged successfully");

      console.log("Sending response...");
      res.json({ message: "Logout successful" });
      console.log("=== LOGOUT ROUTE COMPLETED ===");
    } catch (error) {
      console.error("=== LOGOUT ROUTE ERROR ===");
      console.error("Error details:", error);
      console.error("Error stack:", error.stack);
      res
        .status(500)
        .json({ message: "Server error during logout", error: error.message });
    }
  }
);

// Logout from all devices
router.post("/logout-all", auth, async (req, res) => {
  try {
    // Remove all refresh tokens
    await req.user.removeAllRefreshTokens();

    // Log logout from all devices
    await AuditLog.logEvent({
      event_type: "authentication",
      entity_type: "user",
      entity_id: req.user._id,
      user_id: req.user._id,
      user_name: req.user.username,
      action: "Logout All Devices",
      description: `User ${req.user.username} logged out from all devices`,
      metadata: {
        ip_address: req.ip || req.connection?.remoteAddress,
      },
      category: "security",
      severity: "medium",
    });

    res.json({ message: "Logged out from all devices successfully" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

// Update profile
router.put(
  "/profile",
  [
    auth,
    body("firstName").optional().isLength({ min: 1, max: 50 }).trim(),
    body("lastName").optional().isLength({ min: 1, max: 50 }).trim(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { firstName, lastName, email } = req.body;
      const user = req.user;
      const changes = { before: {}, after: {} };

      // Check email uniqueness if being changed
      if (email && email !== user.email) {
        const existingUser = await User.findOne({
          email,
          _id: { $ne: user._id },
        });
        if (existingUser) {
          return res.status(409).json({
            message: "Email address already in use",
            code: "EMAIL_EXISTS",
          });
        }
      }

      // Track changes and apply updates
      const fieldsToUpdate = ["firstName", "lastName", "email"];
      fieldsToUpdate.forEach((field) => {
        if (req.body[field] !== undefined && req.body[field] !== user[field]) {
          changes.before[field] = user[field];
          changes.after[field] = req.body[field];
          user[field] = req.body[field];
        }
      });

      // Mark email as unverified if changed
      if (changes.after.email) {
        user.isEmailVerified = false;
      }

      await user.save();

      // Log profile update
      if (Object.keys(changes.after).length > 0) {
        await AuditLog.logEvent({
          event_type: "update",
          entity_type: "user",
          entity_id: user._id,
          user_id: user._id,
          user_name: user.username,
          action: "Profile Updated",
          description: `User ${user.username} updated their profile`,
          changes,
          metadata: {
            fields_updated: Object.keys(changes.after),
            ip_address: req.ip || req.connection?.remoteAddress,
          },
          category: "user",
          severity: "low",
        });
      }

      const userResponse = user.toSafeObject();
      res.json({
        message: "Profile updated successfully",
        user: userResponse,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  }
);

// Change password
router.put(
  "/password",
  [
    auth,
    rateLimitAuth(60 * 60 * 1000, 5), // 5 password changes per hour
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select("+password");

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          message: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Remove all refresh tokens (force re-login on other devices)
      await user.removeAllRefreshTokens();

      // Log password change
      await AuditLog.logEvent({
        event_type: "update",
        entity_type: "user",
        entity_id: user._id,
        user_id: user._id,
        user_name: user.username,
        action: "Password Changed",
        description: `User ${user.username} changed their password`,
        metadata: {
          ip_address: req.ip || req.connection?.remoteAddress,
          forced_logout_all_devices: true,
        },
        category: "security",
        severity: "medium",
      });

      res.json({
        message:
          "Password changed successfully. Please log in again on all devices.",
        requiresReauth: true,
      });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  }
);

module.exports = router;
