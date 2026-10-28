// ============================================================================
// Mother-32 audio engine
//
// The whole instrument runs in one AudioWorklet ('mother32', public/worklets/
// mother32-processors.js): VCO, noise, mixer, ladder VCF, EG, VCA, LFO, the
// VC MIX / MULT / ASSIGN utilities and the 32-step sequencer with its clocks.
// This class only translates:
//
//   panel controls    -> port messages (model.ts knobMessage); the pattern lanes -> one 'seq' message
//   self-patches      -> the worklet's internal patch matrix (no Web Audio cycles)
//   other instruments -> 18 mono worklet inputs (1.0 = 5 V), each connected only while patched,
//                        and timed events for EventBus clocks / gates
//   studio transport  -> 24-PPQN ticks and start / stop (MIDI-clock style sync)
//   MIDI              -> notes, pitch bend, CC 64 sustain, CC 1/2/4/7 and pressure for ASSIGN
//   worklet reports   -> UI state { playing, step, litKey, gate, beat, transpose }
//
// Normals (hardware): NOISE -> EXT. AUDIO; EG -> VCO MOD (at the EG position of VCO MOD
// SOURCE); 0 V -> MIX 1; +5 V -> MIX 2. A cable in any of those replaces the normal.
// Everything else sums (1V/OCT with the keyboard, VCA CV with the VCA MODE, the GATE jack
// with the keyboard / sequencer gate).
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import { EVENT_INPUTS, INPUTS, NUM_INPUTS, NUM_OUTPUTS, OUTPUTS, SLOT, internalRoutes, knobMessage, octaveLow } from './model';
import { LANES, decodeForEngine } from './sequence';

type WorkletReport = { t: 's'; step: number; run: number; key: number; gate: number; beat: number; tr: number; acc: number; time: number };

const LANE_SET = new Set<string>([...LANES, 'seq_length']);

export class Mother32Engine extends BaseEngine {
  private node!: AudioWorkletNode;
  private split!: ChannelSplitterNode;
  private taps: GainNode[] = [];
  /** One gain per input jack, connected to the worklet only while a cable from another instrument is in */
  private pads: GainNode[] = [];
  private extCount = new Array<number>(NUM_INPUTS).fill(0);
  private intCount = new Array<number>(NUM_INPUTS).fill(0);
  private sentPatched = new Array<number>(NUM_INPUTS).fill(-1);
  private seqDirty = false;
  private keyNotes = new Map<number, number>();
  private unsubTransport: (() => void)[] = [];
  private lastKey = -1;

  protected build(): void {
    const ctx = this.ctx;
    this.node = new AudioWorkletNode(ctx, 'mother32', {
      numberOfInputs: NUM_INPUTS,
      numberOfOutputs: 1,
      outputChannelCount: [NUM_OUTPUTS],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    });
    this.split = ctx.createChannelSplitter(NUM_OUTPUTS);
    this.node.connect(this.split);
    for (let o = 0; o < NUM_OUTPUTS; o++) {
      const g = ctx.createGain();
      this.split.connect(g, o);
      this.taps.push(g);
    }
    this.taps[OUTPUTS.out_vca].connect(this.out);
    this.node.port.onmessage = (e: MessageEvent<WorkletReport>) => this.onReport(e.data);

    this.outputs = {};
    Object.entries(OUTPUTS).forEach(([jack, ch]) => { this.outputs[jack] = { node: this.taps[ch] }; });

    this.inputs = {};
    for (let j = 0; j < NUM_INPUTS; j++) {
      const pad = ctx.createGain();
      pad.channelCount = 1;
      pad.channelCountMode = 'explicit';
      this.pads.push(pad);
    }
    Object.entries(INPUTS).forEach(([jack, j]) => {
      const ev = EVENT_INPUTS[jack];
      this.inputs[jack] = {
        node: this.pads[j],
        onConnect: () => this.countExternal(j, 1),
        onDisconnect: () => this.countExternal(j, -1),
        // Clock / gate cables from other instruments may carry timed events too; the worklet
        // merges an event and an audio pulse that arrive together
        onEvent: ev ? (time, value) => this.post({ t: 'ev', ch: ev, time, v: value }) : undefined,
      };
    });

    this.onDispose(() => {
      this.unsubTransport.forEach(u => u());
      this.unsubTransport = [];
      this.node.port.onmessage = null;
      try { this.node.disconnect(); } catch { /* */ }
      try { this.split.disconnect(); } catch { /* */ }
      this.taps.forEach(t => { try { t.disconnect(); } catch { /* */ } });
      this.pads.forEach(p => { try { p.disconnect(); } catch { /* */ } });
    });
    this.emit({ playing: false, step: -1, litKey: -1, gate: 0, beat: 0, transpose: 0, synced: false });
  }

  private post(m: Record<string, unknown>) {
    this.node?.port.postMessage(m);
  }

  // --------------------------------------------------------------------------
  // Patching: self-patches become internal routes; normals follow the counts
  // --------------------------------------------------------------------------

  setPatches(connections: PatchConnection[]): void {
    if (!this.started) { super.setPatches(connections); return; }
    const { routes, counts } = internalRoutes(connections);
    this.intCount = counts;
    this.post({ t: 'routes', routes });
    this.syncPatched();
  }

  private countExternal(j: number, delta: number) {
    const before = this.extCount[j];
    this.extCount[j] = Math.max(0, before + delta);
    const pad = this.pads[j];
    if (before === 0 && this.extCount[j] > 0) pad.connect(this.node, 0, j);
    if (before > 0 && this.extCount[j] === 0) { try { pad.disconnect(this.node); } catch { /* */ } }
    this.syncPatched();
  }

  private syncPatched() {
    for (let j = 0; j < NUM_INPUTS; j++) {
      const on = this.extCount[j] + this.intCount[j] > 0 ? 1 : 0;
      if (on !== this.sentPatched[j]) {
        this.sentPatched[j] = on;
        this.post({ t: 'patched', i: j, v: on });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Studio transport (the Mother-32 follows MIDI clock and start / stop)
  // --------------------------------------------------------------------------

  protected onTransport(t: Transport | null): void {
    this.unsubTransport.forEach(u => u());
    this.unsubTransport = [];
    if (!this.started) return;
    if (!t) {
      this.post({ t: 'sync', on: 0 });
      this.emit({ synced: false });
      return;
    }
    this.post({ t: 'sync', on: 1 });
    if (t.playing) this.post({ t: 'tp', s: 1, time: 0 });
    this.unsubTransport.push(t.onTick(tick => this.post({ t: 'tk', time: tick.time, tick: tick.tick, dur: tick.tickDuration })));
    this.unsubTransport.push(t.onEvent(e => {
      if (e.type === 'start') this.post({ t: 'tp', s: 1, time: e.time });
      else if (e.type === 'stop') this.post({ t: 'tp', s: 0, time: e.time });
    }));
    this.emit({ synced: true });
  }

  // --------------------------------------------------------------------------
  // Keyboard, panel events and MIDI
  // --------------------------------------------------------------------------

  noteOn(note: number, velocity = 1): void {
    if (!this.started) return;
    this.post({ t: 'note', on: true, note, vel: velocity });
    this.emit({ noteEvent: { note, n: (this.getState().noteEvent as { n?: number } | undefined)?.n ?? 0 + 1 } });
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.post({ t: 'note', on: false, note });
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    switch (name) {
      case 'key': {
        // A panel key (0..12). Its note follows the OCTAVE / LOCATION setting
        const { i, on } = (payload ?? {}) as { i?: number; on?: boolean };
        if (typeof i !== 'number') return;
        if (on) {
          const note = octaveLow(this.num('kb_octave', 3)) + i;
          this.keyNotes.set(i, note);
          this.noteOn(note, 1);
        } else {
          const note = this.keyNotes.get(i);
          this.keyNotes.delete(i);
          if (note !== undefined) this.noteOff(note);
        }
        break;
      }
      case 'preview': if (typeof payload === 'number') this.post({ t: 'btn', b: 'preview', v: payload }); break;
      case 'reset': this.post({ t: 'btn', b: 'reset', v: 1 }); break;
      case 'hold': this.post({ t: 'btn', b: 'hold', v: 1 }); break;
      case 'hold:up': this.post({ t: 'btn', b: 'hold', v: 0 }); break;
      case 'live_accent': this.post({ t: 'btn', b: 'accent', v: 1 }); break;
      case 'live_accent:up': this.post({ t: 'btn', b: 'accent', v: 0 }); break;
      case 'live_mute': this.post({ t: 'btn', b: 'mute', v: 1 }); break;
      case 'live_mute:up': this.post({ t: 'btn', b: 'mute', v: 0 }); break;
      case 'transpose': this.post({ t: 'btn', b: 'transpose', v: typeof payload === 'number' ? payload : 0 }); break;
      case 'audition': this.post({ t: 'btn', b: 'audition', v: 1 }); break;
      case 'audition:stop': this.post({ t: 'btn', b: 'audition', v: 0 }); break;
    }
  }

  /** Raw MIDI from the studio's MIDI input (notes arrive through noteOn / noteOff) */
  receiveMidi(data: number[] | Uint8Array): void {
    if (!this.started || data.length < 2) return;
    const st = data[0] & 0xf0;
    if (st === 0xe0 && data.length >= 3) {
      const v = ((data[2] << 7) | data[1]) - 8192;
      this.post({ t: 'bend', v: v / 8192 });
    } else if (st === 0xb0 && data.length >= 3) {
      const cc = data[1], val = data[2] / 127;
      if (cc === 64) this.post({ t: 'sus', v: data[2] >= 64 ? 1 : 0 });
      else this.post({ t: 'cc', n: cc, v: val });
    } else if (st === 0xd0) {
      this.post({ t: 'pressure', v: data[1] / 127 });
    }
  }

  // --------------------------------------------------------------------------

  private onReport(m: WorkletReport) {
    if (m.t !== 's') return;
    const key = m.key;
    const low = octaveLow(this.num('kb_octave', 3));
    let litKey = -1;
    if (key >= 0) {
      const k = key - low;
      litKey = k >= 0 && k <= 12 ? k : ((k % 12) + 12) % 12;
    }
    if (key !== this.lastKey) this.lastKey = key;
    this.emit({ step: m.step, playing: !!m.run, litKey, gate: m.gate, beat: m.beat, transpose: m.tr, accent: m.acc });
  }

  protected onParam(id: string, value: ControlValue): void {
    if (LANE_SET.has(id)) {
      // Several lanes usually change together (a preset, a pattern recall): send the pattern once
      if (!this.seqDirty) {
        this.seqDirty = true;
        queueMicrotask(() => {
          this.seqDirty = false;
          if (this.started) this.post({ t: 'seq', ...decodeForEngine(this.params) });
        });
      }
      return;
    }
    const msg = knobMessage(id, value);
    if (msg) this.post({ t: 'k', i: msg[0], v: msg[1] });
    if (id === 'run_stop' && !this.transport) this.emit({ playing: !!value });
  }

  /** Ladder quality: 1 = 2x oversampled transistor core (default), 0 = 1x */
  setQuality(q: 0 | 1) {
    this.post({ t: 'k', i: SLOT.quality, v: q });
  }
}
