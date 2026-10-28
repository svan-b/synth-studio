// ============================================================================
// Moog Sub 37 audio engine
//
//  OSC 1 (wave morph) ─┬─────────────► MIXER ─┬─────────────► LADDER ─► MULTIDRIVE ─► VCA ─► AMP MOD ─► MASTER VOL
//      └ SUB (−1 oct) ─┤    ▲ hard sync       └ FEEDBACK ─┘  (6/12/18/24)  (OTA/FET)    ▲
//  OSC 2 (wave morph) ─┤────┘                   (soft clip)     ▲  ▲  ▲                  AMP EG (DAHDSR)
//  NOISE ──────────────┘                         FILTER EG ─────┘  │  └ KB tracking (Osc 1 note)
//                                                MOD 1 / MOD 2 ────┘
//  MOD 1 / MOD 2: LFO (tri/sqr/saw/ramp/S&H) or Filter EG → PITCH (osc 1/2), FILTER, PGM DEST
//  (WAVE, RESONANCE, EG TIME, AMP). The mod wheel scales Mod 1; Mod 2 is always on.
//
//  Voicing: mono, last-note priority; DUO MODE gives Osc 1 the lowest and Osc 2
//  the highest held note (paraphonic: both share one filter and VCA, as on the
//  hardware). Glide types LCR / LCT / EXP, legato and gated glide. Arpeggiator
//  clocked by the look-ahead Clock, gates scheduled sample-accurately.
//
//  Simplifications: mixer FEEDBACK is a soft-clip feedback-style drive in
//  parallel with the dry mix (a real delay-free loop is impossible in Web Audio).
//  Worklet nodes: 2 oscillators, 2 LFOs, 2 envelopes, 1 ladder = 7.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Ladder, createConstant, createNoise, smooth } from '@/lib/audio/dsp';
import { describeValue } from '@/lib/controls/mapping';
import { SUB37 } from './spec';

const C4 = 261.626;                 // 8' footage at MIDI 60
const OCTAVE_SHIFT = [-1, 0, 1, 2]; // 16' 8' 4' 2'
const SLOPES = ['lp6', 'lp12', 'lp18', 'lp24'] as const;
const EG_CUTOFF_OCTAVES = 6;
const MOD_FILTER_OCTAVES = 5;
const MOD_PITCH_OCTAVES = 2;
const BEND_SEMITONES = 2;

type AudioParamHold = AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };

class Sub37Osc {
  readonly node: AudioWorkletNode;
  readonly split: ChannelSplitterNode;
  readonly wave: GainNode;
  readonly sub: GainNode;
  constructor(ctx: BaseAudioContext) {
    this.node = new AudioWorkletNode(ctx, 'sub37-osc', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [3],
      channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'discrete',
    });
    this.split = ctx.createChannelSplitter(3);
    this.node.connect(this.split);
    this.wave = ctx.createGain();
    this.sub = ctx.createGain();
    this.split.connect(this.wave, 0);
    this.split.connect(this.sub, 1);
  }
  p(name: string) { return this.node.parameters.get(name)!; }
  /** Slave this oscillator to `master` (hard sync input) */
  syncTo(master: Sub37Osc) { master.split.connect(this.node, 2, 0); }
  reset(time: number) { this.node.port.postMessage({ type: 'reset', time }); }
}

class Sub37Env {
  readonly node: AudioWorkletNode;
  gated = false;
  constructor(ctx: BaseAudioContext) {
    this.node = new AudioWorkletNode(ctx, 'sub37-env', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
  }
  p(name: string) { return this.node.parameters.get(name)!; }
  gate(time: number, on: boolean, velocity = 1, reset = false) {
    this.gated = on;
    this.node.port.postMessage({ type: 'gate', time, on, velocity, reset });
  }
}

interface ModBus {
  lfo: AudioWorkletNode;
  srcLfo: GainNode;
  srcEg: GainNode;
  depth: GainNode;     // mod wheel scaling (Mod 1) / fixed (Mod 2)
  pitch: GainNode;
  toOsc1: GainNode;
  toOsc2: GainNode;
  filter: GainNode;
  pgm: GainNode;
  dest: Record<'wave' | 'res' | 'egtime' | 'amp', GainNode>;
}

const SECTION: [RegExp, string][] = [
  [/^mod1_/, 'MOD 1'], [/^mod2_/, 'MOD 2'], [/^osc1_/, 'OSC 1'], [/^osc2_|^beat_freq/, 'OSC 2'],
  [/^mix_/, 'MIXER'], [/^feg_/, 'FILTER EG'], [/^aeg_/, 'AMP EG'], [/^glide_/, 'GLIDE'], [/^arp_/, 'ARP'],
  [/^cutoff|^resonance|^multidrive|^filter_/, 'FILTER'],
];

export class Sub37Engine extends BaseEngine {
  private osc1!: Sub37Osc;
  private osc2!: Sub37Osc;
  private note1!: ConstantSourceNode;     // octaves relative to C4
  private note2!: ConstantSourceNode;
  private bend!: ConstantSourceNode;
  private mixOsc1!: GainNode; private mixSub!: GainNode; private mixOsc2!: GainNode;
  private mixNoise!: GainNode; private fbPre!: GainNode; private fbPost!: GainNode;
  private ladder!: Ladder;
  private egAmt!: GainNode;
  private kbTrack!: GainNode;
  private mdPre!: GainNode; private mdPost!: GainNode;
  private vca!: GainNode;
  private amp!: GainNode;
  private master!: GainNode;
  private feg!: Sub37Env;
  private aeg!: Sub37Env;
  private fegKb!: GainNode; private aegKb!: GainNode;
  private mods!: [ModBus, ModBus];
  private clock!: Clock;

  private held: number[] = [];           // physical keys, in press order
  private arpNotes: number[] = [];
  private arpIndex = 0;
  private velocity = 1;
  private lastPitch = [0, 0];
  private burst = 0;

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- Oscillators ------------------------------------------------------------
    this.osc1 = new Sub37Osc(ctx);
    this.osc2 = new Sub37Osc(ctx);
    this.osc2.syncTo(this.osc1);
    this.note1 = createConstant(ctx, 0);
    this.note2 = createConstant(ctx, 0);
    this.bend = createConstant(ctx, 0);
    this.note1.connect(this.osc1.p('pitch'));
    this.note2.connect(this.osc2.p('pitch'));
    this.bend.connect(this.osc1.p('pitch'));
    this.bend.connect(this.osc2.p('pitch'));

    // --- Mixer ------------------------------------------------------------------
    const mix = g(0.5);
    this.mixOsc1 = g(0); this.mixSub = g(0); this.mixOsc2 = g(0); this.mixNoise = g(0);
    this.osc1.wave.connect(this.mixOsc1).connect(mix);
    this.osc1.sub.connect(this.mixSub).connect(mix);
    this.osc2.wave.connect(this.mixOsc2).connect(mix);
    const noise = createNoise(ctx);
    noise.connect(this.mixNoise).connect(mix);

    // Feedback-style drive: soft-clipped copy of the mix added back in
    const ladderIn = g(1);
    mix.connect(ladderIn);
    this.fbPre = g(1);
    this.fbPost = g(0);
    const fbShape = ctx.createWaveShaper();
    fbShape.curve = curve(u => Math.tanh(2.5 * u));
    fbShape.oversample = '2x';
    mix.connect(this.fbPre).connect(fbShape).connect(this.fbPost).connect(ladderIn);

    // --- Filter -----------------------------------------------------------------
    this.ladder = new Ladder(ctx, 1200);
    this.ladder.setMode('lp24');
    ladderIn.connect(this.ladder.input);
    this.egAmt = g(0);
    this.kbTrack = g(0.5);
    this.note1.connect(this.kbTrack).connect(this.ladder.cutoffCv);

    // --- Multidrive (OTA/FET stages after the ladder) -----------------------------
    this.mdPre = g(0.25);
    this.mdPost = g(1);
    const mdShape = ctx.createWaveShaper();
    mdShape.curve = curve(x => { const u = x * 4; const t = Math.tanh(u); return Math.tanh(u + 0.35 * t * t); }, true);
    mdShape.oversample = '2x';
    const dcBlock = ctx.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 12;
    dcBlock.Q.value = 0.5;
    this.ladder.output.connect(this.mdPre).connect(mdShape).connect(this.mdPost).connect(dcBlock);

    // --- VCA --------------------------------------------------------------------
    this.vca = g(0);
    this.amp = g(1);
    this.master = g(0.5);
    dcBlock.connect(this.vca).connect(this.amp).connect(this.master).connect(this.out);

    // --- Envelopes ----------------------------------------------------------------
    this.feg = new Sub37Env(ctx);
    this.aeg = new Sub37Env(ctx);
    this.feg.node.connect(this.egAmt).connect(this.ladder.cutoffCv);
    this.aeg.node.connect(this.vca.gain);
    this.fegKb = g(0); this.aegKb = g(0);
    this.note1.connect(this.fegKb).connect(this.feg.p('timeMod'));
    this.note1.connect(this.aegKb).connect(this.aeg.p('timeMod'));

    // --- Mod busses ----------------------------------------------------------------
    const bus = (): ModBus => {
      const lfo = new AudioWorkletNode(ctx, 'sub37-lfo', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      const b: ModBus = {
        lfo, srcLfo: g(1), srcEg: g(0), depth: g(1),
        pitch: g(0), toOsc1: g(1), toOsc2: g(1), filter: g(0), pgm: g(0),
        dest: { wave: g(0), res: g(0), egtime: g(0), amp: g(0) },
      };
      lfo.connect(b.srcLfo).connect(b.depth);
      this.feg.node.connect(b.srcEg).connect(b.depth);
      b.depth.connect(b.pitch);
      b.pitch.connect(b.toOsc1).connect(this.osc1.p('pitch'));
      b.pitch.connect(b.toOsc2).connect(this.osc2.p('pitch'));
      b.depth.connect(b.filter).connect(this.ladder.cutoffCv);
      b.depth.connect(b.pgm);
      b.pgm.connect(b.dest.wave);
      b.dest.wave.connect(this.osc1.p('wave'));
      b.dest.wave.connect(this.osc2.p('wave'));
      b.pgm.connect(b.dest.res).connect(this.ladder.resonance);
      b.pgm.connect(b.dest.egtime);
      b.dest.egtime.connect(this.feg.p('timeMod'));
      b.dest.egtime.connect(this.aeg.p('timeMod'));
      b.pgm.connect(b.dest.amp).connect(this.amp.gain);
      return b;
    };
    this.mods = [bus(), bus()];

    // --- Arpeggiator clock -----------------------------------------------------------
    this.clock = new Clock(ctx, t => this.arpTick(t), 0.5);

    this.onDispose(() => {
      this.clock.stop();
      [noise, this.note1, this.note2, this.bend].forEach(s => { try { s.stop(); } catch { /* */ } });
      [this.osc1.node, this.osc2.node, this.feg.node, this.aeg.node, this.mods[0].lfo, this.mods[1].lfo, this.ladder.node]
        .forEach(n => { n.port.postMessage({ type: 'clear' }); n.disconnect(); });
    });

    this.emit({ arpStep: -1, gate: false });
  }

  // ==========================================================================
  // LCD: last touched parameter
  // ==========================================================================

  setParam(id: string, value: ControlValue): void {
    const prev = this.params[id];
    super.setParam(id, value);
    if (prev === undefined || prev === value || id === 'preset_number') return;
    const spec = SUB37.controls[id];
    if (!spec) return;
    // Many values changing at once = a preset load: let the LCD show the preset
    if (this.burst++ === 0) queueMicrotask(() => { this.burst = 0; });
    if (this.burst > 3) { this.emit({ lcd: null }); return; }
    const section = SECTION.find(([re]) => re.test(id))?.[1] ?? '';
    this.emit({ lcd: { title: `${section} ${spec.label}`.trim(), value: describeValue(spec, value) } });
  }

  // ==========================================================================
  // Keyboard, voicing, glide
  // ==========================================================================

  noteOn(note: number, velocity = 1): void {
    if (!this.started) return;
    const t = this.ctx.currentTime + 0.005;
    const wasEmpty = this.held.length === 0;
    this.held = this.held.filter(n => n !== note);
    this.held.push(note);
    this.velocity = velocity;

    if (this.bool('arp_on')) {
      if (this.bool('arp_latch') && wasEmpty) { this.arpNotes = []; this.arpIndex = 0; }
      if (!this.arpNotes.includes(note)) this.arpNotes.push(note);
      if (wasEmpty && !this.bool('arp_latch')) this.arpIndex = 0;
      return;
    }
    this.updatePitches(t, !wasEmpty);
    this.gateOn(t, wasEmpty);
    this.emit({ gate: true });
  }

  noteOff(note: number): void {
    if (!this.started) return;
    const t = this.ctx.currentTime + 0.005;
    this.held = this.held.filter(n => n !== note);
    if (this.bool('arp_on')) {
      if (!this.bool('arp_latch')) this.arpNotes = this.arpNotes.filter(n => n !== note);
      return;
    }
    if (this.held.length) {
      this.updatePitches(t, true);
    } else {
      this.gateOff(t);
      if (this.bool('glide_on') && this.bool('glide_gated')) {
        this.hold(this.note1.offset, t);
        this.hold(this.note2.offset, t);
      }
      this.emit({ gate: false });
    }
  }

  private gateOn(t: number, newPhrase: boolean) {
    const vel = this.velocity;
    for (const [env, p] of [[this.feg, 'feg'], [this.aeg, 'aeg']] as const) {
      if (newPhrase || this.bool(`${p}_multi_trig`)) {
        const peak = 1 - (this.num(`${p}_vel_amt`, 50) / 100) * (1 - vel);
        env.gate(t, true, peak, this.bool(`${p}_reset`));
      }
    }
    if (newPhrase && this.bool('kb_reset')) { this.osc1.reset(t); this.osc2.reset(t); }
  }

  private gateOff(t: number) {
    if (!this.bool('feg_latch')) this.feg.gate(t, false);
    if (!this.bool('aeg_latch')) this.aeg.gate(t, false);
  }

  private updatePitches(t: number, legato: boolean) {
    if (!this.held.length) return;
    let n1: number, n2: number;
    if (this.bool('duo_mode')) {
      n1 = Math.min(...this.held);
      n2 = Math.max(...this.held);
    } else {
      n1 = n2 = this.held[this.held.length - 1];
    }
    this.setPitch(n1, n2, t, legato);
  }

  private setPitch(n1: number, n2: number, t: number, legato: boolean) {
    const glide = this.bool('glide_on') && (!this.bool('glide_legato') || legato);
    const which = this.num('glide_osc', 0); // 0: 1+2, 1: osc 1, 2: osc 2
    this.glideTo(0, this.note1.offset, (n1 - 60) / 12, t, glide && which !== 2);
    if (this.bool('osc2_kb_ctrl')) this.glideTo(1, this.note2.offset, (n2 - 60) / 12, t, glide && which !== 1);
  }

  private hold(param: AudioParam, t: number) {
    const p = param as AudioParamHold;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
  }

  private glideTo(i: 0 | 1, param: AudioParam, target: number, t: number, glide: boolean) {
    const from = this.lastPitch[i];
    this.lastPitch[i] = target;
    this.hold(param, t);
    const time = this.num('glide_time', 150) / 1000;
    if (!glide || time < 0.002 || from === target) {
      param.setValueAtTime(target, t);
      return;
    }
    switch (this.num('glide_type', 1)) {
      case 0: // LCR - constant rate: TIME per octave
        param.linearRampToValueAtTime(target, t + time * Math.max(0.08, Math.abs(target - from)));
        break;
      case 2: // EXP - fast then slowing into the note
        param.setTargetAtTime(target, t, time / 3);
        break;
      default: // LCT - constant time
        param.linearRampToValueAtTime(target, t + time);
    }
  }

  // ==========================================================================
  // Arpeggiator
  // ==========================================================================

  private arpInterval() {
    return 60 / Math.max(2, this.num('arp_rate', 120));
  }

  private arpSequence(): number[] {
    if (!this.arpNotes.length) return [];
    const mode = this.num('arp_mode', 0);
    let base = [...this.arpNotes];
    if (mode === 0) base.sort((a, b) => a - b);
    else if (mode === 1) base.sort((a, b) => b - a);
    const range = this.num('arp_range', 2) - 2; // -2..+2
    const octs: number[] = [];
    for (let o = 0; Math.abs(o) <= Math.abs(range); o += range >= 0 ? 1 : -1) { octs.push(o); if (range === 0) break; }
    if (mode === 1) octs.reverse();
    let seq: number[] = [];
    octs.forEach(o => { seq = seq.concat(base.map(n => n + 12 * o)); });
    if (this.bool('arp_back_fwd') && seq.length > 2) seq = seq.concat(seq.slice(1, -1).reverse());
    base = seq.filter(n => n >= 0 && n <= 127);
    return base;
  }

  private arpTick(t: number) {
    this.clock.setInterval(this.arpInterval());
    const seq = this.arpSequence();
    if (!seq.length) return;
    let note: number;
    if (this.num('arp_mode', 0) === 3) note = seq[Math.floor(Math.random() * seq.length)];
    else { this.arpIndex %= seq.length; note = seq[this.arpIndex]; }
    const step = this.arpIndex;
    this.arpIndex = (this.arpIndex + 1) % seq.length;
    this.setPitch(note, note, t, false);
    this.gateOn(t, true);
    this.gateOff(t + this.arpInterval() * 0.55);
    this.emitAt(t, { arpStep: step, gate: true });
    this.atTime(t + this.arpInterval() * 0.55, () => this.emit({ gate: false }));
  }

  private setArp(on: boolean) {
    const t = this.ctx.currentTime + 0.005;
    if (on) {
      this.arpNotes = [...this.held];
      this.arpIndex = 0;
      this.gateOff(t);
      this.clock.setInterval(this.arpInterval());
      this.clock.start();
    } else {
      this.clock.stop();
      this.arpNotes = [];
      this.emit({ arpStep: -1 });
      if (this.held.length) { this.updatePitches(t, false); this.gateOn(t, true); }
      else this.gateOff(t);
    }
  }

  // ==========================================================================
  // Parameters
  // ==========================================================================

  private oscFreq(osc: 1 | 2) {
    const oct = OCTAVE_SHIFT[this.num(`osc${osc}_octave`, 1)] ?? 0;
    const semis = osc === 2 ? this.num('osc2_frequency', 0) : 0;
    return C4 * Math.pow(2, oct + semis / 12);
  }

  private updateModBus(n: 1 | 2) {
    const b = this.mods[n - 1];
    const ctx = this.ctx;
    const src = this.num(`mod${n}_source`, 0);
    const isEg = src === 5;
    smooth(b.srcLfo.gain, isEg ? 0 : 1, ctx, 0.005);
    smooth(b.srcEg.gain, isEg ? 1 : 0, ctx, 0.005);
    if (!isEg) b.lfo.parameters.get('shape')!.value = src;
    const rate = this.num(`mod${n}_rate`, 1) * (this.bool(`mod${n}_hi_range`) ? 10 : 1);
    smooth(b.lfo.parameters.get('rate')!, rate, ctx, 0.02);
    smooth(b.depth.gain, n === 1 ? this.num('mod_wheel', 0) / 100 : 1, ctx, 0.02);
    const pa = this.num(`mod${n}_pitch_amt`, 0) / 100;
    smooth(b.pitch.gain, pa * pa * MOD_PITCH_OCTAVES, ctx);
    const pd = this.num(`mod${n}_pitch_dest`, 0);
    smooth(b.toOsc1.gain, pd === 2 ? 0 : 1, ctx, 0.005);
    smooth(b.toOsc2.gain, pd === 1 ? 0 : 1, ctx, 0.005);
    smooth(b.filter.gain, (this.num(`mod${n}_filter_amt`, 0) / 100) * MOD_FILTER_OCTAVES, ctx);
    smooth(b.pgm.gain, this.num(`mod${n}_pgm_amt`, 0) / 100, ctx);
    const dest = this.num(`mod${n}_pgm_dest`, 0);
    smooth(b.dest.wave.gain, dest === 0 ? 0.5 : 0, ctx, 0.005);
    smooth(b.dest.res.gain, dest === 1 ? 0.6 : 0, ctx, 0.005);
    smooth(b.dest.egtime.gain, dest === 2 ? 3 : 0, ctx, 0.005);
    smooth(b.dest.amp.gain, dest === 3 ? 0.5 : 0, ctx, 0.005);
  }

  private updateEnv(p: 'feg' | 'aeg') {
    const env = p === 'feg' ? this.feg : this.aeg;
    const s = (name: string, v: number) => { env.p(name).value = v; };
    s('delay', this.num(`${p}_delay`, 0) / 1000);
    s('attack', Math.max(0.0005, this.num(`${p}_attack`, 5) / 1000));
    s('hold', this.num(`${p}_hold`, 0) / 1000);
    s('decay', Math.max(0.0005, this.num(`${p}_decay`, 300) / 1000));
    s('sustain', this.num(`${p}_sustain`, 50) / 100);
    s('release', Math.max(0.0005, this.num(`${p}_release`, 300) / 1000));
    s('loop', this.bool(`${p}_loop`) ? 1 : 0);
    smooth((p === 'feg' ? this.fegKb : this.aegKb).gain, this.num(`${p}_kb_amt`, 0) / 100, this.ctx);
  }

  private updateLatch(p: 'feg' | 'aeg') {
    const env = p === 'feg' ? this.feg : this.aeg;
    const t = this.ctx.currentTime + 0.005;
    if (this.bool(`${p}_latch`)) {
      if (!env.gated) env.gate(t, true, 1, this.bool(`${p}_reset`));
    } else if (!this.held.length && !this.bool('arp_on')) {
      env.gate(t, false);
    }
  }

  private updateMultidrive() {
    const md = this.num('multidrive', 0) / 100;
    const pre = 0.25 * (1 + 9 * Math.pow(md, 1.5));
    smooth(this.mdPre.gain, pre, this.ctx);
    smooth(this.mdPost.gain, 1 / (0.5 + 0.5 * Math.sqrt(pre / 0.25)), this.ctx);
    this.ladder.drive.value = 1 + md * 1.5;
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    const lvl = (v: number) => Math.pow(v / 100, 1.6);

    if (id.startsWith('mod1_')) return this.updateModBus(1);
    if (id.startsWith('mod2_')) return this.updateModBus(2);
    if (id.startsWith('feg_') || id.startsWith('aeg_')) {
      const p = id.slice(0, 3) as 'feg' | 'aeg';
      if (id.endsWith('_latch')) this.updateLatch(p);
      else this.updateEnv(p);
      return;
    }

    switch (id) {
      case 'osc1_octave': smooth(this.osc1.p('frequency'), this.oscFreq(1), ctx, 0.003); break;
      case 'osc2_octave':
      case 'osc2_frequency': smooth(this.osc2.p('frequency'), this.oscFreq(2), ctx, 0.003); break;
      case 'osc1_wave': smooth(this.osc1.p('wave'), n / 100, ctx, 0.01); break;
      case 'osc2_wave': smooth(this.osc2.p('wave'), n / 100, ctx, 0.01); break;
      case 'beat_freq': smooth(this.osc2.p('detuneHz'), n, ctx, 0.02); break;
      case 'hard_sync': this.osc2.p('sync').value = n; break;
      case 'osc2_kb_ctrl':
        if (!value) { this.lastPitch[1] = 0; smooth(this.note2.offset, 0, ctx, 0.005); }
        break;
      case 'duo_mode':
        if (this.held.length) this.updatePitches(ctx.currentTime + 0.005, true);
        break;
      case 'mix_osc1': smooth(this.mixOsc1.gain, lvl(n), ctx); break;
      case 'mix_sub': smooth(this.mixSub.gain, lvl(n), ctx); break;
      case 'mix_osc2': smooth(this.mixOsc2.gain, lvl(n), ctx); break;
      case 'mix_noise': smooth(this.mixNoise.gain, lvl(n) * 0.8, ctx); break;
      case 'mix_feedback':
        smooth(this.fbPre.gain, 1 + (n / 100) * 3, ctx);
        smooth(this.fbPost.gain, Math.pow(n / 100, 1.3) * 0.9, ctx);
        break;
      case 'cutoff': smooth(this.ladder.cutoff, n, ctx, 0.008); break;
      case 'resonance': smooth(this.ladder.resonance, (n / 100) * 1.08, ctx); break;
      case 'multidrive': this.updateMultidrive(); break;
      case 'filter_kb_amt': smooth(this.kbTrack.gain, n / 100, ctx); break;
      case 'filter_eg_amt': smooth(this.egAmt.gain, (n / 100) * EG_CUTOFF_OCTAVES, ctx); break;
      case 'filter_slope': this.ladder.setMode(SLOPES[n] ?? 'lp24'); break;
      case 'master_volume': smooth(this.master.gain, Math.pow(n / 100, 2) * 1.7, ctx); break;
      case 'pitch_bend': smooth(this.bend.offset, (n / 100) * (BEND_SEMITONES / 12), ctx, 0.008); break;
      case 'mod_wheel': this.updateModBus(1); break;
      case 'arp_on': this.setArp(!!value); break;
      case 'arp_rate': this.clock.setInterval(this.arpInterval()); break;
      case 'arp_latch':
        if (!value && this.bool('arp_on')) this.arpNotes = this.arpNotes.filter(x => this.held.includes(x));
        break;
      default:
        break;
    }
  }
}

/** Waveshaper curve over x in -1..1, normalised to a peak of 1 */
function curve(fn: (x: number) => number, normalise = false): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = fn(x);
    peak = Math.max(peak, Math.abs(c[i]));
  }
  if (normalise && peak > 0) for (let i = 0; i < n; i++) c[i] /= peak;
  return c;
}
