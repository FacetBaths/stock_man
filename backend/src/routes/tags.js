const express = require('express');
const { body, validationResult } = require('express-validator');
const Tag = require('../models/Tag');
const Item = require('../models/Item');
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
