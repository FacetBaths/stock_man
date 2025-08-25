const express = require('express');
const { query, body, validationResult } = require('express-validator');
const router = express.Router();
const SKU = require('../models/SKU');
const Tag = require('../models/Tag');
const Inventory = require('../models/Inventory');
const Category = require('../models/Category');
const { auth, requireWriteAccess } = require('../middleware/authEnhanced');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to convert JSON to CSV
function jsonToCsv(data, headers) {
  if (data.length === 0) return '';
  
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      let value = row[header];
      if (value === null || value === undefined) value = '';
      if (typeof value === 'string' && value.includes(',')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return csvHeaders + '\n' + csvRows.join('\n');
}

// GET /api/export/inventory - Export inventory data (SKU-based)
router.get('/inventory',
  auth,
  [
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    query('include_tags').optional().isBoolean().withMessage('Include tags must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';
      const includeTags = req.query.include_tags === 'true';

      // Get all inventory with SKU and category data
      const inventories = await Inventory.find({})
        .populate({
          path: 'sku_id',
          populate: {
            path: 'category_id',
            select: 'name'
          }
        });

      const exportData = [];
      
      for (const inventory of inventories) {
        if (!inventory.sku_id) continue; // Skip if SKU was deleted
        
        const sku = inventory.sku_id;
        const baseRow = {
          sku_id: sku._id.toString(),
          sku_code: sku.sku_code,
          name: sku.name,
          category: sku.category_id?.name || 'Uncategorized',
          brand: sku.brand || '',
          model: sku.model || '',
          description: sku.description || '',
          unit_cost: sku.unit_cost || 0,
          barcode: sku.barcode || '',
          status: sku.status,
          total_quantity: inventory.total_quantity,
          available_quantity: inventory.available_quantity,
          reserved_quantity: inventory.reserved_quantity,
          broken_quantity: inventory.broken_quantity,
          loaned_quantity: inventory.loaned_quantity,
          primary_location: inventory.primary_location || '',
          total_value: inventory.total_value || 0,
          is_low_stock: inventory.is_low_stock,
          is_out_of_stock: inventory.is_out_of_stock,
          created_at: sku.createdAt.toISOString(),
          updated_at: sku.updatedAt.toISOString()
        };

        // Add tag information if requested
        if (includeTags) {
          const tags = await Tag.find({ 
            'sku_items.sku_id': sku._id, 
            status: 'active' 
          });
          
          const tagSummary = {
            active_tags_count: tags.length,
            reserved_in_tags: 0,
            broken_in_tags: 0,
            imperfect_in_tags: 0,
            loaned_in_tags: 0,
            stock_in_tags: 0
          };
          
          tags.forEach(tag => {
            const skuItems = tag.sku_items.filter(skuItem => 
              skuItem.sku_id.toString() === sku._id.toString()
            );
            const totalQuantity = skuItems.reduce((sum, skuItem) => sum + skuItem.quantity, 0);
            
            switch (tag.tag_type) {
              case 'reserved':
                tagSummary.reserved_in_tags += totalQuantity;
                break;
              case 'broken':
                tagSummary.broken_in_tags += totalQuantity;
                break;
              case 'imperfect':
                tagSummary.imperfect_in_tags += totalQuantity;
                break;
              case 'loaned':
                tagSummary.loaned_in_tags += totalQuantity;
                break;
              case 'stock':
                tagSummary.stock_in_tags += totalQuantity;
                break;
            }
          });

          Object.assign(baseRow, tagSummary);
        }

        exportData.push(baseRow);
      }

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="inventory_export_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json({
          export_type: 'inventory',
          export_date: new Date().toISOString(),
          total_records: exportData.length,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Export inventory error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// GET /api/export/skus - Export SKU data
router.get('/skus',
  auth,
  [
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    query('include_cost_history').optional().isBoolean().withMessage('Include cost history must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';
      const includeCostHistory = req.query.include_cost_history === 'true';

      const skus = await SKU.find({}).populate('category_id', 'name');
      const exportData = [];

      for (const sku of skus) {
        const inventory = await Inventory.findOne({ sku_id: sku._id });
        
        const baseRow = {
          sku_id: sku._id.toString(),
          sku_code: sku.sku_code,
          name: sku.name,
          category: sku.category_id?.name || 'Uncategorized',
          brand: sku.brand || '',
          model: sku.model || '',
          description: sku.description || '',
          unit_cost: sku.unit_cost || 0,
          barcode: sku.barcode || '',
          status: sku.status,
          is_bundle: sku.is_bundle || false,
          is_lendable: sku.is_lendable || false,
          total_quantity: inventory?.total_quantity || 0,
          available_quantity: inventory?.available_quantity || 0,
          reserved_quantity: inventory?.reserved_quantity || 0,
          broken_quantity: inventory?.broken_quantity || 0,
          loaned_quantity: inventory?.loaned_quantity || 0,
          created_by: sku.created_by || '',
          created_at: sku.createdAt.toISOString(),
          updated_at: sku.updatedAt.toISOString()
        };

        if (includeCostHistory && sku.cost_history && sku.cost_history.length > 0) {
          // For cost history, create separate rows
          sku.cost_history.forEach((costEntry, index) => {
            const historyRow = { ...baseRow };
            historyRow.cost_history_index = index + 1;
            historyRow.cost_history_cost = costEntry.cost;
            historyRow.cost_history_date = costEntry.effective_date.toISOString();
            historyRow.cost_history_updated_by = costEntry.updated_by;
            historyRow.cost_history_notes = costEntry.notes || '';
            exportData.push(historyRow);
          });
        } else {
          exportData.push(baseRow);
        }
      }

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="skus_export_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json({
          export_type: 'skus',
          export_date: new Date().toISOString(),
          total_records: exportData.length,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Export SKUs error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// GET /api/export/reorder-report - Export reorder report (low stock SKUs)
router.get('/reorder-report',
  auth,
  [
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';

      // Get inventories that need reordering (low stock or out of stock)
      const lowStockInventories = await Inventory.find({
        $or: [
          { is_low_stock: true },
          { is_out_of_stock: true }
        ]
      }).populate({
        path: 'sku_id',
        populate: {
          path: 'category_id',
          select: 'name'
        }
      });

      const exportData = lowStockInventories.map(inventory => {
        if (!inventory.sku_id) return null; // Skip deleted SKUs
        
        const sku = inventory.sku_id;
        const suggestedOrderQty = Math.max(
          (inventory.minimum_stock_level || 10) * 2 - inventory.available_quantity,
          inventory.minimum_stock_level || 10
        );
        
        return {
          sku_id: sku._id.toString(),
          sku_code: sku.sku_code,
          name: sku.name,
          category: sku.category_id?.name || 'Uncategorized',
          brand: sku.brand || '',
          current_available: inventory.available_quantity,
          reserved_quantity: inventory.reserved_quantity,
          minimum_stock_level: inventory.minimum_stock_level || 10,
          suggested_order_qty: suggestedOrderQty,
          unit_cost: sku.unit_cost || 0,
          estimated_total_cost: (sku.unit_cost || 0) * suggestedOrderQty,
          primary_location: inventory.primary_location || '',
          last_movement_date: inventory.last_movement_date || inventory.updatedAt,
          supplier_name: sku.supplier_info?.supplier_name || '',
          supplier_sku: sku.supplier_info?.supplier_sku || '',
          lead_time_days: sku.supplier_info?.lead_time_days || 0
        };
      }).filter(Boolean);

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="reorder_report_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json({
          export_type: 'reorder_report',
          export_date: new Date().toISOString(),
          total_records: exportData.length,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Export reorder report error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// POST /api/export/import/skus - Import SKU data from CSV/JSON
router.post('/import/skus',
  auth,
  requireWriteAccess,
  upload.single('file'),
  [
    body('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    body('update_existing').optional().isBoolean().withMessage('Update existing must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const updateExisting = req.body.update_existing === 'true';
      const results = {
        created: [],
        updated: [],
        failed: [],
        summary: {
          total: 0,
          created: 0,
          updated: 0,
          failed: 0
        }
      };

      let skuData = [];

      // Parse file based on type
      if (req.file.mimetype === 'text/csv') {
        const csvData = [];
        await new Promise((resolve, reject) => {
          fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (row) => csvData.push(row))
            .on('end', resolve)
            .on('error', reject);
        });
        skuData = csvData;
      } else if (req.file.mimetype === 'application/json') {
        const jsonContent = fs.readFileSync(req.file.path, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        skuData = Array.isArray(jsonData) ? jsonData : jsonData.data || [];
      }

      results.summary.total = skuData.length;

      // Process each SKU
      for (const skuRow of skuData) {
        try {
          // Required fields validation
          if (!skuRow.sku_code || !skuRow.name) {
            results.failed.push({
              sku_code: skuRow.sku_code || 'N/A',
              error: 'Missing required fields: sku_code and name are required'
            });
            results.summary.failed++;
            continue;
          }

          // Check if SKU already exists
          const existingSku = await SKU.findOne({ sku_code: skuRow.sku_code.toUpperCase() });
          
          if (existingSku && !updateExisting) {
            results.failed.push({
              sku_code: skuRow.sku_code,
              error: 'SKU already exists and update_existing is false'
            });
            results.summary.failed++;
            continue;
          }

          // Find or create category
          let categoryId = null;
          if (skuRow.category) {
            let category = await Category.findOne({ name: skuRow.category });
            if (!category) {
              category = new Category({
                name: skuRow.category,
                slug: skuRow.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                created_by: req.user.username,
                last_updated_by: req.user.username
              });
              await category.save();
            }
            categoryId = category._id;
          }

          const skuData = {
            sku_code: skuRow.sku_code.toUpperCase(),
            name: skuRow.name,
            category_id: categoryId,
            brand: skuRow.brand || '',
            model: skuRow.model || '',
            description: skuRow.description || '',
            unit_cost: parseFloat(skuRow.unit_cost) || 0,
            barcode: skuRow.barcode || '',
            status: skuRow.status || 'active',
            is_bundle: skuRow.is_bundle === 'true' || skuRow.is_bundle === true,
            is_lendable: skuRow.is_lendable === 'true' || skuRow.is_lendable === true,
            supplier_info: {
              supplier_name: skuRow.supplier_name || '',
              supplier_sku: skuRow.supplier_sku || '',
              lead_time_days: parseInt(skuRow.lead_time_days) || 0
            },
            last_updated_by: req.user.username
          };

          if (!existingSku) {
            skuData.created_by = req.user.username;
          }

          let sku;
          if (existingSku) {
            // Update existing SKU
            Object.assign(existingSku, skuData);
            sku = await existingSku.save();
            results.updated.push({
              sku_code: sku.sku_code,
              name: sku.name,
              action: 'updated'
            });
            results.summary.updated++;
          } else {
            // Create new SKU
            sku = new SKU(skuData);
            await sku.save();
            
            // Create corresponding inventory record
            const inventory = new Inventory({
              sku_id: sku._id,
              available_quantity: parseInt(skuRow.initial_quantity) || 0,
              minimum_stock_level: parseInt(skuRow.minimum_stock_level) || 10,
              primary_location: skuRow.primary_location || 'HQ',
              last_updated_by: req.user.username
            });
            await inventory.save();
            
            results.created.push({
              sku_code: sku.sku_code,
              name: sku.name,
              action: 'created'
            });
            results.summary.created++;
          }
        } catch (error) {
          results.failed.push({
            sku_code: skuRow.sku_code || 'N/A',
            error: error.message
          });
          results.summary.failed++;
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'SKU import completed',
        results
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Import SKUs error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;
