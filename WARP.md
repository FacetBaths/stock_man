# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Stock Manager is a modern inventory management system for Facet Renovations built with Vue 3 + TypeScript frontend, Express.js backend, and MongoDB. It features a SKU-centric architecture with individual product instance tracking, smart tagging system, and role-based access control.

## Tech Stack

### Backend
- **Node.js** with **Express.js** framework
- **MongoDB** with **Mongoose** ODM
- **JWT** authentication with refresh tokens
- **Express Validator** for input validation
- **Jest** + **Supertest** for testing
- **Nodemon** for development
- **bcryptjs** for password hashing

### Frontend
- **Vue 3** with **Composition API** and `<script setup>` syntax
- **TypeScript** for type safety
- **Quasar Framework** - Use Quasar components (q-table, q-dialog, q-btn, etc.)
- **Pinia** for state management
- **Vue Router** with hash-based routing (`createWebHashHistory`)
- **Vite** as build tool and dev server
- **Axios** for HTTP requests
- **AOS** (Animate on Scroll) for animations

### Key Frontend Configurations
- **Vite config** (`vite.config.ts`): Quasar plugin, proxy to backend
- **Quasar setup** (`main.ts`): Material icons, plugins (Loading, Notify, Dialog)
- **TypeScript** (`tsconfig.json`): Strict mode with path aliases

## Development Commands

### Prerequisites
- Node.js v16+ and MongoDB running locally or remote connection

### Installation & Setup
```bash
# Install all dependencies (both frontend and backend)
npm run install

# Set up environment (copy and edit .env)
cd backend && cp .env.example .env
# Edit .env with your MongoDB URI and secrets
```

### Development Server
```bash
# Start both backend and frontend together (recommended)
npm run dev

# Start services individually
npm run dev:backend    # Backend on http://localhost:5000
npm run dev:frontend   # Frontend on http://localhost:3000
```

### Testing
```bash
# Backend tests with Jest
cd backend && npm test
npm run test:watch     # Watch mode

# Kill backend server
cd backend && npm run kill
```

### Build & Deployment
```bash
# Frontend production build (with Vite)
npm run build:frontend

# Backend production
cd backend && npm start
```

### Utility Commands
```bash
# Clean all dependencies
npm run clean

# Reset everything (clean + reinstall)
npm run reset

# Generate build info (frontend)
cd frontend && npm run generate-build-info
```

## Data Models & Fields

### SKU Model (Product/Tool Master Data)
**Path**: `backend/src/models/SKU.js`
**Collection**: `skus`

**Core Fields**:
```javascript
{
  sku_code: String,              // Required, unique, uppercase
  category_id: ObjectId,         // Required, ref to Category
  name: String,                  // Required product name
  description: String,           // Optional description
  brand: String,                 // Product brand
  model: String,                 // Product model
  
  // Polymorphic details based on category
  details: {
    // For walls:
    product_line: String,
    color_name: String,
    dimensions: String,
    finish: String,
    
    // For tools:
    tool_type: String,
    manufacturer: String,
    serial_number: String,
    voltage: String,
    features: [String],
    
    // Common:
    weight: Number,
    specifications: Mixed
  },
  
  // Costing
  unit_cost: Number,             // Current cost
  currency: String,              // Default 'USD'
  cost_history: [{
    cost: Number,
    effective_date: Date,
    updated_by: String,
    notes: String
  }],
  
  // Status & metadata
  status: String,                // 'active', 'discontinued', 'pending'
  barcode: String,               // Optional, indexed
  supplier_info: {
    supplier_name: String,
    supplier_sku: String,
    lead_time_days: Number
  },
  images: [String],              // Image URLs
  stock_thresholds: {
    understocked: Number,
    overstocked: Number
  },
  
  // Bundle configuration
  is_bundle: Boolean,
  bundle_items: [{
    sku_id: ObjectId,            // ref to SKU
    quantity: Number,
    description: String
  }],
  
  // Tracking
  created_by: String,            // Required
  last_updated_by: String        // Required
}
```

**Key Methods**:
- `addCost(cost, updatedBy, notes)` - Add cost to history
- `getCostAtDate(date)` - Get historical cost
- `getStockStatus(currentQuantity)` - Check stock level
- `getDisplayName()` - Get formatted display name
- `canBeDeleted()` - Check if SKU can be safely deleted

### Instance Model (Individual Physical Items)
**Path**: `backend/src/models/Instance.js`
**Collection**: `instances`

**Fields**:
```javascript
{
  sku_id: ObjectId,              // Required, ref to SKU
  acquisition_date: Date,        // Required, when acquired
  acquisition_cost: Number,      // Required, cost when acquired (frozen)
  tag_id: ObjectId,              // Optional, ref to Tag (null = available)
  location: String,              // Physical location, default 'HQ'
  supplier: String,              // Optional supplier info
  reference_number: String,      // Optional PO#, invoice#, etc.
  notes: String,                 // Optional instance notes
  added_by: String               // Required, who added this instance
}
```

**Key Methods**:
- `isAvailable()` - Check if instance is not tagged
- `assignToTag(tagId, updatedBy)` - Tag this instance
- `releaseFromTag()` - Release from tag (make available)

**Static Methods**:
- `findAvailableForSKU(skuId, limit)` - Find available instances (FIFO)
- `findAvailableByCost(skuId, costCriteria, limit)` - Find by cost criteria
- `findByTag(tagId)` - Get instances for a tag
- `countAvailableForSKU(skuId)` - Count available instances
- `getCostSummaryForSKU(skuId)` - Get cost analysis

### Tag Model (Instance-Based Allocation)
**Path**: `backend/src/models/Tag.js`
**Collection**: `tags`

**Fields**:
```javascript
{
  customer_name: String,         // Required, indexed
  tag_type: String,              // 'reserved', 'broken', 'imperfect', 'loaned', 'stock'
  status: String,                // 'active', 'fulfilled', 'cancelled'
  
  sku_items: [{
    sku_id: ObjectId,            // Required, ref to SKU
    selected_instance_ids: [ObjectId], // Required, refs to Instance
    selection_method: String,    // 'auto', 'manual', 'fifo', 'cost_based'
    notes: String,
    // Legacy fields for migration compatibility:
    quantity: Number,            // Optional during transition
    remaining_quantity: Number   // Optional during transition
  }],
  
  // Metadata
  notes: String,
  due_date: Date,                // Optional, indexed
  project_name: String,          // Optional, indexed
  
  // Tracking
  created_by: String,            // Required, indexed
  last_updated_by: String,       // Required
  fulfilled_date: Date,          // Optional
  fulfilled_by: String           // Optional
}
```

**Key Methods**:
- `isPartiallyFulfilled()` - Check if partially fulfilled
- `isFullyFulfilled()` - Check if fully fulfilled
- `getRemainingItems()` - Get unfulfilled items
- `getTotalQuantity()` - Get total quantity across all items
- `getTotalRemainingQuantity()` - Get total remaining quantity
- `assignInstances()` - Auto-assign instances based on selection method
- `fulfillItems()` - Fulfill all items (delete instances)
- `fulfillSpecificItems(fulfillmentData, fulfilledBy)` - Partial fulfillment
- `cancel(cancelledBy, reason)` - Cancel the tag

### Inventory Model (Real-Time Aggregation)
**Path**: `backend/src/models/Inventory.js`
**Collection**: `inventory`

**Fields**:
```javascript
{
  sku_id: ObjectId,              // Required, unique, ref to SKU
  
  // Current levels (auto-calculated)
  total_quantity: Number,        // Required, min: 0
  available_quantity: Number,    // Required, min: 0
  reserved_quantity: Number,     // Required, min: 0
  broken_quantity: Number,       // Required, min: 0
  loaned_quantity: Number,       // Required, min: 0
  
  // Thresholds
  minimum_stock_level: Number,   // Default: 0
  reorder_point: Number,         // Default: 0
  maximum_stock_level: Number,   // Optional
  
  // Valuation
  total_value: Number,           // Auto-calculated
  average_cost: Number,          // Auto-calculated
  
  // Status flags (auto-calculated)
  is_active: Boolean,            // Default: true
  is_low_stock: Boolean,         // Auto-calculated
  is_out_of_stock: Boolean,      // Auto-calculated
  is_overstock: Boolean,         // Auto-calculated
  
  // Tracking
  last_movement_date: Date,      // Auto-updated
  last_updated_by: String        // Default: 'System'
}
```

**Key Methods**:
- `updateQuantities(updates, updatedBy)` - Update all quantities
- `reserveQuantity(quantity, updatedBy)` - Reserve inventory
- `releaseReservedQuantity(quantity, updatedBy)` - Release reserved
- `moveInventory(fromStatus, toStatus, quantity, updatedBy)` - Move between statuses
- `addStock(quantity, cost, updatedBy)` - Add new stock
- `removeStock(fromStatus, quantity, reason, updatedBy)` - Remove stock
- `needsReorder()` - Check if reorder needed
- `getSummary()` - Get inventory summary object

### Category Model (Product Organization)
**Path**: `backend/src/models/Category.js`
**Collection**: `categories`

**Fields**:
```javascript
{
  name: String,                  // Required, unique, lowercase, indexed
  type: String,                  // Required, 'product' or 'tool'
  description: String,           // Optional
  attributes: [String],          // Required fields for this category
  sort_order: Number,            // Display order, default: 0
  status: String                 // 'active' or 'inactive'
}
```

**Static Methods**:
- `getProductCategories()` - Get all product categories
- `getToolCategories()` - Get all tool categories

**Instance Methods**:
- `canBeDeleted()` - Check if category can be safely deleted
- `getStatistics()` - Get category statistics

### User Model (Authentication & Roles)
**Path**: `backend/src/models/User.js`
**Collection**: `users`

**Fields**:
```javascript
{
  // Basic info
  username: String,              // Required, unique, 3-30 chars
  email: String,                 // Required, unique, validated
  password: String,              // Required, min 6 chars (hashed)
  firstName: String,             // Required, max 50 chars
  lastName: String,              // Required, max 50 chars
  
  // Role & permissions
  role: String,                  // 'admin', 'warehouse_manager', 'sales_rep', 'viewer'
  
  // Account status
  isActive: Boolean,             // Default: true
  isEmailVerified: Boolean,      // Default: false
  
  // Security
  lastLogin: Date,
  loginAttempts: Number,         // Default: 0
  lockUntil: Date,               // Account lock expiry
  passwordChangedAt: Date,       // Auto-updated
  
  // Refresh tokens for JWT
  refreshTokens: [{
    token: String,               // Required
    createdAt: Date,             // Auto-expires after 7 days
    userAgent: String,
    ipAddress: String
  }],
  
  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // User preferences
  preferences: {
    theme: String,               // 'light', 'dark', 'auto'
    language: String,            // Default: 'en'
    notifications: {
      email: Boolean,
      lowStock: Boolean,
      systemAlerts: Boolean
    }
  }
}
```

**Key Methods**:
- `comparePassword(candidatePassword)` - Check password
- `incLoginAttempts()` - Increment failed attempts
- `resetLoginAttempts()` - Reset failed attempts
- `updateLastLogin()` - Update last login time
- `generateTokens()` - Generate access & refresh tokens
- `addRefreshToken(token, userAgent, ipAddress)` - Store refresh token
- `removeRefreshToken(token)` - Remove specific refresh token
- `toSafeObject()` - Get user object without sensitive data

## Architecture Overview

### Core Concepts
- **SKU-centric Design**: Single source of truth for products with individual instance tracking
- **Instance-Based Tags**: Physical items are tagged individually, not in bulk quantities
- **Real-time Inventory**: Automatic quantity calculations from instance allocations
- **Tools vs Products**: Separate handling for lendable tools vs regular inventory products

### API Routes Structure

**Authentication** (`/api/auth`):
- `POST /login` - User login with JWT tokens
- `GET /me` - Get current user info
- `POST /logout` - User logout
- `POST /refresh` - Refresh access token

**SKUs** (`/api/skus`) - Products only (excludes tools):
- `GET /` - Get all SKUs with filtering
- `GET /:id` - Get single SKU
- `POST /` - Create new SKU (Admin/Warehouse only)
- `PUT /:id` - Update SKU (Admin/Warehouse only)
- `DELETE /:id` - Delete SKU (Admin/Warehouse only)

**Instances** (`/api/instances`):
- `GET /:sku_id` - Get instances for a SKU
- `POST /add-stock` - Add new stock instances
- `PUT /:id` - Update instance details
- `GET /cost-breakdown/:sku_id` - Get cost analysis

**Tags** (`/api/tags`) - Reservations/loans:
- `GET /` - Get all tags with filters
- `POST /` - Create new tag
- `PUT /:id` - Update tag
- `DELETE /:id` - Delete tag
- `POST /:id/fulfill` - Fulfill specific items

**Tools** (`/api/tools`) - Tools-only API:
- `GET /inventory` - Get tools inventory
- `GET /skus` - Get tool SKUs only
- `POST /checkout` - Create tool checkout/loan
- `POST /:id/return` - Return tools
- `PUT /:id/condition` - Change tool condition

**Categories** (`/api/categories`):
- `GET /` - Get all categories
- `POST /` - Create category (Admin only)
- `PUT /:id` - Update category (Admin only)
- `DELETE /:id` - Delete category (Admin only)

### Frontend Architecture (`frontend/src/`)

**Vue 3 + Quasar Components**:
- Use **Quasar components** exclusively (q-table, q-dialog, q-btn, q-input, q-select, etc.)
- **Material Icons** available via Quasar (`@quasar/extras/material-icons`)
- **Composition API** with TypeScript for all components
- **Pinia stores** for state management with reactivity

**Store Pattern** (Pinia):
- `auth.ts` - Authentication state with JWT token refresh
- `inventory.ts` - Real-time inventory data
- `sku.ts` - Product management
- `tools.ts` - Tools-specific operations
- `tag.ts` - Tag/allocation management
- `category.ts` - Category management
- `users.ts` - User management (Admin only)

**Key Views**:
- `Dashboard.vue` - Overview with stats (uses q-card, q-stat)
- `SKUManagement.vue` - Product CRUD (uses q-table, q-dialog)
- `Tools.vue` - Tool checkout/return interface (uses q-stepper)
- `Tags.vue` - Reservation/loan management (uses q-expansion-item)
- `Login.vue` - Authentication (uses q-form, q-input)
- `UserManagement.vue` - User management (Admin only)

### Role-Based Access Control

**Roles & Permissions**:
- **Admin**: Full access, user management, can delete anything
- **Warehouse Manager**: Inventory operations, no user management
- **Sales Rep**: Read-only access to inventory and tags
- **Viewer**: Basic read-only access

**Permission Checking**:
- Frontend: Use `authStore.canWrite`, `authStore.isAdmin`, `authStore.hasRole()`
- Backend: Middleware `requireWriteAccess`, `requireRole('admin')`

## Development Guidelines

### Frontend Development (Vue 3 + Quasar)
- **Always use Quasar components** instead of native HTML elements
- **Use Composition API** with `<script setup lang="ts">`
- **Pinia stores** for state management, not direct API calls in components
- **TypeScript interfaces** defined in `src/types/` directory
- **Quasar plugins**: Loading, Notify, Dialog available globally

### Component Patterns
```vue
<!-- Example component structure -->
<template>
  <q-page padding>
    <q-table
      :rows="items"
      :columns="columns"
      :loading="loading"
      @request="onRequest"
    >
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat dense icon="edit" @click="editItem(props.row)" />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup lang="ts">
import { useInventoryStore } from '@/stores/inventory'
import type { SKU } from '@/types'

const inventoryStore = useInventoryStore()
// Use Pinia composable pattern
</script>
```

### Backend Development Patterns

**Model Usage**:
- Use Mongoose models with proper validation
- Leverage virtual fields and methods for business logic
- Always populate references when needed for display

**API Design**:
- Use Express Validator for input validation
- Implement proper error handling with meaningful messages
- Return consistent JSON responses
- Use proper HTTP status codes

**Instance-Based Tag System**:
- When creating tags: specify SKU and quantity, system auto-selects instances
- Use `manual` selection for specific instances
- Support partial fulfillment and returns
- Real-time inventory calculation (no manual updates needed)

### Environment Configuration
- **Vite Configuration**: Proxy setup for `/api` routes to backend
- **Quasar Framework**: Auto-imports components, uses Material Icons
- **CORS**: Configured for development origins in `backend/src/server.js`
- **MongoDB**: Connection via `MONGODB_URI` environment variable
- **JWT**: Access tokens (15min) + refresh tokens (7 days)

### Testing & Development
- **Backend Testing**: Jest with MongoDB memory server
- **Test Location**: `backend/test/` directory
- **Watch Mode**: Use `npm run test:watch` for TDD
- **Development Server**: Hot reload with Nodemon (backend) and Vite (frontend)

### Key Business Rules
- **Tools vs Products**: Categories determine behavior (tool checkout vs product inventory)
- **Instance Tracking**: Every physical item has acquisition cost and location
- **FIFO by Default**: Oldest instances selected first unless specified otherwise
- **Real-time Calculations**: Inventory quantities calculated from instance allocations
- **Cost Tracking**: Historical cost tracking per SKU with frozen acquisition costs per instance
