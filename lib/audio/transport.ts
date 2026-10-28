// ============================================================================
// Studio transport - the master clock every instrument can follow.
//
// Works like MIDI clock in a hardware studio: 24 pulses per quarter note (PPQN)
// scheduled ahead on the audio clock, plus start/stop/continue/song-position
// events. Instruments with MIDI sync (Elektrons, Sub 37 arp, Mother-32,
// Subharmonicon) subscribe to it; clock-only gear (DFAM) is synced by patching
// the Studio Clock's CLOCK OUT jack into its ADV/CLOCK input - exactly like
// real hardware.
//
// Timing: ticks carry the audio-context time they should sound at, so
// subscribers schedule audio sample-accurately. Never use the callback's
// wall-clock moment as musical time.
// ============================================================================

export const PPQN = 24;

export interface TransportTick {
  /** Audio-context time of this tick */
  time: number;
  /** Absolute tick count since start (0-based) */
  tick: number;
  /** Seconds per tick at the current tempo (for gate lengths etc.) */
  tickDuration: number;
  /** Convenience: position in musical units */
  beat: number;      // quarter notes since start (float)
  bar: number;       // 0-based bar index (4/4)
  sixteenth: number; // 0-based 16th index since start
}

export type TransportEvent =
  | { type: 'start'; time: number }
  | { type: 'stop'; time: number }
  | { type: 'tempo'; bpm: number }
  | { type: 'locate'; tick: number };

type TickListener = (t: TransportTick) => void;
type EventListener = (e: TransportEvent) => void;

export class Transport {
  private ctx: BaseAudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickListeners = new Set<TickListener>();
  private eventListeners = new Set<EventListener>();
  private nextTickTime = 0;
  private tickCount = 0;
  private _bpm = 120;
  private _swing = 0; // 0..0.75 - delays every second 16th
  private _playing = false;
  private startTime = 0;
  readonly lookahead = 0.1;
  readonly interval = 0.02;

  attach(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  get bpm() { return this._bpm; }
  get playing() { return this._playing; }
  get swing() { return this._swing; }
  /** Audio time playback (tick 0) started */
  get startedAt() { return this.startTime; }
  get position() { return this.tickCount; }

  setBpm(bpm: number) {
    const b = Math.max(20, Math.min(300, bpm));
    if (b === this._bpm) return;
    this._bpm = b;
    this.eventListeners.forEach(l => l({ type: 'tempo', bpm: b }));
  }

  /** Swing amount 0..0.75: fraction of a 16th that off-beat 16ths are delayed by */
  setSwing(amount: number) {
    this._swing = Math.max(0, Math.min(0.75, amount));
  }

  tickDuration(): number {
    return 60 / this._bpm / PPQN;
  }

  /** Start from the top (or continue from the current position with `fromTick`) */
  start(atTime?: number, fromTick = 0) {
    if (!this.ctx || this._playing) return;
    const t = Math.max(this.ctx.currentTime + 0.05, atTime ?? 0);
    this._playing = true;
    this.tickCount = fromTick;
    this.nextTickTime = t;
    this.startTime = t;
    this.eventListeners.forEach(l => l({ type: 'start', time: t }));
    this.timer = setInterval(() => this.pump(), this.interval * 1000);
    this.pump();
  }

  stop() {
    if (!this._playing || !this.ctx) return;
    this._playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.eventListeners.forEach(l => l({ type: 'stop', time: t }));
  }

  toggle() {
    if (this._playing) this.stop();
    else this.start();
  }

  /** Move the song position (applies on next start or immediately while playing) */
  locate(tick: number) {
    this.tickCount = Math.max(0, Math.floor(tick));
    this.eventListeners.forEach(l => l({ type: 'locate', tick: this.tickCount }));
  }

  onTick(l: TickListener): () => void {
    this.tickListeners.add(l);
    return () => this.tickListeners.delete(l);
  }

  onEvent(l: EventListener): () => void {
    this.eventListeners.add(l);
    return () => this.eventListeners.delete(l);
  }

  /** Audio time of a future tick (assuming constant tempo) */
  timeOfTick(tick: number): number {
    return this.nextTickTime + (tick - this.tickCount) * this.tickDuration();
  }

  private pump() {
    if (!this.ctx || !this._playing) return;
    const horizon = this.ctx.currentTime + this.lookahead;
    // Tab throttled for a long time: resync rather than firing a burst of stale ticks
    if (this.nextTickTime < this.ctx.currentTime - 0.3) this.nextTickTime = this.ctx.currentTime + 0.01;
    let guard = 0;
    while (this.nextTickTime < horizon && guard++ < 2048) {
      const tick = this.tickCount;
      const dur = this.tickDuration();
      // Swing: delay the off-beat 16th (ticks 6..11 of each 12-tick pair)
      const in16th = tick % 12;
      const swingOffset = in16th >= 6 ? this._swing * 6 * dur : 0;
      const ev: TransportTick = {
        time: this.nextTickTime + swingOffset,
        tick,
        tickDuration: dur,
        beat: tick / PPQN,
        bar: Math.floor(tick / (PPQN * 4)),
        sixteenth: Math.floor(tick / (PPQN / 4)),
      };
      this.tickListeners.forEach(l => l(ev));
      this.tickCount++;
      this.nextTickTime += dur;
    }
  }
}

/** The app-wide studio transport */
export const transport = new Transport();

/** True on the first tick of every 16th note */
export const isSixteenth = (t: TransportTick) => t.tick % (PPQN / 4) === 0;
/** True on the first tick of every bar (4/4) */
export const isBarStart = (t: TransportTick) => t.tick % (PPQN * 4) === 0;
