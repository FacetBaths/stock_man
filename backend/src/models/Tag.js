const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  customer_name: {
    type: String,
    required: true,
    trim: true
  },
  // Array of SKUs and their quantities for this tag
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
    // Track remaining quantity for partial fulfillment
    remaining_quantity: {
      type: Number,
      min: 0
    }
  }],
  tag_type: {
    type: String,
    enum: ['stock', 'reserved', 'broken', 'imperfect', 'expected', 'partial_shipment', 'backorder'],
    default: 'stock'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  created_by: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'cancelled'],
    default: 'active'
  },
  due_date: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to initialize remaining_quantity
tagSchema.pre('save', function(next) {
  // Initialize remaining_quantity to match quantity for new sku_items
  this.sku_items.forEach(item => {
    if (item.remaining_quantity === undefined || item.remaining_quantity === null) {
      item.remaining_quantity = item.quantity;
    }
  });
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

// Index for efficient searching
tagSchema.index({ 'sku_items.sku_id': 1, status: 1 });
tagSchema.index({ customer_name: 1, status: 1 });
tagSchema.index({ created_by: 1 });
tagSchema.index({ status: 1 });

module.exports = mongoose.model('Tag', tagSchema);
