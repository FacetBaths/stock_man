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
