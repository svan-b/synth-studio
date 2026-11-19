// ============================================================================
// Elektron Analog Four MKII - specification
//
// Every sound parameter exists once per track (t1_osc1_tun ... t4_lfo2_depb),
// the FX track's as fx_*, the CV track's as cv_*; the ten DATA ENTRY encoders
// reach them through the selected track and page (params.ts). Patterns,
// songs and chains are structured device data (DeviceModule.data, the shared
// Elektron sequencer), not controls.
//
// Sources: REFERENCE.md (front panel), the OS 1.40A sound tables and the
// midi.guide NRPN map (parameters), Elektron Analog Four MKII User Manual.
// ============================================================================

import type { ControlSpec, DeviceSpec, PresetSpec } from '@/types';
import {
  CV_PARAMS, FX_PARAMS, PERF_MACROS, POLY_ALLOC, SYNTH_PARAMS, SYNTH_TRACKS, TRACK_NAMES, V, VIEW_LABELS,
  cvid, fxid, tid, type ParamDef,
} from './params';
import { SOUNDS } from './sounds';
import { KITS, KIT_PROJECT_IDS, kitValues, soundPresetValues } from './kits';

const PAGE_SHORT: Record<string, string> = {
  note: 'NOTE', arp: 'ARP', osc1: 'OSC1', noise: 'NOISE', osc2: 'OSC2', osc12: 'OSC1&2', filters: 'FLTR', amp: 'AMP',
  envf: 'ENVF', env2: 'ENV2', lfo1: 'LFO1', lfo2: 'LFO2', vmod: 'VEL', snd: 'SND', mix: 'MIX',
  fxnote: 'NOTE', extin: 'EXT', chorus: 'CHO', delay: 'DEL', reverb: 'REV', fxlfo1: 'LFO1', fxlfo2: 'LFO2',
  cvnote: 'NOTE', cva: 'CVA', cvb: 'CVB', cvc: 'CVC', cvd: 'CVD',
};

function knobFor(p: ParamDef, label: string): ControlSpec {
  return {
    type: 'knob',
    label,
    description: `${p.name}: ${p.desc}`,
    manualReference: p.manual,
    min: p.min,
    max: p.max,
    default: p.def,
    step: p.step ?? 1,
    units: 'none',
    bipolar: p.bipolar,
    endless: true,
    format: p.fmt,
  };
}

const controls: Record<string, ControlSpec> = {};

for (let t = 0; t < SYNTH_TRACKS; t++) {
  for (const p of SYNTH_PARAMS) controls[tid(t, p.key)] = knobFor(p, `T${t + 1} ${PAGE_SHORT[p.page] ?? ''} ${p.short}`.replace(/\s+/g, ' '));
}
for (const p of FX_PARAMS) {
  const id = p.key.startsWith('trig_') ? tid(4, p.key) : fxid(p.key);
  controls[id] = knobFor(p, `FX ${PAGE_SHORT[p.page] ?? ''} ${p.short}`.replace(/\s+/g, ' '));
}
for (const p of CV_PARAMS) {
  const id = p.key.startsWith('trig_') ? tid(5, p.key) : cvid(p.key);
  controls[id] = knobFor(p, `CV ${PAGE_SHORT[p.page] ?? ''} ${p.short}`.replace(/\s+/g, ' '));
}

const MAN = 'Manual - Front panel';
// Track mutes ([FUNC] + [TRACK], manual p.37) are not controls: they belong to the project
// (Project.mutes), stay put when patterns change and are applied by the sequencer.
Object.assign(controls, {
  tempo: {
    type: 'knob', label: 'TEMPO', min: 30, max: 300, default: 120, step: 1, units: 'BPM', endless: true,
    description: 'Project tempo (internal clock). Synced to the studio, the studio tempo wins. [TEMPO] then DATA ENTRY A; [FUNC] + [TEMPO] taps it.',
    manualReference: `${MAN}, [TEMPO]`,
  },
  swing: {
    type: 'knob', label: 'SWING', min: 50, max: 80, default: 50, step: 1, units: '%', endless: true,
    description: 'Swing of the active pattern: every second step is late (50 = straight, 66 = triplet feel). [FUNC] + [PTN] on the hardware.',
    manualReference: 'Manual - Sequencer, SWING menu', format: (v: number) => `${Math.round(v)}%`,
  },
  main_volume: {
    // a pot; drawn like the panel's, with its mark and no printed scale (hence `endless`)
    type: 'knob', label: 'MAIN VOLUME', min: 0, max: 127, default: 100, step: 1, units: 'none', endless: true,
    description: 'Level of the main and headphone outputs.', manualReference: `${MAN}, MAIN VOLUME`,
  },
  ...Object.fromEntries('abcdefghij'.split('').map((c, i) => [`perf_${c}`, {
    type: 'knob', label: `PERF ${c.toUpperCase()}`, min: 0, max: 127, default: 0, step: 1, units: 'none', endless: true,
    description: `Performance macro ${c.toUpperCase()} (${PERF_MACROS[i].name}): one knob moves several parameters on every track at once.`,
    manualReference: 'Manual - Performance mode',
  } satisfies ControlSpec])),
  perf_mute: { type: 'button', label: 'PERF MUTE', default: false, description: 'Mutes every performance macro ([FUNC] + [QPER]): the sound jumps back to the kit.', manualReference: `${MAN}, [QPER]` },
  qper_sel: {
    type: 'switch', label: 'QUICK PERF', options: PERF_MACROS.map((m, i) => `${'ABCDEFGHIJ'[i]} ${m.name}`), default: 0,
    description: 'The macro the QUICK PERF knob controls ([QPER] + [TRIG 1-10]).', manualReference: `${MAN}, [QPER]`,
  },
  play: { type: 'button', label: 'PLAY', default: false, description: 'Start / stop the sequencer (Space bar). [PLAY] while playing pauses and [PLAY] again resumes; synced to the studio it is the studio transport.', manualReference: 'Manual p.38-39, PATTERN CONTROL' },
  rec: { type: 'button', label: 'REC', default: true, description: 'GRID RECORDING: lit, the trig keys enter and remove trigs; dark, they play the steps.', manualReference: `${MAN}, [RECORD]` },
  live_rec: { type: 'button', label: 'LIVE REC', default: false, description: 'LIVE RECORDING ([REC] + [PLAY]): notes you play on the keyboard are recorded into the playing pattern.', manualReference: 'Manual - Sequencer, LIVE RECORDING' },
  track: {
    type: 'switch', label: 'TRACK', options: [...TRACK_NAMES], default: 0,
    description: 'The active track: the encoders, screen, trig keys and keyboard follow it.', manualReference: `${MAN}, [TRACK] keys`,
  },
  page: {
    type: 'switch', label: 'PAGE', options: VIEW_LABELS, default: V.OSC1,
    description: 'The PARAMETER page shown on the screen and DATA ENTRY knobs. Pressing a lit key again opens its second page.', manualReference: `${MAN}, [PARAMETER] keys`,
  },
  kb_oct: {
    type: 'switch', label: 'OCTAVE', options: ['-5', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5'], default: 5,
    description: 'Octave of the keyboard ([OCT-] / [OCT+], or UP / DOWN): -5..+5, the OCTAVE LEDs show -3..+3. At 0 the first key plays C5 (MIDI 72).', manualReference: `${MAN}, [OCT-/+] (manual p.36)`,
  },
  trns: {
    type: 'knob', label: 'TRANSPOSE', min: -24, max: 24, default: 0, step: 1, units: 'semitones', bipolar: true,
    description: 'Live transpose of the synth tracks\' note trigs (hold [TRNS] and press a keyboard key).', manualReference: `${MAN}, [TRNS]`,
  },
  // POLY CONFIG ([FUNC] + [MIX], or KIT > POLY CONFIG): kit settings (manual p.24, p.28-31). All
  // off by default, so every track plays its own mono voice as before.
  ...Object.fromEntries([1, 2, 3, 4].map(n => [`poly_v${n}`, {
    type: 'button', label: `POLY VOICE ${n}`, default: false,
    description: `Voice ${n} joins the poly pool: track ${n} then plays chords and overlapping notes on the pool's voices, which it shares with the other poly tracks. Off, voice ${n} is track ${n}'s own mono voice.`,
    manualReference: 'Manual p.28-29, POLYPHONY CONFIGURATION: VOICES',
  } satisfies ControlSpec])),
  poly_alloc: {
    type: 'switch', label: 'POLY ALLOCATION', options: POLY_ALLOC, default: 0,
    description: 'Which poly voice a new note takes. RESET: the first free one, counting up from the track\'s own voice. ROTATE: the next one in turn. REASSIGN: the voice that note used last time, if it is free. UNISON: every poly voice plays the same note.',
    manualReference: 'Manual p.29-31, POLYPHONY CONFIGURATION: ALLOCATION',
  },
  poly_trk: {
    type: 'button', label: 'USE TRK SOUNDS', default: false,
    description: 'Off: a poly voice plays the sound of the track whose note it plays. On: each voice keeps its own track\'s sound, so one track\'s chord is spread over several sounds.',
    manualReference: 'Manual p.29, POLYPHONY CONFIGURATION: USE TRK SOUNDS',
  },
  poly_det: {
    type: 'knob', label: 'UNISON DETUNE', min: 0, max: 127, default: 16, step: 1, units: 'none', endless: true,
    description: 'UNISON: how far the voices are detuned from each other. The outer voices sit DETUNE/128 of a semitone either side of the note (16 = 12.5 cents).',
    manualReference: 'Manual p.29, POLYPHONY CONFIGURATION: UNISON DETUNE',
  },
  poly_spr: {
    type: 'knob', label: 'UNISON PAN SPREAD', min: 0, max: 127, default: 64, step: 1, units: 'none', endless: true,
    description: 'UNISON: how wide the voices are spread across the stereo field around the sound\'s own PAN (127 = hard left and right).',
    manualReference: 'Manual p.29, POLYPHONY CONFIGURATION: UNISON PAN SPREAD',
  },
  trig_mode: {
    type: 'switch', label: 'TRIG MODE', options: ['TRIGS', 'ACCENT', 'NOTE SLIDE', 'PARAM SLIDE', 'TRIG MUTE'], default: 0,
    description: 'What tapping the trig keys does: enter trigs, or set accents, note slides, parameter slides or trig mutes ([FUNC] + [BANK F/G/H/E]).',
    manualReference: 'Manual p.51-53, TRIG MUTE, ACCENT, NOTE SLIDE and PARAMETER SLIDE menus',
  },
  kit_project: { type: 'switch', label: 'PROJECT', options: KIT_PROJECT_IDS, default: 0, description: 'Kit presets load their project (patterns and song) through this.', manualReference: 'Manual - Projects' },
  kit_project_loaded: { type: 'switch', label: 'PROJECT LOADED', options: KIT_PROJECT_IDS, default: 0, description: 'Which kit project is in the pattern memory.', manualReference: 'Manual - Projects' },
} satisfies Record<string, ControlSpec>);

// ----------------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------------

const presets: Record<string, PresetSpec> = {};
KITS.forEach((kit, i) => {
  presets[kit.id] = {
    name: kit.name,
    description: `${kit.desc} Loads the four sounds, the FX track and the project's patterns and song.`,
    source: 'community',
    author: 'Synth Studio',
    settings: { ...kitValues(kit), kit_project: i + 2, track: 0, page: V.OSC1 },
  };
});
presets.init = {
  name: 'Kit / Init sounds (blank pattern)',
  description: 'Init sound on every track and a blank pattern memory, except one trig on each beat of T1 so PLAY sounds at once: start a track from scratch ([FUNC] + [PLAY] clears the pattern).',
  source: 'community',
  author: 'Synth Studio',
  settings: { kit_project: 1, track: 0, page: V.NOTE },
};
SOUNDS.forEach(s => {
  presets[`sound-${s.id}`] = {
    name: s.name,
    description: `${s.desc}${s.recreates ? ` Recreation of ${s.recreates}.` : ''} Loads on track 1 with a one-bar demo in pattern A01 (the other tracks get the init sound, and the demo replaces the pattern memory, as a kit does). Use [SND] to load a sound into any track without touching the rest.`,
    source: 'community',
    author: 'Synth Studio',
    settings: soundPresetValues(s),
  };
});

/** Track 1's control ids for the parameters of these pages (the signal path lists one track) */
const T1 = (pages: string[]): string[] => SYNTH_PARAMS.filter(p => pages.includes(p.page)).map(p => tid(0, p.key));

export const ANALOG_FOUR: DeviceSpec = {
  id: 'analog-four',
  name: 'Analog Four MKII',
  manufacturer: 'Elektron',
  year: 2017,
  description: 'Four-voice analog synthesizer with a 64-step parameter-lock sequencer. Per voice: two oscillators with sub oscillators, noise, a 4-pole ladder low-pass, overdrive, a 2-pole multimode filter, three envelopes, two LFOs. FX track with chorus, delay and reverb; CV track; arpeggiator; performance macros.',
  manualUrl: 'https://www.elektron.se/support-downloads/analog-four-mkii',
  dimensions: { width: 385, height: 225, depth: 82 },
  display: { width: 1194, height: 698, scale: 3.1 },

  // The signal path of one synth track, drawn in our own style from the facts of the manual's
  // charts (ANALOG FOUR MKII SIGNAL PATH, p.15, and Appendix E, p.110): two oscillators and noise into the ladder filter,
  // overdrive, the multimode filter, the amp, and the sends to the FX track. `controls` are track
  // 1's; `match` finds the same block on tracks 2 to 4. Choosing a block opens its page (index.ts).
  signalFlow: [
    { id: 'sequencer', name: 'Sequencer', label: 'Sequencer', role: 'control', order: 1, at: [0, 0.5],
      description: 'Each track has its own pattern of up to 64 steps. A note trig sends a pitch to the oscillators and starts the envelopes. The NOTE and ARP pages set what a new trig plays.',
      controls: ['play', 'tempo', 'swing', 'rec', 'live_rec', 'trns', 'trig_mode', ...T1(['note', 'arp'])], match: '^t[1-6]_(trig|arp)_',
      mods: [{ to: 'osc1', what: 'pitch' }, { to: 'osc2', what: 'pitch' }] },
    { id: 'osc1', name: 'Oscillator 1 and its sub oscillator', label: 'Osc 1\n+ Sub', order: 2, at: [1.25, 0], to: ['ladder'],
      description: 'An analog oscillator: sawtooth, transistor pulse, pulse or triangle, with pulse width and its own PWM. SUB adds a square one or two octaves down.',
      controls: T1(['osc1']), match: '^t[1-4]_osc1_',
      mods: [{ to: 'osc2', what: 'sync and AM, either way (OSC 1&2 page)', both: true }] },
    { id: 'osc2', name: 'Oscillator 2 and its sub oscillator', label: 'Osc 2\n+ Sub', order: 3, at: [1.25, 1], to: ['ladder'],
      description: 'The second oscillator, the same as the first. Its key opens a second page, OSC 1&2: sync, amplitude modulation, vibrato, slide and pitch bend for both.',
      controls: T1(['osc2', 'osc12']), match: '^t[1-4]_osc(2)?_' },
    { id: 'noise', name: 'Noise', label: 'Noise', order: 4, at: [1.25, 2], to: ['ladder'],
      description: 'A noise generator with a colour filter and sample and hold. It has its own fade envelope, for a burst at the start of a note or a slow swell.',
      controls: T1(['noise']), match: '^t[1-4]_noise_' },
    { id: 'ladder', name: 'Filter 1: ladder low-pass', label: 'Ladder\nfilter', order: 5, at: [2.25, 0], size: [1, 3], to: ['overdrive'],
      description: 'The first filter, a 4-pole low-pass. FRQ sets the cutoff and RES a peak there that can ring on its own. DEP is how far the filter envelope moves it.',
      controls: ['t1_flt1_frq', 't1_flt1_res', 't1_flt1_trk', 't1_flt1_dep'], match: '^t[1-4]_flt1_(frq|res|trk|dep)$' },
    { id: 'overdrive', name: 'Overdrive', label: 'Overdrive', order: 6, at: [3.25, 1], to: ['multimode'],
      description: 'An analog overdrive between the two filters. OVR to the right adds grit. To the left it cleans the signal by lowering the level into the second filter.',
      controls: ['t1_flt1_ovr'], match: '^t[1-4]_flt1_ovr$' },
    { id: 'multimode', name: 'Filter 2: multimode', label: 'Multimode\nfilter', order: 7, at: [4.25, 1], to: ['amp'],
      description: 'The second filter, 2-pole, after the overdrive. TYP picks one of seven shapes: low-pass, high-pass, band-pass, band-stop and peak.',
      controls: T1(['filters']).filter(id => id.startsWith('t1_flt2_')), match: '^t[1-4]_flt2_' },
    { id: 'amp', name: 'Amp', label: 'Amp', order: 8, at: [5.25, 1], to: ['fx', '>Out'],
      description: 'The amplifier and its own envelope (ATK, DEC, SUS, REL), then pan and volume. CHO, DEL and REV send copies of the sound to the three effects.',
      controls: [...T1(['amp']), 't1_level'], match: '^t[1-4]_(amp_|level$)' },
    { id: 'fx', name: 'FX track: chorus, delay, reverb', label: 'Chorus\nDelay\nReverb', order: 9, at: [5.25, 2], to: ['>Out'],
      description: 'Three send effects shared by all four tracks. They are the FX track: select it and the FLTR, AMP and ENV keys open CHORUS, DELAY and REVERB. Their sound joins the main outputs.',
      controls: FX_PARAMS.filter(p => !p.key.startsWith('trig_')).map(p => fxid(p.key)), match: '^fx_' },
    { id: 'envf', name: 'Filter envelope (ENV F)', label: 'Env F', role: 'control', order: 10, at: [3.25, 2],
      description: 'The envelope wired to both filters: each filter takes as much of it as its DEP says. It also has two free destinations, DST A and DST B.',
      controls: T1(['envf']), match: '^t[1-4]_envf_',
      mods: [{ to: 'ladder', what: 'cutoff, by its DEP' }, { to: 'multimode', what: 'cutoff, by its DEP' }] },
    { id: 'env2', name: 'Envelope 2', label: 'Env 2', role: 'control', order: 11, at: [3.25, 0],
      description: 'A free envelope. It does nothing until DST A or DST B names a parameter: pitch for a kick, pulse width, an effect send.',
      controls: T1(['env2']), match: '^t[1-4]_env2_',
      mods: [{ to: '*', what: 'any two parameters you choose (DST A, DST B)' }] },
    { id: 'lfo1', name: 'LFO 1', label: 'LFO 1', role: 'control', order: 12, at: [4.25, 0],
      description: 'A low frequency oscillator with seven waves, tempo multipliers and a fade. It moves the two parameters you name in DST A and DST B.',
      controls: T1(['lfo1']), match: '^t[1-4]_lfo1_',
      mods: [{ to: '*', what: 'any two parameters you choose (DST A, DST B)' }] },
    { id: 'lfo2', name: 'LFO 2', label: 'LFO 2', role: 'control', order: 13, at: [5.25, 0],
      description: 'The second LFO, the same as the first. It can also move LFO 1, for movement that itself moves.',
      controls: T1(['lfo2']), match: '^t[1-4]_lfo2_',
      mods: [{ to: '*', what: 'any two parameters you choose (DST A, DST B)' }] },
    // Not part of one voice's path: the velocity and sound settings pages, the CV track, the
    // performance macros, polyphony and the main volume
    { id: 'other', name: 'Outside one voice', order: 14, controls: ['main_volume', 'perf_mute', 'kit_project', 'kit_project_loaded'],
      match: '^(t[1-4]_(vmod|snd)_|cv_|perf_[a-j]$|poly_)' },
  ],

  controls,
  presets,
};
