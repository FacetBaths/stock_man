#!/usr/bin/env node
/**
 * CLI wrapper for the tag notes migration.
 *
 * Run with:
 *   node backend/src/migration/migrate-tag-notes-to-thread.js [--dry-run]
 *
 * Production/Railway doesn't need this script — the server invokes the
 * same function automatically at startup. Use the CLI locally or for
 * ad-hoc operator runs.
 */

const path = require('path');
const mongoose = require('mongoose');

// Load env from the backend folder so MONGODB_URI is picked up regardless
// of the current working directory.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { runTagNotesMigration } = require('./runTagNotesMigration');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB (${DRY_RUN ? 'DRY RUN' : 'LIVE'})...`);
  await mongoose.connect(uri);

  await runTagNotesMigration({ dryRun: DRY_RUN });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
