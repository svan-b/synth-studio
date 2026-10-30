// ============================================================================
// LockTracker - per-voice parameter-lock bookkeeping for engines
//
// Elektron p-locks belong to one trig: when a trig plays, the voice's
// parameters are the track (kit) values with that trig's locks on top. They
// hold while the note rings out, and the NEXT trig on the track (note trig or
// lock trig) returns every parameter it doesn't lock itself to the track value.
//
//   onTrig: e => {
//     const v = this.voices[e.track];
//     this.lockState.apply(e.track, e.locks,
//       (key, value) => this.applyParam(v, key, value, e.time),            // lock
//       key => this.applyParam(v, key, this.trackValue(v, key), e.time));  // revert
//     if (!e.trigless) v.noteOn(e.note, e.velocity, e.time, e.duration);
//   }
//   onParam(id, value) { ...; if (this.lockState.isLocked(track, key)) return; ... }
//
// Allocation-free after warm-up (one Set per track, reused).
// ============================================================================

export class LockTracker {
  private held: Set<string>[];
  private values: Map<string, number>[];

  constructor(tracks: number) {
    this.held = Array.from({ length: tracks }, () => new Set<string>());
    this.values = Array.from({ length: tracks }, () => new Map<string, number>());
  }

  /**
   * A trig on `track`: `lock(key, value)` for each of its locks, then
   * `revert(key)` for every key the previous trig locked and this one doesn't.
   */
  apply(
    track: number,
    locks: Readonly<Record<string, number>>,
    lock: (key: string, value: number) => void,
    revert: (key: string) => void,
  ): void {
    const held = this.held[track];
    const vals = this.values[track];
    if (!held) return;
    held.forEach(k => {
      if (!(k in locks)) {
        held.delete(k);
        vals.delete(k);
        revert(k);
      }
    });
    for (const k in locks) {
      const v = locks[k];
      held.add(k);
      vals.set(k, v);
      lock(k, v);
    }
  }

  /**
   * Lock `key` on the trig that is playing now, e.g. a lock recorded live while the track plays:
   * like the trig's own locks it holds until the next trig on the track, which reverts it unless
   * it locks the key too
   */
  add(track: number, key: string, value: number): void {
    const held = this.held[track];
    if (!held) return;
    held.add(key);
    this.values[track].set(key, value);
  }

  /** The playing trig holds a lock for `key` (a knob turn should not override it mid-note) */
  isLocked(track: number, key: string): boolean {
    return !!this.held[track]?.has(key);
  }

  lockedValue(track: number, key: string): number | undefined {
    return this.values[track]?.get(key);
  }

  /** Revert everything on a track (sequencer stopped) */
  release(track: number, revert: (key: string) => void): void {
    const held = this.held[track];
    if (!held) return;
    held.forEach(k => revert(k));
    held.clear();
    this.values[track].clear();
  }

  releaseAll(revert: (track: number, key: string) => void): void {
    this.held.forEach((_, t) => this.release(t, k => revert(t, k)));
  }
}
