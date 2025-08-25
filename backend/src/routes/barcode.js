const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const SKU = require('../models/SKU');
const Item = require('../models/Item');
const Tag = require('../models/Tag');
const { auth, requireWriteAccess } = require('../middleware/auth');

// POST /api/barcode/batch-scan - Process batch scanned barcodes
router.post('/batch-scan',
  auth,
  requireWriteAccess,
  [
    body('barcodes')
      .isArray({ min: 1 })
      .withMessage('Barcodes array is required and must not be empty'),
    body('barcodes.*')
      .notEmpty()
      .withMessage('Each barcode must not be empty')
      .trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const barcodes = req.body.barcodes;
      const results = {
        found: [],
        notFound: [],
        summary: {
          total: barcodes.length,
          found: 0,
          notFound: 0
        }
      };

      // Process each barcode
      for (const barcode of barcodes) {
        const sku = await SKU.findOne({ barcode: barcode.trim() }).populate('product_details');
        
        if (sku) {
          // Get associated items
          const items = await Item.find({ sku_id: sku._id });
          const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          const stockStatus = sku.getStockStatus(totalQuantity);

          results.found.push({
            barcode: barcode.trim(),
            sku: {
              ...sku.toObject(),
              totalQuantity,
              stockStatus,
              items
            }
          });
          results.summary.found++;
        } else {
          results.notFound.push({
            barcode: barcode.trim()
          });
          results.summary.notFound++;
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Batch scan error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/barcode/create-missing - Create products/SKUs for missing barcodes
router.post('/create-missing',
  auth,
  requireWriteAccess,
  [
    body('missing_items')
      .isArray({ min: 1 })
      .withMessage('Missing items array is required'),
    body('missing_items.*.barcode')
      .notEmpty()
      .withMessage('Barcode is required for each missing item'),
    body('missing_items.*.sku_code')
      .notEmpty()
      .withMessage('SKU code is required for each missing item'),
    body('missing_items.*.product_type')
      .isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous'])
      .withMessage('Valid product type is required'),
    body('missing_items.*.product_details')
      .notEmpty()
      .withMessage('Product details ID is required'),
    body('missing_items.*.quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Quantity must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const createdItems = [];
      const failedItems = [];

      for (const missingItem of req.body.missing_items) {
        try {
          // Check if SKU code already exists
          const existingSku = await SKU.findOne({ sku_code: missingItem.sku_code.toUpperCase() });
          if (existingSku) {
            failedItems.push({
              barcode: missingItem.barcode,
              error: 'SKU code already exists'
            });
            continue;
          }

          // Create SKU
          const skuData = {
            sku_code: missingItem.sku_code.toUpperCase(),
            product_type: missingItem.product_type,
            product_details: missingItem.product_details,
            barcode: missingItem.barcode.trim(),
            current_cost: missingItem.current_cost || 0,
            stock_thresholds: missingItem.stock_thresholds || {
              understocked: 5,
              overstocked: 100
            },
            description: missingItem.description || '',
            notes: missingItem.notes || 'Created from batch scan',
            created_by: req.user.username,
            last_updated_by: req.user.username
          };

          // Add initial cost to history if provided
          if (missingItem.current_cost && missingItem.current_cost > 0) {
            skuData.cost_history = [{
              cost: missingItem.current_cost,
              effective_date: new Date(),
              updated_by: req.user.username,
              notes: 'Initial cost from batch creation'
            }];
          }

          const sku = new SKU(skuData);
          await sku.save();

          // Create associated item if quantity is provided
          if (missingItem.quantity && missingItem.quantity > 0) {
            const itemData = {
              product_type: missingItem.product_type,
              product_details: missingItem.product_details,
              quantity: missingItem.quantity,
              location: missingItem.location || '',
              notes: missingItem.notes || 'Created from batch scan',
              cost: missingItem.current_cost || 0,
              sku_id: sku._id,
              stock_thresholds: missingItem.stock_thresholds || {
                understocked: 5,
                overstocked: 100
              }
            };

            const item = new Item(itemData);
            await item.save();
          }

          await sku.populate('product_details');

          createdItems.push({
            barcode: missingItem.barcode,
            sku: sku.toObject()
          });
        } catch (itemError) {
          console.error(`Error creating item for barcode ${missingItem.barcode}:`, itemError);
          failedItems.push({
            barcode: missingItem.barcode,
            error: itemError.message
          });
        }
      }

      res.json({
        created: createdItems,
        failed: failedItems,
        summary: {
          total: req.body.missing_items.length,
          created: createdItems.length,
          failed: failedItems.length
        }
      });
    } catch (error) {
      console.error('Create missing items error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/barcode/update-inventory - Update inventory quantities from batch scan
router.post('/update-inventory',
  auth,
  requireWriteAccess,
  [
    body('scanned_items')
      .isArray({ min: 1 })
      .withMessage('Scanned items array is required'),
    body('scanned_items.*.barcode')
      .notEmpty()
      .withMessage('Barcode is required for each scanned item'),
    body('scanned_items.*.quantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('location')
      .optional()
      .trim(),
    body('notes')
      .optional()
      .trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const scannedItems = req.body.scanned_items;
      const location = req.body.location || '';
      const notes = req.body.notes || 'Added from batch scan';
      const results = {
        updated: [],
        created: [],
        failed: [],
        summary: {
          total: scannedItems.length,
          updated: 0,
          created: 0,
          failed: 0
        }
      };

      // Process each scanned item
      for (const scannedItem of scannedItems) {
        try {
          const quantity = scannedItem.quantity || 1;
          const sku = await SKU.findOne({ barcode: scannedItem.barcode.trim() });
          
          if (!sku) {
            results.failed.push({
              barcode: scannedItem.barcode,
              error: 'SKU not found for barcode'
            });
            results.summary.failed++;
            continue;
          }

          // Find existing inventory item for this SKU
          let existingItem = await Item.findOne({ sku_id: sku._id });
          
          if (existingItem) {
            // Update existing item quantity
            const previousQuantity = existingItem.quantity;
            existingItem.quantity += quantity;
            existingItem.notes = notes;
            existingItem.last_updated = new Date();
            await existingItem.save();
            
            results.updated.push({
              barcode: scannedItem.barcode,
              sku_code: sku.sku_code,
              previous_quantity: previousQuantity,
              added_quantity: quantity,
              new_quantity: existingItem.quantity,
              item_id: existingItem._id
            });
            results.summary.updated++;
          } else {
            // Create new inventory item
            const typeMapping = {
              'wall': 'Wall',
              'toilet': 'Toilet',
              'base': 'Base',
              'tub': 'Tub',
              'vanity': 'Vanity',
              'shower_door': 'ShowerDoor',
              'raw_material': 'RawMaterial',
              'accessory': 'Accessory',
              'miscellaneous': 'Miscellaneous'
            };
            
            const newItem = new Item({
              product_type: sku.product_type,
              product_type_model: typeMapping[sku.product_type],
              product_details: sku.product_details,
              quantity: quantity,
              location: location,
              notes: notes,
              cost: sku.current_cost || 0,
              sku_id: sku._id,
              stock_thresholds: sku.stock_thresholds
            });
            
            await newItem.save();
            
            results.created.push({
              barcode: scannedItem.barcode,
              sku_code: sku.sku_code,
              quantity: quantity,
              item_id: newItem._id
            });
            results.summary.created++;
          }
        } catch (itemError) {
          console.error(`Error updating inventory for barcode ${scannedItem.barcode}:`, itemError);
          results.failed.push({
            barcode: scannedItem.barcode,
            error: itemError.message
          });
          results.summary.failed++;
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Update inventory error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/barcode/assign-to-tag - Assign scanned SKUs to a tag
router.post('/assign-to-tag',
  auth,
  requireWriteAccess,
  [
    body('barcodes')
      .isArray({ min: 1 })
      .withMessage('Barcodes array is required'),
    body('tag_data')
      .notEmpty()
      .withMessage('Tag data is required'),
    body('tag_data.customer_name')
      .notEmpty()
      .withMessage('Customer name is required'),
    body('tag_data.tag_type')
      .optional()
      .isIn(['stock', 'reserved', 'broken', 'imperfect', 'expected', 'partial_shipment', 'backorder'])
      .withMessage('Invalid tag type'),
    body('tag_data.notes')
      .optional()
      .trim(),
    body('tag_data.due_date')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const barcodes = req.body.barcodes;
      const tagData = req.body.tag_data;
      const results = {
        success: [],
        failed: [],
        summary: {
          total: barcodes.length,
          success: 0,
          failed: 0
        }
      };

      // Group barcodes by item (same SKU might be scanned multiple times)
      const barcodeGroups = {};
      for (const barcode of barcodes) {
        const sku = await SKU.findOne({ barcode: barcode.trim() });
        if (!sku) {
          results.failed.push({
            barcode: barcode.trim(),
            error: 'SKU not found for barcode'
          });
          results.summary.failed++;
          continue;
        }

        // Find associated item
        const item = await Item.findOne({ sku_id: sku._id });
        if (!item) {
          results.failed.push({
            barcode: barcode.trim(),
            error: 'No inventory item found for SKU'
          });
          results.summary.failed++;
          continue;
        }

        const itemId = item._id.toString();
        if (!barcodeGroups[itemId]) {
          barcodeGroups[itemId] = {
            item,
            sku,
            quantity: 0,
            barcodes: []
          };
        }
        barcodeGroups[itemId].quantity += 1;
        barcodeGroups[itemId].barcodes.push(barcode.trim());
      }

      // Create tags for each item group
      for (const itemId in barcodeGroups) {
        const group = barcodeGroups[itemId];
        
        try {
          const tag = new Tag({
            customer_name: tagData.customer_name,
            tag_type: tagData.tag_type || 'reserved',
            sku_items: [{
              sku_id: group.item.sku_id,
              quantity: group.quantity,
              notes: `Tagged from barcode scan (${group.quantity} items)`
            }],
            notes: tagData.notes || `Tagged from barcode scan (${group.quantity} items)`,
            status: 'active',
            created_by: req.user.username,
            last_updated_by: req.user.username,
            due_date: tagData.due_date ? new Date(tagData.due_date) : undefined
          });

          await tag.save();

          results.success.push({
            barcodes: group.barcodes,
            tag: tag.toObject(),
            item: group.item.toObject(),
            sku: group.sku.toObject()
          });
          results.summary.success += group.quantity;
        } catch (tagError) {
          console.error(`Error creating tag for item ${itemId}:`, tagError);
          group.barcodes.forEach(barcode => {
            results.failed.push({
              barcode,
              error: `Failed to create tag: ${tagError.message}`
            });
          });
          results.summary.failed += group.quantity;
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Assign to tag error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/barcode/link-existing - Link scanned barcode to existing product
router.post('/link-existing',
  auth,
  requireWriteAccess,
  [
    body('barcode')
      .notEmpty()
      .withMessage('Barcode is required'),
    body('item_id')
      .isMongoId()
      .withMessage('Valid item ID is required'),
    body('create_sku')
      .optional()
      .isBoolean()
      .withMessage('Create SKU must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { barcode, item_id, create_sku = true } = req.body;

      // Check if barcode is already in use
      const existingSku = await SKU.findOne({ barcode: barcode.trim() });
      if (existingSku) {
        return res.status(400).json({ message: 'Barcode is already linked to another SKU' });
      }

      // Get the item
      const item = await Item.findById(item_id).populate('product_details');
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      let sku;
      
      if (item.sku_id) {
        // Item already has a SKU, just add the barcode
        sku = await SKU.findById(item.sku_id);
        if (!sku) {
          return res.status(400).json({ message: 'Item references invalid SKU' });
        }
        
        if (sku.barcode && sku.barcode !== barcode.trim()) {
          return res.status(400).json({ message: 'SKU already has a different barcode assigned' });
        }
        
        sku.barcode = barcode.trim();
        sku.last_updated_by = req.user.username;
        await sku.save();
      } else if (create_sku) {
        // Create new SKU for this item
        const skuCode = await generateSKUCode(item.product_type, item.product_details);
        
        sku = new SKU({
          sku_code: skuCode,
          product_type: item.product_type,
          product_details: item.product_details,
          barcode: barcode.trim(),
          current_cost: item.cost || 0,
          stock_thresholds: item.stock_thresholds || {
            understocked: 5,
            overstocked: 100
          },
          description: `Auto-created from barcode link`,
          notes: 'Created from barcode linking',
          created_by: req.user.username,
          last_updated_by: req.user.username,
          is_auto_generated: true
        });

        if (item.cost && item.cost > 0) {
          sku.cost_history = [{
            cost: item.cost,
            effective_date: new Date(),
            updated_by: req.user.username,
            notes: 'Initial cost from linked item'
          }];
        }

        await sku.save();
        
        // Link item to SKU
        item.sku_id = sku._id;
        await item.save();
      } else {
        return res.status(400).json({ message: 'Item has no SKU and create_sku is false' });
      }

      await sku.populate('product_details');

      res.json({
        message: 'Barcode linked successfully',
        sku: sku.toObject(),
        item: item.toObject()
      });
    } catch (error) {
      console.error('Link existing error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Helper function to generate SKU code (duplicate from skus.js for now)
async function generateSKUCode(productType, productDetails, template = null) {
  const year = new Date().getFullYear().toString().slice(-2);
  const typePrefix = productType.toUpperCase().substring(0, 3);
  
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

module.exports = router;
