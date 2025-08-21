const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();
const SKU = require('../models/SKU');
const Item = require('../models/Item');
const Tag = require('../models/Tag');
const { auth } = require('../middleware/auth');

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

// GET /api/export/inventory - Export inventory data
router.get('/inventory',
  auth,
  [
    query('format').optional().isIn(['csv']).withMessage('Only CSV format is supported'),
    query('include_skus').optional().isBoolean().withMessage('Include SKUs must be boolean'),
    query('include_tags').optional().isBoolean().withMessage('Include tags must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';
      const includeSkus = req.query.include_skus !== 'false';
      const includeTags = req.query.include_tags !== 'false';

      // Get all items with populated product details
      const items = await Item.find({}).populate('product_details').populate('sku_id');

      const exportData = [];
      
      for (const item of items) {
        const baseRow = {
          item_id: item._id.toString(),
          product_type: item.product_type,
          quantity: item.quantity,
          location: item.location || '',
          cost: item.cost || 0,
          stock_status: item.getStockStatus(),
          understocked_threshold: item.stock_thresholds?.understocked || 0,
          overstocked_threshold: item.stock_thresholds?.overstocked || 0,
          created_at: item.createdAt.toISOString(),
          updated_at: item.updatedAt.toISOString()
        };

        // Add product details
        if (item.product_details) {
          const details = item.product_details.toObject();
          Object.keys(details).forEach(key => {
            if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
              baseRow[`product_${key}`] = details[key] || '';
            }
          });
        }

        // Add SKU information if requested
        if (includeSkus && item.sku_id) {
          const sku = item.sku_id;
          baseRow.sku_code = sku.sku_code || '';
          baseRow.sku_barcode = sku.barcode || '';
          baseRow.sku_current_cost = sku.current_cost || 0;
          baseRow.sku_manufacturer_model = sku.manufacturer_model || '';
          baseRow.sku_description = sku.description || '';
          baseRow.sku_status = sku.status || '';
        }

        // Add tag information if requested
        if (includeTags) {
          const tags = await Tag.find({ item_id: item._id, status: 'active' });
          const tagSummary = {
            total_tags: tags.length,
            reserved_qty: 0,
            broken_qty: 0,
            imperfect_qty: 0,
            expected_qty: 0
          };
          
          tags.forEach(tag => {
            switch (tag.tag_type) {
              case 'reserved':
                tagSummary.reserved_qty += tag.quantity;
                break;
              case 'broken':
                tagSummary.broken_qty += tag.quantity;
                break;
              case 'imperfect':
                tagSummary.imperfect_qty += tag.quantity;
                break;
              case 'expected':
              case 'partial_shipment':
              case 'backorder':
                tagSummary.expected_qty += tag.quantity;
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
        res.json(exportData);
      }
    } catch (error) {
      console.error('Export inventory error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/export/skus - Export SKU data
router.get('/skus',
  auth,
  [
    query('format').optional().isIn(['csv']).withMessage('Only CSV format is supported'),
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

      const skus = await SKU.find({}).populate('product_details');
      const exportData = [];

      for (const sku of skus) {
        // Get associated items
        const items = await Item.find({ sku_id: sku._id });
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const stockStatus = sku.getStockStatus(totalQuantity);

        const baseRow = {
          sku_id: sku._id.toString(),
          sku_code: sku.sku_code,
          product_type: sku.product_type,
          barcode: sku.barcode || '',
          manufacturer_model: sku.manufacturer_model || '',
          current_cost: sku.current_cost || 0,
          total_quantity: totalQuantity,
          item_count: items.length,
          stock_status: stockStatus,
          understocked_threshold: sku.stock_thresholds?.understocked || 0,
          overstocked_threshold: sku.stock_thresholds?.overstocked || 0,
          description: sku.description || '',
          notes: sku.notes || '',
          status: sku.status,
          is_auto_generated: sku.is_auto_generated || false,
          created_by: sku.created_by || '',
          created_at: sku.createdAt.toISOString(),
          updated_at: sku.updatedAt.toISOString()
        };

        // Add product details
        if (sku.product_details) {
          const details = sku.product_details.toObject();
          Object.keys(details).forEach(key => {
            if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
              baseRow[`product_${key}`] = details[key] || '';
            }
          });
        }

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
        res.json(exportData);
      }
    } catch (error) {
      console.error('Export SKUs error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/export/reorder-report - Export reorder report
router.get('/reorder-report',
  auth,
  [
    query('format').optional().isIn(['csv']).withMessage('Only CSV format is supported')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';

      // Get all items that are understocked
      const items = await Item.find({}).populate('product_details').populate('sku_id');
      const understockedItems = items.filter(item => item.getStockStatus() === 'understocked');

      const exportData = understockedItems.map(item => {
        const row = {
          item_id: item._id.toString(),
          product_type: item.product_type,
          current_quantity: item.quantity,
          understocked_threshold: item.stock_thresholds?.understocked || 0,
          suggested_order_qty: Math.max(
            (item.stock_thresholds?.understocked || 0) * 2 - item.quantity,
            item.stock_thresholds?.understocked || 0
          ),
          location: item.location || '',
          current_cost: item.cost || 0,
          estimated_total_cost: (item.cost || 0) * Math.max(
            (item.stock_thresholds?.understocked || 0) * 2 - item.quantity,
            item.stock_thresholds?.understocked || 0
          )
        };

        // Add product details
        if (item.product_details) {
          const details = item.product_details.toObject();
          Object.keys(details).forEach(key => {
            if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
              row[`product_${key}`] = details[key] || '';
            }
          });
        }

        // Add SKU information if available
        if (item.sku_id) {
          const sku = item.sku_id;
          row.sku_code = sku.sku_code || '';
          row.sku_barcode = sku.barcode || '';
          row.sku_manufacturer_model = sku.manufacturer_model || '';
        }

        return row;
      });

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="reorder_report_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json(exportData);
      }
    } catch (error) {
      console.error('Export reorder report error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/export/cost-analysis - Export cost analysis
router.get('/cost-analysis',
  auth,
  [
    query('format').optional().isIn(['csv']).withMessage('Only CSV format is supported'),
    query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const format = req.query.format || 'csv';
      const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
      const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

      const items = await Item.find({}).populate('product_details').populate('sku_id');
      const exportData = [];

      for (const item of items) {
        let currentCost = item.cost || 0;
        let historicalCost = 0;
        let costAtStartDate = 0;
        let costAtEndDate = 0;

        // If item has SKU with cost history, use that
        if (item.sku_id && item.sku_id.cost_history && item.sku_id.cost_history.length > 0) {
          currentCost = item.sku_id.current_cost || 0;
          
          if (startDate) {
            costAtStartDate = item.sku_id.getCostAtDate(startDate);
          }
          if (endDate) {
            costAtEndDate = item.sku_id.getCostAtDate(endDate);
          }
          
          // Get oldest cost for historical comparison
          const oldestCost = item.sku_id.cost_history
            .sort((a, b) => new Date(a.effective_date) - new Date(b.effective_date))[0];
          historicalCost = oldestCost ? oldestCost.cost : currentCost;
        }

        const totalCurrentValue = currentCost * item.quantity;
        const totalHistoricalValue = historicalCost * item.quantity;
        const valueChange = totalCurrentValue - totalHistoricalValue;
        const percentChange = totalHistoricalValue > 0 ? 
          ((totalCurrentValue - totalHistoricalValue) / totalHistoricalValue * 100) : 0;

        const row = {
          item_id: item._id.toString(),
          product_type: item.product_type,
          quantity: item.quantity,
          current_cost: currentCost,
          historical_cost: historicalCost,
          total_current_value: totalCurrentValue,
          total_historical_value: totalHistoricalValue,
          value_change: valueChange,
          percent_change: percentChange.toFixed(2),
          location: item.location || ''
        };

        if (startDate) {
          row.cost_at_start_date = costAtStartDate;
          row.value_at_start_date = costAtStartDate * item.quantity;
        }
        if (endDate) {
          row.cost_at_end_date = costAtEndDate;
          row.value_at_end_date = costAtEndDate * item.quantity;
        }

        // Add product details
        if (item.product_details) {
          const details = item.product_details.toObject();
          Object.keys(details).forEach(key => {
            if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
              row[`product_${key}`] = details[key] || '';
            }
          });
        }

        // Add SKU information if available
        if (item.sku_id) {
          const sku = item.sku_id;
          row.sku_code = sku.sku_code || '';
          row.sku_barcode = sku.barcode || '';
        }

        exportData.push(row);
      }

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        const csvContent = jsonToCsv(exportData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="cost_analysis_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        res.json(exportData);
      }
    } catch (error) {
      console.error('Export cost analysis error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
