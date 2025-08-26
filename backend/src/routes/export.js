const express = require('express');
const { query, body, validationResult } = require('express-validator');
const router = express.Router();
const SKU = require('../models/SKU');
const Tag = require('../models/Tag');
const Inventory = require('../models/Inventory');
const Category = require('../models/Category');
const Instance = require('../models/Instance');
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

// GET /api/export/instances - Export Instance data with cost tracking
router.get('/instances',
  auth,
  [
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    query('include_sku_details').optional().isBoolean().withMessage('Include SKU details must be boolean'),
    query('sku_id').optional().isMongoId().withMessage('SKU ID must be valid')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';
      const includeSKUDetails = req.query.include_sku_details !== 'false';
      const skuId = req.query.sku_id;

      // Build query filter
      const filter = {};
      if (skuId) {
        filter.sku_id = skuId;
      }

      // Get all instances with SKU data
      let query = Instance.find(filter);
      if (includeSKUDetails) {
        query = query.populate({
          path: 'sku_id',
          populate: {
            path: 'category_id',
            select: 'name'
          }
        }).populate('tag_id', 'project_name customer_name tag_type status');
      }

      const instances = await query.sort({ acquisition_date: -1 });
      const exportData = [];

      for (const instance of instances) {
        const baseRow = {
          instance_id: instance._id.toString(),
          sku_id: instance.sku_id?._id?.toString() || instance.sku_id.toString(),
          acquisition_date: instance.acquisition_date.toISOString().split('T')[0],
          acquisition_cost: instance.acquisition_cost,
          location: instance.location || '',
          supplier: instance.supplier || '',
          reference_number: instance.reference_number || '',
          notes: instance.notes || '',
          added_by: instance.added_by || '',
          tag_id: instance.tag_id?._id?.toString() || instance.tag_id?.toString() || '',
          is_available: !instance.tag_id,
          created_at: instance.createdAt.toISOString(),
          updated_at: instance.updatedAt.toISOString()
        };

        // Add SKU details if populated
        if (includeSKUDetails && instance.sku_id && instance.sku_id.sku_code) {
          baseRow.sku_code = instance.sku_id.sku_code;
          baseRow.sku_name = instance.sku_id.name;
          baseRow.category = instance.sku_id.category_id?.name || 'Uncategorized';
          baseRow.brand = instance.sku_id.brand || '';
          baseRow.model = instance.sku_id.model || '';
        }

        // Add tag details if populated
        if (instance.tag_id && instance.tag_id.project_name) {
          baseRow.tag_project = instance.tag_id.project_name;
          baseRow.tag_customer = instance.tag_id.customer_name;
          baseRow.tag_type = instance.tag_id.tag_type;
          baseRow.tag_status = instance.tag_id.status;
        }

        exportData.push(baseRow);
      }

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="instances_export_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json({
          export_type: 'instances',
          export_date: new Date().toISOString(),
          total_records: exportData.length,
          filter_applied: skuId ? { sku_id: skuId } : null,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Export instances error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// GET /api/export/system-backup - Export complete system data for backup
router.get('/system-backup',
  auth,
  async (req, res) => {
    try {
      console.log('=== SYSTEM BACKUP EXPORT STARTED ===')
      
      // Get all data with relationships
      const [categories, skus, instances, inventories, tags] = await Promise.all([
        Category.find({}).sort({ name: 1 }),
        SKU.find({}).populate('category_id', 'name').sort({ sku_code: 1 }),
        Instance.find({}).populate('sku_id', 'sku_code name').populate('tag_id', 'project_name').sort({ acquisition_date: -1 }),
        Inventory.find({}).populate('sku_id', 'sku_code name').sort({ 'sku_id.sku_code': 1 }),
        Tag.find({}).populate('sku_items.sku_id', 'sku_code name').sort({ createdAt: -1 })
      ]);

      const backupData = {
        backup_info: {
          export_date: new Date().toISOString(),
          version: '1.0',
          exported_by: req.user?.username || 'system',
          total_records: {
            categories: categories.length,
            skus: skus.length,
            instances: instances.length,
            inventories: inventories.length,
            tags: tags.length
          }
        },
        categories: categories,
        skus: skus,
        instances: instances,
        inventories: inventories,
        tags: tags
      };

      console.log(`System backup: ${categories.length} categories, ${skus.length} SKUs, ${instances.length} instances, ${inventories.length} inventories, ${tags.length} tags`);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="system_backup_${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backupData);
    } catch (error) {
      console.error('System backup export error:', error);
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

// POST /api/export/import/stock - Import bulk stock (Instance) data from CSV/JSON
router.post('/import/stock',
  auth,
  requireWriteAccess,
  upload.single('file'),
  [
    body('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    body('conflict_resolution').optional().isIn(['skip', 'update', 'duplicate']).withMessage('Conflict resolution must be skip, update, or duplicate')
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

      const conflictResolution = req.body.conflict_resolution || 'skip';
      const results = {
        created: [],
        updated: [],
        skipped: [],
        failed: [],
        summary: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          inventory_updated: 0
        }
      };

      let stockData = [];

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
        stockData = csvData;
      } else if (req.file.mimetype === 'application/json') {
        const jsonContent = fs.readFileSync(req.file.path, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        stockData = Array.isArray(jsonData) ? jsonData : jsonData.data || [];
      }

      results.summary.total = stockData.length;
      const updatedSKUs = new Set(); // Track which SKU inventories need updating

      // Process each stock entry
      for (const stockRow of stockData) {
        try {
          // Required fields validation
          if (!stockRow.sku_code && !stockRow.sku_id) {
            results.failed.push({
              reference: stockRow.reference_number || 'N/A',
              error: 'Missing required field: sku_code or sku_id is required'
            });
            results.summary.failed++;
            continue;
          }

          // Find SKU by code or ID
          let sku;
          if (stockRow.sku_code) {
            sku = await SKU.findOne({ sku_code: stockRow.sku_code.toUpperCase() });
          } else if (stockRow.sku_id) {
            sku = await SKU.findById(stockRow.sku_id);
          }

          if (!sku) {
            results.failed.push({
              reference: stockRow.reference_number || stockRow.sku_code || stockRow.sku_id,
              error: 'SKU not found'
            });
            results.summary.failed++;
            continue;
          }

          // Check for existing instance if reference number provided
          let existingInstance = null;
          if (stockRow.reference_number) {
            existingInstance = await Instance.findOne({
              sku_id: sku._id,
              reference_number: stockRow.reference_number
            });
          }

          if (existingInstance) {
            if (conflictResolution === 'skip') {
              results.skipped.push({
                reference: stockRow.reference_number,
                sku_code: sku.sku_code,
                reason: 'Instance with reference number already exists'
              });
              results.summary.skipped++;
              continue;
            } else if (conflictResolution === 'update') {
              // Update existing instance
              existingInstance.acquisition_date = stockRow.acquisition_date ? new Date(stockRow.acquisition_date) : existingInstance.acquisition_date;
              existingInstance.acquisition_cost = stockRow.acquisition_cost ? parseFloat(stockRow.acquisition_cost) : existingInstance.acquisition_cost;
              existingInstance.location = stockRow.location || existingInstance.location;
              existingInstance.supplier = stockRow.supplier || existingInstance.supplier;
              existingInstance.notes = stockRow.notes || existingInstance.notes;
              existingInstance.added_by = req.user.username;
              
              await existingInstance.save();
              
              results.updated.push({
                instance_id: existingInstance._id.toString(),
                reference: stockRow.reference_number,
                sku_code: sku.sku_code,
                action: 'updated'
              });
              results.summary.updated++;
              continue;
            }
            // If 'duplicate', continue to create new instance
          }

          // Create new instance
          const instanceData = {
            sku_id: sku._id,
            acquisition_date: stockRow.acquisition_date ? new Date(stockRow.acquisition_date) : new Date(),
            acquisition_cost: parseFloat(stockRow.acquisition_cost) || sku.unit_cost || 0,
            location: stockRow.location || 'HQ',
            supplier: stockRow.supplier || '',
            reference_number: stockRow.reference_number || '',
            notes: stockRow.notes || '',
            added_by: req.user.username
          };

          const instance = new Instance(instanceData);
          await instance.save();
          
          results.created.push({
            instance_id: instance._id.toString(),
            reference: instance.reference_number,
            sku_code: sku.sku_code,
            action: 'created'
          });
          results.summary.created++;
          
          // Mark SKU for inventory update
          updatedSKUs.add(sku._id.toString());
          
        } catch (error) {
          results.failed.push({
            reference: stockRow.reference_number || 'N/A',
            error: error.message
          });
          results.summary.failed++;
        }
      }

      // Update inventory counts for affected SKUs
      for (const skuId of updatedSKUs) {
        try {
          const instanceCount = await Instance.countDocuments({ 
            sku_id: skuId, 
            tag_id: { $exists: false } 
          });
          
          await Inventory.findOneAndUpdate(
            { sku_id: skuId },
            { 
              $set: { 
                available_quantity: instanceCount,
                total_quantity: await Instance.countDocuments({ sku_id: skuId }),
                last_updated_by: req.user.username 
              } 
            },
            { upsert: true }
          );
          
          results.summary.inventory_updated++;
        } catch (error) {
          console.error(`Failed to update inventory for SKU ${skuId}:`, error);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'Stock import completed',
        results
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Import stock error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// POST /api/export/import/system-restore - Restore complete system from backup
router.post('/import/system-restore',
  auth,
  requireWriteAccess,
  upload.single('file'),
  [
    body('restore_mode').optional().isIn(['replace', 'merge']).withMessage('Restore mode must be replace or merge'),
    body('confirm_destructive').optional().isBoolean().withMessage('Confirm destructive must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No backup file uploaded' });
      }

      const restoreMode = req.body.restore_mode || 'merge';
      const confirmDestructive = req.body.confirm_destructive === 'true';
      
      if (restoreMode === 'replace' && !confirmDestructive) {
        return res.status(400).json({ 
          message: 'Destructive restore requires explicit confirmation',
          required_parameter: 'confirm_destructive=true'
        });
      }

      const jsonContent = fs.readFileSync(req.file.path, 'utf8');
      const backupData = JSON.parse(jsonContent);

      // Validate backup format
      if (!backupData.backup_info || !backupData.categories || !backupData.skus) {
        return res.status(400).json({ message: 'Invalid backup file format' });
      }

      const results = {
        categories: { created: 0, updated: 0, skipped: 0 },
        skus: { created: 0, updated: 0, skipped: 0 },
        instances: { created: 0, updated: 0, skipped: 0 },
        inventories: { created: 0, updated: 0, skipped: 0 },
        tags: { created: 0, updated: 0, skipped: 0 },
        errors: []
      };

      console.log(`Starting system restore (${restoreMode} mode) from backup dated ${backupData.backup_info.export_date}`);

      // If replace mode, clear existing data (DESTRUCTIVE)
      if (restoreMode === 'replace') {
        console.log('WARNING: Clearing existing data for replace mode');
        await Promise.all([
          Instance.deleteMany({}),
          Tag.deleteMany({}),
          Inventory.deleteMany({}),
          SKU.deleteMany({}),
          Category.deleteMany({})
        ]);
      }

      // Restore categories first (dependencies)
      for (const category of backupData.categories || []) {
        try {
          const existing = await Category.findOne({ name: category.name });
          if (existing && restoreMode === 'merge') {
            results.categories.skipped++;
            continue;
          }
          
          const categoryData = {
            name: category.name,
            slug: category.slug,
            description: category.description,
            parent_category_id: category.parent_category_id,
            created_by: category.created_by || req.user.username,
            last_updated_by: req.user.username
          };
          
          if (existing) {
            Object.assign(existing, categoryData);
            await existing.save();
            results.categories.updated++;
          } else {
            await Category.create(categoryData);
            results.categories.created++;
          }
        } catch (error) {
          results.errors.push(`Category ${category.name}: ${error.message}`);
        }
      }

      // Restore SKUs
      for (const sku of backupData.skus || []) {
        try {
          const existing = await SKU.findOne({ sku_code: sku.sku_code });
          if (existing && restoreMode === 'merge') {
            results.skus.skipped++;
            continue;
          }

          // Find category by name if populated
          let categoryId = null;
          if (sku.category_id && sku.category_id.name) {
            const category = await Category.findOne({ name: sku.category_id.name });
            categoryId = category?._id;
          }

          const skuData = {
            sku_code: sku.sku_code,
            name: sku.name,
            category_id: categoryId,
            brand: sku.brand,
            model: sku.model,
            description: sku.description,
            unit_cost: sku.unit_cost,
            barcode: sku.barcode,
            status: sku.status,
            is_bundle: sku.is_bundle,
            is_lendable: sku.is_lendable,
            supplier_info: sku.supplier_info,
            cost_history: sku.cost_history,
            created_by: sku.created_by || req.user.username,
            last_updated_by: req.user.username
          };

          if (existing) {
            Object.assign(existing, skuData);
            await existing.save();
            results.skus.updated++;
          } else {
            await SKU.create(skuData);
            results.skus.created++;
          }
        } catch (error) {
          results.errors.push(`SKU ${sku.sku_code}: ${error.message}`);
        }
      }

      // Restore instances
      for (const instance of backupData.instances || []) {
        try {
          // Find SKU by code if populated
          let skuId = instance.sku_id;
          if (instance.sku_id && instance.sku_id.sku_code) {
            const sku = await SKU.findOne({ sku_code: instance.sku_id.sku_code });
            skuId = sku?._id;
          }

          if (!skuId) {
            results.errors.push(`Instance ${instance._id}: SKU not found`);
            continue;
          }

          const existing = await Instance.findOne({
            sku_id: skuId,
            reference_number: instance.reference_number
          });
          
          if (existing && restoreMode === 'merge') {
            results.instances.skipped++;
            continue;
          }

          const instanceData = {
            sku_id: skuId,
            acquisition_date: instance.acquisition_date,
            acquisition_cost: instance.acquisition_cost,
            location: instance.location,
            supplier: instance.supplier,
            reference_number: instance.reference_number,
            notes: instance.notes,
            added_by: instance.added_by || req.user.username
          };

          if (existing) {
            Object.assign(existing, instanceData);
            await existing.save();
            results.instances.updated++;
          } else {
            await Instance.create(instanceData);
            results.instances.created++;
          }
        } catch (error) {
          results.errors.push(`Instance ${instance._id}: ${error.message}`);
        }
      }

      // Restore inventories (recalculate from instances)
      const skusToRecalculate = await SKU.find({}).select('_id');
      for (const sku of skusToRecalculate) {
        try {
          const totalInstances = await Instance.countDocuments({ sku_id: sku._id });
          const availableInstances = await Instance.countDocuments({ 
            sku_id: sku._id, 
            tag_id: { $exists: false } 
          });
          
          const existing = await Inventory.findOne({ sku_id: sku._id });
          const inventoryData = {
            sku_id: sku._id,
            total_quantity: totalInstances,
            available_quantity: availableInstances,
            reserved_quantity: 0,
            broken_quantity: 0,
            loaned_quantity: 0,
            minimum_stock_level: 10,
            primary_location: 'HQ',
            last_updated_by: req.user.username
          };
          
          if (existing) {
            Object.assign(existing, inventoryData);
            await existing.save();
            results.inventories.updated++;
          } else {
            await Inventory.create(inventoryData);
            results.inventories.created++;
          }
        } catch (error) {
          results.errors.push(`Inventory for SKU ${sku._id}: ${error.message}`);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'System restore completed',
        restore_mode: restoreMode,
        backup_date: backupData.backup_info.export_date,
        results
      });

    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('System restore error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;
