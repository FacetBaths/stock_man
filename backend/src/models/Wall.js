const mongoose = require('mongoose');

const wallSchema = new mongoose.Schema({
  product_line: {
    type: String,
    required: true,
    trim: true
  },
  color_name: {
    type: String,
    required: true,
    trim: true
  },
  dimensions: {
    type: String,
    required: true,
    trim: true
  },
  finish: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Create compound index for uniqueness
wallSchema.index({ 
  product_line: 1, 
  color_name: 1, 
  dimensions: 1, 
  finish: 1 
}, { unique: true });

module.exports = mongoose.model('Wall', wallSchema);
