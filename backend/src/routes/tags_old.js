const express = require('express');
const { body, validationResult } = require('express-validator');
const Tag = require('../models/Tag');
const Item = require('../models/Item');
const SKU = require('../models/SKU');
const { auth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

// Get all tags with optional filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      item_id, 
      customer_name, 
      status = 'active',
      tag_type,
      page = 1, 
      limit = 50
    } = req.query;

    let query = { status };
    
    if (item_id) query.item_id = item_id;
    if (customer_name) query.customer_name = new RegExp(customer_name, 'i');
    if (tag_type) query.tag_type = tag_type;

    const tags = await Tag.find(query)
      .populate({
        path: 'item_id',
        populate: { path: 'product_details' }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalTags = await Tag.countDocuments(query);

    res.json({
      tags,
      totalTags,
      totalPages: Math.ceil(totalTags / limit),
      currentPage: parseInt(page)
    });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Look up item by SKU code (for scanning)
router.get('/lookup-sku/:skuCode', auth, async (req, res) => {
  try {
    const { skuCode } = req.params;
    
    // Find SKU by code
    const SKU = require('../models/SKU');
    const sku = await SKU.findOne({ 
      sku_code: skuCode.toUpperCase(),
      status: 'active'
    }).populate('product_details');
    
    if (!sku) {
      return res.status(404).json({ message: 'SKU not found' });
    }
    
    // Find associated item
    const item = await Item.findOne({ sku_id: sku._id }).populate('product_details');
    if (!item) {
      return res.status(404).json({ message: 'No item found for this SKU' });
    }
    
    // Get current tagged quantities
    const existingTags = await Tag.find({ item_id: item._id, status: 'active' });
    const totalTagged = existingTags.reduce((sum, tag) => sum + tag.quantity, 0);
    const availableQuantity = item.quantity - totalTagged;
    
    res.json({
      item: {
        ...item.toObject(),
        availableQuantity
      },
      sku
    });
    
  } catch (error) {
    console.error('SKU lookup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tags for specific item
router.get('/item/:itemId', auth, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const tags = await Tag.find({ 
      item_id: itemId, 
      status: 'active' 
    }).sort({ createdAt: -1 });

    // Calculate quantities by tag type
    const stockQuantity = tags
      .filter(tag => tag.tag_type === 'stock')
      .reduce((sum, tag) => sum + tag.quantity, 0);
    
    const reservedQuantity = tags
      .filter(tag => tag.tag_type !== 'stock')
      .reduce((sum, tag) => sum + tag.quantity, 0);

    res.json({
      tags,
      stockQuantity,
      reservedQuantity,
      totalTagged: stockQuantity + reservedQuantity
    });

  } catch (error) {
    console.error('Get item tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new tag
// Create multiple tags in a batch
router.post('/batch', [auth, requireWriteAccess], [
  body('tags').isArray({ min: 1 }).withMessage('Tags array is required'),
  body('tags.*.item_id').isMongoId().withMessage('Valid item ID is required'),
  body('tags.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
  body('tag_type').isIn(['stock', 'reserved', 'broken', 'imperfect']).withMessage('Invalid tag type')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { tags, customer_name, tag_type, notes, due_date } = req.body;
  const createdTags = [];
  const errorList = [];

  try {
    for (const tagInfo of tags) {
      const item = await Item.findById(tagInfo.item_id);
      if (!item) {
        errorList.push({ item_id: tagInfo.item_id, message: 'Item not found' });
        continue;
      }

      const existingTags = await Tag.find({ item_id: tagInfo.item_id, status: 'active' });
      const totalTagged = existingTags.reduce((sum, tag) => sum + tag.quantity, 0);
      const availableQuantity = item.quantity - totalTagged;

      if (tagInfo.quantity > availableQuantity) {
        errorList.push({ 
          item_id: tagInfo.item_id, 
          message: `Insufficient quantity. Available: ${availableQuantity}, Requested: ${tagInfo.quantity}` 
        });
        continue;
      }

      const newTag = new Tag({
        item_id: tagInfo.item_id,
        quantity: tagInfo.quantity,
        customer_name,
        tag_type,
        notes: notes || '',
        created_by: req.user.username,
        due_date: due_date ? new Date(due_date) : undefined
      });

      await newTag.save();
      await newTag.populate({ path: 'item_id', populate: { path: 'product_details' } });
      createdTags.push(newTag);
    }

    if (errorList.length > 0) {
      return res.status(400).json({
        message: 'Some tags could not be created',
        createdTags,
        errors: errorList
      });
    }

    res.status(201).json({
      message: 'Tags created successfully',
      tags: createdTags
    });

  } catch (error) {
    console.error('Batch create tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', [auth, requireWriteAccess], [
  body('item_id').isMongoId().withMessage('Valid item ID is required'),
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('tag_type').optional().isIn(['stock', 'reserved', 'broken', 'imperfect'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { item_id, customer_name, quantity, tag_type, notes, due_date } = req.body;

    // Check if item exists and has enough quantity
    const item = await Item.findById(item_id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get current tagged quantities for this item
    const existingTags = await Tag.find({ 
      item_id, 
      status: 'active' 
    });
    const totalTagged = existingTags.reduce((sum, tag) => sum + tag.quantity, 0);
    const availableQuantity = item.quantity - totalTagged;

    if (quantity > availableQuantity) {
      return res.status(400).json({ 
        message: `Insufficient available quantity. Available: ${availableQuantity}, Requested: ${quantity}` 
      });
    }

    const tag = new Tag({
      item_id,
      customer_name,
      quantity,
      tag_type: tag_type || 'stock',
      notes: notes || '',
      created_by: req.user.username,
      due_date: due_date ? new Date(due_date) : undefined
    });

    await tag.save();
    await tag.populate({
      path: 'item_id',
      populate: { path: 'product_details' }
    });

    res.status(201).json({
      message: 'Tag created successfully',
      tag
    });

  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tag
router.put('/:id', [auth, requireWriteAccess], [
  body('quantity').optional().isInt({ min: 1 }),
  body('customer_name').optional().notEmpty().trim(),
  body('tag_type').optional().isIn(['stock', 'reserved', 'broken', 'imperfect']),
  body('status').optional().isIn(['active', 'fulfilled', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // If updating quantity, check availability
    if (updates.quantity && updates.quantity !== tag.quantity) {
      const item = await Item.findById(tag.item_id);
      const existingTags = await Tag.find({ 
        item_id: tag.item_id, 
        status: 'active',
        _id: { $ne: id } // Exclude current tag
      });
      const otherTaggedQuantity = existingTags.reduce((sum, t) => sum + t.quantity, 0);
      const availableQuantity = item.quantity - otherTaggedQuantity;

      if (updates.quantity > availableQuantity) {
        return res.status(400).json({ 
          message: `Insufficient available quantity. Available: ${availableQuantity}, Requested: ${updates.quantity}` 
        });
      }
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'due_date' && updates[key]) {
          tag[key] = new Date(updates[key]);
        } else {
          tag[key] = updates[key];
        }
      }
    });

    await tag.save();
    await tag.populate({
      path: 'item_id',
      populate: { path: 'product_details' }
    });

    res.json({
      message: 'Tag updated successfully',
      tag
    });

  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete tag
router.delete('/:id', [auth, requireWriteAccess], async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    await Tag.findByIdAndDelete(id);

    res.json({ message: 'Tag deleted successfully' });

  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send for Install - Batch scan and fulfill tags
router.post('/send-for-install', [auth, requireWriteAccess], [
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
  body('scanned_barcodes').optional().isArray().withMessage('Scanned barcodes must be an array'),
  body('tag_ids').optional().isArray().withMessage('Tag IDs must be an array'),
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

    const { customer_name, scanned_barcodes, tag_ids, notes } = req.body;
    
    let tagsToFulfill = [];
    const results = {
      fulfilled: [],
      failed: [],
      inventory_reduced: []
    };

    // Method 1: If specific tag IDs are provided
    if (tag_ids && tag_ids.length > 0) {
      tagsToFulfill = await Tag.find({
        _id: { $in: tag_ids },
        customer_name: customer_name,
        status: 'active'
      }).populate({ path: 'item_id', populate: { path: 'product_details' } });
    }
    // Method 2: If barcodes are scanned, find matching SKUs and their items/tags
    else if (scanned_barcodes && scanned_barcodes.length > 0) {
      const SKU = require('../models/SKU');
      
      for (const barcode of scanned_barcodes) {
        try {
          // Find SKU by barcode
          const sku = await SKU.findOne({ barcode: barcode.trim() });
          if (!sku) {
            results.failed.push({ barcode, error: 'SKU not found' });
            continue;
          }

          // Find items for this SKU
          const items = await Item.find({ sku_id: sku._id });
          if (!items.length) {
            results.failed.push({ barcode, error: 'No inventory items found for SKU' });
            continue;
          }

          // Find active tags for these items and customer
          for (const item of items) {
            const tags = await Tag.find({
              item_id: item._id,
              customer_name: customer_name,
              status: 'active'
            }).populate({ path: 'item_id', populate: { path: 'product_details' } });
            
            tagsToFulfill.push(...tags);
          }
        } catch (err) {
          results.failed.push({ barcode, error: err.message });
        }
      }
    }
    // Method 3: Get all active tags for customer
    else {
      tagsToFulfill = await Tag.find({
        customer_name: customer_name,
        status: 'active'
      }).populate({ path: 'item_id', populate: { path: 'product_details' } });
    }

    // Process fulfillment
    for (const tag of tagsToFulfill) {
      try {
        // Reduce inventory quantity
        const item = await Item.findById(tag.item_id._id);
        if (item.quantity >= tag.quantity) {
          item.quantity -= tag.quantity;
          await item.save();
          
          results.inventory_reduced.push({
            item_id: item._id,
            previous_quantity: item.quantity + tag.quantity,
            new_quantity: item.quantity,
            reduced_by: tag.quantity
          });
        }

        // Mark tag as fulfilled
        tag.status = 'fulfilled';
        tag.notes = `${tag.notes || ''} ${notes || ''} - Sent for install on ${new Date().toISOString()}`.trim();
        await tag.save();
        
        results.fulfilled.push(tag);
      } catch (err) {
        results.failed.push({ 
          tag_id: tag._id, 
          error: err.message 
        });
      }
    }

    res.json({
      message: `Send for Install completed. ${results.fulfilled.length} tags fulfilled, ${results.failed.length} failed.`,
      customer_name,
      results
    });

  } catch (error) {
    console.error('Send for install error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Product Used - Mark specific tags as used without scanning
router.post('/mark-used', [auth, requireWriteAccess], [
  body('tag_ids').isArray({ min: 1 }).withMessage('At least one tag ID is required'),
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

    const { tag_ids, notes } = req.body;
    
    const results = {
      fulfilled: [],
      failed: [],
      inventory_reduced: []
    };

    // Find and process tags
    const tags = await Tag.find({
      _id: { $in: tag_ids },
      status: 'active'
    }).populate({ path: 'item_id', populate: { path: 'product_details' } });

    for (const tag of tags) {
      try {
        // Reduce inventory quantity
        const item = await Item.findById(tag.item_id._id);
        if (item.quantity >= tag.quantity) {
          item.quantity -= tag.quantity;
          await item.save();
          
          results.inventory_reduced.push({
            item_id: item._id,
            previous_quantity: item.quantity + tag.quantity,
            new_quantity: item.quantity,
            reduced_by: tag.quantity
          });
        }

        // Mark tag as fulfilled
        tag.status = 'fulfilled';
        tag.notes = `${tag.notes || ''} ${notes || ''} - Marked as used on ${new Date().toISOString()}`.trim();
        await tag.save();
        
        results.fulfilled.push(tag);
      } catch (err) {
        results.failed.push({ 
          tag_id: tag._id, 
          error: err.message 
        });
      }
    }

    res.json({
      message: `Product Used completed. ${results.fulfilled.length} tags marked as used, ${results.failed.length} failed.`,
      results
    });

  } catch (error) {
    console.error('Mark used error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customers with active tags (for Send for Install workflow)
router.get('/customers', auth, async (req, res) => {
  try {
    const customers = await Tag.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$customer_name',
          tag_count: { $sum: 1 },
          total_quantity: { $sum: '$quantity' },
          tag_types: { $addToSet: '$tag_type' },
          oldest_date: { $min: '$createdAt' },
          newest_date: { $max: '$createdAt' }
        }
      },
      { $sort: { newest_date: -1 } }
    ]);

    res.json({
      customers: customers.map(c => ({
        name: c._id,
        tag_count: c.tag_count,
        total_quantity: c.total_quantity,
        tag_types: c.tag_types,
        date_range: {
          oldest: c.oldest_date,
          newest: c.newest_date
        }
      }))
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tag statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Tag.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$tag_type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    const totalActiveTags = await Tag.countDocuments({ status: 'active' });
    const uniqueCustomers = await Tag.distinct('customer_name', { status: 'active' });

    res.json({
      totalActiveTags,
      uniqueCustomers: uniqueCustomers.length,
      byTagType: stats
    });

  } catch (error) {
    console.error('Get tag stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
