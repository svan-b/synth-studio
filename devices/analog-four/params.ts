// ============================================================================
// Elektron Analog Four MKII - parameter registry
//
// One table drives the spec (a control per track per parameter), the encoder
// bindings, the OLED screen, the parameter-lock codec and the engine.
//
// Names follow the A4 MKII screen abbreviations (TUN FIN DET TRK LEV / WAV SUB
// PW SPD PWM, FRQ RES OVR TRK DEP / FRQ RES TYP TRK DEP, ATK DEC SUS REL SHP /
// CHO DEL REV PAN VOL, SPD MUL FAD SPH MOD / WAV DST DEP DST DEP) as listed in
// the user manual's Appendix A "Synth track parameters" (p.82-87, 108-page
// English OS 1.4x edition) and Appendix B "FX track parameters" (p.88+).
//
// Honest simplifications of the real menu system (also listed in the tips):
//  - Values use the A4's 0-127 / -64..+63 encoder ranges, but the mapping to
//    Hz / seconds is our own approximation of the hardware curves.
//  - The OSC 1&2 common page (AM, SYNC, BEND, SLIDE), ENV 2, the NOISE S&H
//    page, the 12 envelope shapes (reduced to EXP / LIN), the FX track EXT IN
//    and FX LFO pages, the CV track, trig conditions, swing, song/chain mode,
//    performance and sound pools are not modelled.
//  - Delay X (ping-pong) and WID, chorus WID simplified (see engine).
// ============================================================================

import type { Units } from '@/types';
import { noteName } from '@/lib/audio/dsp';

export const NUM_TRACKS = 4;
export const STEPS = 16;

/** Value of the `page` UI switch. The order is fixed: lessons store indices. */
export const PAGES = ['TRIG', 'OSC 1', 'OSC 2', 'NOISE', 'FILTERS', 'ENV', 'AMP', 'LFO 1', 'LFO 2', 'TEMPO'] as const;
export const PAGE = {
  TRIG: 0, OSC1: 1, OSC2: 2, NOISE: 3, FILTERS: 4, ENV: 5, AMP: 6, LFO1: 7, LFO2: 8, TEMPO: 9,
} as const;

/** Value of the `track` UI switch */
export const TRACKS = ['TRK 1', 'TRK 2', 'TRK 3', 'TRK 4', 'FX', 'CV'] as const;
export const FX_TRACK = 4;
export const CV_TRACK = 5;

/**
 * The six PARAMETER keys. Pressing a lit key again opens its secondary page
 * (the manual: "double pressing a [PARAMETER] key will in certain cases open a
 * secondary PARAMETER page"). `fx` is the grey FX-track legend.
 */
export const PARAM_KEYS: { label: string; page: number; sub?: number; fx: string }[] = [
  { label: 'TRIG', page: PAGE.TRIG, fx: '' },
  { label: 'OSC 1', page: PAGE.OSC1, sub: PAGE.NOISE, fx: 'EXT IN' },
  { label: 'OSC 2', page: PAGE.OSC2, fx: 'CHORUS' },
  { label: 'FILTER', page: PAGE.FILTERS, sub: PAGE.ENV, fx: 'DELAY' },
  { label: 'AMP', page: PAGE.AMP, fx: 'REVERB' },
  { label: 'LFO', page: PAGE.LFO1, sub: PAGE.LFO2, fx: 'LFO' },
];

export type FxPage = 'chorus' | 'delay' | 'reverb' | 'extin' | 'fxlfo' | 'fxtrig';

/** Which FX-track page a `page` value shows (FX legends on the same keys) */
export function fxPageFor(page: number): FxPage {
  switch (page) {
    case PAGE.OSC1: case PAGE.NOISE: return 'extin';
    case PAGE.OSC2: return 'chorus';
    case PAGE.FILTERS: case PAGE.ENV: return 'delay';
    case PAGE.AMP: return 'reverb';
    case PAGE.LFO1: case PAGE.LFO2: return 'fxlfo';
    default: return 'fxtrig';
  }
}

export const FX_PAGE_NAMES: Record<FxPage, string> = {
  chorus: 'CHORUS', delay: 'DELAY', reverb: 'REVERB', extin: 'EXT IN', fxlfo: 'FX LFO', fxtrig: 'FX TRIG',
};

// ----------------------------------------------------------------------------
// Option lists
// ----------------------------------------------------------------------------

export const WAVES = ['SAW', 'TPUL', 'PULS', 'TRI'];               // saw, transistor pulse, pulse, triangle
export const SUBS = ['OFF', '1OCT', '2OCT', '2PUL', '5TH'];
export const ONOFF = ['OFF', 'ON'];
export const F2_TYPES = ['LP2', 'LP1', 'BP', 'HP1', 'HP2', 'BS', 'PK'];
export const SHAPES = ['EXP', 'LIN'];
export const LFO_MULTS = ['1', '2', '4', '8', '16', '32', '64', '128', '256', '512', '1K', '2K'];
export const LFO_MODES = ['FRE', 'TRG', 'HLD', 'ONE', 'HLF'];
export const LFO_WAVES = ['TRI', 'SIN', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'];
/** LFO destinations, named "page parameter" like the A4 destination list */
export const LFO_DESTS = ['--', 'O1 TUN', 'O2 TUN', 'O1 PW', 'O2 PW', 'O1 LEV', 'O2 LEV', 'NOI LEV', 'F1 FRQ', 'F1 RES', 'F2 FRQ', 'F2 RES', 'AMP VOL', 'AMP PAN'];

// ----------------------------------------------------------------------------
// Parameter definitions
// ----------------------------------------------------------------------------

export interface ParamDef {
  key: string;          // control id suffix: t1_<key>
  page: number;         // PAGE.*
  slot: number;         // encoder 0..9 = A..J
  short: string;        // OLED abbreviation
  name: string;         // full manual name
  min: number;
  max: number;
  def: number;
  step?: number;
  options?: string[];
  bipolar?: boolean;
  units?: Units;
  fmt?: (v: number) => string;
  manual: string;
  desc: string;
  /** false = cannot be parameter-locked here */
  lock?: boolean;
}

const APX = 'Manual Appendix A - Synth track parameters';
const R = (page: string, p: string) => `${APX}, ${page} page (p.${p})`;

const int = (v: number) => String(Math.round(v));
const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : String(Math.round(v)));
const opt = (list: string[]) => (v: number) => list[Math.round(v)] ?? String(v);

function oscPage(n: 1 | 2, page: number): ParamDef[] {
  const o = `osc${n}`;
  const P = `OSC ${n}`;
  return [
    { key: `${o}_tune`, page, slot: 0, short: 'TUN', name: `OSC${n} Coarse Tune`, min: -24, max: 24, def: n === 2 ? 0 : 0, step: 1, bipolar: true, units: 'semitones', fmt: signed, manual: R(P, '82-83'), desc: `Coarse pitch of oscillator ${n} in semitones.` },
    { key: `${o}_fine`, page, slot: 1, short: 'FIN', name: `OSC${n} Fine Tune`, min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R(P, '82-83'), desc: 'Fine pitch: the full range spans one semitone either way.' },
    { key: `${o}_detune`, page, slot: 2, short: 'DET', name: `OSC${n} Detune`, min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R(P, '82-83'), desc: 'Linear detune - offsets the oscillator by a fixed number of Hz, so the beating rate is the same on every note.' },
    { key: `${o}_track`, page, slot: 3, short: 'TRK', name: `OSC${n} Keytrack`, min: 0, max: 1, def: 1, step: 1, options: ONOFF, fmt: opt(ONOFF), manual: R(P, '82-83'), desc: 'ON: pitch follows the played/sequenced note. OFF: fixed pitch (drums, effects).' },
    { key: `${o}_level`, page, slot: 4, short: 'LEV', name: `OSC${n} Level`, min: 0, max: 127, def: n === 1 ? 100 : 0, step: 1, fmt: int, manual: R(P, '82-83'), desc: 'Level of the oscillator (and its sub oscillator) into the filters. Normal level is 100.' },
    { key: `${o}_wave`, page, slot: 5, short: 'WAV', name: `OSC${n} Waveform`, min: 0, max: 3, def: 0, step: 1, options: WAVES, fmt: opt(WAVES), manual: R(P, '82-83'), desc: 'SAW (all harmonics), TPUL transistor pulse (bright acid pulse with a sloped top), PULS pulse/square (odd harmonics), TRI triangle (soft, few harmonics).' },
    { key: `${o}_sub`, page, slot: 6, short: 'SUB', name: `OSC${n} Sub Oscillator`, min: 0, max: 4, def: 0, step: 1, options: SUBS, fmt: opt(SUBS), manual: R(P, '82-83'), desc: '1OCT square one octave down, 2OCT square two octaves down, 2PUL 25% pulse two octaves down, 5TH 33% pulse a fifth below.' },
    { key: `${o}_pw`, page, slot: 7, short: 'PW', name: `OSC${n} Pulse Width`, min: 0, max: 127, def: 64, step: 1, fmt: int, manual: R(P, '82-83'), desc: 'Pulse width of the pulse waves: 64 = 50% square, towards 0 / 127 = thin pulse.' },
    { key: `${o}_pwm_speed`, page, slot: 8, short: 'SPD', name: `OSC${n} PWM Speed`, min: 0, max: 127, def: 40, step: 1, fmt: int, manual: R(P, '82-83'), desc: 'Speed of the oscillator\'s dedicated PWM LFO.' },
    { key: `${o}_pwm`, page, slot: 9, short: 'PWM', name: `OSC${n} PWM Depth`, min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R(P, '82-83'), desc: 'How far the PWM LFO sweeps the pulse width - classic chorus-like thickening.' },
  ];
}

function lfoPage(n: 1 | 2, page: number): ParamDef[] {
  const l = `lfo${n}`;
  const P = `LFO ${n}`;
  return [
    { key: `${l}_speed`, page, slot: 0, short: 'SPD', name: `LFO${n} Speed`, min: -64, max: 63, def: n === 1 ? 32 : 16, step: 1, bipolar: true, fmt: signed, manual: R(P, '87'), desc: 'Speed, synced to tempo. SPD x MUL = 128 is one cycle per bar here; negative values run the shape backwards.' },
    { key: `${l}_mult`, page, slot: 1, short: 'MUL', name: `LFO${n} Multiplier`, min: 0, max: LFO_MULTS.length - 1, def: 2, step: 1, options: LFO_MULTS, fmt: opt(LFO_MULTS), manual: R(P, '87'), desc: 'Multiplies SPD.' },
    { key: `${l}_fade`, page, slot: 2, short: 'FAD', name: `LFO${n} Fade In/Out`, min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R(P, '87'), desc: 'Negative = modulation fades in after each trig, positive = fades out, 0 = no fade.' },
    { key: `${l}_phase`, page, slot: 3, short: 'SPH', name: `LFO${n} Start Phase`, min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R(P, '87'), desc: 'Where in the waveform the LFO starts when it is trigged (TRG / ONE / HLF modes).' },
    { key: `${l}_mode`, page, slot: 4, short: 'MOD', name: `LFO${n} Trig Mode`, min: 0, max: LFO_MODES.length - 1, def: 0, step: 1, options: LFO_MODES, fmt: opt(LFO_MODES), manual: R(P, '87'), desc: 'FRE free running, TRG restarts on each note, HLD samples and holds on each note, ONE plays one cycle, HLF plays half a cycle.' },
    { key: `${l}_wave`, page, slot: 5, short: 'WAV', name: `LFO${n} Waveform`, min: 0, max: LFO_WAVES.length - 1, def: 0, step: 1, options: LFO_WAVES, fmt: opt(LFO_WAVES), manual: R(P, '87'), desc: 'TRI, SIN, SQR, SAW, EXP, RMP or RND (random steps).' },
    { key: `${l}_dest_a`, page, slot: 6, short: 'DST', name: `LFO${n} Destination A`, min: 0, max: LFO_DESTS.length - 1, def: 0, step: 1, options: LFO_DESTS, fmt: opt(LFO_DESTS), manual: R(P, '87'), desc: 'First modulation destination.', lock: false },
    { key: `${l}_depth_a`, page, slot: 7, short: 'DEP', name: `LFO${n} Depth A`, min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R(P, '87'), desc: 'Modulation amount for destination A (negative inverts the wave).' },
    { key: `${l}_dest_b`, page, slot: 8, short: 'DST', name: `LFO${n} Destination B`, min: 0, max: LFO_DESTS.length - 1, def: 0, step: 1, options: LFO_DESTS, fmt: opt(LFO_DESTS), manual: R(P, '87'), desc: 'Second modulation destination.', lock: false },
    { key: `${l}_depth_b`, page, slot: 9, short: 'DEP', name: `LFO${n} Depth B`, min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R(P, '87'), desc: 'Modulation amount for destination B.' },
  ];
}

/** Every per-track synth parameter */
export const SYNTH_PARAMS: ParamDef[] = [
  // TRIG page - the defaults for new trigs; per-step values are locks
  { key: 'trig_note', page: PAGE.TRIG, slot: 0, short: 'NOTE', name: 'Trig Note', min: 24, max: 96, def: 48, step: 1, fmt: v => noteName(Math.round(v)), manual: 'Manual - Sequencer, TRIG parameters page', desc: 'Note played by trigs. Hold a trig key and turn this to give that step its own note.' },
  { key: 'trig_vel', page: PAGE.TRIG, slot: 1, short: 'VEL', name: 'Trig Velocity', min: 1, max: 127, def: 100, step: 1, fmt: int, manual: 'Manual - Sequencer, TRIG parameters page', desc: 'Velocity of trigs - scales the amp envelope peak.' },
  { key: 'trig_len', page: PAGE.TRIG, slot: 2, short: 'LEN', name: 'Trig Length', min: 0.25, max: 16, def: 1, step: 0.25, fmt: v => (v % 1 === 0 ? `${v}` : v.toFixed(2)), manual: 'Manual - Sequencer, TRIG parameters page', desc: 'Note length in steps (sixteenth notes). The gate stays open this long, so SUS and REL matter.' },

  ...oscPage(1, PAGE.OSC1),
  ...oscPage(2, PAGE.OSC2),

  // NOISE sub-page of OSC 1
  { key: 'noise_fade', page: PAGE.NOISE, slot: 3, short: 'FAD', name: 'Noise Fade', min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R('NOISE', '82-83'), desc: 'Dedicated noise fade envelope: positive fades the noise out after each trig (a breathy attack), negative fades it in.' },
  { key: 'noise_level', page: PAGE.NOISE, slot: 4, short: 'LEV', name: 'Noise Level', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('NOISE', '82-83'), desc: 'Level of the white noise generator into the filters.' },

  // FILTERS page: Filter 1 = 4-pole ladder low-pass, Filter 2 = 2-pole multimode
  { key: 'flt1_freq', page: PAGE.FILTERS, slot: 0, short: 'FRQ', name: 'Filter1 Frequency', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Cutoff of the 4-pole (24 dB/oct) transistor ladder low-pass. 0 ≈ 20 Hz, 64 ≈ 640 Hz, 127 ≈ 20 kHz.' },
  { key: 'flt1_res', page: PAGE.FILTERS, slot: 1, short: 'RES', name: 'Filter1 Resonance', min: 0, max: 127, def: 16, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Feedback around the ladder: boosts the cutoff frequency, self-oscillates near the top.' },
  { key: 'flt1_overdrive', page: PAGE.FILTERS, slot: 2, short: 'OVR', name: 'Filter Overdrive', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Drives the filter input into saturation - adds harmonics and grit.' },
  { key: 'flt1_track', page: PAGE.FILTERS, slot: 3, short: 'TRK', name: 'Filter1 Keytracking', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'How much the cutoff follows the note (127 = one octave per octave).' },
  { key: 'flt1_depth', page: PAGE.FILTERS, slot: 4, short: 'DEP', name: 'Filter1 Env Depth', min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R('FILTERS', '84-85'), desc: 'How far ENV F sweeps filter 1 (up to ±6 octaves).' },
  { key: 'flt2_freq', page: PAGE.FILTERS, slot: 5, short: 'FRQ', name: 'Filter2 Frequency', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Cutoff of the 2-pole multimode filter (same 0-127 scale as filter 1).' },
  { key: 'flt2_res', page: PAGE.FILTERS, slot: 6, short: 'RES', name: 'Filter2 Resonance', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Resonance of filter 2 (in PK mode: the boost amount).' },
  { key: 'flt2_type', page: PAGE.FILTERS, slot: 7, short: 'TYP', name: 'Filter2 Type', min: 0, max: F2_TYPES.length - 1, def: 4, step: 1, options: F2_TYPES, fmt: opt(F2_TYPES), manual: R('FILTERS', '84-85'), desc: 'LP2 12 dB low-pass, LP1 6 dB low-pass, BP band-pass, HP1 6 dB high-pass, HP2 12 dB high-pass, BS band-stop, PK peak.' },
  { key: 'flt2_track', page: PAGE.FILTERS, slot: 8, short: 'TRK', name: 'Filter2 Keytracking', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('FILTERS', '84-85'), desc: 'Keytracking for filter 2.' },
  { key: 'flt2_depth', page: PAGE.FILTERS, slot: 9, short: 'DEP', name: 'Filter2 Env Depth', min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R('FILTERS', '84-85'), desc: 'How far ENV F sweeps filter 2.' },

  // ENV sub-page of FILTER: ENV F (the filter envelope)
  { key: 'envf_attack', page: PAGE.ENV, slot: 0, short: 'ATK', name: 'EnvF Attack', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('ENV', '86'), desc: 'Attack time of the filter envelope.' },
  { key: 'envf_decay', page: PAGE.ENV, slot: 1, short: 'DEC', name: 'EnvF Decay', min: 0, max: 127, def: 50, step: 1, fmt: int, manual: R('ENV', '86'), desc: 'Decay time of the filter envelope.' },
  { key: 'envf_sustain', page: PAGE.ENV, slot: 2, short: 'SUS', name: 'EnvF Sustain', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('ENV', '86'), desc: 'Level the filter envelope holds while the note is held.' },
  { key: 'envf_release', page: PAGE.ENV, slot: 3, short: 'REL', name: 'EnvF Release', min: 0, max: 127, def: 40, step: 1, fmt: int, manual: R('ENV', '86'), desc: 'Release time of the filter envelope.' },

  // AMP page: EnvA + sends + pan + volume
  { key: 'amp_attack', page: PAGE.AMP, slot: 0, short: 'ATK', name: 'EnvA Attack', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Attack time of the amplitude envelope (0 ≈ 1 ms, 64 ≈ 0.13 s, 127 ≈ 16 s).' },
  { key: 'amp_decay', page: PAGE.AMP, slot: 1, short: 'DEC', name: 'EnvA Decay', min: 0, max: 127, def: 56, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Decay time of the amplitude envelope.' },
  { key: 'amp_sustain', page: PAGE.AMP, slot: 2, short: 'SUS', name: 'EnvA Sustain', min: 0, max: 127, def: 64, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Level held while the gate is open (trig LEN).' },
  { key: 'amp_release', page: PAGE.AMP, slot: 3, short: 'REL', name: 'EnvA Release', min: 0, max: 127, def: 40, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Fade after the gate closes.' },
  { key: 'amp_shape', page: PAGE.AMP, slot: 4, short: 'SHP', name: 'EnvA Shape', min: 0, max: 1, def: 0, step: 1, options: SHAPES, fmt: opt(SHAPES), manual: R('AMP', '84-85'), desc: 'Envelope curve. The A4 has 12 shapes; here EXP (exponential, snappy) or LIN (linear).' },
  { key: 'amp_chorus', page: PAGE.AMP, slot: 5, short: 'CHO', name: 'Chorus Send', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Send to the FX track chorus.' },
  { key: 'amp_delay', page: PAGE.AMP, slot: 6, short: 'DEL', name: 'Delay Send', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Send to the FX track delay.' },
  { key: 'amp_reverb', page: PAGE.AMP, slot: 7, short: 'REV', name: 'Reverb Send', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Send to the FX track reverb.' },
  { key: 'amp_pan', page: PAGE.AMP, slot: 8, short: 'PAN', name: 'Panning', min: -64, max: 63, def: 0, step: 1, bipolar: true, fmt: signed, manual: R('AMP', '84-85'), desc: 'Stereo position.' },
  { key: 'amp_volume', page: PAGE.AMP, slot: 9, short: 'VOL', name: 'Volume', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: R('AMP', '84-85'), desc: 'Track volume.' },

  ...lfoPage(1, PAGE.LFO1),
  ...lfoPage(2, PAGE.LFO2),
];

const APB = 'Manual Appendix B - FX track parameters';
const B = (page: string) => `${APB}, ${page} page (p.88-92)`;

/** FX track (global) parameters: control id = fx_<key> */
export const FX_PARAMS: (ParamDef & { fxPage: FxPage })[] = [
  { fxPage: 'chorus', key: 'cho_pre', page: -1, slot: 0, short: 'PRE', name: 'Chorus Predelay', min: 0, max: 127, def: 20, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Base delay of the Wideshift chorus.' },
  { fxPage: 'chorus', key: 'cho_speed', page: -1, slot: 1, short: 'SPD', name: 'Chorus Speed', min: 0, max: 127, def: 40, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Speed of the chorus modulation.' },
  { fxPage: 'chorus', key: 'cho_depth', page: -1, slot: 2, short: 'DEP', name: 'Chorus Depth', min: 0, max: 127, def: 64, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Depth of the delay-time modulation.' },
  { fxPage: 'chorus', key: 'cho_width', page: -1, slot: 3, short: 'WID', name: 'Chorus Width', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Stereo spread of the two chorus voices.' },
  { fxPage: 'chorus', key: 'cho_fb', page: -1, slot: 4, short: 'FB', name: 'Chorus Feedback', min: 0, max: 127, def: 10, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Feedback - towards flanging at high values.' },
  { fxPage: 'chorus', key: 'cho_hpf', page: -1, slot: 5, short: 'HPF', name: 'Chorus High-pass', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: B('CHORUS'), desc: 'High-pass filter on the chorus output.' },
  { fxPage: 'chorus', key: 'cho_lpf', page: -1, slot: 6, short: 'LPF', name: 'Chorus Low-pass', min: 0, max: 127, def: 127, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Low-pass filter on the chorus output.' },
  { fxPage: 'chorus', key: 'cho_delay', page: -1, slot: 7, short: 'DEL', name: 'Chorus to Delay', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Sends the chorus on into the delay.' },
  { fxPage: 'chorus', key: 'cho_reverb', page: -1, slot: 8, short: 'REV', name: 'Chorus to Reverb', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Sends the chorus on into the reverb.' },
  { fxPage: 'chorus', key: 'cho_volume', page: -1, slot: 9, short: 'VOL', name: 'Chorus Volume', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: B('CHORUS'), desc: 'Chorus return level.' },

  { fxPage: 'delay', key: 'del_time', page: -1, slot: 0, short: 'TIM', name: 'Delay Time', min: 1, max: 128, def: 24, step: 1, fmt: int, manual: B('DELAY'), desc: 'Delay time in 128th notes, locked to tempo: 16 = 1/8, 24 = dotted 1/8, 32 = 1/4.' },
  { fxPage: 'delay', key: 'del_fb', page: -1, slot: 1, short: 'FB', name: 'Delay Feedback', min: 0, max: 127, def: 50, step: 1, fmt: int, manual: B('DELAY'), desc: 'How much of the echo is fed back - the number of repeats.' },
  { fxPage: 'delay', key: 'del_overdrive', page: -1, slot: 2, short: 'OVR', name: 'Delay Overdrive', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: B('DELAY'), desc: 'Saturation in the Saturator Delay.' },
  { fxPage: 'delay', key: 'del_hpf', page: -1, slot: 5, short: 'HPF', name: 'Delay High-pass', min: 0, max: 127, def: 10, step: 1, fmt: int, manual: B('DELAY'), desc: 'High-pass on the delay input - keeps echoes out of the bass.' },
  { fxPage: 'delay', key: 'del_lpf', page: -1, slot: 6, short: 'LPF', name: 'Delay Low-pass', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: B('DELAY'), desc: 'Low-pass in the feedback loop - each repeat gets darker.' },
  { fxPage: 'delay', key: 'del_reverb', page: -1, slot: 8, short: 'REV', name: 'Delay to Reverb', min: 0, max: 127, def: 0, step: 1, fmt: int, manual: B('DELAY'), desc: 'Sends the delay on into the reverb.' },
  { fxPage: 'delay', key: 'del_volume', page: -1, slot: 9, short: 'VOL', name: 'Delay Volume', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: B('DELAY'), desc: 'Delay return level.' },

  { fxPage: 'reverb', key: 'rev_pre', page: -1, slot: 0, short: 'PRE', name: 'Reverb Predelay', min: 0, max: 127, def: 10, step: 1, fmt: int, manual: B('REVERB'), desc: 'Gap before the Supervoid reverb starts - keeps the dry attack clear.' },
  { fxPage: 'reverb', key: 'rev_decay', page: -1, slot: 1, short: 'DEC', name: 'Reverb Decay', min: 0, max: 127, def: 64, step: 1, fmt: int, manual: B('REVERB'), desc: 'Length of the reverb tail.' },
  { fxPage: 'reverb', key: 'rev_hpf', page: -1, slot: 5, short: 'HPF', name: 'Reverb High-pass', min: 0, max: 127, def: 20, step: 1, fmt: int, manual: B('REVERB'), desc: 'High-pass on the reverb input.' },
  { fxPage: 'reverb', key: 'rev_lpf', page: -1, slot: 6, short: 'LPF', name: 'Reverb Low-pass', min: 0, max: 127, def: 90, step: 1, fmt: int, manual: B('REVERB'), desc: 'Damping - darker tails at low values.' },
  { fxPage: 'reverb', key: 'rev_volume', page: -1, slot: 9, short: 'VOL', name: 'Reverb Volume', min: 0, max: 127, def: 100, step: 1, fmt: int, manual: B('REVERB'), desc: 'Reverb return level.' },
];

// ----------------------------------------------------------------------------
// Ids and lookups
// ----------------------------------------------------------------------------

export const tid = (track: number, key: string) => `t${track + 1}_${key}`;
export const fxid = (key: string) => `fx_${key}`;
export const patternId = (track: number) => `t${track + 1}_pattern`;
export const notesId = (track: number) => `t${track + 1}_notes`;
export const locksId = (track: number) => `t${track + 1}_locks`;

export const PARAM_BY_KEY: Record<string, ParamDef> = Object.fromEntries(SYNTH_PARAMS.map(p => [p.key, p]));

/** The 10 encoder slots of a synth page */
export function pageSlots(page: number): (ParamDef | null)[] {
  const slots: (ParamDef | null)[] = Array(10).fill(null);
  SYNTH_PARAMS.filter(p => p.page === page).forEach(p => (slots[p.slot] = p));
  return slots;
}

export function fxSlots(fxPage: FxPage): (ParamDef | null)[] {
  const slots: (ParamDef | null)[] = Array(10).fill(null);
  FX_PARAMS.filter(p => p.fxPage === fxPage).forEach(p => (slots[p.slot] = p));
  return slots;
}

/**
 * Control id bound to encoder `slot` for the current track/page, or null.
 * TEMPO page: encoder A = BPM on every track.
 */
export function encoderControl(track: number, page: number, slot: number): string | null {
  if (page === PAGE.TEMPO) return slot === 0 ? 'tempo' : null;
  if (track === CV_TRACK) return null;
  if (track === FX_TRACK) {
    const p = fxSlots(fxPageFor(page))[slot];
    return p ? fxid(p.key) : null;
  }
  const p = pageSlots(page)[slot];
  return p ? tid(track, p.key) : null;
}

// ----------------------------------------------------------------------------
// Per-step notes and parameter locks (hidden pattern-like controls)
//
//   tN_notes : 16 steps x 2 hex chars. '--' = use the track's TRIG NOTE.
//   tN_locks : 16 steps x LOCK_SLOTS slots x 5 chars:
//              2 hex chars = index into LOCKABLE, 3 hex chars = value scaled
//              0..4095 over the parameter's range. '-----' = empty slot.
// ----------------------------------------------------------------------------

export const LOCK_SLOTS = 6;
const SLOT_CHARS = 5;
export const LOCK_STRING_LEN = STEPS * LOCK_SLOTS * SLOT_CHARS;
export const EMPTY_LOCKS = '-'.repeat(LOCK_STRING_LEN);
export const EMPTY_NOTES = '--'.repeat(STEPS);

/** Parameters that can be locked per step (trig note has its own string) */
export const LOCKABLE = SYNTH_PARAMS.filter(p => p.lock !== false && p.key !== 'trig_note');
const LOCK_INDEX: Record<string, number> = Object.fromEntries(LOCKABLE.map((p, i) => [p.key, i]));

const hex = (n: number, w: number) => Math.max(0, Math.round(n)).toString(16).padStart(w, '0').slice(-w);

function encodeValue(p: ParamDef, v: number): string {
  const n = (Math.min(p.max, Math.max(p.min, v)) - p.min) / (p.max - p.min || 1);
  return hex(n * 4095, 3);
}

function decodeValue(p: ParamDef, s: string): number {
  const n = parseInt(s, 16) / 4095;
  let v = p.min + n * (p.max - p.min);
  if (p.step) v = Math.round(v / p.step) * p.step;
  return Math.min(p.max, Math.max(p.min, v));
}

export type StepLocks = Record<string, number>;

/** All locks as [step] -> { paramKey: value } */
export function parseLocks(str: string | undefined): StepLocks[] {
  const out: StepLocks[] = Array.from({ length: STEPS }, () => ({}));
  if (!str || str.length !== LOCK_STRING_LEN) return out;
  for (let s = 0; s < STEPS; s++) {
    for (let k = 0; k < LOCK_SLOTS; k++) {
      const at = (s * LOCK_SLOTS + k) * SLOT_CHARS;
      const chunk = str.slice(at, at + SLOT_CHARS);
      if (chunk[0] === '-') continue;
      const p = LOCKABLE[parseInt(chunk.slice(0, 2), 16)];
      if (p) out[s][p.key] = decodeValue(p, chunk.slice(2));
    }
  }
  return out;
}

export function serializeLocks(locks: StepLocks[]): string {
  let s = '';
  for (let st = 0; st < STEPS; st++) {
    const entries = Object.entries(locks[st] ?? {}).filter(([k]) => LOCK_INDEX[k] !== undefined).slice(0, LOCK_SLOTS);
    for (let k = 0; k < LOCK_SLOTS; k++) {
      const e = entries[k];
      s += e ? hex(LOCK_INDEX[e[0]], 2) + encodeValue(PARAM_BY_KEY[e[0]], e[1]) : '-----';
    }
  }
  return s;
}

/** Set (or with value null, clear) one lock. Returns null when the step's slots are full. */
export function withLock(str: string | undefined, step: number, key: string, value: number | null): string | null {
  const locks = parseLocks(str);
  const cur = { ...locks[step] };
  if (value === null) delete cur[key];
  else {
    if (!(key in cur) && Object.keys(cur).length >= LOCK_SLOTS) return null;
    cur[key] = value;
  }
  locks[step] = cur;
  return serializeLocks(locks);
}

export function clearStepLocks(str: string | undefined, step: number): string {
  const locks = parseLocks(str);
  locks[step] = {};
  return serializeLocks(locks);
}

/** Preset helper: build a lock string from { step(1-based): { key: value } } */
export function locks(map: Record<number, StepLocks>): string {
  const l: StepLocks[] = Array.from({ length: STEPS }, () => ({}));
  Object.entries(map).forEach(([s, v]) => (l[Number(s) - 1] = v));
  return serializeLocks(l);
}

export function parseNotes(str: string | undefined): (number | null)[] {
  const out: (number | null)[] = Array(STEPS).fill(null);
  if (!str || str.length !== STEPS * 2) return out;
  for (let s = 0; s < STEPS; s++) {
    const c = str.slice(s * 2, s * 2 + 2);
    if (c !== '--') {
      const n = parseInt(c, 16);
      if (Number.isFinite(n)) out[s] = n;
    }
  }
  return out;
}

export function serializeNotes(notes: (number | null)[]): string {
  return Array.from({ length: STEPS }, (_, i) => (notes[i] == null ? '--' : hex(notes[i]!, 2))).join('');
}

export function withNote(str: string | undefined, step: number, note: number | null): string {
  const n = parseNotes(str);
  n[step] = note;
  return serializeNotes(n);
}

/** Preset helper: notes as an array of MIDI numbers / null (rest uses TRIG NOTE) */
export const notes = (list: (number | null)[]) => serializeNotes(list);

/** Preset helper: pattern from a 'x...x...' string */
export const pat = (s: string) => s.replace(/\s/g, '').split('').map(c => (c === 'x' || c === '1' ? '1' : '0')).join('').padEnd(STEPS, '0').slice(0, STEPS);
