// ============================================================================
// Follow an external MIDI clock (optional, off by default).
//
//   tempo  least-squares fit over the last ~3 beats of clock timestamps
//          (Web MIDI gives OS timestamps, so jitter from the main thread doesn't matter)
//   start  Start / Continue / Stop / Song Position drive the studio transport
//   phase  once a beat, compare when the studio played that beat with when the
//          external clock delivered it, and nudge the tempo (at most ±2 %) to
//          hold the offset measured at the first beat - a gentle phase lock, so
//          long takes don't drift
//
// The studio necessarily plays a little *after* the external clock (it can only
// react to Start, then schedules ahead). That offset stays constant.
// ============================================================================

import { PPQN, type Transport, type TransportTick } from '@/lib/audio/transport';
import type { MidiMessage } from './bytes';
import { midiToAudioTime } from './time';

type TransportLike = Pick<Transport, 'start' | 'stop' | 'locate' | 'setBpm' | 'bpm' | 'playing' | 'onTick' | 'swing'>;
type Ctx = Pick<BaseAudioContext, 'currentTime'>;

export interface ClockInDeps {
  transport: TransportLike;
  ctx: () => Ctx | null;
  /** Show the measured tempo in the UI (called at most twice a second) */
  setDisplayBpm?: (bpm: number) => void;
  /** Unlock audio before following an external Start */
  beforeStart?: () => void;
  now?: () => number;
}

export interface ClockInStatus {
  receiving: boolean;
  bpm: number | null;
  /** Following an external Start (until Stop) */
  running: boolean;
  /** Last phase error vs the locked offset, ms */
  phaseMs: number | null;
}

const WINDOW = 72;          // clocks in the tempo fit (3 beats)
const MIN_FIT = 12;         // clocks before the first estimate
const MAX_NUDGE = 0.02;     // ±2 % tempo correction
const PHASE_GAIN = 0.25;    // fraction of the phase error corrected per beat
const RELOCK_S = 0.08;      // bigger errors (tab throttled, port hiccup): re-measure instead of chasing

export class MidiClockIn {
  private stamps: number[] = [];
  private lastClock = -Infinity;
  private nextTick = 0;
  private following = false;
  private sppTicks = 0;
  private internal = new Map<number, number>();
  private offset: number | null = null;
  private est: number | null = null;
  private lastApply = -Infinity;
  private lastDisplay = -Infinity;
  private shown = 0;
  private phase: number | null = null;
  private nudge = 0;
  private unsub: (() => void) | null = null;

  constructor(private deps: ClockInDeps) {}

  private now() {
    return this.deps.now ? this.deps.now() : performance.now();
  }

  attach() {
    if (this.unsub) return;
    this.unsub = this.deps.transport.onTick(t => this.onInternalTick(t));
  }

  detach() {
    this.unsub?.();
    this.unsub = null;
    this.reset();
  }

  reset() {
    this.stamps = [];
    this.following = false;
    this.internal.clear();
    this.offset = null;
    this.est = null;
    this.phase = null;
    this.nudge = 0;
  }

  status(): ClockInStatus {
    return {
      receiving: this.now() - this.lastClock < 500,
      bpm: this.est,
      running: this.following,
      phaseMs: this.phase === null ? null : this.phase * 1000,
    };
  }

  /** Feed every message from the followed input */
  handle(msg: MidiMessage, timeStamp: number) {
    switch (msg.type) {
      case 'clock': this.onClock(timeStamp); break;
      case 'start': this.begin(0); break;
      case 'continue': this.begin(this.sppTicks); break;
      case 'stop':
        this.following = false;
        if (this.deps.transport.playing) this.deps.transport.stop();
        break;
      case 'songposition':
        this.sppTicks = msg.position * (PPQN / 4);
        if (!this.deps.transport.playing) this.deps.transport.locate(this.sppTicks);
        break;
    }
  }

  private begin(fromTick: number) {
    const t = this.deps.transport;
    this.deps.beforeStart?.();
    if (t.playing) t.stop();
    if (this.est) t.setBpm(this.est);
    this.following = true;
    this.nextTick = fromTick;
    this.offset = null;
    this.phase = null;
    this.nudge = 0;
    this.internal.clear();
    t.start(undefined, fromTick);
  }

  private onInternalTick(t: TransportTick) {
    if (!this.following) return;
    // Straight (un-swung) time, like the external clock
    const swung = t.tick % (PPQN / 2) >= PPQN / 4;
    this.internal.set(t.tick, swung ? t.time - this.deps.transport.swing * (PPQN / 4) * t.tickDuration : t.time);
    if (this.internal.size > 400) {
      const cut = t.tick - 300;
      this.internal.forEach((_, k) => { if (k < cut) this.internal.delete(k); });
    }
  }

  private onClock(ts: number) {
    // A long gap (external stopped sending, cable pulled): start a fresh fit
    if (this.stamps.length && ts - this.stamps[this.stamps.length - 1] > 250) this.stamps = [];
    this.lastClock = this.now();
    this.stamps.push(ts);
    if (this.stamps.length > WINDOW) this.stamps.shift();
    if (this.stamps.length >= MIN_FIT) this.est = fitBpm(this.stamps);

    let beat = false;
    if (this.following) {
      const k = this.nextTick++;
      if (k % PPQN === 0) beat = this.phaseLock(k, ts);
    } else {
      this.nudge = 0;
    }
    if (this.est === null) return;
    const target = this.est * (1 + this.nudge);
    const now = this.now();
    // Re-apply on every beat (new phase correction) and otherwise ~10x a second
    const diff = Math.abs(target - this.deps.transport.bpm);
    if ((beat && diff > 1e-4) || (now - this.lastApply > 100 && diff > (this.following ? 1e-3 : 0.02))) {
      this.deps.transport.setBpm(target);
      this.lastApply = now;
    }
    if (this.est !== null && now - this.lastDisplay > 500) {
      const shown = Math.round(this.est * 10) / 10;
      if (shown !== this.shown) {
        this.shown = shown;
        this.deps.setDisplayBpm?.(shown);
        // The display setter may round the transport tempo - put the precise one back
        this.deps.transport.setBpm(target);
      }
      this.lastDisplay = now;
    }
  }

  /**
   * Once a beat: compare when the studio played beat `k` with when the external
   * clock delivered it, and set the tempo nudge that steers back to the offset
   * measured at the first beat. Returns true when the nudge was updated.
   */
  private phaseLock(k: number, ts: number): boolean {
    const ctx = this.deps.ctx();
    const internal = this.internal.get(k);
    if (!ctx || internal === undefined || this.est === null) return false;
    const err = internal - midiToAudioTime(ctx, ts, this.now());
    if (this.offset === null || Math.abs(err - this.offset) > RELOCK_S) {
      this.offset = err;
      this.phase = 0;
      this.nudge = 0;
      return true;
    }
    const e = err - this.offset;
    this.phase = e;
    const beat = 60 / this.est;
    // Studio late (e > 0) -> play slightly faster until it catches up
    this.nudge = Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, (PHASE_GAIN * e) / beat));
    return true;
  }
}

/** Least-squares tempo from clock timestamps (ms) */
export function fitBpm(stamps: number[]): number | null {
  const n = stamps.length;
  if (n < 2) return null;
  const t0 = stamps[0];
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = stamps[i] - t0;
    sx += i; sy += y; sxx += i * i; sxy += i * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); // ms per clock
  if (!(slope > 0)) return null;
  const bpm = 60000 / (slope * PPQN);
  return bpm >= 20 && bpm <= 300 ? bpm : null;
}
