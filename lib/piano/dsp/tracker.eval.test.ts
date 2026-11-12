/**
 * Evaluation of the microphone note detector against real grand piano
 * recordings (Salamander Grand Piano, several velocity layers).
 *
 * The recordings are not stored in the repository. To run this file, decode
 * the samples to raw mono 32 bit float at 44.1 kHz named v<layer>_<midi>_<L|R>.f32
 * and point PCM_DIR at the folder:
 *
 *   PCM_DIR=/path/to/pcm npx vitest run lib/piano/dsp/tracker.eval.test.ts
 *
 * Without PCM_DIR the whole file is skipped.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PitchTracker, type Detected } from './tracker';
import { CLICK_FREQS, CLICK_HZ } from '../audio/click';
import { mulberry32 } from '../util/emitter';

const DIR = process.env.PCM_DIR ?? '';
const SR = 44100;
const ROOTS = [21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108];

const cache = new Map<string, { data: Float32Array; onset: number }>();

function load(layer: number, root: number, ch = 'L'): { data: Float32Array; onset: number } {
  const key = `v${layer}_${root}_${ch}`;
  let hit = cache.get(key);
  if (!hit) {
    const buf = fs.readFileSync(path.join(DIR, `${key}.f32`));
    const data = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)).slice();
    let peak = 0;
    const lim = Math.min(data.length, SR / 4);
    for (let i = 0; i < lim; i++) peak = Math.max(peak, Math.abs(data[i]));
    let onset = 0;
    for (let i = 0; i < lim; i++) {
      if (Math.abs(data[i]) > peak * 0.02) {
        onset = i;
        break;
      }
    }
    hit = { data, onset };
    cache.set(key, hit);
  }
  return hit;
}

interface Ev {
  midi: number;
  t: number;
  /** Seconds until the key is released. */
  dur: number;
  layer?: number;
  gain?: number;
  ch?: string;
}

interface Cond {
  noiseDb?: number;
  reverb?: boolean;
  cents?: number;
  gain?: number;
  rate?: number;
}

function render(events: Ev[], seconds: number, cond: Cond = {}): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * SR));
  const detune = Math.pow(2, (cond.cents ?? 0) / 1200);
  for (const ev of events) {
    const root = ROOTS.reduce((a, b) => (Math.abs(b - ev.midi) < Math.abs(a - ev.midi) ? b : a));
    const s = load(ev.layer ?? 8, root, ev.ch ?? 'L');
    const ratio = Math.pow(2, (ev.midi - root) / 12) * detune;
    const start = Math.round(ev.t * SR);
    const g = ev.gain ?? 1;
    const releaseAt = Math.round(ev.dur * SR);
    const tau = 0.08 * SR;
    const maxLen = Math.min(out.length - start, Math.floor((s.data.length - s.onset - 2) / ratio));
    for (let i = 0; i < maxLen; i++) {
      const pos = s.onset + i * ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      let v = s.data[i0] * (1 - frac) + s.data[i0 + 1] * frac;
      if (i > releaseAt) {
        const e = Math.exp(-(i - releaseAt) / tau);
        if (e < 1e-4) break;
        v *= e;
      }
      out[start + i] += v * g;
    }
  }
  let sig: Float32Array = out;
  if (cond.reverb) sig = reverb(sig);
  if (cond.gain !== undefined) for (let i = 0; i < sig.length; i++) sig[i] *= cond.gain;
  if (cond.noiseDb !== undefined) {
    const rnd = mulberry32(7);
    const amp = Math.pow(10, cond.noiseDb / 20) * Math.sqrt(3);
    let prev = 0;
    for (let i = 0; i < sig.length; i++) {
      // Slightly coloured noise, closer to room noise than white noise.
      const w = (rnd() * 2 - 1) * amp;
      prev = 0.6 * prev + 0.4 * w;
      sig[i] += prev * 1.6;
    }
  }
  if (cond.rate && cond.rate !== SR) sig = resample(sig, SR, cond.rate);
  return sig;
}

/** A small Schroeder reverb, enough to smear onsets like a live room. */
function reverb(x: Float32Array): Float32Array {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356];
  const out = new Float32Array(x.length);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let idx = 0;
    const fb = 0.8;
    for (let i = 0; i < x.length; i++) {
      const y = buf[idx];
      buf[idx] = x[i] + y * fb;
      idx = (idx + 1) % d;
      out[i] += y;
    }
  }
  const res = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) res[i] = x[i] + (0.22 * out[i]) / combs.length * 3;
  return res;
}

function resample(x: Float32Array, from: number, to: number): Float32Array {
  const n = Math.floor((x.length * to) / from);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = (i * from) / to;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    out[i] = x[i0] * (1 - f) + (x[i0 + 1] ?? 0) * f;
  }
  return out;
}

/** Sample rates to hear the metronome cases at. An iPad records at 48 kHz. */
const RATES = [SR, 48000];

const TRACE = (process.env.TRACE ?? '').split(',').filter(Boolean).map(Number);

function detect(sig: Float32Array, rate: number, expectedAt?: (t: number) => number[] | null, label = ''): Detected[] {
  const tr = new PitchTracker(rate);
  // As in the app, the detector knows what the metronome sounds like.
  if (!process.env.NO_CLICK_GUARD) tr.clicks = CLICK_FREQS;
  if (TRACE.length === 2 && (!process.env.TRACE_LABEL || label.includes(process.env.TRACE_LABEL))) {
    tr.debug = (d) => {
      if (d.time >= TRACE[0] && d.time <= TRACE[1]) {
        // eslint-disable-next-line no-console
        console.log(`  [${label}] ${d.stage} t=${d.time.toFixed(3)} peaks=${d.peaks} crest=${d.crest.toFixed(2)} nov=${d.novelty.toFixed(3)} best=${d.best} share=${d.share.toFixed(2)} comp=${d.completeness.toFixed(2)} acc=${d.accepted.join('+')} exp=${tr.expected ? Array.from(tr.expected).join('+') : '-'} ${d.restrike ? 'RESTRIKE' : ''} ${d.top ?? ''}`);
      }
    };
  }
  const out: Detected[] = [];
  const block = 1024;
  for (let i = 0; i < sig.length; i += block) {
    const t = i / rate;
    if (expectedAt) {
      const e = expectedAt(t);
      tr.expected = e ? new Set(e) : null;
    }
    out.push(...tr.process(sig.subarray(i, Math.min(sig.length, i + block)), t));
  }
  return out;
}

interface Tally {
  truth: number;
  hit: number;
  extra: number;
  absErr: number;
  bias: number;
  misses: string[];
  extras: string[];
}

function newTally(): Tally {
  return { truth: 0, hit: 0, extra: 0, absErr: 0, bias: 0, misses: [], extras: [] };
}

function score(tally: Tally, truth: Ev[], got: Detected[], tol = 0.09): void {
  const used = new Set<number>();
  for (const ev of truth) {
    tally.truth++;
    let best = -1;
    let bestD = tol;
    got.forEach((d, i) => {
      if (used.has(i) || d.midi !== ev.midi) return;
      const dist = Math.abs(d.time - ev.t);
      if (dist <= bestD) {
        bestD = dist;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      tally.hit++;
      tally.absErr += Math.abs(got[best].time - ev.t);
      tally.bias += got[best].time - ev.t;
    } else {
      tally.misses.push(`${ev.midi}@${ev.t.toFixed(2)}`);
    }
  }
  got.forEach((d, i) => {
    if (!used.has(i)) {
      tally.extra++;
      tally.extras.push(`${d.midi}@${d.time.toFixed(2)}`);
    }
  });
}

function report(name: string, t: Tally): string {
  const recall = t.truth === 0 ? 1 : t.hit / t.truth;
  const precision = t.hit + t.extra === 0 ? 1 : t.hit / (t.hit + t.extra);
  const err = t.hit === 0 ? 0 : (t.absErr / t.hit) * 1000;
  const bias = t.hit === 0 ? 0 : (t.bias / t.hit) * 1000;
  const line = `${name.padEnd(34)} recall ${(recall * 100).toFixed(1).padStart(5)}%  precision ${(precision * 100).toFixed(1).padStart(5)}%  n=${String(t.truth).padStart(4)}  extra=${String(t.extra).padStart(3)}  |err| ${err.toFixed(0)}ms  bias ${bias.toFixed(0)}ms`;
  // eslint-disable-next-line no-console
  console.log(line + (t.misses.length ? `\n    missed: ${t.misses.slice(0, 14).join(' ')}` : '') + (t.extras.length ? `\n    extra:  ${t.extras.slice(0, 14).join(' ')}` : ''));
  return line;
}

const CONDS: Record<string, Cond> = {
  clean: {},
  'noise -45dB': { noiseDb: -45 },
  'noise -35dB': { noiseDb: -35 },
  reverb: { reverb: true },
  'flat 25 cents': { cents: -25 },
  'sharp 20 cents': { cents: 20 },
  'quiet -22dB': { gain: 0.08 },
  '48 kHz': { rate: 48000 },
};

describe.skipIf(!DIR)('tracker on real piano recordings', () => {
  it('single notes across the keyboard', () => {
    const rows: Array<{ name: string; recall: number; extras: number }> = [];
    for (const [name, cond] of Object.entries(CONDS)) {
      const tally = newTally();
      for (const layer of [4, 8, 12]) {
        const evs: Ev[] = [];
        let t = 0.5;
        for (let m = 36; m <= 96; m++) {
          evs.push({ midi: m, t, dur: 0.5, layer });
          t += 0.75;
        }
        const sig = render(evs, t + 0.5, cond);
        score(tally, evs, detect(sig, cond.rate ?? SR, undefined, `single-${name}-${layer}`));
      }
      report(`single ${name}`, tally);
      rows.push({ name, recall: tally.hit / tally.truth, extras: tally.extra / tally.truth });
    }
    for (const r of rows) {
      if (r.name === 'noise -35dB') continue; // reported, not required
      expect.soft(r.recall, `single notes recall, ${r.name}`).toBeGreaterThan(0.86);
      // A live room smears onsets, which shows up as the odd repeated report.
      expect.soft(r.extras, `single notes extras, ${r.name}`).toBeLessThan(r.name === 'reverb' ? 0.3 : 0.12);
    }
  });

  it('low bass notes', () => {
    const tally = newTally();
    const evs: Ev[] = [];
    let t = 0.5;
    for (let m = 28; m < 36; m++) {
      evs.push({ midi: m, t, dur: 0.7, layer: 8 });
      t += 0.9;
    }
    score(tally, evs, detect(render(evs, t + 0.5), SR));
    report('low bass E1 to B1', tally);
    expect(tally.hit / tally.truth).toBeGreaterThan(0.7);
  });

  it('melodies, legato, at several speeds', () => {
    const rows: Array<{ name: string; recall: number; extras: number }> = [];
    for (const mode of ['blind', 'expected'] as const) {
      for (const [name, cond] of Object.entries(CONDS)) {
        const tally = newTally();
        const rnd = mulberry32(11);
        for (const gap of [0.5, 0.3, 0.2, 0.14]) {
          const sub = newTally();
          const evs: Ev[] = [];
          let t = 0.5;
          let m = 60;
          for (let i = 0; i < 40; i++) {
            const step = [-4, -3, -2, -1, 1, 2, 3, 4, 5, -5, 7, -7][Math.floor(rnd() * 12)];
            // Quick runs low in the bass blur together in any short analysis
            // window, so the fast tests stay from the tenor range up.
            m = Math.min(86, Math.max(gap <= 0.2 ? 53 : 45, m + step));
            evs.push({ midi: m, t, dur: gap, layer: [4, 8, 12][Math.floor(rnd() * 3)] });
            t += gap;
          }
          // In a lesson the app knows the next note, and moves on once it hears it.
          const expectedAt = mode === 'expected' ? (time: number) => {
            const next = evs.find((e) => e.t >= time - 0.13);
            return next ? [next.midi] : null;
          } : undefined;
          const got = detect(render(evs, t + 0.6, cond), cond.rate ?? SR, expectedAt, `melody-${mode}-${name}-${gap}`);
          score(sub, evs, got);
          score(tally, evs, got);
          if (name === 'clean') report(`  melody ${mode} gap ${gap}s`, sub);
        }
        report(`melody ${mode} ${name}`, tally);
        rows.push({ name: `${mode} ${name}`, recall: tally.hit / tally.truth, extras: tally.extra / tally.truth });
      }
    }
    for (const r of rows) {
      if (r.name.endsWith('noise -35dB')) continue; // reported, not required
      expect.soft(r.recall, `melody recall, ${r.name}`).toBeGreaterThan(r.name.startsWith('expected') ? 0.88 : 0.83);
      expect.soft(r.extras, `melody extras, ${r.name}`).toBeLessThan(0.2);
    }
  });

  it('repeated notes', () => {
    const tally = newTally();
    const evs: Ev[] = [];
    let t = 0.5;
    for (const m of [48, 55, 60, 64, 67, 72, 79, 84]) {
      for (const gap of [0.5, 0.3, 0.2]) {
        for (let i = 0; i < 4; i++) {
          evs.push({ midi: m, t, dur: gap * 0.8, layer: 8 });
          t += gap;
        }
        t += 0.5;
      }
    }
    score(tally, evs, detect(render(evs, t + 0.5), SR));
    report('repeated notes', tally);
    expect(tally.hit / tally.truth).toBeGreaterThan(0.88);
  });

  it('repeated notes with the music telling it what to expect', () => {
    const tally = newTally();
    const evs: Ev[] = [];
    let t = 0.5;
    for (const m of [48, 55, 60, 64, 67, 72, 79, 84]) {
      for (const gap of [0.5, 0.3, 0.2]) {
        for (let i = 0; i < 4; i++) {
          // held with the pedal: the old strike keeps ringing under the new one
          evs.push({ midi: m, t, dur: 2, layer: 8, gain: i % 2 ? 0.85 : 1 });
          t += gap;
        }
        t += 0.8;
      }
    }
    const expectedAt = (time: number) => {
      const next = evs.find((e) => e.t >= time - 0.25);
      return next ? [next.midi] : null;
    };
    score(tally, evs, detect(render(evs, t + 0.5), SR, expectedAt));
    report('repeated, pedal, expected', tally);
    expect(tally.hit / tally.truth).toBeGreaterThan(0.85);
  });

  it('two and three notes at once, with no hints', () => {
    for (const [name, cond] of Object.entries({ clean: CONDS.clean, 'noise -45dB': CONDS['noise -45dB'], reverb: CONDS.reverb })) {
      const tally = newTally();
      const shapes = [[0, 3], [0, 4], [0, 5], [0, 7], [0, 8], [0, 9], [0, 4, 7], [0, 3, 7], [0, 3, 8], [0, 5, 9], [0, 4, 9]];
      const evs: Ev[] = [];
      let t = 0.5;
      for (const base of [48, 53, 57, 60, 65, 69, 72]) {
        for (const shape of shapes) {
          for (const off of shape) evs.push({ midi: base + off, t, dur: 0.6, layer: 8 });
          t += 0.9;
        }
      }
      score(tally, evs, detect(render(evs, t + 0.5, cond), SR, undefined, `blind-${name}`));
      report(`chords blind ${name}`, tally);
      expect.soft(tally.hit / tally.truth, `chords recall, ${name}`).toBeGreaterThan(0.88);
      expect.soft(tally.extra / tally.truth, `chords extras, ${name}`).toBeLessThan(0.1);
    }
  });

  it('chords and hands together when the music says what to expect', () => {
    for (const [name, cond] of Object.entries(CONDS)) {
      const tally = newTally();
      const groups: number[][] = [];
      const rnd = mulberry32(5);
      const shapes = [[0, 3], [0, 4], [0, 7], [0, 12], [0, 4, 7], [0, 3, 7], [0, 5, 9], [0, 4, 7, 12]];
      for (const base of [43, 48, 53, 57, 60, 65, 69, 72]) for (const s of shapes) groups.push(s.map((o) => base + o));
      // a bass note under a melody note, the usual two hand texture
      for (let i = 0; i < 40; i++) {
        const low = 36 + Math.floor(rnd() * 20);
        const high = 60 + Math.floor(rnd() * 24);
        groups.push([low, high]);
      }
      for (let i = 0; i < 20; i++) {
        const low = 36 + Math.floor(rnd() * 14);
        const mid = 60 + Math.floor(rnd() * 8);
        groups.push([low, mid, mid + [3, 4, 5][Math.floor(rnd() * 3)]]);
      }
      const evs: Ev[] = [];
      const times: number[] = [];
      let t = 0.5;
      groups.forEach((g) => {
        times.push(t);
        // hands are never perfectly together
        g.forEach((m, i) => evs.push({ midi: m, t: t + (i === 0 ? 0 : (rnd() - 0.3) * 0.03), dur: 0.6, layer: [4, 8, 12][Math.floor(rnd() * 3)] }));
        t += 0.9;
      });
      const expectedAt = (time: number) => {
        let idx = 0;
        for (let i = 0; i < times.length; i++) if (times[i] - 0.3 <= time) idx = i;
        return groups[idx];
      };
      score(tally, evs, detect(render(evs, t + 0.5, cond), cond.rate ?? SR, expectedAt, `expected-${name}`), 0.12);
      report(`chords expected ${name}`, tally);
      if (name === 'noise -35dB') continue; // reported, not required
      expect.soft(tally.hit / tally.truth, `expected chords recall, ${name}`).toBeGreaterThan(0.88);
      expect.soft(tally.extra / tally.truth, `expected chords extras, ${name}`).toBeLessThan(0.1);
    }
  });

  it('hears a note struck again while the octave below it is held', () => {
    const tally = newTally();
    const groups: Array<{ t: number; notes: number[] }> = [];
    const evs: Ev[] = [];
    let t = 0.5;
    for (const [low, high] of [[48, 60], [43, 55], [50, 62], [53, 65], [45, 57], [36, 60]]) {
      // both together, then the upper note again, twice, while the lower one rings
      evs.push({ midi: low, t, dur: 3, layer: 8 });
      evs.push({ midi: high, t: t + 0.01, dur: 0.6, layer: 8 });
      groups.push({ t, notes: [low, high] });
      for (const dt of [0.75, 1.5]) {
        evs.push({ midi: high, t: t + dt, dur: 0.6, layer: 8 });
        groups.push({ t: t + dt, notes: [high] });
      }
      t += 3.4;
    }
    const expectedAt = (time: number) => {
      let cur = groups[0].notes;
      for (const g of groups) if (g.t - 0.3 <= time) cur = g.notes;
      return cur;
    };
    score(tally, evs, detect(render(evs, t + 0.5), SR, expectedAt, 'restrike-octave'), 0.12);
    report('struck again over a held octave', tally);
    expect(tally.hit / tally.truth).toBeGreaterThan(0.9);
    expect(tally.extra / tally.truth).toBeLessThan(0.1);
  });

  it('does not credit an expected note that was not played', () => {
    // The learner plays one note while the music expects another.
    const cases: Array<{ play: number[]; expect: number[]; mustNot: number[] }> = [];
    for (const base of [48, 55, 60, 64, 67, 72]) {
      cases.push({ play: [base], expect: [base + 12], mustNot: [base + 12] }); // an octave too low
      cases.push({ play: [base + 12], expect: [base], mustNot: [base] }); // an octave too high
      cases.push({ play: [base], expect: [base + 1], mustNot: [base + 1] });
      cases.push({ play: [base], expect: [base + 2], mustNot: [base + 2] });
      cases.push({ play: [base], expect: [base - 1], mustNot: [base - 1] });
      cases.push({ play: [base], expect: [base + 7], mustNot: [base + 7] });
      cases.push({ play: [base], expect: [base - 5], mustNot: [base - 5] });
      cases.push({ play: [base], expect: [base, base + 4], mustNot: [base + 4] }); // half a chord
      cases.push({ play: [base + 4], expect: [base, base + 4, base + 7], mustNot: [base, base + 7] });
      cases.push({ play: [base], expect: [base, base + 7], mustNot: [base + 7] });
    }
    let falseAccepts = 0;
    const bad: string[] = [];
    for (const c of cases) {
      const evs = c.play.map((m) => ({ midi: m, t: 0.5, dur: 0.6, layer: 8 }));
      const got = detect(render(evs, 1.6), SR, () => c.expect);
      for (const m of c.mustNot) {
        if (got.some((d) => d.midi === m)) {
          falseAccepts++;
          bad.push(`played ${c.play.join('+')} credited ${m}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`false accepts: ${falseAccepts} of ${cases.length}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
    expect(falseAccepts / cases.length).toBeLessThan(0.08);
  });

  it('ignores sounds that are not piano notes', () => {
    const rnd = mulberry32(3);
    const n = SR * 12;
    const sig = new Float32Array(n);
    // noise bursts, like a cough or a book dropped
    for (let k = 0; k < 6; k++) {
      const s = Math.floor((0.5 + k * 0.6) * SR);
      for (let i = 0; i < 4000; i++) sig[s + i] += (rnd() * 2 - 1) * 0.3 * Math.exp(-i / 900);
    }
    // sharp clicks
    for (let k = 0; k < 6; k++) sig[Math.floor((4.3 + k * 0.4) * SR)] = 0.9;
    // sine beeps at two pitches, like a simple metronome
    for (let k = 0; k < 8; k++) {
      const s = Math.floor((7 + k * 0.5) * SR);
      const f = k % 4 === 0 ? 880 : 659.3;
      for (let i = 0; i < 3500; i++) sig[s + i] += 0.4 * Math.sin((2 * Math.PI * f * i) / SR) * Math.exp(-i / 700);
    }
    const got = detect(sig, SR);
    // eslint-disable-next-line no-console
    console.log(`non piano sounds produced ${got.length} detections: ${got.map((d) => `${d.midi}@${d.time.toFixed(2)}`).join(' ')}`);
    expect(got.length).toBeLessThanOrEqual(1);
    void rnd;
  });

  it('is not fooled by the app counting in', () => {
    // Before a timed run the app clicks a full measure. Nothing is being played yet.
    let total = 0;
    const bad: string[] = [];
    const expectations: Array<number[] | null> = [null, [60], [62, 74], [69, 81], [57, 64], [86], [93], [74, 86], [81, 93]];
    for (const rate of RATES) {
      for (const bpm of [60, 90, 120, 160]) {
        for (const level of [0.05, 0.2, 0.8]) {
          const beat = 60 / bpm;
          const made = new Float32Array(Math.ceil((0.5 + 9 * beat) * SR));
          for (let k = 0; k < 8; k++) addClick(made, 0.5 + k * beat, k % 4 === 0, level);
          const sig = rate === SR ? made : resample(made, SR, rate);
          for (const e of expectations) {
            const got = detect(sig, rate, e ? () => e : undefined);
            total += got.length;
            if (got.length) bad.push(`${rate} Hz ${bpm}bpm level ${level} expecting ${e ? e.join('+') : 'nothing'}: ${got.map((d) => `${d.midi}@${d.time.toFixed(2)}`).join(' ')}`);
          }
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`count in clicks produced ${total} detections${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
    expect(total).toBe(0);
  });

  it('hears playing through the metronome click', () => {
    // The click comes out of the iPad next to its own microphone, so it can be
    // louder than the piano. The learner plays near each click, never exactly on it.
    const rows: Array<{ name: string; rate: number; recall: number; extras: number; err: number }> = [];
    const peak = (() => {
      const one = render([{ midi: 60, t: 0.1, dur: 0.5, layer: 8 }], 1);
      let p = 0;
      for (let i = 0; i < one.length; i++) p = Math.max(p, Math.abs(one[i]));
      return p;
    })();
    for (const rate of RATES) {
    for (const ratio of process.env.CLICK_RATIOS ? process.env.CLICK_RATIOS.split(',').map(Number) : [0, 0.25, 1, 4]) {
      const tally = newTally();
      const rnd = mulberry32(21);
      for (const bpm of [66, 96, 132]) {
        for (const lag of [-0.07, -0.035, 0, 0.035, 0.07]) {
          const beat = 60 / bpm;
          const evs: Ev[] = [];
          const steps: Array<{ t: number; notes: number[] }> = [];
          let m = 62;
          const first = 0.5 + 4 * beat;
          for (let i = 0; i < 24; i++) {
            const step = [-4, -3, -2, -1, 1, 2, 3, 4, 5, -5][Math.floor(rnd() * 10)];
            m = Math.min(84, Math.max(48, m + step));
            const t = first + i * beat;
            const notes = i % 6 === 5 ? [m - 12, m] : [m];
            notes.forEach((n) => evs.push({ midi: n, t: t + lag + (rnd() - 0.5) * 0.02, dur: beat * 0.9, layer: [4, 8, 12][Math.floor(rnd() * 3)] }));
            steps.push({ t, notes });
          }
          const made = render(evs, first + 24 * beat + 0.8);
          if (ratio > 0) {
            for (let k = 0; k < 28; k++) addClick(made, 0.5 + k * beat, k % 4 === 0, (ratio * peak) / 0.5);
          }
          const sig = rate === SR ? made : resample(made, SR, rate);
          // The app tells the detector about this step and the next, a little ahead.
          const expectedAt = (time: number) => {
            let idx = -1;
            for (let i = 0; i < steps.length; i++) if (steps[i].t - 0.35 * beat <= time) idx = i;
            if (idx < 0) return steps[0].notes;
            return [...steps[idx].notes, ...(steps[idx + 1]?.notes ?? [])];
          };
          const got = detect(sig, rate, expectedAt, `click-${rate}-${ratio}-${bpm}-${lag}`);
          score(tally, evs, got, 0.1);
          if (process.env.CLICK_DETAIL) {
            const sub = newTally();
            score(sub, evs, got, 0.1);
            report(`  click ${ratio} bpm ${bpm} lag ${lag}`, sub);
          }
        }
      }
      report(`${rate} Hz, click at ${ratio} of piano level`, tally);
      rows.push({ name: String(ratio), rate, recall: tally.hit / tally.truth, extras: tally.extra / tally.truth, err: tally.absErr / Math.max(1, tally.hit) });
    }
    }
    for (const r of rows) {
      // Each rate is held to its own run without a click.
      const base = rows.find((b) => b.rate === r.rate && b.name === '0') ?? rows[0];
      if (r === base) continue;
      expect.soft(r.recall, `recall at ${r.rate} Hz with click at ${r.name}`).toBeGreaterThan(base.recall - 0.02);
      expect.soft(r.extras, `extras at ${r.rate} Hz with click at ${r.name}`).toBeLessThan(base.extras + 0.03);
      expect.soft(r.err, `timing at ${r.rate} Hz with click at ${r.name}`).toBeLessThan(0.02);
    }
  });
});

/** The app's own metronome click, shaped as the sound engine makes it. */
function addClick(sig: Float32Array, at: number, accent: boolean, level: number): void {
  const f = accent ? CLICK_HZ.accent : CLICK_HZ.beat;
  const peak = (accent ? 0.75 : 0.5) * level;
  const start = Math.round(at * SR);
  const n = Math.floor(0.08 * SR);
  for (let i = 0; i < n && start + i < sig.length; i++) {
    const t = i / SR;
    let g = 0.0001;
    if (t < 0.002) g = 0.0001 * Math.pow(peak / 0.0001, t / 0.002);
    else if (t < 0.055) g = peak * Math.pow(0.0001 / peak, (t - 0.002) / 0.053);
    sig[start + i] += g * Math.sin(2 * Math.PI * f * t);
  }
}
