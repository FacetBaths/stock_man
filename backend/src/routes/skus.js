const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const SKU = require('../models/SKU');
const Item = require('../models/Item');
const { auth, requireWriteAccess } = require('../middleware/auth');

// Import all product models for population
const { 
  Toilet, Base, Tub, Vanity, ShowerDoor, 
  RawMaterial, Accessory, Miscellaneous 
} = require('../models/Product');
const Wall = require('../models/Wall');

// Validation middleware
const validateSKU = [
  body('sku_code')
    .notEmpty()
    .withMessage('SKU code is required')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9\-_]+$/)
    .withMessage('SKU code can only contain letters, numbers, hyphens, and underscores'),
  body('product_type')
    .isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous'])
    .withMessage('Invalid product type'),
  body('product_details')
    .optional(),
  body('new_product')
    .optional()
    .isObject()
    .withMessage('New product must be an object'),
  body('is_bundle')
    .optional()
    .isBoolean()
    .withMessage('is_bundle must be a boolean'),
  body('bundle_items')
    .optional()
    .isArray()
    .withMessage('bundle_items must be an array'),
  body('bundle_items.*.product_type')
    .optional()
    .isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous'])
    .withMessage('Invalid product type in bundle item'),
  body('bundle_items.*.product_details')
    .optional()
    .isMongoId()
    .withMessage('Bundle item product_details must be a valid MongoDB ID'),
  body('bundle_items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Bundle item quantity must be a positive integer'),
  body('bundle_items.*.description')
    .optional()
    .trim(),
  body('stock_thresholds.understocked')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Understocked threshold must be a non-negative number'),
  body('stock_thresholds.overstocked')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Overstocked threshold must be a non-negative number'),
  body('current_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Current cost must be a non-negative number'),
  body('barcode')
    .optional()
    .trim(),
  body('manufacturer_model')
    .optional()
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('notes')
    .optional()
    .trim()
];

// Helper function to create new product document
async function createProductDocument(productType, productData) {
  const typeMapping = {
    'wall': Wall,
    'toilet': Toilet,
    'base': Base,
    'tub': Tub,
    'vanity': Vanity,
    'shower_door': ShowerDoor,
    'raw_material': RawMaterial,
    'accessory': Accessory,
    'miscellaneous': Miscellaneous
  };
  
  const ProductModel = typeMapping[productType];
  if (!ProductModel) {
    throw new Error(`Invalid product type: ${productType}`);
  }
  
  console.log(`Creating new ${productType} product with data:`, JSON.stringify(productData, null, 2));
  
  const product = new ProductModel(productData);
  await product.save();
  console.log(`Created new ${productType} product with ID:`, product._id);
  
  return product;
}

// Helper function to generate SKU code
async function generateSKUCode(productType, productDetails, template = null) {
  const year = new Date().getFullYear().toString().slice(-2);
  const typePrefix = productType.toUpperCase().substring(0, 3);
  
  if (template) {
    // Use custom template logic here if needed
    // For now, use default generation
  }
  
  // Find the next sequence number
  const existingSkus = await SKU.find({
    sku_code: new RegExp(`^${typePrefix}-${year}-\\d+$`)
  }).sort({ sku_code: -1 }).limit(1);
  
  let nextNumber = 1;
  if (existingSkus.length > 0) {
    const lastSku = existingSkus[0].sku_code;
    const lastNumber = parseInt(lastSku.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  return `${typePrefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
}

// GET /api/skus - Get all SKUs with filtering and pagination
router.get('/', 
  auth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('product_type').optional().isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous']),
    query('status').optional().isIn(['active', 'inactive', 'discontinued']),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // Build filter
      const filter = {};
      if (req.query.product_type) {
        filter.product_type = req.query.product_type;
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.search) {
        filter.$or = [
          { sku_code: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { manufacturer_model: { $regex: req.query.search, $options: 'i' } },
          { barcode: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const skus = await SKU.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalSkus = await SKU.countDocuments(filter);
      const totalPages = Math.ceil(totalSkus / limit);

      // Get associated items for each SKU
      const skusWithItems = await Promise.all(skus.map(async (sku) => {
        const items = await Item.find({ sku_id: sku._id });
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const stockStatus = sku.getStockStatus(totalQuantity);
        
        return {
          ...sku.toObject(),
          totalQuantity,
          stockStatus,
          itemCount: items.length
        };
      }));

      res.json({
        skus: skusWithItems,
        totalSkus,
        totalPages,
        currentPage: page
      });
    } catch (error) {
      console.error('Get SKUs error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/skus/products/:product_type - Get available Product documents for SKU creation
router.get('/products/:product_type',
  auth,
  param('product_type').isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const productType = req.params.product_type;
      
      // Get unique product details from existing items (which have populated product_details)
      const items = await Item.find({ product_type: productType })
        .populate('product_details')
        .lean();
      
      // Extract unique product details
      const uniqueProducts = new Map();
      items.forEach(item => {
        if (item.product_details && typeof item.product_details === 'object') {
          const productId = item.product_details._id.toString();
          if (!uniqueProducts.has(productId)) {
            const details = item.product_details;
            uniqueProducts.set(productId, {
              _id: productId,
              name: details.name || 
                    `${details.product_line} ${details.color_name}` || 
                    `${details.brand} ${details.model}` ||
                    `${productType} product`,
              ...details
            });
          }
        }
      });
      
      const products = Array.from(uniqueProducts.values());
      res.json({ products });
    } catch (error) {
      console.error('Get products for SKU error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/skus/:id - Get specific SKU
router.get('/:id',
  auth,
  param('id').isMongoId().withMessage('Invalid SKU ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const sku = await SKU.findById(req.params.id)
        .populate('product_details')
        .populate('bundle_items.product_details');
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Get associated items
      const items = await Item.find({ sku_id: sku._id });
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const stockStatus = sku.getStockStatus(totalQuantity);

      res.json({
        ...sku.toObject(),
        totalQuantity,
        stockStatus,
        items
      });
    } catch (error) {
      console.error('Get SKU error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/skus - Create new SKU
router.post('/',
  auth,
  requireWriteAccess,
  validateSKU,
  async (req, res) => {
    try {
      console.log('Creating SKU with data:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      // Bundle-specific validation
      if (req.body.is_bundle) {
        // For bundles, validate bundle_items
        if (!req.body.bundle_items || !Array.isArray(req.body.bundle_items) || req.body.bundle_items.length === 0) {
          return res.status(400).json({ 
            message: 'Bundle SKUs must have at least one bundle item' 
          });
        }
        
        // Validate each bundle item
        for (const [index, item] of req.body.bundle_items.entries()) {
          if (!item.product_type) {
            return res.status(400).json({ 
              message: `Bundle item ${index + 1} is missing product_type` 
            });
          }
          if (!item.product_details) {
            return res.status(400).json({ 
              message: `Bundle item ${index + 1} is missing product_details` 
            });
          }
          if (!item.quantity || item.quantity < 1) {
            return res.status(400).json({ 
              message: `Bundle item ${index + 1} must have quantity >= 1` 
            });
          }
        }
      } else {
        // For regular SKUs, validate that either product_details or new_product is provided
        if (!req.body.product_details && !req.body.new_product) {
          return res.status(400).json({ 
            message: 'Either product_details ID or new_product data must be provided' 
          });
        }
        
        if (req.body.product_details && req.body.new_product) {
          return res.status(400).json({ 
            message: 'Cannot provide both product_details and new_product' 
          });
        }
      }

      // Check if SKU code already exists
      const existingSku = await SKU.findOne({ sku_code: req.body.sku_code.toUpperCase() });
      if (existingSku) {
        return res.status(400).json({ message: 'SKU code already exists' });
      }
      
      let productDetailsId = req.body.product_details;
      
      // If new_product is provided, create the product document first
      if (req.body.new_product) {
        console.log('Creating new product document for SKU...');
        try {
          const newProduct = await createProductDocument(req.body.product_type, req.body.new_product);
          productDetailsId = newProduct._id;
          console.log('Created new product document with ID:', productDetailsId);
        } catch (productError) {
          console.error('Failed to create product document:', productError);
          return res.status(400).json({ 
            message: 'Failed to create product document', 
            error: productError.message 
          });
        }
      }

      // Create SKU
      const skuData = {
        ...req.body,
        sku_code: req.body.sku_code.toUpperCase(),
        product_details: productDetailsId,
        created_by: req.user.username,
        last_updated_by: req.user.username
      };
      
      // Auto-generate barcode if not provided
      if (!skuData.barcode) {
        // Use SKU code as barcode, removing hyphens and making it numeric-compatible
        skuData.barcode = skuData.sku_code.replace(/-/g, '');
        console.log(`Auto-generated barcode: ${skuData.barcode} from SKU: ${skuData.sku_code}`);
      }
      
      // Remove new_product field from SKU data as it's not part of SKU schema
      delete skuData.new_product;

      console.log('Final SKU data before save:', JSON.stringify(skuData, null, 2));

      // Add initial cost to history if provided
      if (req.body.current_cost && req.body.current_cost > 0) {
        skuData.cost_history = [{
          cost: req.body.current_cost,
          effective_date: new Date(),
          updated_by: req.user.username,
          notes: 'Initial cost'
        }];
      }

      const sku = new SKU(skuData);
      console.log('About to save SKU...');
      await sku.save();
      console.log('SKU saved successfully with ID:', sku._id);

      // Automatically link existing items with matching product details
      const matchingItems = await Item.find({
        product_type: sku.product_type,
        product_details: sku.product_details,
        sku_id: { $exists: false } // Only link items without SKU
      });
      
      if (matchingItems.length > 0) {
        await Item.updateMany(
          {
            product_type: sku.product_type,
            product_details: sku.product_details,
            sku_id: { $exists: false }
          },
          { sku_id: sku._id }
        );
        console.log(`Linked ${matchingItems.length} existing items to new SKU`);
      }

      // Populate product details for response
      await sku.populate('product_details');
      await sku.populate('bundle_items.product_details');

      res.status(201).json(sku);
    } catch (error) {
      console.error('Create SKU error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.errors) {
        console.error('Validation errors:', error.errors);
      }
      
      if (error.code === 11000) {
        res.status(400).json({ message: 'SKU code already exists' });
      } else if (error.name === 'ValidationError') {
        const validationErrors = Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }));
        res.status(400).json({ 
          message: 'Database validation failed', 
          errors: validationErrors
        });
      } else {
        res.status(500).json({ 
          message: 'Server error',
          error: error.message 
        });
      }
    }
  }
);

// POST /api/skus/generate - Generate SKU code
router.post('/generate',
  auth,
  requireWriteAccess,
  [
    body('product_type').isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous']),
    body('product_details').notEmpty().withMessage('Product details ID is required'),
    body('template').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const skuCode = await generateSKUCode(
        req.body.product_type,
        req.body.product_details,
        req.body.template
      );

      res.json({ sku_code: skuCode });
    } catch (error) {
      console.error('Generate SKU error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// PUT /api/skus/:id - Update SKU
router.put('/:id',
  auth,
  requireWriteAccess,
  param('id').isMongoId().withMessage('Invalid SKU ID'),
  [
    body('sku_code')
      .optional()
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\-_]+$/)
      .withMessage('SKU code can only contain letters, numbers, hyphens, and underscores'),
    body('stock_thresholds.understocked')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Understocked threshold must be a non-negative number'),
    body('stock_thresholds.overstocked')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Overstocked threshold must be a non-negative number'),
    body('barcode').optional().trim(),
    body('manufacturer_model').optional().trim(),
    body('description').optional().trim(),
    body('notes').optional().trim(),
    body('status').optional().isIn(['active', 'inactive', 'discontinued'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Check if updating SKU code conflicts with existing
      if (req.body.sku_code && req.body.sku_code !== sku.sku_code) {
        const existingSku = await SKU.findOne({ 
          sku_code: req.body.sku_code.toUpperCase(),
          _id: { $ne: req.params.id }
        });
        if (existingSku) {
          return res.status(400).json({ message: 'SKU code already exists' });
        }
      }

      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key === 'sku_code') {
          sku[key] = req.body[key].toUpperCase();
        } else if (key !== 'current_cost') { // Don't update current_cost directly
          sku[key] = req.body[key];
        }
      });

      sku.last_updated_by = req.user.username;
      await sku.save();

      await sku.populate('product_details');
      res.json(sku);
    } catch (error) {
      console.error('Update SKU error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/skus/:id/cost - Add new cost to SKU
router.post('/:id/cost',
  auth,
  requireWriteAccess,
  param('id').isMongoId().withMessage('Invalid SKU ID'),
  [
    body('cost').isFloat({ min: 0 }).withMessage('Cost must be a non-negative number'),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      await sku.addCost(req.body.cost, req.user.username, req.body.notes || '');
      await sku.populate('product_details');

      res.json(sku);
    } catch (error) {
      console.error('Add SKU cost error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE /api/skus/:id - Delete SKU
router.delete('/:id',
  auth,
  requireWriteAccess,
  param('id').isMongoId().withMessage('Invalid SKU ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found' });
      }

      // Check if SKU is referenced by any items
      const linkedItems = await Item.find({ sku_id: req.params.id });
      if (linkedItems.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete SKU. It is linked to ${linkedItems.length} item(s)`,
          linkedItems: linkedItems.length
        });
      }

      await SKU.findByIdAndDelete(req.params.id);
      res.json({ message: 'SKU deleted successfully' });
    } catch (error) {
      console.error('Delete SKU error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/skus/search/barcode/:barcode - Search SKU by barcode
router.get('/search/barcode/:barcode',
  auth,
  param('barcode').notEmpty().withMessage('Barcode is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const sku = await SKU.findOne({ barcode: req.params.barcode }).populate('product_details');
      
      if (!sku) {
        return res.status(404).json({ message: 'SKU not found for barcode' });
      }

      // Get associated items
      const items = await Item.find({ sku_id: sku._id });
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const stockStatus = sku.getStockStatus(totalQuantity);

      res.json({
        ...sku.toObject(),
        totalQuantity,
        stockStatus,
        items
      });
    } catch (error) {
      console.error('Search SKU by barcode error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
