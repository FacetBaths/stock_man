# Tools Management API Workflow Documentation

## Overview

The Tools API provides comprehensive management of tool-specific operations including inventory tracking, checkout/loan management, returns, and condition management. This API is designed specifically for tools (as opposed to consumable products) and provides specialized workflows for equipment lending and maintenance.

## API Endpoints Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tools/inventory` | GET | Real-time tools inventory with availability tracking |
| `/api/tools/skus` | GET | Tools-only SKU management |
| `/api/tools/tags` | GET | Tools checkout/loan tags management |
| `/api/tools/checkout` | POST | Create tool checkout/loan |
| `/api/tools/:id/return` | POST | Return tools from checkout |
| `/api/tools/:id/condition` | PUT | Change tool condition status |

## Core Concepts

### Tool Categories
- Only SKUs with `category.type = 'tool'` are managed by this API
- Product categories are excluded from all tools endpoints
- Ensures separation of lendable tools from consumable products

### Tool Instances
- Each tool SKU has multiple physical instances
- Instances can be in different states: available, loaned, reserved, broken
- Instance availability is tracked via tag assignments (`tag_id`)

### Tag Types for Tools
- **`loaned`**: Tools checked out to contractors/customers
- **`reserved`**: Tools set aside for specific purposes or maintenance
- **`broken`**: Tools marked as non-functional
- **`stock`**: Tools in general stock (rarely used for active tools)

### Tool Conditions
- **`functional`**: Tool is working and available for use
- **`needs_maintenance`**: Tool requires maintenance before use
- **`broken`**: Tool is not functional and needs repair/replacement

## Detailed Workflow Documentation

### 1. Inventory Management

#### GET `/api/tools/inventory`
**Purpose**: Real-time inventory tracking for tools only

**Key Features**:
- Real-time calculation from actual instances (not cached data)
- Automatic exclusion of non-tool categories
- Breakdown by availability status (available, loaned, reserved, broken)

**Query Parameters**:
```
?category_id=<tool_category_id>  # Filter by specific tool category
?search=<term>                   # Search by SKU code, name, description
?status=all|low_stock|out_of_stock|overstock  # Filter by stock status
?page=1&limit=50                 # Pagination
?sort_by=sku_code&sort_order=asc # Sorting
```

**Response Structure**:
```json
{
  "inventory": [
    {
      "sku_id": "...",
      "sku_code": "TOOL-001",
      "name": "Cordless Drill",
      "category": { "name": "Power Tools", "type": "tool" },
      "total_quantity": 5,
      "available_quantity": 3,
      "loaned_quantity": 1,
      "reserved_quantity": 1,
      "broken_quantity": 0
    }
  ],
  "pagination": { ... }
}
```

### 2. SKU Management

#### GET `/api/tools/skus`
**Purpose**: Manage tool SKUs with optional inventory data

**Key Features**:
- Tools-only filtering (excludes product SKUs)
- Optional inventory data inclusion
- Category-based filtering (tools only)

**Query Parameters**:
```
?include_inventory=true          # Include real-time inventory data
?category_id=<tool_category_id> # Filter by tool category
?search=<term>                  # Search SKU details
?status=active|discontinued     # Filter by SKU status
?is_lendable=true|false        # Filter by lendability
```

### 3. Checkout/Loan Management

#### GET `/api/tools/tags`
**Purpose**: View and manage tool checkouts/loans

**Key Features**:
- Shows only tags containing tool SKUs
- Enriched data with fulfillment progress
- Multiple filtering options

**Query Parameters**:
```
?customer_name=<name>           # Filter by customer
?tag_type=loaned|reserved|broken # Filter by tag type
?status=active|fulfilled        # Filter by status
?overdue_only=true             # Show only overdue loans
?include_items=true            # Include SKU details
```

#### POST `/api/tools/checkout`
**Purpose**: Create tool checkout/loan

**Workflow**:
1. **Validation**: Ensure all SKUs are tools (not products)
2. **Tag Creation**: Create loan tag with customer details
3. **Instance Assignment**: Automatically assign available instances
4. **Audit Trail**: Log the checkout event

**Request Body**:
```json
{
  "customer_name": "John Contractor",
  "project_name": "Home Renovation", 
  "tag_type": "loaned",
  "sku_items": [
    {
      "sku_id": "tool_sku_id",
      "quantity": 2
    }
  ],
  "notes": "Tool checkout for contractor project",
  "due_date": "2024-01-15T10:00:00Z"
}
```

**Key Behaviors**:
- Automatically assigns available instances to the checkout tag
- Rejects non-tool SKUs with clear error messages
- Creates comprehensive audit log
- Updates real-time inventory availability

### 4. Return Management

#### POST `/api/tools/:id/return`
**Purpose**: Return tools from checkout/loan

**Workflow**:
1. **Validation**: Verify tag contains only tool SKUs
2. **Instance Release**: Set `tag_id = null` on all instances
3. **Condition Handling**: Create condition tags if needed
4. **Tag Fulfillment**: Mark original tag as fulfilled
5. **Audit Trail**: Log the return event

**Request Body**:
```json
{
  "return_notes": "Tools returned in good condition",
  "returned_condition": "functional|needs_maintenance|broken"
}
```

**Condition-Based Workflow**:

**Functional Returns**:
- Instances become available immediately (`tag_id = null`)
- No additional tags created
- Available inventory increases

**Maintenance Returns**:
- Creates new tag with `tag_type = 'reserved'`
- Project name: "Tool condition: needs_maintenance"
- Instances assigned to maintenance tag
- Tools marked as unavailable until maintenance completed

**Broken Returns**:
- Creates new tag with `tag_type = 'broken'`
- Project name: "Tool condition: broken"
- Instances assigned to broken tag
- Tools removed from available inventory

### 5. Condition Management

#### PUT `/api/tools/:id/condition`
**Purpose**: Change tool condition status independently

**Workflow**:
1. **Instance Validation**: Verify instance exists and is a tool
2. **Current State Check**: Determine current condition from tag assignment
3. **Condition Transition**: Move instance between condition states
4. **Tag Management**: Create/update condition tags as needed
5. **Audit Trail**: Log condition change event

**Request Body**:
```json
{
  "condition": "functional|needs_maintenance|broken",
  "reason": "Chuck is loose and needs tightening",
  "notes": "Additional maintenance notes if needed"
}
```

**Condition Transitions**:

**To Functional**:
- Remove from any condition tag (`tag_id = null`)
- Make tool available for checkout
- Fulfill condition tag if no instances remain

**To Needs Maintenance**:
- Create/assign to maintenance tag (`tag_type = 'reserved'`)
- Remove from available inventory
- Track reason and notes

**To Broken**:
- Create/assign to broken tag (`tag_type = 'broken'`)
- Remove from available inventory
- Higher audit log severity

**Business Rules**:
- Cannot change condition of actively loaned tools (except emergency broken)
- Must return tool first before condition changes
- Exception: Can mark loaned tool as broken for emergencies

## Data Flow Examples

### Example 1: Complete Tool Lifecycle

1. **Initial State**: 5 drill instances, all available
   ```
   Available: 5, Loaned: 0, Maintenance: 0, Broken: 0
   ```

2. **Checkout**: Contractor checks out 2 drills
   ```
   POST /api/tools/checkout
   → Available: 3, Loaned: 2, Maintenance: 0, Broken: 0
   ```

3. **Return with Maintenance**: Return 2 drills, 1 needs maintenance
   ```
   POST /api/tools/:id/return
   Body: { "returned_condition": "needs_maintenance" }
   → Available: 3, Loaned: 0, Maintenance: 2, Broken: 0
   ```

4. **Condition Change**: Fix maintenance drill
   ```
   PUT /api/tools/:instance_id/condition
   Body: { "condition": "functional" }
   → Available: 4, Loaned: 0, Maintenance: 1, Broken: 0
   ```

5. **Break Down**: Available drill breaks
   ```
   PUT /api/tools/:instance_id/condition
   Body: { "condition": "broken", "reason": "Motor failure" }
   → Available: 3, Loaned: 0, Maintenance: 1, Broken: 1
   ```

### Example 2: Emergency Broken Tool

1. **During Loan**: Tool is currently loaned to contractor
2. **Emergency Break**: Tool breaks during use
   ```
   PUT /api/tools/:instance_id/condition
   Body: { 
     "condition": "broken", 
     "reason": "Emergency - tool failed during use",
     "notes": "Contractor reported motor smoke"
   }
   ```
3. **Result**: Tool moved to broken status, audit log with high severity

## Error Handling

### Common Error Responses

**Non-Tool SKU Rejection**:
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "msg": "SKU PROD-001 is not a tool and cannot be checked out via tools API",
      "path": "sku_items"
    }
  ]
}
```

**Loaned Tool Condition Change**:
```json
{
  "message": "Cannot change condition of loaned tools. Return the tool first, or mark as broken if emergency."
}
```

**Invalid Condition**:
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Condition must be functional, needs_maintenance, or broken",
      "path": "condition"
    }
  ]
}
```

## Audit Trail

All tool operations create comprehensive audit logs:

### Event Types
- `tag_created` - Tool checkout created
- `tag_returned` - Tools returned
- `tool_condition_changed` - Tool condition modified

### Audit Log Structure
```json
{
  "event_type": "tool_condition_changed",
  "entity_type": "instance",
  "entity_id": "instance_id",
  "user_id": "user_id",
  "user_name": "username",
  "action": "CHANGE_TOOL_CONDITION",
  "description": "Tool condition changed from functional to broken: Cordless Drill (TOOL-001)",
  "metadata": {
    "instance_id": "...",
    "sku_id": "...",
    "sku_code": "TOOL-001",
    "old_condition": "functional",
    "new_condition": "broken",
    "reason": "Motor failure",
    "notes": "Needs motor replacement"
  },
  "category": "maintenance",
  "severity": "medium"
}
```

## Integration Points

### Real-Time Inventory Updates
- All operations immediately update inventory availability
- No cached data - all calculations from live instances
- Consistent across all endpoints

### Tag-Based State Management
- Tool states managed through tag assignments
- `tag_id = null` means available
- Different tag types represent different tool states

### Instance Preservation
- Instances are never deleted, only reassigned
- Complete traceability of tool history
- Supports detailed reporting and analytics

## Performance Considerations

### Aggregation Pipelines
- Inventory calculations use MongoDB aggregation
- Efficient real-time computation
- Proper indexing on commonly queried fields

### Filtering Strategy
- Category-type filtering at database level
- Early filtering reduces data transfer
- Pagination for large datasets

### Audit Log Management
- Structured logging for searchability
- Appropriate severity levels
- Retention policies for historical data

## Security & Authorization

### Authentication Required
- All endpoints require valid JWT token
- User context included in audit logs

### Write Access Control
- Checkout, return, and condition changes require write permissions
- Role-based access control through middleware

### Input Validation
- Comprehensive validation on all inputs
- MongoDB injection prevention
- Business rule enforcement

This documentation provides the complete workflow for the Tools Management API, including the new condition management functionality. The system provides comprehensive tool lifecycle management with proper audit trails and real-time inventory tracking.
