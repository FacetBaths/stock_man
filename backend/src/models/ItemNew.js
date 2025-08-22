const mongoose = require('mongoose');

// Simplified Item schema - Only instance-specific information
const itemNewSchema = new mongoose.Schema({
  // SKU reference (required - all items must have a SKU)
  sku_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SKUNew',
    required: true,
    index: true
  },
  
  // Instance-specific information only
  serial_number: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple items without serial numbers
    index: true
  },
  
  condition: {
    type: String,
    enum: ['new', 'used', 'damaged', 'refurbished'],
    default: 'new'
  },
  
  location: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Purchase information (instance-specific)
  purchase_date: {
    type: Date,
    index: true
  },
  
  purchase_price: {
    type: Number,
    min: 0
  },
  
  batch_number: {
    type: String,
    trim: true,
    index: true
  },
  
  // Quantity for this specific item instance
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  },
  
  // Usage history for tracking when items are consumed/used
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
  }],
  
  // Tracking who created/modified this item instance
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

// Method to use/consume items for installation
itemNewSchema.methods.useItems = function(usageData) {
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
  
  this.last_updated_by = used_by;
  
  return this;
};

// Method to get total used quantity
itemNewSchema.methods.getTotalUsed = function() {
  return this.usage_history.reduce((total, usage) => total + usage.quantity_used, 0);
};

// Method to check if item is available (has quantity > 0)
itemNewSchema.methods.isAvailable = function() {
  return this.quantity > 0;
};

// Method to get remaining shelf life (if applicable)
itemNewSchema.methods.getAge = function() {
  if (!this.purchase_date) return null;
  const now = new Date();
  const purchased = new Date(this.purchase_date);
  const diffTime = Math.abs(now - purchased);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Pre-save middleware to update last_updated_by
itemNewSchema.pre('save', function(next) {
  if (this.isModified() && !this.isModified('last_updated_by')) {
    this.last_updated_by = this.created_by;
  }
  next();
});

// Indexes for efficient searching
itemNewSchema.index({ sku_id: 1 });
itemNewSchema.index({ location: 1 });
itemNewSchema.index({ condition: 1 });
itemNewSchema.index({ purchase_date: 1 });
itemNewSchema.index({ batch_number: 1 });
itemNewSchema.index({ serial_number: 1 });
itemNewSchema.index({ quantity: 1 });
itemNewSchema.index({ created_by: 1 });

// Compound indexes for common queries
itemNewSchema.index({ sku_id: 1, condition: 1 });
itemNewSchema.index({ sku_id: 1, location: 1 });
itemNewSchema.index({ sku_id: 1, quantity: 1 });

module.exports = mongoose.model('ItemNew', itemNewSchema);
