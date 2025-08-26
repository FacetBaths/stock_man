const mongoose = require('mongoose');

// Instance model - tracks individual product instances with acquisition cost
const instanceSchema = new mongoose.Schema({
  // Reference to the SKU this instance belongs to
  sku_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SKU',
    required: true,
    index: true
  },
  
  // When this specific instance was acquired
  acquisition_date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Cost when this instance was acquired (frozen - doesn't change with SKU price changes)
  acquisition_cost: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Reference to tag (null = available, populated = tagged)
  tag_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    default: null,
    index: true
  },
  
  // Physical location of this specific instance
  location: {
    type: String,
    trim: true,
    default: 'HQ'
  },
  
  // Optional supplier information
  supplier: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Optional reference number (PO#, invoice#, etc.)
  reference_number: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Optional notes for this specific instance
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Who added this instance
  added_by: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Method to check if instance is available (not tagged)
instanceSchema.methods.isAvailable = function() {
  return this.tag_id === null || this.tag_id === undefined;
};

// Method to tag this instance
instanceSchema.methods.assignToTag = function(tagId, updatedBy) {
  if (!this.isAvailable()) {
    throw new Error('Instance is already tagged');
  }
  this.tag_id = tagId;
  return this.save();
};

// Method to release from tag (make available)
instanceSchema.methods.releaseFromTag = function() {
  this.tag_id = null;
  return this.save();
};

// Static method to find available instances for a SKU (FIFO - oldest first)
instanceSchema.statics.findAvailableForSKU = function(skuId, limit = null) {
  let query = this.find({ 
    sku_id: skuId, 
    tag_id: null 
  }).sort({ acquisition_date: 1 }); // Oldest first (FIFO)
  
  if (limit) {
    query = query.limit(limit);
  }
  
  return query;
};

// Static method to find available instances by cost criteria
instanceSchema.statics.findAvailableByCost = function(skuId, costCriteria, limit = null) {
  const sortOrder = costCriteria === 'lowest' ? 1 : -1;
  
  let query = this.find({ 
    sku_id: skuId, 
    tag_id: null 
  }).sort({ acquisition_cost: sortOrder, acquisition_date: 1 }); // Secondary sort by date
  
  if (limit) {
    query = query.limit(limit);
  }
  
  return query;
};

// Static method to get instances for a specific tag
instanceSchema.statics.findByTag = function(tagId) {
  return this.find({ tag_id: tagId })
    .populate('sku_id', 'sku_code name')
    .sort({ acquisition_date: 1 });
};

// Static method to count available instances for a SKU
instanceSchema.statics.countAvailableForSKU = function(skuId) {
  return this.countDocuments({ 
    sku_id: skuId, 
    tag_id: null 
  });
};

// Static method to get cost summary for available instances of a SKU
instanceSchema.statics.getCostSummaryForSKU = function(skuId) {
  return this.aggregate([
    { $match: { sku_id: new mongoose.Types.ObjectId(skuId), tag_id: null } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        averageCost: { $avg: '$acquisition_cost' },
        lowestCost: { $min: '$acquisition_cost' },
        highestCost: { $max: '$acquisition_cost' },
        totalValue: { $sum: '$acquisition_cost' },
        oldestDate: { $min: '$acquisition_date' },
        newestDate: { $max: '$acquisition_date' }
      }
    }
  ]);
};

// Indexes for efficient queries
instanceSchema.index({ sku_id: 1, tag_id: 1 }); // Compound index for availability queries
instanceSchema.index({ sku_id: 1, acquisition_date: 1 }); // For FIFO queries
instanceSchema.index({ sku_id: 1, acquisition_cost: 1 }); // For cost-based queries
instanceSchema.index({ tag_id: 1 }); // For tag-based queries
instanceSchema.index({ acquisition_date: -1 }); // For recent acquisitions
instanceSchema.index({ location: 1 }); // For location-based queries

module.exports = mongoose.model('Instance', instanceSchema);
