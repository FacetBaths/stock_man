const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Login route
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Determine user role and validate password
    let role = null;
    let isValidPassword = false;

    if (username === 'admin') {
      isValidPassword = password === process.env.ADMIN_PASSWORD;
      role = 'admin';
    } else if (username === 'warehouse') {
      isValidPassword = password === process.env.WAREHOUSE_PASSWORD;
      role = 'warehouse_manager';
    } else if (username === 'sales' || username.startsWith('sales')) {
      // For demo purposes, any username starting with 'sales' with any password works
      // In production, you'd want proper validation
      isValidPassword = password.length > 0;
      role = 'sales_rep';
    }

    if (!isValidPassword || !role) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username, role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        username,
        role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user info
router.get('/me', auth, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      role: req.user.role
    }
  });
});

// Logout route (client-side token removal)
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;
