# Stock Manager Directory Structure
**Last Updated:** 2025-08-27 21:06 UTC
**Status:** Enhanced with Instance-Based Tag Architecture

## 🏗️ **PROJECT OVERVIEW**
Stock Management System for Facet Renovations with Vue 3 frontend, Express.js backend, and MongoDB database.

## 📁 **ROOT DIRECTORY**
```
stock_manager/
├── 📋 ACCOUNTABILITY.md              # AI workflow accountability system
├── 📋 WORKFLOW_DISCIPLINE.md         # Development process rules
├── 📋 VUMO_PROTOCOL.md               # Verification protocol
├── 📋 DIRECTORY_STRUCTURE.md         # This file
├── 📦 package.json                   # Root project dependencies
├── 📦 package-lock.json             # Dependency lock file
└── 🔧 dev/                          # Development documentation
```

## 📚 **DEVELOPMENT DOCUMENTATION** (`dev/`)
```
dev/
└── documents/
    ├── 📋 ARCHITECTURE.md            # System architecture overview
    ├── 📋 BACKEND_API_REFERENCE.md   # Authoritative backend API docs
    ├── 📋 PROGRESS.md               # Development progress tracking
    └── 📋 MIGRATION_CHECKLIST.md    # Task completion checklist
```

## 🔧 **BACKEND** (`backend/`)
```
backend/
├── 🚀 server.js                     # Express server entry point
├── 📦 package.json                  # Backend dependencies
├── 🔧 .env.example                  # Environment variables template
├── 📊 data.json                     # Sample data for testing
│
├── 📁 src/                          # Source code
│   ├── 🔧 config/
│   │   └── database.js              # MongoDB connection config
│   │
│   ├── 🏗️ models/                   # Database models (Mongoose)
│   │   ├── SKU.js                   # Product master data
│   │   ├── Instance.js              # Individual physical items
│   │   ├── Tag.js                   # Instance-based allocation system
│   │   ├── Inventory.js             # Real-time aggregation
│   │   ├── Category.js              # Product organization
│   │   ├── User.js                  # Authentication & roles
│   │   └── AuditLog.js              # Activity tracking
│   │
│   ├── 🛣️ routes/                    # API endpoints
│   │   ├── auth.js                  # Authentication routes
│   │   ├── skus.js                  # SKU CRUD + barcode operations
│   │   ├── instances.js             # Instance management
│   │   ├── tags.js                  # Tag creation & fulfillment
│   │   ├── inventory.js             # Inventory reporting
│   │   ├── categories.js            # Category management
│   │   ├── users.js                 # User management
│   │   └── export.js                # Import/export functionality
│   │
│   └── 🛠️ middleware/                # Express middleware
│       ├── auth.js                  # JWT authentication
│       ├── validation.js            # Request validation
│       ├── errorHandler.js          # Error handling
│       └── logging.js               # Request logging
│
├── 🔄 migrations/                   # Database migrations
│   └── migrate-tags-to-instances.js # Instance-based tag conversion
│
├── 💾 dump/                         # Database dumps/backups
│   ├── stock_manager/               # Production backup
│   └── stockmanager_dev/            # Development backup
│
└── 📦 node_modules/                 # Backend dependencies
```

## 🎨 **FRONTEND** (`frontend/`)
```
frontend/
├── 📦 package.json                  # Frontend dependencies
├── 🔧 vite.config.js               # Vite build configuration
├── 🔧 tsconfig.json               # TypeScript configuration
├── 📦 package-lock.json            # Dependency lock file
│
├── 📁 public/                       # Static assets
│   ├── favicon.ico
│   └── index.html
│
├── 📁 src/                          # Vue 3 source code
│   ├── 🚀 main.ts                   # Vue app entry point
│   ├── 🎨 App.vue                   # Root Vue component
│   │
│   ├── 🧩 components/               # Reusable Vue components
│   │   ├── layout/
│   │   │   ├── Header.vue
│   │   │   ├── Sidebar.vue
│   │   │   └── Footer.vue
│   │   │
│   │   ├── inventory/
│   │   │   ├── InventoryTable.vue
│   │   │   ├── StockModal.vue
│   │   │   └── LowStockAlert.vue
│   │   │
│   │   ├── tags/
│   │   │   ├── CreateTagModal.vue   # ⚠️ NEEDS INSTANCE UPDATES
│   │   │   ├── FulfillTagsDialog.vue # ⚠️ NEEDS INSTANCE UPDATES
│   │   │   └── TagStatusBadge.vue
│   │   │
│   │   ├── skus/
│   │   │   ├── SKUForm.vue
│   │   │   ├── SKUList.vue
│   │   │   └── BarcodeScanner.vue
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.vue
│   │       ├── ErrorAlert.vue
│   │       └── ConfirmDialog.vue
│   │
│   ├── 📄 views/                    # Page-level components
│   │   ├── Dashboard.vue
│   │   ├── Inventory.vue
│   │   ├── Tags.vue                 # ⚠️ NEEDS INSTANCE UPDATES
│   │   ├── SKUs.vue
│   │   ├── Reports.vue
│   │   └── Settings.vue
│   │
│   ├── 🗂️ stores/                   # Pinia state management
│   │   ├── index.ts                 # Store setup
│   │   ├── auth.ts                  # Authentication state
│   │   ├── inventory.ts             # Inventory state
│   │   ├── tags.ts                  # ⚠️ NEEDS INSTANCE UPDATES
│   │   ├── skus.ts                  # SKU state
│   │   └── ui.ts                    # UI state (modals, alerts)
│   │
│   ├── 🔧 composables/              # Vue 3 composables
│   │   ├── useApi.ts               # HTTP client wrapper
│   │   ├── useAuth.ts              # Authentication logic
│   │   ├── useNotifications.ts     # Toast notifications
│   │   └── useValidation.ts        # Form validation
│   │
│   ├── 📝 types/                    # TypeScript interfaces
│   │   ├── api.ts                  # API response types
│   │   ├── models.ts               # ⚠️ NEEDS INSTANCE UPDATES
│   │   ├── auth.ts                 # Authentication types
│   │   └── ui.ts                   # UI component types
│   │
│   ├── 🛠️ utils/                    # Utility functions
│   │   ├── api.ts                  # API client setup
│   │   ├── date.ts                 # Date formatting
│   │   ├── currency.ts             # Money formatting
│   │   └── validation.ts           # Validation helpers
│   │
│   ├── 🎨 assets/                   # Static assets
│   │   ├── styles/
│   │   │   ├── main.css
│   │   │   └── variables.css
│   │   └── images/
│   │
│   └── 🛣️ router/                   # Vue Router
│       └── index.ts                # Route definitions
│
└── 📦 node_modules/                # Frontend dependencies
```

## 🚨 **FILES REQUIRING INSTANCE ARCHITECTURE UPDATES**

### **HIGH PRIORITY - Frontend Migration Required**
```
⚠️  frontend/src/types/models.ts           # Update Tag interface
⚠️  frontend/src/stores/tags.ts            # Instance-based tag state
⚠️  frontend/src/views/Tags.vue            # Display instance quantities
⚠️  frontend/src/components/tags/CreateTagModal.vue  # Instance selection UI
⚠️  frontend/src/components/tags/FulfillTagsDialog.vue  # Instance fulfillment
```

### **Backend - COMPLETED ✅**
```
✅  backend/src/models/Tag.js              # Instance-based schema & methods
✅  backend/src/routes/tags.js             # Instance-based API endpoints
✅  backend/migrations/migrate-tags-to-instances.js  # Data conversion
```

## 📊 **DATABASE COLLECTIONS**
```
MongoDB Collections:
├── 📄 skus                         # Product master data
├── 📄 instances                    # Individual physical items
├── 📄 tags                         # Instance-based allocation
├── 📄 inventories                  # Real-time quantity aggregation
├── 📄 categories                   # Product organization
├── 📄 users                        # Authentication & roles
└── 📄 auditlogs                    # Activity tracking
```

## 🔄 **KEY RELATIONSHIPS**
```
SKU (1) ←→ (Many) Instance ←→ (1) Tag
 │                                    │
 └── (1) ←→ (1) Inventory            └── User (created_by)
     │
     └── Category (category_id)
```

## 🚀 **DEVELOPMENT STATUS**

### **✅ COMPLETED**
- ✅ Backend API architecture (ENHANCED with instances)
- ✅ Database models with instance tracking
- ✅ Authentication & authorization system
- ✅ Instance-based tag creation & fulfillment
- ✅ Real-time inventory aggregation
- ✅ Import/export functionality
- ✅ Data migration script for instance conversion
- ✅ Comprehensive API documentation

### **🔄 IN PROGRESS**
- 🔄 Frontend migration to instance-based architecture
- 🔄 TypeScript interface updates
- 🔄 Vue component updates for instance selection
- 🔄 State management migration

### **⏭️ PENDING**
- ⏭️ End-to-end testing with instance architecture
- ⏭️ Production data migration
- ⏭️ Performance optimization
- ⏭️ Deployment configuration

## 🛠️ **DEVELOPMENT COMMANDS**

### **Backend Development**
```bash
cd backend/
npm install
npm run dev      # Start development server (port 5000)
npm run migrate  # Run database migrations
```

### **Frontend Development**
```bash
cd frontend/
npm install
npm run dev      # Start development server (port 3000)
npm run build    # Build for production
npm run type-check  # TypeScript validation
```

### **Full Stack Development**
```bash
# From project root
npm install      # Install concurrently
npm run dev      # Start both backend and frontend
```

## 🎯 **NEXT STEPS**
1. **Frontend Migration**: Update Vue components to use instance-based tag data
2. **Testing**: Validate instance selection and fulfillment workflows
3. **Data Migration**: Convert production data to new format
4. **Deployment**: Prepare staging and production environments

---

**Note**: This project uses the revolutionary instance-based tag architecture that provides precise inventory control and eliminates quantity tracking inconsistencies. The backend is production-ready; frontend migration is the current focus.

# Directory Structure Overview

This document outlines the organized structure of the Stock Manager project.

## 📁 Root Level Structure

```
stock_manager/
├── README.md                           # Main project documentation
├── DIRECTORY_STRUCTURE.md             # This file
├── MIGRATION_CHECKLIST.md             # Detailed migration task list
├── PROGRESS.txt                        # Simple progress tracker
├── CURRENT_TASK.md                    # Active task tracker (updated frequently)
├── .gitignore                          # Git ignore rules
├── package.json                        # Root package.json for scripts
├── Procfile                           # Deployment configuration
├── railway.toml                       # Railway deployment config
├── .env                               # Environment variables (ignored)
│
├── .github/
│   └── workflows/
│       └── deploy.yml                 # GitHub Actions deployment
│
├── documents/                         # 📄 User-facing documentation
│   ├── README.md                      # Documentation index
│   └── DEPLOYMENT.md                  # Deployment guide
│
├── dev/                              # 🔧 Development tools & docs
│   ├── README.md                     # Development directory guide
│   ├── documents/                    # Development documentation
│   │   ├── AUTHENTICATION_SYSTEM.md  # Auth system docs
│   │   ├── DEPRECIATION_SCHEDULE_FEAT.md  # Future feature spec
│   │   ├── DUAL_MODEL_COMPATIBILITY.md   # Legacy compatibility
│   │   ├── README_NEW_ARCHITECTURE.md    # Architecture docs
│   │   └── WORKFLOW_DISCIPLINE.md    # Process discipline guide
│   └── scripts/                      # Development scripts (ignored)
│       └── .gitkeep                  # Preserves directory
│
├── backend/                          # 🔙 Node.js/Express API
│   ├── src/
│   │   ├── config/                   # Database & config
│   │   ├── middleware/               # Auth middleware
│   │   ├── models/                   # Mongoose models
│   │   ├── routes/                   # API endpoints
│   │   └── server.js                 # Main server file
│   ├── package.json
│   ├── .env.example
│   └── nodemon.json
│
├── frontend/                         # 🎨 Vue.js application
│   ├── src/
│   │   ├── components/               # Vue components
│   │   ├── stores/                   # Pinia stores
│   │   ├── types/                    # TypeScript types
│   │   ├── utils/                    # Utilities & API
│   │   ├── views/                    # Page components
│   │   └── main.ts                   # Main entry point
│   ├── public/                       # Static assets
│   ├── dist/                         # Built files (ignored)
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── backups/                          # 💾 Database backups
    └── (various backup directories)
```
```Latest 8/27/2025 16:05 CST
stock_manager/
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
├─ backend/
│  ├─ dump/
│  │  ├─ admin/
│  │  │  ├─ system.version.bson
│  │  │  └─ system.version.metadata.json
│  │  ├─ eventcollect/
│  │  │  ├─ appointments.bson
│  │  │  ├─ appointments.metadata.json
│  │  │  ├─ events.bson
│  │  │  ├─ events.metadata.json
│  │  │  ├─ leads.bson
│  │  │  └─ leads.metadata.json
│  │  ├─ stock_manager/
│  │  │  ├─ accessories.bson
│  │  │  ├─ accessories.metadata.json
│  │  │  ├─ auditlogs.bson
│  │  │  ├─ auditlogs.metadata.json
│  │  │  ├─ bases.bson
│  │  │  ├─ bases.metadata.json
│  │  │  ├─ categories.bson
│  │  │  ├─ categories.metadata.json
│  │  │  ├─ inventories.bson
│  │  │  ├─ inventories.metadata.json
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ items.bson
│  │  │  ├─ items.metadata.json
│  │  │  ├─ miscellaneous.bson
│  │  │  ├─ miscellaneous.metadata.json
│  │  │  ├─ rawmaterials.bson
│  │  │  ├─ rawmaterials.metadata.json
│  │  │  ├─ showerdoors.bson
│  │  │  ├─ showerdoors.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  ├─ skunews.metadata.json
│  │  │  ├─ skus.bson
│  │  │  ├─ skus.metadata.json
│  │  │  ├─ tagnews.bson
│  │  │  ├─ tagnews.metadata.json
│  │  │  ├─ tags.bson
│  │  │  ├─ tags.metadata.json
│  │  │  ├─ toilets.bson
│  │  │  ├─ toilets.metadata.json
│  │  │  ├─ tubs.bson
│  │  │  ├─ tubs.metadata.json
│  │  │  ├─ users.bson
│  │  │  ├─ users.metadata.json
│  │  │  ├─ vanities.bson
│  │  │  ├─ vanities.metadata.json
│  │  │  ├─ walls.bson
│  │  │  └─ walls.metadata.json
│  │  ├─ stock_manager_dev/
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  └─ skunews.metadata.json
│  │  ├─ stockmanager_dev/
│  │  │  ├─ accessories.bson
│  │  │  ├─ accessories.metadata.json
│  │  │  ├─ auditlogs.bson
│  │  │  ├─ auditlogs.metadata.json
│  │  │  ├─ bases.bson
│  │  │  ├─ bases.metadata.json
│  │  │  ├─ categories.bson
│  │  │  ├─ categories.metadata.json
│  │  │  ├─ customers.bson
│  │  │  ├─ customers.metadata.json
│  │  │  ├─ inventories.bson
│  │  │  ├─ inventories.metadata.json
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ items.bson
│  │  │  ├─ items.metadata.json
│  │  │  ├─ miscellaneous.bson
│  │  │  ├─ miscellaneous.metadata.json
│  │  │  ├─ rawmaterials.bson
│  │  │  ├─ rawmaterials.metadata.json
│  │  │  ├─ showerdoors.bson
│  │  │  ├─ showerdoors.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  ├─ skunews.metadata.json
│  │  │  ├─ skus.bson
│  │  │  ├─ skus.metadata.json
│  │  │  ├─ tagnews.bson
│  │  │  ├─ tagnews.metadata.json
│  │  │  ├─ tags.bson
│  │  │  ├─ tags.metadata.json
│  │  │  ├─ testcategories.bson
│  │  │  ├─ testcategories.metadata.json
│  │  │  ├─ toilets.bson
│  │  │  ├─ toilets.metadata.json
│  │  │  ├─ tubs.bson
│  │  │  ├─ tubs.metadata.json
│  │  │  ├─ users.bson
│  │  │  ├─ users.metadata.json
│  │  │  ├─ vanities.bson
│  │  │  ├─ vanities.metadata.json
│  │  │  ├─ walls.bson
│  │  │  └─ walls.metadata.json
│  │  └─ prelude.json
│  ├─ migrations/
│  │  └─ migrate-tags-to-instances.js
│  ├─ scripts/
│  │  ├─ analyze-data.js
│  │  ├─ analyze-production.js
│  │  ├─ check-current-state.js
│  │  ├─ check-item-costs.js
│  │  ├─ check-test-db.js
│  │  ├─ create-admin-user.js
│  │  ├─ create-inventory-records.js
│  │  ├─ debug-inventory-api.js
│  │  ├─ fix-costs.js
│  │  ├─ migrate-legacy-data.js
│  │  ├─ migrate-production-data.js
│  │  ├─ migrate-production-to-new-schema.js
│  │  ├─ migrate-skus.js
│  │  ├─ populate-sample-data.js
│  │  ├─ seed-categories.js
│  │  └─ test-count-pipeline.js
│  ├─ src/
│  │  ├─ config/
│  │  │  ├─ database.js
│  │  │  └─ jsonDB.js
│  │  ├─ middleware/
│  │  │  └─ authEnhanced.js
│  │  ├─ models/
│  │  │  ├─ AuditLog.js
│  │  │  ├─ Category.js
│  │  │  ├─ Instance.js
│  │  │  ├─ Inventory.js
│  │  │  ├─ SKU.js
│  │  │  ├─ Tag.js
│  │  │  └─ User.js
│  │  ├─ routes/
│  │  │  ├─ auth.js
│  │  │  ├─ authEnhanced.js
│  │  │  ├─ categories.js
│  │  │  ├─ export.js
│  │  │  ├─ instances.js
│  │  │  ├─ inventory.js
│  │  │  ├─ skus.js
│  │  │  ├─ tags.js
│  │  │  └─ users.js
│  │  ├─ scripts/
│  │  │  └─ setupInitialUsers.js
│  │  └─ server.js
│  ├─ .env
│  ├─ .env.example
│  ├─ data.json
│  ├─ kill-server.sh
│  ├─ nodemon.json
│  ├─ package-lock.json
│  └─ package.json
├─ backups/
│  ├─ local_backup_20250821_225029/
│  │  └─ stock_manager/
│  │     ├─ accessories.bson
│  │     ├─ accessories.metadata.json
│  │     ├─ bases.bson
│  │     ├─ bases.metadata.json
│  │     ├─ items.bson
│  │     ├─ items.metadata.json
│  │     ├─ miscellaneous.bson
│  │     ├─ miscellaneous.metadata.json
│  │     ├─ prelude.json
│  │     ├─ rawmaterials.bson
│  │     ├─ rawmaterials.metadata.json
│  │     ├─ showerdoors.bson
│  │     ├─ showerdoors.metadata.json
│  │     ├─ skus.bson
│  │     ├─ skus.metadata.json
│  │     ├─ tags.bson
│  │     ├─ tags.metadata.json
│  │     ├─ toilets.bson
│  │     ├─ toilets.metadata.json
│  │     ├─ tubs.bson
│  │     ├─ tubs.metadata.json
│  │     ├─ vanities.bson
│  │     ├─ vanities.metadata.json
│  │     ├─ walls.bson
│  │     └─ walls.metadata.json
│  ├─ mongo_backup_local/
│  │  ├─ admin/
│  │  │  ├─ system.version.bson
│  │  │  └─ system.version.metadata.json
│  │  ├─ eventcollect/
│  │  │  ├─ appointments.bson
│  │  │  ├─ appointments.metadata.json
│  │  │  ├─ events.bson
│  │  │  ├─ events.metadata.json
│  │  │  ├─ leads.bson
│  │  │  └─ leads.metadata.json
│  │  ├─ stock_manager/
│  │  │  ├─ accessories.bson
│  │  │  ├─ accessories.metadata.json
│  │  │  ├─ auditlogs.bson
│  │  │  ├─ auditlogs.metadata.json
│  │  │  ├─ bases.bson
│  │  │  ├─ bases.metadata.json
│  │  │  ├─ categories.bson
│  │  │  ├─ categories.metadata.json
│  │  │  ├─ inventories.bson
│  │  │  ├─ inventories.metadata.json
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ items.bson
│  │  │  ├─ items.metadata.json
│  │  │  ├─ miscellaneous.bson
│  │  │  ├─ miscellaneous.metadata.json
│  │  │  ├─ rawmaterials.bson
│  │  │  ├─ rawmaterials.metadata.json
│  │  │  ├─ showerdoors.bson
│  │  │  ├─ showerdoors.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  ├─ skunews.metadata.json
│  │  │  ├─ skus.bson
│  │  │  ├─ skus.metadata.json
│  │  │  ├─ tagnews.bson
│  │  │  ├─ tagnews.metadata.json
│  │  │  ├─ tags.bson
│  │  │  ├─ tags.metadata.json
│  │  │  ├─ toilets.bson
│  │  │  ├─ toilets.metadata.json
│  │  │  ├─ tubs.bson
│  │  │  ├─ tubs.metadata.json
│  │  │  ├─ users.bson
│  │  │  ├─ users.metadata.json
│  │  │  ├─ vanities.bson
│  │  │  ├─ vanities.metadata.json
│  │  │  ├─ walls.bson
│  │  │  └─ walls.metadata.json
│  │  ├─ stock_manager_dev/
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  └─ skunews.metadata.json
│  │  ├─ stockmanager_dev/
│  │  │  ├─ accessories.bson
│  │  │  ├─ accessories.metadata.json
│  │  │  ├─ auditlogs.bson
│  │  │  ├─ auditlogs.metadata.json
│  │  │  ├─ bases.bson
│  │  │  ├─ bases.metadata.json
│  │  │  ├─ categories.bson
│  │  │  ├─ categories.metadata.json
│  │  │  ├─ customers.bson
│  │  │  ├─ customers.metadata.json
│  │  │  ├─ inventories.bson
│  │  │  ├─ inventories.metadata.json
│  │  │  ├─ inventory.bson
│  │  │  ├─ inventory.metadata.json
│  │  │  ├─ itemnews.bson
│  │  │  ├─ itemnews.metadata.json
│  │  │  ├─ items.bson
│  │  │  ├─ items.metadata.json
│  │  │  ├─ miscellaneous.bson
│  │  │  ├─ miscellaneous.metadata.json
│  │  │  ├─ rawmaterials.bson
│  │  │  ├─ rawmaterials.metadata.json
│  │  │  ├─ showerdoors.bson
│  │  │  ├─ showerdoors.metadata.json
│  │  │  ├─ skunews.bson
│  │  │  ├─ skunews.metadata.json
│  │  │  ├─ skus.bson
│  │  │  ├─ skus.metadata.json
│  │  │  ├─ tagnews.bson
│  │  │  ├─ tagnews.metadata.json
│  │  │  ├─ tags.bson
│  │  │  ├─ tags.metadata.json
│  │  │  ├─ testcategories.bson
│  │  │  ├─ testcategories.metadata.json
│  │  │  ├─ toilets.bson
│  │  │  ├─ toilets.metadata.json
│  │  │  ├─ tubs.bson
│  │  │  ├─ tubs.metadata.json
│  │  │  ├─ users.bson
│  │  │  ├─ users.metadata.json
│  │  │  ├─ vanities.bson
│  │  │  ├─ vanities.metadata.json
│  │  │  ├─ walls.bson
│  │  │  └─ walls.metadata.json
│  │  └─ prelude.json
│  ├─ pre_migration_snapshot_20250821_225054/
│  │  └─ stockmanager_dev/
│  │     ├─ accessories.bson
│  │     ├─ accessories.metadata.json
│  │     ├─ bases.bson
│  │     ├─ bases.metadata.json
│  │     ├─ items.bson
│  │     ├─ items.metadata.json
│  │     ├─ miscellaneous.bson
│  │     ├─ miscellaneous.metadata.json
│  │     ├─ prelude.json
│  │     ├─ rawmaterials.bson
│  │     ├─ rawmaterials.metadata.json
│  │     ├─ showerdoors.bson
│  │     ├─ showerdoors.metadata.json
│  │     ├─ skus.bson
│  │     ├─ skus.metadata.json
│  │     ├─ tags.bson
│  │     ├─ tags.metadata.json
│  │     ├─ toilets.bson
│  │     ├─ toilets.metadata.json
│  │     ├─ tubs.bson
│  │     ├─ tubs.metadata.json
│  │     ├─ vanities.bson
│  │     ├─ vanities.metadata.json
│  │     ├─ walls.bson
│  │     └─ walls.metadata.json
│  └─ production_backup_restore-68aa230cf650390dd092616f.tar.gz
├─ dev/
│  ├─ documents/
│  │  ├─ ARCHITECTURE.md
│  │  ├─ AUTHENTICATION_SYSTEM.md
│  │  ├─ BACKEND_API_REFERENCE.md
│  │  ├─ DEPRECIATION_SCHEDULE_FEAT.md
│  │  └─ DUAL_MODEL_COMPATIBILITY.md
│  ├─ scripts/
│  │  └─ .gitkeep
│  └─ README.md
├─ documents/
│  ├─ DEPLOYMENT.md
│  └─ README.md
├─ frontend/
│  ├─ dist/
│  │  ├─ assets/
│  │  │  ├─ fa-brands-400-D_cYUPeE.woff2
│  │  │  ├─ fa-brands-400-D1LuMI3I.ttf
│  │  │  ├─ fa-regular-400-BjRzuEpd.woff2
│  │  │  ├─ fa-regular-400-DZaxPHgR.ttf
│  │  │  ├─ fa-solid-900-CTAAxXor.woff2
│  │  │  ├─ fa-solid-900-D0aA9rwL.ttf
│  │  │  ├─ fa-v4compatibility-C9RhG_FT.woff2
│  │  │  ├─ fa-v4compatibility-CCth-dXg.ttf
│  │  │  ├─ flUhRq6tzZclQEJ-Vdg-IuiaDsNa-Dr0goTwe.woff
│  │  │  ├─ flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ-D-x-0Q06.woff2
│  │  │  ├─ index-BdsCKk5l.js
│  │  │  ├─ index-BtRiljrr.css
│  │  │  ├─ kJEhBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oFsLjBuVY-BcMpdYMC.woff2
│  │  │  ├─ kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1p-p_4MrImHCIJIZrDCvHeel-Da-CAEls.woff
│  │  │  └─ Logo_V2_Gradient7_CTC-BcN4R5Ru.png
│  │  ├─ apple-touch-icon.png
│  │  ├─ CNAME
│  │  ├─ favicon-32x32.png
│  │  ├─ favicon.ico
│  │  ├─ favicon.svg
│  │  ├─ index.html
│  │  ├─ manifest.json
│  │  ├─ test.html
│  │  └─ vite.svg
│  ├─ public/
│  │  ├─ apple-touch-icon.png
│  │  ├─ CNAME
│  │  ├─ favicon-32x32.png
│  │  ├─ favicon.ico
│  │  ├─ favicon.svg
│  │  ├─ manifest.json
│  │  ├─ test.html
│  │  └─ vite.svg
│  ├─ src/
│  │  ├─ assets/
│  │  │  ├─ icons/
│  │  │  │  ├─ favicon-128x128.png
│  │  │  │  ├─ favicon-16x16.png
│  │  │  │  ├─ favicon-32x32.png
│  │  │  │  ├─ favicon-64x64.png
│  │  │  │  ├─ favicon-96x96.png
│  │  │  │  ├─ favicon.ico
│  │  │  │  └─ favicon.svg
│  │  │  └─ images/
│  │  │     ├─ Gradient_BG_v4.png
│  │  │     ├─ Logo_V2_Gradient7_CTC.png
│  │  │     └─ Logo_v3_hi_res.png
│  │  ├─ components/
│  │  │  ├─ AddCostDialog.vue
│  │  │  ├─ AddItemModal.vue
│  │  │  ├─ AddStockModal.vue
│  │  │  ├─ BatchScanDialog.vue
│  │  │  ├─ BundleExpansionDialog.vue
│  │  │  ├─ CreateTagModal.vue
│  │  │  ├─ CreateTagModalNew.vue.backup
│  │  │  ├─ EditItemModal.vue
│  │  │  ├─ EditTagModal.vue
│  │  │  ├─ ExportDialog.vue
│  │  │  ├─ FulfillTagsDialog.vue
│  │  │  ├─ InventoryTable.vue
│  │  │  ├─ ProductUsedDialog.vue
│  │  │  ├─ QuickScanModal.vue
│  │  │  ├─ SendForInstallDialog.vue
│  │  │  ├─ SKUFormDialog.vue
│  │  │  ├─ StockStatusChip.vue
│  │  │  ├─ UnassignedItemsManager.vue
│  │  │  └─ UserProfile.vue
│  │  ├─ stores/
│  │  │  ├─ auth.ts
│  │  │  ├─ category.ts
│  │  │  ├─ inventory.ts
│  │  │  ├─ sku.ts
│  │  │  └─ tag.ts
│  │  ├─ types/
│  │  │  ├─ index.ts
│  │  │  ├─ shims-vue.d.ts
│  │  │  └─ vite-env.d.ts
│  │  ├─ utils/
│  │  │  ├─ api.ts
│  │  │  └─ auth-test.ts
│  │  ├─ views/
│  │  │  ├─ Dashboard.vue
│  │  │  ├─ Inventory.vue
│  │  │  ├─ Login.vue
│  │  │  ├─ SKUManagement.vue
│  │  │  └─ Tags.vue
│  │  ├─ App.vue
│  │  ├─ env.d.ts
│  │  ├─ main.ts
│  │  ├─ quasar-components.ts
│  │  ├─ quasar-variables.sass
│  │  └─ router.ts
│  ├─ .env
│  ├─ .env.local
│  ├─ generate-build-info.js
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ .env
├─ .gitignore
├─ ACCOUNTABILITY.md
├─ CURRENT_TASK.md
├─ DIRECTORY_STRUCTURE.md
├─ MIGRATION_CHECKLIST.md
├─ package-lock.json
├─ package.json
├─ Procfile
├─ PROGRESS.txt
├─ railway.toml
├─ README.md
├─ VUMO_PROTOCOL.md
└─ WORKFLOW_DISCIPLINE.md
```

## 📋 File Categories

### Production Files ✅
Files that are part of the production application:
- `backend/` - Complete API server
- `frontend/` - Complete Vue.js app  
- `documents/DEPLOYMENT.md` - Deployment instructions
- `README.md` - Main project documentation
- `.github/workflows/deploy.yml` - Deployment automation

### Development Files 🔧  
Files for development and maintenance (in `dev/`):
- `dev/documents/` - Technical specs and architecture docs
- `dev/scripts/` - Development utilities (ignored by git)
- Development documentation and feature specifications

### Configuration Files ⚙️
- `.gitignore` - Git ignore rules
- `package.json` - Root scripts
- `Procfile` - Deployment config  
- `railway.toml` - Railway config

### Backup Files 💾
- `backups/` - Database backups (kept for safety)

## 🎯 Key Benefits of This Structure

1. **Clear Separation**: Production vs development files clearly separated
2. **User-Friendly**: Main docs easily accessible in `documents/`  
3. **Developer-Friendly**: Technical docs in `dev/documents/`
4. **Secure**: Development scripts ignored by git but directory preserved
5. **Clean Root**: Root level only contains essential files
6. **Scalable**: Easy to add new categories as project grows

## 🔒 Git Ignore Strategy

- `dev/scripts/*` - Development scripts ignored (may contain sensitive data)
- `dev/scripts/.gitkeep` - Preserves directory structure
- Standard ignores for node_modules, .env, build files, etc.

This structure makes it easy for new developers to understand the project layout while keeping production and development concerns properly separated.
