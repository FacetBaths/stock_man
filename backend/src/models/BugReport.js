const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  author_role: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const bugReportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['bug', 'feature_request'],
    required: true,
    index: true
  },
  area: {
    type: String,
    enum: ['dashboard', 'skus', 'tags', 'tools', 'multiple', 'other'],
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open',
    index: true
  },
  created_by: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  created_by_role: {
    type: String,
    trim: true
  },
  replies: {
    type: [replySchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BugReport', bugReportSchema);
