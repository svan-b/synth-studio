// ============================================================================
// Mother-32 audio engine
//
//  KB / SEQ ─► KB CV ──(glide)──► [VCO 1V/OCT]─► VCO ─┬ SAW ─┐
//                                     ▲  ▲  ▲         └ PULSE┴► WAVE ─► MIX ◄─ EXT AUDIO ◄─ NOISE (normal)
//      VCO MOD (EG or jack / LFO) ────┘  │  └ LIN FM                     │
//      → FREQ or PW                      │                               ▼
//                                        │                LADDER VCF (LP / HP) ◄─ VCF MOD (EG / LFO), CUTOFF, RES CV
//  GATE ─► EG (AD / sustain) ────────────┘                               ▼
//                 └──────── VCA CV (normal) ──────────────────────────► VCA ─► VOLUME ─► out
//
//  Utilities: VC MIX (MIX 1 = 0 V, MIX 2 = +5 V normals, crossfaded by the
//  VC MIX knob + VC MIX CTRL), MULT (1 in → 2 outs), ASSIGN (accent / clock).
//
//  Signal convention: 1.0 = 5 V. Every patch point is a real audio-rate
//  connection; inputs with an internal normal break it on connect and restore
//  it on disconnect. The sequencer inputs (TEMPO, RUN/STOP, RESET, HOLD) go
//  through a sample-accurate edge detector worklet (mother32-processors.js).
//
//  Simplifications (documented in tips too):
//  - KB-mode pattern recording (SHIFT + RUN/STOP) is modelled; STEP (step
//    edit) mode, per-step glide / ratchet / gate length, swing, pattern banks
//    and playback direction are not. Pattern length = number of recorded steps.
//  - SHIFT latches (tap on, tap off) so second functions work with a mouse.
//  - ASSIGN offers two of the 16 Setup-mode sources (ACCENT, CLOCK).
//  - HOLD acts while the sequencer runs (repeat the current step).
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Env, Ladder, Lfo, Vco, createConstant, createNoise, pulse, setAt, smooth } from '@/lib/audio/dsp';
import { KB_LOW, decodeNote, patternLength } from './sequence';
import { MOTHER32 } from './spec';

const BASE_FREQ = 130.81;      // C3: FREQUENCY at 0 with the lowest key (KB = 0 V)
const VCO_MOD_PITCH = 3;       // octaves at 100% VCO MOD AMOUNT (dest FREQ)
const VCO_MOD_PW = 0.45;       // pulse-width swing at 100% (dest PW)
const VCF_MOD_RANGE = 5;       // octaves at ±100% VCF MOD AMOUNT

const DEFAULT_NOTES = (MOTHER32.controls.seq_notes as { default: string }).default;

// Edge-detector channels
const CH_TEMPO = 0, CH_RUN = 1, CH_RESET = 2, CH_HOLD = 3;

export class Mother32Engine extends BaseEngine {
  private vco!: Vco;
  private sawSel!: GainNode;
  private pulseSel!: GainNode;
  private kbCv!: ConstantSourceNode;          // KB output, 1.0 = 5 V (1 V/oct)
  private kbToVco!: GainNode;
  private fmScale!: GainNode;
  private noiseNormal!: GainNode;
  private extBus!: GainNode;
  private mixCtl!: ConstantSourceNode;
  private vcf!: Ladder;
  private vca!: GainNode;
  private vcaOn!: ConstantSourceNode;
  private egModeVca!: GainNode;
  private egNormalVca!: GainNode;
  private volume!: GainNode;
  private env!: Env;
  private gateSig!: ConstantSourceNode;
  private gateNormal!: GainNode;
  private lfo!: Lfo;
  private lfoSelTri!: GainNode;
  private lfoSelSq!: GainNode;
  private egToVcoMod!: GainNode;
  private vcoModEg!: GainNode;
  private vcoModLfo!: GainNode;
  private vcoModAmt!: GainNode;
  private vcoModToPitch!: GainNode;
  private vcoModToPw!: GainNode;
  private vcfModEg!: GainNode;
  private vcfModLfo!: GainNode;
  private vcfModAmt!: GainNode;
  private mix2Normal!: GainNode;
  private vcMixCtl!: ConstantSourceNode;
  private assignSig!: ConstantSourceNode;
  private edges!: AudioWorkletNode;
  private edgeIns: GainNode[] = [];

  private clock!: Clock;
  private seqOn = false;
  private stepIdx = -1;
  private transpose = 0;
  private octave = 0;
  private holdBtn = false;
  private holdJack = false;
  private extRunHigh = false;
  private resetPending = false;
  private lastTempoEdge = 0;
  private extInterval = 0.125;
  private pendingAccent = false;
  private held: number[] = [];
  private keyNotes = new Map<number, number>();

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- Keyboard CV + VCO -------------------------------------------------------
    this.vco = new Vco(ctx, BASE_FREQ);
    this.kbCv = createConstant(ctx, 0);
    this.kbToVco = g(5);                                  // 1.0 (5 V) → 5 octaves
    this.kbCv.connect(this.kbToVco).connect(this.vco.pitch);
    this.fmScale = g(BASE_FREQ);                          // LIN FM: 5 V = ±100% of the base frequency
    this.fmScale.connect(this.vco.fm);

    this.sawSel = g(1);
    this.pulseSel = g(0);
    const wave = g(1);
    this.vco.saw.connect(this.sawSel).connect(wave);
    this.vco.pulse.connect(this.pulseSel).connect(wave);

    // --- Noise → EXT AUDIO normal, MIX crossfade ------------------------------------
    const noise = createNoise(ctx);
    const noiseOut = g(0.9);
    noise.connect(noiseOut);
    this.noiseNormal = g(1);
    this.extBus = g(1);
    noiseOut.connect(this.noiseNormal).connect(this.extBus);

    const xf = crossfader(ctx, 0);
    this.mixCtl = xf.ctl;
    const mixOut = g(0.8);
    wave.connect(xf.a).connect(mixOut);
    this.extBus.connect(xf.b).connect(mixOut);

    // --- VCF ----------------------------------------------------------------------
    this.vcf = new Ladder(ctx, 1200);
    this.vcf.setMode('lp24');
    mixOut.connect(this.vcf.input);
    const vcfOut = g(1);
    this.vcf.output.connect(vcfOut);

    // --- EG + gate ----------------------------------------------------------------
    this.env = new Env(ctx, 'ar');
    this.env.setLinear(false);
    const egOut = g(1);
    this.env.output.connect(egOut);
    this.gateSig = createConstant(ctx, 0);               // GATE output
    this.gateNormal = g(1);
    this.gateSig.connect(this.gateNormal).connect(this.env.gateInput);

    // --- VCA ----------------------------------------------------------------------
    this.vca = g(0);
    vcfOut.connect(this.vca);
    const vcaOut = g(1);
    this.vca.connect(vcaOut);
    this.volume = g(0.5);
    vcaOut.connect(this.volume).connect(this.out);
    this.vcaOn = createConstant(ctx, 0);                  // VCA MODE = ON → fully open
    this.vcaOn.connect(this.vca.gain);
    this.egNormalVca = g(1);                              // broken by a cable in VCA CV
    this.egModeVca = g(1);                                // VCA MODE = EG
    egOut.connect(this.egNormalVca).connect(this.egModeVca).connect(this.vca.gain);

    // --- LFO ------------------------------------------------------------------------
    this.lfo = new Lfo(ctx, 4, 'triangle');
    const lfoTri = g(1);
    this.lfo.output.connect(lfoTri);
    const sq = ctx.createWaveShaper();
    sq.curve = signCurve();
    const lfoSq = g(1);
    this.lfo.output.connect(sq).connect(lfoSq);
    this.lfoSelTri = g(1);
    this.lfoSelSq = g(0);
    const lfoSel = g(1);
    lfoTri.connect(this.lfoSelTri).connect(lfoSel);
    lfoSq.connect(this.lfoSelSq).connect(lfoSel);

    // --- VCO MOD: source (EG / VCO MOD jack | LFO) → amount → FREQ or PW -----------
    const vcoModJack = g(1);                              // the VCO MOD input jack
    this.egToVcoMod = g(1);                               // EG normal into that jack
    egOut.connect(this.egToVcoMod).connect(vcoModJack);
    this.vcoModEg = g(0);
    this.vcoModLfo = g(1);
    this.vcoModAmt = g(0);
    vcoModJack.connect(this.vcoModEg).connect(this.vcoModAmt);
    lfoSel.connect(this.vcoModLfo).connect(this.vcoModAmt);
    this.vcoModToPitch = g(VCO_MOD_PITCH);
    this.vcoModToPw = g(0);
    this.vcoModAmt.connect(this.vcoModToPitch).connect(this.vco.pitch);
    this.vcoModAmt.connect(this.vcoModToPw).connect(this.vco.pw);

    // --- VCF MOD: EG | LFO → bipolar amount → cutoff ---------------------------------
    this.vcfModEg = g(1);
    this.vcfModLfo = g(0);
    this.vcfModAmt = g(0);
    egOut.connect(this.vcfModEg).connect(this.vcfModAmt);
    lfoSel.connect(this.vcfModLfo).connect(this.vcfModAmt);
    this.vcfModAmt.connect(this.vcf.cutoffCv);

    // --- VC MIX: MIX 1 (0 V normal) ↔ MIX 2 (+5 V normal) -----------------------------
    const mix1 = g(1);
    const mix2 = g(1);
    const plus5 = createConstant(ctx, 1);
    this.mix2Normal = g(1);
    plus5.connect(this.mix2Normal).connect(mix2);
    const vm = crossfader(ctx, 0.5);
    this.vcMixCtl = vm.ctl;
    const vcMixOut = g(1);
    mix1.connect(vm.a).connect(vcMixOut);
    mix2.connect(vm.b).connect(vcMixOut);

    // --- MULT, ASSIGN --------------------------------------------------------------------
    const mult = g(1);
    this.assignSig = createConstant(ctx, 0);

    // --- Sequencer inputs: edge detector -----------------------------------------------
    this.edges = new AudioWorkletNode(ctx, 'm32-edges', { numberOfInputs: 4, numberOfOutputs: 1, outputChannelCount: [1] });
    this.edgeIns = [0, 1, 2, 3].map(k => { const n = g(1); n.connect(this.edges, 0, k); return n; });
    const sink = g(0);
    this.edges.connect(sink).connect(this.out);
    this.edges.port.onmessage = (e: MessageEvent<{ ch: number; high: boolean; time: number }>) => this.onEdge(e.data.ch, e.data.high, e.data.time);

    this.clock = new Clock(ctx, (time) => this.seqTick(time, this.stepInterval()), this.stepInterval());

    const v = this;
    this.outputs = {
      out_vca: { node: vcaOut },
      out_noise: { node: noiseOut },
      out_vcf: { node: vcfOut },
      out_vco_saw: { node: this.vco.saw },
      out_vco_pulse: { node: this.vco.pulse },
      out_lfo_tri: { node: lfoTri },
      out_lfo_sq: { node: lfoSq },
      out_vc_mix: { node: vcMixOut },
      out_mult1: { node: mult },
      out_mult2: { node: mult },
      out_assign: { node: this.assignSig },
      out_eg: { node: egOut },
      out_kb: { node: this.kbCv },
      out_gate: { node: this.gateSig },
    };
    this.inputs = {
      // EXT AUDIO replaces the NOISE normal into the mixer
      in_ext_audio: {
        node: this.extBus,
        onConnect: () => smooth(v.noiseNormal.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.noiseNormal.gain, 1, v.ctx),
      },
      // ±5 V sweeps the MIX crossfade end to end (summed with the knob)
      in_mix_cv: { params: [this.mixCtl.offset], scale: 0.5 },
      // VCA CV replaces the EG normal
      in_vca_cv: {
        params: [this.vca.gain],
        onConnect: () => smooth(v.egNormalVca.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.egNormalVca.gain, 1, v.ctx),
      },
      in_vcf_cutoff: { params: [this.vcf.cutoffCv], scale: 5 },     // ~1 V/oct
      in_vcf_res: { params: [this.vcf.resonance], scale: 0.22 },    // +5 V ≈ full resonance
      // 1V/OCT replaces the internal KB CV normal
      in_vco_1voct: {
        params: [this.vco.pitch], scale: 5,
        onConnect: () => smooth(v.kbToVco.gain, 0, v.ctx, 0.002),
        onDisconnect: () => smooth(v.kbToVco.gain, 5, v.ctx, 0.002),
      },
      in_vco_lin_fm: { node: this.fmScale },
      // VCO MOD replaces the EG at the EG position of the VCO MOD source switch
      in_vco_mod: {
        node: vcoModJack,
        onConnect: () => smooth(v.egToVcoMod.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.egToVcoMod.gain, 1, v.ctx),
      },
      in_lfo_rate: { params: [this.lfo.osc.detune], scale: 6000 },  // 1 V/oct of LFO rate
      in_mix1: { node: mix1 },
      in_mix2: {
        node: mix2,
        onConnect: () => smooth(v.mix2Normal.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.mix2Normal.gain, 1, v.ctx),
      },
      in_vc_mix_ctrl: { params: [this.vcMixCtl.offset] },            // +5 V = full travel
      in_mult: { node: mult },
      // External GATE replaces the keyboard / sequencer gate into the EG
      in_gate: {
        node: this.env.gateInput,
        onConnect: () => setAt(v.gateNormal.gain, 0, v.ctx.currentTime),
        onDisconnect: () => setAt(v.gateNormal.gain, 1, v.ctx.currentTime),
      },
      // TEMPO: external clock - each rising edge advances one step
      in_tempo: {
        node: this.edgeIns[CH_TEMPO],
        onConnect: () => v.clock.stop(),
        onDisconnect: () => { if (v.seqOn) { v.clock.setInterval(v.stepInterval()); v.clock.start(); } },
      },
      // RUN/STOP: the sequencer runs while the gate is high
      in_run_stop: {
        node: this.edgeIns[CH_RUN],
        onConnect: () => v.updateTransport(),
        onDisconnect: () => { v.extRunHigh = false; v.updateTransport(); },
      },
      in_reset: { node: this.edgeIns[CH_RESET] },
      in_hold: { node: this.edgeIns[CH_HOLD], onDisconnect: () => { v.holdJack = false; } },
    };

    this.onDispose(() => {
      this.clock.stop();
      this.edges.port.onmessage = null;
      [noise, this.kbCv, this.gateSig, this.assignSig, plus5, this.mixCtl, this.vcMixCtl, this.vcaOn]
        .forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
      this.lfo.stop();
      [this.vco.node, this.vcf.node, this.env.node, this.edges].forEach(n => n.disconnect());
    });

    this.emit({ playing: false, step: -1, octave: 0, litKey: -1, transpose: 0 });
  }

  // ---------------------------------------------------------------------------
  // Sequencer
  // ---------------------------------------------------------------------------

  private stepInterval(): number {
    return 60 / (Math.max(1, this.num('tempo', 120)) * 4);  // 16th notes
  }

  private wantRun(): boolean {
    if (this.bool('rec')) return false;
    if (this.isPatched('in_run_stop')) return this.extRunHigh;
    return this.bool('run_stop');
  }

  private updateTransport() {
    const want = this.wantRun();
    if (want && !this.seqOn) {
      this.seqOn = true;
      this.stepIdx = -1;
      this.resetPending = false;
      if (!this.isPatched('in_tempo')) {
        this.clock.setInterval(this.stepInterval());
        this.clock.start();
      }
      this.emit({ playing: true });
    } else if (!want && this.seqOn) {
      this.seqOn = false;
      this.clock.stop();
      const now = this.ctx.currentTime;
      this.gateOff(now);
      this.assignSig.offset.cancelScheduledValues(now);
      this.assignSig.offset.setValueAtTime(0, now);
      this.emit({ playing: false, litKey: -1 });
    }
  }

  private onEdge(ch: number, high: boolean, time: number) {
    if (!this.started) return;
    if (ch === CH_TEMPO && high) {
      if (this.lastTempoEdge > 0) this.extInterval = Math.min(4, Math.max(0.02, time - this.lastTempoEdge));
      this.lastTempoEdge = time;
      if (this.seqOn && this.isPatched('in_tempo')) this.seqTick(Math.max(time, this.ctx.currentTime) + 0.01, this.extInterval);
    } else if (ch === CH_RUN) {
      this.extRunHigh = high;
      if (this.isPatched('in_run_stop')) this.updateTransport();
    } else if (ch === CH_RESET && high) {
      if (this.seqOn) this.resetPending = true; else this.stepIdx = -1;
    } else if (ch === CH_HOLD) {
      this.holdJack = high;
    }
  }

  private seqTick(time: number, interval: number) {
    const notes = this.str('seq_notes', DEFAULT_NOTES);
    const len = patternLength(notes);
    if (len === 0) { this.emitAt(time, { step: -1 }); return; }
    if (this.resetPending) { this.stepIdx = -1; this.resetPending = false; }
    const holding = (this.holdBtn || this.holdJack) && this.stepIdx >= 0;
    if (!holding) this.stepIdx = (this.stepIdx + 1) % len;
    if (this.stepIdx >= len) this.stepIdx = 0;
    this.playStep(this.stepIdx, time, interval, notes);
  }

  private playStep(idx: number, time: number, interval: number, notes: string) {
    const accents = this.str('seq_accent', '');
    const note = decodeNote(notes[idx]);
    const gateDur = Math.max(0.005, (this.num('gate_length', 50) / 100) * interval);
    const assign = this.num('assign_source', 0);

    if (assign === 1) pulse(this.assignSig.offset, time, interval * 0.5, 1);                       // CLOCK
    else if (note !== null && accents[idx] === '1') pulse(this.assignSig.offset, time, gateDur, 1);  // ACCENT

    if (note === null) {               // REST
      setAt(this.gateSig.offset, 0, time);
      this.emitAt(time, { step: idx, litKey: -1 });
      return;
    }
    const n = note + this.transpose;
    this.setPitch((n - KB_LOW) / 60, time);
    setAt(this.gateSig.offset, 0, time);
    setAt(this.gateSig.offset, 1, time + 0.002);       // re-trigger the EG every step
    if (this.num('gate_length', 50) < 99.5) setAt(this.gateSig.offset, 0, time + gateDur);
    this.emitAt(time, { step: idx, litKey: this.keyFor(n) });
    this.emitAt(time + gateDur, { litKey: -1 });
  }

  /** Which panel key LED represents a note (exact key in the current octave, else its pitch class) */
  private keyFor(note: number): number {
    const k = note - (KB_LOW + 12 * this.octave);
    if (k >= 0 && k <= 12) return k;
    return ((k % 12) + 12) % 12;
  }

  private setPitch(cv: number, time: number) {
    const p = this.kbCv.offset;
    const glide = this.num('glide', 0) / 1000;
    p.cancelScheduledValues(time);
    if (glide > 0.002) p.setTargetAtTime(cv, time, glide / 3);
    else p.setValueAtTime(cv, time);
  }

  private gateOff(time: number) {
    this.gateSig.offset.cancelScheduledValues(time);
    this.gateSig.offset.setValueAtTime(0, time);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  noteOn(note: number): void {
    if (!this.started) return;
    if (this.seqOn) {
      // KB mode while running: the keyboard transposes the pattern (C = no transposition)
      this.transpose = note - KB_LOW;
      this.emit({ transpose: this.transpose });
      return;
    }
    this.held = this.held.filter(n => n !== note);
    this.held.push(note);
    const t = this.ctx.currentTime + 0.003;
    this.setPitch((note - KB_LOW) / 60, t);
    if (this.held.length === 1) {
      // New gate (legato playing keeps the gate high and doesn't re-trigger)
      this.gateSig.offset.cancelScheduledValues(t);
      setAt(this.gateSig.offset, 0, t);
      setAt(this.gateSig.offset, 1, t + 0.002);
    }
    this.emit({ litKey: this.keyFor(note) });
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.held = this.held.filter(n => n !== note);
    if (this.seqOn) return;
    const now = this.ctx.currentTime;
    if (this.held.length) {
      const last = this.held[this.held.length - 1];
      this.setPitch((last - KB_LOW) / 60, now);
      this.emit({ litKey: this.keyFor(last) });
    } else {
      this.gateOff(now + 0.003);
      this.emit({ litKey: -1 });
    }
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    switch (name) {
      case 'key': {
        const { i, on } = (payload ?? {}) as { i?: number; on?: boolean };
        if (typeof i !== 'number') return;
        if (on) {
          const note = KB_LOW + 12 * this.octave + i;
          this.keyNotes.set(i, note);
          this.noteOn(note);
        } else {
          const note = this.keyNotes.get(i);
          this.keyNotes.delete(i);
          if (note !== undefined) this.noteOff(note);
        }
        break;
      }
      case 'oct_down': this.octave = Math.max(-2, this.octave - 1); this.emit({ octave: this.octave }); break;
      case 'oct_up': this.octave = Math.min(2, this.octave + 1); this.emit({ octave: this.octave }); break;
      case 'hold': this.holdBtn = true; this.emit({ hold: true }); break;
      case 'hold:up': this.holdBtn = false; this.emit({ hold: false }); break;
      case 'reset':
        if (this.seqOn) this.resetPending = true; else this.stepIdx = -1;
        break;
      // Pattern recording: RESET/ACCENT arms an accent for the next recorded step
      case 'accent_toggle': this.pendingAccent = !this.pendingAccent; this.emit({ pendingAccent: this.pendingAccent }); break;
      case 'accent_clear': this.pendingAccent = false; this.emit({ pendingAccent: false }); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    switch (id) {
      case 'frequency': {
        const f = BASE_FREQ * Math.pow(2, n);
        smooth(this.vco.frequency, f, ctx);
        smooth(this.fmScale.gain, f, ctx);
        break;
      }
      case 'pulse_width': smooth(this.vco.pw, Math.min(0.97, Math.max(0.03, n / 100)), ctx); break;
      case 'vco_wave': // ['SAW', 'PULSE']
        smooth(this.sawSel.gain, n === 0 ? 1 : 0, ctx, 0.003);
        smooth(this.pulseSel.gain, n === 1 ? 0.75 : 0, ctx, 0.003);
        break;
      case 'vco_mod_source': // ['EG', 'LFO']
        smooth(this.vcoModEg.gain, n === 0 ? 1 : 0, ctx, 0.003);
        smooth(this.vcoModLfo.gain, n === 1 ? 1 : 0, ctx, 0.003);
        break;
      case 'vco_mod_dest': // ['FREQ', 'PW']
        smooth(this.vcoModToPitch.gain, n === 0 ? VCO_MOD_PITCH : 0, ctx, 0.003);
        smooth(this.vcoModToPw.gain, n === 1 ? VCO_MOD_PW : 0, ctx, 0.003);
        break;
      case 'vco_mod_amount': smooth(this.vcoModAmt.gain, Math.pow(n / 100, 2), ctx); break;
      case 'mix': smooth(this.mixCtl.offset, n / 100, ctx); break;
      case 'cutoff': smooth(this.vcf.cutoff, n, ctx); break;
      case 'resonance': smooth(this.vcf.resonance, (n / 100) * 1.08, ctx); break;
      case 'vcf_mode': this.vcf.setMode(n === 0 ? 'hp24' : 'lp24'); break; // ['HP', 'LP']
      case 'vcf_mod_source': // ['EG', 'LFO']
        smooth(this.vcfModEg.gain, n === 0 ? 1 : 0, ctx, 0.003);
        smooth(this.vcfModLfo.gain, n === 1 ? 1 : 0, ctx, 0.003);
        break;
      case 'vcf_mod_amount': smooth(this.vcfModAmt.gain, (n / 100) * VCF_MOD_RANGE, ctx); break;
      case 'vca_mode': // ['ON', 'EG']
        smooth(this.vcaOn.offset, n === 0 ? 1 : 0, ctx);
        smooth(this.egModeVca.gain, n === 1 ? 1 : 0, ctx);
        break;
      case 'volume': smooth(this.volume.gain, Math.pow(n / 100, 2), ctx); break;
      case 'attack': this.env.attack.value = n / 1000; break;
      case 'decay': this.env.decay.value = n / 1000; this.env.release.value = n / 1000; break;
      case 'sustain': // ['ON', 'OFF']: ON = sustain at full level, DECAY = release; OFF = AD
        if (n === 0) this.env.setMode('ar');
        else { this.env.setMode('adsr'); this.env.sustain.value = 0; }
        break;
      case 'lfo_rate': smooth(this.lfo.frequency, n, ctx); break;
      case 'lfo_wave': // ['TRI', 'SQ']
        smooth(this.lfoSelTri.gain, n === 0 ? 1 : 0, ctx, 0.003);
        smooth(this.lfoSelSq.gain, n === 1 ? 1 : 0, ctx, 0.003);
        break;
      case 'vc_mix': smooth(this.vcMixCtl.offset, n / 100, ctx); break;
      case 'assign_source':
        this.assignSig.offset.cancelScheduledValues(ctx.currentTime);
        this.assignSig.offset.setValueAtTime(0, ctx.currentTime);
        break;
      case 'tempo': if (!this.isPatched('in_tempo')) this.clock.setInterval(this.stepInterval()); break;
      case 'run_stop':
      case 'rec':
        this.updateTransport();
        break;
      default:
        break;
    }
  }
}

/**
 * Voltage-controlled crossfader: out = a·(1 − m) + b·m with m = clamp(ctl, 0, 1).
 * Connect sources to `a` / `b` and sum their outputs; CV can be summed into ctl.offset.
 */
function crossfader(ctx: AudioContext, initial: number) {
  const ctl = createConstant(ctx, initial);
  const half = ctx.createGain();
  half.gain.value = 0.5;
  const clamp = ctx.createWaveShaper();
  clamp.curve = clampCurve();
  const inv = ctx.createGain();
  inv.gain.value = -1;
  const a = ctx.createGain();
  a.gain.value = 1;
  const b = ctx.createGain();
  b.gain.value = 0;
  ctl.connect(half).connect(clamp);
  clamp.connect(b.gain);
  clamp.connect(inv).connect(a.gain);
  return { ctl, a, b };
}

// Input is ctl/2 in [-1, 1]; output clamp(2x, 0, 1)
function clampCurve(): Float32Array<ArrayBuffer> {
  const n = 2049;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.min(1, Math.max(0, 2 * x));
  }
  return c;
}

// Triangle → square (sign), keeps both LFO outputs in phase like the hardware
function signCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = i < n / 2 ? -1 : 1;
  return c;
}
