// Summaries are computed from instances, never persisted on the SKU or inventory.
function summarizeInstanceLocations(locations = []) {
  const counts = new Map();
  for (const value of locations) {
    const location = typeof value === 'string' ? value.trim() || null : null;
    counts.set(location, (counts.get(location) || 0) + 1);
  }
  return Array.from(counts, ([location, quantity]) => ({ location, quantity }))
    .sort((a, b) => {
      if (a.location === null) return 1;
      if (b.location === null) return -1;
      return a.location.localeCompare(b.location);
    });
}

module.exports = { summarizeInstanceLocations };
