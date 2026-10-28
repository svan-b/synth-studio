// ============================================================================
// Xone:96 twin - built-in "decks"
//
// The hardware is a mixer: it makes no sound of its own. To make it playable,
// every channel gets a virtual deck that is synthesised here with scheduled
// Web Audio voices, all locked to one master clock (16th-note ticks), in one key
// (A minor: Am7 - Fmaj7 - C - G, one bar each).
//
// TRACK A / TRACK B are complete "records" with a 32-bar arrangement (new
// elements enter every 8 bars, a crash marks each 8-bar phrase, the kick drops
// out for the last two bars) so phrasing and blends can be practised. The other
// sources are single stems (drums, bass, stabs...) for live stem mixing.
//
// Levels are calibrated so a source reads around 0 on the channel meter
// (peaks near +6) with GAIN at 0 dB and the EQ flat (internal 0 dBu = 0.1).
// ============================================================================

import { getNoiseBuffer, midiToHz } from '@/lib/audio/dsp';

export const SOURCE_NAMES = ['TRACK A', 'TRACK B', 'DRUMS', 'BASS', 'STABS', 'PERC', 'PAD', 'VOX LEAD', 'NONE'] as const;
export const SRC = {
  TRACK_A: 0, TRACK_B: 1, DRUMS: 2, BASS: 3, STABS: 4, PERC: 5, PAD: 6, LEAD: 7, NONE: 8,
} as const;

/** Output trim per source (dB) so every deck reads about 0 on the meter, peaks near +6 */
export const SOURCE_TRIM_DB = [-8, -7, -4, -9, -4, -3, -3, 7, 0];

/** Bars of the arrangement cycle for the full tracks */
export const ARRANGEMENT_BARS = 32;

// Am7, Fmaj7, C, G - one bar each
const CHORDS = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 60, 64, 67],
  [55, 59, 62, 67],
];
const ROOTS = [33, 29, 36, 31]; // A1 F1 C2 G1

// Vocal-ish lead: 4-bar phrase, [step within the 64-step phrase, midi, length in steps]
const LEAD: [number, number, number][] = [
  [0, 76, 3], [4, 74, 2], [6, 72, 2], [8, 69, 6], [14, 72, 2],
  [16, 72, 3], [20, 69, 2], [22, 67, 2], [24, 69, 8],
  [32, 72, 3], [36, 74, 2], [38, 76, 2], [40, 79, 6], [46, 76, 2],
  [48, 74, 4], [52, 71, 4], [56, 74, 8],
];

/** Plays one-shot voices into a destination. Nodes free themselves after stop(). */
export class Voices {
  private noise: AudioBuffer;
  constructor(private ctx: AudioContext) {
    this.noise = getNoiseBuffer(ctx);
  }

  private env(dest: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay / 4);
    g.connect(dest);
    return g;
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 2);
    s.stop(t + dur);
    return s;
  }

  private panned(dest: AudioNode, pan: number): AudioNode {
    if (!pan) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  kick(dest: AudioNode, t: number, level = 1) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * level, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.06, 0.11);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.6);
  }

  clap(dest: AudioNode, t: number, level = 1) {
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.1;
    const g = this.ctx.createGain();
    const p = 0.22 * level;
    g.gain.setValueAtTime(0, t);
    [0, 0.011, 0.022].forEach(o => {
      g.gain.setValueAtTime(p, t + o);
      g.gain.setTargetAtTime(p * 0.2, t + o + 0.001, 0.003);
    });
    g.gain.setValueAtTime(p * 0.8, t + 0.03);
    g.gain.setTargetAtTime(0, t + 0.03, 0.05);
    this.noiseSrc(t, 0.35).connect(bp).connect(g).connect(this.panned(dest, 0.05));
  }

  hat(dest: AudioNode, t: number, open = false, level = 1, pan = 0.15) {
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6500 : 8000;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 10000;
    bp.gain.value = 6;
    const g = this.env(this.panned(dest, pan), t, (open ? 0.07 : 0.06) * level, 0.001, open ? 0.28 : 0.045);
    this.noiseSrc(t, open ? 0.5 : 0.12).connect(hp).connect(bp).connect(g);
  }

  rim(dest: AudioNode, t: number, level = 1) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 1700;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 3;
    const g = this.env(this.panned(dest, -0.2), t, 0.22 * level, 0.0005, 0.03);
    o.connect(bp).connect(g);
    o.start(t);
    o.stop(t + 0.1);
  }

  shaker(dest: AudioNode, t: number, level = 1) {
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035 * level, t + 0.012);
    g.gain.setTargetAtTime(0, t + 0.02, 0.02);
    g.connect(this.panned(dest, 0.35));
    this.noiseSrc(t, 0.12).connect(hp).connect(g);
  }

  conga(dest: AudioNode, t: number, freq: number, level = 1, pan = -0.3) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    const g = this.env(this.panned(dest, pan), t, 0.14 * level, 0.001, 0.18);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.4);
  }

  crash(dest: AudioNode, t: number, level = 1) {
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const g = this.env(dest, t, 0.05 * level, 0.002, 1.6);
    this.noiseSrc(t, 2.2).connect(hp).connect(g);
  }

  bass(dest: AudioNode, t: number, note: number, dur: number, opts: { level?: number; cutoff?: number; res?: number; envAmt?: number; wave?: OscillatorType } = {}) {
    const { level = 1, cutoff = 380, res = 4, envAmt = 3, wave = 'sawtooth' } = opts;
    const f = midiToHz(note);
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.value = f;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = res;
    lp.frequency.setValueAtTime(cutoff * envAmt, t);
    lp.frequency.setTargetAtTime(cutoff, t + 0.005, 0.06);
    const g = this.ctx.createGain();
    const peak = 0.12 * level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(peak * 0.7, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + dur, 0.025);
    const subG = this.ctx.createGain();
    subG.gain.value = 0.9;
    o.connect(lp);
    sub.connect(subG).connect(lp);
    lp.connect(g).connect(dest);
    o.start(t); sub.start(t);
    o.stop(t + dur + 0.2); sub.stop(t + dur + 0.2);
  }

  stab(dest: AudioNode, t: number, notes: number[], level = 1) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(3800, t);
    lp.frequency.setTargetAtTime(900, t + 0.01, 0.08);
    const g = this.env(dest, t, 0.05 * level, 0.003, 0.32);
    lp.connect(g);
    notes.forEach((n, i) => {
      [-7, 7].forEach((det, k) => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToHz(n);
        o.detune.value = det;
        const p = this.ctx.createStereoPanner();
        p.pan.value = (k ? 0.4 : -0.4) * (i % 2 ? 1 : -1) * 0.7;
        o.connect(p).connect(lp);
        o.start(t);
        o.stop(t + 0.6);
      });
    });
  }

  pad(dest: AudioNode, t: number, notes: number[], dur: number, level = 1) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.8;
    const g = this.ctx.createGain();
    const peak = 0.038 * level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.35);
    g.gain.setValueAtTime(peak, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.45);
    lp.connect(g).connect(dest);
    notes.forEach((n, i) => {
      (['sawtooth', 'triangle'] as OscillatorType[]).forEach((type, k) => {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = midiToHz(n);
        o.detune.value = k ? -9 : 9;
        const p = this.ctx.createStereoPanner();
        p.pan.value = ((i % 2 ? 1 : -1) * (k ? 0.6 : 0.3));
        o.connect(p).connect(lp);
        o.start(t);
        o.stop(t + dur + 0.6);
      });
    });
  }

  /** Saw through vowel formants with vibrato: a sung "aah" */
  lead(dest: AudioNode, t: number, note: number, dur: number, level = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiToHz(note);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(12, t + Math.min(0.35, dur));
    vib.connect(vibAmt).connect(o.detune);
    const sum = ctx.createGain();
    const g = ctx.createGain();
    const peak = 0.2 * level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.setValueAtTime(peak, t + Math.max(0.05, dur - 0.05));
    g.gain.setTargetAtTime(0, t + dur, 0.06);
    // "ah" formants: F1 ~ 750 Hz, F2 ~ 1200 Hz, F3 ~ 2600 Hz
    ([[750, 7, 1], [1200, 9, 0.6], [2600, 12, 0.25]] as const).forEach(([f, q, a]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const ga = ctx.createGain();
      ga.gain.value = a;
      o.connect(bp).connect(ga).connect(sum);
    });
    sum.connect(g).connect(this.panned(dest, 0.1));
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.4); vib.stop(t + dur + 0.4);
  }
}

/**
 * Schedule one 16th-note step of a source.
 * `tick` counts 16ths since PLAY, `dur16` is the length of a 16th in seconds.
 */
export function playStep(v: Voices, src: number, dest: AudioNode, time: number, tick: number, dur16: number) {
  const step = tick % 16;
  const bar = Math.floor(tick / 16);
  const arrBar = bar % ARRANGEMENT_BARS;
  const chordIdx = bar % 4;
  const chord = CHORDS[chordIdx];
  const root = ROOTS[chordIdx];
  const beat = step % 4 === 0;
  const phraseStart = step === 0 && arrBar % 8 === 0;

  switch (src) {
    case SRC.TRACK_A: {
      // Deep house: 4/4 kick, offbeat open hat, rolling chord-following bass, dub stabs
      const kickOn = arrBar < 30;
      if (beat && kickOn) v.kick(dest, time);
      if (phraseStart) v.crash(dest, time);
      if (step % 4 === 2) v.hat(dest, time, true, arrBar >= 4 ? 1 : 0.6);
      if (arrBar >= 8 && step % 2 === 1) v.hat(dest, time, false, 0.45, -0.15);
      if (arrBar >= 8 && (step === 4 || step === 12)) v.clap(dest, time, 0.8);
      if (arrBar >= 8 && arrBar < 30) {
        const pat: Record<number, [number, number]> = { 2: [0, 1.6], 6: [0, 1.6], 7: [12, 0.6], 10: [0, 1.6], 13: [7, 0.8], 14: [0, 1.5] };
        const p = pat[step];
        if (p) v.bass(dest, time, root + p[0], dur16 * p[1], { cutoff: 420, envAmt: 2.5 });
      }
      if (arrBar >= 16 && (step === 3 || step === 10) && bar % 2 === 0) v.stab(dest, time, chord, 0.9);
      break;
    }
    case SRC.TRACK_B: {
      // Tech groove: 4/4 kick, 16th hats with offbeat accent, rim, acid-style bass on A
      const kickOn = arrBar < 30;
      if (beat && kickOn) v.kick(dest, time, 1.05);
      if (phraseStart) v.crash(dest, time, 0.9);
      if (step === 3 || step === 11 || step === 14) v.rim(dest, time, 0.8);
      if (arrBar >= 4) v.hat(dest, time, false, step % 4 === 2 ? 1 : 0.4, 0.2);
      if (arrBar >= 16 && (step === 4 || step === 12)) v.clap(dest, time, 0.9);
      if (arrBar >= 8 && arrBar < 30) {
        const bRoot = 33; // A pedal: sits under every chord of the progression
        const pat: Record<number, number> = { 0: 0, 2: 12, 3: 0, 6: 3, 8: 0, 10: 12, 11: 10, 14: 7 };
        const n = pat[step];
        if (n !== undefined) v.bass(dest, time, bRoot + n, dur16 * 0.8, { cutoff: 300 + 150 * (arrBar % 8) / 8, res: 9, envAmt: 5, wave: 'square', level: 0.75 });
      }
      break;
    }
    case SRC.DRUMS:
      if (beat) v.kick(dest, time);
      if (step === 4 || step === 12) v.clap(dest, time);
      if (step % 4 === 2) v.hat(dest, time, true);
      else if (step % 2 === 1) v.hat(dest, time, false, 0.5);
      break;
    case SRC.BASS: {
      const pat: Record<number, [number, number]> = { 2: [0, 1.6], 6: [0, 1.6], 7: [12, 0.6], 10: [0, 1.6], 13: [7, 0.8], 14: [0, 1.5] };
      const p = pat[step];
      if (p) v.bass(dest, time, root + p[0], dur16 * p[1], { cutoff: 420, envAmt: 2.5, level: 1.2 });
      break;
    }
    case SRC.STABS:
      if (step === 3 || step === 10) v.stab(dest, time, chord, 1.6);
      break;
    case SRC.PERC:
      v.shaker(dest, time, step % 4 === 2 ? 1.6 : 0.9);
      if (step === 6 || step === 14) v.rim(dest, time, 0.8);
      if (step === 3) v.conga(dest, time, 220, 1.2, -0.3);
      if (step === 9 || step === 11) v.conga(dest, time, 330, 1, 0.3);
      break;
    case SRC.PAD:
      if (step === 0) v.pad(dest, time, chord, dur16 * 16, 1.7);
      break;
    case SRC.LEAD: {
      const pos = tick % 64;
      LEAD.forEach(([s, n, len]) => { if (s === pos) v.lead(dest, time, n, dur16 * len * 0.95, 0.9); });
      break;
    }
  }
}
