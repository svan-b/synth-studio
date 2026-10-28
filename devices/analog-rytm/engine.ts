// ============================================================================
// Analog Rytm MKII audio engine
//
//  per hit (native nodes, garbage-collected after the hit):
//    MACHINE (oscillators / noise / envelopes) ─► OVERDRIVE ─► MULTIMODE FILTER
//      (ADSR on detune) ─► AMP ENVELOPE (A-H-D) ─► CHOKE ─┐
//  per track (persistent):                                ▼
//    LFO VOL ─► PAN ─► VOLUME ─┬──────────────► DRY BUS ──┐
//                              ├─ DEL send ─► DELAY ──────┤ (pre/post dist)
//                              └─ REV send ─► REVERB ─────┤
//  FX track (master):        DISTORTION ─► COMPRESSOR (parallel MIX) ─► MAIN VOLUME
//
// 8 analog voices, 12 tracks: each voice is monophonic, so a new hit chokes the
// previous one on the same voice - which is why the open hat is cut off by the
// closed hat (they share voice 7), exactly like the hardware.
//
// Machines are classic analog-style models, not circuit emulations:
//   BD  sine/asym-sine/triangle VCO, exponential pitch sweep, hold + decay, noise snap
//   SD  two detuned triangle "drum heads" + high-passed noise "wires" + snap
//   RS  two sines through an asymmetric clipper + noise tick
//   CP  band-passed noise, NUM bursts at RATE (with RANDOM jitter) + tail
//   BT/LT/MT/HT  sine with pitch sweep + low-passed noise
//   CH/OH  six detuned square oscillators (808 ratios) + noise, band/high-passed
//   CY  six squares into two bands (TONE balances) + noise
//   CB  two detuned squares through a band-pass, two-stage envelope
// Sequencer: Clock look-ahead, 16 steps, swing on every second 16th, accents.
// Not modelled: sample layer (SMPL), p-locks, scenes/performance macros,
// LFO fade/phase/trig modes, compressor sidechain EQ.
// ============================================================================

import type { ControlValue } from '@/types';
import { BaseEngine, Clock } from '@/lib/audio/engine';
import { Reverb, getNoiseBuffer, smooth } from '@/lib/audio/dsp';
import {
  COMP_ATTACKS, COMP_RATIO_N, COMP_RELEASE_S, LFO_MULTS, SHARED_PAIRS, TRACKS,
} from './params';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 0..127 → exponential lo..hi */
const expMap = (v: number, lo: number, hi: number) => lo * Math.pow(hi / lo, clamp(v / 127, 0, 1));
const semis = (s: number) => Math.pow(2, s / 12);
const TRACK_INDEX: Record<string, number> = Object.fromEntries(TRACKS.map((t, i) => [t.id, i]));
const XT_BASE: Record<string, number> = { lt: 82, mt: 122, ht: 178 };
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];
const CY_FREQS = [263, 400, 421, 474, 587, 845];

interface MachineOut {
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  tune: AudioParam[];
  end: number;
}

interface Hit {
  start: number;
  end: number;
  choke: GainNode;
  sources: AudioScheduledSourceNode[];
}

interface TrackBus {
  input: GainNode;
  lfoVol: GainNode;
  panner: StereoPannerNode;
  vol: GainNode;
  del: GainNode;
  rev: GainNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  lfoDest: number;
}

export class AnalogRytmEngine extends BaseEngine {
  private tracks: TrackBus[] = [];
  private voices: (Hit | null)[] = Array(8).fill(null);
  private mutes = new Set<number>();
  private leds: Record<string, number> = {};
  private clock!: Clock;
  private driveCurves = new Map<number, Float32Array<ArrayBuffer>>();
  private symCurves = new Map<number, Float32Array<ArrayBuffer>>();
  private asinWave!: PeriodicWave;

  // master section
  private dryBus!: GainNode;
  private delIn!: GainNode;
  private delL!: DelayNode; private delR!: DelayNode;
  private hpL!: BiquadFilterNode; private lpL!: BiquadFilterNode;
  private hpR!: BiquadFilterNode; private lpR!: BiquadFilterNode;
  private fbSelf!: GainNode; private fbCross!: GainNode; private fbBack!: GainNode;
  private outLL!: GainNode; private outLR!: GainNode; private outRL!: GainNode; private outRR!: GainNode;
  private delVol!: GainNode; private delPre!: GainNode; private delPost!: GainNode; private delToRev!: GainNode;
  private revIn!: GainNode;
  private reverb!: Reverb;
  private revHp!: BiquadFilterNode; private revLp!: BiquadFilterNode; private revShelf!: BiquadFilterNode;
  private revVol!: GainNode; private revPre!: GainNode; private revPost!: GainNode;
  private dist!: WaveShaperNode; private distComp!: GainNode;
  private comp!: DynamicsCompressorNode; private makeup!: GainNode;
  private compWet!: GainNode; private compDry!: GainNode; private compVol!: GainNode;
  private mainVol!: GainNode;
  private reverbTimer: ReturnType<typeof setTimeout> | null = null;

  protected build(): void {
    const ctx = this.ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const biq = (type: BiquadFilterType, f: number, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

    this.asinWave = ctx.createPeriodicWave(new Float32Array([0, 0, 0.32, 0, 0.06]), new Float32Array([0, 1, 0, 0.1, 0]));

    // --- Output chain ---------------------------------------------------------
    this.mainVol = g(1);
    this.mainVol.connect(this.out);
    this.compVol = g(1);
    this.compVol.connect(this.mainVol);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.knee.value = 2;
    this.makeup = g(1);
    this.compWet = g(1);
    this.compDry = g(0);
    const postDist = g(1);
    postDist.connect(this.comp).connect(this.makeup).connect(this.compWet).connect(this.compVol);
    postDist.connect(this.compDry).connect(this.compVol);

    this.dist = ctx.createWaveShaper();
    this.distComp = g(1);
    const preDist = g(1);
    preDist.connect(this.dist).connect(this.distComp).connect(postDist);

    this.dryBus = g(1);
    this.dryBus.connect(preDist);

    // --- Delay (stereo, optional ping-pong, filters in the feedback loop) -------
    this.delIn = g(1);
    this.delL = ctx.createDelay(4);
    this.delR = ctx.createDelay(4);
    this.hpL = biq('highpass', 100); this.lpL = biq('lowpass', 8000);
    this.hpR = biq('highpass', 100); this.lpR = biq('lowpass', 8000);
    this.fbSelf = g(0); this.fbCross = g(0); this.fbBack = g(0);
    this.delIn.connect(this.delL);
    this.delL.connect(this.hpL).connect(this.lpL);
    this.delR.connect(this.hpR).connect(this.lpR);
    this.lpL.connect(this.fbSelf).connect(this.delL);
    this.lpL.connect(this.fbCross).connect(this.delR);
    this.lpR.connect(this.fbBack).connect(this.delL);
    const merger = ctx.createChannelMerger(2);
    this.outLL = g(1); this.outLR = g(1); this.outRL = g(0); this.outRR = g(0);
    this.lpL.connect(this.outLL).connect(merger, 0, 0);
    this.lpL.connect(this.outLR).connect(merger, 0, 1);
    this.lpR.connect(this.outRL).connect(merger, 0, 0);
    this.lpR.connect(this.outRR).connect(merger, 0, 1);
    this.delVol = g(1);
    this.delPre = g(1); this.delPost = g(0);
    this.delToRev = g(0);
    merger.connect(this.delVol);
    this.delVol.connect(this.delPre).connect(preDist);
    this.delVol.connect(this.delPost).connect(postDist);

    // --- Reverb ---------------------------------------------------------------------
    this.revIn = g(1);
    this.reverb = new Reverb(ctx, 2);
    this.revHp = biq('highpass', 200);
    this.revLp = biq('lowpass', 10000);
    this.revShelf = biq('highshelf', 4000);
    this.revVol = g(1);
    this.revPre = g(0); this.revPost = g(1);
    this.revIn.connect(this.reverb.input);
    this.reverb.output.connect(this.revHp).connect(this.revLp).connect(this.revShelf).connect(this.revVol);
    this.revVol.connect(this.revPre).connect(preDist);
    this.revVol.connect(this.revPost).connect(postDist);
    merger.connect(this.delToRev).connect(this.revIn);

    // --- Tracks -----------------------------------------------------------------------
    this.tracks = TRACKS.map(() => {
      const input = g(1);
      const lfoVol = g(1);
      const panner = ctx.createStereoPanner();
      const vol = g(0.6);
      const del = g(0);
      const rev = g(0);
      input.connect(lfoVol).connect(panner).connect(vol).connect(this.dryBus);
      vol.connect(del).connect(this.delIn);
      vol.connect(rev).connect(this.revIn);
      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = 0.5;
      const lfoDepth = g(0);
      lfo.connect(lfoDepth);
      lfo.start();
      return { input, lfoVol, panner, vol, del, rev, lfo, lfoDepth, lfoDest: 0 };
    });

    // --- Sequencer -------------------------------------------------------------------
    this.clock = new Clock(ctx, (time, tick) => this.onTick(time, tick), this.stepDur());

    this.onDispose(() => {
      this.clock.stop();
      if (this.reverbTimer) clearTimeout(this.reverbTimer);
      this.tracks.forEach(t => { try { t.lfo.stop(); } catch { /* */ } });
      this.voices.forEach(v => v?.sources.forEach(s => { try { s.stop(); } catch { /* */ } }));
    });

    this.emit({ playing: false, step: -1, leds: {}, mutes: {} });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private p(track: string, key: string, fallback = 0): number {
    return this.num(`${track}_${key}`, fallback);
  }

  private stepDur(): number {
    return 60 / clamp(this.num('bpm', 120), 30, 300) / 4;
  }

  private gain(v = 1): GainNode {
    const n = this.ctx.createGain();
    n.gain.value = v;
    return n;
  }

  private filter(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = Math.min(f, this.ctx.sampleRate * 0.45);
    b.Q.value = q;
    return b;
  }

  private osc(type: OscillatorType | 'asin', freq: number, t: number, srcs: AudioScheduledSourceNode[]): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (type === 'asin') o.setPeriodicWave(this.asinWave);
    else o.type = type;
    o.frequency.value = freq;
    o.start(t);
    srcs.push(o);
    return o;
  }

  private noise(t: number, srcs: AudioScheduledSourceNode[]): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = getNoiseBuffer(this.ctx);
    s.loop = true;
    s.start(t, Math.random() * 2);
    srcs.push(s);
    return s;
  }

  /** Attack / hold / exponential decay on a gain. Returns the time the sound is effectively silent. */
  private env(param: AudioParam, t: number, peak: number, attack: number, hold: number, decay: number): number {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) param.setValueAtTime(peak, t + attack + hold);
    param.setTargetAtTime(0, t + attack + hold, decay / 5);
    return t + attack + hold + decay * 1.1;
  }

  /** Pitch sweep: start at `from`, fall exponentially to `to` with time constant `tau` */
  private sweep(param: AudioParam, t: number, from: number, to: number, tau: number) {
    param.setValueAtTime(from, t);
    param.setTargetAtTime(to, t, Math.max(0.0005, tau));
  }

  private driveCurve(amount: number): Float32Array<ArrayBuffer> {
    const key = Math.round(amount);
    let c = this.driveCurves.get(key);
    if (!c) {
      const k = 1 + (key / 127) * 18;
      c = new Float32Array(512);
      for (let i = 0; i < c.length; i++) {
        const x = (i / (c.length - 1)) * 2 - 1;
        c[i] = Math.tanh(k * x) / Math.tanh(k);
      }
      this.driveCurves.set(key, c);
    }
    return c;
  }

  /** Asymmetric clipper (rim shot SYM, master DIST SYM) */
  private asymCurve(drive: number, asym: number): Float32Array<ArrayBuffer> {
    const key = Math.round(drive) * 1000 + Math.round(asym + 64);
    let c = this.symCurves.get(key);
    if (!c) {
      const k = 1 + (drive / 127) * 12;
      const a = (asym / 64) * 0.6;
      c = new Float32Array(1024);
      let peak = 0;
      for (let i = 0; i < c.length; i++) {
        const x = (i / (c.length - 1)) * 2 - 1;
        c[i] = Math.tanh(k * (x + a)) - Math.tanh(k * a);
        peak = Math.max(peak, Math.abs(c[i]));
      }
      for (let i = 0; i < c.length; i++) c[i] /= peak || 1;
      this.symCurves.set(key, c);
    }
    return c;
  }

  // --------------------------------------------------------------------------
  // Machines - each returns its output gain (level already applied)
  // --------------------------------------------------------------------------

  private machine(ti: number, t: number, vel: number): MachineOut {
    const tr = TRACKS[ti];
    const id = tr.id;
    const ctx = this.ctx;
    const srcs: AudioScheduledSourceNode[] = [];
    const tune: AudioParam[] = [];
    const v = vel / 127;
    const lev = Math.pow(this.p(id, 'level', 100) / 127, 1.5) * (0.25 + 0.75 * v * v);
    const out = this.gain(lev);
    const pitch = this.p(id, 'tune') + this.p(id, 'note');
    let end = t + 0.5;

    switch (tr.machine) {
      case 'BD HARD': {
        const f0 = 50 * semis(pitch);
        const wave = Math.round(this.p(id, 'wave'));
        const o = this.osc(wave === 1 ? 'asin' : wave === 2 ? 'triangle' : 'sine', f0, t, srcs);
        tune.push(o.detune);
        const depth = (this.p(id, 'sweep_depth', 70) / 127) * 4.5;
        this.sweep(o.frequency, t, f0 * Math.pow(2, depth), f0, expMap(this.p(id, 'sweep_time', 40), 0.003, 0.2));
        const body = this.gain(0);
        const hold = (this.p(id, 'hold', 10) / 127) * 0.45;
        end = this.env(body.gain, t, 1.1, 0.0008, hold, expMap(this.p(id, 'decay', 50), 0.04, 4));
        o.connect(body).connect(out);
        // SNAP: a short high-passed noise click on the transient
        const snap = (this.p(id, 'snap', 40) / 127) * (0.35 + 0.65 * v);
        if (snap > 0.01) {
          const n = this.noise(t, srcs);
          const hp = this.filter('highpass', 2200);
          const sg = this.gain(0);
          this.env(sg.gain, t, snap * 0.9, 0.0003, 0, 0.007);
          n.connect(hp).connect(sg).connect(out);
        }
        break;
      }

      case 'SD CLASSIC': {
        const f1 = 178 * semis(pitch);
        const f2 = f1 * (1.3 + (this.p(id, 'detune', 50) / 127) * 0.9);
        const snap = (this.p(id, 'snap', 60) / 127) * (0.35 + 0.65 * v);
        const bal = this.p(id, 'balance', 50) / 127;
        const toneDec = expMap(this.p(id, 'decay', 35), 0.03, 0.9);
        [[f1, 1 - bal * 0.8], [f2, 0.2 + bal * 0.8]].forEach(([f, lv], k) => {
          const o = this.osc('triangle', f, t, srcs);
          tune.push(o.detune);
          this.sweep(o.frequency, t, f * (1 + 0.5 * snap), f, 0.01);
          const og = this.gain(0);
          this.env(og.gain, t, 0.55 * lv, 0.0008, 0, toneDec * (k ? 0.7 : 1));
          o.connect(og).connect(out);
        });
        const n = this.noise(t, srcs);
        const hp = this.filter('highpass', 1100);
        const lp = this.filter('lowpass', 9500);
        const ng = this.gain(0);
        const nDec = expMap(this.p(id, 'noise_decay', 50), 0.04, 1.3);
        const nEnd = this.env(ng.gain, t, (this.p(id, 'noise_level', 85) / 127) * 0.6, 0.0008, 0, nDec);
        n.connect(hp).connect(lp).connect(ng).connect(out);
        if (snap > 0.01) {
          const shp = this.filter('highpass', 3800);
          const sg = this.gain(0);
          this.env(sg.gain, t, snap * 0.8, 0.0003, 0, 0.014);
          n.connect(shp).connect(sg).connect(out);
        }
        end = Math.max(t + toneDec * 1.1, nEnd);
        break;
      }

      case 'RS CLASSIC': {
        const f1 = 460 * semis(pitch);
        const f2 = 1650 * semis(this.p(id, 'tune2') + this.p(id, 'note'));
        const bal = this.p(id, 'balance', 64) / 127;
        const mix = this.gain(1);
        [[f1, 1 - bal], [f2, bal]].forEach(([f, lv]) => {
          const o = this.osc('sine', f, t, srcs);
          tune.push(o.detune);
          const og = this.gain(lv * 1.6);
          o.connect(og).connect(mix);
        });
        const ws = ctx.createWaveShaper();
        ws.curve = this.asymCurve(40 + this.p(id, 'symmetry', 40) * 0.6, this.p(id, 'symmetry', 40) / 2);
        const eg = this.gain(0);
        end = this.env(eg.gain, t, 0.55, 0.0005, 0, expMap(this.p(id, 'decay', 30), 0.008, 0.4));
        mix.connect(eg).connect(ws).connect(out);
        const n = this.noise(t, srcs);
        const hp = this.filter('highpass', 3000);
        const ng = this.gain(0);
        this.env(ng.gain, t, (this.p(id, 'noise_level', 30) / 127) * 0.5, 0.0004, 0, 0.03);
        n.connect(hp).connect(ng).connect(out);
        const tg = this.gain(0);
        this.env(tg.gain, t, (this.p(id, 'tick', 50) / 127) * 0.9, 0.0002, 0, 0.002);
        n.connect(tg).connect(out);
        break;
      }

      case 'CP CLASSIC': {
        const n = this.noise(t, srcs);
        const bp = this.filter('bandpass', 750 * Math.pow(2, (this.p(id, 'tone', 64) / 127) * 2.4) * semis(this.p(id, 'note')), 1.6);
        const hp = this.filter('highpass', 400);
        n.connect(hp).connect(bp);
        const bursts = this.gain(0);
        const tail = this.gain(0);
        bp.connect(bursts).connect(out);
        bp.connect(tail).connect(out);
        const count = 1 + Math.round(this.p(id, 'number', 3));
        const spacing = expMap(this.p(id, 'rate', 50), 0.004, 0.03);
        const rnd = this.p(id, 'random', 20) / 127;
        const cpd = expMap(this.p(id, 'clap_decay', 50), 0.0015, 0.025);
        let tb = t;
        bursts.gain.setValueAtTime(0, t);
        for (let i = 0; i < count; i++) {
          bursts.gain.setValueAtTime(1.6, tb);
          bursts.gain.setTargetAtTime(0, tb + 0.0004, cpd);
          if (i < count - 1) tb += spacing * (1 + (Math.random() - 0.5) * rnd);
        }
        const tailDec = expMap(this.p(id, 'noise_decay', 55), 0.04, 1.4);
        tail.gain.setValueAtTime(0, t);
        tail.gain.setValueAtTime(0, tb);
        tail.gain.linearRampToValueAtTime((this.p(id, 'noise_level', 80) / 127) * 1.2, tb + 0.002);
        tail.gain.setTargetAtTime(0, tb + 0.002, tailDec / 5);
        end = tb + tailDec * 1.1;
        break;
      }

      case 'BT CLASSIC':
      case 'XT CLASSIC': {
        const bt = tr.machine === 'BT CLASSIC';
        const f0 = (bt ? 60 : XT_BASE[id]) * semis(pitch);
        const o = this.osc('sine', f0, t, srcs);
        const o2 = this.osc('triangle', f0, t, srcs);
        tune.push(o.detune, o2.detune);
        const depth = bt ? 0.6 : (this.p(id, 'sweep_depth', 40) / 127) * 2;
        const tau = bt ? 0.03 : expMap(this.p(id, 'sweep_time', 60), 0.01, 0.5) / 3;
        this.sweep(o.frequency, t, f0 * Math.pow(2, depth), f0, tau);
        this.sweep(o2.frequency, t, f0 * Math.pow(2, depth), f0, tau);
        const body = this.gain(0);
        const dec = expMap(this.p(id, 'decay', 60), bt ? 0.05 : 0.06, bt ? 2 : 2.5);
        end = this.env(body.gain, t, 0.9, 0.0008, 0, dec);
        const o2g = this.gain(0.25);
        o.connect(body);
        o2.connect(o2g).connect(body);
        body.connect(out);
        const n = this.noise(t, srcs);
        const lp = this.filter('lowpass', bt ? 1200 : 300 * Math.pow(2, (this.p(id, 'noise_tone', 60) / 127) * 5));
        const ng = this.gain(0);
        this.env(ng.gain, t, (this.p(id, 'noise_level', 25) / 127) * 0.5, 0.0008, 0, Math.min(0.25, dec * 0.4));
        n.connect(lp).connect(ng).connect(out);
        if (bt) {
          const snap = this.p(id, 'snap', 30) / 127;
          const hp = this.filter('highpass', 2500);
          const sg = this.gain(0);
          this.env(sg.gain, t, snap * 0.7, 0.0003, 0, 0.008);
          n.connect(hp).connect(sg).connect(out);
        }
        break;
      }

      case 'CH CLASSIC':
      case 'OH CLASSIC':
      case 'CY CLASSIC': {
        const cy = tr.machine === 'CY CLASSIC';
        const color = this.p(id, 'color', 64) / 127;
        const bank = this.gain(0.22);
        (cy ? CY_FREQS : HAT_FREQS).forEach(f => {
          const o = this.osc('square', f * semis(pitch), t, srcs);
          tune.push(o.detune);
          o.connect(bank);
        });
        const metal = this.gain(1 - color * 0.6);
        bank.connect(metal);
        const n = this.noise(t, srcs);
        const noiseLv = this.gain(color * 0.5);
        n.connect(noiseLv);
        const eg = this.gain(0);
        if (cy) {
          const tone = this.p(id, 'tone', 64) / 127;
          const low = this.filter('bandpass', 3400 * semis(pitch), 1.4);
          const high = this.filter('highpass', 7500);
          const lowG = this.gain(1.4 * (1 - tone));
          const highG = this.gain(1.4 * tone + 0.2);
          metal.connect(low); noiseLv.connect(low);
          metal.connect(high); noiseLv.connect(high);
          low.connect(lowG).connect(eg);
          high.connect(highG).connect(eg);
          end = this.env(eg.gain, t, 2, 0.0008, 0, expMap(this.p(id, 'decay', 70), 0.3, 6));
        } else {
          const bp = this.filter('bandpass', 10000, 0.9);
          const hp = this.filter('highpass', 6000 * Math.pow(2, color * 0.8));
          metal.connect(bp); noiseLv.connect(bp);
          bp.connect(hp).connect(eg);
          const open = tr.machine === 'OH CLASSIC';
          end = this.env(eg.gain, t, 2.2, 0.0005, 0, expMap(this.p(id, 'decay', open ? 62 : 28), open ? 0.08 : 0.01, open ? 3 : 0.6));
        }
        eg.connect(out);
        break;
      }

      case 'CB CLASSIC': {
        const f1 = 540 * semis(pitch);
        const f2 = f1 * (800 / 540) * Math.pow(2, ((this.p(id, 'detune', 64) - 64) / 64) * 0.35);
        const mix = this.gain(0.3);
        [f1, f2].forEach(f => {
          const o = this.osc('square', f, t, srcs);
          tune.push(o.detune);
          o.connect(mix);
        });
        const bp = this.filter('bandpass', 2.2 * f2, 1.3);
        const lp = this.filter('lowpass', 3500);
        const bpg = this.gain(2.2);
        const lpg = this.gain(0.35);
        const eg = this.gain(0);
        mix.connect(bp).connect(bpg).connect(eg);
        mix.connect(lp).connect(lpg).connect(eg);
        const dec = expMap(this.p(id, 'decay', 45), 0.05, 1.5);
        eg.gain.setValueAtTime(0, t);
        eg.gain.linearRampToValueAtTime(1, t + 0.0008);
        eg.gain.setTargetAtTime(0.4, t + 0.0008, 0.006);
        eg.gain.setTargetAtTime(0, t + 0.02, dec / 5);
        end = t + 0.02 + dec * 1.1;
        eg.connect(out);
        break;
      }
    }
    return { out, sources: srcs, tune, end };
  }

  // --------------------------------------------------------------------------
  // A hit: machine ─► overdrive ─► filter ─► amp ─► choke ─► track bus
  // --------------------------------------------------------------------------

  private hit(ti: number, t: number, vel: number): void {
    const tr = TRACKS[ti];
    const id = tr.id;
    const bus = this.tracks[ti];
    const m = this.machine(ti, t, vel);
    let node: AudioNode = m.out;

    // OVERDRIVE (before the filter, as on the hardware)
    const ovr = this.p(id, 'overdrive');
    if (ovr > 0.5) {
      const pre = this.gain(1 + (ovr / 127) * 2);
      const ws = this.ctx.createWaveShaper();
      ws.curve = this.driveCurve(ovr);
      const post = this.gain(1 / (1 + (ovr / 127) * 1.2));
      node.connect(pre).connect(ws).connect(post);
      node = post;
    }

    // MULTIMODE FILTER with its ADSR envelope on detune (cents)
    const type = Math.round(this.p(id, 'flt_type'));
    const res = this.p(id, 'flt_res') / 127;
    const freq = 20 * Math.pow(2, (this.p(id, 'flt_freq', 127) / 127) * 10);
    const fl = this.ctx.createBiquadFilter();
    switch (type) {
      case 0: fl.type = 'lowpass'; fl.Q.value = res * 22; break;          // LP2 (Q in dB)
      case 1: fl.type = 'lowpass'; fl.Q.value = -6 + res * 10; break;     // LP1 (gentler)
      case 2: fl.type = 'bandpass'; fl.Q.value = 0.6 + res * 14; break;   // BP
      case 3: fl.type = 'highpass'; fl.Q.value = -6 + res * 10; break;    // HP1
      case 4: fl.type = 'highpass'; fl.Q.value = res * 22; break;         // HP2
      case 5: fl.type = 'notch'; fl.Q.value = 0.4 + res * 8; break;       // BS
      default: fl.type = 'peaking'; fl.Q.value = 0.8 + res * 8; fl.gain.value = 12; break; // PK
    }
    fl.frequency.value = Math.min(freq, this.ctx.sampleRate * 0.45);
    const envDepth = (this.p(id, 'flt_env') / 64) * 6000;
    if (Math.abs(envDepth) > 1) {
      const atk = this.p(id, 'flt_attack') < 1 ? 0.0005 : expMap(this.p(id, 'flt_attack'), 0.001, 4);
      const dec = expMap(this.p(id, 'flt_decay', 50), 0.004, 5);
      const sus = this.p(id, 'flt_sustain') / 127;
      const rel = expMap(this.p(id, 'flt_release', 40), 0.004, 5);
      const gateEnd = t + Math.max(1, this.p(id, 'length', 1)) * this.stepDur();
      const d = fl.detune;
      d.setValueAtTime(0, t);
      d.linearRampToValueAtTime(envDepth, t + atk);
      d.setTargetAtTime(envDepth * sus, t + atk, dec / 4);
      d.setTargetAtTime(0, Math.max(gateEnd, t + atk + 0.001), rel / 4);
    }
    node.connect(fl);

    // AMP envelope: attack - hold - decay (DEC 127 = infinite)
    const amp = this.gain(0);
    const aAtk = this.p(id, 'amp_attack') < 1 ? 0.0006 : expMap(this.p(id, 'amp_attack'), 0.001, 3);
    const aHold = (this.p(id, 'amp_hold') / 127) * 2;
    const aDecV = this.p(id, 'amp_decay', 127);
    let end = m.end + aAtk;
    if (aDecV >= 127) {
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(1, t + aAtk);
    } else {
      end = Math.min(end, this.env(amp.gain, t, 1, aAtk, aHold, expMap(aDecV, 0.01, 8)));
    }
    const choke = this.gain(1);
    fl.connect(amp).connect(choke).connect(bus.input);

    // LFO to per-hit destinations
    const lfoTargets: AudioParam[] = [];
    if (bus.lfoDest === 1) lfoTargets.push(...m.tune);
    if (bus.lfoDest === 2) lfoTargets.push(fl.detune);
    lfoTargets.forEach(p => bus.lfoDepth.connect(p));

    end += 0.03;
    m.sources.forEach(s => { try { s.stop(end); } catch { /* */ } });

    // Mono voice: a new hit chokes the previous one on the same analog voice
    const prev = this.voices[tr.voice];
    if (prev && prev.end > t) {
      if (prev.start <= t) this.chokeHit(prev, t);
      else this.chokeHit({ start: t, end, choke, sources: m.sources }, prev.start); // a later hit is already queued
    }
    if (!prev || prev.start <= t) this.voices[tr.voice] = { start: t, end, choke, sources: m.sources };

    this.atTime(end + 0.2, () => {
      lfoTargets.forEach(p => { try { bus.lfoDepth.disconnect(p); } catch { /* */ } });
      try { choke.disconnect(); } catch { /* */ }
    });
  }

  private chokeHit(h: Hit, t: number) {
    h.choke.gain.setValueAtTime(1, t);
    h.choke.gain.linearRampToValueAtTime(0, t + 0.004);
    h.sources.forEach(s => { try { s.stop(t + 0.01); } catch { /* */ } });
    h.end = Math.min(h.end, t + 0.01);
  }

  private flash(ti: number, t: number) {
    const id = TRACKS[ti].id;
    this.atTime(t, () => { this.leds = { ...this.leds, [id]: 1 }; this.emit({ leds: this.leds }); });
    this.atTime(t + 0.09, () => { this.leds = { ...this.leds, [id]: 0 }; this.emit({ leds: this.leds }); });
  }

  // --------------------------------------------------------------------------
  // Sequencer
  // --------------------------------------------------------------------------

  private onTick(time: number, tick: number) {
    const step = tick % 16;
    const dur = this.stepDur();
    this.clock.setInterval(dur);
    const swing = clamp(this.num('swing', 50), 50, 80);
    const t = step % 2 === 1 ? time + ((swing - 50) / 100) * 2 * dur : time;

    const on: boolean[] = TRACKS.map((tr, i) => {
      if (this.mutes.has(i)) return false;
      const c = this.str(`${tr.id}_pattern`)[step];
      return c !== undefined && c !== '0';
    });
    // Shared voices: the right-hand pad of a pair has priority
    SHARED_PAIRS.forEach(([l, r]) => { if (on[l] && on[r]) on[l] = false; });
    on.forEach((trig, i) => {
      if (!trig) return;
      const id = TRACKS[i].id;
      const acc = this.str(`${id}_accent`)[step];
      const vel = acc !== undefined && acc !== '0' ? 127 : clamp(this.p(id, 'velocity', 100), 1, 127);
      this.hit(i, t, vel);
      this.flash(i, t);
    });
    this.atTime(time, () => { if (this.clock.running) this.emit({ step }); });
  }

  private setPlaying(on: boolean) {
    if (on === this.clock.running) return;
    if (on) {
      this.clock.setInterval(this.stepDur());
      this.clock.start();
    } else {
      this.clock.stop();
    }
    this.emit({ playing: on, step: on ? 0 : -1 });
  }

  // --------------------------------------------------------------------------
  // Pads
  // --------------------------------------------------------------------------

  event(name: string): void {
    if (!this.started || !name.startsWith('pad:') || name.endsWith(':up')) return;
    const ti = TRACK_INDEX[name.slice(4)];
    if (ti === undefined) return;
    if (Math.round(this.num('pad_mode')) === 1) {
      // MUTE mode: the pad toggles the track's sequencer mute
      if (this.mutes.has(ti)) this.mutes.delete(ti); else this.mutes.add(ti);
      const mutes: Record<string, boolean> = {};
      this.mutes.forEach(i => { mutes[TRACKS[i].id] = true; });
      this.emit({ mutes });
      return;
    }
    const t = this.ctx.currentTime;
    this.hit(ti, t, clamp(this.p(TRACKS[ti].id, 'velocity', 100), 1, 127));
    this.leds = { ...this.leds, [TRACKS[ti].id]: 1 };
    this.emit({ leds: this.leds });
    this.atTime(t + 0.12, () => { this.leds = { ...this.leds, [TRACKS[ti].id]: 0 }; this.emit({ leds: this.leds }); });
  }

  // --------------------------------------------------------------------------
  // Parameters
  // --------------------------------------------------------------------------

  private updateLfo(ti: number) {
    const id = TRACKS[ti].id;
    const bus = this.tracks[ti];
    const spd = this.p(id, 'lfo_speed', 16);
    const mult = LFO_MULTS[Math.round(this.p(id, 'lfo_mult', 3))] ?? 8;
    const barSec = this.stepDur() * 16;
    const hz = clamp((Math.abs(spd) * mult) / 128 / barSec, 0, 800);
    smooth(bus.lfo.frequency, hz, this.ctx, 0.02);
    const wave = Math.round(this.p(id, 'lfo_wave'));
    bus.lfo.type = (['triangle', 'sine', 'square', 'sawtooth', 'sawtooth'] as OscillatorType[])[wave] ?? 'triangle';
    const dest = Math.round(this.p(id, 'lfo_dest'));
    const sign = (spd < 0 ? -1 : 1) * (wave === 4 ? -1 : 1);
    const dep = (this.p(id, 'lfo_depth') / 64) * sign;
    const scale = [0, 1200, 4800, 1, 0.5][dest] ?? 0;
    smooth(bus.lfoDepth.gain, dep * scale, this.ctx, 0.02);
    if (dest !== bus.lfoDest) {
      // Re-route persistent destinations (PAN, VOL); per-hit ones connect at trigger time
      if (bus.lfoDest === 3) try { bus.lfoDepth.disconnect(bus.panner.pan); } catch { /* */ }
      if (bus.lfoDest === 4) try { bus.lfoDepth.disconnect(bus.lfoVol.gain); } catch { /* */ }
      if (dest === 3) bus.lfoDepth.connect(bus.panner.pan);
      if (dest === 4) bus.lfoDepth.connect(bus.lfoVol.gain);
      bus.lfoDest = dest;
    }
  }

  private updateDelay() {
    const time = clamp((this.num('fx_delay_time', 24) / 128) * this.stepDur() * 16, 0.005, 3.9);
    smooth(this.delL.delayTime, time, this.ctx, 0.05);
    smooth(this.delR.delayTime, time, this.ctx, 0.05);
    const fb = Math.min(0.97, this.num('fx_delay_feedback', 60) / 198);
    const pp = Math.round(this.num('fx_delay_pingpong')) === 1;
    const w = this.num('fx_delay_width', 63) / 63;
    const a = (1 + w) / 2, b = (1 - w) / 2;
    smooth(this.fbSelf.gain, pp ? 0 : fb, this.ctx);
    smooth(this.fbCross.gain, pp ? fb : 0, this.ctx);
    smooth(this.fbBack.gain, pp ? fb : 0, this.ctx);
    smooth(this.outLL.gain, pp ? a : 1, this.ctx);
    smooth(this.outLR.gain, pp ? b : 1, this.ctx);
    smooth(this.outRL.gain, pp ? b : 0, this.ctx);
    smooth(this.outRR.gain, pp ? a : 0, this.ctx);
  }

  private updateDist() {
    const amt = this.num('fx_dist_amount');
    const sym = this.num('fx_dist_symmetry');
    this.dist.curve = amt < 0.5 ? null : this.asymCurve(amt, sym);
    smooth(this.distComp.gain, 1 / (1 + (amt / 127) * 0.8), this.ctx);
  }

  protected onParam(id: string, value: ControlValue): void {
    const n = typeof value === 'number' ? value : value ? 1 : 0;
    const ctx = this.ctx;
    switch (id) {
      case 'play': this.setPlaying(!!value); return;
      case 'bpm':
        this.clock.setInterval(this.stepDur());
        this.tracks.forEach((_, i) => this.updateLfo(i));
        this.updateDelay();
        return;
      case 'main_volume': smooth(this.mainVol.gain, Math.pow(n / 100, 2), ctx); return;
      // --- DELAY
      case 'fx_delay_time': case 'fx_delay_feedback': case 'fx_delay_pingpong': case 'fx_delay_width':
        this.updateDelay(); return;
      case 'fx_delay_hpf': [this.hpL, this.hpR].forEach(f => smooth(f.frequency, expMap(n, 20, 8000), ctx)); return;
      case 'fx_delay_lpf': [this.lpL, this.lpR].forEach(f => smooth(f.frequency, expMap(n, 300, 20000), ctx)); return;
      case 'fx_delay_reverb': smooth(this.delToRev.gain, Math.pow(n / 127, 2), ctx); return;
      case 'fx_delay_volume': smooth(this.delVol.gain, Math.pow(n / 100, 2), ctx); return;
      // --- REVERB
      case 'fx_reverb_predelay': smooth(this.reverb.preDelay, (n / 127) * 0.25, ctx); return;
      case 'fx_reverb_decay':
        if (this.reverbTimer) clearTimeout(this.reverbTimer);
        this.reverbTimer = setTimeout(() => { this.reverbTimer = null; this.reverb.setSize(expMap(this.num('fx_reverb_decay', 50), 0.3, 8)); }, 80);
        return;
      case 'fx_reverb_freq': smooth(this.revShelf.frequency, expMap(n, 500, 16000), ctx); return;
      case 'fx_reverb_gain': smooth(this.revShelf.gain, -24 + (n / 127) * 24, ctx); return;
      case 'fx_reverb_hpf': smooth(this.revHp.frequency, expMap(n, 20, 4000), ctx); return;
      case 'fx_reverb_lpf': smooth(this.revLp.frequency, expMap(n, 400, 20000), ctx); return;
      case 'fx_reverb_volume': smooth(this.revVol.gain, Math.pow(n / 100, 2), ctx); return;
      // --- DISTORTION
      case 'fx_dist_delay': smooth(this.delPre.gain, n ? 0 : 1, ctx); smooth(this.delPost.gain, n ? 1 : 0, ctx); return;
      case 'fx_dist_reverb': smooth(this.revPre.gain, n ? 0 : 1, ctx); smooth(this.revPost.gain, n ? 1 : 0, ctx); return;
      case 'fx_dist_amount': case 'fx_dist_symmetry': this.updateDist(); return;
      // --- COMPRESSOR
      case 'fx_comp_threshold': smooth(this.comp.threshold, -40 + (n / 127) * 40, ctx); return;
      case 'fx_comp_attack': this.comp.attack.value = (COMP_ATTACKS[Math.round(n)] ?? 1) / 1000; return;
      case 'fx_comp_release': this.comp.release.value = COMP_RELEASE_S[Math.round(n)] ?? 0.6; return;
      case 'fx_comp_ratio': this.comp.ratio.value = COMP_RATIO_N[Math.round(n)] ?? 4; return;
      case 'fx_comp_makeup': smooth(this.makeup.gain, Math.pow(10, ((n / 127) * 24) / 20), ctx); return;
      case 'fx_comp_mix': smooth(this.compWet.gain, n / 127, ctx); smooth(this.compDry.gain, 1 - n / 127, ctx); return;
      case 'fx_comp_volume': smooth(this.compVol.gain, Math.pow(n / 100, 2), ctx); return;
    }
    // --- Per-track persistent parameters
    const m = /^([a-z]{2})_(.+)$/.exec(id);
    if (!m) return;
    const ti = TRACK_INDEX[m[1]];
    if (ti === undefined) return;
    const bus = this.tracks[ti];
    switch (m[2]) {
      case 'pan': smooth(bus.panner.pan, clamp(n / 64, -1, 1), ctx); break;
      case 'volume': smooth(bus.vol.gain, 0.6 * Math.pow(n / 100, 2), ctx); break;
      case 'delay_send': smooth(bus.del.gain, Math.pow(n / 127, 2) * 1.2, ctx); break;
      case 'reverb_send': smooth(bus.rev.gain, Math.pow(n / 127, 2) * 1.2, ctx); break;
      case 'lfo_speed': case 'lfo_mult': case 'lfo_wave': case 'lfo_dest': case 'lfo_depth':
        this.updateLfo(ti); break;
    }
  }
}
