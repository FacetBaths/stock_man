# Tools Management API Reference

## Overview

This document provides a quick reference for the Tools Management API endpoints. All endpoints are prefixed with `/api/tools` and require authentication.

## Base URL
```
http://localhost:5000/api/tools
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/inventory` | Get tools-only inventory | ✅ |
| `GET` | `/skus` | Get tools-only SKUs | ✅ |
| `GET` | `/tags` | Get tools-only checkout/loan tags | ✅ |
| `POST` | `/checkout` | Create tool checkout/loan | ✅ (Write) |
| `POST` | `/:id/return` | Return tools from checkout | ✅ (Write) |
| `PUT` | `/:id/condition` | Change tool condition status | ✅ (Write) |

---

## Endpoint Details

### GET /api/tools/inventory
**Purpose**: Real-time tools inventory with availability tracking

**Query Parameters**:
```
?category_id=<tool_category_id>  # Filter by specific tool category
?search=<term>                   # Search by SKU code, name, description
?status=all|low_stock|out_of_stock|overstock  # Filter by stock status
?page=1&limit=50                 # Pagination
?sort_by=sku_code&sort_order=asc # Sorting
```

**Response Example**:
```json
{
  "inventory": [
    {
      "sku_id": "64f8a1b2c3d4e5f6789012ab",
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
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalRecords": 1,
    "limit": 50,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### GET /api/tools/skus
**Purpose**: Manage tool SKUs with optional inventory data

**Query Parameters**:
```
?include_inventory=true          # Include real-time inventory data
?category_id=<tool_category_id> # Filter by tool category
?search=<term>                  # Search SKU details
?status=active|discontinued     # Filter by SKU status
?is_lendable=true|false        # Filter by lendability
?page=1&limit=50               # Pagination
?sort_by=sku_code&sort_order=asc # Sorting
```

### GET /api/tools/tags
**Purpose**: View and manage tool checkouts/loans

**Query Parameters**:
```
?customer_name=<name>           # Filter by customer
?tag_type=loaned|reserved|broken # Filter by tag type
?status=active|fulfilled        # Filter by status
?overdue_only=true             # Show only overdue loans
?include_items=true            # Include SKU details
?page=1&limit=50               # Pagination
```

### POST /api/tools/checkout
**Purpose**: Create tool checkout/loan

**Request Body**:
```json
{
  "customer_name": "John Contractor",
  "project_name": "Home Renovation", 
  "tag_type": "loaned",
  "sku_items": [
    {
      "sku_id": "64f8a1b2c3d4e5f6789012ab",
      "quantity": 2
    }
  ],
  "notes": "Tool checkout for contractor project",
  "due_date": "2024-01-15T10:00:00Z"
}
```

**Response**:
```json
{
  "message": "Tool checkout created successfully",
  "tag": {
    "_id": "64f8a1b2c3d4e5f6789012cd",
    "customer_name": "John Contractor",
    "tag_type": "loaned",
    "sku_items": [...],
    "total_quantity": 2,
    "remaining_quantity": 0
  }
}
```

### POST /api/tools/:id/return
**Purpose**: Return tools from checkout/loan

**Parameters**:
- `:id` - Tag ID (MongoDB ObjectId)

**Request Body**:
```json
{
  "return_notes": "Tools returned in good condition",
  "returned_condition": "functional|needs_maintenance|broken"
}
```

**Response**:
```json
{
  "message": "Tools returned successfully",
  "tag": {...},
  "instances_returned": 2,
  "condition": "functional"
}
```

### POST /api/tools/:id/partial-return
Purpose: Partial return of selected tool instances from a loan

Request Body:
```json
{
  "items": [
    { "sku_id": "<skuId>", "instance_ids": ["<instId1>", "<instId2>"] }
  ],
  "return_notes": "Returned some tools",
  "returned_condition": "functional|needs_maintenance|broken"
}
```

Response:
```json
{
  "message": "Partial return processed successfully",
  "tag": { ... },
  "instances_returned": 2,
  "condition": "functional"
}
```

### PUT /api/tools/:id/condition
**Purpose**: Change tool condition status independently

**Parameters**:
- `:id` - Instance ID (MongoDB ObjectId)

**Request Body**:
```json
{
  "condition": "functional|needs_maintenance|broken",
  "reason": "Chuck is loose and needs tightening",
  "notes": "Additional maintenance notes if needed"
}
```

**Response**:
```json
{
  "message": "Tool condition updated successfully",
  "instance": {
    "_id": "64f8a1b2c3d4e5f6789012ef",
    "sku_id": {...},
    "condition": "needs_maintenance",
    "tag_id": "64f8a1b2c3d4e5f6789012gh",
    "location": "Warehouse A"
  },
  "previous_condition": "functional",
  "action_description": "Tool marked as needs_maintenance (Chuck is loose and needs tightening)"
}
```

---

## Condition Management

### Tool Conditions
- **`functional`**: Tool is working and available for use
- **`needs_maintenance`**: Tool requires maintenance before use  
- **`broken`**: Tool is not functional and needs repair/replacement

### Condition Transitions
```
functional ←→ needs_maintenance
functional ←→ broken
needs_maintenance ←→ broken
```

### Business Rules
- Cannot change condition of actively loaned tools (except emergency broken)
- Must return tool first before condition changes
- Exception: Can mark loaned tool as broken for emergencies

---

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

**Authentication Required**:
```json
{
  "message": "Unauthorized - Token required"
}
```

**Insufficient Permissions**:
```json
{
  "message": "Forbidden - Write access required"
}
```

---

## Data Models

### Tool Inventory Item
```typescript
interface ToolInventoryItem {
  sku_id: string;
  sku_code: string;
  name: string;
  description?: string;
  category: {
    name: string;
    type: 'tool';
  };
  total_quantity: number;
  available_quantity: number;
  loaned_quantity: number;
  reserved_quantity: number;
  broken_quantity: number;
  unit_cost: number;
  is_lendable: boolean;
}
```

### Tool SKU
```typescript
interface ToolSKU {
  _id: string;
  sku_code: string;
  name: string;
  description?: string;
  category_id: {
    _id: string;
    name: string;
    type: 'tool';
  };
  unit_cost: number;
  status: 'active' | 'discontinued' | 'pending';
  is_lendable: boolean;
  created_at: string;
  updated_at: string;
  inventory?: ToolInventoryItem; // When include_inventory=true
}
```

### Tool Checkout Tag
```typescript
interface ToolCheckoutTag {
  _id: string;
  customer_name: string;
  project_name?: string;
  tag_type: 'loaned' | 'reserved' | 'broken';
  sku_items: Array<{
    sku_id: ToolSKU;
    quantity: number;
    remaining_quantity: number;
    selected_instance_ids: string[];
    selection_method: 'auto' | 'manual';
    notes?: string;
  }>;
  status: 'active' | 'fulfilled' | 'cancelled';
  due_date?: string;
  notes?: string;
  total_quantity: number;
  remaining_quantity: number;
  is_overdue: boolean;
  fulfillment_progress: number;
  created_at: string;
}
```

### Tool Instance
```typescript
interface ToolInstance {
  _id: string;
  sku_id: ToolSKU;
  tag_id?: string | null;
  condition: 'functional' | 'needs_maintenance' | 'broken';
  location?: string;
  acquisition_cost: number;
  added_by: string;
  created_at: string;
}
```

---

## Testing with curl

### Get Tools Inventory
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/tools/inventory"
```

### Create Tool Checkout
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Contractor",
    "project_name": "Site A",
    "sku_items": [{"sku_id": "TOOL_ID", "quantity": 1}]
  }' \
  "http://localhost:5000/api/tools/checkout"
```

### Return Tools
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "return_notes": "Returned in good condition",
    "returned_condition": "functional"
  }' \
  "http://localhost:5000/api/tools/TAG_ID/return"
```

### Change Tool Condition
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "needs_maintenance",
    "reason": "Chuck is loose",
    "notes": "Needs tightening before next use"
  }' \
  "http://localhost:5000/api/tools/INSTANCE_ID/condition"
```

---

## Frontend Integration Notes

### State Management
- All tools data should be kept separate from products data
- Use real-time inventory data rather than cached values
- Tool conditions are instance-based, not SKU-based

### UI Considerations
- Always show tool condition status clearly
- Indicate when tools are loaned vs available
- Provide clear checkout/return workflows
- Emergency broken condition should be easily accessible

### Performance
- Use pagination for large tool inventories
- Consider caching tool categories and basic SKU info
- Refresh inventory data after checkout/return operations

### Error Handling
- Handle tool/product separation validation errors gracefully
- Provide clear feedback for condition change restrictions
- Show meaningful error messages for business rule violations

This API provides complete tools management functionality with proper separation from products, comprehensive condition management, and detailed audit trails.
