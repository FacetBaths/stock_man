const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const Category = require('../models/Category');
const { auth, requireWriteAccess } = require('../middleware/authEnhanced');

// Validation middleware for category creation/updates
const validateCategory = [
  body('name')
    .notEmpty()
    .withMessage('Category name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('type')
    .optional()
    .isIn(['product', 'tool'])
    .withMessage('Type must be either product or tool'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('attributes')
    .optional()
    .isArray()
    .withMessage('Attributes must be an array'),
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive')
];

// GET /api/categories - Get all categories with optional filtering
router.get('/', 
  auth,
  [
    query('active_only').optional().isBoolean().withMessage('active_only must be a boolean'),
    query('parent_id').optional().custom((value) => {
      if (value === 'null' || value === '') return true;
      return value.match(/^[0-9a-fA-F]{24}$/);
    }).withMessage('parent_id must be a valid MongoDB ID or null'),
    query('include_children').optional().isBoolean().withMessage('include_children must be a boolean'),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      console.log('🔍 [Categories API] Request received:', {
        query: req.query,
        url: req.url
      })
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ [Categories API] Validation failed:', errors.array())
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Build filter
      const filter = {};
      
      if (req.query.active_only === 'true') {
        filter.status = 'active';
        console.log('✅ [Categories API] Adding active filter: status = active')
      }
      
      if (req.query.parent_id) {
        if (req.query.parent_id === 'null' || req.query.parent_id === '') {
          filter.parent_id = null;
        } else {
          filter.parent_id = req.query.parent_id;
        }
      }
      
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      console.log('🔎 [Categories API] Final filter object:', filter)

      let query = Category.find(filter).sort({ sort_order: 1, name: 1 });
      
      // TODO: 2025-01-04 - Remove children population (schema doesn't support it)
      // Commented out to fix 500 error - can delete after 2025-02-04 if not needed
      // if (req.query.include_children === 'true') {
      //   query = query.populate('children');
      // }

      const categories = await query;
      console.log('📦 [Categories API] Query result:', {
        count: categories.length,
        categories: categories.map(c => ({ _id: c._id, name: c.name, status: c.status }))
      })

      // TODO: 2025-01-04 - Disabled hierarchy building (schema doesn't support it)
      // Commented out to fix 500 error - can delete after 2025-02-04 if not needed
      // if (req.query.parent_id === 'null' && req.query.include_children === 'true') {
      //   // Build hierarchical structure
      //   const hierarchical = await Category.buildHierarchy();
      //   console.log('🌳 [Categories API] Returning hierarchy')
      //   return res.json({ categories: hierarchical });
      // }

      console.log('✅ [Categories API] Returning categories:', categories.length)
      res.json({ categories });

    } catch (error) {
      console.error('❌ [Categories API] Error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch categories', 
        error: error.message 
      });
    }
  }
);

// GET /api/categories/:id - Get a single category by ID
router.get('/:id', 
  auth,
  [
    param('id').isMongoId().withMessage('Invalid category ID')
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

      const category = await Category.findById(req.params.id);

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Get category statistics
      const stats = await category.getStatistics();

      res.json({ 
        category: {
          ...category.toObject(),
          stats
        }
      });

    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch category', 
        error: error.message 
      });
    }
  }
);

// POST /api/categories - Create a new category
router.post('/', 
  auth,
  requireWriteAccess,
  validateCategory,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const categoryData = {
        name: req.body.name,
        type: req.body.type || 'product',
        description: req.body.description || '',
        attributes: req.body.attributes || [],
        sort_order: req.body.sort_order || 0,
        status: req.body.status || 'active'
      };

      const category = new Category(categoryData);
      await category.save();

      // No need for population - all fields are native to the schema

      res.status(201).json({ 
        message: 'Category created successfully',
        category 
      });

    } catch (error) {
      console.error('Create category error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({ 
          message: `Category with this ${field} already exists` 
        });
      }

      res.status(500).json({ 
        message: 'Failed to create category', 
        error: error.message 
      });
    }
  }
);

// PUT /api/categories/:id - Update a category
router.put('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid category ID'),
    ...validateCategory
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

      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Prepare update data
      const updateData = {};

      // Only update provided fields that match our schema
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.type !== undefined) updateData.type = req.body.type;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.attributes !== undefined) updateData.attributes = req.body.attributes;
      if (req.body.sort_order !== undefined) updateData.sort_order = req.body.sort_order;
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({ 
        message: 'Category updated successfully',
        category: updatedCategory 
      });

    } catch (error) {
      console.error('Update category error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({ 
          message: `Category with this ${field} already exists` 
        });
      }

      res.status(500).json({ 
        message: 'Failed to update category', 
        error: error.message 
      });
    }
  }
);

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', 
  auth,
  requireWriteAccess,
  [
    param('id').isMongoId().withMessage('Invalid category ID')
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

      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Check if category can be safely deleted
      const canDelete = await category.canBeDeleted();
      if (!canDelete.allowed) {
        return res.status(400).json({ 
          message: 'Cannot delete category', 
          reason: canDelete.reason,
          details: canDelete.details
        });
      }

      await Category.findByIdAndDelete(req.params.id);

      res.json({ 
        message: 'Category deleted successfully',
        deletedCategory: {
          _id: category._id,
          name: category.name,
          type: category.type
        }
      });

    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({ 
        message: 'Failed to delete category', 
        error: error.message 
      });
    }
  }
);

// TODO: 2025-01-04 - Remove hierarchy tree endpoint (schema doesn't support it)
// Commented out to fix 500 error - can delete after 2025-02-04 if not needed
// router.get('/hierarchy/tree', 
//   auth,
//   async (req, res) => {
//     try {
//       const hierarchy = await Category.buildHierarchy();
//       
//       res.json({ 
//         hierarchy,
//         message: 'Category hierarchy retrieved successfully'
//       });
//
//     } catch (error) {
//       console.error('Get category hierarchy error:', error);
//       res.status(500).json({ 
//         message: 'Failed to fetch category hierarchy', 
//         error: error.message 
//       });
//     }
//   }
// );

module.exports = router;
