/**
 * Evaluation of the microphone note detector against real acoustic guitar
 * recordings: GuitarSet (Xi, Bittner, Pauwels, Ye and Bello, 2018, CC BY 4.0),
 * six players, recorded with a microphone, every note annotated per string.
 *
 * The recordings are not stored in the repository. To run this file, unpack
 * audio_mono-mic.zip into <dir>/audio, convert the annotations with
 * convert_guitarset.py (see docs/GUITAR.md) to <dir>/notes.json, then:
 *
 *   GUITARSET_DIR=/path/to/guitarset npx vitest run lib/guitar/dsp/tracker.eval.test.ts
 *
 * Without GUITARSET_DIR the whole file is skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GuitarTracker, type Detected, type Strike } from './tracker';
import { chordFit, judgeChord } from './chordmatch';
import { PitchDetector } from './pitch';
import { pitchClass } from '../music/theory';

const DIR = process.env.GUITARSET_DIR ?? '';
const run = DIR ? describe : describe.skip;

type Note = [number, number, number, number]; // time, midi, string, duration

interface FileInfo {
  notes: Note[];
  tempo: number | null;
  kind: 'comp' | 'solo';
}

function readWav(file: string): { data: Float32Array; rate: number } {
  const buf = fs.readFileSync(file);
  let pos = 12;
  let rate = 44100;
  let bits = 16;
  let channels = 1;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(pos + 10);
      rate = buf.readUInt32LE(pos + 12);
      bits = buf.readUInt16LE(pos + 22);
    } else if (id === 'data') {
      const frames = Math.floor(size / (bits / 8) / channels);
      const data = new Float32Array(frames);
      for (let i = 0; i < frames; i++) data[i] = buf.readInt16LE(pos + 8 + i * channels * 2) / 32768;
      return { data, rate };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error(`No audio in ${file}`);
}

/** Notes struck together, within 60 ms of the first: a strum. */
function strums(notes: Note[]): Note[][] {
  const out: Note[][] = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && n[0] - last[0][0] < 0.06) last.push(n);
    else out.push([n]);
  }
  return out;
}

interface Run {
  found: Detected[];
  strikes: Strike[];
}

/**
 * Feed a recording through the tracker as the microphone would, in blocks.
 * With `assisted`, the tracker is told the notes due in the next moment, as
 * the follower tells it while a lesson plays.
 */
interface Tune {
  floor?: number;
  ratio?: number;
  chroma?: 'compressed' | 'linear' | 'salience';
  maxHz?: number;
  chromaFloor?: number;
  window?: 'short' | 'long';
  fold?: boolean;
}

function track(data: Float32Array, rate: number, notes: Note[], assisted: boolean, seconds = Infinity, tune: Tune = {}): Run {
  const tracker = new GuitarTracker(rate);
  if (tune.floor !== undefined) tracker.onsetFloor = tune.floor;
  if (tune.ratio !== undefined) tracker.onsetRatio = tune.ratio;
  if (tune.chroma) tracker.chromaMode = tune.chroma;
  if (tune.maxHz) tracker.chromaMaxHz = tune.maxHz;
  if (tune.chromaFloor !== undefined) tracker.chromaFloor = tune.chromaFloor;
  if (tune.window) tracker.chromaWindow = tune.window;
  if (tune.fold !== undefined) tracker.foldOvertones = tune.fold;
  const found: Detected[] = [];
  const strikes: Strike[] = [];
  tracker.onStrike = (s) => strikes.push(s);
  const block = 1024;
  const end = Math.min(data.length, Math.round(seconds * rate));
  let k = 0;
  for (let i = 0; i + block <= end; i += block) {
    const t = i / rate;
    if (assisted) {
      while (k < notes.length && notes[k][0] < t - 0.4) k++;
      const due = new Set<number>();
      for (let j = k; j < notes.length && notes[j][0] < t + 0.25; j++) due.add(notes[j][1]);
      tracker.expected = due.size > 0 ? due : null;
    }
    found.push(...tracker.process(data.subarray(i, i + block), t));
  }
  return { found, strikes };
}

const WINDOW = 0.08;

function scoreNotes(notes: Note[], found: Detected[], until: number) {
  const ann = notes.filter((n) => n[0] < until - 0.5);
  let hit = 0;
  let octave = 0;
  for (const n of ann) {
    if (found.some((d) => d.midi === n[1] && Math.abs(d.time - n[0]) <= WINDOW)) hit++;
    else if (found.some((d) => pitchClass(d.midi) === pitchClass(n[1]) && Math.abs(d.time - n[0]) <= WINDOW)) octave++;
  }
  const ok = found.filter((d) => d.time < until - 0.5);
  // A detection is false when no note of that pitch began near it. Notes still ringing from before are not counted against it.
  const fp = ok.filter((d) => !ann.some((n) => n[1] === d.midi && d.time >= n[0] - WINDOW && d.time <= n[0] + Math.max(WINDOW, Math.min(n[3], 0.5))));
  return { notes: ann.length, recall: hit / Math.max(1, ann.length), octave: octave / Math.max(1, ann.length), precision: 1 - fp.length / Math.max(1, ok.length), found: ok.length };
}

function scoreStrums(notes: Note[], run: Run, until: number) {
  const groups = strums(notes.filter((n) => n[0] < until - 0.5)).filter((g) => g.length >= 3);
  let heard = 0;
  let pcCover = 0;
  let noteCover = 0;
  let foreign = 0;
  for (const g of groups) {
    const t0 = g[0][0];
    if (run.strikes.some((s) => Math.abs(s.time - t0) <= WINDOW)) heard++;
    const near = run.found.filter((d) => d.time >= t0 - WINDOW && d.time <= t0 + 0.12);
    const want = new Set(g.map((n) => pitchClass(n[1])));
    const got = new Set(near.map((d) => pitchClass(d.midi)));
    pcCover += Array.from(want).filter((pc) => got.has(pc)).length / want.size;
    noteCover += g.filter((n) => near.some((d) => d.midi === n[1])).length / g.length;
    foreign += Array.from(got).filter((pc) => !want.has(pc)).length;
  }
  const n = Math.max(1, groups.length);
  return { strums: groups.length, heard: heard / n, pitchClasses: pcCover / n, notes: noteCover / n, foreignPerStrum: foreign / n };
}

run('the guitar tracker on GuitarSet recordings', () => {
  const all = DIR ? (JSON.parse(fs.readFileSync(path.join(DIR, 'notes.json'), 'utf8')) as Record<string, FileInfo>) : {};
  const pick = (style: string, kind: 'comp' | 'solo', count: number) =>
    Object.keys(all)
      .filter((k) => k.includes(`_${style}`) && all[k].kind === kind)
      .sort()
      .filter((_, i) => i % Math.max(1, Math.floor(72 / count / 2)) === 0)
      .slice(0, count);
  const SECONDS = Number(process.env.GUITARSET_SECONDS ?? 20);

  it('hears single notes in melodies, with the music to follow and without', () => {
    const rows: string[] = [];
    const sums = { assisted: [0, 0, 0], blind: [0, 0, 0] };
    const files = [...pick('SS', 'solo', 6), ...pick('Rock', 'solo', 4), ...pick('BN', 'solo', 4)];
    for (const name of files) {
      const { data, rate } = readWav(path.join(DIR, 'audio', `${name}_mic.wav`));
      const info = all[name];
      const a = scoreNotes(info.notes, track(data, rate, info.notes, true, SECONDS).found, SECONDS);
      const b = scoreNotes(info.notes, track(data, rate, info.notes, false, SECONDS).found, SECONDS);
      sums.assisted[0] += a.recall;
      sums.assisted[1] += a.precision;
      sums.assisted[2] += a.octave;
      sums.blind[0] += b.recall;
      sums.blind[1] += b.precision;
      sums.blind[2] += b.octave;
      rows.push(`${name.padEnd(22)} notes ${String(a.notes).padStart(3)}  followed: recall ${a.recall.toFixed(2)} precision ${a.precision.toFixed(2)}   blind: recall ${b.recall.toFixed(2)} precision ${b.precision.toFixed(2)} octave ${b.octave.toFixed(2)}`);
    }
    const n = files.length;
    console.log(rows.join('\n'));
    console.log(
      `MELODY followed: recall ${(sums.assisted[0] / n).toFixed(3)} precision ${(sums.assisted[1] / n).toFixed(3)} | blind: recall ${(sums.blind[0] / n).toFixed(3)} precision ${(sums.blind[1] / n).toFixed(3)} octave slips ${(sums.blind[2] / n).toFixed(3)}`,
    );
    expect(sums.assisted[0] / n).toBeGreaterThan(0.5);
  }, 600000);

  it('hears strums and the chord in them', () => {
    const rows: string[] = [];
    const sum = { heard: 0, pcs: 0, notes: 0, foreign: 0 };
    const files = [...pick('SS', 'comp', 6), ...pick('Rock', 'comp', 4), ...pick('BN', 'comp', 4)];
    for (const name of files) {
      const { data, rate } = readWav(path.join(DIR, 'audio', `${name}_mic.wav`));
      const info = all[name];
      const s = scoreStrums(info.notes, track(data, rate, info.notes, true, SECONDS), SECONDS);
      sum.heard += s.heard;
      sum.pcs += s.pitchClasses;
      sum.notes += s.notes;
      sum.foreign += s.foreignPerStrum;
      rows.push(`${name.padEnd(22)} strums ${String(s.strums).padStart(3)}  heard ${s.heard.toFixed(2)}  chord notes named ${s.pitchClasses.toFixed(2)}  strings ${s.notes.toFixed(2)}  foreign ${s.foreignPerStrum.toFixed(2)}`);
    }
    const n = files.length;
    console.log(rows.join('\n'));
    console.log(`STRUMS heard ${(sum.heard / n).toFixed(3)}  chord tones named ${(sum.pcs / n).toFixed(3)}  strings ${(sum.notes / n).toFixed(3)}  foreign per strum ${(sum.foreign / n).toFixed(3)}`);
    expect(sum.heard / n).toBeGreaterThan(0.5);
  }, 600000);

  it('finds strikes without inventing them, across onset settings', () => {
    const files = [...pick('SS', 'comp', 6), ...pick('Rock', 'comp', 3), ...pick('SS', 'solo', 3)];
    const loaded = files.map((name) => ({ name, ...readWav(path.join(DIR, 'audio', `${name}_mic.wav`)), info: all[name] }));
    for (const tune of [
      { floor: 4, ratio: 2 },
      { floor: 3, ratio: 1.6 },
      { floor: 2.5, ratio: 1.4 },
      { floor: 3.5, ratio: 1.2 },
    ]) {
      let rec = 0;
      let prec = 0;
      for (const f of loaded) {
        const r = track(f.data, f.rate, f.info.notes, true, SECONDS, tune);
        const groups = strums(f.info.notes.filter((n) => n[0] > 1 && n[0] < SECONDS - 0.5));
        const onsets = f.info.notes.map((n) => n[0]);
        const strikes = r.strikes.filter((x) => x.time > 1 && x.time < SECONDS - 0.5);
        rec += groups.filter((g) => strikes.some((x) => Math.abs(x.time - g[0][0]) <= WINDOW)).length / Math.max(1, groups.length);
        prec += strikes.filter((x) => onsets.some((o) => Math.abs(x.time - o) <= WINDOW)).length / Math.max(1, strikes.length);
      }
      console.log(`ONSETS floor ${tune.floor} ratio ${tune.ratio}: strikes found ${(rec / loaded.length).toFixed(3)}  strikes real ${(prec / loaded.length).toFixed(3)}`);
    }
  }, 600000);

  it('tells the right chord from a wrong one', () => {
    const files = [...pick('SS', 'comp', 12), ...pick('Rock', 'comp', 6)];
    const loaded = files.map((name) => ({ name, ...readWav(path.join(DIR, 'audio', `${name}_mic.wav`)), info: all[name] }));
    const variants: Array<[string, Tune]> = (process.env.GUITARSET_CHROMA ?? 'compressed')
      .split(',')
      .map((v): [string, Tune] => {
        const [chroma, maxHz, floor, win, fold] = v.split(':');
        return [v, { chroma: chroma as Tune['chroma'], maxHz: maxHz ? Number(maxHz) : undefined, chromaFloor: floor ? Number(floor) : undefined, window: (win as Tune['window']) || undefined, fold: fold === 'fold' ? true : fold === 'plain' ? false : undefined }];
      });
    for (const [label, tune] of variants) {
      const truth: number[] = [];
      let passed = 0;
      let wrongPassed = 0;
      const alts: number[][] = [[], [], [], []];
      const covT: number[] = [];
      for (const f of loaded) {
        const r = track(f.data, f.rate, f.info.notes, true, SECONDS, tune);
        for (const g of strums(f.info.notes.filter((n) => n[0] < SECONDS - 0.5)).filter((g) => g.length >= 3)) {
          const t0 = g[0][0];
          const hit = r.strikes.filter((x) => Math.abs(x.time - t0) <= WINDOW).sort((a, b) => Math.abs(a.time - t0) - Math.abs(b.time - t0))[0];
          if (!hit || hit.chroma.length !== 12) continue;
          const pcs = Array.from(new Set(g.map((n) => pitchClass(n[1]))));
          const fit = chordFit(hit.chroma, pcs);
          truth.push(fit.share);
          covT.push(fit.coverage);
          [2, 5, 7, 9].forEach((shift, i) => alts[i].push(chordFit(hit.chroma, pcs.map((pc) => pitchClass(pc + shift))).share));
          // The app's own rule, with the four wrong chords as the likely mistakes.
          const others = [2, 5, 7, 9].map((shift) => ({ symbol: String(shift), pcs: pcs.map((pc) => pitchClass(pc + shift)) }));
          if (judgeChord(hit.chroma, pcs, others).ok) passed++;
          others.forEach((o, i) => {
            const rest = [{ symbol: 'right', pcs }, ...others.filter((_, j) => j !== i)];
            if (judgeChord(hit.chroma, o.pcs, rest).ok) wrongPassed++;
          });
        }
      }
      const rate = (xs: number[], th: number) => xs.filter((x) => x >= th).length / Math.max(1, xs.length);
      const rows = [0.4, 0.45, 0.5, 0.55, 0.6].map((th) => `share>=${th}: right ${rate(truth, th).toFixed(2)} wrong ${alts.map((a) => rate(a, th).toFixed(2)).join('/')}`);
      const versus = truth.filter((t, i) => alts.every((a) => t > a[i])).length / Math.max(1, truth.length);
      console.log(`RULE ${label}: right chord passes ${(passed / Math.max(1, truth.length)).toFixed(3)}, wrong chord passes ${(wrongPassed / Math.max(1, 4 * truth.length)).toFixed(3)}`);
      console.log(`CHORDS ${label} (n=${truth.length}) right beats every wrong ${versus.toFixed(3)} | ${rows.join(' | ')} | coverage full ${(covT.filter((c) => c >= 0.99).length / Math.max(1, covT.length)).toFixed(2)}`);
    }
  }, 900000);

  it('reads the pitch of sustained notes for the tuner', () => {
    const files = [...pick('SS', 'solo', 12), ...pick('Rock', 'solo', 6), ...pick('BN', 'solo', 6)];
    let n = 0;
    let right = 0;
    let octave = 0;
    let none = 0;
    for (const name of files) {
      const { data, rate } = readWav(path.join(DIR, 'audio', `${name}_mic.wav`));
      const half = rate / 2;
      // The tuner reads a half rate copy: a two point average, then every other sample.
      const dec = new Float32Array(Math.floor(data.length / 2));
      for (let i = 0; i < dec.length; i++) dec[i] = 0.5 * (data[2 * i] + data[2 * i + 1]);
      const det = new PitchDetector(half, 2048);
      const notes = all[name].notes;
      notes.forEach((nt, i) => {
        const [t, midi, , dur] = nt;
        // Alone for its first half second: nothing else starts while it rings.
        if (dur < 0.45 || notes.some((o, j) => j !== i && o[0] > t - 0.3 && o[0] < t + 0.45)) return;
        const at = Math.round((t + 0.12) * half);
        const r = det.detect(dec.subarray(at, at + 2048), { minHz: 60, maxHz: 1100 });
        n++;
        if (!r) {
          none++;
          return;
        }
        const m = 69 + 12 * Math.log2(r.freq / 440);
        if (Math.round(m) === midi) right++;
        else if (Math.abs(Math.round(m) - midi) === 12) octave++;
      });
    }
    console.log(`TUNER sustained notes ${n}: right ${(right / Math.max(1, n)).toFixed(3)} octave ${(octave / Math.max(1, n)).toFixed(3)} no reading ${(none / Math.max(1, n)).toFixed(3)}`);
    expect(right / Math.max(1, n)).toBeGreaterThan(0.85);
  }, 600000);
});
