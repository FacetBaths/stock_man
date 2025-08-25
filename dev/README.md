# Development Directory

This directory contains development tools, documentation, and scripts that are not part of the production application but are useful for development and maintenance.

## Structure

```
dev/
├── README.md (this file)
├── documents/
│   ├── AUTHENTICATION_SYSTEM.md - Auth system documentation
│   ├── DEPRECIATION_SCHEDULE_FEAT.md - Future depreciation feature spec
│   ├── DUAL_MODEL_COMPATIBILITY.md - Legacy compatibility notes
│   └── README_NEW_ARCHITECTURE.md - Architecture documentation
└── scripts/
    └── (development and utility scripts)
```

## Documents

The `documents/` directory contains:
- **Technical specifications** for features and systems
- **Architecture documentation** for development reference  
- **Legacy documentation** that may be needed for reference
- **Feature specifications** for future development

## Scripts

The `scripts/` directory is for:
- **Database maintenance scripts**
- **Development utilities**
- **Migration helpers**
- **Testing tools**
- **Cleanup utilities**

## Note

This entire `dev/` directory should generally be excluded from production deployments but kept in version control for development team reference.
