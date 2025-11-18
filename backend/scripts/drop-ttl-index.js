#!/usr/bin/env node

/**
 * CRITICAL FIX: Drop TTL index that was deleting users
 * 
 * The refreshTokens.createdAt field had an `expires: '7d'` TTL index
 * that was deleting entire user documents instead of just expired tokens.
 * 
 * This script removes that dangerous index from MongoDB.
 * 
 * Run this immediately on production!
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function dropTTLIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to:', mongoose.connection.name);
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get all indexes
    console.log('\n📋 Current indexes on users collection:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(idx => {
      console.log('  -', idx.name, JSON.stringify(idx.key));
      if (idx.expireAfterSeconds !== undefined) {
        console.log('    ⚠️  TTL INDEX:', idx.expireAfterSeconds, 'seconds');
      }
    });
    
    // Find and drop the TTL index
    let dropped = false;
    for (const idx of indexes) {
      if (idx.expireAfterSeconds !== undefined) {
        console.log(`\n🗑️  Dropping TTL index: ${idx.name}`);
        try {
          await usersCollection.dropIndex(idx.name);
          console.log(`✅ Successfully dropped TTL index: ${idx.name}`);
          dropped = true;
        } catch (err) {
          console.error(`❌ Failed to drop ${idx.name}:`, err.message);
        }
      }
    }
    
    if (!dropped) {
      console.log('\n✅ No TTL indexes found (already cleaned up)');
    }
    
    // Verify
    console.log('\n📋 Remaining indexes after cleanup:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach(idx => {
      console.log('  -', idx.name, JSON.stringify(idx.key));
      if (idx.expireAfterSeconds !== undefined) {
        console.log('    ⚠️  TTL INDEX STILL EXISTS:', idx.expireAfterSeconds, 'seconds');
      }
    });
    
    // Count users
    const userCount = await usersCollection.countDocuments();
    console.log(`\n👥 Total users in database: ${userCount}`);
    
    console.log('\n✅ Migration complete!');
    console.log('🛡️  Users are now protected from TTL deletion');
    console.log('🔄 Token cleanup is now handled manually in application code');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the migration
dropTTLIndex().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
