#!/bin/bash

# Migration Environment Setup Script
# Checks prerequisites and installs dependencies for migration testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Migration Environment Setup${NC}"
echo "================================"

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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
check_nodejs() {
    print_info "Checking Node.js installation..."
    
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_status "Node.js found: $NODE_VERSION"
        
        # Check if version is adequate (v14+)
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -ge 14 ]; then
            print_status "Node.js version is adequate"
        else
            print_warning "Node.js version should be 14+ for best compatibility"
        fi
    else
        print_error "Node.js not found. Please install Node.js 14+ from https://nodejs.org/"
        return 1
    fi
    
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_status "npm found: $NPM_VERSION"
    else
        print_error "npm not found. Please install npm"
        return 1
    fi
}

# Check MongoDB
check_mongodb() {
    print_info "Checking MongoDB installation..."
    
    if command_exists mongosh; then
        MONGO_VERSION=$(mongosh --version)
        print_status "MongoDB client found: $MONGO_VERSION"
    elif command_exists mongo; then
        MONGO_VERSION=$(mongo --version | head -1)
        print_status "MongoDB client found: $MONGO_VERSION"
    else
        print_error "MongoDB client not found. Please install MongoDB from https://docs.mongodb.com/manual/installation/"
        return 1
    fi
    
    if command_exists mongod; then
        print_status "MongoDB server found"
        
        # Check if MongoDB is running
        if pgrep -x "mongod" > /dev/null; then
            print_status "MongoDB server is running"
        else
            print_warning "MongoDB server is not running. You'll need to start it before migration."
            print_info "Start MongoDB with: sudo systemctl start mongod (Linux) or brew services start mongodb/brew/mongodb-community (Mac)"
        fi
    else
        print_error "MongoDB server not found. Please install MongoDB server"
        return 1
    fi
    
    if command_exists mongodump; then
        print_status "mongodump found (needed for backups)"
    else
        print_error "mongodump not found. Please install MongoDB tools"
        return 1
    fi
    
    if command_exists mongorestore; then
        print_status "mongorestore found (needed for restores)"
    else
        print_error "mongorestore not found. Please install MongoDB tools"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    print_info "Checking available disk space..."
    
    AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
    # Convert to MB (assuming 1024 byte blocks)
    AVAILABLE_MB=$((AVAILABLE_SPACE / 1024))
    
    print_info "Available disk space: ${AVAILABLE_MB}MB"
    
    if [ "$AVAILABLE_MB" -gt 500 ]; then
        print_status "Sufficient disk space available"
    else
        print_warning "Low disk space. Recommend having at least 500MB free for backups"
    fi
}

# Install/check npm dependencies
check_dependencies() {
    print_info "Checking npm dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_warning "package.json not found. Make sure you're in the project root directory."
        return 1
    fi
    
    # Check if node_modules exists and has mongoose
    if [ -d "node_modules" ] && [ -d "node_modules/mongoose" ]; then
        print_status "Dependencies appear to be installed"
    else
        print_info "Installing npm dependencies..."
        npm install
        
        if [ $? -eq 0 ]; then
            print_status "Dependencies installed successfully"
        else
            print_error "Failed to install dependencies"
            return 1
        fi
    fi
    
    # Check specific required packages
    required_packages=("mongoose" "dotenv")
    for package in "${required_packages[@]}"; do
        if [ -d "node_modules/$package" ]; then
            print_status "$package is installed"
        else
            print_warning "$package not found. Installing..."
            npm install "$package"
        fi
    done
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p scripts
    mkdir -p backups
    
    print_status "Directories created"
}

# Check environment variables
check_environment() {
    print_info "Checking environment configuration..."
    
    if [ -f ".env" ]; then
        print_status ".env file found"
    else
        print_info "Creating sample .env file..."
        cat > .env << EOF
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/stockmanager_dev
MONGO_PRODUCTION_URI=

# Migration Configuration
MIGRATION_LOG_LEVEL=info
MIGRATION_BATCH_SIZE=100

# Other configurations...
EOF
        print_status "Sample .env file created. Please update with your actual values."
    fi
    
    if [ -n "$MONGO_PRODUCTION_URI" ]; then
        print_status "MONGO_PRODUCTION_URI is set"
    else
        print_warning "MONGO_PRODUCTION_URI not set. You'll need to set this for production backup."
        print_info "Example: export MONGO_PRODUCTION_URI='mongodb+srv://user:pass@cluster.mongodb.net/stockmanager'"
    fi
}

# Verify script permissions
check_script_permissions() {
    print_info "Checking script permissions..."
    
    scripts_to_check=(
        "scripts/db-backup-restore.sh"
        "scripts/rollback-migration.sh"
        "scripts/migrate-database.js"
    )
    
    for script in "${scripts_to_check[@]}"; do
        if [ -f "$script" ]; then
            if [ -x "$script" ]; then
                print_status "$script is executable"
            else
                print_info "Making $script executable..."
                chmod +x "$script"
                print_status "$script made executable"
            fi
        else
            print_warning "$script not found"
        fi
    done
}

# Main setup function
run_setup() {
    echo -e "\n${BLUE}Starting environment setup...${NC}\n"
    
    local errors=0
    
    check_nodejs || ((errors++))
    echo
    
    check_mongodb || ((errors++))
    echo
    
    check_disk_space
    echo
    
    check_dependencies || ((errors++))
    echo
    
    create_directories
    echo
    
    check_environment
    echo
    
    check_script_permissions
    echo
    
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}🎉 Environment setup completed successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Set your MONGO_PRODUCTION_URI environment variable"
        echo "2. Start MongoDB if it's not running"
        echo "3. Follow the migration testing guide: MIGRATION_TESTING_GUIDE.md"
        echo ""
        echo "Quick start command:"
        echo "./scripts/db-backup-restore.sh all"
    else
        echo -e "${RED}⚠️  Environment setup completed with $errors error(s)${NC}"
        echo "Please resolve the errors above before proceeding with migration."
        exit 1
    fi
}

# Run setup
run_setup
