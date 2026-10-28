// ============================================================================
// MIDI clock out: the studio transport as 24 PPQN MIDI clock, Start / Stop /
// Continue and Song Position, sent to the chosen output ports so real
// hardware plays in sync with the twins.
//
// Every message is scheduled with output.send(bytes, timestamp): transport
// ticks are generated ~100 ms ahead on the audio clock and mapped to
// performance.now() time (see time.ts), so the clock is as steady as the audio
// clock, not the main thread.
//
// Swing is *not* sent: the transport delays off-beat 16ths for the twins, but
// MIDI clock stays even (hardware PLLs its tempo from the clock; uneven pulses
// would make it wobble). Apply swing on the hardware itself.
// ============================================================================

import { PPQN, type Transport, type TransportTick, type TransportEvent } from '@/lib/audio/transport';
import { CONTINUE, START, STOP, TIMING_CLOCK, songPosition } from './bytes';
import { audioToMidiTime } from './time';
import type { MidiOutputLike } from './access';
import type { ClockOutSettings, PortRef } from '@/store/midi';

type TransportLike = Pick<Transport, 'onTick' | 'onEvent' | 'position' | 'playing' | 'swing'>;
type Ctx = Pick<BaseAudioContext, 'currentTime'> & { baseLatency?: number; outputLatency?: number };

export interface ClockOutDeps {
  transport: TransportLike;
  ctx: () => Ctx | null;
  settings: () => ClockOutSettings;
  resolve: (ref: PortRef) => MidiOutputLike | null;
  now?: () => number;
}

interface Target {
  out: MidiOutputLike;
  /** Latest timestamp queued on this port - Stop goes after it */
  lastTs: number;
  /** Joined mid-song: send Song Position + Continue on the next MIDI beat */
  pendingJoin: boolean;
}

/** Clocks between MIDI beats (Song Position counts 16th notes) */
const CLOCKS_PER_MIDI_BEAT = PPQN / 4;

export class MidiClockOut {
  private unsub: (() => void)[] = [];
  private targets = new Map<string, Target>();
  /** Messages sent (for the settings dialog and tests) */
  sent = 0;

  constructor(private deps: ClockOutDeps) {}

  start() {
    if (this.unsub.length) return;
    this.unsub.push(this.deps.transport.onEvent(e => this.onEvent(e)));
    this.unsub.push(this.deps.transport.onTick(t => this.onTick(t)));
  }

  stop() {
    this.unsub.forEach(u => u());
    this.unsub = [];
    this.targets.clear();
  }

  private now() {
    return this.deps.now ? this.deps.now() : performance.now();
  }

  private ts(audioTime: number): number {
    const ctx = this.deps.ctx();
    if (!ctx) return this.now();
    const s = this.deps.settings();
    return audioToMidiTime(ctx, audioTime, { compensate: s.compensate, offsetMs: s.offsetMs }, this.now());
  }

  private send(t: Target, data: number[], ts: number) {
    try {
      if (ts > this.now()) t.out.send(data, ts);
      else t.out.send(data);
      this.sent++;
    } catch {
      /* port vanished */
    }
    t.lastTs = Math.max(t.lastTs, ts);
  }

  /** Resolve the configured ports; notice joins and leaves */
  private sync(playing: boolean): Target[] {
    const wanted = new Map<string, MidiOutputLike>();
    this.deps.settings().targets.forEach(ref => {
      const out = this.deps.resolve(ref);
      if (out) wanted.set(out.id, out);
    });
    // Ports removed while playing get a Stop so they don't hang
    this.targets.forEach((t, id) => {
      if (!wanted.has(id)) {
        if (playing) this.send(t, [STOP], Math.max(this.now(), t.lastTs + 0.5));
        this.targets.delete(id);
      }
    });
    wanted.forEach((out, id) => {
      const t = this.targets.get(id);
      if (t) t.out = out;
      else this.targets.set(id, { out, lastTs: 0, pendingJoin: playing });
    });
    return [...this.targets.values()];
  }

  private onEvent(e: TransportEvent) {
    if (e.type === 'start') {
      const targets = this.sync(false);
      const pos = this.deps.transport.position;
      const s = this.deps.settings();
      // One ms before the first clock so Start/Continue always arrives first
      const at = this.ts(e.time) - 1;
      targets.forEach(t => {
        t.pendingJoin = false;
        if (pos > 0 && s.spp) {
          this.send(t, songPosition(pos / CLOCKS_PER_MIDI_BEAT), at);
          this.send(t, [CONTINUE], at);
        } else {
          this.send(t, [START], at);
        }
      });
    } else if (e.type === 'stop') {
      // After every clock already queued on the port
      this.targets.forEach(t => this.send(t, [STOP], Math.max(this.now(), t.lastTs + 0.5)));
    } else if (e.type === 'locate') {
      if (this.deps.transport.playing || !this.deps.settings().spp) return;
      this.sync(false).forEach(t => this.send(t, songPosition(e.tick / CLOCKS_PER_MIDI_BEAT), this.now()));
    }
  }

  private onTick(t: TransportTick) {
    const targets = this.sync(true);
    if (!targets.length) return;
    // Even clock: undo the transport's swing offset on off-beat 16ths
    const swung = t.tick % (PPQN / 2) >= PPQN / 4;
    const straight = swung ? t.time - this.deps.transport.swing * (PPQN / 4) * t.tickDuration : t.time;
    const ts = this.ts(straight);
    const s = this.deps.settings();
    targets.forEach(target => {
      if (target.pendingJoin) {
        // Joined mid-song. With Song Position: on the next MIDI beat send SPP + Continue right
        // before its clock. Without: wait for the next bar and send Start, so patterns line up.
        const join = s.spp ? t.tick % CLOCKS_PER_MIDI_BEAT === 0 : t.tick % (PPQN * 4) === 0;
        if (!join) return;
        target.pendingJoin = false;
        if (s.spp && t.tick > 0) {
          this.send(target, songPosition(t.tick / CLOCKS_PER_MIDI_BEAT), ts - 1);
          this.send(target, [CONTINUE], ts - 1);
        } else {
          this.send(target, [START], ts - 1);
        }
      }
      this.send(target, [TIMING_CLOCK], ts);
    });
  }
}
