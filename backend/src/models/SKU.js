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

// Enhanced SKU schema - Single source of truth for all product/tool information
const skuSchema = new mongoose.Schema({
  sku_code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  
  // Category reference for proper organization
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  
  // Consolidated product information (single source of truth)
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  brand: {
    type: String,
    trim: true,
    default: ''
  },
  model: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Category-specific details (polymorphic based on category)
  details: {
    // For walls:
    product_line: {
      type: String,
      trim: true
    },
    color_name: {
      type: String,
      trim: true
    },
    dimensions: {
      type: String,
      trim: true
    },
    finish: {
      type: String,
      trim: true
    },
    
    // For tools:
    tool_type: {
      type: String,
      trim: true
    },
    manufacturer: {
      type: String,
      trim: true
    },
    serial_number: {
      type: String,
      trim: true
    },
    voltage: {
      type: String,
      trim: true
    },
    features: [{
      type: String,
      trim: true
    }],
    
    // Common fields:
    weight: {
      type: Number,
      min: 0
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Consolidated costing information
  unit_cost: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  
  // Historical cost tracking
  cost_history: [costHistorySchema],
  
  // Status management
  status: {
    type: String,
    enum: ['active', 'discontinued', 'pending'],
    default: 'active'
  },
  
  // Metadata
  barcode: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple documents with null barcode
    index: true
  },
  
  supplier_info: {
    supplier_name: {
      type: String,
      trim: true,
      default: ''
    },
    supplier_sku: {
      type: String,
      trim: true,
      default: ''
    },
    lead_time_days: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  images: [{
    type: String,
    trim: true
  }],
  
  // Stock thresholds for this SKU
  stock_thresholds: {
    understocked: {
      type: Number,
      min: 0
    },
    overstocked: {
      type: Number,
      min: 0,
      default: 100
    }
  },
  
  // Bundle/Kit configuration
  is_bundle: {
    type: Boolean,
    default: false
  },
  bundle_items: [{
    sku_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SKU',
      required: function() { return this.parent().is_bundle; }
    },
    quantity: {
      type: Number,
      required: function() { return this.parent().is_bundle; },
      min: 1,
      default: 1
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  
  // SKU-specific notes field for additional information
  sku_notes: {
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
  }
}, {
  timestamps: true
});

// Pre-save middleware to update cost from history
skuSchema.pre('save', function(next) {
  // Update unit_cost from latest cost_history entry
  if (this.cost_history && this.cost_history.length > 0) {
    const sortedHistory = this.cost_history.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    this.unit_cost = sortedHistory[0].cost;
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
  this.unit_cost = cost;
  this.last_updated_by = updatedBy;
  return this.save();
};

// Method to get cost at specific date
skuSchema.methods.getCostAtDate = function(date) {
  const targetDate = new Date(date);
  const validHistory = this.cost_history
    .filter(entry => new Date(entry.effective_date) <= targetDate)
    .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
  
  return validHistory.length > 0 ? validHistory[0].cost : this.unit_cost;
};

// Method to check stock status
skuSchema.methods.getStockStatus = function(currentQuantity) {
  const quantity = Number(currentQuantity) || 0;
  const understockedThreshold = Number(this.stock_thresholds.understocked) || 5;
  const overstockedThreshold = Number(this.stock_thresholds.overstocked) || 100;
  
  if (quantity === 0) {
    return 'out_of_stock';
  } else if (quantity < understockedThreshold) {
    return 'understocked';
  } else if (quantity > overstockedThreshold) {
    return 'overstocked';
  } else {
    return 'adequate';
  }
};

// Method to get display name based on category
skuSchema.methods.getDisplayName = function() {
  if (this.details && this.details.product_line && this.details.color_name) {
    // Wall product
    return `${this.details.product_line} - ${this.details.color_name}`;
  } else if (this.name) {
    // Standard product or tool
    return this.brand ? `${this.brand} ${this.name}` : this.name;
  } else {
    return this.sku_code;
  }
};

// Method to check if SKU can be safely deleted
skuSchema.methods.canBeDeleted = async function() {
  try {
    const Tag = require('./Tag');
    
    // Only check for active tags/checkouts - instances will be deleted along with the SKU
    const activeTagCount = await Tag.countDocuments({ 
      'sku_items.sku_id': this._id,
      status: { $nin: ['completed', 'cancelled'] }
    });
    
    if (activeTagCount > 0) {
      return {
        allowed: false,
        reason: 'SKU is referenced in active tags/checkouts',
        details: `${activeTagCount} active tags reference this SKU. Complete or cancel these checkouts before deleting.`
      };
    }
    
    // Check if SKU is part of any bundle (this would break the bundle)
    const bundleCount = await this.constructor.countDocuments({ 
      'bundle_items.sku_id': this._id,
      is_bundle: true 
    });
    
    if (bundleCount > 0) {
      return {
        allowed: false,
        reason: 'SKU is part of one or more bundles',
        details: `${bundleCount} bundles contain this SKU. Remove from bundles before deleting.`
      };
    }
    
    return {
      allowed: true,
      reason: 'SKU can be safely deleted',
      details: 'All associated instances will be deleted automatically.'
    };
    
  } catch (error) {
    console.error('Error checking if SKU can be deleted:', error);
    return {
      allowed: false,
      reason: 'Error checking dependencies',
      details: error.message
    };
  }
};

// Virtual populate for instances
skuSchema.virtual('instances', {
  ref: 'Instance',
  localField: '_id',
  foreignField: 'sku_id'
});

// Virtual populate for available instances only
skuSchema.virtual('available_instances', {
  ref: 'Instance',
  localField: '_id',
  foreignField: 'sku_id',
  match: { tag_id: null }
});

// Ensure virtual fields are serialized
skuSchema.set('toJSON', { virtuals: true });
skuSchema.set('toObject', { virtuals: true });

// Indexes for efficient searching
skuSchema.index({ sku_code: 1 });
skuSchema.index({ category_id: 1, status: 1 });
skuSchema.index({ barcode: 1 });
skuSchema.index({ status: 1 });
skuSchema.index({ name: 1 });
skuSchema.index({ brand: 1 });
skuSchema.index({ created_by: 1 });
skuSchema.index({ 'details.tool_type': 1 }); // For tool filtering

module.exports = mongoose.model('SKU', skuSchema);
