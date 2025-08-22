#!/bin/bash

# Database Backup and Restore Script for Migration Testing
# This script safely downloads production data for local testing

set -e  # Exit on any error

# Configuration
PRODUCTION_DB_NAME="stockmanager"
LOCAL_DB_NAME="stockmanager_dev"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="production_backup_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Database Migration Testing Setup${NC}"
echo "======================================"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    print_error "MongoDB is not running. Please start MongoDB first."
    exit 1
fi

print_status "MongoDB is running"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to backup production database
backup_production() {
    echo -e "\n${BLUE}📥 Step 1: Backing up production database${NC}"
    echo "============================================"
    
    # Check if we have production connection details
    if [ -z "$MONGO_PRODUCTION_URI" ]; then
        print_warning "MONGO_PRODUCTION_URI not set. Please provide production MongoDB URI:"
        echo "Example: mongodb://username:password@host:port/database"
        echo "Or: mongodb+srv://username:password@cluster.mongodb.net/database"
        read -r MONGO_PRODUCTION_URI
        export MONGO_PRODUCTION_URI
    fi
    
    print_status "Connecting to production database..."
    
    # Create production backup
    mongodump --uri="$MONGO_PRODUCTION_URI" --out="$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_status "Production backup created: $BACKUP_DIR/$BACKUP_FILE"
    else
        print_error "Failed to backup production database"
        exit 1
    fi
}

# Function to clear local database
clear_local_db() {
    echo -e "\n${BLUE}🗑️  Step 2: Clearing local database${NC}"
    echo "====================================="
    
    print_warning "This will completely wipe your local database: $LOCAL_DB_NAME"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mongo "$LOCAL_DB_NAME" --eval "db.dropDatabase()" > /dev/null 2>&1 || true
        print_status "Local database cleared"
    else
        print_error "Operation cancelled"
        exit 1
    fi
}

# Function to restore production data locally
restore_production_locally() {
    echo -e "\n${BLUE}📤 Step 3: Restoring production data locally${NC}"
    echo "============================================="
    
    # Find the production database folder in backup
    PROD_DB_FOLDER=$(find "$BACKUP_DIR/$BACKUP_FILE" -type d -name "$PRODUCTION_DB_NAME" | head -1)
    
    if [ ! -d "$PROD_DB_FOLDER" ]; then
        print_error "Production database folder not found in backup"
        exit 1
    fi
    
    print_status "Restoring production data to local database..."
    
    # Restore to local database
    mongorestore --db "$LOCAL_DB_NAME" "$PROD_DB_FOLDER"
    
    if [ $? -eq 0 ]; then
        print_status "Production data restored to local database: $LOCAL_DB_NAME"
    else
        print_error "Failed to restore production data locally"
        exit 1
    fi
}

# Function to verify local database
verify_local_db() {
    echo -e "\n${BLUE}✅ Step 4: Verifying local database${NC}"
    echo "==================================="
    
    # Get collection counts
    echo "Collection counts in local database:"
    mongo "$LOCAL_DB_NAME" --quiet --eval "
        db.getCollectionNames().forEach(function(collection) {
            var count = db[collection].count();
            print(collection + ': ' + count + ' documents');
        });
    "
    
    print_status "Local database verification complete"
}

# Function to create database snapshot for rollback
create_snapshot() {
    echo -e "\n${BLUE}📸 Creating pre-migration snapshot${NC}"
    echo "===================================="
    
    SNAPSHOT_FILE="pre_migration_snapshot_${TIMESTAMP}"
    mongodump --db "$LOCAL_DB_NAME" --out "$BACKUP_DIR/$SNAPSHOT_FILE"
    
    print_status "Pre-migration snapshot created: $BACKUP_DIR/$SNAPSHOT_FILE"
    echo "Use this to rollback if migration fails"
}

# Main execution
main() {
    case "${1:-all}" in
        "backup")
            backup_production
            ;;
        "clear")
            clear_local_db
            ;;
        "restore")
            restore_production_locally
            ;;
        "verify")
            verify_local_db
            ;;
        "snapshot")
            create_snapshot
            ;;
        "all")
            backup_production
            clear_local_db
            restore_production_locally
            verify_local_db
            create_snapshot
            
            echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
            echo "==================="
            echo "Your local database now contains production data and is ready for migration testing."
            echo ""
            echo "Next steps:"
            echo "1. Run the migration script on local database"
            echo "2. Verify migration results"
            echo "3. If issues found, rollback using snapshot and fix migration script"
            echo "4. Repeat until migration is perfect"
            echo ""
            echo -e "Local database: ${YELLOW}$LOCAL_DB_NAME${NC}"
            echo -e "Backup location: ${YELLOW}$BACKUP_DIR/$BACKUP_FILE${NC}"
            echo -e "Snapshot location: ${YELLOW}$BACKUP_DIR/pre_migration_snapshot_${TIMESTAMP}${NC}"
            ;;
        *)
            echo "Usage: $0 [backup|clear|restore|verify|snapshot|all]"
            echo ""
            echo "Commands:"
            echo "  backup   - Backup production database"
            echo "  clear    - Clear local database"
            echo "  restore  - Restore production data to local database"
            echo "  verify   - Verify local database contents"
            echo "  snapshot - Create pre-migration snapshot"
            echo "  all      - Run all steps (default)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
