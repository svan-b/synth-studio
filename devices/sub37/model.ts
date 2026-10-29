// ============================================================================
// Sub 37 model: the panel's option tables and how control values map onto the
// 'sub37-ctl' processor's settings (public/worklets/sub37-processors.js).
// Pure data and functions - no Web Audio - so the engine, the spec, presets,
// lessons and offline tests share one source of truth. Page numbers are the
// Subsequent 37 manual's; REFERENCE.md has the full source table.
// ============================================================================

import type { ControlValue } from '@/types';

// ---------------------------------------------------------------------------
// Option tables (printed legends and menu lists, in the hardware's order)
// ---------------------------------------------------------------------------

export const OCTAVES = ["16'", "8'", "4'", "2'"];
/** Octaves relative to 8' */
export const FOOTAGE = [-1, 0, 1, 2];
/** MOD SOURCE knob, fully counter-clockwise first (p.22, CC 71) */
export const MOD_SOURCES = ['TRI', 'SQR', 'SAW', 'RAMP', 'S&H', 'F.EG/PGM'];
export const SOURCE_PGM = 5;
/** MOD DEST button, in the order it cycles (p.23, CC 91) */
export const MOD_DESTS = ['LFO RATE', 'VCA LEVEL', 'OSC 1 WAVE', 'OSC 1+2 WAVE', 'OSC 2 WAVE', 'NOISE LEVEL', 'EG TIME/PGM'];
export const DEST_PGM = 6;
/** PGM SRC: what SOURCE "F.EG/PGM" means (CONTROLLERS > MOD EDIT, p.50) */
export const PGM_SOURCES = [
  'FILTER EG', 'AMP EG', 'CONST ON', 'SINE LFO', 'NOISE LFO', 'OSC1 PCH', 'OSC2 PCH',
  'SEQ NOTE', 'SEQ VEL', 'SEQ MOD', 'PRESSURE', 'KB TRACK', 'VELOCITY',
];
/**
 * PGM DST: the destination behind DEST "EG TIME/PGM" (p.51). The hardware lists 89; the twin
 * implements the continuous ones that live in the sound engine, in the manual's order.
 */
export const PGM_DESTS = [
  'EG TIME', 'FILT RES', 'FILT DRV', 'F EG AMT', 'F KB AMT', 'OSC1 LEV', 'SUB LEV', 'OSC2 LEV', 'EXFB LEV',
  'ARP RATE', 'GLD TIME', 'OSC2FREQ', 'OSC2BEAT', 'F EG ATK', 'F EG DCY', 'F EG SUS', 'F EG REL',
  'A EG ATK', 'A EG DCY', 'A EG SUS', 'A EG REL', 'OUT VOL',
];
export const PGM_ARP_RATE = 9;
/** Panel controls that "hold MOD DEST and move it" (p.24) turns into that PGM destination */
export const PGM_DEST_OF_CONTROL: Record<string, number> = {
  resonance: 1, multidrive: 2, filter_eg_amt: 3, filter_kb_amt: 4,
  mix_osc1: 5, mix_sub: 6, mix_osc2: 7, mix_feedback: 8, arp_rate: 9, glide_time: 10, osc2_frequency: 11, beat_freq: 12,
  feg_attack: 13, feg_decay: 14, feg_sustain: 15, feg_release: 16,
  aeg_attack: 17, aeg_decay: 18, aeg_sustain: 19, aeg_release: 20, master_volume: 21,
};
/** Panel controls that are MOD DEST positions of their own */
export const DEST_OF_CONTROL: Record<string, number> = { mix_noise: 5, osc1_wave: 2, osc2_wave: 4 };
/** MOD OSC / GLIDE OSC: which oscillators (LEDs 1 and 2; CC 70, 102) */
export const OSC_SEL = ['1+2', '1', '2'];
/** KB CTRL (DUO MODE): no LED = OFF (OSC 2 drones), LO, HI (p.26, CC 111) */
export const KB_CTRL = ['OFF', 'LO', 'HI'];
export const SLOPES = ['-6dB', '-12dB', '-18dB', '-24dB'];
export const SLOPE_MODES = ['lp6', 'lp12', 'lp18', 'lp24'] as const;
export const GLIDE_TYPES = ['LCR', 'LCT', 'EXP'];
/** KB PRIORITY (PRESET EDIT 2.1); stored LAST first, the menu lists LOW, HIGH, LAST */
export const KEY_PRIORITY = ['LAST', 'LOW', 'HIGH'];
export const BEND_DESTS = ['NONE', 'OSC1', 'OSC2', 'BOTH'];
export const GATE_SOURCES = ['BOTH', 'NOTES', 'EXT'];
export const PATTERNS = ['UP', 'DWN', 'ORDR', 'RND', 'SEQ', 'REC'];
export const PATTERN_RND = 3;
export const PATTERN_SEQ = 4;
export const PATTERN_REC = 5;
/** Arpeggiator RANGE: 7 states; the outer two light 0 and +-2 and span three octaves (p.15) */
export const ARP_RANGES = ['0&-2', '-2', '-1', '0', '+1', '+2', '0&+2'];
export const END_NOTES = ['ONCE', 'TWICE'];
export const REF_NOTES = ['FIRST', 'MID C'];

/** Clock divisions (p.52): label and length in MIDI clocks (24 per quarter note) */
export const DIVISIONS: { label: string; ticks: number }[] = [
  { label: '4 WH', ticks: 384 }, { label: '3 WH', ticks: 288 }, { label: '2 WH', ticks: 192 },
  { label: 'WH+1/2', ticks: 144 }, { label: 'WH', ticks: 96 }, { label: '1/2 DOT', ticks: 72 },
  { label: 'WH T', ticks: 64 }, { label: '1/2', ticks: 48 }, { label: '1/4 DOT', ticks: 36 },
  { label: '1/2 T', ticks: 32 }, { label: '1/4', ticks: 24 }, { label: '1/8 DOT', ticks: 18 },
  { label: '1/4 T', ticks: 16 }, { label: '1/8', ticks: 12 }, { label: '1/16 DOT', ticks: 9 },
  { label: '1/8 T', ticks: 8 }, { label: '1/16', ticks: 6 }, { label: '1/16 T', ticks: 4 },
  { label: '1/32', ticks: 3 }, { label: '1/32 T', ticks: 2 }, { label: '1/64 T', ticks: 1 },
];
export const DIV_QUARTER = 10;
export const DIV_EIGHTH = 13;
export const DIV_SIXTEENTH = 16;

/** Instrument's Middle C (p.29: "C3 (MIDI note 48)") - KB TRACK centre and sequencer MID C */
export const MIDDLE_C = 48;
export const C4_HZ = 261.6256;

// ---------------------------------------------------------------------------
// Calibrations (guesses are listed in REFERENCE.md "Model choices")
// ---------------------------------------------------------------------------

/**
 * GLIDE TIME: the panel prints 0-10 and no seconds. The twin stores milliseconds on a log taper
 * from 15 ms (dial 0) to 6 s (dial 10), so dial 2 is about 50 ms and dial 5 about 300 ms.
 */
export const GLIDE_MIN_MS = 15.1;
export const GLIDE_MAX_MS = 6000;
export const glideDial = (ms: number) => (10 * Math.log(Math.max(GLIDE_MIN_MS, ms) / GLIDE_MIN_MS)) / Math.log(GLIDE_MAX_MS / GLIDE_MIN_MS);
export const glideMsFromDial = (dial: number) => Math.round(GLIDE_MIN_MS * Math.pow(GLIDE_MAX_MS / GLIDE_MIN_MS, dial / 10) * 10) / 10;

/** FINE TUNE: one semitone either way (p.14) */
export const FINE_TUNE_CENTS = 100;
/** OSC 2 FREQUENCY span: +-7 semitones, +-3 octaves while KB CTRL is OFF in DUO MODE (p.26) */
export const DRONE_SCALE = 36 / 7;

// ---------------------------------------------------------------------------
// Readouts
// ---------------------------------------------------------------------------

export const formatWave = (v: number): string => {
  if (v < 3) return 'TRI';
  if (v < 30) return 'TRI>SAW';
  if (v <= 36) return 'SAW';
  if (v < 64) return 'SAW>SQR';
  if (v <= 69) return 'SQR';
  if (v < 98) return `PW ${Math.round(50 - 40 * ((v - 66.67) / 33.33))}%`;
  return 'PULSE';
};
/** % of travel on the panel's 0-10 calibration */
export const formatDial = (v: number) => (v / 10).toFixed(1);
/** -100..+100 % on the panel's -5..+5 calibration */
export const formatBipolar = (v: number) => (Math.abs(v) < 1 ? '0' : `${v > 0 ? '+' : ''}${(v / 20).toFixed(1)}`);
export const formatGlide = (ms: number) => glideDial(ms).toFixed(1);
export const formatVolume = (v: number) => (v / 10).toFixed(1);
export const formatDivision = (v: number) => DIVISIONS[Math.round(v)]?.label ?? '?';
export const formatOctave = (v: number) => OCTAVES[Math.round(v)] ?? '?';
export const formatSource = (v: number) => MOD_SOURCES[Math.round(v)] ?? '?';
export const formatPattern = (v: number) => PATTERNS[Math.round(v)] ?? '?';
export const formatSemis = (v: number) => (Math.abs(v) < 0.005 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);
export const formatHzBeat = (v: number) => (Math.abs(v) < 0.005 ? '0 Hz' : `${v > 0 ? '+' : ''}${v.toFixed(2)} Hz`);
/** KB TRACK ratios: 0 .. 1:1 (halfway) .. 2:1 */
export const formatRatio = (v: number) => (v < 0.5 ? 'OFF' : `${(v / 100).toFixed(2)}:1`);
export const formatCents = (v: number) => (Math.abs(v) < 0.5 ? '0 c' : `${v > 0 ? '+' : ''}${Math.round(v)} c`);
/** Menu percentages that print OFF at zero (GATE LENGTH, PRESET VOL, CONTROLLERS amounts) */
export const formatPctOff = (v: number) => (Math.abs(v) < 0.5 ? 'OFF' : `${Math.round(v)}%`);
export const formatSignedPctOff = (v: number) => (Math.abs(v) < 0.5 ? 'OFF' : `${v > 0 ? '+' : ''}${Math.round(v)}%`);
export const formatSwing = (v: number) => `${v.toFixed(1)}%`;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Moog naming: MIDI 48 is C3 */
export const noteName = (n: number) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

// ---------------------------------------------------------------------------
// Step sequence (pp.17-20): 64 steps, stored in three 64-character pattern controls so a
// preset carries its sequence (as the hardware stores one with every preset).
//   arp_seq        pitch 1 of each step      '!' = none, else MIDI note 12 + (code - 34)
//   arp_seq2       pitch 2 (DUO MODE steps)  same alphabet
//   arp_seq_flags  one hex digit per step:   1 REST, 2 TIE (into the next step), 4 RATCHET, 8 SKIP
// FIRST STEP and LAST STEP are the seq_first / seq_len knobs.
// ---------------------------------------------------------------------------

export const SEQ_STEPS = 64;
export const NO_NOTE = '!';
const NOTE_CODE0 = 34;
export const SEQ_NOTE_MIN = 12;
export const SEQ_NOTE_MAX = 12 + (126 - NOTE_CODE0);
export const F_REST = 1;
export const F_TIE = 2;
export const F_RATCHET = 4;
export const F_SKIP = 8;

export interface SeqStep {
  n1: number | null;
  n2: number | null;
  flags: number;
}

export const noteChar = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? NO_NOTE
    : String.fromCharCode(NOTE_CODE0 + Math.max(SEQ_NOTE_MIN, Math.min(SEQ_NOTE_MAX, Math.round(n))) - SEQ_NOTE_MIN);

export function charNote(c: string | undefined): number | null {
  if (!c || c === NO_NOTE) return null;
  const k = c.charCodeAt(0) - NOTE_CODE0;
  return k < 0 || k > SEQ_NOTE_MAX - SEQ_NOTE_MIN ? null : SEQ_NOTE_MIN + k;
}

export const flagChar = (f: number) => (Math.max(0, Math.min(15, Math.round(f))) | 0).toString(16);
export const charFlags = (c: string | undefined) => {
  const v = c ? parseInt(c, 16) : 0;
  return Number.isFinite(v) ? v : 0;
};

export const EMPTY_PITCHES = NO_NOTE.repeat(SEQ_STEPS);
export const EMPTY_FLAGS = '0'.repeat(SEQ_STEPS);

export function stepAt(p1: string, p2: string, flags: string, i: number): SeqStep {
  return { n1: charNote(p1[i]), n2: charNote(p2[i]), flags: charFlags(flags[i]) };
}

/** Replace one character of a 64-character pattern string */
export const setChar = (s: string, i: number, c: string) => {
  const base = (s.length === SEQ_STEPS ? s : (s + EMPTY_FLAGS).slice(0, SEQ_STEPS));
  return base.slice(0, i) + c + base.slice(i + 1);
};

/**
 * Authoring helper for presets and lessons. Tokens, one per step:
 *   number   a note (MIDI)            [a, b]   a DUO step (two notes)
 *   '.'      a rest                   '_'      tie: the previous note holds through this step
 *   { n, tie: true }  legato: the previous step ties into this new pitch (no retrigger)
 *   { n, ratchet: true } a ratcheted step
 */
export type SeqToken = number | '.' | '_' | [number, number] | { n: number | [number, number]; tie?: boolean; ratchet?: boolean };

export function buildSeq(tokens: SeqToken[]): { arp_seq: string; arp_seq2: string; arp_seq_flags: string; seq_len: number } {
  const p1: string[] = [], p2: string[] = [], fl: number[] = [];
  let last: [number | null, number | null] = [null, null];
  tokens.slice(0, SEQ_STEPS).forEach((t, i) => {
    let a: number | null = null, b: number | null = null, f = 0;
    if (t === '.') f = F_REST;
    else if (t === '_') { [a, b] = last; if (i > 0) fl[i - 1] |= F_TIE; }
    else if (typeof t === 'number') a = t;
    else if (Array.isArray(t)) [a, b] = t;
    else {
      if (Array.isArray(t.n)) [a, b] = t.n; else a = t.n;
      if (t.tie && i > 0) fl[i - 1] |= F_TIE;
      if (t.ratchet) f |= F_RATCHET;
    }
    p1.push(noteChar(a)); p2.push(noteChar(b)); fl.push(f);
    if (a !== null) last = [a, b];
  });
  const len = Math.max(1, Math.min(SEQ_STEPS, tokens.length));
  while (p1.length < SEQ_STEPS) { p1.push(NO_NOTE); p2.push(NO_NOTE); fl.push(0); }
  return { arp_seq: p1.join(''), arp_seq2: p2.join(''), arp_seq_flags: fl.map(flagChar).join(''), seq_len: len };
}

/** Default sequence: a one-bar octave bassline on C2 */
export const DEFAULT_SEQ = buildSeq([36, 36, 48, 36, '.', 36, 46, 36, 36, '.', 48, 36, 43, '_', 46, 48]);

/** The first note of the sequence between FIRST and LAST step (the REF NOTE FIRST reference) */
export function firstSeqNote(p1: string, flags: string, first: number, last: number): number | null {
  for (let i = first; i <= last; i++) {
    const f = charFlags(flags[i]);
    if (f & (F_REST | F_SKIP)) continue;
    const n = charNote(p1[i]);
    if (n !== null) return n;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Control values -> ctl processor settings
// ---------------------------------------------------------------------------

type Values = Record<string, ControlValue>;
const num = (v: Values, id: string, d = 0) => { const x = v[id]; return typeof x === 'number' ? x : typeof x === 'boolean' ? (x ? 1 : 0) : d; };
const on = (v: Values, id: string) => (v[id] ? 1 : 0);
const ms = (v: Values, id: string, d: number) => num(v, id, d) / 1000;

/** Hz of an LFO's RATE knob, with HI RANGE (x10, p.23) */
export function lfoHz(values: Values, n: 1 | 2): number {
  return num(values, `mod${n}_rate`, n === 1 ? 5 : 1) * (values[`mod${n}_hi_range`] ? 10 : 1);
}

/**
 * Everything 'sub37-ctl' needs that is a direct function of the panel. Tempo-dependent
 * values (synced LFO rates) are passed in; the engine adds note events itself.
 */
export function ctlSettings(v: Values, opts: { lfoHz: [number, number]; extPatched: boolean }): Record<string, number> {
  const kbCtrl = num(v, 'kb_ctrl', 2);
  // KB CTRL only matters in DUO MODE (p.26): OFF makes OSC 2 a drone with FREQUENCY at +-3 octaves
  const drone = v.duo_mode && kbCtrl === 0 ? 1 : 0;
  const freq2 = num(v, 'osc2_frequency', 0) * (drone ? DRONE_SCALE : 1);
  const pd = (n: 1 | 2) => num(v, `mod${n}_pitch_dest`, 0);
  return {
    tune: num(v, 'fine_tune', 0) / 1200,
    foot1: FOOTAGE[Math.round(num(v, 'osc1_octave', 1))] ?? 0,
    foot2: FOOTAGE[Math.round(num(v, 'osc2_octave', 1))] ?? 0,
    freq2, drone, beat: num(v, 'beat_freq', 0),
    bendUp: num(v, 'bend_up', 2), bendDn: num(v, 'bend_down', 2), bend: num(v, 'pitch_bend', 0) / 100,
    bendDest: num(v, 'bend_dest', 3),
    wave1: num(v, 'osc1_wave', 33) / 100, wave2: num(v, 'osc2_wave', 33) / 100,
    l1: num(v, 'mix_osc1', 50) / 10, ls: num(v, 'mix_sub', 0) / 10, l2: num(v, 'mix_osc2', 0) / 10, ln: num(v, 'mix_noise', 0) / 10, lf: num(v, 'mix_feedback', 0) / 10,
    on1: on(v, 'mix_osc1_on'), ons: on(v, 'mix_sub_on'), on2: on(v, 'mix_osc2_on'), onn: on(v, 'mix_noise_on'), onf: on(v, 'mix_fb_on'),
    ext: opts.extPatched ? 1 : 0,
    cutoff: num(v, 'cutoff', 20000), res: num(v, 'resonance', 0) / 10, md: num(v, 'multidrive', 0) / 10,
    egAmt: num(v, 'filter_eg_amt', 0) / 20, kbTrack: num(v, 'filter_kb_amt', 100) / 100,
    fa: ms(v, 'feg_attack', 1), fd: ms(v, 'feg_decay', 300), fs: num(v, 'feg_sustain', 100) / 100, fr: ms(v, 'feg_release', 100),
    fdl: ms(v, 'feg_delay', 0), fh: ms(v, 'feg_hold', 0), fvel: num(v, 'feg_vel_amt', 0) / 100, fkb: num(v, 'feg_kb_amt', 0) / 100,
    floop: on(v, 'feg_loop'), flatch: on(v, 'feg_latch'), fexp: on(v, 'feg_attack_exp'), frst: on(v, 'feg_reset'),
    fgs: num(v, 'feg_gate_src', 0),
    aa: ms(v, 'aeg_attack', 1), ad: ms(v, 'aeg_decay', 300), as: num(v, 'aeg_sustain', 100) / 100, ar: ms(v, 'aeg_release', 100),
    adl: ms(v, 'aeg_delay', 0), ah: ms(v, 'aeg_hold', 0), avel: num(v, 'aeg_vel_amt', 0) / 100, akb: num(v, 'aeg_kb_amt', 0) / 100,
    aloop: on(v, 'aeg_loop'), alatch: on(v, 'aeg_latch'), aexp: on(v, 'aeg_attack_exp'), arst: on(v, 'aeg_reset'),
    ags: num(v, 'aeg_gate_src', 0),
    gOn: on(v, 'glide_on'), gTime: num(v, 'glide_time', 50) / 1000, gType: num(v, 'glide_type', 0), gGated: on(v, 'glide_gated'),
    r0: opts.lfoHz[0], r1: opts.lfoHz[1],
    src0: Math.round(num(v, 'mod1_source', 0)), src1: Math.round(num(v, 'mod2_source', 0)),
    kr0: on(v, 'mod1_kb_reset'), kr1: on(v, 'mod2_kb_reset'),
    lk0: num(v, 'mod1_lfo_kb', 0) / 100, lk1: num(v, 'mod2_lfo_kb', 0) / 100,
    // bipolar amounts are stored as % (-100..+100) and reach the processor on the -5..+5 dial
    pa0: num(v, 'mod1_pitch_amt', 0) / 20, pa1: num(v, 'mod2_pitch_amt', 0) / 20, pd0: pd(1), pd1: pd(2),
    fa0: num(v, 'mod1_filter_amt', 0) / 20, fa1: num(v, 'mod2_filter_amt', 0) / 20,
    de0: num(v, 'mod1_dest', 1), de1: num(v, 'mod2_dest', 1),
    ma0: num(v, 'mod1_mod_amt', 0) / 20, ma1: num(v, 'mod2_mod_amt', 0) / 20,
    // CONTROLLERS (p.50): depth reached at full wheel / full velocity, -1..+1
    wh0: num(v, 'mod1_wheel', 100) / 100, wh1: num(v, 'mod2_wheel', 0) / 100,
    ve0: num(v, 'mod1_vel', 0) / 100, ve1: num(v, 'mod2_vel', 0) / 100,
    ps0: num(v, 'mod1_pgm_src', 0), ps1: num(v, 'mod2_pgm_src', 0),
    pg0: num(v, 'mod1_pgm_dst', 0), pg1: num(v, 'mod2_pgm_dst', 0),
    wheel: num(v, 'mod_wheel', 0) / 100,
  };
}

// ---------------------------------------------------------------------------
// Post-filter stages (native nodes)
// ---------------------------------------------------------------------------

/**
 * Ladder input scale and the make-up after it. One source at 5 reaches the ladder at 0.36: about
 * 1 % distortion, "a clean signal to the filter"; at 10 (+9 dB) the input pair overdrives gently,
 * and several sources above 5 drive it hard (p.27). The mixer amp ahead of it is clean to 1.5x.
 */
export const LADDER_DRIVE = 0.36;
export const LADDER_MAKEUP = 2.625;
/**
 * Output level of the twin (dB), after the VCA: with VOLUME at its default 7 a fresh panel (one
 * saw, the filter open) plays the standard phrase at about -15 LUFS, and the presets are levelled
 * to the studio's -18 LUFS with PRESET VOL (scripts/audio-qa.cjs --target -18). The studio's
 * channel trims are unity, so an instrument has to arrive at that level.
 */
export const OUTPUT_TRIM_DB = -6;
const OUTPUT_TRIM = Math.pow(10, OUTPUT_TRIM_DB / 20);
/** VOLUME / HEADPHONES (0-100) -> gain */
export const volumeGain = (pct: number) => Math.pow(Math.max(0, pct) / 100, 2) * 0.9 * OUTPUT_TRIM;
/** HEADPHONES balances against VOLUME (p.34): unity at 7 on its dial */
export const phonesGain = (pct: number) => Math.pow(Math.max(0, pct) / 70, 2);

/**
 * MULTIDRIVE transfer curve over x in -8..8: nearly linear below about 0.8, an asymmetric knee
 * (more even than odd harmonics: the "tube-like warmth" of low settings) and a hard limit near
 * +-3 at high drive (p.28). The drive into it runs from 0.5 at 0 (clean) to 40 at 10, and its
 * make-up rides on the VCA gain (MD_POST in public/worklets/sub37-processors.js).
 */
export function multidriveCurve(n = 4096): Float32Array<ArrayBuffer> {
  const c = new Float32Array(new ArrayBuffer(n * 4));
  const b = 0.35;
  const soft = (x: number) => x / Math.pow(1 + Math.pow(Math.abs(x / 3), 2.5), 0.4);
  const off = soft(b);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 8;
    c[i] = soft(x + b) - off;
  }
  return c;
}
export const MD_CURVE_RANGE = 8;
