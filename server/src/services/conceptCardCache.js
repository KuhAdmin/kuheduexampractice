// In-process cache for the assembled concept-card response
// (studentContentService.js's getConceptCard). This content only changes
// through known, rare admin/moderator write paths (pipeline runs, layer
// version selection, moderation decisions) -- not student traffic -- so
// invalidation-on-write is the primary correctness mechanism, with a TTL
// as a backstop in case a write path is ever missed.
//
// Safe as a plain in-memory Map only because this app runs as a single
// Node process today (no cluster/PM2/worker fan-out). If that ever changes
// to multiple instances behind a load balancer, this needs to move to a
// shared store (e.g. Redis) or invalidation will only clear one instance's
// copy, leaving the others stale -- the get/set/invalidate interface below
// is kept small deliberately so that swap is localized to this file.

const TTL_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map();

export const get = (assessmentUnitId) => {
  const entry = store.get(assessmentUnitId);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    store.delete(assessmentUnitId);
    return undefined;
  }
  return entry.value;
};

export const set = (assessmentUnitId, value) => {
  store.set(assessmentUnitId, { value, expiresAt: Date.now() + TTL_MS });
};

export const invalidate = (assessmentUnitId) => {
  store.delete(assessmentUnitId);
};
