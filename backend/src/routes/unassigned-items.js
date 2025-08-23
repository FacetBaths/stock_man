const express = require('express');
const { body, validationResult } = require('express-validator');
const ItemNew = require('../models/ItemNew');
const SKUNew = require('../models/SKUNew');
const Inventory = require('../models/Inventory');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// GET /api/unassigned-items - Get all items without SKU assignments
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      location,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    let query = { sku_id: null };
    
    // Location filtering
    if (location && location !== 'all') {
      query.location = { $regex: location, $options: 'i' };
    }

    // Build sort object
    const sortField = sort_by;
    const sortDirection = sort_order === 'asc' ? 1 : -1;

    // Get total count for pagination
    const totalItems = await ItemNew.countDocuments(query);

    // Get items with pagination
    const items = await ItemNew.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get location statistics
    const locationStats = await ItemNew.aggregate([
      { $match: { sku_id: null } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      items,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalItems / limit),
        total_items: totalItems,
        items_per_page: parseInt(limit)
      },
      location_stats: locationStats,
      filters: {
        location,
        sort_by,
        sort_order
      }
    });

  } catch (error) {
    console.error('Get unassigned items error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/unassigned-items/stats - Get statistics about unassigned items
router.get('/stats', auth, async (req, res) => {
  try {
    const totalUnassigned = await ItemNew.countDocuments({ sku_id: null });
    const totalAssigned = await ItemNew.countDocuments({ sku_id: { $ne: null } });
    
    // Get distribution by location
    const locationDistribution = await ItemNew.aggregate([
      { $match: { sku_id: null } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get recent unassigned items
    const recentItems = await ItemNew.find({ sku_id: null })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('serial_number location purchase_cost createdAt notes')
      .lean();

    res.json({
      summary: {
        total_unassigned: totalUnassigned,
        total_assigned: totalAssigned,
        total_items: totalUnassigned + totalAssigned,
        assignment_percentage: totalAssigned > 0 ? Math.round((totalAssigned / (totalUnassigned + totalAssigned)) * 100) : 0
      },
      location_distribution: locationDistribution,
      recent_items: recentItems
    });

  } catch (error) {
    console.error('Get unassigned items stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/unassigned-items/assign - Assign SKU to one or more items
router.post('/assign', [auth, requireWriteAccess], [
  body('item_ids').isArray({ min: 1 }).withMessage('At least one item ID is required'),
  body('item_ids.*').isMongoId().withMessage('Invalid item ID format'),
  body('sku_id').isMongoId().withMessage('Valid SKU ID is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { item_ids, sku_id, notes } = req.body;
    const updatedBy = req.user.username || 'System';

    // Verify SKU exists
    const sku = await SKUNew.findById(sku_id);
    if (!sku) {
      return res.status(404).json({ message: 'SKU not found' });
    }

    // Verify items exist and are unassigned
    const items = await ItemNew.find({ 
      _id: { $in: item_ids },
      sku_id: null 
    });

    if (items.length !== item_ids.length) {
      return res.status(400).json({ 
        message: 'Some items not found or already assigned' 
      });
    }

    // Update items with SKU assignment
    const updateResult = await ItemNew.updateMany(
      { _id: { $in: item_ids } },
      { 
        $set: {
          sku_id: sku_id,
          last_updated_by: updatedBy,
          updatedAt: new Date()
        },
        $push: {
          notes: notes ? `SKU assigned: ${notes}` : `SKU ${sku.sku_code} assigned`
        }
      }
    );

    // Update or create inventory record
    let inventory = await Inventory.findOne({ sku_id: sku_id });
    
    if (!inventory) {
      inventory = new Inventory({
        sku_id: sku_id,
        available_quantity: items.length,
        reserved_quantity: 0,
        broken_quantity: 0,
        loaned_quantity: 0,
        total_quantity: items.length,
        minimum_stock_level: sku.minimum_stock_level || 0,
        reorder_point: 5,
        average_cost: items.reduce((sum, item) => sum + (item.purchase_cost || 0), 0) / items.length,
        last_updated_by: updatedBy
      });
    } else {
      inventory.available_quantity += items.length;
      inventory.total_quantity += items.length;
      inventory.last_updated_by = updatedBy;
      inventory.last_movement_date = new Date();
    }

    await inventory.save();

    // Log the assignment
    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'items',
      entity_id: null,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'SKU Assignment',
      description: `Assigned ${items.length} items to SKU ${sku.sku_code}`,
      changes: {
        before: { sku_id: null },
        after: { sku_id: sku_id }
      },
      metadata: {
        item_count: items.length,
        sku_code: sku.sku_code,
        item_ids: item_ids,
        ip_address: req.ip || req.connection?.remoteAddress
      },
      category: 'business'
    });

    res.json({
      message: `Successfully assigned ${items.length} items to SKU ${sku.sku_code}`,
      items_updated: updateResult.modifiedCount,
      sku: {
        id: sku._id,
        sku_code: sku.sku_code,
        name: sku.name
      },
      inventory_updated: true
    });

  } catch (error) {
    console.error('Assign SKU error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/unassigned-items/bulk-assign - Assign multiple SKUs to multiple items
router.post('/bulk-assign', [auth, requireWriteAccess], [
  body('assignments').isArray({ min: 1 }).withMessage('At least one assignment is required'),
  body('assignments.*.item_id').isMongoId().withMessage('Invalid item ID format'),
  body('assignments.*.sku_id').isMongoId().withMessage('Invalid SKU ID format'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { assignments, notes } = req.body;
    const updatedBy = req.user.username || 'System';

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const assignment of assignments) {
      try {
        const { item_id, sku_id } = assignment;

        // Verify SKU and item
        const [sku, item] = await Promise.all([
          SKUNew.findById(sku_id),
          ItemNew.findOne({ _id: item_id, sku_id: null })
        ]);

        if (!sku || !item) {
          errorCount++;
          results.push({
            item_id,
            success: false,
            error: !sku ? 'SKU not found' : 'Item not found or already assigned'
          });
          continue;
        }

        // Update item
        await ItemNew.updateOne(
          { _id: item_id },
          { 
            $set: {
              sku_id: sku_id,
              last_updated_by: updatedBy,
              updatedAt: new Date()
            }
          }
        );

        // Update inventory
        const inventory = await Inventory.findOneAndUpdate(
          { sku_id: sku_id },
          {
            $inc: { 
              available_quantity: 1,
              total_quantity: 1
            },
            $set: {
              last_updated_by: updatedBy,
              last_movement_date: new Date()
            }
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true 
          }
        );

        successCount++;
        results.push({
          item_id,
          sku_id,
          sku_code: sku.sku_code,
          success: true
        });

      } catch (error) {
        errorCount++;
        results.push({
          item_id: assignment.item_id,
          success: false,
          error: error.message
        });
      }
    }

    // Log bulk assignment
    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'items',
      entity_id: null,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'Bulk SKU Assignment',
      description: `Bulk assigned SKUs to ${successCount} items (${errorCount} failed)`,
      changes: {
        before: { unassigned_items: assignments.length },
        after: { assigned_items: successCount, failed_items: errorCount }
      },
      metadata: {
        total_assignments: assignments.length,
        successful: successCount,
        failed: errorCount,
        ip_address: req.ip || req.connection?.remoteAddress
      },
      category: 'business'
    });

    res.json({
      message: `Bulk assignment completed: ${successCount} successful, ${errorCount} failed`,
      summary: {
        total_assignments: assignments.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error) {
    console.error('Bulk assign SKU error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
