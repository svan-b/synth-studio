// ============================================================================
// Elektron Analog Four MKII - parameter registry
//
// One table drives the spec (a control per track and parameter), the DATA
// ENTRY encoder bindings, the OLED, the parameter-lock keys and the engine.
// Pages, encoder slots, screen abbreviations, ranges and init values follow
// the OS 1.40A sound tables and the MKII NRPN map (see REFERENCE.md: SYSEX,
// MIDI): an NRPN's LSB minus the page base is the knob slot A..J.
//
// Control ids
//   t1_osc1_tune ... t4_lfo2_depb   synth tracks (t<n>_<key>)
//   t5_trig_* / t6_trig_*           the FX / CV tracks' NOTE page
//   fx_<key>                        FX track (chorus, delay, reverb, FX LFOs)
//   cv_<key>                        CV track
// Value units are the hardware's encoder units (0..127, -64..+63 ...); the
// worklet turns them into Hz and seconds (curves in REFERENCE.md / engine.ts).
// ============================================================================

import {
  NOTE_LENGTHS, TRIG_CONDITIONS, formatLength, formatMicro, formatNote,
} from '@/lib/sequencer/elektron';

export const SYNTH_TRACKS = 4;
export const FX_TRACK = 4;
export const CV_TRACK = 5;
/** Sequencer tracks: T1-T4, FX, CV */
export const SEQ_TRACKS = 6;
export const TRACK_NAMES = ['T1', 'T2', 'T3', 'T4', 'FX', 'CV'] as const;
export type TrackKind = 'synth' | 'fx' | 'cv';
export const trackKind = (t: number): TrackKind => (t === FX_TRACK ? 'fx' : t === CV_TRACK ? 'cv' : 'synth');

// ----------------------------------------------------------------------------
// Views: what the `page` UI switch holds. A PARAMETER key opens its first view;
// pressing it again opens the second one (OSC 1 > NOISE, OSC 2 > OSC 1&2,
// ENV > ENV 2, LFO > LFO 2). The FX and CV tracks show their own pages for
// the same keys (the white legend rows under the keys). The order is fixed:
// lessons store the indices.
// ----------------------------------------------------------------------------

export const VIEWS = [
  'NOTE', 'ARP', 'OSC1', 'OSC1_2', 'OSC2', 'OSC2_2', 'FLTR', 'AMP', 'ENV', 'ENV_2', 'LFO', 'LFO_2',
  'PERF', 'MIX', 'TEMPO', 'SOUND', 'SOUND_2',
] as const;
export type View = (typeof VIEWS)[number];
export const V = Object.fromEntries(VIEWS.map((v, i) => [v, i])) as Record<View, number>;
/** Option labels of the `page` switch (synth-track names) */
export const VIEW_LABELS = [
  'NOTE', 'ARP', 'OSC 1', 'NOISE', 'OSC 2', 'OSC 1&2', 'FILTER', 'AMP', 'ENV F', 'ENV 2', 'LFO 1', 'LFO 2',
  'PERF', 'MIX', 'TEMPO', 'VEL MOD', 'SOUND SET',
];

export type PageId =
  | 'note' | 'arp' | 'osc1' | 'noise' | 'osc2' | 'osc12' | 'filters' | 'amp' | 'envf' | 'env2' | 'lfo1' | 'lfo2'
  | 'vmod' | 'snd' | 'perf' | 'mix' | 'tempo'
  | 'fxnote' | 'extin' | 'chorus' | 'delay' | 'reverb' | 'fxlfo1' | 'fxlfo2'
  | 'cvnote' | 'cva' | 'cvb' | 'cvc' | 'cvd' | 'cvenv' | 'cvlfo';

export const PAGE_TITLE: Record<PageId, string> = {
  note: 'NOTE', arp: 'ARPEGGIATOR', osc1: 'OSC 1', noise: 'NOISE', osc2: 'OSC 2', osc12: 'OSC 1&2', filters: 'FILTERS',
  amp: 'AMP', envf: 'ENV F', env2: 'ENV 2', lfo1: 'LFO 1', lfo2: 'LFO 2', vmod: 'VELOCITY MOD', snd: 'SOUND SETTINGS',
  perf: 'PERFORMANCE', mix: 'PERF MIXER', tempo: 'TEMPO',
  fxnote: 'NOTE', extin: 'EXT IN', chorus: 'CHORUS', delay: 'DELAY', reverb: 'REVERB', fxlfo1: 'FX LFO 1', fxlfo2: 'FX LFO 2',
  cvnote: 'NOTE', cva: 'CV A', cvb: 'CV B', cvc: 'CV C', cvd: 'CV D', cvenv: 'CV ENV', cvlfo: 'CV LFO',
};

const SHARED: Partial<Record<View, PageId>> = { PERF: 'perf', MIX: 'mix', TEMPO: 'tempo' };
const SYNTH_VIEW: Record<View, PageId> = {
  NOTE: 'note', ARP: 'arp', OSC1: 'osc1', OSC1_2: 'noise', OSC2: 'osc2', OSC2_2: 'osc12', FLTR: 'filters', AMP: 'amp',
  ENV: 'envf', ENV_2: 'env2', LFO: 'lfo1', LFO_2: 'lfo2', PERF: 'perf', MIX: 'mix', TEMPO: 'tempo', SOUND: 'vmod', SOUND_2: 'snd',
};
const FX_VIEW: Partial<Record<View, PageId>> = {
  ...SHARED, NOTE: 'fxnote', OSC1: 'extin', OSC1_2: 'extin', FLTR: 'chorus', AMP: 'delay', ENV: 'reverb', ENV_2: 'reverb',
  LFO: 'fxlfo1', LFO_2: 'fxlfo2',
};
const CV_VIEW: Partial<Record<View, PageId>> = {
  ...SHARED, NOTE: 'cvnote', OSC1: 'cva', OSC1_2: 'cva', OSC2: 'cvb', OSC2_2: 'cvb', FLTR: 'cvc', AMP: 'cvd',
  ENV: 'cvenv', ENV_2: 'cvenv', LFO: 'cvlfo', LFO_2: 'cvlfo',
};

/** The page a view shows on a track (null: that key has no page on this track type) */
export function pageFor(track: number, view: number): PageId | null {
  const v = VIEWS[Math.max(0, Math.min(VIEWS.length - 1, Math.round(view)))];
  const k = trackKind(track);
  return (k === 'synth' ? SYNTH_VIEW[v] : k === 'fx' ? FX_VIEW[v] : CV_VIEW[v]) ?? null;
}

/** The PARAMETER-style keys: views opened by the first and second press */
export const PAGE_KEYS: Record<string, [View, View?]> = {
  ARP: ['ARP'], NOTE: ['NOTE'], OSC1: ['OSC1', 'OSC1_2'], OSC2: ['OSC2', 'OSC2_2'], FLTR: ['FLTR'], AMP: ['AMP'],
  ENV: ['ENV', 'ENV_2'], LFO: ['LFO', 'LFO_2'], PERF: ['PERF'], MIX: ['MIX'], TEMPO: ['TEMPO'], SOUND: ['SOUND', 'SOUND_2'],
};

/** View after pressing a page key (second press toggles to the second page when this track has one) */
export function viewAfterPress(key: string, track: number, current: number): number {
  const views = PAGE_KEYS[key];
  if (!views) return current;
  const [a, b] = views;
  if (b && current === V[a] && pageFor(track, V[b]) !== pageFor(track, V[a]) && pageFor(track, V[b])) return V[b];
  return V[a];
}

/** Which key owns a view, and whether it is that key's second page */
export function keyOfView(view: number): { key: string; second: boolean } | null {
  const name = VIEWS[view];
  for (const k in PAGE_KEYS) {
    const [a, b] = PAGE_KEYS[k];
    if (a === name) return { key: k, second: false };
    if (b === name) return { key: k, second: true };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Option lists (hardware order and screen spelling)
// ----------------------------------------------------------------------------

export const WAVES1 = ['SAW', 'TRP', 'PUL', 'TRI', 'INL', 'INR', 'FDB', 'OFF'];
export const WAVES2 = ['SAW', 'TRP', 'PUL', 'TRI', 'INL', 'INR', 'NEI', 'OFF'];
export const WAVE_NAMES = ['sawtooth', 'transistor pulse', 'pulse', 'triangle', 'input L', 'input R', 'filter feedback / neighbour', 'off'];
export const SUBS = ['OFF', '1OCT', '2OCT', '2PUL', '5TH'];
export const ONOFF = ['OFF', 'ON'];
export const SYNC_MODES = ['OFF', '1>2', '2>1', 'MTL'];
export const F2_TYPES = ['LP2', 'LP1', 'BP', 'HP1', 'HP2', 'BS', 'PK'];
/** 12 envelope shapes; (R) = restarts from zero on every trig */
export const ENV_SHAPES = ['LIN', 'LIN R', 'STD', 'STD R', 'EA.LD', 'EA.LD R', 'EXP', 'EXP R', 'FULL', 'FULL R', 'FA.ED', 'FA.ED R'];
export const ENV_SHAPE_NAMES = [
  'Linear ADR', 'Linear ADR (restart)', 'Standard', 'Standard (restart)', 'Exp. attack / linear DR', 'Exp. attack / linear DR (restart)',
  'Exponential ADR', 'Exponential ADR (restart)', 'Full ADR', 'Full ADR (restart)', 'Full attack / exp. DR', 'Full attack / exp. DR (restart)',
];
/** LFO multipliers: x = tempo synced, . = fixed 120 BPM */
export const LFO_MULTS = [
  'x1', 'x2', 'x4', 'x8', 'x16', 'x32', 'x64', 'x128', 'x256', 'x512', 'x1K', 'x2K',
  '.1', '.2', '.4', '.8', '.16', '.32', '.64', '.128', '.256', '.512', '.1K', '.2K',
];
export const LFO_MODES = ['FRE', 'TRG', 'HLD', 'ONE', 'HLF'];
export const LFO_WAVES = ['TRI', 'SIN', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'];
export const ARP_MODES = ['OFF', 'THR', 'UP', 'DWN', 'CYC', 'SHF', 'RND'];
export const PORTA_MODES = ['OFF', 'ON', 'LEG'];
export const CV_SOURCES = ['T1', 'T2', 'T3', 'T4', 'FX', 'CV'];

// ----------------------------------------------------------------------------
// Modulation destinations (ENV F / ENV 2 / LFO DST, VELOCITY MOD). Index 0 =
// none. `keys` are the voice parameters (or the virtual pitch inputs) a route
// adds to; `range` is the offset in parameter units at full depth (128).
// A subset of the hardware's list (REFERENCE.md, MIDI "Destination A"):
// discrete targets (waveform, sub, sync mode, shapes) are left out.
// ----------------------------------------------------------------------------

export interface ModDest { name: string; long: string; keys: string[]; range: number }

export const MOD_DESTS: ModDest[] = [
  { name: '---', long: 'None', keys: [], range: 0 },
  { name: 'O1 PIT', long: 'Osc 1 pitch', keys: ['osc1_pmod'], range: 24 },
  { name: 'O1 DET', long: 'Osc 1 linear detune', keys: ['osc1_det'], range: 128 },
  { name: 'O1 LEV', long: 'Osc 1 level', keys: ['osc1_lev'], range: 127 },
  { name: 'O1 PW', long: 'Osc 1 pulse width', keys: ['osc1_pw'], range: 128 },
  { name: 'O1 SPD', long: 'Osc 1 PWM speed', keys: ['osc1_spd'], range: 127 },
  { name: 'O1 PWM', long: 'Osc 1 PWM depth', keys: ['osc1_pwm'], range: 127 },
  { name: 'O2 PIT', long: 'Osc 2 pitch', keys: ['osc2_pmod'], range: 24 },
  { name: 'O2 DET', long: 'Osc 2 linear detune', keys: ['osc2_det'], range: 128 },
  { name: 'O2 LEV', long: 'Osc 2 level', keys: ['osc2_lev'], range: 127 },
  { name: 'O2 PW', long: 'Osc 2 pulse width', keys: ['osc2_pw'], range: 128 },
  { name: 'O2 SPD', long: 'Osc 2 PWM speed', keys: ['osc2_spd'], range: 127 },
  { name: 'O2 PWM', long: 'Osc 2 PWM depth', keys: ['osc2_pwm'], range: 127 },
  { name: 'OSC PIT', long: 'Osc 1+2 pitch', keys: ['osc1_pmod', 'osc2_pmod'], range: 24 },
  { name: 'SNC AMT', long: 'Sync amount', keys: ['osc_snc'], range: 127 },
  { name: 'SLI TIM', long: 'Note slide time', keys: ['osc_sli'], range: 127 },
  { name: 'VIB SPD', long: 'Vibrato speed', keys: ['osc_vsp'], range: 127 },
  { name: 'VIB DEP', long: 'Vibrato depth', keys: ['osc_vib'], range: 127 },
  { name: 'NOI SNH', long: 'Noise sample & hold', keys: ['noise_snh'], range: 127 },
  { name: 'NOI COL', long: 'Noise colour', keys: ['noise_col'], range: 128 },
  { name: 'NOI LEV', long: 'Noise level', keys: ['noise_lev'], range: 127 },
  { name: 'F1 FRQ', long: 'Filter 1 frequency', keys: ['flt1_frq'], range: 127 },
  { name: 'F1 RES', long: 'Filter 1 resonance', keys: ['flt1_res'], range: 127 },
  { name: 'F1 OVR', long: 'Filter 1 overdrive', keys: ['flt1_ovr'], range: 128 },
  { name: 'F1 DEP', long: 'Filter 1 env depth', keys: ['flt1_dep'], range: 128 },
  { name: 'F2 FRQ', long: 'Filter 2 frequency', keys: ['flt2_frq'], range: 127 },
  { name: 'F2 RES', long: 'Filter 2 resonance', keys: ['flt2_res'], range: 127 },
  { name: 'F2 DEP', long: 'Filter 2 env depth', keys: ['flt2_dep'], range: 128 },
  { name: 'F1+F2', long: 'Filter 1 + 2 frequency', keys: ['flt1_frq', 'flt2_frq'], range: 127 },
  { name: 'AMP ATK', long: 'Amp attack', keys: ['amp_atk'], range: 127 },
  { name: 'AMP DEC', long: 'Amp decay', keys: ['amp_dec'], range: 127 },
  { name: 'AMP SUS', long: 'Amp sustain', keys: ['amp_sus'], range: 127 },
  { name: 'AMP REL', long: 'Amp release', keys: ['amp_rel'], range: 127 },
  { name: 'AMP CHO', long: 'Chorus send', keys: ['amp_cho'], range: 127 },
  { name: 'AMP DEL', long: 'Delay send', keys: ['amp_del'], range: 127 },
  { name: 'AMP REV', long: 'Reverb send', keys: ['amp_rev'], range: 127 },
  { name: 'AMP PAN', long: 'Pan', keys: ['amp_pan'], range: 128 },
  { name: 'AMP VOL', long: 'Volume', keys: ['amp_vol'], range: 127 },
  { name: 'ACC LEV', long: 'Accent level', keys: ['snd_acc'], range: 127 },
  { name: 'EF ATK', long: 'Env F attack', keys: ['envf_atk'], range: 127 },
  { name: 'EF DEC', long: 'Env F decay', keys: ['envf_dec'], range: 127 },
  { name: 'EF SUS', long: 'Env F sustain', keys: ['envf_sus'], range: 127 },
  { name: 'EF REL', long: 'Env F release', keys: ['envf_rel'], range: 127 },
  { name: 'EF DPA', long: 'Env F depth A', keys: ['envf_depa'], range: 128 },
  { name: 'EF DPB', long: 'Env F depth B', keys: ['envf_depb'], range: 128 },
  { name: 'E2 ATK', long: 'Env 2 attack', keys: ['env2_atk'], range: 127 },
  { name: 'E2 DEC', long: 'Env 2 decay', keys: ['env2_dec'], range: 127 },
  { name: 'E2 SUS', long: 'Env 2 sustain', keys: ['env2_sus'], range: 127 },
  { name: 'E2 REL', long: 'Env 2 release', keys: ['env2_rel'], range: 127 },
  { name: 'E2 DPA', long: 'Env 2 depth A', keys: ['env2_depa'], range: 128 },
  { name: 'E2 DPB', long: 'Env 2 depth B', keys: ['env2_depb'], range: 128 },
  { name: 'L1 SPD', long: 'LFO 1 speed', keys: ['lfo1_spd'], range: 128 },
  { name: 'L1 FAD', long: 'LFO 1 fade', keys: ['lfo1_fad'], range: 128 },
  { name: 'L1 SPH', long: 'LFO 1 start phase', keys: ['lfo1_sph'], range: 127 },
  { name: 'L1 DPA', long: 'LFO 1 depth A', keys: ['lfo1_depa'], range: 128 },
  { name: 'L1 DPB', long: 'LFO 1 depth B', keys: ['lfo1_depb'], range: 128 },
];
export const DEST_NAMES = MOD_DESTS.map(d => d.name);
export const dest = (name: string) => Math.max(0, DEST_NAMES.indexOf(name));

/** FX LFO destinations (FX track parameters) */
export const FX_DESTS: { name: string; key: string; range: number }[] = [
  { name: '---', key: '', range: 0 },
  { name: 'CHO PRE', key: 'cho_pre', range: 127 }, { name: 'CHO SPD', key: 'cho_spd', range: 127 },
  { name: 'CHO DEP', key: 'cho_dep', range: 127 }, { name: 'CHO WID', key: 'cho_wid', range: 127 },
  { name: 'CHO FB', key: 'cho_fb', range: 127 }, { name: 'CHO HPF', key: 'cho_hpf', range: 127 },
  { name: 'CHO LPF', key: 'cho_lpf', range: 127 }, { name: 'CHO VOL', key: 'cho_vol', range: 127 },
  { name: 'DEL TIM', key: 'del_tim', range: 127 }, { name: 'DEL WID', key: 'del_wid', range: 128 },
  { name: 'DEL FB', key: 'del_fb', range: 127 }, { name: 'DEL HPF', key: 'del_hpf', range: 127 },
  { name: 'DEL LPF', key: 'del_lpf', range: 127 }, { name: 'DEL OVR', key: 'del_ovr', range: 127 },
  { name: 'DEL VOL', key: 'del_vol', range: 127 },
  { name: 'REV PRE', key: 'rev_pre', range: 127 }, { name: 'REV DEC', key: 'rev_dec', range: 127 },
  { name: 'REV FRQ', key: 'rev_frq', range: 127 }, { name: 'REV GAI', key: 'rev_gai', range: 127 },
  { name: 'REV HPF', key: 'rev_hpf', range: 127 }, { name: 'REV LPF', key: 'rev_lpf', range: 127 },
  { name: 'REV VOL', key: 'rev_vol', range: 127 },
];
export const FX_DEST_NAMES = FX_DESTS.map(d => d.name);

// ----------------------------------------------------------------------------
// Parameter definitions
// ----------------------------------------------------------------------------

export interface ParamDef {
  /** Key inside the track: the control id is t<n>_<key> / fx_<key> / cv_<key> */
  key: string;
  page: PageId;
  /** Encoder slot 0..9 = A..J */
  slot: number;
  /** Screen abbreviation */
  short: string;
  /** Full name (manual) */
  name: string;
  min: number;
  max: number;
  def: number;
  step?: number;
  options?: string[];
  bipolar?: boolean;
  fmt?: (v: number) => string;
  desc: string;
  manual: string;
  /** false = cannot be parameter-locked */
  lock?: boolean;
}

const APX = 'Manual Appendix A - synth track parameters';
const APB = 'Manual Appendix B - FX track parameters';
const APC = 'Manual Appendix C - CV track parameters';
const SEQM = 'Manual 10 - The sequencer (NOTE menu)';

const int = (v: number) => String(Math.round(v));
const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : String(Math.round(v)));
const opt = (list: string[]) => (v: number) => list[Math.round(v)] ?? String(v);
const depthFmt = (v: number) => (v > 0 ? `+${v}` : String(v));

/** One OSC page (OSC 1 / OSC 2): TUN FIN DET TRK LEV / WAV SUB PW SPD PWM */
function oscPage(n: 1 | 2): ParamDef[] {
  const page: PageId = n === 1 ? 'osc1' : 'osc2';
  const o = `osc${n}_`;
  const M = `${APX}, OSC ${n} page`;
  const waves = n === 1 ? WAVES1 : WAVES2;
  return [
    { key: `${o}tun`, page, slot: 0, short: 'TUN', name: `Osc ${n} coarse tune`, min: -63, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Pitch in semitones: +12 is one octave up.' },
    { key: `${o}fin`, page, slot: 1, short: 'FIN', name: `Osc ${n} fine tune`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Fine pitch in 1/128 of a semitone: the full range is half a semitone either way.' },
    { key: `${o}det`, page, slot: 2, short: 'DET', name: `Osc ${n} linear detune`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Detunes by a fixed number of hertz (not cents), so low notes beat as fast as high ones and bass gets relatively more detune.' },
    { key: `${o}trk`, page, slot: 3, short: 'TRK', name: `Osc ${n} keytrack`, min: 0, max: 1, def: 1, options: ONOFF, fmt: opt(ONOFF), manual: M, desc: 'ON: the oscillator follows the note. OFF: constant pitch, for drums and effects.' },
    { key: `${o}lev`, page, slot: 4, short: 'LEV', name: `Osc ${n} level`, min: 0, max: 127, def: n === 1 ? 100 : 0, fmt: int, manual: M, desc: 'Level of the oscillator and its sub oscillator into the filters.' },
    { key: `${o}wav`, page, slot: 5, short: 'WAV', name: `Osc ${n} waveform`, min: 0, max: 7, def: 0, options: waves, fmt: opt(waves), manual: M, desc: n === 1
      ? 'SAW sawtooth, TRP transistor pulse, PUL pulse, TRI triangle, INL/INR the audio inputs, FDB filter feedback, OFF.'
      : 'SAW sawtooth, TRP transistor pulse, PUL pulse, TRI triangle, INL/INR the audio inputs, NEI the previous track\'s sound (T2 hears T1), OFF.' },
    { key: `${o}sub`, page, slot: 6, short: 'SUB', name: `Osc ${n} sub oscillator`, min: 0, max: 4, def: 0, options: SUBS, fmt: opt(SUBS), manual: M, desc: '1OCT a square one octave down, 2OCT a square two octaves down, 2PUL a 25% pulse two octaves down, 5TH a 33% pulse a fifth (7 semitones) below, at 2/3 of the frequency. PW and PWM leave the sub alone.' },
    { key: `${o}pw`, page, slot: 7, short: 'PW', name: `Osc ${n} pulse width`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${M} (manual p.72, p.87)`, desc: 'Reshapes every wave; 0 is the plain one. PUL / TRP: the pulse width (the extremes mute them). TRI: towards a reversed saw. SAW: a second, phase-shifted saw (single again at the extremes).' },
    { key: `${o}spd`, page, slot: 8, short: 'SPD', name: `Osc ${n} PWM speed`, min: 0, max: 127, def: n === 1 ? 10 : 37, fmt: int, manual: M, desc: 'Speed of the oscillator\'s own pulse-width LFO.' },
    { key: `${o}pwm`, page, slot: 9, short: 'PWM', name: `Osc ${n} PWM depth`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'How far that LFO sweeps the pulse width: a moving, chorus-like thickness.' },
  ];
}

function envPage(id: 'envf' | 'env2'): ParamDef[] {
  const e = `${id}_`;
  const M = `${APX}, ${id === 'envf' ? 'ENV F' : 'ENV 2'} page`;
  const lenFmt = (v: number) => (v <= 0 ? 'OFF' : envLenSteps(v).toFixed(envLenSteps(v) < 1 ? 3 : envLenSteps(v) < 10 ? 2 : 0));
  return [
    { key: `${e}atk`, page: id, slot: 0, short: 'ATK', name: 'Attack time', min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Time to rise from zero to full.' },
    { key: `${e}dec`, page: id, slot: 1, short: 'DEC', name: 'Decay time', min: 0, max: 127, def: 64, fmt: int, manual: M, desc: 'Time to fall from full to the sustain level.' },
    { key: `${e}sus`, page: id, slot: 2, short: 'SUS', name: 'Sustain level', min: 0, max: 127, def: 64, fmt: int, manual: M, desc: 'Level held while the note (or LEN) gate is open.' },
    { key: `${e}rel`, page: id, slot: 3, short: 'REL', name: 'Release time', min: 0, max: 127, def: 8, fmt: v => (v >= 127 ? 'INF' : int(v)), manual: M, desc: 'Time to fall to zero after the gate closes (127 = never).' },
    { key: `${e}shp`, page: id, slot: 4, short: 'SHP', name: 'Envelope shape', min: 0, max: 11, def: 2, options: ENV_SHAPES, fmt: opt(ENV_SHAPES), manual: M, desc: 'Curve of the segments (linear, exponential...) and whether it restarts from zero (R).' },
    { key: `${e}len`, page: id, slot: 5, short: 'LEN', name: 'Gate length', min: 0, max: 127, def: 0, fmt: lenFmt, manual: M, desc: 'OFF: the envelope follows the note. Otherwise its own gate length in steps, whatever the note length.' },
    { key: `${e}dsta`, page: id, slot: 6, short: 'DST', name: 'Destination A', min: 0, max: MOD_DESTS.length - 1, def: id === 'envf' ? dest('O1 PW') : dest('L1 SPD'), options: DEST_NAMES, fmt: opt(DEST_NAMES), manual: M, desc: 'First parameter this envelope modulates.', lock: false },
    { key: `${e}depa`, page: id, slot: 7, short: 'DEP', name: 'Depth A', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination A (negative inverts).' },
    { key: `${e}dstb`, page: id, slot: 8, short: 'DST', name: 'Destination B', min: 0, max: MOD_DESTS.length - 1, def: dest('O2 PW'), options: DEST_NAMES, fmt: opt(DEST_NAMES), manual: M, desc: 'Second parameter this envelope modulates.', lock: false },
    { key: `${e}depb`, page: id, slot: 9, short: 'DEP', name: 'Depth B', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination B.' },
  ];
}

function lfoPage(n: 1 | 2): ParamDef[] {
  const page: PageId = n === 1 ? 'lfo1' : 'lfo2';
  const l = `lfo${n}_`;
  const M = `${APX}, LFO ${n} page`;
  return [
    { key: `${l}spd`, page, slot: 0, short: 'SPD', name: 'LFO speed', min: -64, max: 63, def: n === 1 ? 48 : 32, bipolar: true, fmt: signed, manual: M, desc: 'Speed, synced to the tempo: SPD x MUL = 128 is one cycle per bar. Negative runs the shape backwards.' },
    { key: `${l}mul`, page, slot: 1, short: 'MUL', name: 'LFO multiplier', min: 0, max: LFO_MULTS.length - 1, def: 4, options: LFO_MULTS, fmt: opt(LFO_MULTS), manual: M, desc: 'Multiplies SPD. x values follow the tempo; dotted values assume 120 BPM whatever the tempo.' },
    { key: `${l}fad`, page, slot: 2, short: 'FAD', name: 'LFO fade in/out', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Negative fades the modulation in after each trig, positive fades it out, 0 = none.' },
    { key: `${l}sph`, page, slot: 3, short: 'SPH', name: 'LFO start phase', min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Where in the cycle a trig restarts the LFO (TRIG, ONE and HALF modes). 64 is half a cycle.' },
    { key: `${l}mod`, page, slot: 4, short: 'MOD', name: 'LFO trig mode', min: 0, max: 4, def: 0, options: LFO_MODES, fmt: opt(LFO_MODES), manual: M, desc: 'FREE runs on, TRIG restarts on every note, HOLD freezes the value at each note, ONE plays one cycle, HALF half a cycle.' },
    { key: `${l}wav`, page, slot: 5, short: 'WAV', name: 'LFO waveform', min: 0, max: 6, def: 0, options: LFO_WAVES, fmt: opt(LFO_WAVES), manual: M, desc: 'TRI, SIN, SQR, SAW, EXP and RMP (one-sided), RND random steps.' },
    { key: `${l}dsta`, page, slot: 6, short: 'DST', name: 'Destination A', min: 0, max: MOD_DESTS.length - 1, def: dest('F1 FRQ'), options: DEST_NAMES, fmt: opt(DEST_NAMES), manual: M, desc: 'First parameter this LFO modulates.', lock: false },
    { key: `${l}depa`, page, slot: 7, short: 'DEP', name: 'Depth A', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination A.' },
    { key: `${l}dstb`, page, slot: 8, short: 'DST', name: 'Destination B', min: 0, max: MOD_DESTS.length - 1, def: dest('F2 FRQ'), options: DEST_NAMES, fmt: opt(DEST_NAMES), manual: M, desc: 'Second parameter this LFO modulates.', lock: false },
    { key: `${l}depb`, page, slot: 9, short: 'DEP', name: 'Depth B', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination B.' },
  ];
}

/** ENV LEN 1..127 -> steps (exponential, 0.125 .. 128 steps) */
export function envLenSteps(v: number): number {
  return v <= 0 ? 0 : 0.125 * Math.pow(2, ((v - 1) / 126) * 10);
}

const condFmt = (v: number) => TRIG_CONDITIONS[Math.round(v)] || '---';

/** The NOTE page (trig parameters). Shared by every track type. */
export function notePage(page: 'note' | 'fxnote' | 'cvnote'): ParamDef[] {
  const out: ParamDef[] = [];
  if (page !== 'fxnote') out.push({ key: 'trig_note', page, slot: 0, short: 'NOT', name: 'Note', min: 0, max: 127, def: 60, fmt: v => formatNote(v), manual: SEQM, desc: 'Note of new trigs. Hold a trig key and turn it to give that step its own note.' });
  out.push(
    { key: 'trig_vel', page, slot: 1, short: 'VEL', name: 'Velocity', min: 1, max: 127, def: 100, fmt: int, manual: SEQM, desc: 'Velocity of trigs: louder notes, and the VELOCITY MOD routings.' },
    { key: 'trig_len', page, slot: 2, short: 'LEN', name: 'Note length', min: 0, max: NOTE_LENGTHS.length - 1, def: 14, fmt: v => formatLength(v), manual: SEQM, desc: 'How long the gate stays open (1/16 = one step). Sustain and release depend on it.' },
    { key: 'trig_micro', page, slot: 3, short: 'µTM', name: 'Micro timing', min: -23, max: 23, def: 0, bipolar: true, fmt: v => formatMicro(v), manual: SEQM, desc: 'Nudges a held trig early or late in 1/384 steps of a whole note. Only on held trigs.' },
    // TRC takes PRB's place (knob E) while a trig is held (manual p.45, p.50): slot -2 marks it
    { key: 'trig_cond', page, slot: -2, short: 'TRC', name: 'Trig condition', min: 0, max: TRIG_CONDITIONS.length - 1, def: 0, fmt: condFmt, manual: `${SEQM} (manual p.50)`, desc: 'A rule that decides whether a held trig plays: 1:2 every second loop, 50% a coin toss, FILL only in fill mode...' },
    { key: 'trig_prob', page, slot: 4, short: 'PRB', name: 'Track trig probability', min: 0, max: 100, def: 100, fmt: v => `${Math.round(v)}%`, manual: `${SEQM} (manual p.45)`, desc: 'Chance that each plain trig of this track plays (trigs with a condition ignore it). Hold a trig and the knob becomes TRC.' },
  );
  if (page === 'note') {
    // retrigger switches, lock only: on for note trigs, off for lock trigs unless locked on (manual p.45)
    const rt = (key: string, slot: number, short: string, what: string): ParamDef => ({
      key, page, slot, short, name: `${what} retrig`, min: 0, max: 1, def: 1, options: ONOFF, fmt: opt(ONOFF), manual: `${SEQM} (manual p.45)`,
      desc: `Hold a trig and set whether it retriggers ${what}: switch it off on a note trig to let ${what} run on, or on on a lock trig to restart it without a note.`,
    });
    out.push(rt('trig_envf', 5, 'ENVF', 'ENV F'), rt('trig_env2', 6, 'ENV2', 'ENV 2'), rt('trig_lfo1', 7, 'LFO1', 'LFO 1'), rt('trig_lfo2', 8, 'LFO2', 'LFO 2'));
  }
  return out;
}

/** Every per-track synth parameter */
export const SYNTH_PARAMS: ParamDef[] = [
  ...notePage('note'),

  // ARPEGGIATOR
  { key: 'arp_mod', page: 'arp', slot: 0, short: 'MOD', name: 'Arpeggiator mode', min: 0, max: ARP_MODES.length - 1, def: 0, options: ARP_MODES, fmt: opt(ARP_MODES), manual: 'Manual p.43-44, ARPEGGIATOR', lock: false, desc: 'OFF, THR (the order the notes came in), UP, DWN, CYC (up then down), SHF (a new random order each octave), RND (random every note). PLY needs POLY mode, which the twin does not have.' },
  { key: 'arp_spd', page: 'arp', slot: 1, short: 'SPD', name: 'Arpeggiator speed', min: 1, max: 48, def: 6, fmt: int, manual: 'Manual p.43-44, ARPEGGIATOR', lock: false, desc: 'Time between arpeggio notes in 1/24 beats: 6 = 16th notes, 12 = 8th notes, 4 = 16th triplets.' },
  { key: 'arp_rng', page: 'arp', slot: 2, short: 'RNG', name: 'Arpeggiator range', min: 1, max: 4, def: 1, fmt: v => `${Math.round(v)}OCT`, manual: 'Manual p.43-44, ARPEGGIATOR', lock: false, desc: 'Octaves the pattern climbs before it starts again.' },
  { key: 'arp_nlen', page: 'arp', slot: 4, short: 'LEN', name: 'Arpeggio note length', min: 0, max: 46, def: 12, fmt: v => formatLength(v), manual: 'Manual p.44, ARPEGGIATOR', lock: false, desc: 'Gate length of each arpeggiated note.' },
  { key: 'arp_leg', page: 'arp', slot: 3, short: 'LEG', name: 'Legato', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: 'Manual p.44, ARPEGGIATOR', lock: false, desc: 'ON: overlapping notes play legato, without retriggering the envelopes (no glide: that is a slide trig). It also works on the track\'s note trigs with the arpeggiator OFF.' },
  { key: 'arp_n2', page: 'arp', slot: 5, short: 'NO2', name: 'Arp note 2 offset', min: 0, max: 24, def: 0, fmt: v => (v ? `+${Math.round(v)}` : '---'), manual: 'Manual - Arpeggiator setup', desc: 'Adds a note this many semitones above the played note (0 = none).' },
  { key: 'arp_n3', page: 'arp', slot: 6, short: 'NO3', name: 'Arp note 3 offset', min: 0, max: 24, def: 0, fmt: v => (v ? `+${Math.round(v)}` : '---'), manual: 'Manual - Arpeggiator setup', desc: 'A third note, in semitones above the played note.' },
  { key: 'arp_n4', page: 'arp', slot: 7, short: 'NO4', name: 'Arp note 4 offset', min: 0, max: 24, def: 0, fmt: v => (v ? `+${Math.round(v)}` : '---'), manual: 'Manual - Arpeggiator setup', desc: 'A fourth note, in semitones above the played note.' },

  ...oscPage(1),
  // NOISE (OSC 1, second page)
  { key: 'noise_snh', page: 'noise', slot: 0, short: 'S&H', name: 'Noise sample & hold', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, NOISE page`, desc: 'Holds each noise sample for a while: 0 is plain white noise, higher values give grainy, bit-crushed noise.' },
  { key: 'noise_col', page: 'noise', slot: 1, short: 'COL', name: 'Noise colour', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, NOISE page`, desc: 'Filters the noise: 0 is white; negative is low-passed (-32 pink, -64 red, which falls 6 dB an octave); positive is high-passed, thinner and hissier.' },
  { key: 'noise_fad', page: 'noise', slot: 2, short: 'FAD', name: 'Noise fade', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, NOISE page`, desc: '0 = constant noise. Positive fades the noise out after each trig, negative fades it in.' },
  { key: 'noise_lev', page: 'noise', slot: 4, short: 'LEV', name: 'Noise level', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, NOISE page`, desc: 'Level of the noise generator into the filters.' },

  ...oscPage(2),
  // OSC 1&2 (OSC 2, second page)
  { key: 'osc_am1', page: 'osc12', slot: 0, short: 'AM1', name: 'Osc 1 amplitude modulation', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: `${APX}, OSC 1&2 page`, desc: 'Oscillator 2 modulates the amplitude of oscillator 1: new sideband tones, bell-like at odd ratios.' },
  { key: 'osc_smd', page: 'osc12', slot: 1, short: 'SMD', name: 'Sync mode', min: 0, max: 3, def: 0, options: SYNC_MODES, fmt: opt(SYNC_MODES), manual: `${APX}, OSC 1&2 page`, desc: 'OFF, 1>2 (osc 1 resets osc 2), 2>1 (osc 2 resets osc 1), MTL (they reset each other: metallic).' },
  { key: 'osc_snc', page: 'osc12', slot: 2, short: 'SNC', name: 'Sync amount', min: 0, max: 127, def: 127, fmt: int, manual: `${APX}, OSC 1&2 page`, desc: 'How hard the reset is: 127 = full hard sync, lower = softer.' },
  { key: 'osc_bnd', page: 'osc12', slot: 3, short: 'BND', name: 'Auto bend depth', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, OSC 1&2 page (manual p.88)`, desc: 'Auto bend: every trigged note starts this far off its pitch (positive above, negative below) and glides to it in the SLI time. Great for drums and sync sweeps; with sync on, only the synced oscillator bends.' },
  { key: 'osc_sli', page: 'osc12', slot: 4, short: 'SLI', name: 'Note slide time', min: 0, max: 127, def: 32, fmt: int, manual: `${APX}, OSC 1&2 page`, desc: 'Time a slide trig (or portamento) takes to glide to the new note; also the time of the BND auto bend.' },
  { key: 'osc_am2', page: 'osc12', slot: 5, short: 'AM2', name: 'Osc 2 amplitude modulation', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: `${APX}, OSC 1&2 page`, desc: 'Oscillator 1 modulates the amplitude of oscillator 2.' },
  { key: 'osc_trg', page: 'osc12', slot: 6, short: 'TRG', name: 'Oscillator retrig', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: `${APX}, OSC 1&2 page`, desc: 'ON: both oscillators restart their cycle on every note, for identical, punchy attacks (kicks).' },
  { key: 'osc_vfa', page: 'osc12', slot: 7, short: 'FAD', name: 'Vibrato fade', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, OSC 1&2 page`, desc: 'Negative fades the vibrato in after each note, positive fades it out.' },
  { key: 'osc_vsp', page: 'osc12', slot: 8, short: 'SPD', name: 'Vibrato speed', min: 0, max: 127, def: 32, fmt: int, manual: `${APX}, OSC 1&2 page`, desc: 'Speed of the dedicated vibrato LFO.' },
  { key: 'osc_vib', page: 'osc12', slot: 9, short: 'VIB', name: 'Vibrato depth', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, OSC 1&2 page`, desc: 'Depth of the vibrato on both oscillators.' },

  // FILTERS: filter 1 (4-pole ladder low-pass), filter 2 (2-pole multimode)
  { key: 'flt1_frq', page: 'filters', slot: 0, short: 'FRQ', name: 'Filter 1 frequency', min: 0, max: 127, def: 127, fmt: int, manual: `${APX}, FILTERS page`, desc: 'Cutoff of the 24 dB/octave ladder low-pass, one semitone a step: 0 = 13 Hz, 64 = 520 Hz, 127 = 20 kHz.' },
  { key: 'flt1_res', page: 'filters', slot: 1, short: 'RES', name: 'Filter 1 resonance', min: 0, max: 127, def: 25, fmt: int, manual: `${APX}, FILTERS page (manual p.73: about 25 is the default and the flattest response)`, desc: 'Feedback around the ladder: a peak at the cutoff that rings, and whistles near the top.' },
  { key: 'flt1_ovr', page: 'filters', slot: 2, short: 'OVR', name: 'Overdrive', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, FILTERS page (manual p.89)`, desc: '0 is clean. Positive values clip the signal after filter 1; negative values drive it more softly inside the filter.' },
  { key: 'flt1_trk', page: 'filters', slot: 3, short: 'TRK', name: 'Filter 1 keytracking', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, FILTERS page`, desc: 'How much the cutoff follows the note: 32 tracks it exactly, so high notes stay as bright as low ones.' },
  { key: 'flt1_dep', page: 'filters', slot: 4, short: 'DEP', name: 'Filter 1 env depth', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, FILTERS page`, desc: 'How far ENV F sweeps filter 1 (64 = the full range).' },
  { key: 'flt2_frq', page: 'filters', slot: 5, short: 'FRQ', name: 'Filter 2 frequency', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, FILTERS page`, desc: 'Cutoff of the 2-pole multimode filter (same scale as filter 1).' },
  { key: 'flt2_res', page: 'filters', slot: 6, short: 'RES', name: 'Filter 2 resonance', min: 0, max: 127, def: 12, fmt: int, manual: `${APX}, FILTERS page`, desc: 'Resonance of filter 2 (in PK mode: how much the band is boosted).' },
  { key: 'flt2_typ', page: 'filters', slot: 7, short: 'TYP', name: 'Filter 2 type', min: 0, max: 6, def: 4, options: F2_TYPES, fmt: opt(F2_TYPES), manual: `${APX}, FILTERS page`, desc: 'LP2 12 dB low-pass, LP1 6 dB low-pass, BP band-pass, HP1 6 dB high-pass, HP2 12 dB high-pass, BS band-stop, PK peak.' },
  { key: 'flt2_trk', page: 'filters', slot: 8, short: 'TRK', name: 'Filter 2 keytracking', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, FILTERS page`, desc: 'Keytracking for filter 2 (32 = exact).' },
  { key: 'flt2_dep', page: 'filters', slot: 9, short: 'DEP', name: 'Filter 2 env depth', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: `${APX}, FILTERS page`, desc: 'How far ENV F sweeps filter 2.' },

  // AMP
  { key: 'amp_atk', page: 'amp', slot: 0, short: 'ATK', name: 'Amp attack', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, AMP page`, desc: 'Fade-in time of each note (0 = instant, 64 = 0.13 s, 127 = 16 s).' },
  { key: 'amp_dec', page: 'amp', slot: 1, short: 'DEC', name: 'Amp decay', min: 0, max: 127, def: 64, fmt: int, manual: `${APX}, AMP page`, desc: 'Time to fall to the sustain level.' },
  { key: 'amp_sus', page: 'amp', slot: 2, short: 'SUS', name: 'Amp sustain', min: 0, max: 127, def: 100, fmt: int, manual: `${APX}, AMP page`, desc: 'Level held while the note gate (LEN) is open.' },
  { key: 'amp_rel', page: 'amp', slot: 3, short: 'REL', name: 'Amp release', min: 0, max: 127, def: 8, fmt: v => (v >= 127 ? 'INF' : int(v)), manual: `${APX}, AMP page`, desc: 'Fade-out after the gate closes (127 = never: a drone).' },
  { key: 'amp_shp', page: 'amp', slot: 4, short: 'SHP', name: 'Amp envelope shape', min: 0, max: 11, def: 2, options: ENV_SHAPES, fmt: opt(ENV_SHAPES), manual: `${APX}, AMP page`, desc: 'Segment curves of the amp envelope and whether it restarts from zero (R).' },
  { key: 'amp_cho', page: 'amp', slot: 5, short: 'CHO', name: 'Chorus send', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, AMP page`, desc: 'Amount sent to the FX track chorus.' },
  { key: 'amp_del', page: 'amp', slot: 6, short: 'DEL', name: 'Delay send', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, AMP page`, desc: 'Amount sent to the FX track delay.' },
  { key: 'amp_rev', page: 'amp', slot: 7, short: 'REV', name: 'Reverb send', min: 0, max: 127, def: 0, fmt: int, manual: `${APX}, AMP page`, desc: 'Amount sent to the FX track reverb.' },
  { key: 'amp_pan', page: 'amp', slot: 8, short: 'PAN', name: 'Panning', min: -64, max: 63, def: 0, bipolar: true, fmt: v => (v < 0 ? `L${-Math.round(v)}` : v > 0 ? `R${Math.round(v)}` : 'C'), manual: `${APX}, AMP page`, desc: 'Position in the stereo field.' },
  { key: 'amp_vol', page: 'amp', slot: 9, short: 'VOL', name: 'Volume', min: 0, max: 127, def: 100, fmt: int, manual: `${APX}, AMP page`, desc: 'Level of the sound (TRACK LEVEL sits after it).' },

  ...envPage('envf'),
  ...envPage('env2'),
  ...lfoPage(1),
  ...lfoPage(2),

  // SOUND SETTINGS ([FUNC] + [SND]): VELOCITY MOD, then the settings page
  ...[1, 2, 3, 4, 5].flatMap((n): ParamDef[] => [
    { key: `vmod_dst${n}`, page: 'vmod', slot: n - 1, short: `DS${n}`, name: `Velocity destination ${n}`, min: 0, max: MOD_DESTS.length - 1, def: 0, options: DEST_NAMES, fmt: opt(DEST_NAMES), manual: 'Manual - Sound settings, VELOCITY MOD', desc: 'A parameter the trig velocity (NOTE page VEL) modulates.', lock: false },
    { key: `vmod_dep${n}`, page: 'vmod', slot: n + 4, short: `DP${n}`, name: `Velocity depth ${n}`, min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: 'Manual - Sound settings, VELOCITY MOD', desc: 'How much velocity moves that parameter (at velocity 127).' },
  ]),
  { key: 'snd_acc', page: 'snd', slot: 0, short: 'ACC', name: 'Accent level', min: 0, max: 127, def: 64, fmt: int, manual: 'Manual p.51-52, ACCENT', desc: 'How strongly accented trigs ([FUNC] + [BANK F]) play: louder, and with a deeper filter envelope. On the hardware TRACK LEVEL sets it in the ACCENT menu.' },
  { key: 'snd_leg', page: 'snd', slot: 1, short: 'LEG', name: 'Legato mode', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: 'Manual p.35, SOUND SETTINGS', desc: 'ON: overlapping notes you play on the keyboard do not retrigger the envelopes (sequencer notes are not affected). Needed for PRT LEG.' },
  { key: 'snd_prt', page: 'snd', slot: 2, short: 'PRT', name: 'Portamento', min: 0, max: 2, def: 2, options: PORTA_MODES, fmt: opt(PORTA_MODES), manual: 'Manual p.35, SOUND SETTINGS', desc: 'Glide for the notes you play (keyboard or MIDI), never the sequencer\'s: OFF, ON (every played note, SLI time), LEG (only between overlapping played notes, with LEGATO MODE, knob B, on). Slide trigs always glide.' },
  { key: 'snd_drf', page: 'snd', slot: 3, short: 'DRF', name: 'Oscillator drift', min: 0, max: 1, def: 1, options: ONOFF, fmt: opt(ONOFF), manual: 'Manual - Sound settings', desc: 'ON: the oscillators wander slightly in pitch, like analog oscillators warming up.' },
  { key: 'snd_bst', page: 'snd', slot: 4, short: 'BST', name: 'Filter 1 resonance boost', min: 0, max: 1, def: 1, options: ONOFF, fmt: opt(ONOFF), manual: 'Manual - Sound settings', desc: 'ON keeps the bass when the ladder resonance is high (the classic ladder thins out without it).' },
  { key: 'level', page: 'mix', slot: -1, short: 'LEV', name: 'Track level', min: 0, max: 127, def: 100, fmt: int, manual: 'Manual - Front panel, TRACK LEVEL', desc: 'Overall level of the track (the TRACK LEVEL knob), after the sound\'s own VOL.' },
];

/** Keys sent to the voice worklet, in order (the worklet takes the list at construction) */
export const VOICE_KEYS: string[] = [
  ...SYNTH_PARAMS.filter(p => !p.key.startsWith('trig_') && !p.key.startsWith('arp_')).map(p => p.key),
  // modulation-only inputs (no control)
  'osc1_pmod', 'osc2_pmod',
];

// ----------------------------------------------------------------------------
// FX track
// ----------------------------------------------------------------------------

export const FX_PARAMS: ParamDef[] = [
  ...notePage('fxnote'),
  // EXT IN (the audio inputs - not available in the studio)
  ...(['l', 'r'] as const).flatMap((s, si): ParamDef[] => {
    const S = s.toUpperCase();
    const base = si * 5;
    const M = `${APB}, EXT IN page`;
    return [
      { key: `ext${s}_cho`, page: 'extin', slot: base, short: 'CHO', name: `Input ${S} chorus send`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Sends the audio input to the chorus.' },
      { key: `ext${s}_del`, page: 'extin', slot: base + 1, short: 'DEL', name: `Input ${S} delay send`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Sends the audio input to the delay.' },
      { key: `ext${s}_rev`, page: 'extin', slot: base + 2, short: 'REV', name: `Input ${S} reverb send`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Sends the audio input to the reverb.' },
      { key: `ext${s}_pan`, page: 'extin', slot: base + 3, short: 'PAN', name: `Input ${S} pan`, min: -64, max: 63, def: si ? 63 : -64, bipolar: true, fmt: signed, manual: M, desc: 'Position of the input in the stereo field.' },
      { key: `ext${s}_lev`, page: 'extin', slot: base + 4, short: 'VOL', name: `Input ${S} level`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Level of the input mixed into the main outputs.' },
    ];
  }),
  // CHORUS
  { key: 'cho_pre', page: 'chorus', slot: 0, short: 'PRE', name: 'Chorus pre-delay', min: 0, max: 127, def: 30, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Base delay of the chorus voices: short = flanger-like, long = wide doubling.' },
  { key: 'cho_spd', page: 'chorus', slot: 1, short: 'SPD', name: 'Chorus speed', min: 0, max: 127, def: 40, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Speed of the delay-time modulation.' },
  { key: 'cho_dep', page: 'chorus', slot: 2, short: 'DEP', name: 'Chorus depth', min: 0, max: 127, def: 64, fmt: int, manual: `${APB}, CHORUS page`, desc: 'How far the delay time is swept: the amount of shimmer.' },
  { key: 'cho_wid', page: 'chorus', slot: 3, short: 'WID', name: 'Chorus width', min: 0, max: 127, def: 127, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Stereo spread of the chorus voices.' },
  { key: 'cho_fb', page: 'chorus', slot: 4, short: 'FDB', name: 'Chorus feedback', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Feeds the chorus back into itself: metallic, flanged colours.' },
  { key: 'cho_hpf', page: 'chorus', slot: 5, short: 'HPF', name: 'Chorus high-pass', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, CHORUS page`, desc: 'High-pass on the chorus signal: keeps the bass in the middle.' },
  { key: 'cho_lpf', page: 'chorus', slot: 6, short: 'LPF', name: 'Chorus low-pass', min: 0, max: 127, def: 127, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Low-pass on the chorus signal.' },
  { key: 'cho_del', page: 'chorus', slot: 7, short: 'DEL', name: 'Chorus to delay', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Sends the chorus on into the delay.' },
  { key: 'cho_rev', page: 'chorus', slot: 8, short: 'REV', name: 'Chorus to reverb', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Sends the chorus on into the reverb.' },
  { key: 'cho_vol', page: 'chorus', slot: 9, short: 'VOL', name: 'Chorus volume', min: 0, max: 127, def: 100, fmt: int, manual: `${APB}, CHORUS page`, desc: 'Level of the chorus return in the mix.' },
  // DELAY
  { key: 'del_tim', page: 'delay', slot: 0, short: 'TIM', name: 'Delay time', min: 1, max: 128, def: 24, fmt: delayTimeFmt, manual: `${APB}, DELAY page`, desc: 'Delay time in 1/128 notes, locked to the tempo: 16 = 1/8, 24 = dotted 1/8, 32 = 1/4.' },
  { key: 'del_x', page: 'delay', slot: 1, short: 'X', name: 'Ping pong', min: 0, max: 1, def: 0, options: ONOFF, fmt: opt(ONOFF), manual: `${APB}, DELAY page`, desc: 'ON: the echoes bounce between left and right.' },
  { key: 'del_wid', page: 'delay', slot: 3, short: 'WID', name: 'Delay stereo width', min: -64, max: 63, def: 63, bipolar: true, fmt: signed, manual: `${APB}, DELAY page`, desc: 'Stereo spread of the echoes (negative swaps the sides).' },
  { key: 'del_fb', page: 'delay', slot: 4, short: 'FDB', name: 'Delay feedback', min: 0, max: 127, def: 50, fmt: int, manual: `${APB}, DELAY page`, desc: 'How much of each echo is fed back: the number of repeats. Above 100 it builds up (with saturation).' },
  { key: 'del_hpf', page: 'delay', slot: 5, short: 'HPF', name: 'Delay high-pass', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, DELAY page`, desc: 'High-pass in the feedback loop: echoes get thinner.' },
  { key: 'del_lpf', page: 'delay', slot: 6, short: 'LPF', name: 'Delay low-pass', min: 0, max: 127, def: 110, fmt: int, manual: `${APB}, DELAY page`, desc: 'Low-pass in the feedback loop: each echo gets darker, like tape.' },
  { key: 'del_ovr', page: 'delay', slot: 7, short: 'OVR', name: 'Delay overdrive', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, DELAY page`, desc: 'Saturation inside the delay loop.' },
  { key: 'del_rev', page: 'delay', slot: 8, short: 'REV', name: 'Delay to reverb', min: 0, max: 127, def: 0, fmt: int, manual: `${APB}, DELAY page`, desc: 'Sends the echoes on into the reverb.' },
  { key: 'del_vol', page: 'delay', slot: 9, short: 'VOL', name: 'Delay volume', min: 0, max: 127, def: 100, fmt: int, manual: `${APB}, DELAY page`, desc: 'Level of the delay return.' },
  // REVERB
  { key: 'rev_pre', page: 'reverb', slot: 0, short: 'PRE', name: 'Reverb pre-delay', min: 0, max: 127, def: 8, fmt: int, manual: `${APB}, REVERB page`, desc: 'Gap before the reverb starts: keeps the dry attack clear.' },
  { key: 'rev_dec', page: 'reverb', slot: 1, short: 'DEC', name: 'Reverb decay time', min: 0, max: 127, def: 64, fmt: v => (v >= 127 ? 'INF' : int(v)), manual: `${APB}, REVERB page`, desc: 'Length of the reverb tail (127 = endless).' },
  { key: 'rev_frq', page: 'reverb', slot: 2, short: 'FRQ', name: 'Shelving frequency', min: 0, max: 127, def: 80, fmt: int, manual: `${APB}, REVERB page`, desc: 'Frequency above which the shelving filter (GAI) works on the tail.' },
  { key: 'rev_gai', page: 'reverb', slot: 3, short: 'GAI', name: 'Shelving gain', min: 0, max: 127, def: 96, fmt: int, manual: `${APB}, REVERB page`, desc: 'Gain of the shelving filter on the tail above FRQ: 127 leaves it bright, lower values damp the highs as the tail decays (a softer room).' },
  { key: 'rev_hpf', page: 'reverb', slot: 5, short: 'HPF', name: 'Reverb high-pass', min: 0, max: 127, def: 16, fmt: int, manual: `${APB}, REVERB page`, desc: 'High-pass on the reverb input: less mud.' },
  { key: 'rev_lpf', page: 'reverb', slot: 6, short: 'LPF', name: 'Reverb low-pass', min: 0, max: 127, def: 110, fmt: int, manual: `${APB}, REVERB page`, desc: 'Low-pass on the reverb input.' },
  { key: 'rev_vol', page: 'reverb', slot: 9, short: 'VOL', name: 'Reverb volume', min: 0, max: 127, def: 100, fmt: int, manual: `${APB}, REVERB page`, desc: 'Level of the reverb return.' },
  // FX LFOs
  ...([1, 2] as const).flatMap((n): ParamDef[] => {
    const page: PageId = n === 1 ? 'fxlfo1' : 'fxlfo2';
    const l = `fxlfo${n}_`;
    const M = `${APB}, FX LFO ${n} page`;
    return [
      { key: `${l}spd`, page, slot: 0, short: 'SPD', name: 'FX LFO speed', min: -64, max: 63, def: 16, bipolar: true, fmt: signed, manual: M, desc: 'Speed, synced to the tempo (SPD x MUL = 128: one cycle per bar).' },
      { key: `${l}mul`, page, slot: 1, short: 'MUL', name: 'FX LFO multiplier', min: 0, max: LFO_MULTS.length - 1, def: 2, options: LFO_MULTS, fmt: opt(LFO_MULTS), manual: M, desc: 'Multiplies SPD.' },
      { key: `${l}fad`, page, slot: 2, short: 'FAD', name: 'FX LFO fade', min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Fade in (negative) or out (positive) after each FX track trig.' },
      { key: `${l}sph`, page, slot: 3, short: 'SPH', name: 'FX LFO start phase', min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Phase a trig restarts the LFO at.' },
      { key: `${l}mod`, page, slot: 4, short: 'MOD', name: 'FX LFO trig mode', min: 0, max: 4, def: 0, options: LFO_MODES, fmt: opt(LFO_MODES), manual: M, desc: 'How FX track trigs restart the LFO.' },
      { key: `${l}wav`, page, slot: 5, short: 'WAV', name: 'FX LFO waveform', min: 0, max: 6, def: 1, options: LFO_WAVES, fmt: opt(LFO_WAVES), manual: M, desc: 'LFO shape.' },
      { key: `${l}dsta`, page, slot: 6, short: 'DST', name: 'Destination A', min: 0, max: FX_DESTS.length - 1, def: 0, options: FX_DEST_NAMES, fmt: opt(FX_DEST_NAMES), manual: M, desc: 'First FX parameter it modulates.', lock: false },
      { key: `${l}depa`, page, slot: 7, short: 'DEP', name: 'Depth A', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination A.' },
      { key: `${l}dstb`, page, slot: 8, short: 'DST', name: 'Destination B', min: 0, max: FX_DESTS.length - 1, def: 0, options: FX_DEST_NAMES, fmt: opt(FX_DEST_NAMES), manual: M, desc: 'Second FX parameter it modulates.', lock: false },
      { key: `${l}depb`, page, slot: 9, short: 'DEP', name: 'Depth B', min: -128, max: 127, def: 0, bipolar: true, fmt: depthFmt, manual: M, desc: 'Amount for destination B.' },
    ];
  }),
  { key: 'level', page: 'mix', slot: -1, short: 'LEV', name: 'FX track level', min: 0, max: 127, def: 100, fmt: int, manual: 'Manual - Front panel, TRACK LEVEL', desc: 'Level of every effect return together.' },
];

export function delayTimeFmt(v: number): string {
  const r = Math.round(v);
  const names: Record<number, string> = { 1: '1/128', 2: '1/64', 3: '1/64.', 4: '1/32', 6: '1/32.', 8: '1/16', 12: '1/16.', 16: '1/8', 24: '1/8.', 32: '1/4', 48: '1/4.', 64: '1/2', 96: '1/2.', 128: '1' };
  return names[r] ?? String(r);
}

/** Keys sent to the FX worklet, in order */
export const FX_KEYS: string[] = FX_PARAMS.filter(p => !p.key.startsWith('trig_')).map(p => p.key);

// ----------------------------------------------------------------------------
// CV track (sequenced and shown; the CV outputs are on the rear panel and
// have no jacks in this twin)
// ----------------------------------------------------------------------------

export const CV_PARAMS: ParamDef[] = [
  ...notePage('cvnote'),
  ...(['a', 'b', 'c', 'd'] as const).flatMap((c): ParamDef[] => {
    const page = `cv${c}` as PageId;
    const M = `${APC}, CV ${c.toUpperCase()} page`;
    return [
      { key: `cv${c}_tun`, page, slot: 0, short: 'TUN', name: `CV ${c.toUpperCase()} coarse tune`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Transposes the CV output in semitones (1 V per octave).' },
      { key: `cv${c}_fin`, page, slot: 1, short: 'FIN', name: `CV ${c.toUpperCase()} fine tune`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Fine tune of the CV output.' },
      { key: `cv${c}_val`, page, slot: 2, short: 'VAL', name: `CV ${c.toUpperCase()} value`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'A fixed voltage (for CV outputs configured as values).' },
      { key: `cv${c}_clk`, page, slot: 3, short: 'CLK', name: `CV ${c.toUpperCase()} clock`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Clock rate for a CV output set up as a clock (CV CONFIG).' },
      { key: `cv${c}_src`, page, slot: 4, short: 'SRC', name: `CV ${c.toUpperCase()} source track`, min: 0, max: 5, def: 5, options: CV_SOURCES, fmt: opt(CV_SOURCES), manual: M, desc: 'Track whose notes this output follows.' },
      { key: `cv${c}_bnd`, page, slot: 5, short: 'BND', name: `CV ${c.toUpperCase()} bend depth`, min: -64, max: 63, def: 0, bipolar: true, fmt: signed, manual: M, desc: 'Pitch bend range of the output.' },
      { key: `cv${c}_sli`, page, slot: 6, short: 'SLI', name: `CV ${c.toUpperCase()} slide time`, min: 0, max: 127, def: 0, fmt: int, manual: M, desc: 'Glide time of the output on slide trigs.' },
    ];
  }),
];

// ----------------------------------------------------------------------------
// Ids and lookups
// ----------------------------------------------------------------------------

export const tid = (track: number, key: string) => `t${track + 1}_${key}`;
export const fxid = (key: string) => `fx_${key}`;
export const cvid = (key: string) => `cv_${key}`;

export const SYNTH_BY_KEY: Record<string, ParamDef> = Object.fromEntries(SYNTH_PARAMS.map(p => [p.key, p]));
export const FX_BY_KEY: Record<string, ParamDef> = Object.fromEntries(FX_PARAMS.map(p => [p.key, p]));
export const CV_BY_KEY: Record<string, ParamDef> = Object.fromEntries(CV_PARAMS.map(p => [p.key, p]));

/** The control id for a parameter of a track */
export function controlFor(track: number, p: ParamDef): string {
  if (p.key.startsWith('trig_')) return tid(track, p.key);
  const k = trackKind(track);
  if (k === 'fx') return p.key === 'level' ? fxid('level') : fxid(p.key);
  if (k === 'cv') return cvid(p.key);
  return tid(track, p.key);
}

/** Parameter definitions of a page, by slot */
export function pageSlots(page: PageId): (ParamDef | null)[] {
  const slots: (ParamDef | null)[] = Array(10).fill(null);
  const list = page === 'fxnote' || FX_PAGES.has(page) ? FX_PARAMS : page === 'cvnote' || CV_PAGES.has(page) ? CV_PARAMS : SYNTH_PARAMS;
  for (const p of list) if (p.page === page && p.slot >= 0) slots[p.slot] = p;
  return slots;
}

const FX_PAGES = new Set<PageId>(['extin', 'chorus', 'delay', 'reverb', 'fxlfo1', 'fxlfo2']);
const CV_PAGES = new Set<PageId>(['cva', 'cvb', 'cvc', 'cvd', 'cvenv', 'cvlfo']);

/** Performance macros A..J: [name, targets as (param key, offset at 127)] applied to every synth track */
export const PERF_MACROS: { name: string; synth: [string, number][]; fx?: [string, number][] }[] = [
  { name: 'LP SWEEP', synth: [['flt1_frq', -90]] },
  { name: 'HP SWEEP', synth: [['flt2_frq', 80]] },
  { name: 'RESONANCE', synth: [['flt1_res', 90]] },
  { name: 'DRIVE', synth: [['flt1_ovr', 55]] },
  { name: 'ENV DEPTH', synth: [['flt1_dep', 48]] },
  { name: 'DECAY', synth: [['amp_dec', 48], ['envf_dec', 48]] },
  { name: 'CHORUS', synth: [['amp_cho', 110]] },
  { name: 'DELAY', synth: [['amp_del', 100]], fx: [['del_fb', 40]] },
  { name: 'REVERB', synth: [['amp_rev', 110]] },
  { name: 'SPACE', synth: [], fx: [['rev_dec', 60], ['del_fb', 60], ['rev_vol', 20]] },
];

/**
 * Where a control lives: the track to select (null = any) and the view whose
 * encoders show it (-1 = no page, e.g. TRACK LEVEL). Lessons use it to light
 * the way: track key first, then the page key, then the encoder.
 */
export function routeOf(id: string): { track: number | null; view: number } | null {
  if (id === 'tempo' || id === 'swing') return { track: null, view: V.TEMPO };
  if (/^perf_[a-j]$/.test(id)) return { track: null, view: V.PERF };
  let track: number;
  let key: string;
  let m = /^t([1-6])_(.+)$/.exec(id);
  if (m) { track = Number(m[1]) - 1; key = m[2]; }
  else if ((m = /^fx_(.+)$/.exec(id))) { track = FX_TRACK; key = m[1]; }
  else if ((m = /^cv_(.+)$/.exec(id))) { track = CV_TRACK; key = m[1]; }
  else return null;
  if (key === 'mute') return null;
  if (key === 'level') return { track, view: -1 };
  const kind = trackKind(track);
  const p = (kind === 'synth' ? SYNTH_BY_KEY : kind === 'fx' ? FX_BY_KEY : CV_BY_KEY)[key];
  if (!p) return null;
  for (let v = 0; v < VIEWS.length; v++) if (pageFor(track, v) === p.page) return { track, view: v };
  return { track, view: -1 };
}

/** Encoder slot -> control for the active track and view */
export function encoderControl(track: number, view: number, slot: number, perfMuted = false, held = false): string | null {
  const page = pageFor(track, view);
  if (!page) return null;
  void perfMuted;
  // NOTE page: knob E is TRC (the trig condition) while a trig is held, PRB otherwise
  if (held && slot === 4 && (page === 'note' || page === 'fxnote' || page === 'cvnote')) return tid(track, 'trig_cond');
  if (page === 'tempo') return slot === 0 ? 'tempo' : slot === 1 ? 'swing' : null;
  if (page === 'perf') return `perf_${'abcdefghij'[slot]}`;
  // the PERFORMANCE MIXER: the track levels on knobs A-E (manual p.28)
  if (page === 'mix') {
    if (slot < SYNTH_TRACKS) return tid(slot, 'level');
    if (slot === 4) return fxid('level');
    return null;
  }
  const p = pageSlots(page)[slot];
  return p ? controlFor(track, p) : null;
}

/** The TRACK LEVEL knob's control for a track */
export const levelControl = (track: number) => (track < SYNTH_TRACKS ? tid(track, 'level') : track === FX_TRACK ? fxid('level') : null);
