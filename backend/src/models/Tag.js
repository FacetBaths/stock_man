const mongoose = require('mongoose');

// Redesigned Tag schema with proper relationships
const tagSchema = new mongoose.Schema({
  // Customer/project/department name (simple string like original)
  customer_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Tag information
  tag_type: {
    type: String,
    enum: ['reserved', 'broken', 'imperfect', 'loaned', 'stock'],
    default: 'reserved',
    index: true
  },
  
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // SKU items in this tag (references to SKUs with quantities)
  sku_items: [{
    sku_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SKU',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    remaining_quantity: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  
  // Metadata
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  due_date: {
    type: Date,
    index: true
  },
  
  project_name: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  
  // Tracking
  created_by: {
    type: String,
    required: true,
    index: true
  },
  
  last_updated_by: {
    type: String,
    required: true
  },
  
  // Fulfillment tracking
  fulfilled_date: {
    type: Date
  },
  
  fulfilled_by: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to initialize remaining_quantity and update last_updated_by
tagSchema.pre('save', function(next) {
  // Initialize remaining_quantity to match quantity for new items
  this.sku_items.forEach(item => {
    if (item.remaining_quantity === undefined || item.remaining_quantity === null) {
      item.remaining_quantity = item.quantity;
    }
  });
  
  // Update last_updated_by if not explicitly set
  if (this.isModified() && !this.isModified('last_updated_by')) {
    this.last_updated_by = this.created_by;
  }
  
  next();
});

// Method to check if tag is partially fulfilled
tagSchema.methods.isPartiallyFulfilled = function() {
  return this.sku_items.some(item => item.remaining_quantity < item.quantity && item.remaining_quantity > 0);
};

// Method to check if tag is fully fulfilled
tagSchema.methods.isFullyFulfilled = function() {
  return this.sku_items.every(item => item.remaining_quantity === 0);
};

// Method to get remaining items for fulfillment
tagSchema.methods.getRemainingItems = function() {
  return this.sku_items.filter(item => item.remaining_quantity > 0);
};

// Method to get total quantity across all items
tagSchema.methods.getTotalQuantity = function() {
  return this.sku_items.reduce((total, item) => total + item.quantity, 0);
};

// Method to get total remaining quantity across all items
tagSchema.methods.getTotalRemainingQuantity = function() {
  return this.sku_items.reduce((total, item) => total + (item.remaining_quantity || 0), 0);
};

// Method to fulfill items (reduce remaining quantity)
tagSchema.methods.fulfillItems = function(fulfillmentData, fulfilledBy) {
  const { sku_id, quantity_fulfilled } = fulfillmentData;
  
  const item = this.sku_items.find(item => item.sku_id.toString() === sku_id.toString());
  if (!item) {
    throw new Error(`SKU ${sku_id} not found in this tag`);
  }
  
  if (quantity_fulfilled > item.remaining_quantity) {
    throw new Error(`Cannot fulfill ${quantity_fulfilled} items. Only ${item.remaining_quantity} remaining.`);
  }
  
  item.remaining_quantity -= quantity_fulfilled;
  this.last_updated_by = fulfilledBy;
  
  // Check if tag is fully fulfilled and update status
  if (this.isFullyFulfilled()) {
    this.status = 'fulfilled';
    this.fulfilled_date = new Date();
    this.fulfilled_by = fulfilledBy;
  }
  
  return this;
};

// Method to cancel the tag
tagSchema.methods.cancel = function(cancelledBy, reason = '') {
  this.status = 'cancelled';
  this.last_updated_by = cancelledBy;
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  }
  return this;
};

// Method to calculate total value (requires populated SKU data)
tagSchema.methods.getTotalValue = function() {
  if (!this.populated('sku_items.sku_id')) {
    throw new Error('SKU items must be populated to calculate total value');
  }
  
  return this.sku_items.reduce((total, tagItem) => {
    const sku = tagItem.sku_id;
    if (sku && sku.unit_cost) {
      return total + (tagItem.quantity * sku.unit_cost);
    }
    return total;
  }, 0);
};

// Static method to get overdue tags
tagSchema.statics.getOverdueTags = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    due_date: { $lt: now }
  }).populate({
    path: 'sku_items.sku_id'
  });
};

// Static method to get tags by customer name
tagSchema.statics.getTagsByCustomer = function(customerName) {
  return this.find({ customer_name: new RegExp(customerName, 'i') })
    .populate({
      path: 'sku_items.sku_id'
    })
    .sort({ createdAt: -1 });
};

// Indexes for efficient searching
tagSchema.index({ customer_name: 1, status: 1 });
tagSchema.index({ tag_type: 1, status: 1 });
tagSchema.index({ status: 1, due_date: 1 });
tagSchema.index({ created_by: 1 });
tagSchema.index({ project_name: 1 });
tagSchema.index({ 'sku_items.sku_id': 1 });
tagSchema.index({ createdAt: -1 });

// Text index for customer name searching
tagSchema.index({ customer_name: 'text', project_name: 'text', notes: 'text' });

// Compound indexes for common queries
tagSchema.index({ customer_name: 1, tag_type: 1, status: 1 });
tagSchema.index({ tag_type: 1, status: 1, due_date: 1 });

module.exports = mongoose.model('Tag', tagSchema);
