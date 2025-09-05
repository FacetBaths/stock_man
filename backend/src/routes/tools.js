const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import models
const SKU = require('../models/SKU');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const Instance = require('../models/Instance');
const Inventory = require('../models/Inventory');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

// Validation middleware for tool checkout
const validateToolCheckout = [
  body('customer_name')
    .notEmpty()
    .withMessage('Customer name is required')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Customer name must be between 1 and 200 characters'),
  body('tag_type')
    .optional()
    .isIn(['reserved', 'broken', 'imperfect', 'loaned', 'stock'])
    .withMessage('Tag type must be reserved, broken, imperfect, loaned, or stock'),
  body('project_name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Project name cannot exceed 200 characters'),
  body('sku_items')
    .isArray({ min: 1 })
    .withMessage('SKU items array is required and must contain at least one item'),
  body('sku_items').custom((skuItems) => {
    if (!Array.isArray(skuItems)) {
      throw new Error('sku_items must be an array');
    }
    for (let i = 0; i < skuItems.length; i++) {
      const item = skuItems[i];
      if (!item.sku_id || typeof item.sku_id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(item.sku_id)) {
        throw new Error(`sku_items[${i}].sku_id must be a valid MongoDB ID`);
      }
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1 || !Number.isInteger(item.quantity)) {
        throw new Error(`sku_items[${i}].quantity must be a positive integer`);
      }
    }
    return true;
  }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date')
];

// GET /api/tools/inventory - Get tools-only inventory view
router.get('/inventory', auth, async (req, res) => {
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
    console.log('🔧 [Tools Inventory API] Starting real-time tools inventory calculation...');

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
      
      // ✅ FILTER: Include ONLY tools in tools inventory view
      {
        $match: {
          'category.type': 'tool' // Include ONLY tools
        }
      },
      
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
          // ✅ ENSURE: Calculate total value based on quantity and unit cost
          total_value: {
            $multiply: [
              { $size: '$all_instances' }, // total_quantity
              { $ifNull: ['$unit_cost', 0] } // unit_cost with fallback to 0
            ]
          }
        }
      },
      
      // ✅ PROJECT: Explicitly include all necessary SKU fields + calculated fields
      {
        $project: {
          _id: 1,
          sku_id: '$_id',
          sku_code: 1,
          name: 1,
          description: 1,
          brand: 1,
          model: 1,
          unit_cost: 1, // ✅ CRITICAL: Explicitly include unit_cost
          currency: 1,
          status: 1,
          barcode: 1,
          category_id: 1,
          category: 1, // Include the populated category
          total_quantity: 1,
          available_quantity: 1,
          reserved_quantity: 1,
          broken_quantity: 1,
          loaned_quantity: 1,
          total_value: 1, // Include calculated total value
          created_at: 1,
          updated_at: 1
        }
      }
    ];

    // Add additional filters
    if (category_id) {
      pipeline.splice(2, 0, { $match: { category_id: new mongoose.Types.ObjectId(category_id) } });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { sku_code: searchRegex },
            { name: searchRegex },
            { description: searchRegex },
            { 'category.name': searchRegex }
          ]
        }
      });
    }

    // Add status filtering
    if (status !== 'all') {
      let statusMatch = {};
      switch (status) {
        case 'low_stock':
          statusMatch = { 
            $expr: { 
              $and: [
                { $gt: ['$available_quantity', 0] },
                { $lte: ['$available_quantity', 5] } // Assuming 5 is low stock threshold
              ]
            }
          };
          break;
        case 'out_of_stock':
          statusMatch = { available_quantity: 0 };
          break;
        case 'overstock':
          statusMatch = { 
            $expr: { $gte: ['$available_quantity', 50] } // Assuming 50+ is overstock
          };
          break;
      }
      if (Object.keys(statusMatch).length > 0) {
        pipeline.push({ $match: statusMatch });
      }
    }

    // Add sorting
    const sortStage = {};
    sortStage[sort_by] = sort_order === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortStage });

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    console.log('Tools inventory pipeline:', JSON.stringify(pipeline, null, 2));

    const toolsInventory = await SKU.aggregate(pipeline);
    
    // Get total count for pagination (without skip/limit)
    const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
    countPipeline.push({ $count: 'total' });
    const countResult = await SKU.aggregate(countPipeline);
    const totalRecords = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    console.log(`✅ [Tools Inventory API] Found ${toolsInventory.length} tools out of ${totalRecords} total`);

    res.json({
      inventory: toolsInventory,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Tools inventory error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tools inventory', 
      error: error.message 
    });
  }
});

// GET /api/tools/skus - Get tools-only SKU management
router.get('/skus', 
  auth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category_id').optional().isMongoId().withMessage('Category ID must be a valid MongoDB ID'),
    query('status').optional().isIn(['active', 'discontinued', 'pending']).withMessage('status must be active, discontinued, or pending'),
    query('is_lendable').optional().isBoolean().withMessage('is_lendable must be a boolean'),
    query('search').optional().trim(),
    query('sort_by').optional().isIn(['sku_code', 'name', 'unit_cost', 'created_at']).withMessage('Invalid sort field'),
    query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be "asc" or "desc"'),
    query('include_inventory').optional().isBoolean().withMessage('include_inventory must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // ✅ FILTER: Get tool categories to include ONLY tools
      const toolCategories = await Category.find({ type: 'tool' }).select('_id');
      const toolCategoryIds = toolCategories.map(cat => cat._id.toString());
      
      // Build filter for TOOLS ONLY
      const filter = {};
      
      // ✅ FILTER: Include ONLY tool categories in tools SKU view
      if (toolCategoryIds.length > 0) {
        filter.category_id = { $in: toolCategoryIds };
      } else {
        // If no tool categories exist, return empty results
        return res.json({
          skus: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalSkus: 0,
            limit,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }
      
      if (req.query.category_id) {
        // If specific category requested, ensure it's a tool category
        if (!toolCategoryIds.includes(req.query.category_id)) {
          // Return empty results if requesting a non-tool category
          return res.json({
            skus: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalSkus: 0,
              limit,
              hasNextPage: false,
              hasPrevPage: false
            }
          });
        }
        // Use specific category if it's a tool
        filter.category_id = req.query.category_id;
      }
      
      if (req.query.status) {
        filter.status = req.query.status;
      }
      
      if (req.query.is_lendable !== undefined) {
        filter.is_lendable = req.query.is_lendable === 'true';
      }
      
      if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        filter.$or = [
          { sku_code: searchRegex },
          { name: searchRegex },
          { description: searchRegex },
          { manufacturer_model: searchRegex },
          { barcode: searchRegex }
        ];
      }

      // Build sort
      const sortField = req.query.sort_by || 'created_at';
      const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;
      const sort = {};
      sort[sortField] = sortOrder;

      // Execute queries
      let query = SKU.find(filter)
        .populate('category_id', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const [skus, totalSkus] = await Promise.all([
        query,
        SKU.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalSkus / limit);

      // Enrich SKUs with inventory data if requested
      const enrichedSkus = await Promise.all(skus.map(async (sku) => {
        const skuObj = sku.toObject();
        
        if (req.query.include_inventory === 'true') {
          // Get inventory data
          const inventory = await Inventory.findOne({ sku_id: sku._id });
          if (inventory) {
            skuObj.inventory = inventory.getSummary();
          } else {
            skuObj.inventory = {
              total_quantity: 0,
              available_quantity: 0,
              reserved_quantity: 0,
              broken_quantity: 0,
              loaned_quantity: 0,
              is_low_stock: false,
              is_out_of_stock: true,
              needs_reorder: true
            };
          }
        }
        
        return skuObj;
      }));

      console.log(`✅ [Tools SKUs API] Found ${skus.length} tool SKUs out of ${totalSkus} total`);

      res.json({
        skus: enrichedSkus,
        pagination: {
          currentPage: page,
          totalPages,
          totalSkus,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get tools SKUs error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tools SKUs', 
        error: error.message 
      });
    }
  }
);

// GET /api/tools/tags - Get tools-only checkout/loans view
router.get('/tags', 
  auth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('customer_name').optional().trim(),
    query('tag_type').optional().custom((value) => {
      if (!value || value === '') return true; // Allow empty string
      return ['reserved', 'broken', 'imperfect', 'loaned', 'stock'].includes(value);
    }).withMessage('Invalid tag type'),
    query('status').optional().custom((value) => {
      if (!value || value === '') return true; // Allow empty string
      return ['active', 'fulfilled', 'cancelled'].includes(value);
    }).withMessage('Invalid status'),
    query('project_name').optional().trim(),
    query('search').optional().trim(),
    query('include_items').optional().isIn(['true', 'false']).withMessage('include_items must be true or false'),
    query('overdue_only').optional().isIn(['true', 'false']).withMessage('overdue_only must be true or false'),
    query('sort_by').optional().isIn(['created_at', 'due_date', 'customer_name', 'project_name']).withMessage('Invalid sort field'),
    query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be "asc" or "desc"')
  ],
  async (req, res) => {
    try {
      console.log('🔧 [Tools Tags API] Getting tools-only tags...')
      console.log('Query params:', req.query)
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array())
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // ✅ FILTER: Get tool categories to include tags containing ONLY tool SKUs
      const toolCategories = await Category.find({ type: 'tool' }).select('_id');
      const toolCategoryIds = toolCategories.map(cat => cat._id.toString());
      
      // Build query filter
      const filter = {};
      
      // ✅ FILTER: Include tags that contain ONLY tool SKUs in tools view
      if (toolCategoryIds.length > 0) {
        // First get all SKUs that belong to tool categories
        const toolSKUs = await SKU.find({ 
          category_id: { $in: toolCategoryIds } 
        }).select('_id');
        const toolSKUIds = toolSKUs.map(sku => sku._id);
        
        if (toolSKUIds.length > 0) {
          // Include tags that have tool SKUs in their sku_items
          filter['sku_items.sku_id'] = { $in: toolSKUIds };
        } else {
          // If no tool SKUs exist, return empty results
          return res.json({
            tags: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalTags: 0,
              limit,
              hasNextPage: false,
              hasPrevPage: false
            }
          });
        }
      }
      
      if (req.query.customer_name && req.query.customer_name.trim()) {
        filter.customer_name = new RegExp(req.query.customer_name.trim(), 'i');
      }
      
      if (req.query.tag_type && req.query.tag_type.trim()) {
        filter.tag_type = req.query.tag_type;
      }
      
      if (req.query.status && req.query.status.trim()) {
        filter.status = req.query.status;
      }
      
      if (req.query.project_name && req.query.project_name.trim()) {
        filter.project_name = new RegExp(req.query.project_name.trim(), 'i');
      }
      
      if (req.query.search && req.query.search.trim()) {
        const searchRegex = new RegExp(req.query.search.trim(), 'i');
        filter.$or = [
          { customer_name: searchRegex },
          { project_name: searchRegex },
          { notes: searchRegex }
        ];
      }
      
      if (req.query.overdue_only === 'true') {
        filter.status = 'active';
        filter.due_date = { $lt: new Date() };
      }

      console.log('Tools tag query filter:', JSON.stringify(filter, null, 2));

      // Build sort criteria
      const sortField = req.query.sort_by || 'createdAt';
      const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };

      // Get total count for pagination
      const totalTags = await Tag.countDocuments(filter);
      const totalPages = Math.ceil(totalTags / limit);

      // Build query
      let query = Tag.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      // Include item details if requested
      if (req.query.include_items === 'true') {
        query = query.populate({
          path: 'sku_items.sku_id',
          populate: { path: 'category_id' }
        });
      }

      const tags = await query;
      
      // Debug: Log the first tag's structure to see what data we're returning
      if (tags.length > 0) {
        console.log('🔍 [Tools Tags API Debug] First tag structure:', {
          _id: tags[0]._id,
          customer_name: tags[0].customer_name,
          sku_items: tags[0].sku_items.map(item => ({
            sku_id: item.sku_id ? {
              _id: item.sku_id._id,
              name: item.sku_id.name,
              category_type: item.sku_id.category_id?.type
            } : 'NOT_POPULATED',
            selected_instance_ids: item.selected_instance_ids,
            quantity: item.quantity,
            remaining_quantity: item.remaining_quantity
          }))
        });
      }
      
      console.log(`✅ [Tools Tags API] Found ${tags.length} tool tags out of ${totalTags} total`);

      // Enrich tags with calculated fields
      const enrichedTags = tags.map(tag => {
        const tagObj = tag.toObject();
        tagObj.total_quantity = tag.getTotalQuantity();
        tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
        tagObj.is_partially_fulfilled = tag.isPartiallyFulfilled();
        tagObj.is_fully_fulfilled = tag.isFullyFulfilled();
        tagObj.is_overdue = tag.due_date && new Date() > tag.due_date && tag.status === 'active';
        
        // Calculate fulfillment progress percentage
        const totalQty = tag.getTotalQuantity();
        const remainingQty = tag.getTotalRemainingQuantity();
        tagObj.fulfillment_progress = totalQty > 0 ? ((totalQty - remainingQty) / totalQty * 100) : 0;
        
        return tagObj;
      });
      
      res.json({
        tags: enrichedTags,
        pagination: {
          currentPage: page,
          totalPages,
          totalTags,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get tools tags error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tools tags', 
        error: error.message 
      });
    }
  }
);

// POST /api/tools/checkout - Checkout tools to contractors
router.post('/checkout', 
  auth,
  requireWriteAccess,
  validateToolCheckout,
  async (req, res) => {
    try {
      console.log('🔧 [Tools Checkout API] Creating tool checkout...');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Validation: ensure sku_items is provided
      if (!req.body.sku_items) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: [{ msg: 'sku_items is required', path: 'sku_items' }] 
        });
      }
      
      const skuItemsToProcess = req.body.sku_items;

      // ✅ VERIFY: Ensure all SKUs are tools before processing
      for (const item of skuItemsToProcess) {
        const sku = await SKU.findById(item.sku_id).populate('category_id');
        if (!sku) {
          return res.status(400).json({
            message: 'Validation failed',
            errors: [{ msg: `SKU ${item.sku_id} not found`, path: 'sku_items' }]
          });
        }
        
        if (!sku.category_id || sku.category_id.type !== 'tool') {
          return res.status(400).json({
            message: 'Validation failed',
            errors: [{ msg: `SKU ${sku.sku_code} is not a tool and cannot be checked out via tools API`, path: 'sku_items' }]
          });
        }
      }

      console.log('✅ All SKUs verified as tools, creating checkout tag...');

      // Create the tag for tool checkout (similar to existing tag creation)
      const tagData = {
        customer_name: req.body.customer_name,
        tag_type: req.body.tag_type || 'loaned', // Default to loaned for tool checkout
        project_name: req.body.project_name || '',
        sku_items: skuItemsToProcess,
        notes: req.body.notes || `Tool checkout for ${req.body.customer_name}`,
        due_date: req.body.due_date ? new Date(req.body.due_date) : null,
        status: 'active',
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      const tag = new Tag(tagData);
      await tag.save();

      console.log(`✅ [Tools Checkout API] Tool checkout tag created: ${tag._id}`);
      
      // ✅ ASSIGN INSTANCES: Automatically assign available instances to the tag
      try {
        await tag.assignInstances();
        await tag.save(); // Save the tag to persist selected_instance_ids changes
        console.log(`✅ Assigned instances to tool checkout tag ${tag._id}`);
      } catch (error) {
        console.error('Failed to assign instances to tag:', error);
        return res.status(400).json({
          message: 'Failed to assign instances to checkout',
          error: error.message
        });
      }

      // Populate the tag with SKU details for response
      const populatedTag = await Tag.findById(tag._id)
        .populate({
          path: 'sku_items.sku_id',
          populate: { path: 'category_id' }
        });

      const tagObj = populatedTag.toObject();
      tagObj.total_quantity = populatedTag.getTotalQuantity();
      tagObj.remaining_quantity = populatedTag.getTotalRemainingQuantity();

      // Create audit log
      await AuditLog.create({
        event_type: 'tag_created',
        entity_type: 'tag',
        entity_id: tag._id,
        user_id: req.user._id.toString(),
        user_name: req.user.username,
        action: 'CREATE_TOOL_CHECKOUT',
        description: `Tool checkout created for ${req.body.customer_name} with ${skuItemsToProcess.length} SKU(s)`,
        metadata: {
          customer_name: req.body.customer_name,
          project_name: req.body.project_name,
          tag_type: tagData.tag_type,
          sku_count: skuItemsToProcess.length,
          total_quantity: populatedTag.getTotalQuantity()
        },
        category: 'business',
        severity: 'low'
      });

      res.status(201).json({ 
        message: 'Tool checkout created successfully',
        tag: tagObj
      });

    } catch (error) {
      console.error('Tools checkout error:', error);
      res.status(500).json({ 
        message: 'Failed to create tool checkout', 
        error: error.message 
      });
    }
  }
);

// POST /api/tools/:id/return - Return tools (make instances available again)
router.post('/:id/return',
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID format'),
    body('return_notes').optional().isString().trim().isLength({ max: 500 })
      .withMessage('Return notes must be a string with maximum 500 characters'),
    body('returned_condition')
      .optional()
      .isIn(['functional', 'needs_maintenance', 'broken'])
      .withMessage('Returned condition must be functional, needs_maintenance, or broken')
  ],
  async (req, res) => {
    try {
      console.log(`🔧 [Tools Return API] Processing tool return for tag: ${req.params.id}`);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Auth user:', req.user ? { id: req.user._id, username: req.user.username } : 'No user');
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('🚨 [Tools Return API] Validation errors:', errors.array());
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }
      
      console.log('✅ [Tools Return API] Validation passed');

      const tagId = req.params.id;
      const { return_notes, returned_condition } = req.body;

      // Find the tag and verify it's a tool tag
      const tag = await Tag.findById(tagId)
        .populate({
          path: 'sku_items.sku_id',
          populate: { path: 'category_id' }
        });

      if (!tag) {
        return res.status(404).json({
          message: 'Tag not found'
        });
      }

      // Verify this tag contains only tool SKUs
      const nonToolSKUs = tag.sku_items.filter(item => 
        !item.sku_id.category_id || item.sku_id.category_id.type !== 'tool'
      );
      
      if (nonToolSKUs.length > 0) {
        return res.status(400).json({
          message: 'This tag contains non-tool items and cannot be returned via tools API'
        });
      }

      // Verify tag is active and has instances to return
      if (tag.status !== 'active') {
        return res.status(400).json({
          message: `Cannot return tools from a ${tag.status} tag`
        });
      }

      const totalInstancesToReturn = tag.sku_items.reduce((total, item) => {
        return total + (item.selected_instance_ids ? item.selected_instance_ids.length : 0);
      }, 0);

      if (totalInstancesToReturn === 0) {
        return res.status(400).json({
          message: 'No instances to return in this tag'
        });
      }

      console.log(`✅ Returning ${totalInstancesToReturn} tool instances from tag ${tagId}`);

      // Return all instances (set tag_id back to null)
      const allInstanceIds = tag.sku_items.reduce((ids, item) => {
        return ids.concat(item.selected_instance_ids || []);
      }, []);

      // Update instances to make them available again (tag_id: null)
      await Instance.updateMany(
        { _id: { $in: allInstanceIds } },
        { tag_id: null }
      );

      console.log(`✅ Updated ${allInstanceIds.length} instances back to available status`);

      // Handle condition-based tagging if needed
      if (returned_condition && returned_condition !== 'functional') {
        // Create a new tag for tools that need maintenance or are broken
        const conditionTagData = {
          customer_name: `Maintenance - ${tag.customer_name}`,
          tag_type: returned_condition === 'broken' ? 'broken' : 'reserved', // Use 'reserved' for maintenance
          project_name: `Tool condition: ${returned_condition}`,
          sku_items: tag.sku_items.map(item => ({
            sku_id: item.sku_id._id,
            selected_instance_ids: item.selected_instance_ids,
            selection_method: 'manual',
            quantity: item.selected_instance_ids ? item.selected_instance_ids.length : 0,
            remaining_quantity: item.selected_instance_ids ? item.selected_instance_ids.length : 0,
            notes: `Returned with condition: ${returned_condition}`
          })),
          notes: return_notes || `Tools returned with condition: ${returned_condition}`,
          status: 'active',
          created_by: req.user.username,
          last_updated_by: req.user.username
        };

        const conditionTag = new Tag(conditionTagData);
        await conditionTag.save();

        // Re-assign instances to the condition tag
        await Instance.updateMany(
          { _id: { $in: allInstanceIds } },
          { tag_id: conditionTag._id }
        );

        console.log(`✅ Created condition tag ${conditionTag._id} for ${returned_condition} tools`);
      }

      // Mark original tag as fulfilled (returned)
      tag.status = 'fulfilled';
      tag.fulfilled_date = new Date();
      tag.fulfilled_by = req.user.username;
      tag.last_updated_by = req.user.username;
      
      // Add return notes to the tag
      if (return_notes) {
        tag.notes = tag.notes ? `${tag.notes}\n\nReturned: ${return_notes}` : `Returned: ${return_notes}`;
      }

      // Clear selected instances from the original tag
      tag.sku_items.forEach(item => {
        item.selected_instance_ids = [];
        item.remaining_quantity = 0;
      });

      await tag.save();

      console.log(`✅ [Tools Return API] Tag ${tagId} marked as fulfilled/returned`);

      // Create audit log
      await AuditLog.create({
        event_type: 'tag_returned',
        entity_type: 'tag',
        entity_id: tag._id,
        user_id: req.user._id.toString(),
        user_name: req.user.username,
        action: 'RETURN_TOOLS',
        description: `Tools returned from ${tag.customer_name}: ${totalInstancesToReturn} instance(s)`,
        metadata: {
          customer_name: tag.customer_name,
          project_name: tag.project_name,
          instances_returned: totalInstancesToReturn,
          returned_condition: returned_condition || 'functional',
          return_notes: return_notes || ''
        },
        category: 'business',
        severity: 'low'
      });

      // Get updated tag for response
      const updatedTag = await Tag.findById(tagId)
        .populate({
          path: 'sku_items.sku_id',
          populate: { path: 'category_id' }
        });

      const tagObj = updatedTag.toObject();
      tagObj.total_quantity = updatedTag.getTotalQuantity();
      tagObj.remaining_quantity = updatedTag.getTotalRemainingQuantity();

      res.json({ 
        message: 'Tools returned successfully',
        tag: tagObj,
        instances_returned: totalInstancesToReturn,
        condition: returned_condition || 'functional'
      });

    } catch (error) {
      console.error('Tools return error:', error);
      res.status(500).json({ 
        message: 'Failed to return tools', 
        error: error.message 
      });
    }
  }
);

// PUT /api/tools/:id/condition - Change tool condition status
// POST /api/tools/:id/partial-return - Return a subset of instances from a loan
router.post('/:id/partial-return',
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID format'),
    body('items').isArray({ min: 1 }).withMessage('items is required and must be a non-empty array'),
    body('items').custom((items) => {
      if (!Array.isArray(items)) {
        throw new Error('items must be an array');
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.sku_id || typeof item.sku_id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(item.sku_id)) {
          throw new Error(`items[${i}].sku_id must be a valid MongoDB ID`);
        }
        if (!item.instance_ids || !Array.isArray(item.instance_ids) || item.instance_ids.length === 0) {
          throw new Error(`items[${i}].instance_ids must be a non-empty array`);
        }
        for (let j = 0; j < item.instance_ids.length; j++) {
          const instanceId = item.instance_ids[j];
          if (!instanceId || typeof instanceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(instanceId)) {
            throw new Error(`items[${i}].instance_ids[${j}] must be a valid MongoDB ID`);
          }
        }
      }
      return true;
    }),
    body('return_notes').optional().isString().trim().isLength({ max: 500 })
      .withMessage('Return notes must be a string with maximum 500 characters'),
    body('returned_condition')
      .optional()
      .isIn(['functional', 'needs_maintenance', 'broken'])
      .withMessage('Returned condition must be functional, needs_maintenance, or broken')
  ],
  async (req, res) => {
    try {
      console.log('🔧 [Partial Return] Request received');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Request params:', req.params);
      console.log('Auth user:', req.user ? { id: req.user._id, username: req.user.username } : 'No user');
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('🚨 [Partial Return] Validation failed:', errors.array());
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }
      
      console.log('✅ [Partial Return] Validation passed');

      const tagId = req.params.id;
      const { items, return_notes, returned_condition } = req.body;

      const tag = await Tag.findById(tagId)
        .populate({ path: 'sku_items.sku_id', populate: { path: 'category_id' } });
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }
      if (tag.status !== 'active') {
        return res.status(400).json({ message: `Cannot return tools from a ${tag.status} tag` });
      }

      // Validate items against tag contents
      let totalToReturn = 0;
      const instanceIdsToFree = [];

      for (const reqItem of items) {
        const tagItem = tag.sku_items.find(si => si.sku_id._id.toString() === reqItem.sku_id);
        if (!tagItem) {
          return res.status(400).json({ message: `SKU ${reqItem.sku_id} not found in this tag` });
        }
        const availableIds = (tagItem.selected_instance_ids || []).map(id => id.toString());
        const invalid = reqItem.instance_ids.filter(id => !availableIds.includes(id));
        if (invalid.length > 0) {
          return res.status(400).json({ message: `One or more provided instance IDs are not part of this tag` });
        }
        totalToReturn += reqItem.instance_ids.length;
        instanceIdsToFree.push(...reqItem.instance_ids);
      }

      if (totalToReturn === 0) {
        return res.status(400).json({ message: 'No instances selected for return' });
      }

      // Free or reassign instances based on condition
      if (!returned_condition || returned_condition === 'functional') {
        await Instance.updateMany({ _id: { $in: instanceIdsToFree } }, { tag_id: null });
      } else {
        // Build a condition tag with the returned instances
        const conditionTagData = {
          customer_name: `Maintenance - ${tag.customer_name}`,
          tag_type: returned_condition === 'broken' ? 'broken' : 'reserved',
          project_name: `Tool condition: ${returned_condition}`,
          sku_items: items.map(reqItem => ({
            sku_id: reqItem.sku_id,
            selected_instance_ids: reqItem.instance_ids,
            selection_method: 'manual',
            quantity: reqItem.instance_ids.length,
            remaining_quantity: reqItem.instance_ids.length,
            notes: `Returned with condition: ${returned_condition}`
          })),
          notes: return_notes || `Tools returned with condition: ${returned_condition}`,
          status: 'active',
          created_by: req.user.username,
          last_updated_by: req.user.username
        };
        const conditionTag = new Tag(conditionTagData);
        await conditionTag.save();
        await Instance.updateMany({ _id: { $in: instanceIdsToFree } }, { tag_id: conditionTag._id });
      }

      // Remove returned instances from original tag items and filter out empty SKUs
      const updatedSkuItems = [];
      
      tag.sku_items.forEach(item => {
        const matched = items.find(reqItem => reqItem.sku_id === item.sku_id._id.toString());
        if (matched) {
          const removeSet = new Set(matched.instance_ids.map(id => id.toString()));
          item.selected_instance_ids = (item.selected_instance_ids || []).filter(id => !removeSet.has(id.toString()));
          item.remaining_quantity = item.selected_instance_ids.length;
          item.quantity = item.selected_instance_ids.length;
          
          // Only keep SKU items that still have instances
          if (item.selected_instance_ids.length > 0) {
            updatedSkuItems.push(item);
          }
        } else {
          // Keep SKU items that weren't part of this return
          updatedSkuItems.push(item);
        }
      });
      
      // Update the tag's sku_items array
      tag.sku_items = updatedSkuItems;

      // Append return notes
      if (return_notes) {
        tag.notes = tag.notes ? `${tag.notes}\n\nPartial return: ${return_notes}` : `Partial return: ${return_notes}`;
      }

      // If no more instances left, fulfill the tag
      const totalRemaining = tag.sku_items.reduce((sum, it) => sum + (it.selected_instance_ids ? it.selected_instance_ids.length : 0), 0);
      if (totalRemaining === 0) {
        tag.status = 'fulfilled';
        tag.fulfilled_date = new Date();
        tag.fulfilled_by = req.user.username;
      }
      tag.last_updated_by = req.user.username;
      await tag.save();

      // Audit log
      await AuditLog.create({
        event_type: 'tag_partial_returned',
        entity_type: 'tag',
        entity_id: tag._id,
        user_id: req.user._id.toString(),
        user_name: req.user.username,
        action: 'PARTIAL_RETURN_TOOLS',
        description: `Partial return from ${tag.customer_name}: ${totalToReturn} instance(s)`,
        metadata: {
          customer_name: tag.customer_name,
          project_name: tag.project_name,
          instances_returned: totalToReturn,
          returned_condition: returned_condition || 'functional',
          return_notes: return_notes || ''
        },
        category: 'business',
        severity: 'low'
      });

      const updatedTag = await Tag.findById(tagId)
        .populate({ path: 'sku_items.sku_id', populate: { path: 'category_id' } });
      const tagObj = updatedTag.toObject();
      tagObj.total_quantity = updatedTag.getTotalQuantity();
      tagObj.remaining_quantity = updatedTag.getTotalRemainingQuantity();

      return res.json({
        message: 'Partial return processed successfully',
        tag: tagObj,
        instances_returned: totalToReturn,
        condition: returned_condition || 'functional'
      });
    } catch (error) {
      console.error('Tools partial return error:', error);
      res.status(500).json({ message: 'Failed to process partial return', error: error.message });
    }
  }
);

router.put('/:id/condition',
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid instance ID format'),
    body('condition')
      .notEmpty()
      .withMessage('Condition is required')
      .isIn(['functional', 'needs_maintenance', 'broken'])
      .withMessage('Condition must be functional, needs_maintenance, or broken'),
    body('notes').optional().isString().trim().isLength({ max: 500 })
      .withMessage('Notes must be a string with maximum 500 characters'),
    body('reason').optional().isString().trim().isLength({ max: 200 })
      .withMessage('Reason must be a string with maximum 200 characters')
  ],
  async (req, res) => {
    try {
      console.log(`🔧 [Tools Condition API] Changing tool condition for instance: ${req.params.id}`);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const instanceId = req.params.id;
      const { condition, notes, reason } = req.body;

      // Find the instance and verify it's a tool instance
      const instance = await Instance.findById(instanceId)
        .populate({
          path: 'sku_id',
          populate: { path: 'category_id' }
        });

      if (!instance) {
        return res.status(404).json({
          message: 'Tool instance not found'
        });
      }

      // Verify this is a tool instance
      if (!instance.sku_id.category_id || instance.sku_id.category_id.type !== 'tool') {
        return res.status(400).json({
          message: 'This instance is not a tool and cannot have its condition changed via tools API'
        });
      }

      // Check current status
      const currentTag = instance.tag_id ? await Tag.findById(instance.tag_id) : null;
      const currentCondition = currentTag ? 
        (currentTag.tag_type === 'broken' ? 'broken' : 
         currentTag.tag_type === 'reserved' && currentTag.project_name?.includes('Tool condition') ? 'needs_maintenance' : 
         'loaned') : 'functional';

      console.log(`Current condition: ${currentCondition}, New condition: ${condition}`);

      // Prevent condition changes on loaned tools (except to broken for emergencies)
      if (currentTag && currentTag.tag_type === 'loaned' && currentTag.project_name && !currentTag.project_name.includes('Tool condition')) {
        if (condition !== 'broken') {
          return res.status(400).json({
            message: 'Cannot change condition of loaned tools. Return the tool first, or mark as broken if emergency.'
          });
        }
      }

      // If no change needed
      if (currentCondition === condition) {
        return res.json({
          message: 'Tool condition unchanged',
          instance: {
            _id: instance._id,
            sku_id: instance.sku_id,
            condition: currentCondition
          }
        });
      }

      console.log(`✅ Changing tool condition from ${currentCondition} to ${condition}`);

      let newTag = null;
      let actionDescription = '';

      if (condition === 'functional') {
        // Make tool available - remove from any condition tag
        if (instance.tag_id) {
          // Remove from current tag
          if (currentTag) {
            // Remove instance from current tag's selected_instance_ids
            currentTag.sku_items.forEach(item => {
              if (item.sku_id.toString() === instance.sku_id._id.toString()) {
                item.selected_instance_ids = item.selected_instance_ids.filter(
                  id => id.toString() !== instance._id.toString()
                );
                item.remaining_quantity = item.selected_instance_ids.length;
                item.quantity = item.selected_instance_ids.length;
              }
            });
            
            // If tag has no more instances, mark as fulfilled
            const totalRemaining = currentTag.sku_items.reduce((total, item) => 
              total + (item.selected_instance_ids ? item.selected_instance_ids.length : 0), 0);
              
            if (totalRemaining === 0) {
              currentTag.status = 'fulfilled';
              currentTag.fulfilled_date = new Date();
              currentTag.fulfilled_by = req.user.username;
            }
            
            await currentTag.save();
          }
          
          // Set instance as available
          instance.tag_id = null;
          await instance.save();
        }
        actionDescription = `Tool marked as functional and available`;
        
      } else {
        // Create or find maintenance/broken tag
        const conditionTagData = {
          customer_name: `Maintenance - ${instance.sku_id.name}`,
          tag_type: condition === 'broken' ? 'broken' : 'reserved',
          project_name: `Tool condition: ${condition}`,
          sku_items: [{
            sku_id: instance.sku_id._id,
            selected_instance_ids: [instance._id],
            selection_method: 'manual',
            quantity: 1,
            remaining_quantity: 1,
            notes: reason || `Condition change: ${condition}`
          }],
          notes: notes || `Tool condition changed to ${condition}${reason ? `. Reason: ${reason}` : ''}`,
          status: 'active',
          created_by: req.user.username,
          last_updated_by: req.user.username
        };

        newTag = new Tag(conditionTagData);
        await newTag.save();

        // Remove from current tag if exists
        if (instance.tag_id && currentTag) {
          currentTag.sku_items.forEach(item => {
            if (item.sku_id.toString() === instance.sku_id._id.toString()) {
              item.selected_instance_ids = item.selected_instance_ids.filter(
                id => id.toString() !== instance._id.toString()
              );
              item.remaining_quantity = item.selected_instance_ids.length;
              item.quantity = item.selected_instance_ids.length;
            }
          });
          
          const totalRemaining = currentTag.sku_items.reduce((total, item) => 
            total + (item.selected_instance_ids ? item.selected_instance_ids.length : 0), 0);
            
          if (totalRemaining === 0) {
            currentTag.status = 'fulfilled';
            currentTag.fulfilled_date = new Date();
            currentTag.fulfilled_by = req.user.username;
          }
          
          await currentTag.save();
        }

        // Assign to new condition tag
        instance.tag_id = newTag._id;
        await instance.save();
        
        actionDescription = `Tool marked as ${condition}${reason ? ` (${reason})` : ''}`;
        console.log(`✅ Created condition tag ${newTag._id} for ${condition} tool`);
      }

      console.log(`✅ [Tools Condition API] ${actionDescription}`);

      // Create audit log
      await AuditLog.create({
        event_type: 'tool_condition_changed',
        entity_type: 'instance',
        entity_id: instance._id,
        user_id: req.user._id.toString(),
        user_name: req.user.username,
        action: 'CHANGE_TOOL_CONDITION',
        description: `Tool condition changed from ${currentCondition} to ${condition}: ${instance.sku_id.name} (${instance.sku_id.sku_code})`,
        metadata: {
          instance_id: instance._id,
          sku_id: instance.sku_id._id,
          sku_code: instance.sku_id.sku_code,
          old_condition: currentCondition,
          new_condition: condition,
          reason: reason || '',
          notes: notes || ''
        },
        category: 'maintenance',
        severity: condition === 'broken' ? 'medium' : 'low'
      });

      // Get updated instance for response
      const updatedInstance = await Instance.findById(instanceId)
        .populate({
          path: 'sku_id',
          populate: { path: 'category_id' }
        })
        .populate('tag_id');

      res.json({
        message: 'Tool condition updated successfully',
        instance: {
          _id: updatedInstance._id,
          sku_id: {
            _id: updatedInstance.sku_id._id,
            sku_code: updatedInstance.sku_id.sku_code,
            name: updatedInstance.sku_id.name,
            category_id: updatedInstance.sku_id.category_id
          },
          condition: condition,
          tag_id: updatedInstance.tag_id,
          location: updatedInstance.location
        },
        previous_condition: currentCondition,
        action_description: actionDescription
      });

    } catch (error) {
      console.error('Tools condition change error:', error);
      res.status(500).json({ 
        message: 'Failed to change tool condition', 
        error: error.message 
      });
    }
  }
);

// GET /api/tools/stats - Get tools-specific dashboard statistics
router.get('/stats', auth, async (req, res) => {
  try {
    console.log('🔧 [Tools Stats API] Starting real-time tools statistics calculation...');
    const mongoose = require('mongoose');

    // ✅ REAL-TIME TOOLS STATS: Calculate from actual instances and tags for TOOLS ONLY
    const toolsStats = await mongoose.model('SKU').aggregate([
      // Start with active SKUs
      { $match: { status: 'active' } },
      
      // Get category info first
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      
      // ✅ FILTER: Include ONLY tools in tools stats
      {
        $match: {
          'category.type': 'tool' // Include ONLY tools
        }
      },
      
      // Get all instances for each tool SKU
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
      
      // Calculate real-time quantities for tools
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
            $sum: {
              $map: {
                input: '$all_instances',
                as: 'instance',
                in: { $ifNull: ['$$instance.acquisition_cost', '$unit_cost', 0] }
              }
            }
          }
        }
      },
      
      // Group for summary statistics
      {
        $group: {
          _id: null,
          totalTools: { $sum: 1 }, // Total number of tool SKUs
          totalQuantity: { $sum: '$total_quantity' }, // Total tool instances
          availableTools: { $sum: '$available_quantity' }, // Available tool instances
          reservedTools: { $sum: '$reserved_quantity' }, // Reserved tool instances
          brokenTools: { $sum: '$broken_quantity' }, // Broken tool instances
          loanedTools: { $sum: '$loaned_quantity' }, // Loaned tool instances
          totalValue: { $sum: '$total_value' } // Total value of all tools
        }
      }
    ]);

    // ✅ Get overdue loans count for tools
    const toolCategories = await Category.find({ type: 'tool' }).select('_id');
    const toolCategoryIds = toolCategories.map(cat => cat._id);
    
    let overdueLoans = 0;
    if (toolCategoryIds.length > 0) {
      // Get tool SKUs
      const toolSKUs = await SKU.find({ 
        category_id: { $in: toolCategoryIds } 
      }).select('_id');
      const toolSKUIds = toolSKUs.map(sku => sku._id);
      
      if (toolSKUIds.length > 0) {
        // Count overdue loans containing tool SKUs
        overdueLoans = await Tag.countDocuments({
          status: 'active',
          tag_type: 'loaned',
          due_date: { $lt: new Date() },
          'sku_items.sku_id': { $in: toolSKUIds }
        });
      }
    }

    const stats = toolsStats.length > 0 ? toolsStats[0] : {
      totalTools: 0,
      totalQuantity: 0,
      availableTools: 0,
      reservedTools: 0,
      brokenTools: 0,
      loanedTools: 0,
      totalValue: 0
    };

    // Add overdue loans count
    stats.overdueLoans = overdueLoans;

    console.log(`✅ [Tools Stats API] Real-time calculation complete:`);
    console.log(`   - Total Tools (SKUs): ${stats.totalTools}`);
    console.log(`   - Total Instances: ${stats.totalQuantity}`);
    console.log(`   - Available: ${stats.availableTools}`);
    console.log(`   - Loaned: ${stats.loanedTools}`);
    console.log(`   - Overdue: ${stats.overdueLoans}`);
    console.log(`   - Total Value: $${stats.totalValue}`);

    res.json({
      stats: {
        totalTools: stats.totalQuantity, // Total instances (what user expects as "tools on hand")
        availableTools: stats.availableTools, // Available instances
        loanedTools: stats.loanedTools, // Loaned instances
        overdueLoans: stats.overdueLoans, // Overdue loan tags
        totalValue: stats.totalValue // Total value
      },
      meta: {
        totalToolSKUs: stats.totalTools, // Number of different tool types
        calculatedAt: new Date(),
        source: 'real-time'
      }
    });

  } catch (error) {
    console.error('Tools stats error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tools statistics', 
      error: error.message 
    });
  }
});

module.exports = router;
