const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import models
const Tag = require('../models/Tag');
const SKU = require('../models/SKU');
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
  // SKU items only - no legacy support
  body('sku_items')
    .isArray({ min: 1 })
    .withMessage('SKU items array is required and must contain at least one item'),
  body('sku_items.*.sku_id')
    .notEmpty()
    .withMessage('SKU ID is required')
    .isMongoId()
    .withMessage('SKU ID must be a valid MongoDB ID'),
  body('sku_items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('SKU quantity must be a positive integer'),
  body('sku_items.*.notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('SKU item notes cannot exceed 500 characters'),
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
// Helper function to check SKU availability and validate quantities
async function checkSKUAvailability(skuItems) {
  const availability = [];
  
  for (const tagItem of skuItems) {
    try {
      // Get SKU and inventory information
      const sku = await SKU.findById(tagItem.sku_id)
        .populate('category_id');
      
      if (!sku) {
        availability.push({
          sku_id: tagItem.sku_id,
          error: 'SKU not found',
          can_fulfill: false
        });
        continue;
      }
      
      const inventory = await Inventory.findOne({ sku_id: tagItem.sku_id });
      
      if (!inventory) {
        availability.push({
          sku_id: tagItem.sku_id,
          error: 'Inventory record not found',
          can_fulfill: false
        });
        continue;
      }
      
      // Check if enough quantity is available in inventory
      const availableQuantity = inventory.available_quantity || 0;
      const canFulfill = tagItem.quantity <= availableQuantity;
      
      availability.push({
        sku_id: tagItem.sku_id,
        sku_details: sku,
        inventory_details: inventory,
        requested_quantity: tagItem.quantity,
        available_quantity: availableQuantity,
        can_fulfill: canFulfill,
        shortage: canFulfill ? 0 : tagItem.quantity - availableQuantity
      });
      
    } catch (error) {
      availability.push({
        sku_id: tagItem.sku_id,
        error: error.message,
        can_fulfill: false
      });
    }
  }
  
  return availability;
}

// Helper function to update inventory when tag is created/modified
async function updateInventoryForTag(skuItems, tagType, operation = 'reserve') {
  const updates = [];
  
  for (const tagItem of skuItems) {
    try {
      const inventory = await Inventory.findOne({ sku_id: tagItem.sku_id });
      
      if (!inventory) {
        updates.push({
          sku_id: tagItem.sku_id,
          success: false,
          error: 'Inventory record not found'
        });
        continue;
      }
      
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
          sku_id: tagItem.sku_id,
          operation,
          quantity: tagItem.quantity,
          success: true
        });
      }
      
    } catch (error) {
      updates.push({
        sku_id: tagItem.sku_id,
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
      const tagStats = await Tag.aggregate([
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
      const tagsByType = await Tag.aggregate([
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
      const overdueCount = await Tag.countDocuments({
        status: 'active',
        due_date: { $lt: new Date() }
      });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivity = await Tag.aggregate([
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
      const overdueTags = await Tag.getOverdueTags();
      
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

      const tags = await Tag.getTagsByCustomer(req.params.customerName);
      
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
      console.log('=== GET /api/tags called ===')
      console.log('Query params:', req.query)
      console.log('User:', req.user?.username)
      
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

      // Build query filter
      const filter = {};
      
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

      console.log('Tag query filter:', JSON.stringify(filter, null, 2));

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
      
      console.log(`Found ${tags.length} tags out of ${totalTags} total`);

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

      let query = Tag.findById(req.params.id);

      // Always populate SKU details for meaningful display
      query = query.populate({
        path: 'sku_items.sku_id',
        populate: { path: 'category_id' }
      });

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

      // Enhance sku_items with additional inventory information for better display
      if (tagObj.sku_items && tagObj.sku_items.length > 0) {
        for (let i = 0; i < tagObj.sku_items.length; i++) {
          const skuItem = tagObj.sku_items[i];
          if (skuItem.sku_id) {
            // Get current inventory status for this SKU
            const inventory = await Inventory.findOne({ sku_id: skuItem.sku_id._id });
            if (inventory) {
              tagObj.sku_items[i].inventory_info = {
                available_quantity: inventory.available_quantity,
                reserved_quantity: inventory.reserved_quantity,
                total_quantity: inventory.total_quantity,
                location: inventory.primary_location
              };
            }
            
            // Add display-friendly fields
            tagObj.sku_items[i].display_name = `${skuItem.sku_id.name} (${skuItem.sku_id.sku_code})`;
            tagObj.sku_items[i].brand = skuItem.sku_id.brand;
            tagObj.sku_items[i].category_name = skuItem.sku_id.category_id?.name || 'Unknown';
          }
        }
      }

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

      // Validation: ensure sku_items is provided
      if (!req.body.sku_items) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: [{ msg: 'sku_items is required', path: 'sku_items' }] 
        });
      }
      
      const skuItemsToProcess = req.body.sku_items;
      console.log('SKU items to process:', skuItemsToProcess)

      console.log('=== VALIDATION PASSED, CHECKING AVAILABILITY ===')
      
      // Check SKU availability before creating tag
      console.log('Checking availability for SKU items:', skuItemsToProcess)
      const availability = await checkSKUAvailability(skuItemsToProcess);
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

      // Create tag data directly from SKU items
      const processedItems = skuItemsToProcess.map(item => ({
        sku_id: item.sku_id,
        quantity: item.quantity,
        notes: item.notes || ''
      }));
      
      const tagData = {
        customer_name: req.body.customer_name,
        tag_type: req.body.tag_type,
        project_name: req.body.project_name || '',
        sku_items: processedItems,
        notes: req.body.notes || '',
        due_date: req.body.due_date || null,
        status: 'active',
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      // Create the tag
      const tag = new Tag(tagData);
      await tag.save();

      // Assign available Instances to this tag (NEW: Instance model integration)
      try {
        await tag.assignInstances();
        await tag.save(); // Save the tag again to persist instance assignments
      } catch (assignError) {
        // If instance assignment fails, we should clean up the tag
        await Tag.findByIdAndDelete(tag._id);
        return res.status(400).json({
          message: 'Failed to assign instances to tag',
          error: assignError.message,
          suggestion: 'Check if enough instances are available for the requested quantities'
        });
      }

      // Update inventory to reflect the reservation/allocation
      const inventoryUpdates = await updateInventoryForTag(
        processedItems, 
        req.body.tag_type, 
        'reserve'
      );

      // Check if any inventory updates failed
      const failedUpdates = inventoryUpdates.filter(update => !update.success);
      if (failedUpdates.length > 0) {
        console.warn('Some inventory updates failed:', failedUpdates);
      }

      // Manually enrich item details for response (since we may have inventory IDs stored)
      const tagObj = tag.toObject();
      tagObj.total_quantity = tag.getTotalQuantity();
      tagObj.remaining_quantity = tag.getTotalRemainingQuantity();
      tagObj.inventory_updates = inventoryUpdates;
      
      // Enrich sku_items with details from availability check results
      if (availability && availability.length > 0) {
        tagObj.sku_items = tagObj.sku_items.map(tagItem => {
          // Find availability info by matching the SKU ID
          const availabilityInfo = availability.find(a => 
            a.sku_id.toString() === tagItem.sku_id.toString()
          );
          
          if (availabilityInfo) {
            return {
              ...tagItem,
              sku_details: availabilityInfo.sku_details,
              inventory_details: availabilityInfo.inventory_details
            };
          }
          return tagItem;
        });
      }

      // Log tag creation
      await AuditLog.logTagEvent({
        event_type: 'tag_created',
        tag_id: tag._id,
        customer_id: tag.customer_name,
        user_id: req.user.id,
        user_name: req.user.username,
        tag_type: tag.tag_type,
        items_count: tag.sku_items.length,
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

      const tag = await Tag.findById(req.params.id);
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
          await updateInventoryForTag(tag.sku_items, tag.tag_type, 'release');
        } else if (req.body.status === 'fulfilled' && tag.status === 'active') {
          // NEW: Use fulfillItems() method to delete Instances and mark as fulfilled
          await tag.fulfillItems();
          updateData.fulfilled_date = new Date();
          updateData.fulfilled_by = req.user.username;
          await updateInventoryForTag(tag.sku_items, tag.tag_type, 'fulfill');
        }
      }

      const updatedTag = await Tag.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate({
        path: 'sku_items.sku_id',
        populate: { path: 'category_id' }
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

      const tag = await Tag.findById(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }

      if (tag.status !== 'active') {
        return res.status(400).json({ message: 'Can only fulfill active tags' });
      }

      // NEW: Use the updated fulfillItems() method that deletes Instances
      const fulfillmentResults = [];
      try {
        // Call the new fulfillItems() method (no parameters - fulfills all items)
        await tag.fulfillItems();
        
        // Mark all requested items as successfully fulfilled
        for (const fulfillmentItem of req.body.fulfillment_items) {
          fulfillmentResults.push({
            item_id: fulfillmentItem.item_id,
            quantity_fulfilled: fulfillmentItem.quantity_fulfilled,
            success: true,
            note: 'Instances deleted from database'
          });
        }
      } catch (fulfillError) {
        // If fulfillment fails, mark all items as failed
        for (const fulfillmentItem of req.body.fulfillment_items) {
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
        // Use the original tag's sku_items structure for inventory updates
        await updateInventoryForTag(
          tag.sku_items,
          tag.tag_type,
          'fulfill'
        );
      }

      await tag.populate({
        path: 'sku_items.sku_id',
        populate: { path: 'category_id' }
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

      const tag = await Tag.findById(req.params.id);
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
      await updateInventoryForTag(tag.sku_items, tag.tag_type, 'release');

      await tag.populate({
        path: 'sku_items.sku_id',
        populate: { path: 'category_id' }
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
        items_count: tag.sku_items.length,
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

      const tag = await Tag.findById(req.params.id);
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
        await updateInventoryForTag(tag.sku_items, tag.tag_type, 'release');
      }

      await Tag.findByIdAndDelete(req.params.id);

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
