const mongoose = require('mongoose');

// Redesigned Tag schema with proper relationships
const tagNewSchema = new mongoose.Schema({
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
  
  // Items in this tag (proper item references)
  items: [{
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemNew',
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
tagNewSchema.pre('save', function(next) {
  // Initialize remaining_quantity to match quantity for new items
  this.items.forEach(item => {
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
tagNewSchema.methods.isPartiallyFulfilled = function() {
  return this.items.some(item => item.remaining_quantity < item.quantity && item.remaining_quantity > 0);
};

// Method to check if tag is fully fulfilled
tagNewSchema.methods.isFullyFulfilled = function() {
  return this.items.every(item => item.remaining_quantity === 0);
};

// Method to get remaining items for fulfillment
tagNewSchema.methods.getRemainingItems = function() {
  return this.items.filter(item => item.remaining_quantity > 0);
};

// Method to get total quantity across all items
tagNewSchema.methods.getTotalQuantity = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

// Method to get total remaining quantity across all items
tagNewSchema.methods.getTotalRemainingQuantity = function() {
  return this.items.reduce((total, item) => total + (item.remaining_quantity || 0), 0);
};

// Method to fulfill items (reduce remaining quantity)
tagNewSchema.methods.fulfillItems = function(fulfillmentData, fulfilledBy) {
  const { item_id, quantity_fulfilled } = fulfillmentData;
  
  const item = this.items.find(item => item.item_id.toString() === item_id.toString());
  if (!item) {
    throw new Error(`Item ${item_id} not found in this tag`);
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
tagNewSchema.methods.cancel = function(cancelledBy, reason = '') {
  this.status = 'cancelled';
  this.last_updated_by = cancelledBy;
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  }
  return this;
};

// Method to calculate total value (requires populated SKU data)
tagNewSchema.methods.getTotalValue = function() {
  if (!this.populated('items.item_id')) {
    throw new Error('Items must be populated to calculate total value');
  }
  
  return this.items.reduce((total, tagItem) => {
    const item = tagItem.item_id;
    if (item && item.sku_id && item.sku_id.unit_cost) {
      return total + (tagItem.quantity * item.sku_id.unit_cost);
    }
    return total;
  }, 0);
};

// Static method to get overdue tags
tagNewSchema.statics.getOverdueTags = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    due_date: { $lt: now }
  }).populate({
    path: 'items.item_id',
    populate: {
      path: 'sku_id'
    }
  });
};

// Static method to get tags by customer name
tagNewSchema.statics.getTagsByCustomer = function(customerName) {
  return this.find({ customer_name: new RegExp(customerName, 'i') })
    .populate({
      path: 'items.item_id',
      populate: {
        path: 'sku_id'
      }
    })
    .sort({ createdAt: -1 });
};

// Indexes for efficient searching
tagNewSchema.index({ customer_name: 1, status: 1 });
tagNewSchema.index({ tag_type: 1, status: 1 });
tagNewSchema.index({ status: 1, due_date: 1 });
tagNewSchema.index({ created_by: 1 });
tagNewSchema.index({ project_name: 1 });
tagNewSchema.index({ 'items.item_id': 1 });
tagNewSchema.index({ createdAt: -1 });

// Text index for customer name searching
tagNewSchema.index({ customer_name: 'text', project_name: 'text', notes: 'text' });

// Compound indexes for common queries
tagNewSchema.index({ customer_name: 1, tag_type: 1, status: 1 });
tagNewSchema.index({ tag_type: 1, status: 1, due_date: 1 });

module.exports = mongoose.model('TagNew', tagNewSchema);
