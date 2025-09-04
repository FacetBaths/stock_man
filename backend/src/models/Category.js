const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['product', 'tool'],
    default: 'product'
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Required fields for this category type
  attributes: [{
    type: String,
    trim: true
  }],
  // Display order for UI
  sort_order: {
    type: Number,
    default: 0
  },
  // Whether this category is active
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for efficient searching
categorySchema.index({ name: 1 });
categorySchema.index({ type: 1, status: 1 });
categorySchema.index({ sort_order: 1 });

// Static method to get all product categories
categorySchema.statics.getProductCategories = function() {
  return this.find({ type: 'product', status: 'active' }).sort({ sort_order: 1, name: 1 });
};

// Static method to get all tool categories
categorySchema.statics.getToolCategories = function() {
  return this.find({ type: 'tool', status: 'active' }).sort({ sort_order: 1, name: 1 });
};

// Method to check if category can be safely deleted
categorySchema.methods.canBeDeleted = async function() {
  const SKU = require('./SKU'); // Import SKU model
  
  try {
    // Check if any SKUs reference this category
    const skuCount = await SKU.countDocuments({ category_id: this._id });
    
    if (skuCount > 0) {
      return {
        allowed: false,
        reason: 'Category is in use',
        details: `${skuCount} SKU(s) are using this category`
      };
    }
    
    // Category can be safely deleted
    return {
      allowed: true,
      reason: 'Category is not in use',
      details: null
    };
    
  } catch (error) {
    console.error('Error checking if category can be deleted:', error);
    // In case of error, allow deletion but log the issue
    return {
      allowed: true,
      reason: 'Could not verify dependencies',
      details: error.message
    };
  }
};

// Method to get category statistics
categorySchema.methods.getStatistics = async function() {
  const SKU = require('./SKU');
  
  try {
    const stats = {
      totalSKUs: 0,
      activeSKUs: 0,
      inactiveSKUs: 0
    };
    
    // Get SKU counts for this category
    const [totalSKUs, activeSKUs] = await Promise.all([
      SKU.countDocuments({ category_id: this._id }),
      SKU.countDocuments({ category_id: this._id, status: 'active' })
    ]);
    
    stats.totalSKUs = totalSKUs;
    stats.activeSKUs = activeSKUs;
    stats.inactiveSKUs = totalSKUs - activeSKUs;
    
    return stats;
  } catch (error) {
    console.error('Error getting category statistics:', error);
    return {
      totalSKUs: 0,
      activeSKUs: 0,
      inactiveSKUs: 0,
      error: error.message
    };
  }
};

// Virtual for display name (capitalized)
categorySchema.virtual('displayName').get(function() {
  return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

// Ensure virtual fields are serialized
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', categorySchema);
