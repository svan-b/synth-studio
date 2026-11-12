// ============================================================================
// Marks store changes that are not the user's edits (engines initialising their
// data, the arranger's knob snapshots, transport mirroring), so undo history
// never records them. Separate from history.ts so the hub and arranger can use
// it without an import cycle.
// ============================================================================

let depth = 0;

/** Run `fn`; store changes it makes synchronously are not recorded for undo */
export function withoutHistory<T>(fn: () => T): T {
  depth++;
  try {
    return fn();
  } finally {
    depth--;
  }
}

export function historyPaused(): boolean {
  return depth > 0;
}
