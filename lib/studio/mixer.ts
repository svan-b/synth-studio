// ============================================================================
// Studio mixer (audio). One channel strip per rack instrument, two shared
// return buses and the master section. State lives in the store
// (studio.mixer, see mixerDoc.ts); the hub owns one StudioMixer per context.
//
//   engine.out ─► input ─► level ─► pan ─┬─► route: master bus or a mixer device's input
//   (arranger    (song     (trim ×      ├─► send A (post-fader) ─► delay return ─┐
//    mutes)       mutes)    fader ×      └─► send B (post-fader) ─► reverb return ┴─► master bus
//                           mute/solo)
//
// - Every gain change is a short ramp (6 ms time constant): mute, solo and fader
//   moves never click. Arranger mutes are scheduled on a separate gain at the bar
//   line, so they never fight the user's mute.
// - Pan keeps centre at unity. Mono instruments get constant-power compensation
//   so a hard-panned synth is as loud as a centred one.
// - Returns are solo-safe, and are only connected to the master while something
//   sends to them (plus their tail), so an unused delay or reverb costs nothing.
// - Meters: one 'meter-bank' worklet node for every strip, connected only while
//   a mixer is on screen.
// ============================================================================

import { Reverb2 } from '@/lib/audio/dsp';
import {
  MIN_DB, DELAY_DIVISIONS, audibleChannels, channelOf, dbToGain, delayOf, reverbOf,
  type DelayDoc, type MixerDoc, type ReverbDoc,
} from './mixerDoc';

const RAMP = 0.006;
const BANK_SIZE = 24;

const ramp = (p: AudioParam, v: number, ctx: BaseAudioContext, tau = RAMP) => {
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setTargetAtTime(v, now, tau);
};

export interface StripLevels {
  peakL: number;
  peakR: number;
}

export class ChannelStrip {
  /** Where the engine connects (its destination). Carries the arranger's mutes. */
  readonly input: GainNode;
  readonly level: GainNode;
  readonly pan: StereoPannerNode;
  /** Post-fader, post-pan output: what gets routed (and recorded as the stem) */
  readonly output: AudioNode;
  sendA: GainNode | null = null;
  sendB: GainNode | null = null;
  lastSend: Record<'A' | 'B', number> = { A: 0, B: 0 };
  trimDb: number;
  stereo: boolean;
  meterSlot = -1;
  private lastLevel = -1;
  private lastPan = 0;

  constructor(private ctx: AudioContext, readonly id: string, opts: { trimDb: number; stereo: boolean }) {
    this.trimDb = opts.trimDb;
    this.stereo = opts.stereo;
    this.input = ctx.createGain();
    // Mono instruments become dual-mono here, at unity
    this.input.channelCount = 2;
    this.input.channelCountMode = 'explicit';
    this.input.channelInterpretation = 'speakers';
    this.level = ctx.createGain();
    this.level.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.input.connect(this.level).connect(this.pan);
    this.output = this.pan;
  }

  /** Gain (linear, already including trim, mute and solo) and pan, ramped */
  set(gain: number, pan: number) {
    // StereoPanner on a dual-mono signal adds up to +3 dB of power towards the sides
    const comp = this.stereo ? 1 : 1 / Math.sqrt(1 + Math.sin((Math.abs(pan) * Math.PI) / 2));
    const g = gain * comp;
    if (g !== this.lastLevel) {
      // first value: jump (the instrument is just starting)
      if (this.lastLevel < 0) this.level.gain.value = g;
      else ramp(this.level.gain, g, this.ctx);
      this.lastLevel = g;
    }
    if (pan !== this.lastPan) {
      ramp(this.pan.pan, Math.max(-1, Math.min(1, pan)), this.ctx);
      this.lastPan = pan;
    }
  }

  /** Arranger mute at an audio time (bar line) */
  setArrangerMute(muted: boolean, time: number) {
    this.input.gain.setTargetAtTime(muted ? 0 : 1, Math.max(this.ctx.currentTime, time), 0.004);
  }

  dispose() {
    [this.input, this.level, this.pan, this.sendA, this.sendB].forEach(n => { try { n?.disconnect(); } catch { /* */ } });
  }
}

/** Tempo-synced stereo delay (ping-pong), filtered repeats */
class DelayReturn {
  readonly input: GainNode;
  readonly output: GainNode;
  private sum: GainNode;
  private dl: DelayNode;
  private dr: DelayNode;
  private lpL: BiquadFilterNode;
  private lpR: BiquadFilterNode;
  private hpL: BiquadFilterNode;
  private hpR: BiquadFilterNode;
  private fbL: GainNode;
  private fbR: GainNode;
  private split: ChannelSplitterNode;
  private merge: ChannelMergerNode;
  private pingPong: boolean | null = null;
  private wiring: AudioNode[] = [];

  constructor(private ctx: AudioContext) {
    const g = () => ctx.createGain();
    const bq = (type: BiquadFilterType, f: number) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = -3.01; // Butterworth (lowpass / highpass Q is in dB)
      return b;
    };
    this.input = g();
    this.input.channelCount = 2;
    this.input.channelCountMode = 'explicit';
    this.output = g();
    this.sum = g();
    this.sum.channelCount = 1;
    this.sum.channelCountMode = 'explicit';
    this.sum.channelInterpretation = 'speakers';
    this.dl = ctx.createDelay(6);
    this.dr = ctx.createDelay(6);
    this.lpL = bq('lowpass', 4500);
    this.lpR = bq('lowpass', 4500);
    this.hpL = bq('highpass', 140);
    this.hpR = bq('highpass', 140);
    this.fbL = g();
    this.fbR = g();
    this.split = ctx.createChannelSplitter(2);
    this.merge = ctx.createChannelMerger(2);
    // shared: each line filters its repeats; the merger is the stereo output
    this.dl.connect(this.lpL).connect(this.hpL);
    this.dr.connect(this.lpR).connect(this.hpR);
    this.hpL.connect(this.fbL);
    this.hpR.connect(this.fbR);
    this.hpL.connect(this.merge, 0, 0);
    this.hpR.connect(this.merge, 0, 1);
    this.merge.connect(this.output);
  }

  private rewire(pingPong: boolean) {
    if (pingPong === this.pingPong) return;
    this.pingPong = pingPong;
    this.wiring.forEach(n => { try { n.disconnect(); } catch { /* */ } });
    this.input.disconnect();
    if (pingPong) {
      // mono sum into the left line; L feeds R, R feeds L: echoes alternate sides
      this.input.connect(this.sum).connect(this.dl);
      this.fbL.connect(this.dr);
      this.fbR.connect(this.dl);
      this.wiring = [this.sum, this.fbL, this.fbR];
    } else {
      this.input.connect(this.split);
      this.split.connect(this.dl, 0);
      this.split.connect(this.dr, 1);
      this.fbL.connect(this.dl);
      this.fbR.connect(this.dr);
      this.wiring = [this.split, this.fbL, this.fbR];
    }
  }

  apply(d: DelayDoc, bpm: number) {
    this.rewire(d.pingPong);
    const beats = DELAY_DIVISIONS.find(x => x.id === d.division)?.beats ?? 0.75;
    const t = Math.max(0.01, Math.min(5.9, (60 / Math.max(20, bpm)) * beats));
    ramp(this.dl.delayTime, t, this.ctx, 0.05);
    ramp(this.dr.delayTime, t, this.ctx, 0.05);
    const fb = Math.max(0, Math.min(0.9, d.feedback));
    ramp(this.fbL.gain, fb, this.ctx, 0.02);
    ramp(this.fbR.gain, fb, this.ctx, 0.02);
    const tone = Math.max(800, Math.min(18000, d.tone));
    ramp(this.lpL.frequency, tone, this.ctx, 0.02);
    ramp(this.lpR.frequency, tone, this.ctx, 0.02);
    return t;
  }

  /** Seconds for the repeats to die away (-60 dB) */
  tail(d: DelayDoc, bpm: number) {
    const beats = DELAY_DIVISIONS.find(x => x.id === d.division)?.beats ?? 0.75;
    const t = (60 / bpm) * beats;
    const fb = Math.max(0.01, Math.min(0.9, d.feedback));
    return Math.min(30, t * (1 + Math.log(0.001) / Math.log(fb)) + 0.2);
  }
}

class ReturnBus {
  readonly level: GainNode;
  active = false;
  private offTimer: ReturnType<typeof setTimeout> | null = null;
  meterSlot = -1;
  constructor(private ctx: AudioContext, readonly source: AudioNode, private master: AudioNode) {
    this.level = ctx.createGain();
    this.level.gain.value = 1;
    source.connect(this.level);
  }

  setLevel(db: number, mute: boolean) {
    ramp(this.level.gain, mute ? 0 : dbToGain(db), this.ctx);
  }

  /** Connect while anything sends here; disconnect `tail` seconds after the last send stops */
  setActive(on: boolean, tail: number) {
    if (on) {
      if (this.offTimer) { clearTimeout(this.offTimer); this.offTimer = null; }
      if (!this.active) { this.level.connect(this.master); this.active = true; }
      return;
    }
    if (!this.active || this.offTimer) return;
    this.offTimer = setTimeout(() => {
      this.offTimer = null;
      try { this.level.disconnect(this.master); } catch { /* */ }
      this.active = false;
    }, tail * 1000);
  }
}

type LevelsListener = () => void;

export class StudioMixer {
  readonly strips = new Map<string, ChannelStrip>();
  private delay: DelayReturn;
  private reverb: Reverb2;
  readonly delayBus: ReturnBus;
  readonly reverbBus: ReturnBus;
  private bank: AudioWorkletNode | null = null;
  private sink: GainNode;
  private slots: (string | null)[] = new Array(BANK_SIZE).fill(null);
  private levels = new Map<string, StripLevels>();
  private levelListeners = new Set<LevelsListener>();
  private watchers = 0;
  private lastDelay = '';
  private lastReverb = '';

  constructor(private ctx: AudioContext, private master: AudioNode) {
    this.delay = new DelayReturn(ctx);
    this.reverb = new Reverb2(ctx, 2.2, { lowCut: 150, highCut: 12000 });
    this.delayBus = new ReturnBus(ctx, this.delay.output, master);
    this.reverbBus = new ReturnBus(ctx, this.reverb.output, master);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    try {
      this.bank = new AudioWorkletNode(ctx, 'meter-bank', {
        numberOfInputs: BANK_SIZE,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: { inputs: BANK_SIZE },
      });
      this.bank.connect(this.sink);
      this.bank.port.onmessage = e => this.onLevels(e.data as { type: string; peak: Float32Array });
    } catch (e) {
      console.warn('[mixer] meter bank unavailable', e);
    }
  }

  // ---- strips ----------------------------------------------------------------

  createStrip(id: string, opts: { trimDb: number; stereo: boolean }): ChannelStrip {
    this.removeStrip(id);
    const s = new ChannelStrip(this.ctx, id, opts);
    this.strips.set(id, s);
    if (this.watchers > 0) this.attachMeter(id, s.output);
    return s;
  }

  removeStrip(id: string) {
    const s = this.strips.get(id);
    if (!s) return;
    this.detachMeter(id);
    s.dispose();
    this.strips.delete(id);
    this.levels.delete(id);
  }

  get(id: string) {
    return this.strips.get(id);
  }

  /** Push the mixer document to the audio graph (idempotent, ramped) */
  apply(doc: MixerDoc | undefined, rack: { id: string }[], routes: Record<string, string>, bpm: number) {
    const audible = audibleChannels(doc, rack, routes);
    let sendsA = false, sendsB = false;
    this.strips.forEach((s, id) => {
      const ch = channelOf(doc, id);
      const on = audible.has(id);
      const g = on ? dbToGain(ch.gain) * Math.pow(10, s.trimDb / 20) : 0;
      s.set(g, ch.pan);
      // Routed into a mixer (e.g. a Xone:96 channel), the instrument uses that mixer's
      // own FX sends, as with hardware. Studio sends here would bypass its faders and mutes.
      const sendsOn = on && (routes[id] ?? 'master') === 'master';
      if (this.setSend(s, 'A', sendsOn ? ch.sendA : MIN_DB)) sendsA = true;
      if (this.setSend(s, 'B', sendsOn ? ch.sendB : MIN_DB)) sendsB = true;
    });
    const d = delayOf(doc);
    const r = reverbOf(doc);
    const dk = JSON.stringify(d) + bpm;
    if (dk !== this.lastDelay) {
      this.lastDelay = dk;
      this.delay.apply(d, bpm);
      this.delayBus.setLevel(d.level, d.mute);
    }
    const rk = JSON.stringify(r);
    if (rk !== this.lastReverb) {
      this.lastReverb = rk;
      this.applyReverb(r);
      this.reverbBus.setLevel(r.level, r.mute);
    }
    this.delayBus.setActive(sendsA, this.delay.tail(d, bpm));
    this.reverbBus.setActive(sendsB, r.decay * 1.6 + r.predelay + 0.5);
  }

  private applyReverb(r: ReverbDoc) {
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => { p.cancelScheduledValues(now); p.setTargetAtTime(v, now, 0.05); };
    set(this.reverb.decay, Math.max(0.1, Math.min(20, r.decay)));
    set(this.reverb.damping, Math.max(500, Math.min(20000, r.damping)));
    set(this.reverb.preDelay, Math.max(0, Math.min(0.25, r.predelay)));
    set(this.reverb.size, Math.max(0.05, Math.min(1, r.size)));
  }

  /** Returns true when the send is live */
  private setSend(s: ChannelStrip, which: 'A' | 'B', db: number): boolean {
    const key = which === 'A' ? 'sendA' : 'sendB';
    const target = which === 'A' ? this.delay.input : this.reverb.input;
    const g = dbToGain(db);
    let node = s[key];
    if (node && g === s.lastSend[which]) return g > 0;
    s.lastSend[which] = g;
    if (g <= 0) {
      if (node) {
        ramp(node.gain, 0, this.ctx);
        const n = node;
        s[key] = null;
        setTimeout(() => { try { s.output.disconnect(n); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }, 80);
      }
      return false;
    }
    if (!node) {
      node = this.ctx.createGain();
      node.gain.value = 0;
      s.output.connect(node).connect(target);
      s[key] = node;
    }
    ramp(node.gain, g, this.ctx);
    return true;
  }

  // ---- meters ------------------------------------------------------------------

  /** Mixer UI mounted: meters run while at least one watcher is attached */
  watchLevels(l: LevelsListener): () => void {
    this.levelListeners.add(l);
    if (this.watchers++ === 0) {
      this.strips.forEach((s, id) => this.attachMeter(id, s.output));
      this.attachMeter('__delay', this.delayBus.level);
      this.attachMeter('__reverb', this.reverbBus.level);
    }
    return () => {
      this.levelListeners.delete(l);
      if (--this.watchers === 0) {
        [...this.slots].forEach(id => { if (id) this.detachMeter(id); });
        this.levels.clear();
      }
    };
  }

  getLevels(id: string): StripLevels | undefined {
    return this.levels.get(id);
  }

  private attachMeter(id: string, node: AudioNode) {
    if (!this.bank || this.slots.includes(id)) return;
    const slot = this.slots.indexOf(null);
    if (slot < 0) return;
    this.slots[slot] = id;
    node.connect(this.bank, 0, slot);
  }

  private detachMeter(id: string) {
    const slot = this.slots.indexOf(id);
    if (slot < 0 || !this.bank) return;
    this.slots[slot] = null;
    const node = id === '__delay' ? this.delayBus.level : id === '__reverb' ? this.reverbBus.level : this.strips.get(id)?.output;
    try { node?.disconnect(this.bank, 0, slot); } catch { /* */ }
  }

  private onLevels(d: { type: string; peak: Float32Array }) {
    if (d.type !== 'levels') return;
    this.slots.forEach((id, k) => {
      if (!id) return;
      this.levels.set(id, { peakL: d.peak[2 * k], peakR: d.peak[2 * k + 1] });
    });
    this.levelListeners.forEach(l => l());
  }

  /** Nodes to record as stems: every strip's output plus the two returns */
  taps(): { id: string; node: AudioNode }[] {
    const out: { id: string; node: AudioNode }[] = [];
    this.strips.forEach((s, id) => out.push({ id, node: s.output }));
    out.push({ id: '__delay', node: this.delayBus.level });
    out.push({ id: '__reverb', node: this.reverbBus.level });
    return out;
  }
}
