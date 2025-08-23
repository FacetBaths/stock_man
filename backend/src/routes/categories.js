const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const Category = require('../models/Category');
const { auth, requireWriteAccess } = require('../middleware/auth');

// Validation middleware for category creation/updates
const validateCategory = [
  body('name')
    .notEmpty()
    .withMessage('Category name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('parent_id')
    .optional()
    .isMongoId()
    .withMessage('Parent ID must be a valid MongoDB ID'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

// Helper function to generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Build filter
      const filter = {};
      
      if (req.query.active_only === 'true') {
        filter.is_active = true;
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

      let query = Category.find(filter).sort({ sort_order: 1, name: 1 });
      
      if (req.query.include_children === 'true') {
        query = query.populate('children');
      }

      const categories = await query;

      // If requesting top-level categories with children, build hierarchy
      if (req.query.parent_id === 'null' && req.query.include_children === 'true') {
        // Build hierarchical structure
        const hierarchical = await Category.buildHierarchy();
        return res.json({ categories: hierarchical });
      }

      res.json({ categories });

    } catch (error) {
      console.error('Get categories error:', error);
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

      const category = await Category.findById(req.params.id)
        .populate('parent_id', 'name slug')
        .populate('children');

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
        slug: req.body.slug || generateSlug(req.body.name),
        description: req.body.description || '',
        parent_id: req.body.parent_id || null,
        is_active: req.body.is_active !== false, // Default to true
        sort_order: req.body.sort_order || 0,
        metadata: req.body.metadata || {},
        created_by: req.user.username,
        last_updated_by: req.user.username
      };

      // Check if slug already exists
      const existingCategory = await Category.findOne({ slug: categoryData.slug });
      if (existingCategory) {
        return res.status(400).json({ 
          message: 'A category with this slug already exists' 
        });
      }

      // If parent_id is provided, verify it exists
      if (categoryData.parent_id) {
        const parentCategory = await Category.findById(categoryData.parent_id);
        if (!parentCategory) {
          return res.status(400).json({ 
            message: 'Parent category not found' 
          });
        }
        
        // Check for circular references
        if (await parentCategory.hasAncestor(categoryData.parent_id)) {
          return res.status(400).json({ 
            message: 'Cannot create circular reference in category hierarchy' 
          });
        }
      }

      const category = new Category(categoryData);
      await category.save();

      // Populate relations before returning
      await category.populate([
        { path: 'parent_id', select: 'name slug' },
        { path: 'children', select: 'name slug' }
      ]);

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
      const updateData = {
        last_updated_by: req.user.username
      };

      // Only update provided fields
      if (req.body.name !== undefined) {
        updateData.name = req.body.name;
        
        // Auto-generate slug if not provided but name changed
        if (!req.body.slug && req.body.name !== category.name) {
          updateData.slug = generateSlug(req.body.name);
        }
      }
      
      if (req.body.slug !== undefined) {
        updateData.slug = req.body.slug;
        
        // Check if new slug conflicts with existing categories
        const existingCategory = await Category.findOne({ 
          slug: req.body.slug, 
          _id: { $ne: req.params.id } 
        });
        if (existingCategory) {
          return res.status(400).json({ 
            message: 'A category with this slug already exists' 
          });
        }
      }

      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;
      if (req.body.sort_order !== undefined) updateData.sort_order = req.body.sort_order;
      if (req.body.metadata !== undefined) updateData.metadata = req.body.metadata;

      // Handle parent_id change
      if (req.body.parent_id !== undefined) {
        if (req.body.parent_id) {
          // Verify new parent exists
          const parentCategory = await Category.findById(req.body.parent_id);
          if (!parentCategory) {
            return res.status(400).json({ 
              message: 'Parent category not found' 
            });
          }

          // Check for circular references
          if (req.body.parent_id === req.params.id) {
            return res.status(400).json({ 
              message: 'Category cannot be its own parent' 
            });
          }

          if (await parentCategory.hasAncestor(req.params.id)) {
            return res.status(400).json({ 
              message: 'Cannot create circular reference in category hierarchy' 
            });
          }
        }
        
        updateData.parent_id = req.body.parent_id || null;
      }

      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate([
        { path: 'parent_id', select: 'name slug' },
        { path: 'children', select: 'name slug' }
      ]);

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
          slug: category.slug
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

// GET /api/categories/hierarchy - Get full category hierarchy
router.get('/hierarchy/tree', 
  auth,
  async (req, res) => {
    try {
      const hierarchy = await Category.buildHierarchy();
      
      res.json({ 
        hierarchy,
        message: 'Category hierarchy retrieved successfully'
      });

    } catch (error) {
      console.error('Get category hierarchy error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch category hierarchy', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
