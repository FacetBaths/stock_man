const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import new models
const TagNew = require('../models/TagNew');
const ItemNew = require('../models/ItemNew');
const SKUNew = require('../models/SKUNew');
const Inventory = require('../models/Inventory');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

// Validation middleware for tag creation/updates
const validateTag = [
  body('customer_name')
    .notEmpty()
    .withMessage('Customer name is required')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Customer name must be between 1 and 200 characters'),
  body('tag_type')
    .notEmpty()
    .withMessage('Tag type is required')
    .isIn(['reserved', 'broken', 'imperfect', 'loaned', 'stock'])
    .withMessage('Tag type must be reserved, broken, imperfect, loaned, or stock'),
  body('project_name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Project name cannot exceed 200 characters'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must contain at least one item'),
  body('items.*.item_id')
    .notEmpty()
    .withMessage('Item ID is required')
    .isMongoId()
    .withMessage('Item ID must be a valid MongoDB ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Item notes cannot exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('status')
    .optional()
    .isIn(['active', 'fulfilled', 'cancelled'])
    .withMessage('Status must be active, fulfilled, or cancelled')
];
// Helper function to check item availability and validate quantities
// Proper architecture: Tags reference Items, Items reference SKUs
async function checkItemAvailability(items) {
  const availability = [];
  
  for (const tagItem of items) {
    try {
      // Get the item details (this should be an actual Item ID)
      const item = await ItemNew.findById(tagItem.item_id)
        .populate({
          path: 'sku_id',
          populate: { path: 'category_id' }
        });
      
      if (!item) {
        availability.push({
          item_id: tagItem.item_id,
          error: 'Item not found',
          can_fulfill: false
        });
        continue;
      }
      
      // Check if the item itself has sufficient quantity
      if (tagItem.quantity > item.quantity) {
        availability.push({
          item_id: tagItem.item_id,
          item_details: item,
          error: `Item only has ${item.quantity} units, requested ${tagItem.quantity}`,
          can_fulfill: false
        });
        continue;
      }
      
      // Get current inventory status for this SKU
      const inventory = await Inventory.findOne({ sku_id: item.sku_id });
      if (!inventory) {
        availability.push({
          item_id: tagItem.item_id,
          item_details: item,
          error: 'No inventory record found',
          can_fulfill: false
        });
        continue;
      }
      
      // Check if enough quantity is available in inventory
      const availableQuantity = inventory.available_quantity || 0;
      const canFulfill = tagItem.quantity <= availableQuantity;
      
      availability.push({
        item_id: tagItem.item_id,
        item_details: item,
        requested_quantity: tagItem.quantity,
        available_quantity: availableQuantity,
        can_fulfill: canFulfill,
        shortage: canFulfill ? 0 : tagItem.quantity - availableQuantity
      });
      
    } catch (error) {
      availability.push({
        item_id: tagItem.item_id,
        error: error.message,
        can_fulfill: false
      });
    }
  }
  
  return availability;
}

// Helper function to update inventory when tag is created/modified
// Proper architecture: Items reference SKUs, update inventory based on SKU
async function updateInventoryForTag(items, tagType, operation = 'reserve') {
  const updates = [];
  
  for (const tagItem of items) {
    try {
      // Get the item to find its SKU
      const item = await ItemNew.findById(tagItem.item_id);
      if (!item) continue;
      
      // Update inventory for the SKU
      const inventory = await Inventory.findOne({ sku_id: item.sku_id });
      if (!inventory) continue;
      
      let updateData = {};
      
      switch (operation) {
        case 'reserve':
          // Move from available to reserved/broken/loaned based on tag type
          if (tagType === 'reserved') {
            updateData = {
              $inc: {
                available_quantity: -tagItem.quantity,
                reserved_quantity: tagItem.quantity
              }
            };
          } else if (tagType === 'broken') {
            updateData = {
              $inc: {
                available_quantity: -tagItem.quantity,
                broken_quantity: tagItem.quantity
              }
            };
          } else if (tagType === 'loaned') {
            updateData = {
              $inc: {
                available_quantity: -tagItem.quantity,
                loaned_quantity: tagItem.quantity
              }
            };
          }
          break;
          
        case 'release':
          // Move back to available when tag is cancelled
          if (tagType === 'reserved') {
            updateData = {
              $inc: {
                available_quantity: tagItem.quantity,
                reserved_quantity: -tagItem.quantity
              }
            };
          } else if (tagType === 'broken') {
            updateData = {
              $inc: {
                available_quantity: tagItem.quantity,
                broken_quantity: -tagItem.quantity
              }
            };
          } else if (tagType === 'loaned') {
            updateData = {
              $inc: {
                available_quantity: tagItem.quantity,
                loaned_quantity: -tagItem.quantity
              }
            };
          }
          break;
          
        case 'fulfill':
          // Move from reserved to used (reduce total) when fulfilled
          if (tagType === 'reserved') {
            updateData = {
              $inc: {
                reserved_quantity: -tagItem.quantity,
                total_quantity: -tagItem.quantity
              }
            };
          } else if (tagType === 'loaned') {
            // For loans, move from loaned back to available when returned
            updateData = {
              $inc: {
                loaned_quantity: -tagItem.quantity,
                available_quantity: tagItem.quantity
              }
            };
          }
          break;
      }
      
      if (Object.keys(updateData).length > 0) {
        await Inventory.findByIdAndUpdate(inventory._id, updateData);
        updates.push({
          inventory_id: inventory._id,
          item_id: tagItem.item_id,
          operation,
          quantity: tagItem.quantity,
          success: true
        });
      }
      
    } catch (error) {
      updates.push({
        item_id: tagItem.item_id,
        operation,
        error: error.message,
        success: false
      });
    }
  }
  
  return updates;
}
// GET /api/tags/stats - Get tag statistics
router.get('/stats', 
  auth,
  async (req, res) => {
    try {
      // Get overall tag statistics
      const tagStats = await TagNew.aggregate([
        {
          $group: {
            _id: null,
            total_tags: { $sum: 1 },
            active_tags: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            fulfilled_tags: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } },
            cancelled_tags: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
          }
        }
      ]);

      // Get tag statistics by type
      const tagsByType = await TagNew.aggregate([
        {
          $group: {
            _id: '$tag_type',
            count: { $sum: 1 },
            active_count: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            fulfilled_count: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } },
            cancelled_count: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get overdue tags count
      const overdueCount = await TagNew.countDocuments({
        status: 'active',
        due_date: { $lt: new Date() }
      });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivity = await TagNew.aggregate([
        {
          $match: {
            created_at: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$created_at"
              }
            },
            tags_created: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 30 }
      ]);

      const summary = tagStats.length > 0 ? tagStats[0] : {
        total_tags: 0,
        active_tags: 0,
        fulfilled_tags: 0,
        cancelled_tags: 0
      };

      res.json({
        summary: {
          ...summary,
          overdue_tags: overdueCount
        },
        by_type: tagsByType,
        recent_activity: recentActivity
      });

    } catch (error) {
      console.error('Get tag stats error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tag statistics', 
        error: error.message 
      });
    }
  }
);

// GET /api/tags/overdue - Get overdue tags
router.get('/overdue/list',
  auth,
  async (req, res) => {
    try {
      const overdueTags = await TagNew.getOverdueTags();
      
      const enrichedTags = overdueTags.map(tag => {
        const tagObj = tag.toObject();
        tagObj.total_quantity = tag.getTotalQuantity();
        tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
        tagObj.days_overdue = Math.ceil((new Date() - tag.due_date) / (1000 * 60 * 60 * 24));
        return tagObj;
      });

      res.json({
        overdue_tags: enrichedTags,
        count: enrichedTags.length
      });

    } catch (error) {
      console.error('Get overdue tags error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch overdue tags', 
        error: error.message 
      });
    }
  }
);

// GET /api/tags/customer/:customerName - Get tags by customer
router.get('/customer/:customerName', 
  auth,
  [
    param('customerName').notEmpty().withMessage('Customer name is required')
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

      const tags = await TagNew.getTagsByCustomer(req.params.customerName);
      
      const enrichedTags = tags.map(tag => {
        const tagObj = tag.toObject();
        tagObj.total_quantity = tag.getTotalQuantity();
        tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
        tagObj.is_overdue = tag.due_date && new Date() > tag.due_date && tag.status === 'active';
        return tagObj;
      });

      res.json({
        customer_name: req.params.customerName,
        tags: enrichedTags,
        count: enrichedTags.length
      });

    } catch (error) {
      console.error('Get customer tags error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch customer tags', 
        error: error.message 
      });
    }
  }
);

// GET /api/tags - Get all tags with filtering and pagination
router.get('/', 
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

      // Build filter
      const filter = {};
      
      if (req.query.customer_name) {
        filter.customer_name = new RegExp(req.query.customer_name, 'i');
      }
      
      if (req.query.tag_type) {
        filter.tag_type = req.query.tag_type;
      }
      
      if (req.query.status) {
        filter.status = req.query.status;
      } else {
        // Default to active tags only
        filter.status = 'active';
      }
      
      if (req.query.project_name) {
        filter.project_name = new RegExp(req.query.project_name, 'i');
      }
      
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filter.$or = [
          { customer_name: searchRegex },
          { project_name: searchRegex },
          { notes: searchRegex }
        ];
      }
      
      if (req.query.overdue_only === 'true') {
        filter.due_date = { $lt: new Date() };
        filter.status = 'active'; // Only active tags can be overdue
      }

      // Build sort
      const sortField = req.query.sort_by || 'created_at';
      const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;
      const sort = {};
      sort[sortField] = sortOrder;

      // Execute queries
      let query = TagNew.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      // Include item details if requested
      if (req.query.include_items === 'true') {
        query = query.populate({
          path: 'items.item_id',
          populate: {
            path: 'sku_id',
            populate: { path: 'category_id' }
          }
        });
      }

      const [tags, totalTags] = await Promise.all([
        query,
        TagNew.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalTags / limit);

      // Enrich tags with summary data
      const enrichedTags = tags.map(tag => {
        const tagObj = tag.toObject();
        
        // Add calculated fields
        tagObj.total_quantity = tag.getTotalQuantity();
        tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
        tagObj.is_partially_fulfilled = tag.isPartiallyFulfilled();
        tagObj.is_fully_fulfilled = tag.isFullyFulfilled();
        tagObj.is_overdue = tag.due_date && new Date() > tag.due_date && tag.status === 'active';
        
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
      console.error('Get tags error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tags', 
        error: error.message 
      });
    }
  }
);

// GET /api/tags/:id - Get a single tag by ID
router.get('/:id', 
  auth,
  [
    param('id').isMongoId().withMessage('Invalid tag ID'),
    query('include_items').optional().isBoolean().withMessage('include_items must be a boolean')
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

      let query = TagNew.findById(req.params.id);

      // Include item details if requested
      if (req.query.include_items === 'true') {
        query = query.populate({
          path: 'items.item_id',
          populate: {
            path: 'sku_id',
            populate: { path: 'category_id' }
          }
        });
      }

      const tag = await query;

      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      const tagObj = tag.toObject();
      
      // Add calculated fields
      tagObj.total_quantity = tag.getTotalQuantity();
      tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
      tagObj.is_partially_fulfilled = tag.isPartiallyFulfilled();
      tagObj.is_fully_fulfilled = tag.isFullyFulfilled();
      tagObj.is_overdue = tag.due_date && new Date() > tag.due_date && tag.status === 'active';
      
      // Calculate fulfillment progress percentage
      const totalQty = tag.getTotalQuantity();
      const remainingQty = tag.getTotalRemainingQuantity();
      tagObj.fulfillment_progress = totalQty > 0 ? ((totalQty - remainingQty) / totalQty * 100) : 0;

      res.json({ tag: tagObj });

    } catch (error) {
      console.error('Get tag error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tag', 
        error: error.message 
      });
    }
  }
);

// POST /api/tags - Create a new tag
router.post('/', 
  auth,
  requireWriteAccess,
  validateTag,
  async (req, res) => {
    try {
      // Debug: Log the exact request body received
      console.log('=== CREATE TAG REQUEST RECEIVED ===')
      console.log('Request body:', JSON.stringify(req.body, null, 2))
      console.log('Request headers:', req.headers['content-type'])
      console.log('=====================================')
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('=== VALIDATION ERRORS ===')
        console.log('Validation failed for request body:', JSON.stringify(req.body, null, 2))
        console.log('Validation errors:', JSON.stringify(errors.array(), null, 2))
        console.log('==========================')
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      console.log('=== VALIDATION PASSED, CHECKING AVAILABILITY ===')
      
      // Check item availability before creating tag
      console.log('Checking availability for items:', req.body.items)
      const availability = await checkItemAvailability(req.body.items);
      console.log('Availability results:', JSON.stringify(availability, null, 2))
      const unavailableItems = availability.filter(item => !item.can_fulfill);
      console.log('Unavailable items count:', unavailableItems.length)
      
      if (unavailableItems.length > 0) {
        return res.status(400).json({
          message: 'Some items are not available in requested quantities',
          unavailable_items: unavailableItems,
          all_availability: availability
        });
      }

      // Create tag data
      const tagData = {
        customer_name: req.body.customer_name,
        tag_type: req.body.tag_type,
        project_name: req.body.project_name || '',
        items: req.body.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          notes: item.notes || ''
        })),
        notes: req.body.notes || '',
        due_date: req.body.due_date || null,
        status: 'active',
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      // Create the tag
      const tag = new TagNew(tagData);
      await tag.save();

      // Update inventory to reflect the reservation/allocation
      const inventoryUpdates = await updateInventoryForTag(
        req.body.items, 
        req.body.tag_type, 
        'reserve'
      );

      // Check if any inventory updates failed
      const failedUpdates = inventoryUpdates.filter(update => !update.success);
      if (failedUpdates.length > 0) {
        console.warn('Some inventory updates failed:', failedUpdates);
      }

      // Populate item details for response
      await tag.populate({
        path: 'items.item_id',
        populate: {
          path: 'sku_id',
          populate: { path: 'category_id' }
        }
      });

      const tagObj = tag.toObject();
      tagObj.total_quantity = tag.getTotalQuantity();
      tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
      tagObj.inventory_updates = inventoryUpdates;

      // Log tag creation
      await AuditLog.logTagEvent({
        event_type: 'tag_created',
        tag_id: tag._id,
        customer_id: tag.customer_name,
        user_id: req.user.id,
        user_name: req.user.username,
        tag_type: tag.tag_type,
        items_count: tag.items.length,
        total_quantity: tagObj.total_quantity,
        reason: null
      });

      res.status(201).json({ 
        message: 'Tag created successfully',
        tag: tagObj
      });

    } catch (error) {
      console.error('Create tag error:', error);
      res.status(500).json({ 
        message: 'Failed to create tag', 
        error: error.message 
      });
    }
  }
);

// PUT /api/tags/:id - Update a tag
router.put('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID'),
    body('customer_name').optional().trim().isLength({ min: 1, max: 200 }),
    body('project_name').optional().trim().isLength({ max: 200 }),
    body('notes').optional().trim().isLength({ max: 1000 }),
    body('due_date').optional().isISO8601(),
    body('status').optional().isIn(['active', 'fulfilled', 'cancelled'])
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

      const tag = await TagNew.findById(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      // Prepare update data
      const updateData = {
        last_updated_by: req.user.username
      };

      // Only update provided fields
      if (req.body.customer_name !== undefined) updateData.customer_name = req.body.customer_name;
      if (req.body.project_name !== undefined) updateData.project_name = req.body.project_name;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.due_date !== undefined) updateData.due_date = req.body.due_date;
      
      // Handle status changes with inventory implications
      if (req.body.status !== undefined && req.body.status !== tag.status) {
        updateData.status = req.body.status;
        
        if (req.body.status === 'cancelled' && tag.status === 'active') {
          // Release inventory when cancelling active tag
          await updateInventoryForTag(tag.items, tag.tag_type, 'release');
        } else if (req.body.status === 'fulfilled' && tag.status === 'active') {
          // Mark as fulfilled
          updateData.fulfilled_date = new Date();
          updateData.fulfilled_by = req.user.username;
          await updateInventoryForTag(tag.items, tag.tag_type, 'fulfill');
        }
      }

      const updatedTag = await TagNew.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate({
        path: 'items.item_id',
        populate: {
          path: 'sku_id',
          populate: { path: 'category_id' }
        }
      });

      const tagObj = updatedTag.toObject();
      tagObj.total_quantity = updatedTag.getTotalQuantity();
      tagObj.remaining_quantity = updatedTag.getTotalRemainingQuantity();

      res.json({ 
        message: 'Tag updated successfully',
        tag: tagObj
      });

    } catch (error) {
      console.error('Update tag error:', error);
      res.status(500).json({ 
        message: 'Failed to update tag', 
        error: error.message 
      });
    }
  }
);

// POST /api/tags/:id/fulfill - Partially fulfill tag items
router.post('/:id/fulfill', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID'),
    body('fulfillment_items').isArray({ min: 1 }).withMessage('Fulfillment items required'),
    body('fulfillment_items.*.item_id').isMongoId().withMessage('Invalid item ID'),
    body('fulfillment_items.*.quantity_fulfilled').isInt({ min: 1 }).withMessage('Quantity must be positive')
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

      const tag = await TagNew.findById(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      if (tag.status !== 'active') {
        return res.status(400).json({ message: 'Can only fulfill active tags' });
      }

      // Process each fulfillment
      const fulfillmentResults = [];
      for (const fulfillmentItem of req.body.fulfillment_items) {
        try {
          tag.fulfillItems(fulfillmentItem, req.user.username);
          fulfillmentResults.push({
            item_id: fulfillmentItem.item_id,
            quantity_fulfilled: fulfillmentItem.quantity_fulfilled,
            success: true
          });
        } catch (fulfillError) {
          fulfillmentResults.push({
            item_id: fulfillmentItem.item_id,
            quantity_fulfilled: fulfillmentItem.quantity_fulfilled,
            success: false,
            error: fulfillError.message
          });
        }
      }

      await tag.save();

      // Update inventory for fulfilled items
      const successfulFulfillments = fulfillmentResults.filter(r => r.success);
      if (successfulFulfillments.length > 0) {
        await updateInventoryForTag(
          successfulFulfillments.map(f => ({
            item_id: f.item_id,
            quantity: f.quantity_fulfilled
          })),
          tag.tag_type,
          'fulfill'
        );
      }

      await tag.populate({
        path: 'items.item_id',
        populate: {
          path: 'sku_id',
          populate: { path: 'category_id' }
        }
      });

      const tagObj = tag.toObject();
      tagObj.total_quantity = tag.getTotalQuantity();
      tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
      tagObj.fulfillment_results = fulfillmentResults;

      res.json({
        message: 'Tag fulfillment processed',
        tag: tagObj
      });

    } catch (error) {
      console.error('Fulfill tag error:', error);
      res.status(500).json({ 
        message: 'Failed to fulfill tag', 
        error: error.message 
      });
    }
  }
);

// POST /api/tags/:id/cancel - Cancel a tag
router.post('/:id/cancel', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID'),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
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

      const tag = await TagNew.findById(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      if (tag.status !== 'active') {
        return res.status(400).json({ message: 'Can only cancel active tags' });
      }

      // Cancel the tag
      tag.cancel(req.user.username, req.body.reason);
      await tag.save();

      // Release inventory reservations
      await updateInventoryForTag(tag.items, tag.tag_type, 'release');

      await tag.populate({
        path: 'items.item_id',
        populate: {
          path: 'sku_id',
          populate: { path: 'category_id' }
        }
      });

      const tagObj = tag.toObject();
      tagObj.total_quantity = tag.getTotalQuantity();
      tagObj.remaining_quantity = tag.getTotalRemainingQuantity();

      // Log tag cancellation
      await AuditLog.logTagEvent({
        event_type: 'tag_cancelled',
        tag_id: tag._id,
        customer_id: tag.customer_name,
        user_id: req.user.id,
        user_name: req.user.username,
        tag_type: tag.tag_type,
        items_count: tag.items.length,
        total_quantity: tagObj.total_quantity,
        reason: req.body.reason
      });

      res.json({
        message: 'Tag cancelled successfully',
        tag: tagObj
      });

    } catch (error) {
      console.error('Cancel tag error:', error);
      res.status(500).json({ 
        message: 'Failed to cancel tag', 
        error: error.message 
      });
    }
  }
);

// DELETE /api/tags/:id - Delete a tag (only if not started)
router.delete('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid tag ID')
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

      const tag = await TagNew.findById(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      // Can only delete tags that haven't been partially fulfilled
      if (tag.isPartiallyFulfilled()) {
        return res.status(400).json({ 
          message: 'Cannot delete partially fulfilled tag. Cancel it instead.' 
        });
      }

      // Release any inventory reservations
      if (tag.status === 'active') {
        await updateInventoryForTag(tag.items, tag.tag_type, 'release');
      }

      await TagNew.findByIdAndDelete(req.params.id);

      res.json({ 
        message: 'Tag deleted successfully',
        deletedTag: {
          _id: tag._id,
          customer_name: tag.customer_name,
          tag_type: tag.tag_type,
          project_name: tag.project_name
        }
      });

    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({ 
        message: 'Failed to delete tag', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
