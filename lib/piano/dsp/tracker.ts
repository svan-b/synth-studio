/**
 * Hears piano notes in a microphone signal.
 *
 * The method has two parts. A fast detector finds the instant something new
 * is struck (a rise in energy across the spectrum). Then a slower, finer
 * analysis compares the sound just after that instant with the sound just
 * before it, so notes that were already ringing drop out and only the newly
 * struck notes remain. Each candidate note is scored by how much of the new
 * sound its series of harmonics accounts for.
 *
 * When the caller says which notes the music expects, those are checked
 * first. That is far more reliable than transcribing blind, and it is the
 * normal case in lessons and pieces.
 *
 * The app's own metronome reaches the microphone as well, often louder than
 * the piano. Its click is pitched between two piano keys, so it can be
 * recognised, kept from starting an analysis of its own, and left out of
 * the sound a struck note is judged by.
 */

import { FFT, hann } from './fft';

export interface Detected {
  midi: number;
  /** Onset time, on the same clock as the times given to process(). */
  time: number;
  /** Rough loudness from 0 to 1. */
  strength: number;
  /** True when the note was accepted because the music expected it. */
  assisted: boolean;
}

export interface TrackerOptions {
  minMidi?: number;
  maxMidi?: number;
}

export interface TrackerDebug {
  stage: 'fast' | 'slow';
  time: number;
  peaks: number;
  crest: number;
  /** Share of the sound after the onset that was not there before it. */
  novelty: number;
  best: number;
  bestScore: number;
  share: number;
  completeness: number;
  accepted: number[];
  restrike: boolean;
  /** Strongest peaks as "Hz:dB", for tuning. */
  top?: string;
}

const FLUX_N = 512;
const FLUX_HOP = 128;
const WIN = 2048;
const FFT_N = 4096;
/** The analysis window starts just after the strike, so its fade in mutes the hammer thump. */
const POST_OFFSET = 48;
const GUARD = 64;
const RING = 32768;
const F_MAX = 6000;
const F_MIN = 45;
const MAX_PEAKS = 70;
const MAX_NOTES = 6;
const TOL_CENTS = 32;
const H_FULL = 20;
const MIN_GAP_S = 0.05;
const DEDUPE_S = 0.18;
/** Notes the music did not ask for are checked again this much later, to see that they ring on. */
const CONFIRM_S = 0.06;
/** Onsets this close together are one event, such as a chord whose notes land slightly apart. */
const GROUP_GAP_S = 0.1;
const GROUP_MAX_S = 0.3;
/** Share of the new sound that must sit on the click for an onset to count as a click. */
const CLICK_SHARE = 0.65;
/** A click spreads a little beyond the band that is blanked. This allows for the rest. */
const CLICK_SKIRT = 1.25;
/** Semitone distances to the 2nd through 8th harmonics. */
const HARMONIC_STEPS = [12, 19, 24, 28, 31, 34, 36];
const HARMONIC_NUMBER: Record<number, number> = { 12: 2, 19: 3, 24: 4, 28: 5, 31: 6, 34: 7, 36: 8 };

interface Peak {
  f: number;
  a: number;
}

interface NoteScore {
  score: number;
  /** Share of the harmonics a note of this register should show that are present. */
  completeness: number;
  /** Sum of the matched peak values, unweighted. */
  explained: number;
  /** Peak index for each harmonic, or -1. */
  matched: number[];
  f1: number;
  /** Amplitude of the strongest matched partial. */
  maxA: number;
  /** Sum of matched peak amplitudes, uncompressed. */
  loud: number;
}

/** Typical string stiffness of a piano, which stretches the upper harmonics. */
function inharmonicity(midi: number): number {
  return midi >= 36 ? 7e-5 * Math.pow(2, (midi - 36) / 8.5) : 7e-5 * Math.pow(2, (36 - midi) / 12);
}

/** How many harmonics a note in this register reliably shows. High notes have few. */
function expectedHarmonics(midi: number): number {
  if (midi < 54) return 8;
  if (midi < 66) return 6;
  if (midi < 72) return 5;
  if (midi < 78) return 4;
  if (midi < 84) return 3;
  return 2;
}

function lowpassTaps(count: number, cutoff: number): Float32Array {
  const h = new Float32Array(count);
  const mid = (count - 1) / 2;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const x = i - mid;
    const sinc = x === 0 ? 1 : Math.sin(2 * Math.PI * cutoff * x) / (2 * Math.PI * cutoff * x);
    const win = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (count - 1));
    h[i] = 2 * cutoff * sinc * win;
    sum += h[i];
  }
  for (let i = 0; i < count; i++) h[i] /= sum;
  return h;
}

export class PitchTracker {
  /** Notes the music expects next, used to settle close calls. */
  expected: Set<number> | null = null;
  /** How far the piano sits from concert pitch, learned as notes are heard. */
  tuningCents = 0;
  /** Input level of the latest block in dBFS, for a level meter. */
  levelDb = -100;
  /** Ignore anything struck before this time (used while the app itself plays). */
  suppressUntil = -Infinity;
  /**
   * Pitches of the app's own metronome click, which reaches the microphone
   * too. Each sits between two piano keys, where no string sounds, and that
   * is how a click is told from a strike.
   */
  clicks: number[] | null = null;
  /** Optional hook for tests and tuning. */
  debug: ((info: TrackerDebug) => void) | null = null;

  readonly rate: number;
  private readonly decimate: number;
  private readonly taps: Float32Array;
  private tail: Float32Array;
  private phase = 0;

  private readonly ring = new Float32Array(RING);
  private count = 0;
  private blockStartIndex = 0;
  private blockStartTime = 0;

  private readonly fluxFft = new FFT(FLUX_N);
  private readonly fluxWin = hann(FLUX_N);
  private readonly fluxBuf = new Float32Array(FLUX_N);
  private readonly fluxMag = new Float32Array(FLUX_N / 2 + 1);
  private readonly fluxHist: Float32Array[] = [];
  private fluxEnd = FLUX_N;
  private readonly flux: number[] = [];
  private readonly fluxEnds: number[] = [];
  private lastOnsetIndex = -Infinity;
  /** Recent onsets that were strikes, not clicks. */
  private readonly strikes: number[] = [];
  private readonly clickNow = new Float32Array(FLUX_N / 2 + 1);
  private readonly clickWas = new Float32Array(FLUX_N / 2 + 1);
  /** The sound just before the latest click, and where that click began. */
  private readonly clickPre = new Float32Array(FFT_N / 2 + 1);
  private clickPreAt = -Infinity;
  /** Bin ranges, as start and end pairs, that hold a click in the spectrum now being read. */
  private readonly clickBands: number[] = [];

  private readonly fft = new FFT(FFT_N);
  private readonly win = hann(WIN);
  private readonly seg = new Float32Array(WIN);
  private readonly post = new Float32Array(FFT_N / 2 + 1);
  private readonly diff = new Float32Array(FFT_N / 2 + 1);
  private readonly groupPre = new Float32Array(FFT_N / 2 + 1);
  private groupStart = -Infinity;
  private groupLast = -Infinity;

  private jobs: Array<{ onset: number; due: number; click: boolean }> = [];
  private slow: Array<{
    onset: number;
    click: boolean;
    time: number;
    strength: number;
    due: number;
    lateStart: number;
    novelty: number;
    newEnergy: number;
    sameGroup: boolean;
    post: Float32Array;
    pre: Float32Array;
  }> = [];
  private readonly late = new Float32Array(FFT_N / 2 + 1);
  private lastEmit = new Map<number, number>();
  private recent: Array<{ midi: number; time: number; score: number }> = [];
  private readonly minMidi: number;
  private readonly maxMidi: number;

  /** Onset sample indexes found so far, kept for tests and tuning. */
  readonly onsetLog: number[] = [];

  constructor(sampleRate: number, opts: TrackerOptions = {}) {
    this.decimate = sampleRate > 32000 ? 2 : 1;
    this.rate = sampleRate / this.decimate;
    this.taps = lowpassTaps(31, 0.22);
    this.tail = new Float32Array(this.taps.length - 1);
    this.minMidi = opts.minMidi ?? 28;
    this.maxMidi = opts.maxMidi ?? 98;
    for (let i = 0; i < 3; i++) this.fluxHist.push(new Float32Array(FLUX_N / 2 + 1));
  }

  /** Feed a block of samples. `startTime` is the clock time of its first sample. */
  process(samples: Float32Array, startTime: number): Detected[] {
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
    this.levelDb = 10 * Math.log10(sumSq / Math.max(1, samples.length) + 1e-12);

    this.blockStartIndex = this.count;
    this.blockStartTime = startTime;
    this.push(samples);

    const out: Detected[] = [];
    while (this.count >= this.fluxEnd) {
      const found = this.fluxStep(this.fluxEnd);
      if (found !== null) {
        this.onsetLog.push(found.onset);
        // A click waits a little longer, until it is known whether a strike followed it.
        const wait = found.click ? Math.max(POST_OFFSET + WIN, Math.round(GROUP_GAP_S * this.rate) + 5 * FLUX_HOP) : POST_OFFSET + WIN;
        this.jobs.push({ onset: found.onset, due: found.onset + wait, click: found.click });
      }
      this.fluxEnd += FLUX_HOP;
    }
    while (this.jobs.length > 0 && this.jobs[0].due <= this.count) {
      this.analyse(this.jobs.shift()!, out);
    }
    while (this.slow.length > 0 && this.slow[0].due <= this.count) {
      this.analyseSlow(this.slow.shift()!, out);
    }
    return out;
  }

  private timeOfIndex(index: number): number {
    return this.blockStartTime + (index - this.blockStartIndex) / this.rate;
  }

  private push(samples: Float32Array): void {
    if (this.decimate === 1) {
      for (let i = 0; i < samples.length; i++) {
        this.ring[this.count % RING] = samples[i];
        this.count++;
      }
      return;
    }
    const taps = this.taps;
    const tl = this.tail.length;
    const tmp = new Float32Array(tl + samples.length);
    tmp.set(this.tail, 0);
    tmp.set(samples, tl);
    let i = this.phase;
    for (; i < samples.length; i += 2) {
      let acc = 0;
      for (let j = 0; j < taps.length; j++) acc += taps[j] * tmp[i + j];
      this.ring[this.count % RING] = acc;
      this.count++;
    }
    this.phase = i - samples.length;
    this.tail = tmp.slice(tmp.length - tl);
  }

  private read(start: number, dest: Float32Array, window: Float32Array): void {
    for (let i = 0; i < dest.length; i++) {
      const idx = start + i;
      dest[i] = idx < 0 || idx >= this.count ? 0 : this.ring[((idx % RING) + RING) % RING] * window[i];
    }
  }

  // ----------------------------------------------------------------- onsets

  /** One step of the fast onset detector. Returns an onset sample index, or null. */
  private fluxStep(end: number): { onset: number; click: boolean } | null {
    this.read(end - FLUX_N, this.fluxBuf, this.fluxWin);
    this.fluxFft.magnitudes(this.fluxBuf, this.fluxMag);
    const binHz = this.rate / FLUX_N;
    const k0 = Math.max(1, Math.ceil(70 / binHz));
    const k1 = Math.min(FLUX_N / 2, Math.floor(5000 / binHz));
    const cur = this.fluxHist.shift()!;
    const ref = this.fluxHist[0];
    let sum = 0;
    const norm = 4 / FLUX_N;
    for (let k = k0; k <= k1; k++) {
      const y = Math.log(1 + 1500 * this.fluxMag[k] * norm);
      cur[k] = y;
      const d = y - ref[k];
      if (d > 0) sum += d;
    }
    this.fluxHist.push(cur);
    this.flux.push(sum);
    this.fluxEnds.push(end);
    if (this.flux.length > 80) {
      this.flux.shift();
      this.fluxEnds.shift();
    }

    // Decide about the frame two steps back, so we can see both sides of a peak.
    const n = this.flux.length;
    const c = n - 3;
    if (c < 4) return null;
    const v = this.flux[c];
    if (v < this.flux[c - 1] || v < this.flux[c - 2] || v <= this.flux[c + 1] || v <= this.flux[c + 2]) return null;
    // Compare with the recent typical level, leaving out the frames near the peak.
    const recent = this.flux.slice(Math.max(0, c - 44), Math.max(0, c - 3)).sort((a, b) => a - b);
    const median = recent.length > 0 ? recent[Math.floor(recent.length / 2)] : 0;
    const threshold = 4 + 2 * median;
    if (v < threshold) return null;
    const onset = this.fluxEnds[c] - Math.round(FLUX_HOP * 2.5);
    if (onset - this.lastOnsetIndex < MIN_GAP_S * this.rate) return null;
    // The app's own click is not a strike, so it must not hide one that follows it closely.
    const click = this.clicks !== null && this.isClick(onset);
    if (!click) {
      this.lastOnsetIndex = onset;
      this.strikes.push(onset);
      if (this.strikes.length > 8) this.strikes.shift();
    }
    return { onset, click };
  }

  /** Is the sound that begins here the app's own click, and little else? */
  private isClick(onset: number): boolean {
    const clicks = this.clicks;
    if (!clicks) return false;
    // The 23 ms around the onset, against the 23 ms before them.
    const start = onset - FLUX_HOP;
    this.read(start, this.fluxBuf, this.fluxWin);
    this.fluxFft.magnitudes(this.fluxBuf, this.clickNow);
    this.read(start - FLUX_N, this.fluxBuf, this.fluxWin);
    this.fluxFft.magnitudes(this.fluxBuf, this.clickWas);
    const binHz = this.rate / FLUX_N;
    const k0 = Math.max(1, Math.ceil(70 / binHz));
    const k1 = Math.min(FLUX_N / 2 - 1, Math.floor(F_MAX / binHz));
    const rise = this.clickNow;
    let total = 0;
    for (let k = k0; k <= k1; k++) {
      const d = rise[k] - this.clickWas[k];
      rise[k] = d > 0 ? d : 0;
      total += rise[k] * rise[k];
    }
    if (total <= 0) return false;
    for (const fc of clicks) {
      const kc = fc / binHz;
      const lo = Math.max(k0 + 1, Math.round(kc - 3));
      const hi = Math.min(k1 - 1, Math.round(kc + 3));
      let band = 0;
      let kp = lo;
      for (let k = lo; k <= hi; k++) {
        band += rise[k] * rise[k];
        if (rise[k] > rise[kp]) kp = k;
      }
      // Most of what is new sits at the click, and its peak is on the click's pitch.
      if (band < CLICK_SHARE * total) continue;
      const a = rise[kp - 1];
      const b = rise[kp];
      const c = rise[kp + 1];
      const denom = a - 2 * b + c;
      const shift = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom));
      if (Math.abs((kp + shift) * binHz - fc) <= 14) return true;
    }
    return false;
  }

  /**
   * Find the app's click in a spectrum of new sound, so it cannot pass for
   * part of a note or drown a soft one. The bins it covers are noted for the
   * peak finder to pass over. Returns the energy they hold.
   */
  private findClicks(diff: Float32Array): number {
    this.clickBands.length = 0;
    const clicks = this.clicks;
    if (!clicks) return 0;
    const binHz = this.rate / FFT_N;
    const reach = Math.round(45 / binHz);
    const half = Math.round(75 / binHz);
    let energy = 0;
    for (const fc of clicks) {
      const kc = Math.round(fc / binHz);
      if (kc + half >= diff.length - 1 || kc - half < 1) continue;
      let kp = kc;
      for (let k = kc - reach; k <= kc + reach; k++) if (diff[k] > diff[kp]) kp = k;
      const top = diff[kp];
      // A lone bump right on the click's pitch. A string never sounds there.
      if (top < 1.5e-4 || Math.abs(kp - kc) * binHz > 12) continue;
      if (diff[kp - reach] > 0.75 * top || diff[kp + reach] > 0.75 * top) continue;
      for (let k = kp - half; k <= kp + half; k++) energy += diff[k] * diff[k];
      this.clickBands.push(kp - half, kp + half);
    }
    return energy;
  }

  // --------------------------------------------------------------- analysis

  private spectrum(start: number, out: Float32Array): number {
    this.read(start, this.seg, this.win);
    let sumSq = 0;
    for (let i = 0; i < WIN; i++) sumSq += this.seg[i] * this.seg[i];
    this.fft.magnitudes(this.seg, out);
    const norm = 4 / WIN;
    for (let k = 0; k < out.length; k++) out[k] *= norm;
    return Math.sqrt(sumSq / WIN);
  }

  /** Peaks of a spectrum. Bins in `skip` (start and end pairs) are passed over. */
  private findPeaks(spec: Float32Array, skip?: number[]): Peak[] {
    const binHz = this.rate / FFT_N;
    const k0 = Math.max(5, Math.floor(F_MIN / binHz));
    const k1 = Math.min(spec.length - 6, Math.ceil(F_MAX / binHz));
    const skipped = (k: number): boolean => {
      if (!skip) return false;
      for (let i = 0; i < skip.length; i += 2) if (k >= skip[i] && k <= skip[i + 1]) return true;
      return false;
    };
    let max = 0;
    for (let k = k0; k <= k1; k++) if (spec[k] > max && !skipped(k)) max = spec[k];
    const floor = Math.max(max * 0.03, 1.5e-4);
    const peaks: Peak[] = [];
    for (let k = k0; k <= k1; k++) {
      const v = spec[k];
      if (v < floor || skipped(k)) continue;
      if (v <= spec[k - 1] || v < spec[k + 1] || v <= spec[k - 2] || v < spec[k + 2]) continue;
      // Parabolic interpolation on a log scale gives the true peak position.
      const a = Math.log(spec[k - 1] + 1e-12);
      const b = Math.log(v);
      const c = Math.log(spec[k + 1] + 1e-12);
      const denom = a - 2 * b + c;
      const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
      const s = Math.max(-0.5, Math.min(0.5, shift));
      peaks.push({ f: (k + s) * binHz, a: Math.exp(b - 0.25 * (a - c) * s) });
    }
    if (peaks.length > MAX_PEAKS) {
      peaks.sort((p, q) => q.a - p.a);
      peaks.length = MAX_PEAKS;
    }
    peaks.sort((p, q) => p.f - q.f);
    return peaks;
  }

  private nearest(peaks: Peak[], f: number, tolHz: number): number {
    let lo = 0;
    let hi = peaks.length - 1;
    if (hi < 0) return -1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (peaks[mid].f < f) lo = mid + 1;
      else hi = mid;
    }
    let best = -1;
    let bestD = tolHz;
    for (const i of [lo - 1, lo]) {
      if (i < 0 || i >= peaks.length) continue;
      const d = Math.abs(peaks[i].f - f);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private noteFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69 + this.tuningCents / 100) / 12);
  }

  /**
   * How well a note explains the peaks. A note scores by the peak energy its
   * harmonic series accounts for, scaled down when harmonics that should be
   * there are missing. A real string always shows its own lowest harmonics,
   * which is what separates it from a phantom an octave or more below.
   */
  private scoreNote(midi: number, peaks: Peak[], vals: Float32Array): NoteScore {
    const f0 = this.noteFreq(midi);
    const b = inharmonicity(midi);
    const hMax = Math.min(H_FULL, Math.floor(F_MAX / f0));
    const hc = Math.min(hMax, expectedHarmonics(midi));
    const matched: number[] = [];
    const tolRatio = Math.pow(2, TOL_CENTS / 1200) - 1;
    let sum = 0;
    let explained = 0;
    let present = 0;
    let f1 = 0;
    let maxA = 0;
    let loud = 0;
    for (let h = 1; h <= hMax; h++) {
      const target = h * f0 * Math.sqrt(1 + b * h * h);
      const idx = this.nearest(peaks, target, Math.max(target * tolRatio, 3.5));
      matched.push(idx);
      if (idx < 0) continue;
      const w = h <= 8 ? 1 : h <= 14 ? 0.7 : 0.4;
      sum += vals[idx] * w;
      explained += vals[idx];
      loud += peaks[idx].a;
      if (peaks[idx].a > maxA) maxA = peaks[idx].a;
      if (h <= hc) present++;
      if (h === 1) f1 = peaks[idx].f;
    }
    const zero: NoteScore = { score: 0, completeness: 0, explained: 0, matched, f1, maxA: 0, loud: 0 };
    if (hMax < 1 || sum === 0) return zero;
    const amp = (h: number) => (matched[h - 1] >= 0 ? peaks[matched[h - 1]].a : 0);
    // A real string's strongest partial is always one of its first few.
    let strongest = 1;
    for (let h = 2; h <= hMax; h++) if (amp(h) > amp(strongest)) strongest = h;
    if (strongest > (midi < 36 ? 6 : 5)) return zero;
    if (midi >= 39) {
      // From the low tenor up the fundamental is one of the stronger partials.
      // Around the middle of the keyboard it can hide behind a strong second
      // harmonic, and then the second and third must both be there.
      const hasFundamental = amp(1) >= 0.1 * maxA;
      const hasNext = midi <= 72 && hMax >= 3 && amp(1) > 0 && amp(2) >= 0.1 * maxA && amp(3) >= 0.05 * maxA;
      if (!hasFundamental && !hasNext) return zero;
    } else {
      // In the bass the fundamental can be faint, but its neighbours are not,
      // and a low string always shows a long run of harmonics.
      let strong = 0;
      for (let h = 1; h <= Math.min(4, hMax); h++) if (amp(h) >= 0.2 * maxA) strong++;
      if (strong < 2) return zero;
    }
    if (midi < 45) {
      let count = 0;
      for (let h = 1; h <= hMax; h++) if (matched[h - 1] >= 0) count++;
      if (count < 5) return zero;
    }
    const completeness = present / hc;
    return { score: sum * (0.3 + 0.7 * completeness), completeness, explained, matched, f1, maxA, loud };
  }

  /**
   * Does the lower note have harmonics of its own, beyond those it shares
   * with a note `step` semitones above it? A phantom below a real note has
   * none: every peak it claims belongs to the upper note.
   */
  private ownSupport(lower: NoteScore, step: number, peaks: Peak[], vals: Float32Array, lowerMidi = 60): boolean {
    const m = HARMONIC_NUMBER[step];
    if (!m) return true;
    // A bass string has a long series, so look further up it.
    const bass = lowerMidi < 45;
    const limit = Math.min(lower.matched.length, bass ? 12 : Math.max(6, 2 * m));
    let own = 0;
    let shared = 0;
    let ownCount = 0;
    let ownSlots = 0;
    let maxA = 0;
    for (let h = 1; h <= limit; h++) {
      const idx = lower.matched[h - 1];
      if (idx >= 0 && peaks[idx].a > maxA) maxA = peaks[idx].a;
    }
    for (let h = 1; h <= limit; h++) {
      const idx = lower.matched[h - 1];
      const isShared = h % m === 0;
      if (!isShared) ownSlots++;
      if (idx < 0) continue;
      if (isShared) shared += vals[idx];
      else {
        own += vals[idx];
        if (peaks[idx].a >= (bass ? 0.05 : 0.1) * maxA) ownCount++;
      }
    }
    return own >= 0.35 * shared && ownCount >= Math.ceil(0.6 * ownSlots);
  }

  /** The best scoring note, preferring a higher note over a phantom beneath it. */
  private bestNote(peaks: Peak[], vals: Float32Array, skip: (m: number) => boolean): { midi: number; s: NoteScore } | null {
    const scores = new Map<number, NoteScore>();
    let best = -1;
    let bestScore = 0;
    for (let m = this.minMidi; m <= this.maxMidi; m++) {
      if (skip(m)) continue;
      const s = this.scoreNote(m, peaks, vals);
      scores.set(m, s);
      if (s.score > bestScore) {
        best = m;
        bestScore = s.score;
      }
    }
    if (best < 0) return null;
    for (let guard = 0; guard < 3; guard++) {
      const cur = scores.get(best)!;
      let moved = false;
      for (const step of HARMONIC_STEPS) {
        const upper = scores.get(best + step);
        if (!upper || upper.score < 0.5 * cur.score) continue;
        if (!this.ownSupport(cur, step, peaks, vals, best)) {
          best += step;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    return { midi: best, s: scores.get(best)! };
  }

  /**
   * First look, as soon as a short window after the strike is available.
   * Only the notes the music asked for are decided here, so a right note is
   * confirmed quickly. Everything else waits for the second look.
   */
  private analyse(job: { onset: number; click: boolean }, out: Detected[]): void {
    const onset = job.onset;
    const time = this.timeOfIndex(onset);
    const postStart = onset + POST_OFFSET;
    const postRms = this.spectrum(postStart, this.post);

    // Onsets close together are one event. They share the spectrum from just
    // before the event began, so a chord whose notes land a few hundredths
    // of a second apart is still compared with what came before all of it.
    const sameGroup = onset - this.groupLast < GROUP_GAP_S * this.rate && onset - this.groupStart < GROUP_MAX_S * this.rate;
    let pre = this.groupPre;
    // A click on its own begins nothing. One that lands just after a strike
    // is simply part of that strike's moment, and is treated like the rest of it.
    const loneClick = job.click && !sameGroup;
    if (loneClick) {
      // Keep what was sounding just before it, for the strike that often
      // follows a moment later. That strike is heard on its own terms, not from here.
      this.spectrum(onset - GUARD - WIN, this.clickPre);
      this.clickPreAt = onset;
      pre = this.clickPre;
      if (this.struckAfter(onset)) return;
    } else {
      if (!sameGroup) {
        this.spectrum(onset - GUARD - WIN, this.groupPre);
        const since = onset - this.clickPreAt;
        if (since > 0 && since < WIN + GUARD + 0.03 * this.rate && !this.strikes.some((s) => s > this.clickPreAt && s < onset)) {
          // The click is still in that stretch of sound. Where it is, what
          // was there before it began is the truer picture.
          const before = this.clickPre;
          const g = this.groupPre;
          for (let k = 0; k < g.length; k++) if (before[k] < g[k]) g[k] = before[k];
        }
        this.groupStart = onset;
      }
      this.groupLast = onset;
    }
    if (time < this.suppressUntil || postRms < 0.0012) return;

    const diff = this.diff;
    let newEnergy = 0;
    let allEnergy = 0;
    for (let k = 0; k < diff.length; k++) {
      const d = this.post[k] - pre[k];
      diff[k] = d > 0 ? d : 0;
      newEnergy += diff[k] * diff[k];
      allEnergy += this.post[k] * this.post[k];
    }
    if (this.clicks) {
      // A click heard inside this stretch is not part of what was struck.
      const gone = this.findClicks(diff);
      if (gone > 0) {
        allEnergy = Math.max(1e-12, allEnergy - gone);
        newEnergy = Math.max(0, newEnergy - CLICK_SKIRT * gone);
      }
    }
    // A false alarm from the onset detector brings almost nothing new.
    const novelty = allEnergy > 0 ? newEnergy / allEnergy : 0;
    const strength = Math.max(0, Math.min(1, (20 * Math.log10(postRms + 1e-9) + 48) / 42));
    const expected = this.expected;
    const accepted: number[] = [];
    let restrike = false;
    let dbgPeaks = 0;
    let crest = 0;

    if (expected && expected.size > 0) {
      const peaks = this.findPeaks(diff, this.clicks ? this.clickBands : undefined);
      dbgPeaks = peaks.length;
      const vals = new Float32Array(peaks.length);
      let total = 0;
      let loudest = 0;
      for (let i = 0; i < peaks.length; i++) {
        vals[i] = Math.pow(peaks[i].a, 0.6);
        total += vals[i];
        if (peaks[i].a > loudest) loudest = peaks[i].a;
      }
      const top8 = Array.from(vals)
        .sort((a, b) => b - a)
        .slice(0, 8)
        .reduce((a, b) => a + b, 0);
      crest = total > 0 ? top8 / total : 0;
      if (peaks.length > 0 && crest >= 0.3 && novelty >= 0.03) {
        // Notes that were sounding before this strike. Striking one of them
        // again mostly adds to its upper harmonics, which can look like the
        // octave above, so those need gentler rules.
        const prePeaks = this.findPeaks(pre);
        const preVals = new Float32Array(prePeaks.length);
        let preLoud = 0;
        for (let i = 0; i < prePeaks.length; i++) {
          preVals[i] = Math.pow(prePeaks[i].a, 0.6);
          preLoud += prePeaks[i].a;
        }
        // Clearly sounding, not a chance line up of peaks in room noise.
        const ringing = (m: number): boolean => {
          if (prePeaks.length === 0) return false;
          const r = this.scoreNote(m, prePeaks, preVals);
          return r.score > 0 && r.completeness >= 0.6 && r.loud >= 0.25 * preLoud && r.maxA >= 0.15 * loudest;
        };
        expected.forEach((e) => {
          if (e < this.minMidi || e > this.maxMidi) return;
          const s = this.scoreNote(e, peaks, vals);
          // The note must be complete for its register and among the loud new sounds.
          if (s.score <= 0 || s.completeness < 0.5 || s.maxA < 0.2 * loudest) {
            // Unless it was already ringing and its octave has clearly been struck.
            if (!ringing(e)) return;
            const above = this.scoreNote(e + 12, peaks, vals);
            if (above.score <= 0 || above.maxA < 0.3 * loudest || expected.has(e + 12)) return;
            accepted.push(e);
            this.emit(e, time, strength, above.score, true, out);
            return;
          }
          for (const step of HARMONIC_STEPS) {
            // A stronger note below, not asked for, with harmonics of its own
            // means this one is only its overtone.
            const q = e - step;
            if (q >= this.minMidi && !expected.has(q)) {
              const sq = this.scoreNote(q, peaks, vals);
              if (sq.score >= 1.15 * s.score && this.ownSupport(sq, step, peaks, vals, q)) return;
            }
            // A note above that carries all of this one's peaks means this
            // one is a phantom beneath it.
            const u = e + step;
            if (u <= this.maxMidi && !ringing(e)) {
              const su = this.scoreNote(u, peaks, vals);
              if (su.score >= 0.5 * s.score && !this.ownSupport(s, step, peaks, vals, e)) return;
            }
          }
          accepted.push(e);
          this.emit(e, time, strength, s.score, true, out);
        });
      }
      // Nothing new, yet something was struck: an expected note that was
      // already ringing may have been played again.
      if (accepted.length === 0 && !sameGroup && novelty < 0.25) {
        const hit = this.findRestrike(pre, expected, novelty >= 0.02 ? 0.9 : 1.03);
        if (hit !== null) {
          restrike = true;
          accepted.push(hit.midi);
          this.emit(hit.midi, time, strength, hit.score, true, out);
        }
      }
    }

    if (loneClick && accepted.length > 0) {
      // Something was struck together with the click after all.
      this.groupPre.set(pre);
      this.groupStart = onset;
      this.groupLast = onset;
    }

    const delay = Math.round(CONFIRM_S * this.rate);
    this.slow.push({
      onset,
      click: loneClick,
      time,
      strength,
      due: postStart + delay + WIN,
      lateStart: postStart + delay,
      novelty,
      newEnergy,
      sameGroup,
      post: this.post.slice(),
      pre: pre.slice(),
    });

    this.debug?.({ stage: 'fast', time, peaks: dbgPeaks, crest, novelty, best: -1, bestScore: 0, share: 0, completeness: 0, accepted, restrike });
  }

  /** A ringing note that grew louder at this onset, or null. */
  private findRestrike(pre: Float32Array, expected: Set<number> | null, minGrowth = 1.03): { midi: number; score: number } | null {
    const postPeaks = this.findPeaks(this.post);
    if (postPeaks.length === 0) return null;
    const postVals = new Float32Array(postPeaks.length);
    let postTotal = 0;
    for (let i = 0; i < postPeaks.length; i++) {
      postVals[i] = Math.pow(postPeaks[i].a, 0.6);
      postTotal += postVals[i];
    }
    const binHz = this.rate / FFT_N;
    const growth = (s: NoteScore): number => {
      let now = 0;
      let before = 0;
      const hc = Math.min(s.matched.length, 6);
      for (let h = 0; h < hc; h++) {
        const idx = s.matched[h];
        if (idx < 0) continue;
        const k = Math.round(postPeaks[idx].f / binHz);
        now += this.post[k];
        before += pre[k];
      }
      return before > 0 ? now / before : 99;
    };
    let pick: { midi: number; score: number } | null = null;
    if (expected) {
      expected.forEach((e) => {
        if (e < this.minMidi || e > this.maxMidi) return;
        const s = this.scoreNote(e, postPeaks, postVals);
        if (s.score <= 0 || s.completeness < 0.6 || s.explained < 0.15 * postTotal) return;
        if (growth(s) >= minGrowth && (!pick || s.score > pick.score)) pick = { midi: e, score: s.score };
      });
      return pick;
    }
    const hit = this.bestNote(postPeaks, postVals, () => false);
    if (hit && hit.s.completeness >= 0.6 && hit.s.explained >= 0.3 * postTotal && growth(hit.s) >= 1.3) {
      pick = { midi: hit.midi, score: hit.s.score };
    }
    return pick;
  }

  /**
   * Second look, a moment later. By now the knock of the hammer and the
   * thump of the key bed have died away while the strings still ring, so
   * what remains of the new sound is the notes themselves. This look finds
   * every note, including ones the music did not ask for.
   */
  private analyseSlow(job: (typeof this.slow)[number], out: Detected[]): void {
    const { time, strength, post, pre } = job;
    if (time < this.suppressUntil) return;
    if (job.click && this.struckAfter(job.onset)) return;
    this.spectrum(job.lateStart, this.late);
    const late = this.late;
    const diff = this.diff;
    let lasting = 0;
    for (let k = 0; k < diff.length; k++) {
      const d = late[k] - pre[k];
      let v = d > 0 ? d : 0;
      lasting += v * v;
      if (v > 0 && post[k] > 1e-9) {
        // Sound that faded within a few hundredths of a second was not a string.
        const kept = late[k] / post[k];
        if (kept < 0.45) v *= (kept / 0.45) * (kept / 0.45);
      }
      diff[k] = v;
    }
    if (this.clicks) lasting = Math.max(0, lasting - this.findClicks(diff));
    const expected = this.expected;
    const isExpected = (m: number) => expected?.has(m) ?? false;
    this.recent = this.recent.filter((r) => time - r.time < 0.3);
    const accepted: Array<{ midi: number; score: number; f1: number }> = [];
    const taken = (m: number) => accepted.some((a) => a.midi === m);
    let reference = 0;
    let dbgBest = -1;
    let dbgShare = 0;
    let dbgComp = 0;
    let considered = false;
    let crest = 0;

    // A note keeps most of its energy for a while. A knock, a cough or a
    // dropped pencil is gone almost at once.
    const persists = job.newEnergy > 0 && lasting / job.newEnergy >= 0.12;
    const peaks = this.findPeaks(diff, this.clicks ? this.clickBands : undefined);
    const prePeaks = this.findPeaks(pre);
    const preVals = new Float32Array(prePeaks.length);
    let preLoud = 0;
    for (let i = 0; i < prePeaks.length; i++) {
      preVals[i] = Math.pow(prePeaks[i].a, 0.6);
      preLoud += prePeaks[i].a;
    }
    // Clearly sounding before the strike, and loud enough to matter beside the new note.
    const wasRinging = (m: number, beside: number): boolean => {
      if (prePeaks.length === 0 || m < this.minMidi) return false;
      const r = this.scoreNote(m, prePeaks, preVals);
      return r.score > 0 && r.completeness >= 0.6 && r.loud >= 0.25 * preLoud && r.maxA >= 0.2 * beside;
    };
    if (peaks.length > 0 && job.novelty >= 0.05 && persists) {
      const vals = new Float32Array(peaks.length);
      let total = 0;
      let totalLoud = 0;
      for (let i = 0; i < peaks.length; i++) {
        vals[i] = Math.pow(peaks[i].a, 0.6);
        total += vals[i];
        totalLoud += peaks[i].a;
      }
      const top8 = Array.from(vals)
        .sort((a, b) => b - a)
        .slice(0, 8)
        .reduce((a, b) => a + b, 0);
      // A struck string gives a few tall peaks. Noise gives many of similar height.
      crest = total > 0 ? top8 / total : 0;
      if (crest >= 0.3) {
        for (let round = 0; round < MAX_NOTES + 3 && accepted.length < MAX_NOTES; round++) {
          const hit = this.bestNote(peaks, vals, taken);
          if (!hit) break;
          const { midi, s } = hit;
          if (round === 0) {
            reference = s.score;
            dbgBest = midi;
            dbgShare = s.loud / totalLoud;
            dbgComp = s.completeness;
            if (s.completeness < 0.5 || dbgShare < 0.2) break;
          } else if (s.completeness < 0.5 || s.score < (isExpected(midi) ? 0.22 : 0.33) * reference) {
            break;
          }
          considered = true;
          // A weaker note that sits on a harmonic of a stronger one, above or
          // below, is almost always a phantom.
          const related = (other: number) => HARMONIC_STEPS.includes(Math.abs(midi - other));
          const phantom =
            !isExpected(midi) &&
            (accepted.some((a) => related(a.midi) && s.score < 0.75 * a.score) ||
              this.recent.some((r) => r.time !== time && related(r.midi) && s.score < 0.75 * r.score) ||
              // A held note that is struck again brightens, which reads as a note
              // on one of its harmonics: the octave, the twelfth, or higher still.
              HARMONIC_STEPS.some((step) => wasRinging(midi - step, s.maxA)));
          this.damp(s.matched, vals);
          if (phantom) continue;
          accepted.push({ midi, score: s.score, f1: s.f1 });
        }
      }
    }

    let restrike = false;
    if (!expected && accepted.length === 0 && !considered && !job.sameGroup && job.novelty < 0.25) {
      // Without a score to follow, a repeated ringing note is found here.
      this.post.set(post);
      const hit = this.findRestrike(pre, null);
      if (hit !== null) {
        restrike = true;
        accepted.push({ midi: hit.midi, score: hit.score, f1: 0 });
      }
    }

    if (!restrike && accepted.length === 1 && accepted[0].f1 > 0 && accepted[0].midi >= 45 && accepted[0].midi <= 88) {
      // Learn the piano's tuning from clear single notes.
      const dev = 1200 * Math.log2(accepted[0].f1 / this.noteFreq(accepted[0].midi));
      if (Math.abs(dev) < 45) this.tuningCents = Math.max(-60, Math.min(60, this.tuningCents + 0.2 * dev));
    }
    for (const a of accepted) this.emit(a.midi, time, strength, a.score, false, out);

    this.debug?.({
      stage: 'slow',
      time,
      peaks: peaks.length,
      crest,
      novelty: job.novelty,
      best: dbgBest,
      bestScore: reference,
      share: dbgShare,
      completeness: dbgComp,
      accepted: accepted.map((a) => a.midi),
      restrike,
      top: peaks
        .slice()
        .sort((a, b) => b.a - a.a)
        .slice(0, 10)
        .sort((a, b) => a.f - b.f)
        .map((p) => `${p.f.toFixed(0)}:${(20 * Math.log10(p.a)).toFixed(0)}`)
        .join(' '),
    });
  }

  /** Did a strike follow this onset closely enough to be the same moment? */
  private struckAfter(onset: number): boolean {
    const span = GROUP_GAP_S * this.rate;
    return this.strikes.some((s) => s > onset && s - onset < span);
  }

  private emit(midi: number, time: number, strength: number, score: number, assisted: boolean, out: Detected[]): void {
    const last = this.lastEmit.get(midi);
    if (last !== undefined && Math.abs(time - last) < DEDUPE_S) return;
    this.lastEmit.set(midi, time);
    this.recent.push({ midi, time, score });
    out.push({ midi, time, strength, assisted });
  }

  private damp(matched: number[], vals: Float32Array): void {
    for (const idx of matched) if (idx >= 0) vals[idx] *= 0.3;
  }
}
