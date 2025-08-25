const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import models
const ItemNew = require('../models/ItemNew');
const SKUNew = require('../models/SKUNew');
const Inventory = require('../models/Inventory');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

// Helper functions for legacy data transformation
function getProductDetailsCollection(productType) {
  const collectionMap = {
    'hardware': 'hardwares',
    'ic': 'ics',
    'capacitor': 'capacitors',
    'resistor': 'resistors',
    'inductor': 'inductors',
    'diode': 'diodes',
    'transistor': 'transistors',
    'fuse': 'fuses',
    'relay': 'relays',
    'switch': 'switches',
    'connector': 'connectors',
    'cable_wire': 'cable_wires',
    'tool': 'tools',
    'consumable': 'consumables',
    'pcb': 'pcbs',
    'module': 'modules'
  };
  return collectionMap[productType] || null;
}

function getSkuDisplayName(productDetails, productType) {
  if (!productDetails || Object.keys(productDetails).length === 0) {
    return `${productType} Item`;
  }
  
  // Try common name fields
  if (productDetails.name) return productDetails.name;
  if (productDetails.title) return productDetails.title;
  if (productDetails.description) return productDetails.description;
  if (productDetails.part_number) return productDetails.part_number;
  if (productDetails.model) return productDetails.model;
  
  // For specific product types, try type-specific fields
  switch (productType) {
    case 'ic':
      return productDetails.part_number || productDetails.manufacturer + ' ' + productDetails.package_type || 'IC';
    case 'capacitor':
      return `${productDetails.capacitance || '?'}F ${productDetails.voltage || '?'}V Capacitor`;
    case 'resistor':
      return `${productDetails.resistance || '?'}Ω ${productDetails.power_rating || '?'}W Resistor`;
    case 'hardware':
      return productDetails.description || productDetails.type || 'Hardware';
    default:
      return `${productType} Item`;
  }
}

function getProductTypeFromCategory(categoryName) {
  if (!categoryName) return 'unknown';
  
  // Map category names to legacy product types
  const categoryMap = {
    'Hardware': 'hardware',
    'ICs': 'ic',
    'Integrated Circuits': 'ic',
    'Capacitors': 'capacitor',
    'Resistors': 'resistor',
    'Inductors': 'inductor',
    'Diodes': 'diode',
    'Transistors': 'transistor',
    'Fuses': 'fuse',
    'Relays': 'relay',
    'Switches': 'switch',
    'Connectors': 'connector',
    'Cables': 'cable_wire',
    'Wires': 'cable_wire',
    'Tools': 'tool',
    'Consumables': 'consumable',
    'PCBs': 'pcb',
    'Modules': 'module'
  };
  
  return categoryMap[categoryName] || 'unknown';
}

function buildProductDetailsFromSku(sku) {
  if (!sku) return {};
  
  // Build product details from SKU properties
  const details = {
    name: sku.name,
    description: sku.description,
    part_number: sku.part_number,
    manufacturer: sku.manufacturer
  };
  
  // Add SKU-specific properties if they exist
  if (sku.specifications) {
    Object.assign(details, sku.specifications);
  }
  
  return details;
}

// Validation middleware for item creation/updates
const validateItem = [
  body('sku_id')
    .notEmpty()
    .withMessage('SKU ID is required')
    .isMongoId()
    .withMessage('SKU ID must be a valid MongoDB ID'),
  body('serial_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Serial number cannot exceed 100 characters'),
  body('condition')
    .optional()
    .isIn(['new', 'used', 'damaged', 'refurbished'])
    .withMessage('Condition must be new, used, damaged, or refurbished'),
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('Purchase date must be a valid date'),
  body('purchase_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be a non-negative number'),
  body('batch_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Batch number cannot exceed 100 characters'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer')
];

// GET /api/items - Get items with filtering
router.get('/', 
  auth,
  [
    query('sku_id').optional().isMongoId().withMessage('SKU ID must be a valid MongoDB ID'),
    query('condition').optional().isIn(['new', 'used', 'damaged', 'refurbished']).withMessage('Invalid condition'),
    query('location').optional().trim(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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
      
      if (req.query.sku_id) {
        filter.sku_id = req.query.sku_id;
      }
      
      if (req.query.condition) {
        filter.condition = req.query.condition;
      }
      
      if (req.query.location) {
        filter.location = { $regex: req.query.location, $options: 'i' };
      }
      
      if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        filter.$or = [
          { serial_number: searchRegex },
          { location: searchRegex },
          { notes: searchRegex },
          { batch_number: searchRegex }
        ];
      }

      // Execute queries
      const [items, totalItems] = await Promise.all([
        ItemNew.find(filter)
          .populate({
            path: 'sku_id',
            populate: {
              path: 'category_id',
              select: 'name slug'
            }
          })
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit),
        ItemNew.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch items', 
        error: error.message 
      });
    }
  }
);

// Moved /:id route to end to avoid conflicts with specific paths

// POST /api/items - Create new item instance
router.post('/', 
  auth,
  requireWriteAccess,
  validateItem,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Verify SKU exists
      const sku = await SKUNew.findById(req.body.sku_id);
      if (!sku) {
        return res.status(400).json({ message: 'SKU not found' });
      }

      // Check if serial number already exists for this SKU (if provided)
      if (req.body.serial_number) {
        const existingItem = await ItemNew.findOne({
          sku_id: req.body.sku_id,
          serial_number: req.body.serial_number
        });
        if (existingItem) {
          return res.status(400).json({ 
            message: 'An item with this serial number already exists for this SKU' 
          });
        }
      }

      const itemData = {
        sku_id: req.body.sku_id,
        serial_number: req.body.serial_number || null,
        condition: req.body.condition || 'new',
        location: req.body.location,
        notes: req.body.notes || '',
        purchase_date: req.body.purchase_date || null,
        purchase_price: req.body.purchase_price || null,
        batch_number: req.body.batch_number || null,
        quantity: req.body.quantity,
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      const item = new ItemNew(itemData);
      await item.save();

      // Update inventory quantities
      const inventory = await Inventory.findOne({ sku_id: req.body.sku_id });
      if (inventory) {
        inventory.addStock(req.body.quantity, req.body.purchase_price, req.user.username);
        await inventory.save();
      } else {
        // Create new inventory record if it doesn't exist
        const newInventory = new Inventory({
          sku_id: req.body.sku_id,
          available_quantity: req.body.quantity,
          last_updated_by: req.user.username
        });
        await newInventory.save();
      }

      // Populate SKU data before returning
      await item.populate({
        path: 'sku_id',
        populate: {
          path: 'category_id',
          select: 'name slug'
        }
      });

      // Log item creation
      await AuditLog.logEvent({
        event_type: 'create',
        entity_type: 'item',
        entity_id: item._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'Item Created',
        description: `Created new item for SKU ${sku.sku_code}`,
        changes: {
          before: {},
          after: itemData
        },
        metadata: {
          sku_code: sku.sku_code,
          quantity: req.body.quantity,
          location: req.body.location,
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'business'
      });

      res.status(201).json({ 
        message: 'Item created successfully',
        item 
      });

    } catch (error) {
      console.error('Create item error:', error);
      res.status(500).json({ 
        message: 'Failed to create item', 
        error: error.message 
      });
    }
  }
);

// PUT /api/items/:id - Update item
router.put('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid item ID'),
    ...validateItem.map(validator => validator.optional())
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

      const item = await ItemNew.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      // Store original values for audit log
      const originalItem = item.toObject();

      // Prepare update data
      const updateData = {
        last_updated_by: req.user.username
      };

      // Only update provided fields
      if (req.body.serial_number !== undefined) {
        // Check for conflicts if serial number is being changed
        if (req.body.serial_number && req.body.serial_number !== item.serial_number) {
          const existingItem = await ItemNew.findOne({
            sku_id: item.sku_id,
            serial_number: req.body.serial_number,
            _id: { $ne: req.params.id }
          });
          if (existingItem) {
            return res.status(400).json({ 
              message: 'An item with this serial number already exists for this SKU' 
            });
          }
        }
        updateData.serial_number = req.body.serial_number;
      }

      if (req.body.condition !== undefined) updateData.condition = req.body.condition;
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.purchase_date !== undefined) updateData.purchase_date = req.body.purchase_date;
      if (req.body.purchase_price !== undefined) updateData.purchase_price = req.body.purchase_price;
      if (req.body.batch_number !== undefined) updateData.batch_number = req.body.batch_number;
      
      // Handle quantity changes (update inventory)
      if (req.body.quantity !== undefined) {
        const quantityDiff = req.body.quantity - item.quantity;
        updateData.quantity = req.body.quantity;

        // Update inventory if quantity changed
        if (quantityDiff !== 0) {
          const inventory = await Inventory.findOne({ sku_id: item.sku_id });
          if (inventory) {
            if (quantityDiff > 0) {
              inventory.addStock(quantityDiff, null, req.user.username);
            } else {
              inventory.removeStock('available', Math.abs(quantityDiff), 'Item quantity adjusted', req.user.username);
            }
            await inventory.save();
          }
        }
      }

      const updatedItem = await ItemNew.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate({
        path: 'sku_id',
        populate: {
          path: 'category_id',
          select: 'name slug'
        }
      });

      // Log item update
      await AuditLog.logEvent({
        event_type: 'update',
        entity_type: 'item',
        entity_id: updatedItem._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'Item Updated',
        description: `Updated item for SKU ${updatedItem.sku_id.sku_code}`,
        changes: {
          before: originalItem,
          after: updateData
        },
        metadata: {
          sku_code: updatedItem.sku_id.sku_code,
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'business'
      });

      res.json({ 
        message: 'Item updated successfully',
        item: updatedItem 
      });

    } catch (error) {
      console.error('Update item error:', error);
      res.status(500).json({ 
        message: 'Failed to update item', 
        error: error.message 
      });
    }
  }
);

// DELETE /api/items/:id - Delete item
router.delete('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid item ID')
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

      const item = await ItemNew.findById(req.params.id).populate('sku_id');
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      // Update inventory (remove quantity)
      const inventory = await Inventory.findOne({ sku_id: item.sku_id._id });
      if (inventory) {
        inventory.removeStock('available', item.quantity, 'Item deleted', req.user.username);
        await inventory.save();
      }

      await ItemNew.findByIdAndDelete(req.params.id);

      // Log item deletion
      await AuditLog.logEvent({
        event_type: 'delete',
        entity_type: 'item',
        entity_id: item._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'Item Deleted',
        description: `Deleted item for SKU ${item.sku_id.sku_code}`,
        changes: {
          before: item.toObject(),
          after: {}
        },
        metadata: {
          sku_code: item.sku_id.sku_code,
          quantity: item.quantity,
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'business'
      });

      res.json({ 
        message: 'Item deleted successfully',
        deletedItem: {
          _id: item._id,
          sku_id: item.sku_id._id,
          sku_code: item.sku_id.sku_code,
          quantity: item.quantity
        }
      });

    } catch (error) {
      console.error('Delete item error:', error);
      res.status(500).json({ 
        message: 'Failed to delete item', 
        error: error.message 
      });
    }
  }
);

// POST /api/items/:id/use - Use items (track usage)
router.post('/:id/use', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid item ID'),
    body('quantity_used').isInt({ min: 1 }).withMessage('Quantity used must be a positive integer'),
    body('used_for').notEmpty().withMessage('Used for description is required').trim(),
    body('location').optional().trim(),
    body('project_name').optional().trim(),
    body('customer_name').optional().trim(),
    body('notes').optional().trim()
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

      const item = await ItemNew.findById(req.params.id).populate('sku_id');
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      // Use the items
      const usageData = {
        quantity_used: req.body.quantity_used,
        used_for: req.body.used_for,
        location: req.body.location || '',
        project_name: req.body.project_name || '',
        customer_name: req.body.customer_name || '',
        notes: req.body.notes || '',
        used_by: req.user.username
      };

      item.useItems(usageData);
      await item.save();

      // Update inventory (reduce available quantity)
      const inventory = await Inventory.findOne({ sku_id: item.sku_id._id });
      if (inventory) {
        inventory.removeStock('available', req.body.quantity_used, `Used: ${req.body.used_for}`, req.user.username);
        await inventory.save();
      }

      // Log usage
      await AuditLog.logEvent({
        event_type: 'update',
        entity_type: 'item',
        entity_id: item._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'Items Used',
        description: `Used ${req.body.quantity_used} items for ${req.body.used_for}`,
        changes: {
          before: { quantity: item.quantity + req.body.quantity_used },
          after: { quantity: item.quantity }
        },
        metadata: {
          sku_code: item.sku_id.sku_code,
          quantity_used: req.body.quantity_used,
          used_for: req.body.used_for,
          project_name: req.body.project_name,
          customer_name: req.body.customer_name,
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'business'
      });

      res.json({ 
        message: 'Items used successfully',
        item,
        usage: usageData
      });

    } catch (error) {
      console.error('Use items error:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to use items'
      });
    }
  }
);

// GET /api/items/sku/:skuCode - Find items by SKU code (for scanning workflow)
router.get('/sku/:skuCode', 
  auth,
  [
    param('skuCode').notEmpty().withMessage('SKU code is required'),
    query('condition').optional().isIn(['new', 'used', 'damaged', 'refurbished']).withMessage('Invalid condition'),
    query('location').optional().trim(),
    query('available_only').optional().isBoolean().withMessage('available_only must be a boolean')
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

      // First find the SKU
      const sku = await SKUNew.findOne({ sku_code: req.params.skuCode });
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Build filter for items
      const filter = { sku_id: sku._id };
      
      if (req.query.condition) {
        filter.condition = req.query.condition;
      }
      
      if (req.query.location) {
        filter.location = { $regex: req.query.location, $options: 'i' };
      }
      
      if (req.query.available_only === 'true') {
        filter.quantity = { $gt: 0 };
      }

      const items = await ItemNew.find(filter)
        .populate({
          path: 'sku_id',
          populate: {
            path: 'category_id',
            select: 'name slug'
          }
        })
        .sort({ created_at: -1 });

      res.json({ 
        sku,
        items,
        total_items: items.length,
        total_quantity: items.reduce((sum, item) => sum + item.quantity, 0)
      });

    } catch (error) {
      console.error('Find items by SKU error:', error);
      res.status(500).json({ 
        message: 'Failed to find items by SKU', 
        error: error.message 
      });
    }
  }
);

// POST /api/items/receive - Create multiple items from SKU scan (receiving workflow)
router.post('/receive', 
  auth,
  requireWriteAccess,
  [
    body('sku_code').notEmpty().withMessage('SKU code is required').trim(),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('location').optional().trim(),
    body('condition').optional().isIn(['new', 'used', 'damaged', 'refurbished']).withMessage('Invalid condition'),
    body('purchase_price').optional().isFloat({ min: 0 }).withMessage('Purchase price must be non-negative'),
    body('batch_number').optional().trim(),
    body('notes').optional().trim()
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

      // Find the SKU
      const sku = await SKUNew.findOne({ sku_code: req.body.sku_code });
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      const createdItems = [];

      // Create items based on quantity
      for (let i = 0; i < req.body.quantity; i++) {
        const itemData = {
          sku_id: sku._id,
          condition: req.body.condition || 'new',
          location: req.body.location || 'Main Warehouse',
          purchase_price: req.body.purchase_price || null,
          batch_number: req.body.batch_number || null,
          notes: req.body.notes || '',
          quantity: 1, // Each individual item has quantity 1
          created_by: req.user.username,
          last_updated_by: req.user.username
        };

        const item = new ItemNew(itemData);
        await item.save();
        createdItems.push(item);
      }

      // Update inventory
      const inventory = await Inventory.findOne({ sku_id: sku._id });
      if (inventory) {
        inventory.addStock(req.body.quantity, req.body.purchase_price, req.user.username);
        await inventory.save();
      } else {
        // Create new inventory record
        const newInventory = new Inventory({
          sku_id: sku._id,
          available_quantity: req.body.quantity,
          average_cost: req.body.purchase_price || 0,
          last_updated_by: req.user.username
        });
        await newInventory.save();
      }

      // Log receipt
      await AuditLog.logEvent({
        event_type: 'create',
        entity_type: 'items',
        entity_id: sku._id,
        user_id: req.user.id,
        user_name: req.user.username,
        action: 'Items Received',
        description: `Received ${req.body.quantity} items for SKU ${req.body.sku_code}`,
        changes: {
          before: {},
          after: {
            sku_code: req.body.sku_code,
            quantity: req.body.quantity,
            location: req.body.location,
            purchase_price: req.body.purchase_price
          }
        },
        metadata: {
          sku_code: req.body.sku_code,
          quantity_received: req.body.quantity,
          items_created: createdItems.length,
          batch_number: req.body.batch_number,
          ip_address: req.ip || req.connection?.remoteAddress
        },
        category: 'business'
      });

      res.status(201).json({ 
        message: `Successfully received ${req.body.quantity} items`,
        sku,
        items: createdItems,
        summary: {
          sku_code: req.body.sku_code,
          quantity_received: req.body.quantity,
          items_created: createdItems.length,
          location: req.body.location || 'Main Warehouse'
        }
      });

    } catch (error) {
      console.error('Receive items error:', error);
      res.status(500).json({ 
        message: 'Failed to receive items', 
        error: error.message 
      });
    }
  }
);

// GET /api/items/scan/:identifier - Scan item for tagging/fulfillment
router.get('/scan/:identifier', 
  auth,
  [
    param('identifier').notEmpty().withMessage('Identifier is required')
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

      const identifier = req.params.identifier;
      let item = null;

      // Try to find by item ID first
      if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        item = await ItemNew.findById(identifier)
          .populate({
            path: 'sku_id',
            populate: {
              path: 'category_id',
              select: 'name slug'
            }
          });
      }

      // If not found, try to find by serial number
      if (!item) {
        item = await ItemNew.findOne({ serial_number: identifier })
          .populate({
            path: 'sku_id',
            populate: {
              path: 'category_id',
              select: 'name slug'
            }
          });
      }

      // If still not found, try to find by SKU code
      if (!item) {
        const sku = await SKUNew.findOne({ 
          $or: [
            { sku_code: identifier },
            { barcode: identifier }
          ]
        });
        
        if (sku) {
          // Return available items for this SKU
          const items = await ItemNew.find({ 
            sku_id: sku._id, 
            quantity: { $gt: 0 } 
          })
          .populate({
            path: 'sku_id',
            populate: {
              path: 'category_id',
              select: 'name slug'
            }
          })
          .sort({ created_at: -1 })
          .limit(10);

          return res.json({
            type: 'sku_match',
            sku,
            items,
            total_available: items.reduce((sum, item) => sum + item.quantity, 0)
          });
        }
      }

      if (!item) {
        return res.status(404).json({ message: 'No item found with this identifier' });
      }

      res.json({
        type: 'item_match',
        item,
        sku: item.sku_id
      });

    } catch (error) {
      console.error('Scan item error:', error);
      res.status(500).json({ 
        message: 'Failed to scan item', 
        error: error.message 
      });
    }
  }
);

// GET /api/items/available - Get items available for tagging (uses Inventory collection like dashboard)
router.get('/available', 
  auth,
  [
    query('sku_id').optional().isMongoId().withMessage('SKU ID must be a valid MongoDB ID'),
    query('location').optional().trim(),
    query('min_quantity').optional().isInt({ min: 0 }).withMessage('Min quantity must be a non-negative integer'),
    query('exclude_tagged').optional().custom((value) => {
      return value === 'true' || value === 'false' || typeof value === 'boolean';
    }).withMessage('exclude_tagged must be a boolean or boolean string')
  ],
  async (req, res) => {
    try {
      // Debug logging
      console.log('=== GET /api/items/available ===');
      console.log('Query params:', req.query);
      console.log('Raw query string:', req.url.split('?')[1] || 'none');
      console.log('User:', req.user ? req.user.username : 'none');
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Build filter for available inventory items (same as dashboard)
      const minQuantity = req.query.min_quantity ? parseInt(req.query.min_quantity) : 0;
      const filter = {
        is_active: true,
        available_quantity: { $gt: minQuantity }
      };

      // Build aggregation pipeline (similar to inventory route)
      let pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'skunews',
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

      // Apply SKU filter if specified
      if (req.query.sku_id) {
        pipeline.unshift({
          $match: { sku_id: require('mongoose').Types.ObjectId(req.query.sku_id) }
        });
      }

      // Apply location filter if specified (search in primary_location)
      if (req.query.location) {
        pipeline.push({
          $match: {
            primary_location: { $regex: req.query.location, $options: 'i' }
          }
        });
      }

      // TODO: Add exclude_tagged filtering when tagging functionality is implemented
      // This would filter out SKUs that already have active tags

      // Add computed fields and sort
      pipeline.push(
        {
          $addFields: {
            total_available: '$available_quantity'
          }
        },
        { $sort: { 'sku.sku_code': 1 } }
      );

      console.log('Using Inventory collection with pipeline:', JSON.stringify(pipeline, null, 2));
      
      // Execute the aggregation
      const inventoryItems = await Inventory.aggregate(pipeline);
      
      console.log('Found inventory items:', inventoryItems.length);
      if (inventoryItems.length > 0) {
        console.log('Sample inventory item:', JSON.stringify(inventoryItems[0], null, 2));
      }
      
      // If new architecture has no data, fall back to legacy data for now
      if (inventoryItems.length === 0) {
        console.log('No new architecture data found, falling back to legacy data transformation');
        
        // Get legacy data and transform it to match frontend expectations
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        
        const legacyItems = await db.collection('items').find({ 
          quantity: { $gt: minQuantity } 
        }).toArray();
        
        // Transform legacy items to match frontend structure
        const transformedItems = [];
        
        for (const legacyItem of legacyItems) {
          try {
            // Get SKU info
            const legacySku = await db.collection('skus').findOne({ _id: legacyItem.sku_id });
            if (!legacySku) continue;
            
            // Get product details
            let productDetails = {};
            if (legacySku.product_details && legacySku.product_type) {
              const detailsCollection = getProductDetailsCollection(legacySku.product_type);
              if (detailsCollection) {
                const details = await db.collection(detailsCollection).findOne({ _id: legacySku.product_details });
                if (details) productDetails = details;
              }
            }
            
            // Transform to frontend-compatible structure
            const transformedItem = {
              _id: legacyItem._id,
              quantity: legacyItem.quantity || 0,
              availableQuantity: legacyItem.quantity || 0,
              location: legacyItem.location || '',
              product_type: legacySku.product_type || 'unknown',
              product_details: productDetails,
              sku_id: {
                _id: legacySku._id,
                sku_code: legacySku.sku_code,
                name: getSkuDisplayName(productDetails, legacySku.product_type)
              },
              condition: 'new',
              notes: legacyItem.notes || '',
              created_at: legacyItem.createdAt,
              updated_at: legacyItem.updatedAt
            };
            
            transformedItems.push(transformedItem);
            
          } catch (error) {
            console.error('Error transforming legacy item:', error);
          }
        }
        
        console.log(`Transformed ${transformedItems.length} legacy items`);
        
        return res.json({
          items: transformedItems,
          total_items: transformedItems.length,
          total_quantity: transformedItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
        });
      }
      
      // Transform new architecture data to match frontend expectations 
      const transformedItems = inventoryItems.map(item => ({
        _id: item._id,
        quantity: item.available_quantity || 0,
        availableQuantity: item.available_quantity || 0,
        location: item.primary_location || '',
        product_type: getProductTypeFromCategory(item.category?.name),
        product_details: buildProductDetailsFromSku(item.sku),
        sku_id: {
          _id: item.sku._id,
          sku_code: item.sku.sku_code,
          name: item.sku.name
        },
        condition: 'new',
        notes: '',
        created_at: item.createdAt,
        updated_at: item.updatedAt
      }));

      res.json({
        items: transformedItems,
        total_items: transformedItems.length,
        total_quantity: transformedItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
      });

    } catch (error) {
      console.error('Get available items error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch available items', 
        error: error.message 
      });
    }
  }
);

// GET /api/items/:id - Get single item (placed at end to avoid conflicts with specific paths)
router.get('/:id', 
  auth,
  [
    param('id').isMongoId().withMessage('Invalid item ID')
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

      const item = await ItemNew.findById(req.params.id)
        .populate({
          path: 'sku_id',
          populate: {
            path: 'category_id',
            select: 'name slug'
          }
        });

      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.json({ item });

    } catch (error) {
      console.error('Get item error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch item', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
