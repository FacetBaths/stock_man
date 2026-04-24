/**
 * Tag notes migration (reusable).
 *
 * Converts legacy `tag.notes` strings (pre-chat-thread schema) into
 * single-entry thread arrays. Runs as raw MongoDB operations so string
 * content is preserved verbatim (Mongoose's cast layer would otherwise
 * strip it before we could read it).
 *
 * This function is safe to call on every backend boot:
 *   - Idempotent (only matches `notes` values of type "string").
 *   - Read-only on tags that are already in the new shape.
 *   - Never throws out of the call site if MongoDB isn't ready; it logs
 *     and resolves so server startup is never blocked.
 */

const mongoose = require('mongoose');

async function runTagNotesMigration({ dryRun = false, logger = console } = {}) {
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1 || !conn.db) {
    logger.warn('[tag-notes-migration] Skipped: no active MongoDB connection.');
    return { skipped: true };
  }

  const tags = conn.db.collection('tags');

  let scanned = 0;
  let migrated = 0;
  let clearedEmpty = 0;

  try {
    const cursor = tags.find({
      $expr: { $eq: [{ $type: '$notes' }, 'string'] }
    });

    while (await cursor.hasNext()) {
      const tag = await cursor.next();
      scanned += 1;

      const legacy = typeof tag.notes === 'string' ? tag.notes.trim() : '';
      const rawAuthor = tag.last_updated_by || tag.created_by || '';
      const author = rawAuthor || 'system';
      // If we couldn't pin the note to a real user, record it as a system
      // note so the UI shows it as system (not "Unknown") and it stays
      // immutable instead of appearing partially editable.
      const kind = rawAuthor ? 'user' : 'system';
      const createdAt = tag.updatedAt || tag.createdAt || new Date();

      let newNotes;
      if (legacy.length > 0) {
        newNotes = [{
          _id: new mongoose.Types.ObjectId(),
          message: legacy,
          author,
          kind,
          createdAt,
          updatedAt: createdAt
        }];
        migrated += 1;
      } else {
        newNotes = [];
        clearedEmpty += 1;
      }

      if (!dryRun) {
        await tags.updateOne(
          { _id: tag._id },
          { $set: { notes: newNotes } }
        );
      }
    }

    if (scanned > 0) {
      logger.log(
        `[tag-notes-migration] ${dryRun ? 'DRY RUN ' : ''}` +
        `scanned=${scanned} migrated=${migrated} clearedEmpty=${clearedEmpty}`
      );
    } else {
      logger.log('[tag-notes-migration] Nothing to migrate (all tags already use thread format).');
    }

    return { skipped: false, scanned, migrated, clearedEmpty, dryRun };
  } catch (err) {
    logger.error('[tag-notes-migration] Failed:', err);
    return { skipped: false, error: err.message };
  }
}

module.exports = { runTagNotesMigration };
