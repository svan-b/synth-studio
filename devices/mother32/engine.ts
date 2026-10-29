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
//   MIDI              -> notes, pitch bend (+/-1 octave; RPN 0 sets 0-12 semitones), CC 5 / 65
//                        portamento, CC 64 sustain, CC 1/2/4/7 and pressure for ASSIGN, program
//                        changes (pattern location 1-64, ASSIGN mode 71-86) - manual pp.56-57
//   worklet reports   -> UI state { playing, step, litKey, gate, beat, transpose, extClock, ... }
//
// Normals (manual pp.47-53): NOISE -> EXT. AUDIO; EG -> VCO MOD (the EG / VCO MOD position of
// VCO MOD SOURCE); 0 V -> MIX 1; +5 V -> MIX 2. A cable in any of those replaces the normal.
// Everything else sums (1V/OCT with FREQUENCY and the keyboard, VCA CV with the VCA MODE, the
// GATE jack with the keyboard / sequencer gate).
// ============================================================================

import type { ControlValue, PatchConnection } from '@/types';
import { BaseEngine } from '@/lib/audio/engine';
import type { Transport } from '@/lib/audio/transport';
import {
  EVENT_INPUTS, INPUTS, MAIN_CHANNEL, NUM_INPUTS, NUM_OUTPUTS, OUTPUTS, SLOT, internalRoutes, knobMessage, octaveLow,
} from './model';
import { LANES, decodeForEngine } from './sequence';

type WorkletReport = {
  t: 's'; step: number; run: number; key: number; gate: number; beat: number; tr: number; acc: number;
  ext: number; arm: number; swap: number; pend: number; time: number;
};

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
  private heldNotes = new Set<number>();
  private unsubTransport: (() => void)[] = [];
  private noteSeq = 0;
  private noteLog: { note: number; n: number; legato: boolean }[] = [];
  /** MIDI RPN being addressed (CC 101 / 100); RPN 0 = pitch-bend range */
  private rpn = [127, 127];
  private midiSeq = 0;
  private programSeq = 0;

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
    // The main bus is its own channel: the VCA jack stays at Eurorack level and DC coupled
    this.taps[MAIN_CHANNEL].connect(this.out);
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
    this.emit({ playing: false, step: -1, litKey: -1, gate: 0, beat: 0, transpose: 0, synced: false, extClock: false, armed: false, swapped: 0, pending: false });
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
    this.emit({ tempoPatched: this.sentPatched[INPUTS.in_tempo] === 1 });
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
    // MIDI note 0 = -5 V, 120 = +5 V; notes 121-127 repeat 109-115 (manual p.56)
    const n = note > 120 ? note - 12 : note;
    const legato = this.heldNotes.size > 0;
    this.heldNotes.add(n);
    this.post({ t: 'note', on: true, note: n, vel: velocity });
    // The panel records from this log (KB-mode REC, step edit), whichever way the note arrived:
    // panel keys, the computer keyboard or MIDI. A short log survives the UI's frame batching.
    // `legato`: another key was still held - recording turns that into a tie (manual p.25).
    this.noteLog = [...this.noteLog.slice(-15), { note: n, n: ++this.noteSeq, legato }];
    this.emit({ noteLog: this.noteLog });
  }

  noteOff(note: number): void {
    if (!this.started) return;
    const n = note > 120 ? note - 12 : note;
    this.heldNotes.delete(n);
    this.post({ t: 'note', on: false, note: n });
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
      case 'run': this.post({ t: 'btn', b: 'run', v: payload ? 1 : 0 }); break;
      case 'arm': this.post({ t: 'btn', b: 'arm', v: 1 }); break;
      case 'reset': this.post({ t: 'btn', b: 'reset', v: 1 }); break;
      case 'hold': this.post({ t: 'btn', b: 'hold', v: 1 }); break;
      case 'hold:up': this.post({ t: 'btn', b: 'hold', v: 0 }); break;
      case 'live_accent': this.post({ t: 'btn', b: 'accent', v: 1 }); break;
      case 'live_accent:up': this.post({ t: 'btn', b: 'accent', v: 0 }); break;
      case 'live_mute': this.post({ t: 'btn', b: 'mute', v: 1 }); break;
      case 'live_mute:up': this.post({ t: 'btn', b: 'mute', v: 0 }); break;
      case 'live_ratchet': this.post({ t: 'btn', b: 'lratchet', v: typeof payload === 'number' ? payload : 0 }); break;
      case 'editing': this.post({ t: 'btn', b: 'editing', v: payload ? 1 : 0 }); break;
      case 'transpose': this.post({ t: 'btn', b: 'transpose', v: typeof payload === 'number' ? payload : 0 }); break;
      case 'audition': this.post({ t: 'btn', b: 'audition', v: 1 }); break;
      case 'audition:stop': this.post({ t: 'btn', b: 'audition', v: 0 }); break;
      case 'queue_pattern':
        // Delay Pattern Change: the worklet switches when the playing pattern finishes
        if (payload && typeof payload === 'object') this.post({ t: 'seq', q: 1, ...decodeForEngine(payload as Record<string, ControlValue>) });
        break;
      case 'unqueue': this.post({ t: 'unqueue' }); break;
    }
  }

  /** Raw MIDI from the studio's MIDI input (notes arrive through noteOn / noteOff) */
  receiveMidi(data: number[] | Uint8Array): void {
    if (!this.started || data.length < 2) return;
    this.emit({ midiActivity: ++this.midiSeq });
    const st = data[0] & 0xf0;
    if (st === 0xe0 && data.length >= 3) {
      const v = ((data[2] << 7) | data[1]) - 8192;
      this.post({ t: 'bend', v: v / 8192 });
    } else if (st === 0xb0 && data.length >= 3) {
      const cc = data[1], val = data[2] / 127;
      if (cc === 64) this.post({ t: 'sus', v: data[2] >= 64 ? 1 : 0 });
      else if (cc === 101) this.rpn[0] = data[2];
      else if (cc === 100) this.rpn[1] = data[2];
      else if (cc === 6 && this.rpn[0] === 0 && this.rpn[1] === 0) this.post({ t: 'bendRange', v: Math.min(12, data[2]) });
      else this.post({ t: 'cc', n: cc, v: val });
    } else if (st === 0xd0) {
      this.post({ t: 'pressure', v: data[1] / 127 });
    } else if (st === 0xc0) {
      // Program change (manual p.57): 1-64 pick the pattern location, 71-86 the ASSIGN mode. The
      // panel acts on it (it owns the pattern memory), so it is passed on as state.
      this.emit({ program: { n: data[1] + 1, seq: ++this.programSeq } });
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
    this.emit({
      step: m.step, playing: !!m.run, litKey, gate: m.gate, beat: m.beat, transpose: m.tr, accent: m.acc,
      extClock: !!m.ext, armed: !!m.arm, swapped: m.swap, pending: !!m.pend,
    });
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
    // Live ratchet (manual p.29): SHIFT + GLIDE during playback, only while SHIFT is down
    if (id === 'live_ratchet') {
      if (this.bool('shift')) this.post({ t: 'btn', b: 'lratchet', v: Math.round(this.num('live_ratchet', 1)) });
      return;
    }
    if (id === 'shift' && !value) this.post({ t: 'btn', b: 'lratchet', v: 0 });
    const msg = knobMessage(id, value, this.params);
    if (msg) this.post({ t: 'k', i: msg[0], v: msg[1] });
    if (id === 'run_stop' && !this.transport) this.emit({ playing: !!value });
  }

  /** Ladder quality: 1 = 2x oversampled transistor core (default), 0 = 1x */
  setQuality(q: 0 | 1) {
    this.post({ t: 'k', i: SLOT.quality, v: q });
  }
}
