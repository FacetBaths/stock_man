const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import models
const SKU = require('../models/SKU');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const { auth, requireRole, requireWriteAccess } = require('../middleware/authEnhanced');
const AuditLog = require('../models/AuditLog');

// Validation middleware for SKU creation/updates
const validateSKU = [
  body('sku_code')
    .optional()
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9\-_]+$/)
    .withMessage('SKU code can only contain letters, numbers, hyphens, and underscores'),
  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Product name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('category_id')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Category ID must be a valid MongoDB ID'),
  body('unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit cost must be a non-negative number'),
  body('unit_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a non-negative number'),
  body('manufacturer_model')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Manufacturer model cannot exceed 100 characters'),
  body('barcode')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Barcode cannot exceed 50 characters'),
  body('weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weight must be a non-negative number'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('is_lendable')
    .optional()
    .isBoolean()
    .withMessage('is_lendable must be a boolean'),
  body('is_bundle')
    .optional()
    .isBoolean()
    .withMessage('is_bundle must be a boolean'),
  body('bundle_items')
    .optional()
    .isArray()
    .withMessage('bundle_items must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags must be an array'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];
// Helper function to generate SKU code based on category and manufacturer model
async function generateSKUCode(categoryId, manufacturerModel = null) {
  try {
    // If manufacturer model is provided, use it as SKU code (cleaned up with FR- prefix)
    if (manufacturerModel && manufacturerModel.trim()) {
      const cleanedModel = manufacturerModel
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\-_]/g, '') // Remove invalid characters
        .substring(0, 17); // Limit length to allow for "FR-" prefix
      
      if (cleanedModel) {
        // Add FR- prefix to model number
        const skuWithPrefix = `FR-${cleanedModel}`;
        
        // Check if this SKU already exists
        const existingSku = await SKU.findOne({ sku_code: skuWithPrefix });
        if (!existingSku) {
          return skuWithPrefix;
        }
        // If it exists, fall back to category-based generation
      }
    }

    // Fall back to category-based generation
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    const year = new Date().getFullYear().toString().slice(-2);
    // Create prefix from category name since Category model doesn't have slug field
    const categoryPrefix = category.name
      .replace(/[^a-z0-9]/gi, '') // Remove non-alphanumeric characters
      .substring(0, 3)
      .toUpperCase();
    
    // Ensure we have at least 3 characters for the prefix
    const finalPrefix = categoryPrefix.padEnd(3, 'X');
    
    // Find the next sequence number for this category and year
    const existingSkus = await SKU.find({
      sku_code: new RegExp(`^${finalPrefix}-${year}-\\d+$`)
    }).sort({ sku_code: -1 }).limit(1);
    
    let nextNumber = 1;
    if (existingSkus.length > 0) {
      const lastSku = existingSkus[0].sku_code;
      const lastNumber = parseInt(lastSku.split('-').pop());
      nextNumber = lastNumber + 1;
    }
    
    return `${finalPrefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    throw new Error(`Failed to generate SKU code: ${error.message}`);
  }
}
// GET /api/skus - Get all SKUs with filtering and pagination
router.get('/', 
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

      // ✅ FILTER: Get tool categories to exclude
      const toolCategories = await Category.find({ type: 'tool' }).select('_id');
      const toolCategoryIds = toolCategories.map(cat => cat._id.toString());
      
      // Build filter
      const filter = {};
      
      // ✅ FILTER: Exclude tool categories from product SKU view
      if (toolCategoryIds.length > 0) {
        filter.category_id = { $nin: toolCategoryIds };
      }
      
      if (req.query.category_id) {
        // If specific category requested, ensure it's not a tool category
        if (toolCategoryIds.includes(req.query.category_id)) {
          // Return empty results if requesting a tool category
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
        // Override the $nin with specific category if it's not a tool
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
      console.error('Get SKUs error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch SKUs', 
        error: error.message 
      });
    }
  }
);

// GET /api/skus/:id - Get a single SKU by ID
router.get('/:id', 
  auth,
  [
    param('id').isMongoId().withMessage('Invalid SKU ID'),
    query('include_inventory').optional().isBoolean().withMessage('include_inventory must be a boolean'),
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

      let query = SKU.findById(req.params.id)
        .populate('category_id');

      // Add bundle items population if it's a bundle
      query = query.populate({
        path: 'bundle_items.sku_id',
        select: 'sku_code name unit_cost'
      });

      const sku = await query;

      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }
      
      // ✅ FILTER: Block access to tool SKUs in product view
      if (sku.category_id && sku.category_id.type === 'tool') {
        return res.status(404).json({ message: 'SKU not found' });
      }

      const skuObj = sku.toObject();

      // Include inventory data if requested
      if (req.query.include_inventory === 'true') {
        const inventory = await Inventory.findOne({ sku_id: sku._id });
        if (inventory) {
          skuObj.inventory = inventory.getSummary();
        }
      }

      // Items are no longer tracked - SKUs work directly with inventory
      // This parameter is kept for API compatibility but returns empty array
      if (req.query.include_items === 'true') {
        skuObj.items = [];
      }

      res.json({ sku: skuObj });

    } catch (error) {
      console.error('Get SKU error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch SKU', 
        error: error.message 
      });
    }
  }
);

// POST /api/skus - Create a new SKU
router.post('/', 
  auth,
  requireWriteAccess,
  validateSKU,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Verify category exists
      const category = await Category.findById(req.body.category_id);
      if (!category) {
        return res.status(400).json({ message: 'Category not found' });
      }

      // Generate SKU code if not provided
      let skuCode = req.body.sku_code;
      if (!skuCode) {
        // Use model field for SKU generation (with FR- prefix) if available
        const modelForSku = req.body.model || req.body.manufacturer_model;
        skuCode = await generateSKUCode(req.body.category_id, modelForSku);
      } else {
        // Check if SKU code already exists
        const existingSKU = await SKU.findOne({ sku_code: skuCode });
        if (existingSKU) {
          return res.status(400).json({ 
            message: 'SKU code already exists' 
          });
        }
      }

      const skuData = {
        sku_code: skuCode,
        name: req.body.name,
        description: req.body.description || '',
        category_id: req.body.category_id,
        unit_cost: req.body.unit_cost || 0,
        unit_price: req.body.unit_price || req.body.unit_cost || 0,
        manufacturer_model: req.body.manufacturer_model || '',
        barcode: req.body.barcode || '',
        weight: req.body.weight || 0,
        dimensions: {
          length: req.body.dimensions?.length || 0,
          width: req.body.dimensions?.width || 0,
          height: req.body.dimensions?.height || 0,
          unit: req.body.dimensions?.unit || 'inches'
        },
        is_active: req.body.is_active !== false, // Default to true
        is_lendable: req.body.is_lendable || false,
        is_bundle: req.body.is_bundle || false,
        bundle_items: req.body.bundle_items || [],
        tags: req.body.tags || [],
        notes: req.body.notes || '',
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      // Validate bundle items if this is a bundle
      if (skuData.is_bundle && skuData.bundle_items.length > 0) {
        for (const bundleItem of skuData.bundle_items) {
          const bundleSku = await SKU.findById(bundleItem.sku_id);
          if (!bundleSku) {
            return res.status(400).json({ 
              message: `Bundle item SKU ${bundleItem.sku_id} not found` 
            });
          }
          if (bundleSku.is_bundle) {
            return res.status(400).json({ 
              message: 'Cannot create bundle containing other bundles' 
            });
          }
        }
      }

      const sku = new SKU(skuData);
      await sku.save();

      // Create initial inventory record
      const inventory = new Inventory({
        sku_id: sku._id,
        last_updated_by: req.user.username
      });
      await inventory.save();

      // Populate category before returning
      await sku.populate('category_id');

      res.status(201).json({ 
        message: 'SKU created successfully',
        sku: {
          ...sku.toObject(),
          inventory: inventory.getSummary()
        }
      });

    } catch (error) {
      console.error('Create SKU error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({ 
          message: `SKU with this ${field} already exists` 
        });
      }

      res.status(500).json({ 
        message: 'Failed to create SKU', 
        error: error.message 
      });
    }
  }
);

// PUT /api/skus/:id - Update a SKU
router.put('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid SKU ID'),
    ...validateSKU
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

      console.log('Update SKU request body:', req.body);
      console.log('Update SKU request body keys:', Object.keys(req.body));
      
      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }
      
      console.log('Current SKU details object:', sku.details);

      // Prepare update data
      const updateData = {
        last_updated_by: req.user.username
      };

      // Only update provided fields
      if (req.body.sku_code !== undefined) {
        // Check if new SKU code conflicts
        const existingSKU = await SKU.findOne({
          sku_code: req.body.sku_code, 
          _id: { $ne: req.params.id } 
        });
        if (existingSKU) {
          return res.status(400).json({ 
            message: 'SKU code already exists' 
          });
        }
        updateData.sku_code = req.body.sku_code;
      }

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.brand !== undefined) updateData.brand = req.body.brand;
      if (req.body.model !== undefined) updateData.model = req.body.model;
      
      if (req.body.category_id !== undefined) {
        // Verify new category exists
        const category = await Category.findById(req.body.category_id);
        if (!category) {
          return res.status(400).json({ message: 'Category not found' });
        }
        updateData.category_id = req.body.category_id;
      }

      if (req.body.unit_cost !== undefined) updateData.unit_cost = req.body.unit_cost;
      if (req.body.barcode !== undefined) updateData.barcode = req.body.barcode;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      
      // Handle stock_thresholds updates
      if (req.body.stock_thresholds !== undefined) {
        updateData.stock_thresholds = req.body.stock_thresholds;
      }
      
      // Handle supplier_info updates
      if (req.body.supplier_info !== undefined) {
        // Merge supplier_info with existing data
        const currentSupplierInfo = sku.supplier_info ? sku.supplier_info.toObject() : {};
        updateData.supplier_info = {
          ...currentSupplierInfo,
          ...req.body.supplier_info
        };
        console.log('Updated supplier_info:', updateData.supplier_info);
      }

      // Handle details object updates (category-specific fields)
      if (req.body.details !== undefined) {
        // Frontend is sending a full details object - merge it properly
        console.log('Received details object from frontend:', req.body.details);
        
        // Initialize details object if it doesn't exist
        const currentDetails = sku.details ? sku.details.toObject() : {};
        
        // Merge the incoming details with existing details
        updateData.details = {
          ...currentDetails,
          ...req.body.details
        };
        
        console.log('Merged details object:', updateData.details);
      } else {
        // Legacy handling for individual detail fields
        if (req.body.dimensions !== undefined || 
            req.body.finish !== undefined || 
            req.body.color !== undefined) {
          // Initialize details object if it doesn't exist
          if (!updateData.details) {
            updateData.details = sku.details ? { ...sku.details.toObject() } : {};
          }
          
          if (req.body.dimensions !== undefined) updateData.details.dimensions = req.body.dimensions;
          if (req.body.finish !== undefined) updateData.details.finish = req.body.finish;
          if (req.body.color !== undefined) updateData.details.color_name = req.body.color;
        }
      }
      
      console.log('Final updateData before database call:', JSON.stringify(updateData, null, 2));

      const updatedSKU = await SKU.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('category_id');

      res.json({ 
        message: 'SKU updated successfully',
        sku: updatedSKU 
      });

    } catch (error) {
      console.error('Update SKU error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({ 
          message: `SKU with this ${field} already exists` 
        });
      }

      res.status(500).json({ 
        message: 'Failed to update SKU', 
        error: error.message 
      });
    }
  }
);

// DELETE /api/skus/:id - Delete a SKU
router.delete('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid SKU ID')
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

      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Check if SKU can be safely deleted
      const canDelete = await sku.canBeDeleted();
      if (!canDelete.allowed) {
        return res.status(400).json({ 
          message: 'Cannot delete SKU', 
          reason: canDelete.reason,
          details: canDelete.details
        });
      }

      // Delete associated inventory record
      await Inventory.findOneAndDelete({ sku_id: req.params.id });

      // Delete the SKU
      await SKU.findByIdAndDelete(req.params.id);

      res.json({ 
        message: 'SKU deleted successfully',
        deletedSKU: {
          _id: sku._id,
          sku_code: sku.sku_code,
          name: sku.name
        }
      });

    } catch (error) {
      console.error('Delete SKU error:', error);
      res.status(500).json({ 
        message: 'Failed to delete SKU', 
        error: error.message 
      });
    }
  }
);

// GET /api/skus/lookup/:skuCode - Lookup SKU by code (for scanning)
router.get('/lookup/:skuCode', 
  auth,
  [
    param('skuCode').notEmpty().withMessage('SKU code is required')
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

      const sku = await SKU.findOne({
        sku_code: req.params.skuCode.toUpperCase(),
        is_active: true
      }).populate('category_id');

      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Get inventory data
      const inventory = await Inventory.findOne({ sku_id: sku._id });
      
      res.json({ 
        sku: {
          ...sku.toObject(),
          inventory: inventory ? inventory.getSummary() : null
        }
      });

    } catch (error) {
      console.error('SKU lookup error:', error);
      res.status(500).json({ 
        message: 'Failed to lookup SKU', 
        error: error.message 
      });
    }
  }
);

// GET /api/skus/barcode/:barcode - Lookup SKU by barcode
router.get('/barcode/:barcode', 
  auth,
  [
    param('barcode').notEmpty().withMessage('Barcode is required'),
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

      const barcode = req.params.barcode.trim();
      
      // Find SKU by barcode
      const sku = await SKU.findOne({ barcode: barcode })
        .populate('category_id', 'name slug');

      if (!sku) {
        return res.status(404).json({ 
          message: 'SKU not found for barcode',
          barcode: barcode
        });
      }

      const skuObj = sku.toObject();

      // Include inventory data if requested
      if (req.query.include_inventory === 'true') {
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

      res.json({ 
        message: 'SKU found',
        sku: skuObj,
        barcode: barcode
      });

    } catch (error) {
      console.error('Barcode lookup error:', error);
      res.status(500).json({ 
        message: 'Failed to lookup SKU by barcode', 
        error: error.message 
      });
    }
  }
);

// POST /api/skus/barcode/:barcode/add-stock - Add stock instance using barcode lookup
router.post('/barcode/:barcode/add-stock', 
  auth,
  requireWriteAccess,
  [
    param('barcode').notEmpty().withMessage('Barcode is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('acquisition_cost').optional().isFloat({ min: 0 }).withMessage('Acquisition cost must be non-negative'),
    body('location').optional().trim().isLength({ max: 100 }).withMessage('Location cannot exceed 100 characters'),
    body('supplier').optional().trim().isLength({ max: 100 }).withMessage('Supplier cannot exceed 100 characters'),
    body('reference_number').optional().trim().isLength({ max: 50 }).withMessage('Reference number cannot exceed 50 characters'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
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

      const barcode = req.params.barcode.trim();
      
      // Find SKU by barcode
      const sku = await SKU.findOne({ barcode: barcode })
        .populate('category_id', 'name slug');

      if (!sku) {
        return res.status(404).json({ 
          message: 'SKU not found for barcode',
          barcode: barcode
        });
      }

      if (sku.status !== 'active') {
        return res.status(400).json({ 
          message: 'Cannot add stock to inactive SKU',
          sku_code: sku.sku_code,
          status: sku.status
        });
      }

      const quantity = req.body.quantity;
      const acquisitionCost = req.body.acquisition_cost || sku.unit_cost || 0;
      const location = req.body.location || 'Main Warehouse';
      const supplier = req.body.supplier || '';
      const referenceNumber = req.body.reference_number || '';
      const notes = req.body.notes || '';

      // Import Instance model
      const Instance = require('../models/Instance');
      
      const createdInstances = [];
      const instanceErrors = [];

      // Create multiple instances
      for (let i = 0; i < quantity; i++) {
        try {
          const instance = new Instance({
            sku_id: sku._id,
            acquisition_date: new Date(),
            acquisition_cost: acquisitionCost,
            location: location,
            supplier: supplier,
            reference_number: referenceNumber,
            notes: notes,
            added_by: req.user.username
          });
          
          await instance.save();
          createdInstances.push(instance._id);
        } catch (error) {
          instanceErrors.push(`Instance ${i + 1}: ${error.message}`);
        }
      }

      // Update inventory totals
      let inventory = await Inventory.findOne({ sku_id: sku._id });
      if (!inventory) {
        inventory = new Inventory({
          sku_id: sku._id,
          last_updated_by: req.user.username
        });
      }

      // Recalculate totals from instances
      const totalInstances = await Instance.countDocuments({ sku_id: sku._id });
      const availableInstances = await Instance.countDocuments({ 
        sku_id: sku._id, 
        tag_id: { $exists: false } 
      });

      inventory.total_quantity = totalInstances;
      inventory.available_quantity = availableInstances;
      inventory.last_updated_by = req.user.username;
      await inventory.save();

      res.json({ 
        message: `Successfully added ${createdInstances.length} instances via barcode scan`,
        sku: {
          _id: sku._id,
          sku_code: sku.sku_code,
          name: sku.name,
          category: sku.category_id.name
        },
        barcode: barcode,
        instances_created: createdInstances.length,
        instances_requested: quantity,
        instances_failed: instanceErrors.length,
        errors: instanceErrors.length > 0 ? instanceErrors : undefined,
        inventory_updated: {
          total_quantity: inventory.total_quantity,
          available_quantity: inventory.available_quantity
        }
      });

    } catch (error) {
      console.error('Barcode stock addition error:', error);
      res.status(500).json({ 
        message: 'Failed to add stock via barcode scan', 
        error: error.message 
      });
    }
  }
);

// POST /api/skus/batch-scan - Batch lookup SKUs by barcodes
router.post('/batch-scan',
  auth,
  [
    body('barcodes')
      .isArray({ min: 1 })
      .withMessage('Barcodes must be a non-empty array'),
    body('barcodes.*')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Each barcode must be a non-empty string')
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

      const { barcodes } = req.body;
      const found = [];
      const notFound = [];

      // Process each barcode
      for (const barcode of barcodes) {
        try {
          // Find SKU by barcode
          const sku = await SKU.findOne({ barcode: barcode.trim() })
            .populate('category_id', 'name slug');

          if (sku) {
            // Get inventory data
            const inventory = await Inventory.findOne({ sku_id: sku._id });
            
            const skuObj = sku.toObject();
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

            found.push({
              barcode,
              sku: skuObj
            });
          } else {
            notFound.push({
              barcode,
              reason: 'SKU not found for barcode'
            });
          }
        } catch (error) {
          console.error(`Error processing barcode ${barcode}:`, error);
          notFound.push({
            barcode,
            reason: 'Error processing barcode',
            error: error.message
          });
        }
      }

      res.json({
        message: 'Batch scan completed',
        summary: {
          total: barcodes.length,
          found: found.length,
          not_found: notFound.length
        },
        found,
        not_found: notFound
      });

    } catch (error) {
      console.error('Batch scan error:', error);
      res.status(500).json({
        message: 'Failed to process batch scan',
        error: error.message
      });
    }
  }
);

module.exports = router;
