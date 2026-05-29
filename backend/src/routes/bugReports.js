const express = require('express');
const { body, validationResult } = require('express-validator');
const BugReport = require('../models/BugReport');
const { auth, requireRole } = require('../middleware/authEnhanced');

const router = express.Router();

// GET /api/bug-reports - List reports (admin/warehouse_manager: all, others: own)
router.get('/', auth, async (req, res) => {
  try {
    const { status, type, area, page = 1, limit = 50 } = req.query;
    const filter = {};

    // Non-admin users only see their own reports
    const isPrivileged = ['admin', 'warehouse_manager'].includes(req.user.role);
    if (!isPrivileged) {
      filter.created_by = req.user.username;
    }

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (area) filter.area = area;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      BugReport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BugReport.countDocuments(filter)
    ]);

    res.json({
      reports,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get bug reports error:', error);
    res.status(500).json({ message: 'Failed to fetch bug reports' });
  }
});

// POST /api/bug-reports - Create a new report (any authenticated user)
router.post('/',
  auth,
  [
    body('type').isIn(['bug', 'feature_request']).withMessage('Type must be bug or feature_request'),
    body('area').isIn(['dashboard', 'skus', 'tags', 'tools', 'multiple', 'other']).withMessage('Invalid area'),
    body('description').optional().trim().isLength({ max: 2000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const report = new BugReport({
        type: req.body.type,
        area: req.body.area,
        description: req.body.description || '',
        created_by: req.user.username,
        created_by_role: req.user.role
      });

      await report.save();
      res.status(201).json({ message: 'Report submitted', report });
    } catch (error) {
      console.error('Create bug report error:', error);
      res.status(500).json({ message: 'Failed to create report' });
    }
  }
);

// POST /api/bug-reports/:id/replies - Add a reply (any authenticated user)
router.post('/:id/replies',
  auth,
  [
    body('message').notEmpty().trim().isLength({ max: 2000 }).withMessage('Message is required (max 2000 chars)')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const report = await BugReport.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      // Non-privileged users can only reply to their own reports
      const isPrivileged = ['admin', 'warehouse_manager'].includes(req.user.role);
      if (!isPrivileged && report.created_by !== req.user.username) {
        return res.status(403).json({ message: 'Not authorized to reply to this report' });
      }

      report.replies.push({
        message: req.body.message,
        author: req.user.username,
        author_role: req.user.role
      });

      await report.save();
      res.json({ message: 'Reply added', report });
    } catch (error) {
      console.error('Add reply error:', error);
      res.status(500).json({ message: 'Failed to add reply' });
    }
  }
);

// PUT /api/bug-reports/:id/status - Update status (admin/warehouse_manager only)
router.put('/:id/status',
  auth,
  requireRole('admin', 'warehouse_manager'),
  [
    body('status').isIn(['open', 'in_progress', 'resolved']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const report = await BugReport.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      res.json({ message: 'Status updated', report });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ message: 'Failed to update status' });
    }
  }
);

// DELETE /api/bug-reports/:id - Delete report (admin only)
router.delete('/:id',
  auth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const report = await BugReport.findByIdAndDelete(req.params.id);
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      res.json({ message: 'Report deleted' });
    } catch (error) {
      console.error('Delete bug report error:', error);
      res.status(500).json({ message: 'Failed to delete report' });
    }
  }
);

module.exports = router;
