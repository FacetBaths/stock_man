const mongoose = require('mongoose');

// Cost history schema to track price changes over time
const costHistorySchema = new mongoose.Schema({
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  effective_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  updated_by: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Main SKU schema
const skuSchema = new mongoose.Schema({
  sku_code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  product_type: {
    type: String,
    required: true,
    enum: ['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous'],
    lowercase: true
  },
  product_details: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'product_type_model'
  },
  product_type_model: {
    type: String,
    required: true,
    enum: ['Wall', 'Toilet', 'Base', 'Tub', 'Vanity', 'ShowerDoor', 'RawMaterial', 'Accessory', 'Miscellaneous']
  },
  // Current cost (most recent from cost_history)
  current_cost: {
    type: Number,
    min: 0,
    default: 0
  },
  // Historical cost tracking
  cost_history: [costHistorySchema],
  // Stock thresholds for this specific SKU
  stock_thresholds: {
    understocked: {
      type: Number,
      min: 0,
      default: 5
    },
    overstocked: {
      type: Number,
      min: 0,
      default: 100
    }
  },
  // Auto-generated vs manual
  is_auto_generated: {
    type: Boolean,
    default: false
  },
  // Generation template used (if auto-generated)
  generation_template: {
    type: String,
    trim: true
  },
  // Manufacturer model number (preserved separately)
  manufacturer_model: {
    type: String,
    trim: true,
    default: ''
  },
  // Barcode data
  barcode: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple documents with null barcode
    index: true
  },
  // Additional metadata
  description: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Tracking
  created_by: {
    type: String,
    required: true
  },
  last_updated_by: {
    type: String,
    required: true
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Pre-save middleware to set the correct model name and update cost
skuSchema.pre('save', function(next) {
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
  
  this.product_type_model = typeMapping[this.product_type];
  
  // Update current_cost from latest cost_history entry
  if (this.cost_history && this.cost_history.length > 0) {
    const sortedHistory = this.cost_history.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    this.current_cost = sortedHistory[0].cost;
  }
  
  next();
});

// Method to add new cost
skuSchema.methods.addCost = function(cost, updatedBy, notes = '') {
  this.cost_history.push({
    cost,
    effective_date: new Date(),
    updated_by: updatedBy,
    notes
  });
  this.current_cost = cost;
  this.last_updated_by = updatedBy;
  return this.save();
};

// Method to get cost at specific date
skuSchema.methods.getCostAtDate = function(date) {
  const targetDate = new Date(date);
  const validHistory = this.cost_history
    .filter(entry => new Date(entry.effective_date) <= targetDate)
    .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
  
  return validHistory.length > 0 ? validHistory[0].cost : 0;
};

// Method to check stock status
skuSchema.methods.getStockStatus = function(currentQuantity) {
  if (currentQuantity <= this.stock_thresholds.understocked) {
    return 'understocked';
  } else if (currentQuantity >= this.stock_thresholds.overstocked) {
    return 'overstocked';
  } else {
    return 'adequate';
  }
};

// Indexes for efficient searching
skuSchema.index({ sku_code: 1 });
skuSchema.index({ product_type: 1, status: 1 });
skuSchema.index({ barcode: 1 });
skuSchema.index({ status: 1 });
skuSchema.index({ created_by: 1 });

module.exports = mongoose.model('SKU', skuSchema);
