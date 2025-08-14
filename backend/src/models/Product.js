const mongoose = require('mongoose');

// Generic product schema for non-wall items
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  dimensions: {
    type: String,
    trim: true
  },
  finish: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  specifications: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

// Models for different product types
const Toilet = mongoose.model('Toilet', productSchema);
const Base = mongoose.model('Base', productSchema);
const Tub = mongoose.model('Tub', productSchema);
const Vanity = mongoose.model('Vanity', productSchema);
const ShowerDoor = mongoose.model('ShowerDoor', productSchema);
const RawMaterial = mongoose.model('RawMaterial', productSchema);
const Accessory = mongoose.model('Accessory', productSchema);
const Miscellaneous = mongoose.model('Miscellaneous', productSchema);

module.exports = {
  Toilet,
  Base,
  Tub,
  Vanity,
  ShowerDoor,
  RawMaterial,
  Accessory,
  Miscellaneous,
  productSchema
};
