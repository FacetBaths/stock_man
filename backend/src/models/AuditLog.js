const mongoose = require('mongoose');

// Audit log model for tracking all system changes and events
const auditLogSchema = new mongoose.Schema({
  // Event identification
  event_type: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'login', 'logout', 'authentication',
      'inventory_movement', 'tag_created', 'tag_fulfilled', 'tag_cancelled',
      'item_added', 'item_removed', 'item_transferred',
      'customer_created', 'customer_updated',
      'sku_created', 'sku_updated', 'sku_deleted',
      'system_backup', 'system_restore', 'migration_started', 'migration_completed',
      'error', 'warning', 'info'
    ],
    index: true
  },
  
  // Entity information
  entity_type: {
    type: String,
    required: true,
    enum: ['customer', 'category', 'sku', 'item', 'tag', 'inventory', 'user', 'system'],
    index: true
  },
  
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // User who performed the action
  user_id: {
    type: String,
    required: true,
    index: true
  },
  
  user_name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Data changes (for update events)
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  
  // Additional context
  metadata: {
    ip_address: String,
    user_agent: String,
    session_id: String,
    request_id: String,
    api_endpoint: String,
    method: String,
    response_status: Number,
    response_time_ms: Number
  },
  
  // Categorization
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  
  category: {
    type: String,
    enum: ['security', 'business', 'system', 'error', 'performance'],
    default: 'business',
    index: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['success', 'failure', 'pending', 'warning'],
    default: 'success',
    index: true
  },
  
  // Error information (if applicable)
  error_details: {
    message: String,
    stack: String,
    code: String
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false, // Using custom timestamp field
  capped: { 
    size: 100 * 1024 * 1024, // 100MB cap for audit logs
    max: 1000000 // Maximum 1M documents
  }
});

// Static method to log an event
auditLogSchema.statics.logEvent = function(eventData) {
  const {
    event_type,
    entity_type,
    entity_id,
    user_id,
    user_name,
    action,
    description,
    changes,
    metadata = {},
    severity = 'low',
    category = 'business',
    status = 'success',
    error_details
  } = eventData;
  
  return this.create({
    event_type,
    entity_type,
    entity_id,
    user_id,
    user_name,
    action,
    description,
    changes,
    metadata,
    severity,
    category,
    status,
    error_details,
    timestamp: new Date()
  });
};

// Static method to log inventory movement
auditLogSchema.statics.logInventoryMovement = function(movementData) {
  const {
    sku_id,
    item_id,
    from_status,
    to_status,
    quantity,
    user_id,
    user_name,
    reason,
    tag_id
  } = movementData;
  
  return this.logEvent({
    event_type: 'inventory_movement',
    entity_type: 'inventory',
    entity_id: sku_id,
    user_id,
    user_name,
    action: `Moved ${quantity} items from ${from_status} to ${to_status}`,
    description: `Inventory movement: ${quantity} units of SKU ${sku_id} moved from ${from_status} to ${to_status}${reason ? `. Reason: ${reason}` : ''}`,
    metadata: {
      item_id,
      tag_id,
      from_status,
      to_status,
      quantity,
      reason
    },
    category: 'business'
  });
};

// Static method to log tag events
auditLogSchema.statics.logTagEvent = function(tagEventData) {
  const {
    event_type, // 'tag_created', 'tag_fulfilled', 'tag_cancelled'
    tag_id,
    customer_id,
    user_id,
    user_name,
    tag_type,
    items_count,
    total_quantity,
    reason
  } = tagEventData;
  
  const actionMap = {
    'tag_created': 'Created',
    'tag_fulfilled': 'Fulfilled',
    'tag_cancelled': 'Cancelled'
  };
  
  const action = actionMap[event_type];
  
  return this.logEvent({
    event_type,
    entity_type: 'tag',
    entity_id: tag_id,
    user_id,
    user_name,
    action: `${action} ${tag_type} tag`,
    description: `${action} ${tag_type} tag for customer ${customer_id} with ${items_count} items (${total_quantity} total quantity)${reason ? `. Reason: ${reason}` : ''}`,
    metadata: {
      customer_id,
      tag_type,
      items_count,
      total_quantity,
      reason
    },
    category: 'business',
    severity: event_type === 'tag_cancelled' ? 'medium' : 'low'
  });
};

// Static method to log system events
auditLogSchema.statics.logSystemEvent = function(systemEventData) {
  const {
    event_type,
    user_id,
    user_name,
    action,
    description,
    metadata = {},
    severity = 'medium'
  } = systemEventData;
  
  return this.logEvent({
    event_type,
    entity_type: 'system',
    user_id,
    user_name,
    action,
    description,
    metadata,
    severity,
    category: 'system'
  });
};

// Static method to log errors
auditLogSchema.statics.logError = function(errorData) {
  const {
    error,
    user_id = 'system',
    user_name = 'System',
    action,
    description,
    entity_type = 'system',
    entity_id,
    metadata = {}
  } = errorData;
  
  return this.logEvent({
    event_type: 'error',
    entity_type,
    entity_id,
    user_id,
    user_name,
    action: action || 'Error occurred',
    description: description || error.message || 'An error occurred',
    metadata,
    severity: 'high',
    category: 'error',
    status: 'failure',
    error_details: {
      message: error.message,
      stack: error.stack,
      code: error.code
    }
  });
};

// Static method to get audit trail for an entity
auditLogSchema.statics.getAuditTrail = function(entityType, entityId, limit = 50) {
  return this.find({
    entity_type: entityType,
    entity_id: entityId
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

// Static method to get recent activity
auditLogSchema.statics.getRecentActivity = function(limit = 100) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get activity by user
auditLogSchema.statics.getUserActivity = function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Indexes for performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ event_type: 1, timestamp: -1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1, timestamp: -1 });
auditLogSchema.index({ user_id: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });

// Compound index for common queries
auditLogSchema.index({ entity_type: 1, event_type: 1, timestamp: -1 });
auditLogSchema.index({ user_id: 1, event_type: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
