const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import models
const Instance = require('../models/Instance');
const SKU = require('../models/SKU');
const Inventory = require('../models/Inventory');
const { auth, requireWriteAccess } = require('../middleware/authEnhanced');

// GET /api/instances/:sku_id - Get all instances for a specific SKU
router.get('/:sku_id',
  auth,
  [
    param('sku_id').isMongoId().withMessage('Invalid SKU ID'),
    query('available_only').optional().isBoolean().withMessage('available_only must be boolean'),
    query('include_tagged').optional().isBoolean().withMessage('include_tagged must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      // Build filter
      const filter = { sku_id: req.params.sku_id };
      
      // If available_only is true, only show untagged instances
      if (req.query.available_only === 'true') {
        filter.tag_id = null;
      }

      const instances = await Instance.find(filter)
        .populate('tag_id', 'tag_type customer_name project_name status')
        .sort({ acquisition_date: 1 }); // Oldest first

      // Get cost summary for available instances
      const costSummary = await Instance.getCostSummaryForSKU(req.params.sku_id);

      res.json({
        instances,
        summary: costSummary[0] || {
          count: 0,
          averageCost: 0,
          lowestCost: 0,
          highestCost: 0,
          totalValue: 0
        }
      });

    } catch (error) {
      console.error('Get instances error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// POST /api/instances/add-stock - Add new stock instances
router.post('/add-stock',
  auth,
  requireWriteAccess,
  [
    body('sku_id').isMongoId().withMessage('Invalid SKU ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('unit_cost').isFloat({ min: 0 }).withMessage('Unit cost must be non-negative'),
    body('location').optional().trim(),
    body('supplier').optional().trim(),
    body('reference_number').optional().trim(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { sku_id, quantity, unit_cost, location, supplier, reference_number, notes } = req.body;

      // Verify SKU exists
      const sku = await SKU.findById(sku_id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Create instances
      const instances = [];
      const acquisitionDate = new Date();

      for (let i = 0; i < quantity; i++) {
        const instance = new Instance({
          sku_id,
          acquisition_date: acquisitionDate,
          acquisition_cost: unit_cost,
          location: location || 'Main Warehouse',
          supplier: supplier || '',
          reference_number: reference_number || '',
          notes: notes || '',
          added_by: req.user.username
        });
        
        await instance.save();
        instances.push(instance);
      }

      // Update inventory quantities
      let inventory = await Inventory.findOne({ sku_id });
      if (!inventory) {
        inventory = new Inventory({
          sku_id,
          last_updated_by: req.user.username
        });
      }

      // Add to available quantity and update average cost
      inventory.addStock(quantity, unit_cost, req.user.username);
      await inventory.save();

      res.status(201).json({
        message: `Successfully added ${quantity} instances`,
        instances,
        inventory_summary: inventory.getSummary()
      });

    } catch (error) {
      console.error('Add stock error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// PUT /api/instances/:id - Update an instance (location, notes, etc.)
router.put('/:id',
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid instance ID'),
    body('location').optional().trim(),
    body('supplier').optional().trim(),
    body('reference_number').optional().trim(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const updateData = {};
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.supplier !== undefined) updateData.supplier = req.body.supplier;
      if (req.body.reference_number !== undefined) updateData.reference_number = req.body.reference_number;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      const instance = await Instance.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).populate('sku_id', 'sku_code name')
       .populate('tag_id', 'tag_type customer_name');

      if (!instance) {
        return res.status(404).json({ message: 'Instance not found' });
      }

      res.json({ message: 'Instance updated successfully', instance });

    } catch (error) {
      console.error('Update instance error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// GET /api/instances/cost-breakdown/:sku_id - Get cost breakdown for available instances
router.get('/cost-breakdown/:sku_id',
  auth,
  [
    param('sku_id').isMongoId().withMessage('Invalid SKU ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      // Get available instances grouped by cost
      const costBreakdown = await Instance.aggregate([
        { $match: { sku_id: new require('mongoose').Types.ObjectId(req.params.sku_id), tag_id: null } },
        {
          $group: {
            _id: '$acquisition_cost',
            count: { $sum: 1 },
            oldestDate: { $min: '$acquisition_date' },
            newestDate: { $max: '$acquisition_date' },
            locations: { $addToSet: '$location' },
            suppliers: { $addToSet: '$supplier' }
          }
        },
        { $sort: { _id: 1 } } // Sort by cost
      ]);

      res.json({ cost_breakdown: costBreakdown });

    } catch (error) {
      console.error('Cost breakdown error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;
