const express = require('express');
const { body, validationResult } = require('express-validator');
const Inventory = require('../models/Inventory');
const SKU = require('../models/SKU');
const Tag = require('../models/Tag');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Validation middleware
const validateInventoryUpdate = [
  body('available').optional().isNumeric().isInt({ min: 0 }).withMessage('Available quantity must be a non-negative integer'),
  body('reserved').optional().isNumeric().isInt({ min: 0 }).withMessage('Reserved quantity must be a non-negative integer'),
  body('broken').optional().isNumeric().isInt({ min: 0 }).withMessage('Broken quantity must be a non-negative integer'),
  body('loaned').optional().isNumeric().isInt({ min: 0 }).withMessage('Loaned quantity must be a non-negative integer'),
  body('minimum_stock_level').optional().isNumeric().isInt({ min: 0 }).withMessage('Minimum stock level must be a non-negative integer'),
  body('reorder_point').optional().isNumeric().isInt({ min: 0 }).withMessage('Reorder point must be a non-negative integer'),
  body('maximum_stock_level').optional().isNumeric().isInt({ min: 0 }).withMessage('Maximum stock level must be a non-negative integer'),
  body('average_cost').optional().isNumeric().isFloat({ min: 0 }).withMessage('Average cost must be a non-negative number')
];

const validateStockMovement = [
  body('quantity').isNumeric().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('from_status').optional().isIn(['available', 'reserved', 'broken', 'loaned']).withMessage('Invalid from status'),
  body('to_status').optional().isIn(['available', 'reserved', 'broken', 'loaned']).withMessage('Invalid to status'),
  body('reason').optional().trim(),
  body('notes').optional().trim()
];

// Helper function to ensure inventory record exists for a SKU
async function ensureInventoryRecord(skuId, updatedBy = 'System') {
  let inventory = await Inventory.findOne({ sku_id: skuId });
  
  if (!inventory) {
    inventory = new Inventory({
      sku_id: skuId,
      available_quantity: 0,
      reserved_quantity: 0,
      broken_quantity: 0,
      loaned_quantity: 0,
      last_updated_by: updatedBy
    });
    await inventory.save();
  }
  
  return inventory;
}

// GET /api/inventory - Get inventory summary with filtering and pagination (REAL-TIME INSTANCE-BASED)
router.get('/', auth, async (req, res) => {
  try {
    const {
      category_id,
      search,
      status = 'all', // all, low_stock, out_of_stock, overstock, needs_reorder
      page = 1,
      limit = 50,
      sort_by = 'sku_code',
      sort_order = 'asc'
    } = req.query;

    const mongoose = require('mongoose');
    console.log('🔄 [Inventory API] Starting real-time instance-based inventory calculation...');

    // Build aggregation pipeline starting from SKUs (not stored Inventory records)
    let pipeline = [
      // Start with active SKUs
      {
        $match: { 
          status: 'active' // Only active SKUs
        }
      },
      
      // Get category info
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      
      // ✅ REAL-TIME CALCULATION: Count instances for each SKU
      {
        $lookup: {
          from: 'instances',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'all_instances'
        }
      },
      
      // ✅ REAL-TIME CALCULATION: Get tag info for tagged instances
      {
        $lookup: {
          from: 'instances',
          let: { skuId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$sku_id', '$$skuId'] },
                tag_id: { $ne: null }
              }
            },
            {
              $lookup: {
                from: 'tags',
                localField: 'tag_id',
                foreignField: '_id',
                as: 'tag'
              }
            },
            { $unwind: '$tag' },
            {
              $group: {
                _id: '$tag.tag_type',
                count: { $sum: 1 }
              }
            }
          ],
          as: 'tag_breakdown'
        }
      },
      
      // ✅ CALCULATE REAL-TIME QUANTITIES FROM ACTUAL INSTANCES
      {
        $addFields: {
          sku_id: '$_id', // For compatibility
          total_quantity: { $size: '$all_instances' },
          available_quantity: {
            $size: {
              $filter: {
                input: '$all_instances',
                cond: { $eq: ['$$this.tag_id', null] }
              }
            }
          },
          reserved_quantity: {
            $let: {
              vars: {
                reserved_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $eq: ['$$this._id', 'reserved'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$reserved_breakdown.count', 0] }
            }
          },
          broken_quantity: {
            $let: {
              vars: {
                broken_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $in: ['$$this._id', ['broken', 'imperfect']] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$broken_breakdown.count', 0] }
            }
          },
          loaned_quantity: {
            $let: {
              vars: {
                loaned_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $eq: ['$$this._id', 'loaned'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$loaned_breakdown.count', 0] }
            }
          },
          // Calculate financial data from instances
          total_value: {
            $sum: '$all_instances.acquisition_cost'
          },
          average_cost: {
            $cond: {
              if: { $gt: [{ $size: '$all_instances' }, 0] },
              then: {
                $divide: [
                  { $sum: '$all_instances.acquisition_cost' },
                  { $size: '$all_instances' }
                ]
              },
              else: 0
            }
          }
        }
      },
      
      // Get inventory settings (thresholds) from stored Inventory records if they exist
      {
        $lookup: {
          from: 'inventory',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'inventory_settings'
        }
      },
      
      // Add inventory settings and computed flags
      {
        $addFields: {
          minimum_stock_level: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.minimum_stock_level', 0] },
              0
            ]
          },
          reorder_point: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.reorder_point', 0] },
              5
            ]
          },
          maximum_stock_level: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.maximum_stock_level', 0] },
              null
            ]
          },
          last_movement_date: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.last_movement_date', 0] },
              new Date()
            ]
          },
          last_updated_by: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.last_updated_by', 0] },
              'System'
            ]
          }
        }
      },
      
      // Calculate status flags based on real-time quantities
      {
        $addFields: {
          is_out_of_stock: { $eq: ['$available_quantity', 0] },
          is_low_stock: {
            $and: [
              { $gt: ['$available_quantity', 0] },
              { $lte: ['$available_quantity', '$minimum_stock_level'] }
            ]
          },
          is_overstock: {
            $and: [
              { $ne: ['$maximum_stock_level', null] },
              { $gt: ['$total_quantity', '$maximum_stock_level'] }
            ]
          },
          needs_reorder: { $lte: ['$available_quantity', '$reorder_point'] },
          utilization_rate: {
            $cond: {
              if: { $gt: ['$total_quantity', 0] },
              then: {
                $multiply: [
                  { $divide: [{ $subtract: ['$total_quantity', '$available_quantity'] }, '$total_quantity'] },
                  100
                ]
              },
              else: 0
            }
          },
          has_tags: {
            $or: [
              { $gt: ['$reserved_quantity', 0] },
              { $gt: ['$broken_quantity', 0] },
              { $gt: ['$loaned_quantity', 0] }
            ]
          },
          tag_summary: {
            reserved: '$reserved_quantity',
            broken: '$broken_quantity', 
            loaned: '$loaned_quantity',
            totalTagged: {
              $add: ['$reserved_quantity', '$broken_quantity', '$loaned_quantity']
            }
          }
        }
      },
      
      // Clean up temporary fields and rename SKU fields for compatibility
      {
        $addFields: {
          sku: {
            _id: '$_id',
            sku_code: '$sku_code',
            name: '$name',
            description: '$description',
            brand: '$brand',
            model: '$model',
            unit_cost: '$unit_cost',
            barcode: '$barcode',
            category_id: '$category_id',
            status: '$status'
          }
        }
      },
      
      // Remove temporary fields
      {
        $unset: ['all_instances', 'tag_breakdown', 'inventory_settings']
      }
    ];

    // Category filtering - only apply if we have a valid non-empty category ID
    if (category_id && category_id !== 'all' && typeof category_id === 'string' && category_id.trim() !== '') {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(category_id)) {
        console.error('Invalid category_id format:', category_id);
        return res.status(400).json({ message: 'Invalid category ID format' });
      }
      
      console.log('Applying category filter:', category_id);
      pipeline.push({
        $match: { 'category_id': new mongoose.Types.ObjectId(category_id) }
      });
    } else {
      console.log('No category filter applied. category_id value:', category_id);
    }

    // Search filtering
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      pipeline.push({
        $match: {
          $or: [
            { 'sku_code': { $regex: searchTerm, $options: 'i' } },
            { 'description': { $regex: searchTerm, $options: 'i' } },
            { 'name': { $regex: searchTerm, $options: 'i' } },
            { 'category.name': { $regex: searchTerm, $options: 'i' } }
          ]
        }
      });
    }

    // Status-based filtering (after calculations)
    if (status === 'low_stock') {
      pipeline.push({ $match: { is_low_stock: true } });
    } else if (status === 'out_of_stock') {
      pipeline.push({ $match: { is_out_of_stock: true } });
    } else if (status === 'overstock') {
      pipeline.push({ $match: { is_overstock: true } });
    } else if (status === 'needs_reorder') {
      pipeline.push({ $match: { needs_reorder: true } });
    }

    // Sorting
    const sortField = sort_by === 'sku_code' ? 'sku_code' : sort_by;
    const sortDirection = sort_order === 'desc' ? -1 : 1;
    pipeline.push({ $sort: { [sortField]: sortDirection } });

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await mongoose.model('SKU').aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;

    // Apply pagination
    pipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const inventory = await mongoose.model('SKU').aggregate(pipeline);

    console.log(`✅ [Inventory API] Real-time calculation complete: ${inventory.length} SKUs processed`);

    res.json({
      inventory,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalItems / limit),
        total_items: totalItems,
        items_per_page: parseInt(limit)
      },
      filters: {
        category_id,
        search,
        status,
        sort_by,
        sort_order
      }
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/inventory/stats - Get inventory statistics and dashboard data (REAL-TIME INSTANCE-BASED)
router.get('/stats', auth, async (req, res) => {
  try {
    console.log('🔄 [Inventory Stats] Starting real-time statistics calculation...');
    const mongoose = require('mongoose');

    // ✅ REAL-TIME STATS: Calculate from actual instances and tags
    const summaryStats = await mongoose.model('SKU').aggregate([
      // Start with active SKUs
      { $match: { status: 'active' } },
      
      // Get all instances for each SKU
      {
        $lookup: {
          from: 'instances',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'all_instances'
        }
      },
      
      // Get tag breakdown for tagged instances
      {
        $lookup: {
          from: 'instances',
          let: { skuId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$sku_id', '$$skuId'] },
                tag_id: { $ne: null }
              }
            },
            {
              $lookup: {
                from: 'tags',
                localField: 'tag_id',
                foreignField: '_id',
                as: 'tag'
              }
            },
            { $unwind: '$tag' },
            {
              $group: {
                _id: '$tag.tag_type',
                count: { $sum: 1 }
              }
            }
          ],
          as: 'tag_breakdown'
        }
      },
      
      // Get inventory settings for status flags
      {
        $lookup: {
          from: 'inventory',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'inventory_settings'
        }
      },
      
      // Calculate real-time quantities and status flags
      {
        $addFields: {
          total_quantity: { $size: '$all_instances' },
          available_quantity: {
            $size: {
              $filter: {
                input: '$all_instances',
                cond: { $eq: ['$$this.tag_id', null] }
              }
            }
          },
          reserved_quantity: {
            $let: {
              vars: {
                reserved_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $eq: ['$$this._id', 'reserved'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$reserved_breakdown.count', 0] }
            }
          },
          broken_quantity: {
            $let: {
              vars: {
                broken_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $in: ['$$this._id', ['broken', 'imperfect']] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$broken_breakdown.count', 0] }
            }
          },
          loaned_quantity: {
            $let: {
              vars: {
                loaned_breakdown: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$tag_breakdown',
                        cond: { $eq: ['$$this._id', 'loaned'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$loaned_breakdown.count', 0] }
            }
          },
          total_value: {
            $sum: '$all_instances.acquisition_cost'
          },
          minimum_stock_level: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.minimum_stock_level', 0] },
              0
            ]
          },
          reorder_point: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.reorder_point', 0] },
              5
            ]
          },
          maximum_stock_level: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.maximum_stock_level', 0] },
              null
            ]
          }
        }
      },
      
      // Calculate status flags
      {
        $addFields: {
          is_out_of_stock: { $eq: ['$available_quantity', 0] },
          is_low_stock: {
            $and: [
              { $gt: ['$available_quantity', 0] },
              { $lte: ['$available_quantity', '$minimum_stock_level'] }
            ]
          },
          is_overstock: {
            $and: [
              { $ne: ['$maximum_stock_level', null] },
              { $gt: ['$total_quantity', '$maximum_stock_level'] }
            ]
          },
          needs_reorder: { $lte: ['$available_quantity', '$reorder_point'] }
        }
      },
      
      // Group for summary statistics
      {
        $group: {
          _id: null,
          total_skus: { $sum: 1 },
          total_quantity: { $sum: '$total_quantity' },
          available_quantity: { $sum: '$available_quantity' },
          reserved_quantity: { $sum: '$reserved_quantity' },
          broken_quantity: { $sum: '$broken_quantity' },
          loaned_quantity: { $sum: '$loaned_quantity' },
          total_value: { $sum: '$total_value' },
          low_stock_count: { $sum: { $cond: ['$is_low_stock', 1, 0] } },
          out_of_stock_count: { $sum: { $cond: ['$is_out_of_stock', 1, 0] } },
          overstock_count: { $sum: { $cond: ['$is_overstock', 1, 0] } },
          needs_reorder_count: { $sum: { $cond: ['$needs_reorder', 1, 0] } }
        }
      }
    ]);

    // ✅ REAL-TIME CATEGORY STATS
    const categoryStats = await mongoose.model('SKU').aggregate([
      { $match: { status: 'active' } },
      
      // Get category info
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      
      // Get instances for real-time calculation
      {
        $lookup: {
          from: 'instances',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'all_instances'
        }
      },
      
      // Get inventory settings
      {
        $lookup: {
          from: 'inventory',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'inventory_settings'
        }
      },
      
      // Calculate quantities
      {
        $addFields: {
          total_quantity: { $size: '$all_instances' },
          available_quantity: {
            $size: {
              $filter: {
                input: '$all_instances',
                cond: { $eq: ['$$this.tag_id', null] }
              }
            }
          },
          total_value: { $sum: '$all_instances.acquisition_cost' },
          minimum_stock_level: {
            $ifNull: [
              { $arrayElemAt: ['$inventory_settings.minimum_stock_level', 0] },
              0
            ]
          },
          is_low_stock: {
            $and: [
              { $gt: [{ $size: {
                $filter: {
                  input: '$all_instances',
                  cond: { $eq: ['$$this.tag_id', null] }
                }
              }}, 0] },
              { $lte: [{ $size: {
                $filter: {
                  input: '$all_instances',
                  cond: { $eq: ['$$this.tag_id', null] }
                }
              }}, {
                $ifNull: [
                  { $arrayElemAt: ['$inventory_settings.minimum_stock_level', 0] },
                  0
                ]
              }] }
            ]
          },
          is_out_of_stock: {
            $eq: [{ $size: {
              $filter: {
                input: '$all_instances',
                cond: { $eq: ['$$this.tag_id', null] }
              }
            }}, 0]
          }
        }
      },
      
      // Group by category
      {
        $group: {
          _id: '$category._id',
          category_name: { $first: '$category.name' },
          sku_count: { $sum: 1 },
          total_quantity: { $sum: '$total_quantity' },
          available_quantity: { $sum: '$available_quantity' },
          total_value: { $sum: '$total_value' },
          low_stock_count: { $sum: { $cond: ['$is_low_stock', 1, 0] } },
          out_of_stock_count: { $sum: { $cond: ['$is_out_of_stock', 1, 0] } }
        }
      },
      { $sort: { category_name: 1 } }
    ]);

    // Recent activity and top value items can stay the same for now
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await Inventory.find({
      is_active: true,
      last_movement_date: { $gte: thirtyDaysAgo }
    })
    .populate('sku_id', 'sku_code description')
    .sort({ last_movement_date: -1 })
    .limit(10)
    .lean();

    const topValueItems = await Inventory.find({
      is_active: true,
      total_value: { $gt: 0 }
    })
    .populate('sku_id', 'sku_code description')
    .sort({ total_value: -1 })
    .limit(10)
    .lean();

    const summary = summaryStats.length > 0 ? summaryStats[0] : {
      total_skus: 0,
      total_quantity: 0,
      available_quantity: 0,
      reserved_quantity: 0,
      broken_quantity: 0,
      loaned_quantity: 0,
      total_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      overstock_count: 0,
      needs_reorder_count: 0
    };

    console.log(`✅ [Inventory Stats] Real-time calculation complete: ${summary.total_skus} SKUs, ${summary.total_quantity} total items`);

    res.json({
      summary,
      by_category: categoryStats,
      recent_activity: recentActivity,
      top_value_items: topValueItems,
      alerts: {
        low_stock: summary.low_stock_count,
        out_of_stock: summary.out_of_stock_count,
        overstock: summary.overstock_count,
        needs_reorder: summary.needs_reorder_count
      }
    });

  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});


// PUT /api/inventory/:sku_id - Update inventory settings for a SKU
router.put('/:sku_id', [auth, requireWriteAccess, ...validateInventoryUpdate], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { sku_id } = req.params;
    const updates = req.body;
    const updatedBy = req.user.username || 'System';

    // Ensure inventory record exists
    let inventory = await ensureInventoryRecord(sku_id, updatedBy);

    // Update quantities if provided
    const quantityUpdates = {};
    if (updates.available !== undefined) quantityUpdates.available = updates.available;
    if (updates.reserved !== undefined) quantityUpdates.reserved = updates.reserved;
    if (updates.broken !== undefined) quantityUpdates.broken = updates.broken;
    if (updates.loaned !== undefined) quantityUpdates.loaned = updates.loaned;

    if (Object.keys(quantityUpdates).length > 0) {
      inventory.updateQuantities(quantityUpdates, updatedBy);
    }

    // Update thresholds and settings
    if (updates.minimum_stock_level !== undefined) inventory.minimum_stock_level = updates.minimum_stock_level;
    if (updates.reorder_point !== undefined) inventory.reorder_point = updates.reorder_point;
    if (updates.maximum_stock_level !== undefined) inventory.maximum_stock_level = updates.maximum_stock_level;
    if (updates.primary_location !== undefined) inventory.primary_location = updates.primary_location;
    if (updates.average_cost !== undefined) inventory.average_cost = updates.average_cost;

    // Update location breakdown if provided
    if (updates.locations && Array.isArray(updates.locations)) {
      inventory.locations = updates.locations;
    }

    await inventory.save();
    await inventory.populate({
      path: 'sku_id',
      populate: {
        path: 'category_id',
        select: 'name description'
      }
    });

    // Log inventory update
    await AuditLog.logEvent({
      event_type: 'update',
      entity_type: 'inventory',
      entity_id: inventory._id,
      user_id: req.user.id,
      user_name: req.user.username,
      action: 'Inventory Settings Updated',
      description: `Updated inventory settings for SKU ${inventory.sku_id.sku_code}`,
      changes: {
        before: {},  // Could track original values if needed
        after: updates
      },
      metadata: {
        sku_code: inventory.sku_id.sku_code,
        ip_address: req.ip || req.connection?.remoteAddress
      },
      category: 'business'
    });

    res.json({
      message: 'Inventory updated successfully',
      inventory
    });

  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/:sku_id/receive - Receive new stock
router.post('/:sku_id/receive', [auth, requireWriteAccess], [
  body('quantity').isNumeric().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('cost').optional().isNumeric().isFloat({ min: 0 }).withMessage('Cost must be non-negative'),
  body('location').optional().trim(),
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

    const { sku_id } = req.params;
    const { quantity, cost, location, notes } = req.body;
    const updatedBy = req.user.username || 'System';

    // Ensure inventory record exists
    let inventory = await ensureInventoryRecord(sku_id, updatedBy);

    // Add the new stock
    inventory.addStock(quantity, cost, updatedBy);

    // Update location if provided
    if (location && location.trim()) {
      const locationIndex = inventory.locations.findIndex(loc => loc.location_name === location);
      if (locationIndex >= 0) {
        inventory.locations[locationIndex].quantity += quantity;
      } else {
        inventory.locations.push({
          location_name: location,
          quantity: quantity
        });
      }
    }

    await inventory.save();
    await inventory.populate('sku_id', 'sku_code description');

    // Log stock receipt
    await AuditLog.logInventoryMovement({
      sku_id: inventory.sku_id._id,
      item_id: null,
      from_status: null,
      to_status: 'available',
      quantity: quantity,
      user_id: req.user.id,
      user_name: req.user.username,
      reason: `Received new stock${cost ? ` at $${cost} per unit` : ''}`,
      tag_id: null
    });

    res.json({
      message: `Successfully received ${quantity} units`,
      inventory,
      movement: {
        type: 'receive',
        quantity,
        cost,
        location,
        notes,
        updated_by: updatedBy,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Receive stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/:sku_id/move - Move inventory between statuses
router.post('/:sku_id/move', [auth, requireWriteAccess, ...validateStockMovement], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { sku_id } = req.params;
    const { quantity, from_status, to_status, reason, notes } = req.body;
    const updatedBy = req.user.username || 'System';

    let inventory = await Inventory.findOne({ sku_id, is_active: true });
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory record not found' });
    }

    // Move inventory between statuses
    inventory.moveInventory(from_status, to_status, quantity, updatedBy);
    await inventory.save();
    await inventory.populate('sku_id', 'sku_code description');

    // Log inventory movement
    await AuditLog.logInventoryMovement({
      sku_id: inventory.sku_id._id,
      item_id: null,
      from_status: from_status,
      to_status: to_status,
      quantity: quantity,
      user_id: req.user.id,
      user_name: req.user.username,
      reason: reason || 'Stock movement',
      tag_id: null
    });

    res.json({
      message: `Successfully moved ${quantity} units from ${from_status} to ${to_status}`,
      inventory,
      movement: {
        type: 'move',
        quantity,
        from_status,
        to_status,
        reason,
        notes,
        updated_by: updatedBy,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Move inventory error:', error);
    if (error.message.includes('Cannot move') || error.message.includes('Invalid status')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/:sku_id/remove - Remove inventory (damage, theft, etc.)
router.post('/:sku_id/remove', [auth, requireWriteAccess], [
  body('quantity').isNumeric().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('from_status').isIn(['available', 'reserved', 'broken', 'loaned']).withMessage('Invalid from status'),
  body('reason').notEmpty().trim().withMessage('Reason is required'),
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

    const { sku_id } = req.params;
    const { quantity, from_status, reason, notes } = req.body;
    const updatedBy = req.user.username || 'System';

    let inventory = await Inventory.findOne({ sku_id, is_active: true });
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory record not found' });
    }

    // Remove inventory
    inventory.removeStock(from_status, quantity, reason, updatedBy);
    await inventory.save();
    await inventory.populate('sku_id', 'sku_code description');

    res.json({
      message: `Successfully removed ${quantity} units from ${from_status}: ${reason}`,
      inventory,
      movement: {
        type: 'remove',
        quantity,
        from_status,
        reason,
        notes,
        updated_by: updatedBy,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Remove inventory error:', error);
    if (error.message.includes('Cannot remove') || error.message.includes('Invalid status')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/alerts/low-stock - Get low stock items
router.get('/alerts/low-stock', auth, async (req, res) => {
  try {
    const lowStockItems = await Inventory.getLowStockItems();
    
    res.json({
      alert_type: 'low_stock',
      count: lowStockItems.length,
      items: lowStockItems
    });

  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/alerts/out-of-stock - Get out of stock items
router.get('/alerts/out-of-stock', auth, async (req, res) => {
  try {
    const outOfStockItems = await Inventory.getOutOfStockItems();
    
    res.json({
      alert_type: 'out_of_stock',
      count: outOfStockItems.length,
      items: outOfStockItems
    });

  } catch (error) {
    console.error('Get out of stock alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/alerts/reorder - Get items needing reorder
router.get('/alerts/reorder', auth, async (req, res) => {
  try {
    const reorderItems = await Inventory.getItemsNeedingReorder();
    
    res.json({
      alert_type: 'reorder_needed',
      count: reorderItems.length,
      items: reorderItems
    });

  } catch (error) {
    console.error('Get reorder alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/reports/valuation - Get inventory valuation report
router.get('/reports/valuation', auth, async (req, res) => {
  try {
    const { category_id } = req.query;

    let matchStage = { is_active: true };
    
    // Build aggregation pipeline
    let pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'skus',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      },
      { $unwind: '$sku' },
      {
        $lookup: {
          from: 'categories',
          localField: 'sku.category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ];

    // Category filtering
    if (category_id && category_id !== 'all') {
      const mongoose = require('mongoose');
      pipeline.push({
        $match: { 'sku.category_id': new mongoose.Types.ObjectId(category_id) }
      });
    }

    // Group by category for summary
    const categorySummary = await Inventory.aggregate([
      ...pipeline,
      {
        $group: {
          _id: '$category._id',
          category_name: { $first: '$category.name' },
          total_skus: { $sum: 1 },
          total_quantity: { $sum: '$total_quantity' },
          available_quantity: { $sum: '$available_quantity' },
          reserved_quantity: { $sum: '$reserved_quantity' },
          broken_quantity: { $sum: '$broken_quantity' },
          loaned_quantity: { $sum: '$loaned_quantity' },
          total_value: { $sum: '$total_value' },
          avg_cost_per_unit: { $avg: '$average_cost' }
        }
      },
      { $sort: { category_name: 1 } }
    ]);

    // Overall totals
    const overallTotals = await Inventory.getTotalInventoryValue();
    const totalValue = overallTotals.length > 0 ? overallTotals[0].total_value : 0;

    // Get detailed items if specific category requested
    let detailedItems = [];
    if (category_id && category_id !== 'all') {
      detailedItems = await Inventory.aggregate([
        ...pipeline,
        {
          $project: {
            sku_code: '$sku.sku_code',
            description: '$sku.description',
            category_name: '$category.name',
            total_quantity: 1,
            available_quantity: 1,
            reserved_quantity: 1,
            broken_quantity: 1,
            loaned_quantity: 1,
            average_cost: 1,
            total_value: 1,
            last_movement_date: 1
          }
        },
        { $sort: { total_value: -1 } }
      ]);
    }

    res.json({
      report_type: 'inventory_valuation',
      generated_at: new Date(),
      category_filter: category_id,
      summary: {
        total_inventory_value: totalValue,
        categories_count: categorySummary.length,
        total_skus: categorySummary.reduce((sum, cat) => sum + cat.total_skus, 0),
        total_quantity: categorySummary.reduce((sum, cat) => sum + cat.total_quantity, 0)
      },
      by_category: categorySummary,
      detailed_items: detailedItems
    });

  } catch (error) {
    console.error('Get valuation report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/reports/movement - Get inventory movement report
router.get('/reports/movement', auth, async (req, res) => {
  try {
    const { 
      days = 30,
      category_id,
      sku_id 
    } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let matchStage = {
      is_active: true,
      last_movement_date: { $gte: startDate }
    };

    // SKU-specific filter
    if (sku_id) {
      const mongoose = require('mongoose');
      matchStage.sku_id = new mongoose.Types.ObjectId(sku_id);
    }

    let pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'skus',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      },
      { $unwind: '$sku' },
      {
        $lookup: {
          from: 'categories',
          localField: 'sku.category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ];

    // Category filtering
    if (category_id && category_id !== 'all') {
      const mongoose = require('mongoose');
      pipeline.push({
        $match: { 'sku.category_id': new mongoose.Types.ObjectId(category_id) }
      });
    }

    // Get active items with recent movement
    const recentActivity = await Inventory.aggregate([
      ...pipeline,
      {
        $project: {
          sku_code: '$sku.sku_code',
          description: '$sku.description',
          category_name: '$category.name',
          total_quantity: 1,
          available_quantity: 1,
          reserved_quantity: 1,
          broken_quantity: 1,
          loaned_quantity: 1,
          last_movement_date: 1,
          last_updated_by: 1,
          locations: 1
        }
      },
      { $sort: { last_movement_date: -1 } },
      { $limit: 100 }
    ]);

    // Movement statistics
    const movementStats = await Inventory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$last_movement_date"
            }
          },
          movement_count: { $sum: 1 },
          items_moved: {
            $sum: {
              $add: [
                '$reserved_quantity',
                '$broken_quantity', 
                '$loaned_quantity'
              ]
            }
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: parseInt(days) }
    ]);

    res.json({
      report_type: 'inventory_movement',
      period_days: parseInt(days),
      start_date: startDate,
      end_date: new Date(),
      category_filter: category_id,
      sku_filter: sku_id,
      summary: {
        total_items_with_movement: recentActivity.length,
        avg_daily_movements: movementStats.length > 0 
          ? Math.round(movementStats.reduce((sum, day) => sum + day.movement_count, 0) / movementStats.length)
          : 0
      },
      daily_stats: movementStats,
      recent_activity: recentActivity
    });

  } catch (error) {
    console.error('Get movement report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/sync - Sync existing Item data into Inventory model
router.post('/sync', [auth, requireWriteAccess], async (req, res) => {
  try {
    const { force_rebuild = false } = req.body;
    const updatedBy = req.user.username || 'System';

    console.log('Starting inventory synchronization...');

    // Get all SKUs that need inventory records
    const allSKUs = await SKU.find({ is_active: true }).select('_id sku_code').lean();
    
    let syncResults = {
      skus_processed: 0,
      records_created: 0,
      records_updated: 0,
      errors: []
    };

    for (const sku of allSKUs) {
      try {
        syncResults.skus_processed++;
        
        // Check if inventory record exists
        let inventory = await Inventory.findOne({ sku_id: sku._id });
        
        if (!inventory) {
          // Create new inventory record
          inventory = new Inventory({
            sku_id: sku._id,
            available_quantity: 0,
            reserved_quantity: 0,
            broken_quantity: 0,
            loaned_quantity: 0,
            minimum_stock_level: 0,
            reorder_point: 5, // Default reorder point
            last_updated_by: updatedBy
          });
          await inventory.save();
          syncResults.records_created++;
          
        } else if (force_rebuild) {
          // Reset and recalculate quantities from tags
          inventory.available_quantity = 0;
          inventory.reserved_quantity = 0;
          inventory.broken_quantity = 0;
          inventory.loaned_quantity = 0;
          inventory.last_updated_by = updatedBy;
          
          // Get active tags for this SKU
          const activeTags = await Tag.find({
            'sku_items.sku_id': sku._id,
            status: 'active'
          }).lean();
          
          // Recalculate quantities based on active tags
          activeTags.forEach(tag => {
            if (tag.sku_items && tag.sku_items.length > 0) {
              tag.sku_items.forEach(item => {
                if (item.sku_id && item.sku_id.toString() === sku._id.toString()) {
                  const quantity = item.quantity || 0;
                  if (tag.tag_type === 'reserved') {
                    inventory.reserved_quantity += quantity;
                  } else if (tag.tag_type === 'broken') {
                    inventory.broken_quantity += quantity;
                  } else if (tag.tag_type === 'loaned') {
                    inventory.loaned_quantity += quantity;
                  }
                }
              });
            }
          });
          
          await inventory.save();
          syncResults.records_updated++;
        }
        
      } catch (error) {
        console.error(`Error syncing SKU ${sku.sku_code}:`, error);
        syncResults.errors.push({
          sku_id: sku._id,
          sku_code: sku.sku_code,
          error: error.message
        });
      }
    }

    console.log('Inventory synchronization completed:', syncResults);

    res.json({
      message: 'Inventory synchronization completed',
      results: syncResults,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Inventory sync error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/:sku_id - Get detailed inventory for specific SKU
// This route MUST be last to avoid conflicts with specific routes above
router.get('/:sku_id', auth, async (req, res) => {
  try {
    const { sku_id } = req.params;

    const inventory = await Inventory.findOne({ sku_id, is_active: true })
      .populate({
        path: 'sku_id',
        populate: {
          path: 'category_id',
          select: 'name description'
        }
      })
      .lean();

    if (!inventory) {
      return res.status(404).json({ message: 'Inventory record not found' });
    }

    // Get related tags for this SKU using Tag model
    let activeTags = await Tag.find({
      'sku_items.sku_id': sku_id,
      status: 'active'
    })
    .select('_id customer_name tag_type project_name due_date status sku_items')
    .lean();

    // Calculate tag summary
    const tagSummary = {
      reserved: 0,
      broken: 0,
      loaned: 0,
      total_tagged: 0
    };

    activeTags.forEach(tag => {
      if (tag.sku_items && tag.sku_items.length > 0) {
        tag.sku_items.forEach(item => {
          if (item.sku_id && item.sku_id.toString() === sku_id) {
            const quantity = item.quantity || 0;
            tagSummary[tag.tag_type] = (tagSummary[tag.tag_type] || 0) + quantity;
            tagSummary.total_tagged += quantity;
          }
        });
      }
    });

    res.json({
      ...inventory,
      tag_summary: tagSummary,
      active_tags: activeTags,
      summary: {
        total_quantity: inventory.total_quantity,
        available_quantity: inventory.available_quantity,
        reserved_quantity: inventory.reserved_quantity,
        broken_quantity: inventory.broken_quantity,
        loaned_quantity: inventory.loaned_quantity,
        is_low_stock: inventory.is_low_stock,
        is_out_of_stock: inventory.is_out_of_stock,
        needs_reorder: inventory.available_quantity <= inventory.reorder_point
      }
    });

  } catch (error) {
    console.error('Get inventory detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
