#!/bin/bash

# Migration Rollback Script
# Restores database from pre-migration snapshot if migration fails

set -e

# Configuration
LOCAL_DB_NAME="stockmanager_dev"
BACKUP_DIR="./backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🔙 Migration Rollback Script${NC}"
echo "=============================="

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

# List available snapshots
list_snapshots() {
    echo -e "\n${BLUE}Available snapshots:${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "pre_migration_snapshot_*" -type d | sort -r | while read -r snapshot; do
            basename_snapshot=$(basename "$snapshot")
            timestamp=$(echo "$basename_snapshot" | sed 's/pre_migration_snapshot_//')
            echo "  $basename_snapshot (Created: $timestamp)"
        done
    else
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
}

# Rollback to specific snapshot
rollback_to_snapshot() {
    local snapshot_name="$1"
    local snapshot_path="$BACKUP_DIR/$snapshot_name"
    
    if [ ! -d "$snapshot_path" ]; then
        print_error "Snapshot not found: $snapshot_path"
        exit 1
    fi
    
    print_warning "This will completely replace your current database with the snapshot!"
    echo "Database: $LOCAL_DB_NAME"
    echo "Snapshot: $snapshot_name"
    
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Rollback cancelled"
        exit 1
    fi
    
    echo -e "\n${BLUE}Step 1: Dropping current database${NC}"
    mongosh "$LOCAL_DB_NAME" --eval "db.dropDatabase()" > /dev/null 2>&1
    print_status "Current database dropped"
    
    echo -e "\n${BLUE}Step 2: Restoring from snapshot${NC}"
    # Find the database folder in the snapshot
    db_folder=$(find "$snapshot_path" -name "$LOCAL_DB_NAME" -type d | head -1)
    
    if [ ! -d "$db_folder" ]; then
        print_error "Database folder not found in snapshot"
        exit 1
    fi
    
    mongorestore --db "$LOCAL_DB_NAME" "$db_folder"
    
    if [ $? -eq 0 ]; then
        print_status "Database restored from snapshot successfully"
    else
        print_error "Failed to restore database from snapshot"
        exit 1
    fi
    
    echo -e "\n${BLUE}Step 3: Verifying restored database${NC}"
    echo "Collection counts in restored database:"
    mongosh "$LOCAL_DB_NAME" --quiet --eval "
        db.getCollectionNames().forEach(function(collection) {
            var count = db[collection].count();
            print(collection + ': ' + count + ' documents');
        });
    "
    
    print_status "Rollback completed successfully"
}

# Auto-rollback to latest snapshot
auto_rollback() {
    echo -e "\n${BLUE}Auto-rollback to latest snapshot${NC}"
    
    latest_snapshot=$(find "$BACKUP_DIR" -name "pre_migration_snapshot_*" -type d | sort -r | head -1)
    
    if [ -z "$latest_snapshot" ]; then
        print_error "No snapshots found for rollback"
        exit 1
    fi
    
    snapshot_name=$(basename "$latest_snapshot")
    echo "Latest snapshot found: $snapshot_name"
    
    rollback_to_snapshot "$snapshot_name"
}

# Clean up new collections (partial rollback)
cleanup_new_collections() {
    echo -e "\n${BLUE}Cleaning up new collections${NC}"
    
    print_warning "This will remove all new collections created by migration"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # List of new collections to remove
        new_collections=(
            "customers"
            "categories" 
            "skunews"
            "itemnews"
            "tagnews"
            "inventories"
            "auditlogs"
        )
        
        for collection in "${new_collections[@]}"; do
            mongosh "$LOCAL_DB_NAME" --eval "db.$collection.drop()" > /dev/null 2>&1
            print_status "Dropped collection: $collection"
        done
        
        print_status "New collections cleaned up"
    else
        print_error "Cleanup cancelled"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "list")
            list_snapshots
            ;;
        "rollback")
            if [ -z "$2" ]; then
                print_error "Please specify snapshot name"
                echo "Usage: $0 rollback <snapshot_name>"
                echo ""
                list_snapshots
                exit 1
            fi
            rollback_to_snapshot "$2"
            ;;
        "auto")
            auto_rollback
            ;;
        "cleanup")
            cleanup_new_collections
            ;;
        "help"|*)
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  list     - List available snapshots"
            echo "  rollback <snapshot_name> - Rollback to specific snapshot"
            echo "  auto     - Auto-rollback to latest snapshot"
            echo "  cleanup  - Remove new collections (partial rollback)"
            echo "  help     - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 list"
            echo "  $0 rollback pre_migration_snapshot_20240122_144530"
            echo "  $0 auto"
            echo "  $0 cleanup"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
