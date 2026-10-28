// ============================================================================
// Analog Four MKII audio engine
//
// Four preallocated synth voices (one per track, monophonic like the A4's
// default voice allocation):
//
//   OSC 1 (Vco: SAW/TPUL/PULS/TRI + PWM LFO) ─┐
//   SUB 1 (Vco pulse at 1/2, 1/4 or 2/3 f) ───┤
//   OSC 2 + SUB 2 ────────────────────────────┼─► FILTER 1 ─► FILTER 2 ─► VCA ─► PAN ─► VOL ─► dry
//   NOISE (white, with fade envelope) ────────┘   4-pole      2-pole      ▲            │
//                                                 ladder LP   multimode   ENV A        ├─► CHO send
//   ENV F ─► F1 / F2 cutoff (DEP)                 + OVR       (worklet)                ├─► DEL send
//   LFO 1, LFO 2 (worklet) ─► 2 destinations each                                      └─► REV send
//
//   FX track: Wideshift-style chorus (two modulated delay lines), Saturator-
//   style delay (HPF, drive, feedback delay with LPF in the loop, tempo
//   synced in 128th notes) and a Supervoid-style reverb (convolution).
//
// Sequencer: 16 steps per track on the look-ahead Clock (16th notes). Each
// trig applies that step's NOTE and parameter locks at the trig's audio time;
// the next trig without a lock returns the parameter to the track value, as on
// the hardware. Gate length = trig LEN, so sustain/release behave properly.
//
// Worklet budget: 4 voices x (4 Vco + ladder + svf + 2 Env + lfo) = 36 nodes.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Delay, Env, Ladder, Reverb, Vco, createDrive, createNoise, midiToHz, setAt, setDriveAmount, smooth } from '@/lib/audio/dsp';
import {
  LFO_MULTS, NUM_TRACKS, PARAM_BY_KEY, STEPS,
  locksId, notesId, parseLocks, parseNotes, patternId, tid,
  type StepLocks,
} from './params';

// --- value curves (our approximation of the A4's 0-127 encoder scales) -------
export const freq127 = (v: number) => 20 * Math.pow(2, (v / 127) * 10);          // 20 Hz .. 20 kHz
export const time127 = (v: number) => 0.001 * Math.pow(2, (v / 127) * 14);       // 1 ms .. 16 s
const levGain = (v: number) => (v / 100) * 0.42;
const sendGain = (v: number) => Math.pow(v / 127, 2);
const duty = (v: number) => 0.5 + ((v - 64) / 64) * 0.47;
const pwmHz = (v: number) => 0.1 * Math.pow(2, v / 16);

const SUB_RATIO = [0, 0.5, 0.25, 0.25, 2 / 3];
const SUB_PW = [0.5, 0.5, 0.5, 0.25, 1 / 3];
// Waveform → [saw, pulse, tri] gains. TPUL = pulse plus a saw slope on its top.
const WAVE_MIX: [number, number, number][] = [[1, 0, 0], [0.45, 0.7, 0], [0, 0.85, 0], [0, 0, 1.15]];

/** Depth scale per LFO destination (full DEP = 64) */
const DEST_SCALE = [0, 1, 1, 0.45, 0.45, 0.42, 0.42, 0.6, 5, 0.6, 5, 0.6, 0.5, 1];

interface Osc {
  vco: Vco;
  sub: Vco;
  saw: GainNode; pul: GainNode; tri: GainNode;
  subGain: GainNode;
  lev: GainNode;
  pwmLfo: OscillatorNode;
  pwmDepth: GainNode;
}

interface Voice {
  track: number;
  o: [Osc, Osc];
  noise: AudioBufferSourceNode;
  noiseFade: GainNode;
  noiseLev: GainNode;
  mix: GainNode;
  f1: Ladder;
  odComp: GainNode;
  f2: AudioWorkletNode;
  vca: GainNode;
  trem: GainNode;
  pan: StereoPannerNode;
  vol: GainNode;
  cho: GainNode; del: GainNode; rev: GainNode;
  envA: Env;
  envF: Env;
  f1Dep: GainNode;
  f2Dep: GainNode;
  lfo: AudioWorkletNode;
  lfoDepth: GainNode[];   // 1A, 1B, 2A, 2B
  lfoDest: number[];
  note: number;
  locks: StepLocks;
  offAt: number | null;
  liveNote: number | null;
}

export class AnalogFourEngine extends BaseEngine {
  private voices: Voice[] = [];
  private clock!: Clock;
  private running = false;
  private dry!: GainNode;
  private masterSum!: GainNode;
  private mainVol!: GainNode;

  // FX track
  private choIn!: GainNode;
  private choDl: DelayNode[] = [];
  private choFb: GainNode[] = [];
  private choPan: StereoPannerNode[] = [];
  private choLfo!: OscillatorNode;
  private choDepth!: GainNode;
  private choHp!: BiquadFilterNode;
  private choLp!: BiquadFilterNode;
  private choOut!: GainNode;
  private choToDel!: GainNode;
  private choToRev!: GainNode;
  private delIn!: GainNode;
  private delHp!: BiquadFilterNode;
  private delDrive!: WaveShaperNode;
  private delay!: Delay;
  private delOut!: GainNode;
  private delToRev!: GainNode;
  private revIn!: GainNode;
  private revHp!: BiquadFilterNode;
  private reverb!: Reverb;
  private revOut!: GainNode;
  private revTimer: ReturnType<typeof setTimeout> | null = null;

  private lockCache: { src: string; parsed: StepLocks[] }[] = [];
  private noteCache: { src: string; parsed: (number | null)[] }[] = [];

  // --------------------------------------------------------------------------

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    this.masterSum = g(1);
    this.mainVol = g(0.6);
    this.masterSum.connect(this.mainVol).connect(this.out);
    this.dry = g(1);
    this.dry.connect(this.masterSum);

    // --- FX track ---------------------------------------------------------------
    this.revIn = g(1);
    this.revHp = ctx.createBiquadFilter(); this.revHp.type = 'highpass';
    this.reverb = new Reverb(ctx, 2.5);
    this.revOut = g(0.8);
    this.revIn.connect(this.revHp).connect(this.reverb.input);
    this.reverb.output.connect(this.revOut).connect(this.masterSum);

    this.delIn = g(1);
    this.delHp = ctx.createBiquadFilter(); this.delHp.type = 'highpass';
    this.delDrive = createDrive(ctx, 0);
    this.delay = new Delay(ctx, 4);
    this.delOut = g(0.8);
    this.delToRev = g(0);
    this.delIn.connect(this.delHp).connect(this.delDrive).connect(this.delay.input);
    this.delay.output.connect(this.delOut).connect(this.masterSum);
    this.delOut.connect(this.delToRev).connect(this.revIn);

    this.choIn = g(1);
    this.choLfo = ctx.createOscillator(); this.choLfo.type = 'sine'; this.choLfo.frequency.value = 0.6;
    this.choDepth = g(0.003);
    const inv = g(-1);
    this.choLfo.connect(this.choDepth);
    this.choDepth.connect(inv);
    this.choHp = ctx.createBiquadFilter(); this.choHp.type = 'highpass';
    this.choLp = ctx.createBiquadFilter(); this.choLp.type = 'lowpass';
    this.choOut = g(0.8);
    this.choToDel = g(0);
    this.choToRev = g(0);
    for (let i = 0; i < 2; i++) {
      const d = ctx.createDelay(0.1); d.delayTime.value = 0.01;
      const fb = g(0.1);
      const pan = ctx.createStereoPanner(); pan.pan.value = i === 0 ? -0.8 : 0.8;
      this.choIn.connect(d);
      d.connect(fb).connect(d);
      d.connect(pan).connect(this.choHp);
      (i === 0 ? this.choDepth : inv).connect(d.delayTime);
      this.choDl.push(d); this.choFb.push(fb); this.choPan.push(pan);
    }
    this.choLfo.start();
    this.choHp.connect(this.choLp).connect(this.choOut).connect(this.masterSum);
    this.choOut.connect(this.choToDel).connect(this.delIn);
    this.choOut.connect(this.choToRev).connect(this.revIn);

    // --- Voices --------------------------------------------------------------------
    for (let t = 0; t < NUM_TRACKS; t++) this.voices.push(this.buildVoice(t));

    this.clock = new Clock(ctx, (time, tick) => this.onTick(time, tick), this.stepDur());

    this.onDispose(() => {
      this.clock.stop();
      if (this.revTimer) clearTimeout(this.revTimer);
      try { this.choLfo.stop(); } catch { /* */ }
      this.voices.forEach(v => {
        [v.noise, v.o[0].pwmLfo, v.o[1].pwmLfo].forEach(s => { try { s.stop(); } catch { /* */ } });
        [v.o[0].vco.node, v.o[0].sub.node, v.o[1].vco.node, v.o[1].sub.node, v.f1.node, v.f2, v.envA.node, v.envF.node, v.lfo].forEach(n => n.disconnect());
      });
    });

    this.emit({ playing: false, step: -1, steps: { t1: -1, t2: -1, t3: -1, t4: -1 } });
  }

  private buildVoice(track: number): Voice {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const mix = g(1);

    const buildOsc = (): Osc => {
      const vco = new Vco(ctx, 130.81);
      const sub = new Vco(ctx, 65.4);
      const saw = g(1), pul = g(0), tri = g(0), subGain = g(0), lev = g(0);
      vco.saw.connect(saw).connect(lev);
      vco.pulse.connect(pul).connect(lev);
      vco.tri.connect(tri).connect(lev);
      sub.pulse.connect(subGain).connect(lev);
      lev.connect(mix);
      const pwmLfo = ctx.createOscillator();
      pwmLfo.type = 'triangle';
      pwmLfo.frequency.value = 1;
      const pwmDepth = g(0);
      pwmLfo.connect(pwmDepth).connect(vco.pw);
      pwmLfo.start();
      return { vco, sub, saw, pul, tri, subGain, lev, pwmLfo, pwmDepth };
    };
    const o: [Osc, Osc] = [buildOsc(), buildOsc()];

    const noise = createNoise(ctx);
    const noiseFade = g(1);
    const noiseLev = g(0);
    noise.connect(noiseFade).connect(noiseLev).connect(mix);

    const f1 = new Ladder(ctx, 5000);
    f1.setMode('lp24');
    const odComp = g(1);
    const f2 = new AudioWorkletNode(ctx, 'a4-svf', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], parameterData: { cutoff: 20 } });
    const vca = g(0);
    const trem = g(1);
    const pan = ctx.createStereoPanner();
    const vol = g(0.6);
    mix.connect(f1.input);
    f1.output.connect(odComp).connect(f2).connect(vca).connect(trem).connect(pan).connect(vol).connect(this.dry);
    const cho = g(0), del = g(0), rev = g(0);
    vol.connect(cho).connect(this.choIn);
    vol.connect(del).connect(this.delIn);
    vol.connect(rev).connect(this.revIn);

    const envA = new Env(ctx, 'adsr');
    const envF = new Env(ctx, 'adsr');
    envA.output.connect(vca.gain);
    const f1Dep = g(0), f2Dep = g(0);
    envF.output.connect(f1Dep).connect(f1.cutoffCv);
    envF.output.connect(f2Dep).connect(f2.parameters.get('cutoffCv')!);

    const lfo = new AudioWorkletNode(ctx, 'a4-lfo', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    const split = ctx.createChannelSplitter(2);
    lfo.connect(split);
    const lfoDepth = [g(0), g(0), g(0), g(0)];
    split.connect(lfoDepth[0], 0); split.connect(lfoDepth[1], 0);
    split.connect(lfoDepth[2], 1); split.connect(lfoDepth[3], 1);

    return {
      track, o, noise, noiseFade, noiseLev, mix, f1, odComp, f2, vca, trem, pan, vol, cho, del, rev,
      envA, envF, f1Dep, f2Dep, lfo, lfoDepth, lfoDest: [0, 0, 0, 0],
      note: 48, locks: {}, offAt: null, liveNote: null,
    };
  }

  // --------------------------------------------------------------------------
  // Parameter plumbing
  // --------------------------------------------------------------------------

  private bpm() { return this.num('tempo', 120); }
  private stepDur() { return 60 / this.bpm() / 4; }

  /** Effective value of a voice parameter for the current trig (lock or track value) */
  private eff(v: Voice, key: string): number {
    if (key in v.locks) return v.locks[key];
    return this.num(tid(v.track, key), PARAM_BY_KEY[key]?.def ?? 0);
  }

  private set(p: AudioParam, x: number, time?: number) {
    if (time === undefined) smooth(p, x, this.ctx);
    else setAt(p, x, time);
  }

  private oscHz(v: Voice, n: 0 | 1): number {
    const k = `osc${n + 1}_`;
    const tracked = this.eff(v, `${k}track`) >= 0.5;
    const note = (tracked ? v.note : 48) + this.eff(v, `${k}tune`) + this.eff(v, `${k}fine`) / 64;
    return Math.max(1, midiToHz(note) + (this.eff(v, `${k}detune`) / 64) * 5);
  }

  private updatePitch(v: Voice, n: 0 | 1, time?: number) {
    const hz = this.oscHz(v, n);
    const sub = Math.round(this.eff(v, `osc${n + 1}_sub`));
    const o = v.o[n];
    this.set(o.vco.frequency, hz, time);
    this.set(o.sub.frequency, hz * (SUB_RATIO[sub] || 0.5), time);
    this.set(o.sub.pw, SUB_PW[sub] ?? 0.5, time);
    this.set(o.subGain.gain, sub === 0 ? 0 : 0.75, time);
  }

  private updateCutoffs(v: Voice, time?: number) {
    const semis = v.note - 60;
    const c1 = freq127(this.eff(v, 'flt1_freq')) * Math.pow(2, (this.eff(v, 'flt1_track') / 127) * semis / 12);
    const c2 = freq127(this.eff(v, 'flt2_freq')) * Math.pow(2, (this.eff(v, 'flt2_track') / 127) * semis / 12);
    this.set(v.f1.cutoff, Math.min(20000, c1), time);
    this.set(v.f2.parameters.get('cutoff')!, Math.min(20000, c2), time);
  }

  private lfoRate(v: Voice, n: 1 | 2): number {
    const spd = this.eff(v, `lfo${n}_speed`);
    const mul = Number(LFO_MULTS[Math.round(this.eff(v, `lfo${n}_mult`))].replace('K', '000')) || 1;
    return ((spd * mul) / 128) * (this.bpm() / 240);
  }

  private routeLfo(v: Voice, idx: number) {
    const gn = v.lfoDepth[idx];
    gn.disconnect();
    const dest = v.lfoDest[idx];
    const params: AudioParam[] = [];
    switch (dest) {
      case 1: params.push(v.o[0].vco.pitch, v.o[0].sub.pitch); break;
      case 2: params.push(v.o[1].vco.pitch, v.o[1].sub.pitch); break;
      case 3: params.push(v.o[0].vco.pw); break;
      case 4: params.push(v.o[1].vco.pw); break;
      case 5: params.push(v.o[0].lev.gain); break;
      case 6: params.push(v.o[1].lev.gain); break;
      case 7: params.push(v.noiseLev.gain); break;
      case 8: params.push(v.f1.cutoffCv); break;
      case 9: params.push(v.f1.resonance); break;
      case 10: params.push(v.f2.parameters.get('cutoffCv')!); break;
      case 11: params.push(v.f2.parameters.get('resonance')!); break;
      case 12: params.push(v.trem.gain); break;
      case 13: params.push(v.pan.pan); break;
    }
    params.forEach(p => gn.connect(p));
  }

  private depthKey(idx: number) {
    return `lfo${idx < 2 ? 1 : 2}_depth_${idx % 2 === 0 ? 'a' : 'b'}`;
  }

  private applyDepth(v: Voice, idx: number, time?: number) {
    const dep = this.eff(v, this.depthKey(idx));
    this.set(v.lfoDepth[idx].gain, (dep / 64) * (DEST_SCALE[v.lfoDest[idx]] ?? 0), time);
  }

  /** Apply one synth parameter to a voice (now, or at a trig's audio time) */
  private applyParam(v: Voice, key: string, val: number, time?: number) {
    const m = /^osc([12])_(.+)$/.exec(key);
    if (m) {
      const n = (Number(m[1]) - 1) as 0 | 1;
      const o = v.o[n];
      switch (m[2]) {
        case 'tune': case 'fine': case 'detune': case 'track': case 'sub': this.updatePitch(v, n, time); return;
        case 'level': this.set(o.lev.gain, levGain(val), time); return;
        case 'wave': {
          const w = WAVE_MIX[Math.round(val)] ?? WAVE_MIX[0];
          this.set(o.saw.gain, w[0], time); this.set(o.pul.gain, w[1], time); this.set(o.tri.gain, w[2], time);
          return;
        }
        case 'pw': this.set(o.vco.pw, duty(val), time); return;
        case 'pwm_speed': this.set(o.pwmLfo.frequency, pwmHz(val), time); return;
        case 'pwm': this.set(o.pwmDepth.gain, (val / 127) * 0.45, time); return;
      }
      return;
    }
    const lm = /^lfo([12])_(.+)$/.exec(key);
    if (lm) {
      const n = Number(lm[1]) as 1 | 2;
      const P = (name: string) => v.lfo.parameters.get(`${name}${n}`)!;
      switch (lm[2]) {
        case 'speed': case 'mult': this.set(P('rate'), this.lfoRate(v, n), time); return;
        case 'fade': this.set(P('fade'), val, time); return;
        case 'phase': this.set(P('phase'), val / 128, time); return;
        case 'mode': this.set(P('mode'), Math.round(val), time); return;
        case 'wave': this.set(P('wave'), Math.round(val), time); return;
        case 'dest_a': case 'dest_b': {
          const idx = (n - 1) * 2 + (lm[2] === 'dest_a' ? 0 : 1);
          v.lfoDest[idx] = Math.round(val);
          this.routeLfo(v, idx);
          this.applyDepth(v, idx);
          return;
        }
        case 'depth_a': this.applyDepth(v, (n - 1) * 2, time); return;
        case 'depth_b': this.applyDepth(v, (n - 1) * 2 + 1, time); return;
      }
      return;
    }
    const f2 = (name: string) => v.f2.parameters.get(name)!;
    switch (key) {
      case 'noise_level': this.set(v.noiseLev.gain, (val / 127) * 0.6, time); return;
      case 'flt1_freq': case 'flt1_track': case 'flt2_freq': case 'flt2_track': this.updateCutoffs(v, time); return;
      case 'flt1_res': this.set(v.f1.resonance, (val / 127) * 1.08, time); return;
      case 'flt1_overdrive': {
        const a = val / 127;
        this.set(v.f1.drive, 1 + Math.pow(a, 1.5) * 7, time);
        this.set(v.odComp.gain, 1 / (1 + a * 1.2), time);
        return;
      }
      case 'flt1_depth': this.set(v.f1Dep.gain, (val / 64) * 6, time); return;
      case 'flt2_res': this.set(f2('resonance'), val / 127, time); return;
      case 'flt2_type': this.set(f2('mode'), Math.round(val), time); return;
      case 'flt2_depth': this.set(v.f2Dep.gain, (val / 64) * 6, time); return;
      case 'envf_attack': this.set(v.envF.attack, time127(val), time); return;
      case 'envf_decay': this.set(v.envF.decay, time127(val), time); return;
      case 'envf_sustain': this.set(v.envF.sustain, val / 127, time); return;
      case 'envf_release': this.set(v.envF.release, time127(val), time); return;
      case 'amp_attack': this.set(v.envA.attack, time127(val), time); return;
      case 'amp_decay': this.set(v.envA.decay, time127(val), time); return;
      case 'amp_sustain': this.set(v.envA.sustain, val / 127, time); return;
      case 'amp_release': this.set(v.envA.release, time127(val), time); return;
      case 'amp_shape': this.set(v.envA.node.parameters.get('curve')!, Math.round(val), time); return;
      case 'amp_chorus': this.set(v.cho.gain, sendGain(val), time); return;
      case 'amp_delay': this.set(v.del.gain, sendGain(val), time); return;
      case 'amp_reverb': this.set(v.rev.gain, sendGain(val), time); return;
      case 'amp_pan': this.set(v.pan.pan, Math.max(-1, Math.min(1, val / 64)), time); return;
      case 'amp_volume': this.set(v.vol.gain, Math.pow(val / 127, 2) * 0.95, time); return;
    }
  }

  private applyFx(key: string, val: number) {
    const ctx = this.ctx;
    const hz = (x: number) => freq127(x);
    switch (key) {
      case 'cho_pre': this.choDl.forEach(d => smooth(d.delayTime, 0.002 + (val / 127) * 0.025, ctx)); break;
      case 'cho_speed': smooth(this.choLfo.frequency, 0.05 * Math.pow(2, val / 18), ctx); break;
      case 'cho_depth': smooth(this.choDepth.gain, (val / 127) * 0.006, ctx); break;
      case 'cho_width': this.choPan.forEach((p, i) => smooth(p.pan, (i === 0 ? -1 : 1) * (val / 127), ctx)); break;
      case 'cho_fb': this.choFb.forEach(f => smooth(f.gain, (val / 127) * 0.85, ctx)); break;
      case 'cho_hpf': smooth(this.choHp.frequency, hz(val), ctx); break;
      case 'cho_lpf': smooth(this.choLp.frequency, hz(val), ctx); break;
      case 'cho_delay': smooth(this.choToDel.gain, sendGain(val), ctx); break;
      case 'cho_reverb': smooth(this.choToRev.gain, sendGain(val), ctx); break;
      case 'cho_volume': smooth(this.choOut.gain, Math.pow(val / 127, 2) * 1.2, ctx); break;
      case 'del_time': this.updateDelayTime(); break;
      case 'del_fb': smooth(this.delay.feedback.gain, (val / 127) * 0.95, ctx); break;
      case 'del_overdrive': setDriveAmount(this.delDrive, (val / 127) * 0.6); break;
      case 'del_hpf': smooth(this.delHp.frequency, hz(val), ctx); break;
      case 'del_lpf': smooth(this.delay.tone.frequency, hz(val), ctx); break;
      case 'del_reverb': smooth(this.delToRev.gain, sendGain(val), ctx); break;
      case 'del_volume': smooth(this.delOut.gain, Math.pow(val / 127, 2) * 1.2, ctx); break;
      case 'rev_pre': smooth(this.reverb.preDelay, (val / 127) * 0.25, ctx); break;
      case 'rev_decay': {
        // Regenerating the impulse is expensive: wait until the encoder settles
        if (this.revTimer) clearTimeout(this.revTimer);
        this.revTimer = setTimeout(() => { this.revTimer = null; this.reverb.setSize(0.3 * Math.pow(2, (val / 127) * 5)); }, 180);
        break;
      }
      case 'rev_hpf': smooth(this.revHp.frequency, hz(val), ctx); break;
      case 'rev_lpf': smooth(this.reverb.damping, hz(val), ctx); break;
      case 'rev_volume': smooth(this.revOut.gain, Math.pow(val / 127, 2) * 1.3, ctx); break;
    }
  }

  private updateDelayTime() {
    const secs = (this.num('fx_del_time', 24) * (240 / this.bpm())) / 128;
    smooth(this.delay.delay.delayTime, Math.min(3.9, secs), this.ctx, 0.05);
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const tm = /^t([1-4])_(.+)$/.exec(id);
    if (tm) {
      const v = this.voices[Number(tm[1]) - 1];
      const key = tm[2];
      if (!v || !PARAM_BY_KEY[key] || key.startsWith('trig_')) return;
      if (key in v.locks) return; // the playing trig holds a lock for this parameter
      this.applyParam(v, key, n);
      return;
    }
    if (id.startsWith('fx_')) { this.applyFx(id.slice(3), n); return; }
    switch (id) {
      case 'tempo':
        this.clock.setInterval(this.stepDur());
        this.updateDelayTime();
        this.voices.forEach(v => { this.applyParam(v, 'lfo1_speed', 0); this.applyParam(v, 'lfo2_speed', 0); });
        break;
      case 'main_volume': smooth(this.mainVol.gain, Math.pow(n / 127, 2) * 1.6, this.ctx); break;
      case 'play': this.setRunning(!!value); break;
    }
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  private cachedLocks(t: number): StepLocks[] {
    const src = this.str(locksId(t));
    const c = this.lockCache[t];
    if (c && c.src === src) return c.parsed;
    const parsed = parseLocks(src);
    this.lockCache[t] = { src, parsed };
    return parsed;
  }

  private cachedNotes(t: number): (number | null)[] {
    const src = this.str(notesId(t));
    const c = this.noteCache[t];
    if (c && c.src === src) return c.parsed;
    const parsed = parseNotes(src);
    this.noteCache[t] = { src, parsed };
    return parsed;
  }

  private setLocks(v: Voice, locks: StepLocks, time?: number) {
    const prev = v.locks;
    v.locks = locks;
    const keys = new Set([...Object.keys(prev), ...Object.keys(locks)]);
    keys.forEach(k => { if (!k.startsWith('trig_')) this.applyParam(v, k, this.eff(v, k), time); });
  }

  /** Fire a voice: note, locks, envelopes, LFO + noise-fade retrigger */
  private fire(v: Voice, note: number, locks: StepLocks, time: number) {
    this.setLocks(v, locks, time);
    v.note = note;
    this.updatePitch(v, 0, time);
    this.updatePitch(v, 1, time);
    this.updateCutoffs(v, time);
    const vel = this.eff(v, 'trig_vel') / 127;
    v.envA.gate(time, true, vel);
    v.envF.gate(time, true, 1);
    v.lfo.port.postMessage({ type: 'trig', time });
    const fade = this.eff(v, 'noise_fade');
    const p = v.noiseFade.gain;
    p.cancelScheduledValues(time);
    if (fade === 0) p.setValueAtTime(1, time);
    else {
      const tau = 0.02 * Math.pow(2, Math.abs(fade) / 10);
      p.setValueAtTime(fade > 0 ? 1 : 0, time);
      p.setTargetAtTime(fade > 0 ? 0 : 1, time, tau);
    }
  }

  private gateOff(v: Voice, time: number) {
    v.envA.gate(time, false);
    v.envF.gate(time, false);
  }

  private onTick(time: number, tick: number) {
    const step = tick % STEPS;
    const dur = this.stepDur();
    const mutes = this.str('mutes', '0000');
    for (let t = 0; t < NUM_TRACKS; t++) {
      const v = this.voices[t];
      if (v.offAt !== null && v.offAt <= time + 1e-6) { this.gateOff(v, v.offAt); v.offAt = null; }
      const pattern = this.str(patternId(t));
      const on = pattern[step] !== undefined && pattern[step] !== '0';
      if (on && mutes[t] !== '1' && v.liveNote === null) {
        v.offAt = null;
        const note = this.cachedNotes(t)[step] ?? this.num(tid(t, 'trig_note'), 48);
        this.fire(v, note, this.cachedLocks(t)[step] ?? {}, time);
        v.offAt = time + Math.max(0.25, this.eff(v, 'trig_len')) * dur * 0.98;
      }
      if (v.offAt !== null && v.offAt < time + dur - 1e-6) { this.gateOff(v, v.offAt); v.offAt = null; }
    }
    this.emitAt(time, { step, steps: { t1: step, t2: step, t3: step, t4: step } });
  }

  private setRunning(run: boolean) {
    if (run === this.running) return;
    this.running = run;
    if (run) {
      this.clock.setInterval(this.stepDur());
      this.clock.start();
    } else {
      this.clock.stop();
      const now = this.ctx.currentTime;
      this.voices.forEach(v => { if (v.liveNote === null) this.gateOff(v, now); v.offAt = null; });
    }
    this.emit({ playing: run, ...(run ? {} : { step: -1, steps: { t1: -1, t2: -1, t3: -1, t4: -1 } }) });
  }

  // --------------------------------------------------------------------------
  // Live play: the computer keyboard / trig preview plays the selected track
  // --------------------------------------------------------------------------

  private liveVoice(): Voice {
    const t = Math.round(this.num('track', 0));
    return this.voices[t < NUM_TRACKS ? t : 0];
  }

  noteOn(note: number, _velocity = 1): void {
    if (!this.started) return;
    const v = this.liveVoice();
    const now = this.ctx.currentTime + 0.005;
    v.offAt = null;
    v.liveNote = note;
    this.fire(v, note, {}, now);
  }

  noteOff(note: number): void {
    if (!this.started) return;
    this.voices.forEach(v => {
      if (v.liveNote === note) { v.liveNote = null; this.gateOff(v, this.ctx.currentTime + 0.005); }
    });
  }

  event(name: string, payload?: unknown): void {
    if (!this.started) return;
    if (name === 'preview') {
      // Trig key with GRID RECORDING off: audition that step on the selected track
      const step = (payload as { step?: number } | undefined)?.step ?? 0;
      const t = Math.round(this.num('track', 0));
      if (t >= NUM_TRACKS) return;
      const v = this.voices[t];
      const note = this.cachedNotes(t)[step] ?? this.num(tid(t, 'trig_note'), 48);
      v.offAt = null;
      v.liveNote = note;
      this.fire(v, note, this.cachedLocks(t)[step] ?? {}, this.ctx.currentTime + 0.005);
      return;
    }
    if (name === 'preview:up') {
      this.voices.forEach(v => { if (v.liveNote !== null) { v.liveNote = null; this.gateOff(v, this.ctx.currentTime + 0.005); } });
      return;
    }
    if (name === 'pattern' || name === 'bank') {
      this.emit({ msg: name === 'pattern' ? 'PATTERN A01 · one pattern per kit here - use Load preset' : 'BANK A · banks not modelled - use Load preset' });
      this.atTime(this.ctx.currentTime + 2.2, () => this.emit({ msg: '' }));
    }
  }
}

