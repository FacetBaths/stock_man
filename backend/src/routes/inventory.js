const express = require('express');
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const Wall = require('../models/Wall');
const { Toilet, Base, Tub, Vanity, ShowerDoor, RawMaterial, Accessory, Miscellaneous } = require('../models/Product');
const { auth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

// Get all inventory items with optional filtering
router.get('/', auth, async (req, res) => {
  try {
    const { 
      product_type, 
      search, 
      page = 1, 
      limit = 50,
      in_stock_only = false 
    } = req.query;

    let query = {};
    
    // Filter by product type if specified
    if (product_type && product_type !== 'all') {
      query.product_type = product_type;
    }

    // Filter for in-stock items only
    if (in_stock_only === 'true') {
      query.quantity = { $gt: 0 };
    }

    let items = await Item.find(query)
      .populate('product_details')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    // Add tag information to each item
    const Tag = require('../models/Tag');
    const itemIds = items.map(item => item._id);
    const activeTags = await Tag.find({
      item_id: { $in: itemIds },
      status: 'active'
    }).lean();
    
    // Group tags by item ID
    const tagsByItem = activeTags.reduce((acc, tag) => {
      const itemId = tag.item_id.toString();
      if (!acc[itemId]) acc[itemId] = [];
      acc[itemId].push(tag);
      return acc;
    }, {});
    
    // Add tag info to each item
    items = items.map(item => {
      const itemId = item._id.toString();
      const tags = tagsByItem[itemId] || [];
      
      // Calculate tag summary
      const tagSummary = {
        reserved: tags.filter(tag => tag.tag_type === 'reserved').reduce((sum, tag) => sum + tag.quantity, 0),
        broken: tags.filter(tag => tag.tag_type === 'broken').reduce((sum, tag) => sum + tag.quantity, 0),
        imperfect: tags.filter(tag => tag.tag_type === 'imperfect').reduce((sum, tag) => sum + tag.quantity, 0),
        stock: tags.filter(tag => tag.tag_type === 'stock').reduce((sum, tag) => sum + tag.quantity, 0),
        totalTagged: tags.reduce((sum, tag) => sum + tag.quantity, 0)
      };
      
      return {
        ...item,
        tagSummary,
        tags: tags.length > 0 ? tags : undefined
      };
    });

    // If search query is provided, filter results
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      items = items.filter(item => {
        const details = item.product_details;
        if (!details) return false;

        // Search in different fields based on product type
        if (item.product_type === 'wall') {
          return (
            details.product_line?.toLowerCase().includes(searchTerm) ||
            details.color_name?.toLowerCase().includes(searchTerm) ||
            details.dimensions?.toLowerCase().includes(searchTerm) ||
            details.finish?.toLowerCase().includes(searchTerm)
          );
        } else {
          return (
            details.name?.toLowerCase().includes(searchTerm) ||
            details.brand?.toLowerCase().includes(searchTerm) ||
            details.model?.toLowerCase().includes(searchTerm) ||
            details.color?.toLowerCase().includes(searchTerm) ||
            details.dimensions?.toLowerCase().includes(searchTerm) ||
            details.finish?.toLowerCase().includes(searchTerm) ||
            details.description?.toLowerCase().includes(searchTerm)
          );
        }
      });
    }

    const totalItems = await Item.countDocuments(query);

    res.json({
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page)
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get inventory statistics
router.get('/stats', auth, async (req, res) => {
  try {
    console.log('Fetching inventory stats...');
    console.log('MongoDB connection state:', require('mongoose').connection.readyState);
    
    const stats = await Item.aggregate([
      {
        $group: {
          _id: '$product_type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          inStock: {
            $sum: {
              $cond: [{ $gt: ['$quantity', 0] }, 1, 0]
            }
          }
        }
      }
    ]);
    console.log('Stats aggregation result:', stats);

    const totalItems = await Item.countDocuments();
    const totalInStock = await Item.countDocuments({ quantity: { $gt: 0 } });
    
    // Get the most recently updated item for "Last Updated" timestamp
    const lastUpdatedItem = await Item.findOne().sort({ updatedAt: -1 }).lean();
    const lastUpdated = lastUpdatedItem ? lastUpdatedItem.updatedAt : null;
    
    // Calculate total monetary value of inventory
    const totalValueAggregation = await Item.aggregate([
      {
        $match: {
          cost: { $exists: true, $ne: null, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: {
              $multiply: ['$cost', '$quantity']
            }
          },
          itemsWithCost: { $sum: 1 },
          totalQuantityWithCost: { $sum: '$quantity' }
        }
      }
    ]);
    
    const totalValue = totalValueAggregation.length > 0 ? totalValueAggregation[0].totalValue : 0;
    const itemsWithCost = totalValueAggregation.length > 0 ? totalValueAggregation[0].itemsWithCost : 0;
    const totalQuantityWithCost = totalValueAggregation.length > 0 ? totalValueAggregation[0].totalQuantityWithCost : 0;
    
    // Calculate tag-based status counts
    const Tag = require('../models/Tag');
    const tagStats = await Tag.aggregate([
      {
        $match: {
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$tag_type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          uniqueItems: { $addToSet: '$item_id' }
        }
      },
      {
        $addFields: {
          uniqueItemCount: { $size: '$uniqueItems' }
        }
      },
      {
        $project: {
          uniqueItems: 0
        }
      }
    ]);
    
    const tagStatusSummary = {
      broken: tagStats.find(stat => stat._id === 'broken') || { count: 0, totalQuantity: 0, uniqueItemCount: 0 },
      imperfect: tagStats.find(stat => stat._id === 'imperfect') || { count: 0, totalQuantity: 0, uniqueItemCount: 0 },
      reserved: tagStats.find(stat => stat._id === 'reserved') || { count: 0, totalQuantity: 0, uniqueItemCount: 0 }
    };
    
    console.log('Total items:', totalItems, 'In stock:', totalInStock, 'Last updated:', lastUpdated);
    console.log('Total monetary value:', totalValue, 'Items with cost:', itemsWithCost);
    console.log('Tag status summary:', tagStatusSummary);

    res.json({
      totalItems,
      totalInStock,
      byProductType: stats,
      lastUpdated,
      totalValue,
      itemsWithCost,
      totalQuantityWithCost,
      tagStatus: tagStatusSummary
    });

  } catch (error) {
    console.error('Get stats error:', error);
    console.error('Error stack:', error.stack);
    console.error('MongoDB connection state:', require('mongoose').connection.readyState);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      debug: {
        mongoState: require('mongoose').connection.readyState,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Add new inventory item
router.post('/', [auth, requireWriteAccess], [
  body('product_type').isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous']),
  body('quantity').isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_type, product_details, quantity, location, notes, cost } = req.body;

    // Create the product details first
    let productDetailsDoc;
    
    switch (product_type) {
      case 'wall':
        productDetailsDoc = new Wall(product_details);
        break;
      case 'toilet':
        productDetailsDoc = new Toilet(product_details);
        break;
      case 'base':
        productDetailsDoc = new Base(product_details);
        break;
      case 'tub':
        productDetailsDoc = new Tub(product_details);
        break;
      case 'vanity':
        productDetailsDoc = new Vanity(product_details);
        break;
      case 'shower_door':
        productDetailsDoc = new ShowerDoor(product_details);
        break;
      case 'raw_material':
        productDetailsDoc = new RawMaterial(product_details);
        break;
      case 'accessory':
        productDetailsDoc = new Accessory(product_details);
        break;
      case 'miscellaneous':
        productDetailsDoc = new Miscellaneous(product_details);
        break;
      default:
        return res.status(400).json({ message: 'Invalid product type' });
    }

    await productDetailsDoc.save();

    // Create the inventory item
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
    
    const item = new Item({
      product_type,
      product_details: productDetailsDoc._id,
      product_type_model: typeMapping[product_type],
      quantity,
      location: location || '',
      notes: notes || '',
      // Only allow admin and warehouse_manager to set cost
      cost: (req.user.role === 'admin' || req.user.role === 'warehouse_manager') ? (cost || 0) : 0
    });

    await item.save();
    await item.populate('product_details');

    res.status(201).json({
      message: 'Item added successfully',
      item
    });

  } catch (error) {
    console.error('Add item error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Item with these details already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update inventory item
router.put('/:id', [auth, requireWriteAccess], [
  body('quantity').optional().isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const item = await Item.findById(id).populate('product_details');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update item fields
    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.location !== undefined) item.location = updates.location;
    if (updates.notes !== undefined) item.notes = updates.notes;
    
    // Only allow admin and warehouse_manager to update cost
    if (updates.cost !== undefined && (req.user.role === 'admin' || req.user.role === 'warehouse_manager')) {
      item.cost = updates.cost;
    }

    // Update product details if provided
    if (updates.product_details) {
      Object.assign(item.product_details, updates.product_details);
      await item.product_details.save();
    }

    await item.save();
    await item.populate('product_details');

    res.json({
      message: 'Item updated successfully',
      item
    });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Use/consume items for installation
router.post('/:id/use', [auth, requireWriteAccess], [
  body('quantity_used').isNumeric().isInt({ min: 1 }).withMessage('Quantity used must be a positive integer'),
  body('used_for').notEmpty().trim().withMessage('Usage description is required'),
  body('location').optional().trim(),
  body('project_name').optional().trim(),
  body('customer_name').optional().trim(),
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

    const { id } = req.params;
    const usageData = {
      ...req.body,
      used_by: req.user.username
    };

    const item = await Item.findById(id).populate('product_details');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if we have enough quantity
    if (usageData.quantity_used > item.quantity) {
      return res.status(400).json({ 
        message: `Cannot use ${usageData.quantity_used} items. Only ${item.quantity} available.` 
      });
    }

    // Use the items
    item.useItems(usageData);
    await item.save();

    res.json({
      message: `Successfully used ${usageData.quantity_used} items for: ${usageData.used_for}`,
      item,
      usage: item.usage_history[item.usage_history.length - 1] // Return the latest usage entry
    });

  } catch (error) {
    console.error('Use item error:', error);
    if (error.message && error.message.startsWith('Cannot use')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get usage history for an item
router.get('/:id/usage', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await Item.findById(id)
      .select('usage_history product_type')
      .populate('product_details', 'name product_line color_name brand model');
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Calculate total used
    const totalUsed = item.getTotalUsed();
    
    res.json({
      item_id: item._id,
      product_info: item.product_details,
      product_type: item.product_type,
      usage_history: item.usage_history.sort((a, b) => new Date(b.used_date) - new Date(a.used_date)),
      total_used: totalUsed
    });

  } catch (error) {
    console.error('Get usage history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete inventory item
router.delete('/:id', [auth, requireWriteAccess], async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Delete the product details document
    const ModelMap = {
      'Wall': Wall,
      'Toilet': Toilet,
      'Base': Base,
      'Tub': Tub,
      'Vanity': Vanity,
      'ShowerDoor': ShowerDoor,
      'RawMaterial': RawMaterial,
      'Accessory': Accessory,
      'Miscellaneous': Miscellaneous
    };

    const ProductModel = ModelMap[item.product_type_model];
    if (ProductModel) {
      await ProductModel.findByIdAndDelete(item.product_details);
    }

    // Delete the item
    await Item.findByIdAndDelete(id);

    res.json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
