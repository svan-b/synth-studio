// ============================================================================
// DFAM audio engine
//
//   VCO 1 ──┬──────────────► MIXER ─► LADDER VCF (LP/HP) ─► VCA ─► VOLUME ─► out
//           ├─ FM ─► VCO 2 ─►  ▲           ▲      ▲          ▲
//           └─ SYNC ─► VCO 2   │           │      │          │
//   NOISE / EXT ───────────────┘   VCF EG ─┘   NOISE VCF MOD  VCA EG (FAST/SLOW)
//   VCO EG ─► VCO 1/2 pitch (EG AMT)       SEQ PITCH ─► VCO 1&2 / VCO 2 / OFF
//
// 8-step sequencer clocked by a look-ahead scheduler. Velocity is normalled to
// the VCA level and the VCF EG amount, as on the hardware.
// All 24 patch points are live: CV inputs are audio-rate connections, decay
// inputs modulate the envelope worklets, TRIGGER/ADV inputs accept events.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock, CvReader, EventBus } from '@/lib/audio/engine';
import { Env, Ladder, Vco, createConstant, createNoise, pulse, smooth, setAt } from '@/lib/audio/dsp';

const BASE_FREQ = 130.81; // C3 at FREQ = 0
const EG_PITCH_RANGE = 4;  // octaves at 100% VCO EG AMT
const EG_CUTOFF_RANGE = 6; // octaves at 100% VCF EG AMT

export class DfamEngine extends BaseEngine {
  private vco1!: Vco;
  private vco2!: Vco;
  private vco1Sel!: GainNode;      // selected waveform of VCO 1
  private vco2Sel!: GainNode;
  private vco1Tri!: GainNode; private vco1Sqr!: GainNode;
  private vco2Tri!: GainNode; private vco2Sqr!: GainNode;
  private fmDepth!: GainNode;
  private vco1Level!: GainNode;
  private vco2Level!: GainNode;
  private noiseLevel!: GainNode;
  private noiseSrc!: GainNode;      // normalled noise into the NOISE/EXT channel
  private mixer!: GainNode;
  private vcf!: Ladder;
  private noiseVcfMod!: GainNode;
  private vca!: GainNode;
  private velocityVca!: GainNode;
  private volume!: GainNode;

  private vcoEg!: Env;
  private vcfEg!: Env;
  private vcaEg!: Env;
  private vco1EgAmt!: GainNode;
  private vco2EgAmt!: GainNode;
  private vcfEgAmt!: GainNode;
  private vcaEgToVca!: GainNode;

  private seqPitch!: ConstantSourceNode;   // octaves
  private seqToVco1!: GainNode;
  private seqToVco2!: GainNode;
  private pitchOut!: ConstantSourceNode;   // 1.0 = 5V
  private velocityOut!: ConstantSourceNode;
  private triggerPulse!: ConstantSourceNode;
  private triggerBus = new EventBus();

  private clock!: Clock;
  private tempoCv!: CvReader;
  private runCv!: CvReader;
  private step = 0;
  private running = false;
  private externalVelocity = false;

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    // --- Oscillators -----------------------------------------------------------
    this.vco1 = new Vco(ctx, BASE_FREQ);
    this.vco2 = new Vco(ctx, BASE_FREQ);
    this.vco1Tri = g(1); this.vco1Sqr = g(0);
    this.vco2Tri = g(1); this.vco2Sqr = g(0);
    this.vco1Sel = g(); this.vco2Sel = g();
    this.vco1.tri.connect(this.vco1Tri).connect(this.vco1Sel);
    this.vco1.pulse.connect(this.vco1Sqr).connect(this.vco1Sel);
    this.vco2.tri.connect(this.vco2Tri).connect(this.vco2Sel);
    this.vco2.pulse.connect(this.vco2Sqr).connect(this.vco2Sel);

    // 1→2 FM (linear, Hz) and hard sync (VCO 1 square resets VCO 2)
    this.fmDepth = g(0);
    this.vco1Sel.connect(this.fmDepth).connect(this.vco2.fm);
    this.vco1.pulse.connect(this.vco2.syncInput);

    // --- Mixer -------------------------------------------------------------------
    this.vco1Level = g(0.75);
    this.vco2Level = g(0.5);
    this.noiseLevel = g(0);
    this.noiseSrc = g(1);
    const noise = createNoise(ctx);
    noise.connect(this.noiseSrc).connect(this.noiseLevel);
    this.mixer = g(0.55);
    this.vco1Sel.connect(this.vco1Level).connect(this.mixer);
    this.vco2Sel.connect(this.vco2Level).connect(this.mixer);
    this.noiseLevel.connect(this.mixer);

    // --- Filter --------------------------------------------------------------------
    this.vcf = new Ladder(ctx, 1000);
    this.vcf.setMode('lp24');
    this.mixer.connect(this.vcf.input);
    this.noiseVcfMod = g(0);
    noise.connect(this.noiseVcfMod).connect(this.vcf.cutoffCv);

    // --- VCA -----------------------------------------------------------------------
    this.vca = g(0);
    this.velocityVca = g(1);
    this.volume = g(0.75);
    this.vcf.output.connect(this.vca).connect(this.velocityVca).connect(this.volume).connect(this.out);

    // --- Envelopes ----------------------------------------------------------------
    this.vcoEg = new Env(ctx, 'ad');
    this.vcfEg = new Env(ctx, 'ad');
    this.vcaEg = new Env(ctx, 'ad');
    this.vco1EgAmt = g(0);
    this.vco2EgAmt = g(0);
    this.vcfEgAmt = g(0);
    this.vcaEgToVca = g(1);
    this.vcoEg.output.connect(this.vco1EgAmt).connect(this.vco1.pitch);
    this.vcoEg.output.connect(this.vco2EgAmt).connect(this.vco2.pitch);
    this.vcfEg.output.connect(this.vcfEgAmt).connect(this.vcf.cutoffCv);
    this.vcaEg.output.connect(this.vcaEgToVca).connect(this.vca.gain);

    // --- Sequencer CV ------------------------------------------------------------
    this.seqPitch = createConstant(ctx, 0);
    this.seqToVco1 = g(1);
    this.seqToVco2 = g(1);
    this.seqPitch.connect(this.seqToVco1).connect(this.vco1.pitch);
    this.seqPitch.connect(this.seqToVco2).connect(this.vco2.pitch);
    this.pitchOut = createConstant(ctx, 0);
    this.velocityOut = createConstant(ctx, 1);
    this.triggerPulse = createConstant(ctx, 0);

    this.tempoCv = new CvReader(ctx);
    this.runCv = new CvReader(ctx);
    this.clock = new Clock(ctx, (time) => this.onClock(time), this.stepInterval());

    this.onDispose(() => {
      this.clock.stop();
      [noise, this.seqPitch, this.pitchOut, this.velocityOut, this.triggerPulse].forEach(s => { try { s.stop(); } catch { /* */ } });
      this.vco1.node.disconnect();
      this.vco2.node.disconnect();
    });

    this.declarePatchPoints();
    this.emit({ playing: false, step: 0 });
  }

  private declarePatchPoints() {
    const v = this;
    this.outputs = {
      out_vca: { node: this.volume },
      out_vca_eg: { node: this.vcaEg.output },
      out_vcf_eg: { node: this.vcfEg.output },
      out_vco_eg: { node: this.vcoEg.output },
      out_vco1: { node: this.vco1Sel },
      out_vco2: { node: this.vco2Sel },
      out_trigger: { node: this.triggerPulse, event: this.triggerBus },
      out_velocity: { node: this.velocityOut },
      out_pitch: { node: this.pitchOut },
    };
    this.inputs = {
      // Trigger in fires the envelopes (it does not advance the sequencer)
      in_trigger: { onEvent: (t) => this.fireEnvelopes(t, this.stepVelocity()) },
      // VCA CV replaces the VCA EG (normal broken while patched)
      in_vca_cv: {
        params: [this.vca.gain],
        onConnect: () => smooth(v.vcaEgToVca.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.vcaEgToVca.gain, 1, v.ctx),
      },
      // External velocity replaces the sequencer velocity normal
      in_velocity: {
        params: [this.velocityVca.gain],
        onConnect: () => { v.externalVelocity = true; smooth(v.velocityVca.gain, 0, v.ctx); },
        onDisconnect: () => { v.externalVelocity = false; smooth(v.velocityVca.gain, 1, v.ctx); },
      },
      in_vca_decay: { params: [this.vcaEg.timeCv] },
      in_ext_audio: {
        node: this.noiseLevel,
        onConnect: () => smooth(v.noiseSrc.gain, 0, v.ctx),
        onDisconnect: () => smooth(v.noiseSrc.gain, 1, v.ctx),
      },
      in_vcf_decay: { params: [this.vcfEg.timeCv] },
      in_noise_level: { params: [this.noiseLevel.gain] },
      in_vco_decay: { params: [this.vcoEg.timeCv] },
      in_vcf_mod: { params: [this.vcf.cutoffCv], scale: 5 },          // 1V/oct
      in_vco1_cv: { params: [this.vco1.pitch], scale: 5 },            // 1V/oct
      in_fm_amount: { params: [this.fmDepth.gain], scale: 400 },      // CV adds FM depth (Hz)
      in_vco2_cv: { params: [this.vco2.pitch], scale: 5 },
      in_tempo: { node: this.tempoCv.input },
      // RUN/STOP gate: sequencer runs while the gate is high
      in_run_stop: {
        node: this.runCv.input,
        onConnect: () => this.clock.start(),
        onDisconnect: () => { if (!v.running) v.clock.stop(); },
      },
      in_adv_clock: { onEvent: (t) => this.advance(t) },
    };
  }

  // --------------------------------------------------------------------------

  private stepInterval(): number {
    // TEMPO knob is in steps per minute; tempo CV (1.0 = 5V) adds up to 5 octaves of rate
    const cv = this.started && this.isPatched('in_tempo') ? this.tempoCv.read() * 5 : 0;
    const spm = this.num('tempo', 120) * Math.pow(2, cv);
    return 60 / Math.max(1, spm);
  }

  private stepVelocity(): number {
    return this.num(`velocity_${this.step + 1}`, 100) / 100;
  }

  private onClock(time: number) {
    // External RUN/STOP gate: high = run
    if (this.isPatched('in_run_stop')) {
      const high = this.runCv.read() > 0.2;
      if (!high) return;
    }
    this.advance(time);
    this.clock.setInterval(this.stepInterval());
  }

  private advance(time: number) {
    this.step = (this.step + 1) % 8;
    this.playStep(time);
  }

  private playStep(time: number) {
    const pitch = this.num(`pitch_${this.step + 1}`, 0);
    setAt(this.seqPitch.offset, pitch, time);
    setAt(this.pitchOut.offset, pitch / 5, time);
    const vel = this.stepVelocity();
    setAt(this.velocityOut.offset, vel, time);
    this.fireEnvelopes(time, vel);
    pulse(this.triggerPulse.offset, time, 0.005, 1);
    this.emitTrigger(time, vel);
    const step = this.step;
    this.emitAt(time, { step, flash: 1 });
    this.atTime(time + 0.08, () => this.emit({ flash: 0 }));
  }

  // Guard against TRIGGER OUT → ADV/CLOCK IN feedback loops
  private emitting = false;
  private emitTrigger(time: number, vel: number) {
    if (this.emitting) return;
    this.emitting = true;
    try { this.triggerBus.emit(time, vel); } finally { this.emitting = false; }
  }

  private fireEnvelopes(time: number, velocity: number) {
    const vel = this.externalVelocity ? 1 : velocity;
    this.vcoEg.trigger(time, 1);
    this.vcfEg.trigger(time, vel);
    this.vcaEg.trigger(time, vel);
  }

  private setRunning(run: boolean) {
    if (run === this.running) return;
    this.running = run;
    if (run) {
      this.clock.setInterval(this.stepInterval());
      this.clock.start();
    } else {
      this.clock.stop();
    }
    this.emit({ playing: run });
  }

  private updateVcaAttack() {
    const decay = this.num('vca_decay', 500) / 1000;
    // FAST = ~1ms; SLOW = a soft swell that scales with the decay (DFAM's slow attack)
    const slow = this.num('vca_attack_mode', 0) === 1;
    this.vcaEg.attack.value = slow ? Math.min(1.5, Math.max(0.02, decay * 0.35)) : 0.001;
    this.vcaEg.setLinear(false);
  }

  private updateFm() {
    const amt = this.num('fm_amount', 0) / 100;
    const f2 = BASE_FREQ * Math.pow(2, this.num('vco2_frequency', 0));
    // Up to ~4x the carrier frequency of deviation at full - bells and clangs
    smooth(this.fmDepth.gain, amt * amt * f2 * 4, this.ctx);
  }

  event(name: string): void {
    if (!this.started) return;
    const now = this.ctx.currentTime + 0.005;
    if (name === 'trigger') {
      this.fireEnvelopes(now, this.stepVelocity());
      pulse(this.triggerPulse.offset, now, 0.005, 1);
      this.emitTrigger(now, this.stepVelocity());
      this.emit({ flash: 1 });
      this.atTime(now + 0.08, () => this.emit({ flash: 0 }));
    } else if (name === 'advance') {
      this.advance(now);
    }
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    switch (id) {
      case 'vco1_frequency': smooth(this.vco1.frequency, BASE_FREQ * Math.pow(2, n), ctx); break;
      case 'vco2_frequency': smooth(this.vco2.frequency, BASE_FREQ * Math.pow(2, n), ctx); this.updateFm(); break;
      case 'vco1_wave': smooth(this.vco1Tri.gain, n === 1 ? 1 : 0, ctx, 0.003); smooth(this.vco1Sqr.gain, n === 0 ? 0.7 : 0, ctx, 0.003); break;
      case 'vco2_wave': smooth(this.vco2Tri.gain, n === 1 ? 1 : 0, ctx, 0.003); smooth(this.vco2Sqr.gain, n === 0 ? 0.7 : 0, ctx, 0.003); break;
      case 'vco1_eg_amount': smooth(this.vco1EgAmt.gain, (n / 100) * EG_PITCH_RANGE, ctx); break;
      case 'vco2_eg_amount': smooth(this.vco2EgAmt.gain, (n / 100) * EG_PITCH_RANGE, ctx); break;
      case 'fm_amount': this.updateFm(); break;
      case 'hard_sync': this.vco2.sync.value = n === 0 ? 1 : 0; break; // options ['ON','OFF']
      case 'vco_decay': this.vcoEg.decay.value = n / 1000; break;
      case 'seq_pitch_mod': // ['VCO 1&2', 'OFF', 'VCO 2']
        smooth(this.seqToVco1.gain, n === 0 ? 1 : 0, ctx, 0.003);
        smooth(this.seqToVco2.gain, n === 1 ? 0 : 1, ctx, 0.003);
        break;
      case 'vco1_level': smooth(this.vco1Level.gain, Math.pow(n / 100, 1.5), ctx); break;
      case 'vco2_level': smooth(this.vco2Level.gain, Math.pow(n / 100, 1.5), ctx); break;
      case 'noise_level': smooth(this.noiseLevel.gain, Math.pow(n / 100, 1.5), ctx); break;
      case 'vcf_cutoff': smooth(this.vcf.cutoff, n, ctx); break;
      case 'vcf_resonance': smooth(this.vcf.resonance, (n / 100) * 1.05, ctx); break;
      case 'vcf_eg_amount': smooth(this.vcfEgAmt.gain, (n / 100) * EG_CUTOFF_RANGE, ctx); break;
      case 'vcf_mode': this.vcf.setMode(n === 0 ? 'hp24' : 'lp24'); break; // ['HP','LP']
      case 'vcf_decay': this.vcfEg.decay.value = n / 1000; break;
      case 'noise_vcf_mod': smooth(this.noiseVcfMod.gain, (n / 100) * 3, ctx); break;
      case 'vca_decay': this.vcaEg.decay.value = n / 1000; this.updateVcaAttack(); break;
      case 'vca_attack_mode': this.updateVcaAttack(); break;
      case 'volume': smooth(this.volume.gain, Math.pow(n / 100, 2), ctx); break;
      case 'tempo': this.clock.setInterval(this.stepInterval()); break;
      case 'run_stop': this.setRunning(!!value); break;
      default:
        // Live-tweaking the playing step's pitch is audible immediately, like the hardware
        if (id === `pitch_${this.step + 1}`) smooth(this.seqPitch.offset, n, ctx, 0.005);
    }
  }
}
