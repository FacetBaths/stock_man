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

// Virtual for display name (capitalized)
categorySchema.virtual('displayName').get(function() {
  return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

// Ensure virtual fields are serialized
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', categorySchema);
