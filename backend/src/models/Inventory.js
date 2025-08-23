const mongoose = require('mongoose');

// Inventory aggregation model for real-time inventory tracking
const inventorySchema = new mongoose.Schema({
  // Reference to the SKU this inventory tracks
  sku_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SKUNew',
    required: true,
    unique: true, // One inventory record per SKU
    index: true
  },
  
  // Current inventory levels
  total_quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  available_quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  reserved_quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  broken_quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  loaned_quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // Inventory thresholds and alerts
  minimum_stock_level: {
    type: Number,
    default: 0,
    min: 0
  },
  
  reorder_point: {
    type: Number,
    default: 0,
    min: 0
  },
  
  maximum_stock_level: {
    type: Number,
    default: null,
    min: 0
  },
  
  // Location tracking
  primary_location: {
    type: String,
    trim: true,
    default: 'Main Warehouse'
  },
  
  locations: [{
    location_name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Valuation
  total_value: {
    type: Number,
    default: 0,
    min: 0
  },
  
  average_cost: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status and flags
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  is_low_stock: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_out_of_stock: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_overstock: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Last activity tracking
  last_movement_date: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  last_updated_by: {
    type: String,
    required: true,
    default: 'System'
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate derived values
inventorySchema.pre('save', function(next) {
  // Calculate total quantity
  const reservedQty = this.reserved_quantity || 0;
  const brokenQty = this.broken_quantity || 0;
  const loanedQty = this.loaned_quantity || 0;
  const availableQty = this.available_quantity || 0;
  
  this.total_quantity = availableQty + reservedQty + brokenQty + loanedQty;
  
  // Update stock status flags
  this.is_out_of_stock = this.available_quantity === 0;
  this.is_low_stock = this.available_quantity <= this.minimum_stock_level && this.available_quantity > 0;
  this.is_overstock = this.maximum_stock_level && this.total_quantity > this.maximum_stock_level;
  
  // Calculate total value if we have cost data
  if (this.average_cost > 0) {
    this.total_value = this.total_quantity * this.average_cost;
  }
  
  next();
});

// Method to update inventory levels
inventorySchema.methods.updateQuantities = function(updates, updatedBy = 'System') {
  const { available, reserved, broken, loaned } = updates;
  
  if (available !== undefined) this.available_quantity = Math.max(0, available);
  if (reserved !== undefined) this.reserved_quantity = Math.max(0, reserved);
  if (broken !== undefined) this.broken_quantity = Math.max(0, broken);
  if (loaned !== undefined) this.loaned_quantity = Math.max(0, loaned);
  
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to reserve inventory
inventorySchema.methods.reserveQuantity = function(quantity, updatedBy = 'System') {
  if (quantity > this.available_quantity) {
    throw new Error(`Cannot reserve ${quantity} items. Only ${this.available_quantity} available.`);
  }
  
  this.available_quantity -= quantity;
  this.reserved_quantity += quantity;
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to release reserved inventory
inventorySchema.methods.releaseReservedQuantity = function(quantity, updatedBy = 'System') {
  if (quantity > this.reserved_quantity) {
    throw new Error(`Cannot release ${quantity} reserved items. Only ${this.reserved_quantity} reserved.`);
  }
  
  this.reserved_quantity -= quantity;
  this.available_quantity += quantity;
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to move inventory to different status
inventorySchema.methods.moveInventory = function(fromStatus, toStatus, quantity, updatedBy = 'System') {
  const statusMap = {
    'available': 'available_quantity',
    'reserved': 'reserved_quantity',
    'broken': 'broken_quantity',
    'loaned': 'loaned_quantity'
  };
  
  const fromField = statusMap[fromStatus];
  const toField = statusMap[toStatus];
  
  if (!fromField || !toField) {
    throw new Error(`Invalid status. Must be one of: ${Object.keys(statusMap).join(', ')}`);
  }
  
  if (quantity > this[fromField]) {
    throw new Error(`Cannot move ${quantity} items from ${fromStatus}. Only ${this[fromField]} available.`);
  }
  
  this[fromField] -= quantity;
  this[toField] += quantity;
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to add new stock
inventorySchema.methods.addStock = function(quantity, cost = null, updatedBy = 'System') {
  this.available_quantity += quantity;
  
  // Update average cost if provided
  if (cost && cost > 0) {
    const totalValue = (this.total_quantity * this.average_cost) + (quantity * cost);
    const newTotalQuantity = this.total_quantity + quantity;
    this.average_cost = totalValue / newTotalQuantity;
  }
  
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to remove stock (for damages, theft, etc.)
inventorySchema.methods.removeStock = function(fromStatus, quantity, reason = '', updatedBy = 'System') {
  const statusMap = {
    'available': 'available_quantity',
    'reserved': 'reserved_quantity',
    'broken': 'broken_quantity',
    'loaned': 'loaned_quantity'
  };
  
  const fromField = statusMap[fromStatus];
  
  if (!fromField) {
    throw new Error(`Invalid status. Must be one of: ${Object.keys(statusMap).join(', ')}`);
  }
  
  if (quantity > this[fromField]) {
    throw new Error(`Cannot remove ${quantity} items from ${fromStatus}. Only ${this[fromField]} available.`);
  }
  
  this[fromField] -= quantity;
  this.last_movement_date = new Date();
  this.last_updated_by = updatedBy;
  
  return this;
};

// Method to check if reorder is needed
inventorySchema.methods.needsReorder = function() {
  return this.available_quantity <= this.reorder_point;
};

// Method to get inventory summary
inventorySchema.methods.getSummary = function() {
  return {
    sku_id: this.sku_id,
    total_quantity: this.total_quantity,
    available_quantity: this.available_quantity,
    reserved_quantity: this.reserved_quantity,
    broken_quantity: this.broken_quantity,
    loaned_quantity: this.loaned_quantity,
    total_value: this.total_value,
    is_low_stock: this.is_low_stock,
    is_out_of_stock: this.is_out_of_stock,
    is_overstock: this.is_overstock,
    needs_reorder: this.needsReorder()
  };
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = function() {
  return this.find({ is_low_stock: true, is_active: true })
    .populate('sku_id')
    .sort({ available_quantity: 1 });
};

// Static method to get out of stock items
inventorySchema.statics.getOutOfStockItems = function() {
  return this.find({ is_out_of_stock: true, is_active: true })
    .populate('sku_id')
    .sort({ last_movement_date: -1 });
};

// Static method to get items needing reorder
inventorySchema.statics.getItemsNeedingReorder = function() {
  return this.find({ 
    is_active: true,
    $expr: { $lte: ['$available_quantity', '$reorder_point'] }
  }).populate('sku_id');
};

// Static method to get inventory by category
inventorySchema.statics.getInventoryByCategory = function(categoryId) {
  return this.find({ is_active: true })
    .populate({
      path: 'sku_id',
      match: { category_id: categoryId },
      populate: {
        path: 'category_id'
      }
    })
    .then(results => results.filter(item => item.sku_id));
};

// Static method to get total inventory value
inventorySchema.statics.getTotalInventoryValue = function() {
  return this.aggregate([
    { $match: { is_active: true } },
    { $group: { _id: null, total_value: { $sum: '$total_value' } } }
  ]);
};

// Indexes for performance
inventorySchema.index({ sku_id: 1 }, { unique: true });
inventorySchema.index({ is_low_stock: 1, is_active: 1 });
inventorySchema.index({ is_out_of_stock: 1, is_active: 1 });
inventorySchema.index({ last_movement_date: -1 });
inventorySchema.index({ available_quantity: 1 });
inventorySchema.index({ total_value: -1 });

// Compound indexes for complex queries
inventorySchema.index({ is_active: 1, available_quantity: 1, reorder_point: 1 });

module.exports = mongoose.model('Inventory', inventorySchema, 'inventory');
