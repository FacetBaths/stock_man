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

    const totalItems = await Item.countDocuments();
    const totalInStock = await Item.countDocuments({ quantity: { $gt: 0 } });

    res.json({
      totalItems,
      totalInStock,
      byProductType: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
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

    const { product_type, product_details, quantity, location, notes } = req.body;

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
      notes: notes || ''
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
