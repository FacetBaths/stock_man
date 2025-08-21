const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  },
  // SKU reference (optional for backward compatibility)
  sku_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SKU',
    sparse: true // Allow items without SKUs during migration
  },
  // Stock level thresholds specific to this item
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
  // Usage history for tracking when items are consumed/used for installations
  usage_history: [{
    quantity_used: {
      type: Number,
      required: true,
      min: 1
    },
    used_for: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    project_name: {
      type: String,
      trim: true
    },
    customer_name: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    used_by: {
      type: String,
      required: true
    },
    used_date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Method to get stock status based on thresholds
itemSchema.methods.getStockStatus = function() {
  if (this.quantity <= this.stock_thresholds.understocked) {
    return 'understocked';
  } else if (this.quantity >= this.stock_thresholds.overstocked) {
    return 'overstocked';
  } else {
    return 'adequate';
  }
};

// Method to use/consume items for installation
itemSchema.methods.useItems = function(usageData) {
  const { quantity_used, used_for, location, project_name, customer_name, notes, used_by } = usageData;
  
  // Check if we have enough quantity
  if (quantity_used > this.quantity) {
    throw new Error(`Cannot use ${quantity_used} items. Only ${this.quantity} available.`);
  }
  
  // Reduce quantity
  this.quantity -= quantity_used;
  
  // Add to usage history
  this.usage_history.push({
    quantity_used,
    used_for,
    location: location || '',
    project_name: project_name || '',
    customer_name: customer_name || '',
    notes: notes || '',
    used_by,
    used_date: new Date()
  });
  
  return this;
};

// Method to get total used quantity
itemSchema.methods.getTotalUsed = function() {
  return this.usage_history.reduce((total, usage) => total + usage.quantity_used, 0);
};

// Pre-save middleware to set the correct model name
itemSchema.pre('save', function(next) {
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
  next();
});

// Index for efficient searching
itemSchema.index({ product_type: 1, quantity: 1 });
itemSchema.index({ quantity: 1 });
itemSchema.index({ sku_id: 1 });

module.exports = mongoose.model('Item', itemSchema);
