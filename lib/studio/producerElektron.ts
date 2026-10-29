// ============================================================================
// The Producer path's Elektron studio (docs/research/producer-path/curriculum.md,
// set `elektron-live`): the Studio Clock, an Analog Rytm on Xone:96 channel 1 and
// an Analog Four on channel 2, both following the studio clock the way MIDI-synced
// machines do. The learner's track is "Low Tide": deep house in A minor at 124
// BPM, built with the sounds of Demo 1 ("Low Tide Lights", demo-tracks.md) - the
// Rytm kit PRODUCER and the Analog Four kit PRODUCER below.
//
// Each lesson starts from a checkpoint: this studio plus the work of the lessons
// before it (CP-00 … CP-14 in the curriculum), written in the instruments' own
// data formats (docs/ELEKTRON_SEQUENCER.md). Trigs are numbered 1..64 like the
// trig keys, as in the lesson text.
// ============================================================================

import type { ControlValue, LessonStudioStart, LessonTrig } from '@/types';
import { createPattern, createProject, type Pattern, type Project, type Step } from '@/lib/sequencer/elektron';
import { PAGE, SEQ_TRACKS as RYTM_TRACKS } from '@/devices/analog-rytm/model';
import { DEFAULT_PERFS, DEFAULT_SCENES, PROJECT_RV, kitValues, type RytmProject } from '@/devices/analog-rytm/presets';
import { SEQ_TRACKS as A4_TRACKS, V, dest, fxid, tid } from '@/devices/analog-four/params';
import { SRC } from '@/devices/xone96/model';
import { XONE96_PRESETS } from '@/devices/xone96/presets';
import { SUB37_PRESETS } from '@/devices/sub37/presets';

type Values = Record<string, ControlValue>;
type Trigs = Record<number, LessonTrig>;

// ---- instruments and tracks ------------------------------------------------------------

export const RYTM = 'analog-rytm';
export const A4 = 'analog-four';
export const XONE = 'xone96';
export const CLOCK = 'studio-clock';
export const SUB = 'sub37';

/** Analog Rytm tracks (sequencer and pad order) */
export const BD = 0, SD = 1, RS = 2, CP = 3, LT = 5, CH = 8, OH = 9, CY = 10;
/** Analog Four synth tracks */
export const T1 = 0, T2 = 1, T3 = 2, T4 = 3;

export const BPM = 124;

// ---- notes and lengths ------------------------------------------------------------------

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'A2' -> 45 (C4 = MIDI 60, the app-wide convention) */
export function nn(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`producer: bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** Note lengths: NOTE_LENGTHS indices (0.5 step = 1/32, 1 step = 1/16, 1.5, 2 = 1/8, 4, 16 = a bar) */
export const LEN = { half: 6, one: 14, oneHalf: 22, two: 30, three: 38, four: 46, bar: 78 } as const;

// ---- the Analog Rytm kit PRODUCER (Demo 1's "LOW TIDE" sounds) -----------------------------

/**
 * BD HARD tuned to A1 (55 Hz at TUN 0): the kick sits in the key, an octave under the bass's A2.
 * A clap on the backbeat, hats into the high-pass, a rim and a low tom for answers, a snare for
 * fills and a ride; the FX track has a dotted-8th ping-pong delay and a short plate-like reverb.
 */
export const RYTM_KIT: Values = kitValues({
  bd: { machine: 'BD HARD', tun: 0, swt: 38, snp: 52, dec: 50, hld: 12, wav: 0, tic: 30, lev: 110, flt_typ: 0, flt_frq: 127, amp_atk: 0, amp_dec: 127, amp_ovr: 18, amp_pan: 0, amp_vol: 112 },
  sd: { machine: 'SD HARD', tun: 2, swd: 40, swt: 30, dec: 30, tic: 50, nod: 38, nol: 80, lev: 100, flt_typ: 4, flt_frq: 30, amp_dec: 127, amp_rev: 40, amp_vol: 92 },
  rs: { machine: 'RS HARD', tun: 5, swd: 20, swt: 10, dec: 20, sym: 10, nol: 20, tic: 60, lev: 100, flt_typ: 4, flt_frq: 50, amp_del: 70, amp_rev: 20, amp_pan: -20, amp_vol: 80 },
  cp: { machine: 'CP CLASSIC', ton: 72, num: 2, rat: 50, nod: 48, nol: 80, rnd: 25, cpd: 50, lev: 100, flt_typ: 4, flt_frq: 41, amp_rev: 45, amp_pan: 0, amp_vol: 96 },
  lt: { machine: 'XT CLASSIC', tun: 28, dec: 40, swd: 30, swt: 50, nol: 20, nod: 30, flt_typ: 0, flt_frq: 127, amp_del: 25, amp_pan: -12, amp_vol: 84 },
  ch: { machine: 'CH CLASSIC', tun: 0, col: 10, dec: 24, lev: 100, flt_typ: 4, flt_frq: 58, amp_pan: 8, amp_vol: 80 },
  oh: { machine: 'OH CLASSIC', tun: 0, col: 10, dec: 55, lev: 100, flt_typ: 4, flt_frq: 58, amp_rev: 10, amp_pan: 8, amp_vol: 84 },
  cy: { machine: 'CY RIDE', tun: 0, typ: 1, hit: 30, dec: 60, c1: 90, c2: 64, c3: 64, lev: 90, flt_typ: 4, flt_frq: 64, amp_rev: 15, amp_pan: 25, amp_vol: 78 },
}, {
  del_tim: 24, del_x: 1, del_wid: 63, del_fdb: 72, del_hpf: 48, del_lpf: 88, del_rev: 24, del_vol: 96,
  rev_pre: 10, rev_dec: 58, rev_frq: 90, rev_gai: 84, rev_hpf: 40, rev_lpf: 86, rev_vol: 90,
  dis_amt: 8, dis_sym: 0, dis_dov: 0, dis_del: 0, dis_rev: 0,
  cmp_thr: 98, cmp_atk: 3, cmp_rel: 6, cmp_mup: 12, cmp_rat: 1, cmp_seq: 2, cmp_mix: 127, cmp_vol: 100,
});

/** The kick a few semitones under the key (F#1): the start of the tuning step in Bass locked to the kick */
export const KICK_OFF_KEY = -3;

/** A Rytm pattern: trigs per track by trig number, linked to kit 01 */
export function rytmPattern(name: string, tracks: Partial<Record<number, Trigs>>, opts: { length?: number; swing?: number } = {}): Pattern {
  const p = createPattern(RYTM_TRACKS, { name, length: opts.length ?? 16, swing: opts.swing ?? 50, kit: '01' });
  for (const [t, trigs] of Object.entries(tracks)) {
    for (const [n, x] of Object.entries(trigs ?? {})) p.tracks[Number(t)].steps[Number(n) - 1] = toStep(x);
  }
  return p;
}

/** The Rytm's project: kit 01 holds the PRODUCER kit, every pattern links it (no kit changes) */
export function rytmProject(patterns: Record<string, Pattern>, kit: Values = RYTM_KIT): RytmProject {
  const base = createProject({ tracks: RYTM_TRACKS, defaults: { note: 60, vel: 100 }, active: 'A01', mode: 'pattern', patterns });
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries(kit)) if (typeof v === 'number') values[k] = v;
  return { ...base, kit: '01', kits: { '01': { name: 'PRODUCER', values, scenes: DEFAULT_SCENES(), perfs: DEFAULT_PERFS() } }, rv: PROJECT_RV };
}

/** Panel state for the Rytm: GRID RECORDING on, the TRIG page, AUTO TRK SWITCH on (a pad tap selects its track) */
export const rytmPanel = (track = BD): Values => ({ bpm: BPM, kit_demo: 0, track, page: PAGE.TRIG, rec: 1, auto_trk: 1, play: false });

// ---- the Analog Four kit PRODUCER -----------------------------------------------------------

/** One A4 track's sound: init values plus these (keys without the track prefix), and the NOTE page */
function a4Track(t: number, p: Record<string, number>, trig: { note: number; len: number; vel?: number }): Values {
  const out: Values = {};
  for (const [k, v] of Object.entries(p)) out[tid(t, k)] = v;
  out[tid(t, 'trig_note')] = trig.note;
  out[tid(t, 'trig_vel')] = trig.vel ?? 100;
  out[tid(t, 'trig_len')] = trig.len;
  return out;
}

/**
 * T2 and T3 are the chord-memory trick: each plays a two-note interval, so one NOTE on both
 * plays a four-note minor-seventh chord (T2 root and fifth, T3 the minor third and seventh).
 * A short stab: instant attack, about 0.16 s of decay, no sustain, into chorus, delay and reverb.
 */
const STAB: Record<string, number> = {
  osc1_wav: 0, osc2_wav: 0, flt1_frq: 65, flt1_res: 30, flt1_trk: 16, flt1_dep: 26, flt2_typ: 4, flt2_frq: 38,
  envf_atk: 0, envf_dec: 52, envf_sus: 0, envf_rel: 40,
  amp_atk: 0, amp_dec: 66, amp_sus: 0, amp_rel: 40, amp_cho: 40, amp_del: 60, amp_rev: 45, amp_vol: 88,
};

/** The stabs' slow filter LFO (Movement): F1 FRQ, SPD 8 x MUL x1 = one cycle every 16 bars */
export const STAB_LFO: Record<string, number> = { lfo1_spd: 8, lfo1_mul: 0, lfo1_wav: 0, lfo1_mod: 0, lfo1_dsta: dest('F1 FRQ'), lfo1_depa: 12 };

export const T1_BASS: Record<string, number> = {
  osc1_wav: 0, osc1_sub: 1, osc1_lev: 100, osc2_lev: 0,
  flt1_frq: 60, flt1_res: 22, flt1_ovr: 8, flt1_trk: 32, flt1_dep: 20, flt2_typ: 4, flt2_frq: 15,
  envf_atk: 0, envf_dec: 40, envf_sus: 0, envf_rel: 20,
  amp_atk: 0, amp_dec: 40, amp_sus: 70, amp_rel: 12, amp_pan: 0, amp_vol: 110,
};

/** The bass after the length match of Bass locked to the kick: a pluck that ends well before the next kick */
export const T1_PLUCK: Record<string, number> = { amp_sus: 0, amp_dec: 60 };

export const T2_STAB: Record<string, number> = { ...STAB, osc1_lev: 85, osc1_tun: 0, osc2_lev: 75, osc2_tun: 7, osc2_det: 6, amp_pan: -12 };
export const T3_STAB: Record<string, number> = { ...STAB, osc1_lev: 80, osc1_tun: 3, osc2_lev: 75, osc2_tun: 10, osc2_det: -6, amp_pan: 12 };

/** T4: a glass pluck, a pulse and a triangle an octave up, about 1 kHz at the hook's notes, into the delay */
export const T4_PLUCK: Record<string, number> = {
  osc1_wav: 2, osc1_pw: -20, osc1_lev: 90, osc2_wav: 3, osc2_tun: 12, osc2_lev: 50,
  flt1_frq: 67, flt1_res: 40, flt1_trk: 16, flt1_dep: 30, flt2_typ: 3, flt2_frq: 54,
  envf_atk: 0, envf_dec: 46, envf_sus: 10, envf_rel: 30,
  amp_atk: 0, amp_dec: 58, amp_sus: 40, amp_rel: 50, amp_cho: 30, amp_del: 70, amp_rev: 50, amp_pan: 0, amp_vol: 90,
};

/** Trig defaults of T1-T4: the NOTE page (A2, A3, A3, E5; one step) */
const A4_DEFAULTS = [
  { note: nn('A2'), vel: 100, len: LEN.one }, { note: nn('A3'), vel: 100, len: LEN.one },
  { note: nn('A3'), vel: 100, len: LEN.one }, { note: nn('E5'), vel: 100, len: LEN.one },
];

const A4_FX: Values = Object.fromEntries(Object.entries({
  cho_pre: 20, cho_spd: 28, cho_dep: 56, cho_wid: 110, cho_fb: 8, cho_hpf: 40, cho_lpf: 120, cho_vol: 90,
  del_tim: 24, del_x: 1, del_fb: 52, del_ovr: 8, del_hpf: 40, del_lpf: 80, del_rev: 30, del_vol: 95,
  rev_pre: 14, rev_dec: 82, rev_gai: 70, rev_hpf: 36, rev_lpf: 76, rev_vol: 92,
}).map(([k, v]) => [fxid(k), v]));

/** The A4 kit: sounds of T1-T4 (overrides per track) and the FX track */
export function a4Kit(over: { t1?: Record<string, number>; t2?: Record<string, number>; t3?: Record<string, number>; t4?: Record<string, number> } = {}): Values {
  return {
    ...a4Track(T1, { ...T1_BASS, ...(over.t1 ?? {}) }, A4_DEFAULTS[0]),
    ...a4Track(T2, { ...T2_STAB, ...(over.t2 ?? {}) }, A4_DEFAULTS[1]),
    ...a4Track(T3, { ...T3_STAB, ...(over.t3 ?? {}) }, A4_DEFAULTS[2]),
    ...a4Track(T4, { ...T4_PLUCK, ...(over.t4 ?? {}) }, A4_DEFAULTS[3]),
    ...A4_FX,
  };
}

/** Panel state for the A4: GRID RECORDING on, the NOTE page, no kit project to load */
export const a4Panel = (track = T1): Values => ({ tempo: BPM, kit_project: 0, kit_project_loaded: 0, track, page: V.NOTE, rec: true, play: false });

/**
 * An A4 pattern: trigs per track by trig number, with the NOTE page's defaults on each track.
 * Note trigs carry their NOTE, VEL and LEN, as the A4 stamps them when they are placed.
 */
export function a4Pattern(
  name: string, tracks: Partial<Record<number, Trigs>>,
  opts: { length?: number; swing?: number; defaults?: Partial<Record<number, { note?: number; vel?: number; len?: number }>> } = {},
): Pattern {
  const p = createPattern(A4_TRACKS, { name, length: opts.length ?? 16, swing: opts.swing ?? 50 });
  A4_DEFAULTS.forEach((d, t) => Object.assign(p.tracks[t], d, opts.defaults?.[t] ?? {}));
  for (const [t, trigs] of Object.entries(tracks)) {
    const ti = Number(t);
    const d = ti < A4_DEFAULTS.length ? p.tracks[ti] : undefined;
    for (const [n, x] of Object.entries(trigs ?? {})) {
      const s = toStep(x);
      p.tracks[ti].steps[Number(n) - 1] = s.trigless || !d ? s : { note: d.note, vel: d.vel, len: d.len, ...s };
    }
  }
  return p;
}

export function a4Project(patterns: Record<string, Pattern>): Project {
  const defaults = [...A4_DEFAULTS, {}, {}];
  return createProject({ tracks: A4_TRACKS, defaults, active: 'A01', mode: 'pattern', patterns });
}

// ---- trigs -------------------------------------------------------------------------------

function toStep(t: LessonTrig): Step {
  const s: Step = {};
  if (t.note !== undefined) s.note = t.note;
  if (t.vel !== undefined) s.vel = t.vel;
  if (t.len !== undefined) s.len = t.len;
  if (t.micro) s.micro = t.micro;
  if (t.cond) s.cond = t.cond;
  if (t.retrig) s.retrig = { ...t.retrig };
  if (t.trigless) s.trigless = true;
  if (t.accent) s.accent = true;
  if (t.slide) s.slide = true;
  if (t.pslide) s.pslide = true;
  if (t.locks && Object.keys(t.locks).length) s.locks = { ...t.locks };
  return s;
}

/** The same trig on several trig numbers */
export const on = (nums: number[], t: LessonTrig = {}): Trigs => Object.fromEntries(nums.map(n => [n, { ...t }]));

/** Melodic trigs from parallel lists: trig numbers, note names, and optional velocities and lengths (LEN indices) */
export function line(nums: number[], notes: string[], vels?: number[], lens?: number[]): Trigs {
  const out: Trigs = {};
  nums.forEach((n, i) => {
    out[n] = { note: nn(notes[i] ?? notes[notes.length - 1]), ...(vels ? { vel: vels[i] } : {}), ...(lens ? { len: lens[i] } : {}) };
  });
  return out;
}

/** Merge trig maps (later ones win per trig, locks merged) */
export function merge(...maps: Trigs[]): Trigs {
  const out: Trigs = {};
  for (const m of maps) {
    for (const [k, t] of Object.entries(m)) {
      const n = Number(k);
      const cur = out[n] ?? {};
      out[n] = { ...cur, ...t, ...(cur.locks || t.locks ? { locks: { ...(cur.locks ?? {}), ...(t.locks ?? {}) } } : {}) };
    }
  }
  return out;
}

// ---- the course track, lesson by lesson ------------------------------------------------------

/** First beat: four on the floor, backbeat clap, off-beat hats, one rim */
export const BEAT = {
  [BD]: on([1, 5, 9, 13]),
  [CP]: on([5, 13]),
  [CH]: on([3, 7, 11, 15]),
  [RS]: on([12]),
};

/** Groove: 16th hats - ghosts on 2 6 10 14, softer 4 8 12 16, open off-beats - and a lazy clap on 13 */
export const HATS_GROOVE: Trigs = merge(on([2, 6, 10, 14], { vel: 44 }), on([4, 8, 12, 16], { vel: 60 }), on([3, 7, 11, 15], { vel: 96 }));
export const GROOVE = {
  ...BEAT,
  [CH]: HATS_GROOVE,
  [CP]: merge(on([5]), { 13: { micro: 3 } }),
};
export const SWING = 56;

/** Bass locked to the kick: Demo 1's bar 1 - A2 on the off-beats, an octave jump and a pick-up to E3 */
export const BASS_BAR: Trigs = line(
  [3, 7, 8, 11, 15, 16], ['A2', 'A2', 'A3', 'A2', 'A2', 'E3'],
  [112, 100, 64, 108, 100, 60], [LEN.oneHalf, LEN.one, LEN.half, LEN.oneHalf, LEN.one, LEN.half],
);

/** Four bars of bass following the chords' roots (A, A, D, E): Demo 1's bass line */
export const BASS_4: Trigs = merge(
  BASS_BAR,
  line([19, 23, 27, 30, 31], ['A2', 'A2', 'C3', 'A2', 'G2'], [112, 100, 104, 66, 98], [LEN.oneHalf, LEN.one, LEN.oneHalf, LEN.half, LEN.one]),
  line([35, 39, 40, 43, 47], ['D3', 'D3', 'D4', 'D3', 'C3'], [112, 100, 64, 108, 98], [LEN.oneHalf, LEN.one, LEN.half, LEN.oneHalf, LEN.one]),
  line([51, 55, 56, 59, 62, 63], ['E3', 'E3', 'E4', 'E3', 'G3', 'A2'], [112, 100, 64, 108, 70, 110], [LEN.oneHalf, LEN.one, LEN.half, LEN.oneHalf, LEN.half, LEN.oneHalf]),
);

/** Chords and pads: the stab rhythm of Demo 1's drop, Am7 - Am7 - Dm7 - Em7, with a push back to Am7 */
export const STABS_4: Trigs = merge(
  line([3, 8, 11], ['A3', 'A3', 'A3'], [100, 78, 92]),
  line([19, 27, 30], ['A3', 'A3', 'A3'], [100, 92, 74]),
  line([35, 40, 43], ['D3', 'D3', 'D3'], [100, 78, 92]),
  line([51, 56, 59, 63], ['E3', 'E3', 'E3', 'A3'], [100, 80, 94, 96]),
);

/** A hook: a falling three-step call (E D C A) and a rising answer, in A minor pentatonic over the chords */
export const HOOK_2: Trigs = merge(
  line([3, 6, 9, 12, 15], ['E5', 'D5', 'C5', 'A4', 'C5'], [100, 88, 94, 86, 80], [LEN.oneHalf, LEN.one, LEN.one, LEN.oneHalf, LEN.one]),
  line([19, 22, 25, 28, 31], ['E5', 'D5', 'C5', 'D5', 'E5'], [100, 88, 94, 86, 92], [LEN.oneHalf, LEN.one, LEN.one, LEN.one, LEN.two]),
);

// ---- the studio ----------------------------------------------------------------------------

/** The Xone:96 for the Elektron set: every channel on its studio input (no decks), returns on RTN */
export function elektronXone(extra: Values = {}): Values {
  return {
    ...XONE96_PRESETS.init.settings,
    ch1_src: SRC.NONE, ch2_src: SRC.NONE, ch3_src: SRC.NONE, ch4_src: SRC.NONE,
    ch1_input: 2, ch2_input: 2, ch3_input: 2, ch4_input: 2, cha_input: 2, chb_input: 2,
    // measured: the Rytm peaks about +4 dBu on channel 1, the A4 about +5 on channel 2 (the
    // guide's healthy range), the studio master about -4 dBFS with the whole loop playing
    ch1_gain: 4, ch2_gain: -5, ch3_gain: -2,
    ch1_fader: 10, ch2_fader: 9.5, ch3_fader: 9, ch4_fader: 0, cha_fader: 5, chb_fader: 5,
    master: 8,
    bpm: BPM, play: false,
    ...extra,
  };
}

/** The Sub 37 guest: a bright octave lead, keys an octave up so the hook's notes are under the fingers */
export const SUB_LEAD: Values = { ...SUB37_PRESETS.bright_octave_lead.settings, kb_octave: 1 };

export interface ElektronCheckpoint {
  rytm: Record<string, Pattern>;
  a4: Record<string, Pattern>;
  rytmValues?: Values;
  a4Values?: Values;
  xone?: Values;
  /** The Sub 37 on Xone channel 3 */
  sub?: boolean;
  focus?: string;
  rytmTrack?: number;
  a4Track?: number;
  arrangement?: LessonStudioStart['arrangement'];
  ownStudio?: string;
}

/** The Elektron studio with a checkpoint's patterns and settings */
export function elektronStudio(cp: ElektronCheckpoint): LessonStudioStart {
  const rytmKit = { ...RYTM_KIT, ...(cp.rytmValues ?? {}) };
  return {
    rack: [
      { id: CLOCK, device: CLOCK, values: { division: 2, pulse_width: 5 } },
      { id: RYTM, device: RYTM, values: { ...rytmKit, ...rytmPanel(cp.rytmTrack ?? BD) }, data: rytmProject(cp.rytm, rytmKit) },
      { id: A4, device: A4, values: { ...a4Kit(), ...(cp.a4Values ?? {}), ...a4Panel(cp.a4Track ?? T1) }, data: a4Project(cp.a4) },
      ...(cp.sub ? [{ id: SUB, device: SUB, label: 'Sub 37 lead', values: SUB_LEAD }] : []),
      { id: XONE, device: XONE, values: elektronXone(cp.xone) },
    ],
    routes: { [RYTM]: 'xone96:studio_1', [A4]: 'xone96:studio_2', ...(cp.sub ? { [SUB]: 'xone96:studio_3' } : {}) },
    sync: { [RYTM]: true, [A4]: true, [XONE]: true, ...(cp.sub ? { [SUB]: true } : {}) },
    cables: [],
    bpm: BPM,
    swing: 0,
    mixer: {},
    ...(cp.arrangement ? { arrangement: cp.arrangement } : {}),
    focus: cp.focus ?? RYTM,
    ...(cp.ownStudio ? { ownStudio: cp.ownStudio } : {}),
  };
}

// ---- checkpoints -----------------------------------------------------------------------------

const EMPTY_A4 = (swing = 50, length = 16) => ({ A01: a4Pattern('LOW TIDE', {}, { swing, length }) });

/** CP-00, First beat: the sounds are designed, every pattern is empty, straight time */
export const CP_00: ElektronCheckpoint = {
  rytm: { A01: rytmPattern('LOW TIDE', {}) },
  a4: EMPTY_A4(),
  xone: { ch2_fader: 0 },
};

/** CP-01, Groove: the first beat */
export const CP_01: ElektronCheckpoint = {
  rytm: { A01: rytmPattern('LOW TIDE', BEAT) },
  a4: EMPTY_A4(),
  xone: { ch2_fader: 0 },
  rytmTrack: CH,
};

/**
 * CP-02, Bass locked to the kick: the groove at 56 % swing; the kick a little under the key, and
 * the NOTE page's LEN at 3 steps, so the first bass notes ring into the next kick
 */
export const CP_02: ElektronCheckpoint = {
  rytm: { A01: rytmPattern('LOW TIDE', GROOVE, { swing: SWING }) },
  a4: { A01: a4Pattern('LOW TIDE', {}, { swing: SWING, defaults: { [T1]: { len: LEN.three } } }) },
  rytmValues: { bd_tun: KICK_OFF_KEY },
  a4Values: { [tid(T1, 'trig_len')]: LEN.three },
  focus: A4,
};

/** CP-03, Chords and pads: the kick in key, a one-bar bassline locked to it */
export const CP_03: ElektronCheckpoint = {
  rytm: { A01: rytmPattern('LOW TIDE', GROOVE, { swing: SWING }) },
  a4: { A01: a4Pattern('LOW TIDE', { [T1]: BASS_BAR }, { swing: SWING }) },
  a4Values: Object.fromEntries(Object.entries(T1_PLUCK).map(([k, v]) => [tid(T1, k), v])),
  focus: A4,
  a4Track: T2,
};

/** CP-05, A hook: four bars of chords with the bass on their roots */
export const CP_05: ElektronCheckpoint = {
  ...CP_03,
  a4: { A01: a4Pattern('LOW TIDE', { [T1]: BASS_4, [T2]: STABS_4, [T3]: STABS_4 }, { swing: SWING, length: 64 }) },
  sub: true,
  a4Track: T4,
};

/** CP-08, Movement: the loop with its hook - everything plays, nothing changes yet */
export const CP_08: ElektronCheckpoint = {
  ...CP_03,
  a4: { A01: a4Pattern('LOW TIDE', { [T1]: BASS_4, [T2]: STABS_4, [T3]: STABS_4, [T4]: HOOK_2 }, { swing: SWING, length: 64 }) },
  a4Track: T2,
};

// ---- the capstone: the course track as a bank of patterns --------------------------------------

/** The groove after Movement: a hat lock and a chance ghost, the 1:2 hat, a fill every four bars */
const GROOVE_MOVING = {
  ...GROOVE,
  [CH]: merge(HATS_GROOVE, { 6: { cond: '50%' }, 8: { locks: { dec: 40 } }, 16: { cond: '1:2' } }),
  [SD]: { 14: { vel: 70, cond: '4:4' }, 15: { vel: 86, cond: '4:4' }, 16: { vel: 104, cond: '4:4' } },
};

/** The chords with their bar-1 lock (Movement) */
const STABS_MOVING: Trigs = merge(STABS_4, { 11: { locks: { flt1_frq: 85 } } });

/**
 * The Capstone's studio: the course track, plus the patterns an arrangement needs.
 *   Rytm  A01 GROOVE · A02 BREAK (no kick) · A03 FILL (a snare roll) · A04 INTRO (kick and hats)
 *   A4    A01 FULL · A02 BASS (the bass alone) · A03 BREAK (the chords and the hook, no bass)
 * The chords have their slow filter LFO; the Sub 37 sits on channel 3 as a guest, its
 * sequencer off. The arranger is empty.
 */
export const CP_CAPSTONE: ElektronCheckpoint = {
  rytm: {
    A01: rytmPattern('GROOVE', GROOVE_MOVING, { swing: SWING }),
    A02: rytmPattern('BREAK', {
      [CH]: on([3, 7, 11, 15], { vel: 80 }),
      [RS]: merge(on([4, 12], { vel: 78 }), { 7: { vel: 58, cond: '1:2' } }),
      [CP]: on([13], { vel: 90 }),
    }, { swing: SWING }),
    A03: rytmPattern('FILL', {
      [BD]: on([1, 5, 9]),
      [SD]: merge(on([9, 10, 11, 12], { vel: 70 }), on([13, 14], { vel: 88 }), on([15, 16], { vel: 106 })),
      [CH]: on([3, 7], { vel: 80 }),
    }, { swing: SWING }),
    A04: rytmPattern('INTRO', { [BD]: on([1, 5, 9, 13]), [CH]: merge(on([3, 7, 11, 15], { vel: 90 }), on([2, 6, 10, 14], { vel: 44 })) }, { swing: SWING }),
  },
  a4: {
    A01: a4Pattern('FULL', { [T1]: BASS_4, [T2]: STABS_MOVING, [T3]: STABS_MOVING, [T4]: HOOK_2 }, { swing: SWING, length: 64 }),
    A02: a4Pattern('BASS', { [T1]: BASS_4 }, { swing: SWING, length: 64 }),
    A03: a4Pattern('BREAK', { [T2]: STABS_4, [T3]: STABS_4, [T4]: HOOK_2 }, { swing: SWING, length: 64 }),
  },
  a4Values: {
    ...Object.fromEntries(Object.entries(T1_PLUCK).map(([k, v]) => [tid(T1, k), v])),
    ...Object.fromEntries(Object.entries(STAB_LFO).flatMap(([k, v]) => [[tid(T2, k), v], [tid(T3, k), v]])),
  },
  sub: true,
  focus: XONE,
  // the desk as the loop was built: every GAIN at 0 dB and every fader up, the A4 hot, MASTER 1
  // fully up, so the studio limiter works hard: the mixdown milestone starts from here
  xone: { ch1_gain: 0, ch2_gain: 3, ch3_gain: 0, ch1_fader: 10, ch2_fader: 10, ch3_fader: 10, master: 10 },
};

type SongSection = NonNullable<LessonStudioStart['arrangement']>['sections'][number];
const parts = (rytm: string, a4: string | null): NonNullable<SongSection['parts']> => ({
  [RYTM]: { pattern: rytm },
  [A4]: a4 ? { pattern: a4 } : { muted: true },
});

/** The capstone's song without transitions: 72 bars, 2:19 at 124 BPM */
export function capstoneSong(): SongSection[] {
  return [
    { name: 'Intro', bars: 8, parts: parts('A04', null) },
    { name: 'Groove', bars: 8, parts: parts('A01', 'A02') },
    { name: 'Drop', bars: 16, parts: parts('A01', 'A01') },
    { name: 'Break', bars: 8, parts: parts('A02', 'A03') },
    { name: 'Build', bars: 8, parts: parts('A01', 'A02') },
    { name: 'Drop 2', bars: 16, parts: parts('A01', 'A01') },
    { name: 'Outro', bars: 8, parts: parts('A04', null) },
  ];
}

/** Xone:96 snapshot that puts the filters back off */
const XFILTERS_OFF: Values = { ch1_filter: 1, ch2_filter: 1, f1_on: false, f2_on: false };

/**
 * The song with transitions: the bass and chords open out of FILTER 2's low-pass in the Groove,
 * the Build high-passes the drums through FILTER 1, a one-bar Fill (the Rytm's FILL pattern)
 * lands on Drop 2, and every drop puts the filters back.
 */
export function capstoneTransitions(): SongSection[] {
  const s = capstoneSong();
  const snap = (name: string, snapshot: Values) => {
    const sec = s.find(v => v.name === name)!;
    sec.parts = { ...sec.parts, [XONE]: { snapshot } };
  };
  snap('Intro', XFILTERS_OFF);
  snap('Groove', { ch2_filter: 2, f2_on: true, f2_type: 2, f2_freq: 900, f2_res: 2 });
  snap('Drop', XFILTERS_OFF);
  snap('Break', XFILTERS_OFF);
  const build = s.find(v => v.name === 'Build')!;
  build.bars = 7;
  snap('Build', { ch1_filter: 0, f1_on: true, f1_type: 0, f1_freq: 300, f1_res: 5 });
  s.splice(s.indexOf(build) + 1, 0, { name: 'Fill', bars: 1, parts: parts('A03', 'A02') });
  snap('Drop 2', XFILTERS_OFF);
  return s;
}

/**
 * The capstone's mixdown (measured): the drums lead at full fader, the A4 and the Sub 37's arpeggio
 * a little under them, MASTER 1 for about -4 dBFS peaks in the Drop. The dense arpeggio carries
 * loudness without peaks, so the master needs little limiting.
 */
export const CAPSTONE_MIX: Values = { ch1_gain: -1, ch2_gain: -5, ch3_gain: -2, ch1_fader: 10, ch2_fader: 9.5, ch3_fader: 9.5, master: 8.5 };
/** The master fader (DRIVE into the glue and the limiter) for a streaming master: about -14 LUFS, the limiter catching about 1 dB */
export const CAPSTONE_DRIVE = 6;
/**
 * The master's GLUE compressor (measured on the bounce): 3:1 with a 1 ms attack holds the drums'
 * peaks, so at -14 LUFS the limiter only catches the odd one (1-2 dB)
 */
export const CAPSTONE_GLUE = { on: true, threshold: -20, ratio: 3, attack: 0.001, release: 0.3, auto: true, makeup: 5, mix: 1 };
