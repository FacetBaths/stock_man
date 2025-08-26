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

// Method to assign instances automatically based on sku_items (simplified version - no parameters)
tagSchema.methods.assignInstances = async function() {
  const Instance = mongoose.model('Instance');
  
  for (const item of this.sku_items) {
    // Find available instances for this SKU (FIFO - oldest first)
    const availableInstances = await Instance.find({ 
      sku_id: item.sku_id, 
      tag_id: null 
    })
    .sort({ acquisition_date: 1 })
    .limit(item.quantity);
    
    if (availableInstances.length < item.quantity) {
      throw new Error(`Not enough available instances for SKU ${item.sku_id}. Need ${item.quantity}, found ${availableInstances.length}`);
    }
    
    // Assign the instances to this tag
    const instanceIds = availableInstances.map(instance => instance._id);
    await Instance.updateMany(
      { _id: { $in: instanceIds } },
      { tag_id: this._id }
    );
  }
  
  return this;
};

// Method to fulfill all items (delete all assigned Instance records - no parameters)
tagSchema.methods.fulfillItems = async function() {
  const Instance = mongoose.model('Instance');
  
  for (const item of this.sku_items) {
    if (item.remaining_quantity > 0) {
      // Find instances assigned to this tag for this SKU (FIFO - oldest first)
      const instancesToDelete = await Instance.find({ 
        tag_id: this._id, 
        sku_id: item.sku_id 
      })
      .sort({ acquisition_date: 1 })
      .limit(item.remaining_quantity);
      
      // Delete the Instance records from database
      const instanceIds = instancesToDelete.map(instance => instance._id);
      if (instanceIds.length > 0) {
        await Instance.deleteMany({ _id: { $in: instanceIds } });
      }
      
      // Update tag remaining quantity to 0
      item.remaining_quantity = 0;
    }
  }
  
  // Mark tag as fulfilled
  this.status = 'fulfilled';
  this.fulfilled_date = new Date();
  this.fulfilled_by = this.last_updated_by;
  
  return this;
};

// Method to fulfill specific items (delete Instance records and update inventory)
tagSchema.methods.fulfillSpecificItems = async function(fulfillmentData, fulfilledBy) {
  const { sku_id, quantity_fulfilled } = fulfillmentData;
  const Instance = mongoose.model('Instance');
  const Inventory = mongoose.model('Inventory');
  
  const item = this.sku_items.find(item => item.sku_id.toString() === sku_id.toString());
  if (!item) {
    throw new Error(`SKU ${sku_id} not found in this tag`);
  }
  
  if (quantity_fulfilled > item.remaining_quantity) {
    throw new Error(`Cannot fulfill ${quantity_fulfilled} items. Only ${item.remaining_quantity} remaining.`);
  }
  
  // Find specific instances assigned to this tag for this SKU (FIFO - oldest first)
  const instancesToDelete = await Instance.find({ 
    tag_id: this._id, 
    sku_id: sku_id 
  })
  .sort({ acquisition_date: 1 })
  .limit(quantity_fulfilled);
  
  if (instancesToDelete.length !== quantity_fulfilled) {
    throw new Error(`Expected ${quantity_fulfilled} instances but found ${instancesToDelete.length}`);
  }
  
  // Delete the Instance records from database
  const instanceIds = instancesToDelete.map(instance => instance._id);
  await Instance.deleteMany({ _id: { $in: instanceIds } });
  
  // Update inventory quantities to reflect the deleted instances
  const inventory = await Inventory.findOne({ sku_id: sku_id });
  if (inventory) {
    // Determine which inventory status to reduce based on tag type
    switch (this.tag_type) {
      case 'reserved':
        inventory.reserved_quantity = Math.max(0, inventory.reserved_quantity - quantity_fulfilled);
        break;
      case 'broken':
      case 'imperfect':
        inventory.broken_quantity = Math.max(0, inventory.broken_quantity - quantity_fulfilled);
        break;
      case 'loaned':
        inventory.loaned_quantity = Math.max(0, inventory.loaned_quantity - quantity_fulfilled);
        break;
      case 'stock':
        inventory.available_quantity = Math.max(0, inventory.available_quantity - quantity_fulfilled);
        break;
    }
    
    inventory.last_movement_date = new Date();
    inventory.last_updated_by = fulfilledBy;
    await inventory.save();
  }
  
  // Update tag remaining quantity
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
