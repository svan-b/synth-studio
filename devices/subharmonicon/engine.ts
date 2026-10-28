// ============================================================================
// Moog Subharmonicon audio engine
//
//   VCO 1 ─┬─ ÷n SUB 1 ─┐                                     VCA EG ─► VCA jack (normal)
//          └─ ÷m SUB 2 ─┼─► MIXER (6 levels) ─► LADDER LP24 ─► VCA ─► VOLUME ─► out
//   VCO 2 ─┬─ ÷n SUB 1 ─┤                          ▲
//          └─ ÷m SUB 2 ─┘     VCF EG ─► CUTOFF jack (normal) ─► EG AMT
//
//   TEMPO ─► RHYTHM 1..4 (÷1..16) ─► OR/XOR ─► SEQUENCER 1 / 2 (4 steps)
//            SEQ 1 ─► VCO 1 pitch (OSC) and/or SUB 1/SUB 2 divisors   (SEQ ASSIGN)
//            SEQ 2 ─► VCO 2 ...                     any advance ─► EGs (EG ON)
//
// The subharmonics are real frequency dividers inside the 'subharmonicon-vco'
// worklet (public/worklets/subharmonicon-processors.js): they count VCO cycles,
// so they stay phase-locked to their VCO like the hardware's divider circuits.
//
// All 32 patch points are live. CV inputs are audio-rate connections. Clock and
// trigger outputs are both an EventBus (sample-accurate scheduling into the
// PLAY/RESET/TRIGGER/CLOCK inputs) and a 5 ms pulse (so they can also be
// patched into CV inputs). Any voltage patched into a gate input is edge
// detected by the 'subharmonicon-gate' worklet. Normals are broken on insert.
//
// Simplifications (documented in tips too):
//  * MIDI IN accepts no internal signal; the computer keyboard stands in for it
//    (notes transpose both VCOs from Middle C and gate the EGs).
//  * CV into SUB / RHYTHM inputs (and SEQ → SUB assign) shifts divisors by
//    −1.5 per volt, rounded. The manual does not publish the exact scaling.
//  * The EG retrigger lock-out during the Attack stage is not modelled.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock, CvReader, EventBus } from '@/lib/audio/engine';
import { Env, Ladder, createConstant, pulse, smooth, setAt } from '@/lib/audio/dsp';

const SEQ_RANGE = [1, 2, 5];            // SEQ OCT ±1 / ±2 / ±5 octaves
const JI_12 = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const JI_8 = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
/** Scale degrees in octaves for QUANTIZE ['OFF','12-ET','8-ET','12-JI','8-JI'] */
const SCALES: number[][] = [
  [],
  JI_12.map((_, i) => i / 12),
  MAJOR.map(i => i / 12),
  JI_12.map(r => Math.log2(r)),
  JI_8.map(r => Math.log2(r)),
];

export function quantize(oct: number, mode: number): number {
  const scale = SCALES[mode];
  if (!scale || !scale.length) return oct;
  const o = Math.floor(oct);
  let best = oct, dist = Infinity;
  for (let k = o - 1; k <= o + 1; k++) {
    for (const d of scale) {
      const c = k + d;
      const e = Math.abs(c - oct);
      if (e < dist - 1e-9) { dist = e; best = c; }
    }
  }
  return best;
}

const clampDiv = (d: number) => Math.max(1, Math.min(16, Math.round(d)));

// Gate-detector channels
const G_PLAY = 0, G_RESET = 1, G_TRIGGER = 2, G_CLOCK = 3;

interface Bank {
  node: AudioWorkletNode;
  vco: GainNode;
  sub1: GainNode;
  sub2: GainNode;
  lvVco: GainNode;
  lvSub1: GainNode;
  lvSub2: GainNode;
}

type DebugWindow = Window & { __subharmonicon?: unknown };

export class SubharmoniconEngine extends BaseEngine {
  private banks: Bank[] = [];
  private mixer!: GainNode;
  private vcf!: Ladder;
  private vca!: GainNode;
  private volume!: GainNode;
  private vcfEg!: Env;
  private vcaEg!: Env;
  private vcaNormal!: GainNode;
  private cutoffNormal!: GainNode;
  private cutoffBus!: GainNode;
  private egAmt!: GainNode;
  private vco1Bus!: GainNode;
  private vco2Normal!: GainNode;

  private seqOut: ConstantSourceNode[] = [];
  private seqClkPulse: ConstantSourceNode[] = [];
  private seqClkBus = [new EventBus(), new EventBus()];
  private clockPulse!: ConstantSourceNode;
  private clockBus = new EventBus();
  private trigPulse!: ConstantSourceNode;
  private trigBus = new EventBus();

  private gateDet!: AudioWorkletNode;
  private gateIn: GainNode[] = [];
  private recentEvents: number[][] = [[], [], [], []];
  private rhythmCv: CvReader[] = [];
  private probe!: AnalyserNode;

  private clock!: Clock;
  private playing = false;
  private counters = [0, 0, 0, 0];
  private pos = [0, 0];
  private armed = [true, true];
  private stepOct = [0, 0];
  private resetHeld = false;
  private gateHeld = false;       // envelopes currently in AR (held) mode
  private triggerHeld = false;
  private notes: number[] = [];
  private midiOct = 0;
  private inTick = false;
  private emittingTrig = false;
  private advances = [0, 0];
  private leds: Record<string, number> = {};

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- Oscillator banks --------------------------------------------------------
    this.mixer = g(0.32);
    for (let b = 0; b < 2; b++) {
      const node = new AudioWorkletNode(ctx, 'subharmonicon-vco', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [3],
      });
      const split = ctx.createChannelSplitter(3);
      node.connect(split);
      const tap = (i: number) => { const t = g(); split.connect(t, i); return t; };
      const bank: Bank = { node, vco: tap(0), sub1: tap(1), sub2: tap(2), lvVco: g(0), lvSub1: g(0), lvSub2: g(0) };
      bank.vco.connect(bank.lvVco).connect(this.mixer);
      bank.sub1.connect(bank.lvSub1).connect(this.mixer);
      bank.sub2.connect(bank.lvSub2).connect(this.mixer);
      this.banks.push(bank);
    }
    // VCO 1 pitch jack is normalled to VCO 2's pitch jack
    this.vco1Bus = g(1);
    this.vco2Normal = g(1);
    this.vco1Bus.connect(this.p(0, 'pitch'));
    this.vco1Bus.connect(this.vco2Normal).connect(this.p(1, 'pitch'));

    // --- Filter / VCA -------------------------------------------------------------
    this.vcf = new Ladder(ctx, 1800);
    this.vcf.setMode('lp24');
    this.mixer.connect(this.vcf.input);
    this.vca = g(0);
    this.volume = g(0.5);
    this.vcf.output.connect(this.vca).connect(this.volume).connect(this.out);

    this.vcfEg = new Env(ctx, 'ad');
    this.vcaEg = new Env(ctx, 'ad');
    // VCA EG → VCA jack (normal) → VCA
    this.vcaNormal = g(1);
    this.vcaEg.output.connect(this.vcaNormal).connect(this.vca.gain);
    // VCF EG → CUTOFF jack (normal) → VCF EG AMT → cutoff (1.0 = 5 octaves at full)
    this.cutoffNormal = g(1);
    this.cutoffBus = g(1);
    this.egAmt = g(0);
    this.vcfEg.output.connect(this.cutoffNormal).connect(this.cutoffBus);
    this.cutoffBus.connect(this.egAmt).connect(this.vcf.cutoffCv);

    // --- Sequencer / clock outputs -------------------------------------------------
    this.seqOut = [createConstant(ctx, 0), createConstant(ctx, 0)];
    this.seqClkPulse = [createConstant(ctx, 0), createConstant(ctx, 0)];
    this.clockPulse = createConstant(ctx, 0);
    this.trigPulse = createConstant(ctx, 0);

    // --- Gate inputs (edge detector) and rhythm CV readers ---------------------------
    this.gateDet = new AudioWorkletNode(ctx, 'subharmonicon-gate', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 4,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    });
    // Silent connection so the detector is always pulled by the render graph
    this.gateDet.connect(g(0)).connect(this.out);
    const merger = ctx.createChannelMerger(4);
    merger.connect(this.gateDet);
    for (let k = 0; k < 4; k++) {
      const n = g(1);
      n.connect(merger, 0, k);
      this.gateIn.push(n);
    }
    this.gateDet.port.onmessage = (e: MessageEvent<{ ch: number; time: number }>) => this.onGateCv(e.data.ch, e.data.time);
    this.rhythmCv = [0, 1, 2, 3].map(() => new CvReader(ctx));

    // Debug / test probe (spectral centroid of the output)
    this.probe = ctx.createAnalyser();
    this.probe.fftSize = 4096;
    this.volume.connect(this.probe);
    if (typeof window !== 'undefined') {
      (window as DebugWindow).__subharmonicon = {
        state: () => this.getState(),
        probe: () => this.measure(),
      };
    }

    this.clock = new Clock(ctx, (time) => this.masterTick(time), 60 / this.num('tempo', 240));

    this.onDispose(() => {
      this.clock.stop();
      [...this.seqOut, ...this.seqClkPulse, this.clockPulse, this.trigPulse].forEach(s => { try { s.stop(); } catch { /* */ } });
      this.gateDet.port.onmessage = null;
      this.gateDet.disconnect();
      this.banks.forEach(b => b.node.disconnect());
      if (typeof window !== 'undefined') delete (window as DebugWindow).__subharmonicon;
    });

    this.declarePatchPoints();
    this.emit({ playing: false, steps: { seq1: 0, seq2: 0 }, leds: {}, advances: { seq1: 0, seq2: 0 } });
  }

  private p(bank: number, name: string): AudioParam {
    return this.banks[bank].node.parameters.get(name)!;
  }

  private declarePatchPoints() {
    const [b1, b2] = this.banks;
    const v = this;
    this.outputs = {
      out_vca: { node: this.volume },
      out_vco1: { node: b1.vco },
      out_vco1_sub1: { node: b1.sub1 },
      out_vco1_sub2: { node: b1.sub2 },
      out_vca_eg: { node: this.vcaEg.output },
      out_vco2: { node: b2.vco },
      out_vco2_sub1: { node: b2.sub1 },
      out_vco2_sub2: { node: b2.sub2 },
      out_vcf_eg: { node: this.vcfEg.output },
      out_seq1: { node: this.seqOut[0] },
      out_seq1_clk: { node: this.seqClkPulse[0], event: this.seqClkBus[0] },
      out_seq2: { node: this.seqOut[1] },
      out_seq2_clk: { node: this.seqClkPulse[1], event: this.seqClkBus[1] },
      out_clock: { node: this.clockPulse, event: this.clockBus },
      out_trigger: { node: this.trigPulse, event: this.trigBus },
    };
    const gate = (ch: number) => ({ node: this.gateIn[ch], onEvent: (t: number) => this.onGateEvent(ch, t) });
    this.inputs = {
      // 1 V/oct pitch; VCO 1's jack also feeds VCO 2 until VCO 2 has its own cable
      in_vco1: { node: this.vco1Bus, scale: 5 },
      in_vco2: {
        params: [this.p(1, 'pitch')], scale: 5,
        onConnect: () => smooth(v.vco2Normal.gain, 0, v.ctx, 0.002),
        onDisconnect: () => smooth(v.vco2Normal.gain, 1, v.ctx, 0.002),
      },
      // Subdivision CV for both subs of that VCO (volts)
      in_vco1_sub: { params: [this.p(0, 'subCv')], scale: 5 },
      in_vco2_sub: { params: [this.p(1, 'subCv')], scale: 5 },
      // PWM replaces the SUB 1 sawtooth normal
      in_vco1_pwm: {
        params: [this.p(0, 'pwmCv')],
        onConnect: () => { v.p(0, 'pwmNormal').value = 0; },
        onDisconnect: () => { v.p(0, 'pwmNormal').value = 1; },
      },
      in_vco2_pwm: {
        params: [this.p(1, 'pwmCv')],
        onConnect: () => { v.p(1, 'pwmNormal').value = 0; },
        onDisconnect: () => { v.p(1, 'pwmNormal').value = 1; },
      },
      // VCA level replaces the VCA EG normal (5 V = fully open)
      in_vca: {
        params: [this.vca.gain],
        onConnect: () => smooth(v.vcaNormal.gain, 0, v.ctx, 0.002),
        onDisconnect: () => smooth(v.vcaNormal.gain, 1, v.ctx, 0.002),
      },
      // CUTOFF replaces the VCF EG normal; still scaled by VCF EG AMT (±5 oct at full)
      in_cutoff: {
        node: this.cutoffBus,
        onConnect: () => smooth(v.cutoffNormal.gain, 0, v.ctx, 0.002),
        onDisconnect: () => smooth(v.cutoffNormal.gain, 1, v.ctx, 0.002),
      },
      in_play: gate(G_PLAY),
      in_reset: gate(G_RESET),
      in_trigger: gate(G_TRIGGER),
      in_clock: {
        ...gate(G_CLOCK),
        onConnect: () => v.clock.stop(),
        onDisconnect: () => { if (v.playing) v.startClock(); },
      },
      in_rhythm1: { node: this.rhythmCv[0].input },
      in_rhythm2: { node: this.rhythmCv[1].input },
      in_rhythm3: { node: this.rhythmCv[2].input },
      in_rhythm4: { node: this.rhythmCv[3].input },
      // in_midi: no internal MIDI source exists - see header
    };
  }

  // --------------------------------------------------------------------------
  // Gate inputs: events (sample-accurate) and detected voltages (any signal)
  // --------------------------------------------------------------------------

  private onGateEvent(ch: number, time: number) {
    const list = this.recentEvents[ch];
    list.push(time);
    while (list.length > 16) list.shift();
    this.gateAction(ch, time);
  }

  private onGateCv(ch: number, time: number) {
    if (!this.started) return;
    // The same cable also delivered an event (clock/trigger outputs carry both)
    if (this.recentEvents[ch].some(t => Math.abs(t - time) < 0.02)) return;
    this.gateAction(ch, Math.max(time, this.ctx.currentTime) + 0.005);
  }

  private gateAction(ch: number, time: number) {
    switch (ch) {
      case G_PLAY: this.atTime(time, () => this.setPlaying(!this.playing)); break;
      case G_RESET: this.doReset(time); break;
      case G_TRIGGER: this.externalTrigger(time); break;
      case G_CLOCK: if (this.playing) this.masterTick(time); break;
    }
  }

  // --------------------------------------------------------------------------
  // Clock, rhythm generators, sequencers
  // --------------------------------------------------------------------------

  private startClock() {
    this.clock.setInterval(60 / this.num('tempo', 240));
    this.clock.start();
  }

  private setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    if (on && !this.isPatched('in_clock')) this.startClock();
    else this.clock.stop();
    this.emit({ playing: on });
  }

  private rhythmDiv(r: number): number {
    const base = -this.num(`rhythm${r + 1}`, -1);
    if (!this.isPatched(`in_rhythm${r + 1}`)) return clampDiv(base);
    const volts = this.rhythmCv[r].read() * 5;
    return clampDiv(base - 1.5 * volts);
  }

  private masterTick(time: number) {
    if (this.inTick) return; // CLOCK OUT → CLOCK IN feedback
    this.inTick = true;
    try {
      this.firePulse(this.clockPulse, this.clockBus, time);
      const fired = [false, false, false, false];
      for (let r = 0; r < 4; r++) {
        const div = this.rhythmDiv(r);
        if (this.counters[r] >= div) this.counters[r] %= div;
        fired[r] = this.counters[r] === 0;
        this.counters[r] = (this.counters[r] + 1) % div;
      }
      const xor = this.num('rhythm_logic', 0) === 1;
      let any = false;
      for (let s = 0; s < 2; s++) {
        let hits = 0;
        for (let r = 0; r < 4; r++) if (fired[r] && this.bool(`rhythm${r + 1}_seq${s + 1}`)) hits++;
        const advance = xor ? hits === 1 : hits >= 1;
        if (advance) {
          this.advanceSeq(s, time, false);
          any = true;
        }
      }
      if (any && this.egMode() === 1) this.triggerEgs(time);
      this.flash(time, fired.map((f, r) => (f ? `r${r + 1}` : '')).filter(Boolean).concat('clock'));
    } finally {
      this.inTick = false;
    }
  }

  private advanceSeq(s: number, time: number, manual: boolean) {
    if (this.resetHeld && !manual) {
      this.pos[s] = 0;
      this.armed[s] = true;
    } else if (this.armed[s] && !manual) {
      this.armed[s] = false;          // first clock after reset plays step 1
    } else {
      this.armed[s] = false;
      this.pos[s] = (this.pos[s] + 1) % 4;
    }
    this.applyStep(s, time);
    this.advances[s]++;
    this.firePulse(this.seqClkPulse[s], this.seqClkBus[s], time);
    const steps = { seq1: this.pos[0], seq2: this.pos[1] };
    const advances = { seq1: this.advances[0], seq2: this.advances[1] };
    this.emitAt(time, { steps, advances });
  }

  private doReset(time: number) {
    this.counters = [0, 0, 0, 0];
    this.pos = [0, 0];
    this.armed = [true, true];
    this.applyStep(0, time);
    this.applyStep(1, time);
    this.emitAt(time, { steps: { seq1: 0, seq2: 0 } });
  }

  /** Quantized pitch of the current step of sequencer s, in octaves (= volts) */
  private stepOctaves(s: number): number {
    const raw = (this.num(`seq${s + 1}_step${this.pos[s] + 1}`, 0) / 100) * SEQ_RANGE[this.num('seq_oct', 0)] ;
    return quantize(raw, this.num('quantize', 1));
  }

  private applyStep(s: number, time: number) {
    const oct = this.stepOctaves(s);
    this.stepOct[s] = oct;
    setAt(this.seqOut[s].offset, oct / 5, time);
    this.updatePitch(s, time);
    this.updateDivs(s, time);
  }

  private updatePitch(b: number, time: number) {
    const seq = this.bool(`seq${b + 1}_osc`) ? this.stepOct[b] : 0;
    setAt(this.p(b, 'pitch'), seq + this.midiOct, time);
  }

  private updateDivs(b: number, time: number) {
    for (const k of [1, 2]) {
      const base = -this.num(`vco${b + 1}_sub${k}_freq`, -2);
      const d = this.bool(`seq${b + 1}_sub${k}`) ? clampDiv(base - 1.5 * this.stepOct[b]) : clampDiv(base);
      setAt(this.p(b, `div${k}`), d, time);
    }
  }

  // --------------------------------------------------------------------------
  // Envelopes
  // --------------------------------------------------------------------------

  private egMode(): number {
    return this.num('eg_mode', 1);
  }

  private setEnvMode(mode: number, time: number) {
    for (const e of [this.vcfEg, this.vcaEg]) e.node.parameters.get('mode')!.setValueAtTime(mode, time);
  }

  /** One-shot attack/decay (or re-attack if a gate is being held) */
  private triggerEgs(time: number) {
    if (this.gateHeld) {
      this.vcfEg.gate(time, true);
      this.vcaEg.gate(time, true);
    } else {
      this.setEnvMode(0, Math.max(this.ctx.currentTime, time - 0.008));
      this.vcfEg.trigger(time, 1);
      this.vcaEg.trigger(time, 1);
    }
    this.emitTrigger(time);
  }

  private gateEgs(time: number, on: boolean) {
    if (on) {
      this.gateHeld = true;
      this.setEnvMode(2, this.ctx.currentTime);
      this.vcfEg.gate(time, true);
      this.vcaEg.gate(time, true);
      this.emitTrigger(time);
    } else {
      this.gateHeld = false;
      this.vcfEg.gate(time, false);
      this.vcaEg.gate(time, false);
    }
  }

  /** Is anything holding the envelopes open? */
  private wantGate(): boolean {
    return this.egMode() === 2 || (this.egMode() === 0 && this.triggerHeld) || this.notes.length > 0;
  }

  private refreshGate(time: number) {
    const want = this.wantGate();
    if (want && !this.gateHeld) this.gateEgs(time, true);
    else if (!want && this.gateHeld) this.gateEgs(time, false);
  }

  private externalTrigger(time: number) {
    if (this.egMode() === 2) return;
    this.triggerEgs(time);
  }

  private emitTrigger(time: number) {
    pulse(this.trigPulse.offset, time, 0.005, 1);
    if (this.emittingTrig) return; // TRIGGER OUT → TRIGGER IN
    this.emittingTrig = true;
    try { this.trigBus.emit(time, 1); } finally { this.emittingTrig = false; }
  }

  private firePulse(src: ConstantSourceNode, bus: EventBus, time: number) {
    pulse(src.offset, time, 0.005, 1);
    bus.emit(time, 1);
  }

  private flash(time: number, ids: string[]) {
    this.atTime(time, () => {
      ids.forEach(id => (this.leds[id] = 1));
      this.emit({ leds: { ...this.leds } });
    });
    this.atTime(time + 0.07, () => {
      ids.forEach(id => (this.leds[id] = 0));
      this.emit({ leds: { ...this.leds } });
    });
  }

  // --------------------------------------------------------------------------
  // UI events, keyboard (MIDI stand-in)
  // --------------------------------------------------------------------------

  event(name: string): void {
    if (!this.started) return;
    const now = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'reset':
        this.resetHeld = true;
        this.doReset(now);
        break;
      case 'reset:up':
        this.resetHeld = false;
        this.counters = [0, 0, 0, 0];
        this.armed = [true, true];
        break;
      case 'next':
        this.advanceSeq(0, now, true);
        this.advanceSeq(1, now, true);
        if (this.egMode() === 1) this.triggerEgs(now);
        break;
      case 'trigger':
        this.triggerHeld = true;
        if (this.egMode() === 1) this.triggerEgs(now);
        else this.refreshGate(now);
        this.flash(now, ['trig']);
        break;
      case 'trigger:up':
        this.triggerHeld = false;
        this.refreshGate(now);
        break;
    }
  }

  noteOn(note: number): void {
    if (!this.started) return;
    const now = this.ctx.currentTime + 0.005;
    this.notes = [...this.notes.filter(n => n !== note), note];
    this.midiOct = (note - 60) / 12;
    this.updatePitch(0, now);
    this.updatePitch(1, now);
    if (this.gateHeld && this.egMode() !== 2) this.triggerEgs(now); // legato retrigger
    else this.refreshGate(now);
  }

  noteOff(note: number): void {
    if (!this.started) return;
    const now = this.ctx.currentTime + 0.005;
    this.notes = this.notes.filter(n => n !== note);
    if (this.notes.length) {
      this.midiOct = (this.notes[this.notes.length - 1] - 60) / 12;
      this.updatePitch(0, now);
      this.updatePitch(1, now);
    }
    this.refreshGate(now);
  }

  // --------------------------------------------------------------------------

  private measure() {
    const bins = new Float32Array(this.probe.frequencyBinCount);
    this.probe.getFloatFrequencyData(bins);
    const time = new Float32Array(this.probe.fftSize);
    this.probe.getFloatTimeDomainData(time);
    let num = 0, den = 0, rms = 0;
    const hz = this.ctx.sampleRate / this.probe.fftSize;
    for (let i = 1; i < bins.length; i++) {
      const m = Math.pow(10, bins[i] / 20);
      num += m * i * hz;
      den += m;
    }
    for (let i = 0; i < time.length; i++) rms += time[i] * time[i];
    return { centroid: den > 0 ? num / den : 0, rms: Math.sqrt(rms / time.length) };
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const lvl = (x: number) => Math.pow(x / 100, 1.5);
    const m = /^vco([12])_(.+)$/.exec(id);
    if (m) {
      const b = +m[1] - 1;
      const bank = this.banks[b];
      switch (m[2]) {
        case 'freq': smooth(this.p(b, 'frequency'), n, ctx, 0.015); return;
        case 'sub1_freq':
        case 'sub2_freq': this.updateDivs(b, now); return;
        case 'wave': this.p(b, 'wave').value = n; return;
        case 'level': smooth(bank.lvVco.gain, lvl(n), ctx); return;
        case 'sub1_level': smooth(bank.lvSub1.gain, lvl(n), ctx); return;
        case 'sub2_level': smooth(bank.lvSub2.gain, lvl(n), ctx); return;
      }
      return;
    }
    const sm = /^seq([12])_(step(\d)|osc|sub1|sub2)$/.exec(id);
    if (sm) {
      const s = +sm[1] - 1;
      if (sm[3] === undefined || +sm[3] === this.pos[s] + 1) this.applyStep(s, now);
      return;
    }
    switch (id) {
      case 'seq_oct':
      case 'quantize':
        this.applyStep(0, now);
        this.applyStep(1, now);
        break;
      case 'tempo': this.clock.setInterval(60 / Math.max(1, n)); break;
      case 'play': this.setPlaying(!!value); break;
      case 'eg_mode': this.refreshGate(now + 0.005); break;
      case 'cutoff': smooth(this.vcf.cutoff, n, ctx); break;
      case 'resonance': smooth(this.vcf.resonance, (n / 100) * 1.1, ctx); break;
      case 'vcf_eg_amt': smooth(this.egAmt.gain, (n / 100) * 5, ctx); break;
      case 'volume': smooth(this.volume.gain, Math.pow(n / 100, 2), ctx); break;
      case 'vcf_attack': this.vcfEg.attack.value = n / 1000; break;
      case 'vcf_decay': this.vcfEg.decay.value = n / 1000; this.vcfEg.release.value = n / 1000; break;
      case 'vca_attack': this.vcaEg.attack.value = n / 1000; break;
      case 'vca_decay': this.vcaEg.decay.value = n / 1000; this.vcaEg.release.value = n / 1000; break;
      default: break; // rhythm dividers / assigns / logic are read on each clock
    }
  }
}
