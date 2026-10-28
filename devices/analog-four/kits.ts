// ============================================================================
// Analog Four MKII kits and projects
//
// A kit is the four synth tracks' sounds plus the FX track; a project holds
// the patterns (banks A-H x 16, up to 64 steps), the chain and the song. Each
// kit here ships with a project, so loading it gives you a playable track.
// The default project is "Night Drive", a complete song: intro, groove,
// breakdown, drop.
//
// Patterns are written with a small DSL (one string per track):
//   x note trig   a accent   s slide (glides from the previous note)
//   p parameter slide (this trig's locks glide to the next trig's)
//   l lock trig (parameters only, no note)   . no trig
// `n` lists the notes of the trigs in order, `L` holds parameter locks by
// step, `at` any other step fields (len, cond, micro, vel) by step.
// ============================================================================

import {
  createPattern, createProject, LEN_1_STEP, type Locks, type Pattern, type Project, type SongRow, type Step,
} from '@/lib/sequencer/elektron';
import { SEQ_TRACKS, SYNTH_BY_KEY, FX_BY_KEY, V, dest, tid, fxid } from './params';
import { SOUND_BY_ID, type SoundDef, type SoundParams } from './sounds';

// Note-length indices (NOTE_LENGTHS): steps -> index
export const LEN = { s1: LEN_1_STEP, s1_5: 22, s2: 30, s3: 38, s4: 46, s6: 54, s8: 62, s12: 70, s16: 78, s32: 94 } as const;

interface TrackSpec {
  s: string;
  note?: number;
  vel?: number;
  len?: number;
  /** Notes of the trigs, in order */
  n?: number[];
  /** Locks by step */
  L?: Record<number, Locks>;
  /** Other step fields by step */
  at?: Record<number, Partial<Step>>;
  /** Locks applied to every trig */
  all?: Locks;
  mute?: boolean;
}

const rep = (s: string, times: number) => s.repeat(times);

function buildTrack(spec: TrackSpec): Pattern['tracks'][number]['steps'] {
  const steps: Record<number, Step> = {};
  let k = 0;
  for (let i = 0; i < spec.s.length; i++) {
    const c = spec.s[i];
    if (c === '.' || c === ' ' || c === '|') continue;
    const st: Step = {};
    if (c === 'l') st.trigless = true;
    if (c === 'a') st.accent = true;
    if (c === 's') st.slide = true;
    if (c === 'p') st.pslide = true;
    if (c !== 'l' && spec.n && spec.n.length) st.note = spec.n[k % spec.n.length];
    if (c !== 'l') k++;
    const locks = { ...(spec.all ?? {}), ...(spec.L?.[i] ?? {}) };
    if (Object.keys(locks).length) st.locks = locks;
    Object.assign(st, spec.at?.[i] ?? {});
    steps[i] = st;
  }
  // DSL strings may carry spaces or bars for readability: index by step, not character
  return steps;
}

/** Strip readability characters so string positions are step numbers */
const clean = (s: string) => s.replace(/[ |]/g, '');

function pat(name: string, length: number, tracks: (TrackSpec | null)[], opts: { swing?: number } = {}): Pattern {
  const p = createPattern(SEQ_TRACKS, { name, length, swing: opts.swing ?? 50 });
  tracks.forEach((t, i) => {
    if (!t) return;
    const tr = p.tracks[i];
    tr.steps = buildTrack({ ...t, s: clean(t.s) });
    if (t.note !== undefined) tr.note = t.note;
    if (t.vel !== undefined) tr.vel = t.vel;
    if (t.len !== undefined) tr.len = t.len;
    if (t.mute) tr.mute = true;
  });
  return p;
}

function project(patterns: Record<string, Pattern>, opts: { song?: SongRow[]; loopRow?: number; mode?: Project['mode']; active?: string; chain?: string[]; songName?: string } = {}): Project {
  const pr = createProject({ tracks: SEQ_TRACKS, defaults: { note: 60, vel: 100, len: LEN_1_STEP } });
  pr.patterns = patterns;
  pr.active = opts.active ?? Object.keys(patterns)[0] ?? 'A01';
  if (opts.song) pr.song = { name: opts.songName ?? '', rows: opts.song, loop: true, loopRow: opts.loopRow ?? 0 };
  if (opts.chain) pr.chain = opts.chain;
  if (opts.mode) pr.mode = opts.mode;
  return pr;
}

// ----------------------------------------------------------------------------
// Kit definitions
// ----------------------------------------------------------------------------

export interface KitTrack { sound: string; p?: SoundParams }

export interface KitDef {
  id: string;
  name: string;
  desc: string;
  tempo: number;
  tracks: [KitTrack, KitTrack, KitTrack, KitTrack];
  fx?: Record<string, number>;
  project: () => Project;
}

/** Control values of a kit: every sound parameter of the 4 tracks, the FX track and the tempo */
export function kitValues(kit: KitDef): Record<string, number> {
  const out: Record<string, number> = { tempo: kit.tempo };
  kit.tracks.forEach((kt, t) => {
    const params = soundParams(kt.sound, kt.p);
    for (const key in SYNTH_BY_KEY) {
      if (key.startsWith('trig_') || key === 'level') continue;
      out[tid(t, key)] = params[key] ?? SYNTH_BY_KEY[key].def;
    }
    out[tid(t, 'level')] = 100;
  });
  for (const key in FX_BY_KEY) {
    if (key.startsWith('trig_')) continue;
    out[fxid(key)] = kit.fx?.[key] ?? FX_BY_KEY[key].def;
  }
  return out;
}

/** A sound's parameters (init + the sound + overrides) */
export function soundParams(id: string, extra?: SoundParams): SoundParams {
  return { ...(SOUND_BY_ID[id]?.p ?? {}), ...(extra ?? {}) };
}

// ---- Night Drive (the default project) -------------------------------------
// A minor, 122 BPM. T1 drums (one track: kick, with snare and hat sounds
// p-locked onto their steps), T2 bass, T3 chord stabs (two-note chords: the
// third is a p-locked OSC 2 TUN), T4 arpeggio / lead.

const SN: Locks = { osc1_tun: -7, osc1_lev: 80, noise_lev: 110, noise_col: 20, noise_fad: 24, flt2_frq: 50, amp_dec: 60, env2_depa: 40, env2_dec: 30 };
const HH: Locks = { osc1_lev: 0, noise_lev: 127, noise_col: 40, flt2_frq: 96, amp_dec: 36, amp_vol: 78 };
const OH: Locks = { osc1_lev: 0, noise_lev: 127, noise_col: 40, flt2_frq: 94, amp_dec: 62, amp_vol: 72 };
const CHORDS = [
  { root: 45, stab: 57, third: 3, arp: 69 },   // Am
  { root: 41, stab: 53, third: 4, arp: 65 },   // F
  { root: 48, stab: 60, third: 4, arp: 72 },   // C
  { root: 43, stab: 55, third: 4, arp: 67 },   // G
];

function nightDrive(): Project {
  // ---- drums
  const grooveBar = 'x.x.x.xxx.x.x.xx';
  const drumsL = (bars: number, fill: boolean): Record<number, Locks> => {
    const L: Record<number, Locks> = {};
    for (let b = 0; b < bars; b++) {
      const o = b * 16;
      [2, 6, 7, 10, 14, 15].forEach(s => (L[o + s] = s === 7 || s === 15 ? { ...HH, amp_vol: 60 } : HH));
      [4, 12].forEach(s => (L[o + s] = SN));
      if (b === 3 && fill) { L[o + 14] = SN; L[o + 15] = OH; }
    }
    return L;
  };
  const drumsAt = (bars: number): Record<number, Partial<Step>> => {
    const at: Record<number, Partial<Step>> = {};
    for (let b = 0; b < bars; b++) {
      const o = b * 16;
      at[o + 7] = { cond: '1:2', vel: 70 };
      at[o + 15] = { cond: '50%', vel: 64 };
      at[o + 10] = { micro: 3 };
    }
    at[59] = { cond: 'FILL' };
    return at;
  };

  // ---- bass (16 notes a bar, offbeat octave pops and slides)
  const bassBar = 'x..x..a.x.xs..xx';
  const bassNotes = CHORDS.flatMap(c => [c.root, c.root, c.root + 12, c.root, c.root, c.root + 7, c.root + 3, c.root - 2]);
  const bassL: Record<number, Locks> = {};
  const bassAt: Record<number, Partial<Step>> = {};
  for (let b = 0; b < 4; b++) {
    bassL[b * 16 + 6] = { flt1_frq: 58, flt1_ovr: 40 };
    bassAt[b * 16 + 10] = { len: LEN.s1_5 };
  }

  // ---- stabs: offbeat two-note chords, the third locked per bar
  const stabBar = '..x....x..x.....';
  const stabsL = (extra: Locks = {}): Record<number, Locks> => {
    const L: Record<number, Locks> = {};
    CHORDS.forEach((c, b) => [2, 7, 10].forEach(s => (L[b * 16 + s] = { osc2_tun: c.third, ...extra, ...(s === 10 ? { flt1_frq: 70 } : {}) })));
    return L;
  };
  const stabNotes = CHORDS.flatMap(c => [c.stab, c.stab, c.stab]);
  const padL = (frq: number): Record<number, Locks> => {
    const L: Record<number, Locks> = {};
    CHORDS.forEach((c, b) => (L[b * 16] = { osc2_tun: c.third, amp_atk: 74, amp_sus: 110, amp_rel: 84, flt1_frq: frq, amp_rev: 96, amp_del: 0 }));
    return L;
  };

  // ---- arp: one long note a bar, the arpeggiator plays the chord
  const arpL = (extra: (b: number) => Locks = () => ({})): Record<number, Locks> => {
    const L: Record<number, Locks> = {};
    CHORDS.forEach((c, b) => (L[b * 16] = { arp_n2: c.third, ...extra(b) }));
    return L;
  };
  const arpNotes = CHORDS.map(c => c.arp);

  // ---- lead melody for the breakdown
  const melody: [number, number, number][] = [
    [0, 76, LEN.s2], [2, 74, LEN.s2], [4, 72, LEN.s4], [10, 69, LEN.s4], [14, 72, LEN.s2],
    [16, 69, LEN.s2], [18, 72, LEN.s2], [20, 77, LEN.s6], [28, 76, LEN.s2], [30, 74, LEN.s2],
    [32, 76, LEN.s4], [36, 79, LEN.s4], [42, 76, LEN.s2], [44, 72, LEN.s4],
    [48, 74, LEN.s8], [56, 71, LEN.s4], [60, 74, LEN.s2], [62, 76, LEN.s2],
  ];
  const leadS = Array.from({ length: 64 }, (_, i) => (melody.some(m => m[0] === i) ? 'x' : '.')).join('');
  const leadAt: Record<number, Partial<Step>> = Object.fromEntries(melody.map(([s, , l]) => [s, { len: l }]));
  const leadLocks: Locks = { arp_mod: 0, amp_dec: 80, amp_sus: 90, amp_rel: 56, flt1_frq: 82, flt1_dep: 14, amp_del: 84, amp_rev: 50, osc_vib: 18, osc_vfa: -20 };

  const intro = pat('INTRO', 64, [
    { s: rep('..x...x...x...x.', 3) + '..x...x...x.x.xx', L: (() => { const L = drumsL(4, false); [56, 58, 60].forEach(s => (L[s] = HH)); L[62] = SN; L[63] = SN; return L; })(), at: { 63: { vel: 80 } } },
    null,
    { s: rep('x...............', 4), n: CHORDS.map(c => c.stab), len: LEN.s16, L: padL(56) },
    { s: rep('p...............', 3) + 'x...............', n: arpNotes, len: LEN.s16, L: arpL(b => ({ flt1_frq: 50 + b * 8, amp_rev: 70 })) },
  ]);
  const groove = pat('GROOVE', 64, [
    { s: rep(grooveBar, 4), L: drumsL(4, true), at: drumsAt(4) },
    { s: rep(bassBar, 4), n: bassNotes, L: bassL, at: bassAt },
    { s: rep(stabBar, 4), n: stabNotes, len: LEN.s2, L: stabsL() },
    { s: rep('x...............', 4), n: arpNotes, len: LEN.s16, L: arpL() },
  ]);
  const breakdown = pat('BREAK', 64, [
    null,
    { s: rep('x...............', 4), n: CHORDS.map(c => c.root - 12), len: LEN.s16, all: { flt1_frq: 50, amp_sus: 110, amp_dec: 96, amp_rel: 60, flt1_dep: 4 } },
    { s: rep('x...............', 4), n: CHORDS.map(c => c.stab), len: LEN.s16, L: padL(70) },
    { s: leadS, n: melody.map(m => m[1]), all: leadLocks, at: leadAt },
  ]);
  const drop = pat('DROP', 64, [
    { s: rep('xxxxx.xxxxxxx.xx', 4), L: (() => {
      const L: Record<number, Locks> = {};
      for (let b = 0; b < 4; b++) {
        const o = b * 16;
        [1, 2, 6, 7, 9, 11, 14].forEach(s => (L[o + s] = s === 1 || s === 9 ? { ...HH, amp_vol: 56 } : HH));
        [4, 12].forEach(s => (L[o + s] = SN));
        L[o + 15] = b === 3 ? SN : OH;
      }
      return L;
    })(), at: (() => {
      const at: Record<number, Partial<Step>> = {};
      for (let b = 0; b < 4; b++) { at[b * 16 + 7] = { cond: '1:2' }; at[b * 16 + 11] = { micro: 4, vel: 80 }; at[b * 16 + 3] = { cond: '!1ST' }; }
      return at;
    })() },
    { s: rep(bassBar, 4), n: bassNotes, L: (() => { const L: Record<number, Locks> = {}; for (let b = 0; b < 4; b++) { L[b * 16] = { flt1_frq: 52, flt1_ovr: 30 }; L[b * 16 + 6] = { flt1_frq: 64, flt1_ovr: 70, flt1_res: 90 }; } return L; })(), at: bassAt },
    { s: rep('..x..x.x..x..x..', 4), n: CHORDS.flatMap(c => [c.stab, c.stab, c.stab, c.stab, c.stab]), len: LEN.s2, L: (() => {
      const L: Record<number, Locks> = {};
      CHORDS.forEach((c, b) => [2, 5, 7, 10, 13].forEach(s => (L[b * 16 + s] = { osc2_tun: c.third, flt1_frq: s === 13 ? 76 : 64 })));
      return L;
    })() },
    { s: rep('x...............', 4), n: arpNotes, len: LEN.s16, L: arpL(b => ({ arp_rng: 3, ...(b === 3 ? { arp_spd: 3 } : {}), flt1_frq: 76 })) },
  ]);
  return project(
    { A01: intro, A02: groove, A03: breakdown, A04: drop },
    {
      song: [
        { pattern: 'A01', repeats: 1 }, { pattern: 'A02', repeats: 2 }, { pattern: 'A03', repeats: 1 },
        { pattern: 'A04', repeats: 2 }, { pattern: 'A02', repeats: 1 },
      ],
      loopRow: 1, mode: 'song', songName: 'NIGHT DRIVE', chain: ['A01', 'A02', 'A02', 'A03', 'A04'],
    },
  );
}

// ---- Acid Workout -------------------------------------------------------------

function acid(): Project {
  // T1 acid line (C minor), slides need the previous note to overlap: len 1.5 steps before slides
  const line1 = 'axxsx.asxxasx.xs';
  const notes1 = [36, 48, 36, 39, 36, 43, 48, 36, 46, 36, 51, 36, 41, 43];
  const at1: Record<number, Partial<Step>> = { 2: { len: LEN.s1_5 }, 6: { len: LEN.s1_5 }, 10: { len: LEN.s1_5 }, 14: { len: LEN.s1_5 } };
  const L1: Record<number, Locks> = { 6: { flt1_frq: 54 }, 10: { flt1_frq: 58, flt1_res: 112 } };
  const line2 = 'axsxxsaxxsxxaxsx';
  const notes2 = [36, 36, 48, 39, 41, 43, 36, 46, 48, 36, 39, 51, 43, 46];
  const at2: Record<number, Partial<Step>> = { 1: { len: LEN.s1_5 }, 4: { len: LEN.s1_5 }, 8: { len: LEN.s1_5 }, 13: { len: LEN.s1_5 } };
  const kick = { s: 'x...x...x...x...' };
  const hats = { s: '..x...x...x...xx', L: { 14: { amp_dec: 60 } }, at: { 15: { vel: 60, cond: '1:2' } } };
  const clap = { s: '....x.......x...' };
  const a1 = pat('ACID 1', 16, [{ s: line1, n: notes1, at: at1, L: L1 }, kick, hats, clap]);
  // filter rising over the pattern with parameter slides, more resonance
  const a2 = pat('ACID 2', 16, [{ s: line1, n: notes1, at: at1, L: { 0: { flt1_frq: 44 }, 4: { flt1_frq: 50 }, 8: { flt1_frq: 58, flt1_res: 112, flt1_ovr: 70 }, 12: { flt1_frq: 66, flt1_res: 118, flt1_ovr: 86 } } }, kick, { s: 'x.x.x.x.x.x.x.xx', at: { 1: { vel: 50 }, 3: { vel: 50 } } }, clap]);
  const a3 = pat('ACID 3', 16, [{ s: line2, n: notes2, at: at2, L: { 12: { flt1_frq: 70, flt1_res: 118 } } }, kick, hats, { s: '....x.......x..x', at: { 15: { cond: 'FILL' } } }]);
  const brk = pat('BREAK', 16, [{ s: line2, n: notes2, at: at2, all: { flt1_frq: 40, amp_del: 60 } }, null, hats, null]);
  return project({ A01: a1, A02: a2, A03: a3, A04: brk }, {
    song: [{ pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 4 }, { pattern: 'A04', repeats: 2 }, { pattern: 'A03', repeats: 4 }, { pattern: 'A02', repeats: 2 }],
    songName: 'ACID WORKOUT', chain: ['A01', 'A02', 'A03'],
  });
}

// ---- Dub Techno Chords -----------------------------------------------------------

function dub(): Project {
  // D minor chord stabs (osc2 +3, sub on) drowned in delay; FX track trigs throw the delay
  const kick = { s: 'x...x...x...x...' };
  const chord = { s: '..x.......x.....', n: [62, 62], len: LEN.s2, L: { 10: { flt1_frq: 66 } } };
  const chord2 = { s: '..x....x..x.....', n: [62, 60, 58], len: LEN.s2, L: { 7: { osc2_tun: 4, flt1_frq: 60 }, 10: { osc2_tun: 3, flt1_frq: 70 } } };
  const hats = { s: '..x...x...x...x.', at: { 6: { micro: 2 }, 14: { micro: 3, cond: '75%' } } };
  const sub = { s: 'x.....x...x.....', n: [38, 38, 41], len: LEN.s3 };
  // a lock trig on step 1 brings the delay back: the next FX trig reverts what it doesn't lock
  const throwFx = { s: 'l.............l.', L: { 14: { del_fb: 112, del_vol: 120 } } };
  const p1 = pat('DUB 1', 16, [kick, chord, hats, sub, throwFx]);
  const p2 = pat('DUB 2', 32, [
    { s: rep('x...x...x...x...', 2) },
    { s: rep('..x....x..x.....', 2), n: [62, 60, 58, 62, 65, 62], len: LEN.s2, L: { 7: { osc2_tun: 4 }, 23: { osc2_tun: 4, flt1_frq: 72 }, 26: { flt1_frq: 74 } } },
    { s: rep('..x...x...x...x.', 2), at: { 14: { cond: '1:2' }, 30: { cond: '1:2' } } },
    { s: rep('x.....x...x.....', 2), n: [38, 38, 41, 38, 38, 36], len: LEN.s3 },
    { s: 'l.............l.l.............l.', L: { 14: { del_fb: 100 }, 30: { del_fb: 118, del_tim: 32 } } },
  ]);
  const p3 = pat('DUB BREAK', 16, [null, { ...chord, all: { amp_rev: 120 } }, { s: '......x.......x.' }, null, { s: 'l.......l.......', L: { 0: { rev_dec: 110 }, 8: { del_fb: 105 } } }]);
  return project({ A01: p1, A02: p2, A03: p3 }, {
    song: [{ pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 4 }, { pattern: 'A03', repeats: 2 }, { pattern: 'A02', repeats: 4 }],
    songName: 'DUB CHORDS', chain: ['A01', 'A02'],
  });
}

// ---- Ambient Drift -----------------------------------------------------------------

function ambient(): Project {
  const pad = { s: 'x...............x...............', n: [57, 53], len: LEN.s16 };
  const bells = { s: '..x.....x..x......x...x.....x...', n: [76, 79, 72, 74, 81, 69], at: { 2: { cond: '50%' }, 11: { cond: '1:2' }, 22: { cond: '75%' }, 28: { cond: '2:3' } } };
  const sub = { s: 'x...............x...............', n: [33, 29], len: LEN.s16 };
  const wind = { s: 'x...............................', len: LEN.s32 };
  const a = pat('DRIFT 1', 32, [pad, bells, sub, wind]);
  const b = pat('DRIFT 2', 32, [
    { s: 'x.......x.......x...............', n: [60, 55, 57], len: LEN.s8, L: { 16: { amp_rel: 110 } }, at: { 16: { len: LEN.s16 } } },
    { s: 'x..x....x..x..x...x..x....x..x..', n: [72, 76, 79, 76, 74, 72, 71, 74, 76, 79], at: { 3: { cond: '50%' }, 11: { cond: '50%' }, 21: { cond: '1:2' }, 29: { cond: '!1ST' } } },
    { s: 'x.......x.......x...............', n: [36, 31, 33], len: LEN.s8 },
    { s: 'x...............................', len: LEN.s32, L: { 0: { flt1_res: 90 } } },
  ]);
  return project({ A01: a, A02: b }, { song: [{ pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 4 }], songName: 'DRIFT', chain: ['A01', 'A02'] });
}

// ---- Electro Funk ------------------------------------------------------------------

function electro(): Project {
  const drums = { s: 'x..x..x.x.xx..x.', L: { 6: SN, 14: SN, 3: HH, 11: HH }, at: { 11: { micro: 3 }, 15: { cond: 'FILL' } } };
  const bass = { s: 'x..s..x.x..x.sx.', n: [40, 47, 40, 40, 43, 47, 40], at: { 0: { len: LEN.s1_5 }, 11: { len: LEN.s1_5 } } };
  const clav = { s: '..x...x...x.x...', n: [64, 64, 67, 64], len: LEN.s1 };
  const lead = { s: 'x.....x...x.....x.x...x.....x...', n: [76, 79, 76, 74, 72, 74, 71], at: { 0: { len: LEN.s4 }, 16: { len: LEN.s2 }, 28: { len: LEN.s4 } } };
  const p1 = pat('FUNK', 16, [drums, bass, clav, null], { swing: 58 });
  const p2 = pat('FUNK LEAD', 32, [
    { ...drums, s: rep(drums.s, 2), L: { ...drums.L, 22: SN, 30: SN, 19: HH, 27: HH } },
    { ...bass, s: rep(bass.s, 2) },
    { ...clav, s: rep(clav.s, 2), n: [64, 64, 67, 64, 65, 65, 69, 65] },
    lead,
  ], { swing: 58 });
  return project({ A01: p1, A02: p2 }, { song: [{ pattern: 'A01', repeats: 4 }, { pattern: 'A02', repeats: 4 }], songName: 'ELECTRO FUNK', chain: ['A01', 'A02'] });
}

// ---- Arp Garden -------------------------------------------------------------------

function arps(): Project {
  const chordNotes = [60, 57, 53, 55];
  const third = [4, 3, 4, 4];
  const arpA = { s: rep('x...............', 4), n: chordNotes, len: LEN.s16, L: Object.fromEntries(third.map((t, b) => [b * 16, { arp_n2: t }])) };
  const arpB = { s: rep('x.......x.......', 4), n: chordNotes.flatMap(n => [n + 12, n + 12]), len: LEN.s8, L: Object.fromEntries(third.flatMap((t, b) => [[b * 16, { arp_n2: t }], [b * 16 + 8, { arp_n2: t, arp_mod: 3 }]])) };
  const pad = { s: rep('x...............', 4), n: chordNotes.map(n => n - 12), len: LEN.s16, L: Object.fromEntries(third.map((t, b) => [b * 16, { osc2_tun: 12 + t }])) };
  const kick = { s: rep('x...x...x...x...', 4) };
  const a = pat('GARDEN', 64, [arpA, null, pad, null]);
  const b = pat('GARDEN FULL', 64, [arpA, arpB, pad, kick]);
  return project({ A01: a, A02: b }, { song: [{ pattern: 'A01', repeats: 2 }, { pattern: 'A02', repeats: 4 }], songName: 'ARP GARDEN', chain: ['A01', 'A02'] });
}

export const KITS: KitDef[] = [
  {
    id: 'night-drive', name: 'Kit / Night Drive (demo song)', tempo: 122,
    desc: 'The demo song: intro, groove, breakdown and drop in A minor. Drums on one track with p-locked snare and hats, a slide bass, two-note chord stabs and an arpeggio.',
    tracks: [
      { sound: 'drum-kick', p: { noise_col: 30 } },
      { sound: 'bass-rubber', p: { flt1_frq: 46, flt1_res: 76, flt1_dep: 34, envf_dec: 48, amp_dec: 58, amp_rel: 26, amp_vol: 104 } },
      { sound: 'keys-brass', p: { osc2_det: 0, osc2_tun: 3, flt1_frq: 62, amp_dec: 70, amp_sus: 50, amp_del: 40, amp_rev: 50, amp_vol: 92 } },
      { sound: 'arp-pulse', p: { arp_n4: 12, arp_rng: 2, amp_del: 70, amp_rev: 40, amp_vol: 88 } },
    ],
    fx: { del_tim: 24, del_fb: 64, del_lpf: 96, rev_dec: 84, rev_pre: 10 },
    project: nightDrive,
  },
  {
    id: 'acid', name: 'Kit / Acid Workout', tempo: 126,
    desc: 'A transistor-pulse acid line with accents and slides, kick, hats and clap. Pattern 2 sweeps the filter with parameter slides.',
    tracks: [
      { sound: 'bass-acid', p: { amp_del: 24 } },
      { sound: 'drum-kick' },
      { sound: 'drum-hat' },
      { sound: 'drum-clap' },
    ],
    fx: { del_tim: 24, del_fb: 56, del_lpf: 90, rev_dec: 56 },
    project: acid,
  },
  {
    id: 'dub', name: 'Kit / Dub Chords', tempo: 118,
    desc: 'Dub-techno minor chord stabs soaked in delay and reverb; FX track lock trigs "throw" the delay feedback.',
    tracks: [
      { sound: 'drum-kick', p: { amp_dec: 82, flt1_frq: 64, env2_depa: 70 } },
      { sound: 'keys-brass', p: { osc2_det: 0, osc2_tun: 3, osc1_sub: 1, flt1_frq: 56, flt1_res: 50, flt1_dep: 20, envf_dec: 56, envf_sus: 0, amp_dec: 66, amp_sus: 0, amp_rel: 40, amp_del: 100, amp_rev: 80, amp_vol: 96 } },
      { sound: 'drum-hat', p: { amp_rev: 50, amp_vol: 70 } },
      { sound: 'bass-sub', p: { amp_vol: 104 } },
    ],
    fx: { del_tim: 24, del_fb: 82, del_lpf: 80, del_hpf: 30, del_x: 1, rev_dec: 100, rev_gai: 70, cho_dep: 40 },
    project: dub,
  },
  {
    id: 'ambient', name: 'Kit / Ambient Drift', tempo: 84,
    desc: 'Slow string pad, glassy bells with trig conditions for a generative feel, sub bass and filtered wind noise.',
    tracks: [
      { sound: 'pad-strings' },
      { sound: 'pluck-glass', p: { amp_rev: 110, amp_del: 80, amp_vol: 84 } },
      { sound: 'bass-sub', p: { amp_atk: 50, amp_rel: 70, amp_vol: 96 } },
      { sound: 'fx-riser', p: { lfo1_mod: 0, lfo1_wav: 1, lfo1_spd: 3, lfo1_depa: 30, flt1_frq: 60, amp_vol: 70, amp_atk: 100, noise_col: -20 } },
    ],
    fx: { rev_dec: 118, rev_pre: 30, rev_gai: 60, del_tim: 48, del_fb: 76, del_lpf: 80, cho_dep: 80 },
    project: ambient,
  },
  {
    id: 'electro', name: 'Kit / Electro Funk', tempo: 112,
    desc: 'Swung drums with p-locked snare and hats, a sync bass with slides, clav stabs and a square lead.',
    tracks: [
      { sound: 'drum-kick', p: { env2_depa: 90 } },
      { sound: 'bass-sync' },
      { sound: 'keys-clav', p: { amp_del: 30 } },
      { sound: 'lead-square' },
    ],
    fx: { del_tim: 16, del_fb: 40 },
    project: electro,
  },
  {
    id: 'arps', name: 'Kit / Arp Garden', tempo: 120,
    desc: 'Two arpeggiators in different modes over a PWM pad, chords changing every bar through note and offset locks.',
    tracks: [
      { sound: 'arp-bubble', p: { arp_n4: 12, amp_vol: 86 } },
      { sound: 'arp-pulse', p: { osc1_wav: 3, amp_vol: 80, amp_pan: -20, arp_spd: 12, arp_n4: 0 } },
      { sound: 'pad-pwm', p: { amp_vol: 84 } },
      { sound: 'drum-kick' },
    ],
    fx: { del_tim: 24, del_fb: 66, rev_dec: 90 },
    project: arps,
  },
];

export const KIT_BY_ID: Record<string, KitDef> = Object.fromEntries(KITS.map(k => [k.id, k]));
/** Option list of the hidden `kit_project` switch: 0 = none, 1 = an empty project, then the kits */
export const KIT_PROJECT_IDS = ['---', 'init', ...KITS.map(k => k.id)];

/** The project a `kit_project` index loads (null for 0) */
export function projectFor(index: number): Project | null {
  if (index <= 0) return null;
  if (index === 1) return project({});
  const kit = KITS[index - 2];
  return kit ? kit.project() : null;
}

/** Preset settings of a single sound: it goes to track 1 (the rest of the kit takes its defaults) */
export function soundPresetValues(s: SoundDef): Record<string, number> {
  const out: Record<string, number> = { track: 0, page: V.OSC1 };
  for (const [k, v] of Object.entries(s.p)) out[tid(0, k)] = v;
  if (s.oct !== undefined) out.kb_oct = s.oct + 3;
  return out;
}

/** Every track parameter of a sound, for loading it into one track (SOUND menu) */
export function soundTrackValues(s: SoundDef, track: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key in SYNTH_BY_KEY) {
    if (key.startsWith('trig_') || key === 'level') continue;
    out[tid(track, key)] = s.p[key] ?? SYNTH_BY_KEY[key].def;
  }
  return out;
}

void dest;
