const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  product_type: {
    type: String,
    required: true,
    enum: ['wall', 'toilet', 'base', 'tub', 'vanity', 'shower_door', 'raw_material', 'accessory', 'miscellaneous'],
    lowercase: true
  },
  product_details: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'product_type_model'
  },
  product_type_model: {
    type: String,
    required: true,
    enum: ['Wall', 'Toilet', 'Base', 'Tub', 'Vanity', 'ShowerDoor', 'RawMaterial', 'Accessory', 'Miscellaneous']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  }
}, {
  timestamps: true
});

// Pre-save middleware to set the correct model name
itemSchema.pre('save', function(next) {
  const typeMapping = {
    'wall': 'Wall',
    'toilet': 'Toilet',
    'base': 'Base',
    'tub': 'Tub',
    'vanity': 'Vanity',
    'shower_door': 'ShowerDoor',
    'raw_material': 'RawMaterial',
    'accessory': 'Accessory',
    'miscellaneous': 'Miscellaneous'
  };
  
  this.product_type_model = typeMapping[this.product_type];
  next();
});

// Index for efficient searching
itemSchema.index({ product_type: 1, quantity: 1 });
itemSchema.index({ quantity: 1 });

module.exports = mongoose.model('Item', itemSchema);
