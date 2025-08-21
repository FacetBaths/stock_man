const express = require('express');
const { body, validationResult } = require('express-validator');
const Tag = require('../models/Tag');
const Item = require('../models/Item');
const SKU = require('../models/SKU');
const { auth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

// Helper function to expand bundle SKUs to individual items
async function expandBundleItems(skuId, quantity) {
  const sku = await SKU.findById(skuId);
  if (!sku) {
    throw new Error('SKU not found');
  }
  
  const expandedItems = [];
  
  if (sku.is_bundle && sku.bundle_items.length > 0) {
    // For bundle SKUs, expand to individual items
    for (const bundleItem of sku.bundle_items) {
      // Find matching items for each bundle component
      const items = await Item.find({
        product_type: bundleItem.product_type,
        product_details: bundleItem.product_details
      });
      
      if (items.length > 0) {
        expandedItems.push({
          item_id: items[0]._id, // Use first matching item
          product_type: bundleItem.product_type,
          product_details: bundleItem.product_details,
          quantity: bundleItem.quantity * quantity, // Multiply by tag quantity
          from_bundle: true,
          bundle_sku_id: skuId
        });
      }
    }
  } else {
    // For non-bundle SKUs, find the corresponding item
    const item = await Item.findOne({ sku_id: skuId });
    if (item) {
      expandedItems.push({
        item_id: item._id,
        quantity: quantity,
        from_bundle: false,
        bundle_sku_id: null
      });
    }
  }
  
  return expandedItems;
}

// Helper function to check available inventory for SKU items
async function checkAvailableInventory(skuItems) {
  const availability = [];
  
  for (const skuItem of skuItems) {
    const sku = await SKU.findById(skuItem.sku_id);
    if (!sku) {
      availability.push({
        sku_id: skuItem.sku_id,
        error: 'SKU not found'
      });
      continue;
    }
    
    // Expand to actual inventory items
    try {
      const expandedItems = await expandBundleItems(skuItem.sku_id, skuItem.quantity);
      let canFulfill = true;
      const itemChecks = [];
      
      for (const expanded of expandedItems) {
        const item = await Item.findById(expanded.item_id);
        if (!item) {
          itemChecks.push({
            item_id: expanded.item_id,
            available: 0,
            needed: expanded.quantity,
            sufficient: false,
            error: 'Item not found'
          });
          canFulfill = false;
        } else {
          // Get current tagged quantities for this item
          const existingTags = await Tag.aggregate([
            { $match: { status: 'active', 'sku_items.sku_id': { $exists: true } } },
            { $unwind: '$sku_items' },
            { $match: { 'sku_items.sku_id': { $exists: true } } }
          ]);
          
          // Calculate total tagged quantity for this item
          let totalTagged = 0;
          for (const tag of existingTags) {
            const tagExpandedItems = await expandBundleItems(tag.sku_items.sku_id, tag.sku_items.remaining_quantity || tag.sku_items.quantity);
            const matchingExpanded = tagExpandedItems.find(ei => ei.item_id.toString() === item._id.toString());
            if (matchingExpanded) {
              totalTagged += matchingExpanded.quantity;
            }
          }
          
          const availableQuantity = item.quantity - totalTagged;
          const sufficient = expanded.quantity <= availableQuantity;
          
          itemChecks.push({
            item_id: expanded.item_id,
            available: availableQuantity,
            needed: expanded.quantity,
            sufficient: sufficient
          });
          
          if (!sufficient) canFulfill = false;
        }
      }
      
      availability.push({
        sku_id: skuItem.sku_id,
        sku_code: sku.sku_code,
        is_bundle: sku.is_bundle,
        quantity: skuItem.quantity,
        can_fulfill: canFulfill,
        item_checks: itemChecks
      });
    } catch (error) {
      availability.push({
        sku_id: skuItem.sku_id,
        error: error.message
      });
    }
  }
  
  return availability;
}

// Get all tags with optional filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      sku_id,
      customer_name, 
      status = 'active',
      tag_type,
      page = 1, 
      limit = 50
    } = req.query;

    let query = { status };
    
    if (sku_id) query['sku_items.sku_id'] = sku_id;
    if (customer_name) query.customer_name = new RegExp(customer_name, 'i');
    if (tag_type) query.tag_type = tag_type;

    const tags = await Tag.find(query)
      .populate({
        path: 'sku_items.sku_id',
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

// Look up SKU by code (for scanning)
router.get('/lookup-sku/:skuCode', auth, async (req, res) => {
  try {
    const { skuCode } = req.params;
    
    // Find SKU by code
    const sku = await SKU.findOne({ 
      sku_code: skuCode.toUpperCase(),
      status: 'active'
    }).populate('product_details');
    
    if (!sku) {
      return res.status(404).json({ message: 'SKU not found' });
    }
    
    // Find the corresponding inventory item
    const item = await Item.findOne({ sku_id: sku._id }).populate('product_details');
    if (!item) {
      return res.status(404).json({ message: 'No inventory item found for this SKU' });
    }
    
    // Check available quantities
    const availability = await checkAvailableInventory([{ sku_id: sku._id, quantity: 1 }]);
    const availableQuantity = availability[0]?.item_checks?.[0]?.available || item.quantity;
    
    // Return format expected by frontend
    res.json({
      sku,
      item: {
        ...item.toObject(),
        availableQuantity
      }
    });
    
  } catch (error) {
    console.error('SKU lookup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tags for specific SKU
router.get('/sku/:skuId', auth, async (req, res) => {
  try {
    const { skuId } = req.params;
    
    const tags = await Tag.find({ 
      'sku_items.sku_id': skuId,
      status: 'active' 
    }).populate({
      path: 'sku_items.sku_id',
      populate: { path: 'product_details' }
    }).sort({ createdAt: -1 });

    // Calculate quantities by tag type
    const stockQuantity = tags
      .filter(tag => tag.tag_type === 'stock')
      .reduce((sum, tag) => {
        const skuItem = tag.sku_items.find(item => item.sku_id._id.toString() === skuId);
        return sum + (skuItem ? (skuItem.remaining_quantity || skuItem.quantity) : 0);
      }, 0);
    
    const reservedQuantity = tags
      .filter(tag => tag.tag_type !== 'stock')
      .reduce((sum, tag) => {
        const skuItem = tag.sku_items.find(item => item.sku_id._id.toString() === skuId);
        return sum + (skuItem ? (skuItem.remaining_quantity || skuItem.quantity) : 0);
      }, 0);

    res.json({
      tags,
      stockQuantity,
      reservedQuantity,
      totalTagged: stockQuantity + reservedQuantity
    });

  } catch (error) {
    console.error('Get SKU tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new tag with SKUs
router.post('/', [auth, requireWriteAccess], [
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
  body('sku_items').isArray({ min: 1 }).withMessage('At least one SKU item is required'),
  body('sku_items.*.sku_id').isMongoId().withMessage('Valid SKU ID is required'),
  body('sku_items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('tag_type').optional().isIn(['stock', 'reserved', 'broken', 'imperfect'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customer_name, sku_items, tag_type, notes, due_date } = req.body;

    // Check availability for all SKU items
    const availability = await checkAvailableInventory(sku_items);
    const insufficient = availability.filter(a => !a.can_fulfill);
    
    if (insufficient.length > 0) {
      return res.status(400).json({ 
        message: 'Insufficient inventory for some items',
        insufficient_items: insufficient
      });
    }

    const tag = new Tag({
      customer_name,
      sku_items,
      tag_type: tag_type || 'stock',
      notes: notes || '',
      created_by: req.user.username,
      due_date: due_date ? new Date(due_date) : undefined
    });

    await tag.save();
    await tag.populate({
      path: 'sku_items.sku_id',
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
  body('sku_items').optional().isArray(),
  body('sku_items.*.sku_id').optional().isMongoId(),
  body('sku_items.*.quantity').optional().isInt({ min: 1 }),
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

    // If updating sku_items, check availability
    if (updates.sku_items) {
      const availability = await checkAvailableInventory(updates.sku_items);
      const insufficient = availability.filter(a => !a.can_fulfill);
      
      if (insufficient.length > 0) {
        return res.status(400).json({ 
          message: 'Insufficient inventory for updated items',
          insufficient_items: insufficient
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
      path: 'sku_items.sku_id',
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

// Barcode-based partial fulfillment endpoint
router.post('/scan-fulfill', [auth, requireWriteAccess], [
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
  body('scanned_barcodes').isArray({ min: 1 }).withMessage('At least one barcode is required'),
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

    const { customer_name, scanned_barcodes, notes } = req.body;
    
    const results = {
      fulfilled_items: [],
      partially_fulfilled_tags: [],
      fully_fulfilled_tags: [],
      failed_scans: [],
      inventory_reduced: []
    };

    // Process each scanned barcode
    for (const barcode of scanned_barcodes) {
      try {
        // Find SKU by barcode
        const sku = await SKU.findOne({ barcode: barcode.trim() });
        if (!sku) {
          results.failed_scans.push({ barcode, error: 'SKU not found' });
          continue;
        }

        // Find active tags for this customer that contain this SKU
        const tagsWithSku = await Tag.find({
          customer_name: customer_name,
          status: 'active',
          'sku_items.sku_id': sku._id
        });

        if (tagsWithSku.length === 0) {
          results.failed_scans.push({ barcode, error: 'No active tags found for this SKU and customer' });
          continue;
        }

        // Process each tag that contains this SKU
        for (const tag of tagsWithSku) {
          const skuItemIndex = tag.sku_items.findIndex(item => item.sku_id.toString() === sku._id.toString());
          if (skuItemIndex === -1) continue;

          const skuItem = tag.sku_items[skuItemIndex];
          if ((skuItem.remaining_quantity || skuItem.quantity) <= 0) continue;

          // Reduce remaining quantity by 1 for this SKU
          const quantityToReduce = 1;
          const previousRemaining = skuItem.remaining_quantity || skuItem.quantity;
          const newRemaining = Math.max(0, previousRemaining - quantityToReduce);
          
          tag.sku_items[skuItemIndex].remaining_quantity = newRemaining;

          // Update inventory for this specific scan
          const expandedItems = await expandBundleItems(sku._id, quantityToReduce);
          for (const expanded of expandedItems) {
            const item = await Item.findById(expanded.item_id);
            if (item && item.quantity >= expanded.quantity) {
              item.quantity -= expanded.quantity;
              await item.save();
              
              results.inventory_reduced.push({
                barcode: barcode,
                sku_code: sku.sku_code,
                item_id: item._id,
                previous_quantity: item.quantity + expanded.quantity,
                new_quantity: item.quantity,
                reduced_by: expanded.quantity
              });
            }
          }

          // Check if tag is now fully fulfilled
          if (tag.isFullyFulfilled()) {
            tag.status = 'fulfilled';
            tag.notes = `${tag.notes || ''} ${notes || ''} - Fully fulfilled by scanning on ${new Date().toISOString()}`.trim();
            results.fully_fulfilled_tags.push(tag._id);
          } else if (tag.isPartiallyFulfilled()) {
            tag.notes = `${tag.notes || ''} ${notes || ''} - Partially fulfilled by scanning on ${new Date().toISOString()}`.trim();
            results.partially_fulfilled_tags.push({
              tag_id: tag._id,
              sku_id: sku._id,
              sku_code: sku.sku_code,
              remaining: newRemaining,
              original: skuItem.quantity
            });
          }

          await tag.save();
          
          results.fulfilled_items.push({
            barcode: barcode,
            sku_code: sku.sku_code,
            tag_id: tag._id,
            reduced_by: quantityToReduce,
            remaining: newRemaining
          });

          break; // Only fulfill one tag per scan
        }
      } catch (err) {
        results.failed_scans.push({ barcode, error: err.message });
      }
    }

    res.json({
      message: `Scan fulfillment completed. ${results.fulfilled_items.length} items fulfilled, ${results.failed_scans.length} failed.`,
      customer_name,
      results
    });

  } catch (error) {
    console.error('Scan fulfill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send for Install - Complete tag fulfillment
router.post('/send-for-install', [auth, requireWriteAccess], [
  body('customer_name').notEmpty().trim().withMessage('Customer name is required'),
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

    const { customer_name, tag_ids, notes } = req.body;
    
    let tagsToFulfill = [];
    const results = {
      fulfilled: [],
      failed: [],
      inventory_reduced: []
    };

    // Get tags to fulfill
    if (tag_ids && tag_ids.length > 0) {
      tagsToFulfill = await Tag.find({
        _id: { $in: tag_ids },
        customer_name: customer_name,
        status: 'active'
      }).populate({
        path: 'sku_items.sku_id',
        populate: { path: 'product_details' }
      });
    } else {
      tagsToFulfill = await Tag.find({
        customer_name: customer_name,
        status: 'active'
      }).populate({
        path: 'sku_items.sku_id',
        populate: { path: 'product_details' }
      });
    }

    // Process fulfillment
    for (const tag of tagsToFulfill) {
      try {
        // Reduce inventory for all remaining quantities in the tag
        for (const skuItem of tag.sku_items) {
          const remainingQuantity = skuItem.remaining_quantity || skuItem.quantity;
          if (remainingQuantity > 0) {
            const expandedItems = await expandBundleItems(skuItem.sku_id, remainingQuantity);
            
            for (const expanded of expandedItems) {
              const item = await Item.findById(expanded.item_id);
              if (item && item.quantity >= expanded.quantity) {
                item.quantity -= expanded.quantity;
                await item.save();
                
                results.inventory_reduced.push({
                  tag_id: tag._id,
                  sku_id: skuItem.sku_id,
                  item_id: item._id,
                  previous_quantity: item.quantity + expanded.quantity,
                  new_quantity: item.quantity,
                  reduced_by: expanded.quantity
                });
              }
            }
            
            // Set remaining quantity to 0
            skuItem.remaining_quantity = 0;
          }
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
    }).populate({
      path: 'sku_items.sku_id',
      populate: { path: 'product_details' }
    });

    for (const tag of tags) {
      try {
        // Reduce inventory for all remaining quantities in the tag
        for (const skuItem of tag.sku_items) {
          const remainingQuantity = skuItem.remaining_quantity || skuItem.quantity;
          if (remainingQuantity > 0) {
            const expandedItems = await expandBundleItems(skuItem.sku_id, remainingQuantity);
            
            for (const expanded of expandedItems) {
              const item = await Item.findById(expanded.item_id);
              if (item && item.quantity >= expanded.quantity) {
                item.quantity -= expanded.quantity;
                await item.save();
                
                results.inventory_reduced.push({
                  tag_id: tag._id,
                  sku_id: skuItem.sku_id,
                  item_id: item._id,
                  previous_quantity: item.quantity + expanded.quantity,
                  new_quantity: item.quantity,
                  reduced_by: expanded.quantity
                });
              }
            }
            
            // Set remaining quantity to 0
            skuItem.remaining_quantity = 0;
          }
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
          total_sku_items: { $sum: { $size: { $ifNull: ['$sku_items', []] } } },
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
        total_sku_items: c.total_sku_items,
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
          totalSkuItems: { $sum: { $size: { $ifNull: ['$sku_items', []] } } }
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
