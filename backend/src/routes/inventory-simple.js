const express = require('express');
const { body, validationResult } = require('express-validator');
const { readData, writeData, generateId } = require('../config/jsonDB');
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

    const data = readData();
    let items = data.items.map(item => ({
      ...item,
      product_details: getProductDetails(item.product_type, item.product_details_id, data)
    }));

    // Filter by product type
    if (product_type && product_type !== 'all') {
      items = items.filter(item => item.product_type === product_type);
    }

    // Filter for in-stock items only
    if (in_stock_only === 'true') {
      items = items.filter(item => item.quantity > 0);
    }

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      items = items.filter(item => {
        const details = item.product_details;
        if (!details) return false;

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

    const totalItems = items.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      items: paginatedItems,
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
    const data = readData();
    const items = data.items;

    const stats = {};
    let totalInStock = 0;

    items.forEach(item => {
      if (!stats[item.product_type]) {
        stats[item.product_type] = {
          _id: item.product_type,
          count: 0,
          totalQuantity: 0,
          inStock: 0
        };
      }

      stats[item.product_type].count++;
      stats[item.product_type].totalQuantity += item.quantity;
      
      if (item.quantity > 0) {
        stats[item.product_type].inStock++;
        totalInStock++;
      }
    });

    res.json({
      totalItems: items.length,
      totalInStock,
      byProductType: Object.values(stats)
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new inventory item
router.post('/', [auth, requireWriteAccess], [
  body('product_type').isIn(['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door']),
  body('quantity').isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_type, product_details, quantity, location, notes } = req.body;
    const data = readData();

    // Create product details
    const productDetailsId = generateId();
    const collectionMap = {
      'wall': 'walls',
      'toilet': 'toilets',
      'base': 'bases',
      'tub': 'tubs',
      'vanity': 'vanities',
      'shower_door': 'showerDoors'
    };

    const collection = collectionMap[product_type];
    data[collection].push({
      _id: productDetailsId,
      ...product_details,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create inventory item
    const itemId = generateId();
    const newItem = {
      _id: itemId,
      product_type,
      product_details_id: productDetailsId,
      quantity,
      location: location || '',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.items.push(newItem);
    writeData(data);

    // Return item with populated product details
    const responseItem = {
      ...newItem,
      product_details: getProductDetails(product_type, productDetailsId, data)
    };

    res.status(201).json({
      message: 'Item added successfully',
      item: responseItem
    });

  } catch (error) {
    console.error('Add item error:', error);
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
    const data = readData();

    const itemIndex = data.items.findIndex(item => item._id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const item = data.items[itemIndex];

    // Update item fields
    if (updates.quantity !== undefined) item.quantity = updates.quantity;
    if (updates.location !== undefined) item.location = updates.location;
    if (updates.notes !== undefined) item.notes = updates.notes;
    item.updatedAt = new Date().toISOString();

    // Update product details if provided
    if (updates.product_details) {
      const collectionMap = {
        'wall': 'walls',
        'toilet': 'toilets',
        'base': 'bases',
        'tub': 'tubs',
        'vanity': 'vanities',
        'shower_door': 'showerDoors'
      };

      const collection = collectionMap[item.product_type];
      const productIndex = data[collection].findIndex(p => p._id === item.product_details_id);
      
      if (productIndex !== -1) {
        Object.assign(data[collection][productIndex], updates.product_details);
        data[collection][productIndex].updatedAt = new Date().toISOString();
      }
    }

    writeData(data);

    const responseItem = {
      ...item,
      product_details: getProductDetails(item.product_type, item.product_details_id, data)
    };

    res.json({
      message: 'Item updated successfully',
      item: responseItem
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
    const data = readData();

    const itemIndex = data.items.findIndex(item => item._id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const item = data.items[itemIndex];

    // Remove product details
    const collectionMap = {
      'wall': 'walls',
      'toilet': 'toilets',
      'base': 'bases',
      'tub': 'tubs',
      'vanity': 'vanities',
      'shower_door': 'showerDoors'
    };

    const collection = collectionMap[item.product_type];
    const productIndex = data[collection].findIndex(p => p._id === item.product_details_id);
    
    if (productIndex !== -1) {
      data[collection].splice(productIndex, 1);
    }

    // Remove item
    data.items.splice(itemIndex, 1);
    writeData(data);

    res.json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get product details
function getProductDetails(productType, productDetailsId, data) {
  const collectionMap = {
    'wall': 'walls',
    'toilet': 'toilets',
    'base': 'bases',
    'tub': 'tubs',
    'vanity': 'vanities',
    'shower_door': 'showerDoors'
  };

  const collection = collectionMap[productType];
  return data[collection].find(p => p._id === productDetailsId) || null;
}

module.exports = router;
