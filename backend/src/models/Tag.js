const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  customer_name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  tag_type: {
    type: String,
    enum: ['stock', 'reserved', 'broken', 'imperfect'],
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

// Index for efficient searching
tagSchema.index({ item_id: 1, status: 1 });
tagSchema.index({ customer_name: 1, status: 1 });
tagSchema.index({ created_by: 1 });

module.exports = mongoose.model('Tag', tagSchema);
