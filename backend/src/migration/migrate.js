#!/usr/bin/env node
/**
 * MongoDB Schema Migration - Main Execution Script
 * 
 * Usage:
 *   node src/migration/migrate.js --dry-run          # Test run without actual migration
 *   node src/migration/migrate.js --production       # Production migration
 *   node src/migration/migrate.js --help             # Show help
 */

const path = require('path');
const MigrationOrchestrator = require('./MigrationOrchestrator');

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    help: false,
    production: false,
    mongoUri: null,
    dumpPath: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--production':
        options.production = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--mongo-uri':
        options.mongoUri = args[++i];
        break;
      case '--dump-path':
        options.dumpPath = args[++i];
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

// Display help information
function showHelp() {
  console.log(`
📦 MongoDB Schema Migration Utility
====================================

DESCRIPTION:
  Migrates legacy MongoDB database to new schema structure.
  Transforms SKUs, Items, Categories, and calculates Inventory.

USAGE:
  node src/migration/migrate.js [OPTIONS]

OPTIONS:
  --dry-run                    Validate and transform data without writing to database
  --production                 Run production migration (requires confirmation)
  --mongo-uri <uri>            MongoDB connection URI (overrides MONGODB_URI env)
  --dump-path <path>           Path to BSON dump directory (default: dump/stock_manager)
  --help, -h                   Show this help message

EXAMPLES:
  # Test migration without making changes
  node src/migration/migrate.js --dry-run

  # Production migration with confirmation
  node src/migration/migrate.js --production

  # Custom dump path
  node src/migration/migrate.js --dump-path /path/to/dump --dry-run

ENVIRONMENT VARIABLES:
  MONGODB_URI                  MongoDB connection string (required)

SAFETY FEATURES:
  - Comprehensive data validation
  - Dry run mode for testing
  - Automatic backups
  - Detailed logging and reporting
  - Transaction safety

MIGRATION PROCESS:
  1. Environment validation
  2. Data extraction from BSON dumps  
  3. Data transformation to new schema
  4. Validation of transformed data
  5. Database operations (if not dry run)
  6. Post-migration validation
  7. Comprehensive reporting
`);
}

// Confirm production migration
async function confirmProduction() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('🚨 PRODUCTION MIGRATION WARNING 🚨');
    console.log('=====================================');
    console.log('This will modify your production database!');
    console.log('- All existing collections will be cleared');
    console.log('- Data will be transformed to new schema');
    console.log('- This operation cannot be easily undone');
    console.log('');
    console.log('Please ensure you have:');
    console.log('✅ Recent database backup');
    console.log('✅ Tested migration with --dry-run');
    console.log('✅ Scheduled maintenance window');
    console.log('✅ Team notification/approval');
    console.log('');

    rl.question('Type "MIGRATE PRODUCTION" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'MIGRATE PRODUCTION');
    });
  });
}

// Main execution function
async function main() {
  console.log('🚀 MongoDB Schema Migration Utility');
  console.log('====================================\\n');

  const options = parseArguments();

  // Show help if requested
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Production confirmation
  if (options.production && !options.dryRun) {
    const confirmed = await confirmProduction();
    if (!confirmed) {
      console.log('❌ Production migration cancelled by user');
      process.exit(0);
    }
  }

  // Setup migration options
  const migrationOptions = {
    dryRun: options.dryRun,
    mongoUri: options.mongoUri || process.env.MONGODB_URI,
    dumpPath: options.dumpPath || 'dump/stock_manager',
    backupDir: 'migration_backup'
  };

  // Validate required options
  if (!migrationOptions.mongoUri) {
    console.error('❌ Error: MongoDB URI not provided');
    console.error('   Set MONGODB_URI environment variable or use --mongo-uri option');
    process.exit(1);
  }

  try {
    // Create and run migration
    const orchestrator = new MigrationOrchestrator(migrationOptions);
    await orchestrator.runMigration();

    console.log('\\n🎉 Migration completed successfully!');
    
    if (migrationOptions.dryRun) {
      console.log('\\n💡 Next steps:');
      console.log('   1. Review the migration report above');
      console.log('   2. Fix any validation errors if present');
      console.log('   3. Run production migration: node src/migration/migrate.js --production');
    } else {
      console.log('\\n💡 Next steps:');
      console.log('   1. Verify application functionality');
      console.log('   2. Test critical user workflows');
      console.log('   3. Monitor system performance');
      console.log('   4. Notify team of completion');
    }

  } catch (error) {
    console.error('\\n❌ Migration failed:', error.message);
    
    if (error.stack) {
      console.error('\\nStack trace:');
      console.error(error.stack);
    }

    console.error('\\n🔧 Troubleshooting:');
    console.error('   1. Check MongoDB connection');
    console.error('   2. Verify BSON dump files exist');
    console.error('   3. Review error messages above');
    console.error('   4. Run with --dry-run for validation');
    
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\\n⚠️  Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\\n⚠️  Migration terminated');
  process.exit(1);
});

// Run the migration
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main, parseArguments };
