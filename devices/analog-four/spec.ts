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
  CV_PARAMS, FX_PARAMS, PERF_MACROS, SYNTH_PARAMS, SYNTH_TRACKS, TRACK_NAMES, V, VIEW_LABELS,
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
// Track mutes ([FUNC] + [TRACK]): global, so they stay put when patterns change
TRACK_NAMES.forEach((name, t) => {
  controls[tid(t, 'mute')] = {
    type: 'button', label: `${name} MUTE`, default: false,
    description: `Mutes ${name}: its trigs stop playing until you unmute it. [FUNC] + [${name}]; the track key goes dark.`,
    manualReference: `${MAN}, [FUNC] + [TRACK]`,
  };
});
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
  play: { type: 'button', label: 'PLAY', default: false, description: 'Start / stop the sequencer (Space bar). Synced to the studio it is the studio transport.', manualReference: `${MAN}, [PLAY] / [STOP]` },
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
  trig_mode: {
    type: 'switch', label: 'TRIG MODE', options: ['TRIGS', 'ACCENT', 'NOTE SLIDE', 'PARAM SLIDE'], default: 0,
    description: 'What tapping the trig keys does: enter trigs, or set accents, note slides or parameter slides ([FUNC] + [BANK F/G/H]).',
    manualReference: 'Manual - Sequencer, trig types',
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
  name: 'Kit / Empty project (init sounds)',
  description: 'Init sound on every track and an empty pattern memory: start a track from scratch.',
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

export const ANALOG_FOUR: DeviceSpec = {
  id: 'analog-four',
  name: 'Analog Four MKII',
  manufacturer: 'Elektron',
  year: 2017,
  description: 'Four-voice analog synthesizer with a 64-step parameter-lock sequencer. Per voice: two oscillators with sub oscillators, noise, a 4-pole ladder low-pass, overdrive, a 2-pole multimode filter, three envelopes, two LFOs. FX track with chorus, delay and reverb; CV track; arpeggiator; performance macros.',
  manualUrl: 'https://www.elektron.se/support-downloads/analog-four-mkii',
  dimensions: { width: 385, height: 225, depth: 82 },
  display: { width: 1194, height: 698, scale: 3.1 },

  signalFlow: [
    { id: 'sequencer', name: 'Sequencer', order: 1, description: 'Patterns of up to 64 steps per track, p-locks, conditions, chains and songs', controls: ['play', 'tempo', 'swing'] },
    { id: 'oscillators', name: 'Oscillators', order: 2, description: 'OSC 1 / OSC 2 with sub oscillators, sync and AM; NOISE', controls: SYNTH_PARAMS.filter(p => ['osc1', 'osc2', 'osc12', 'noise'].includes(p.page)).map(p => tid(0, p.key)) },
    { id: 'filters', name: 'Filters', order: 3, description: '4-pole ladder low-pass, overdrive, 2-pole multimode', controls: SYNTH_PARAMS.filter(p => p.page === 'filters').map(p => tid(0, p.key)) },
    { id: 'amp', name: 'Amp', order: 4, description: 'Amp envelope, FX sends, pan, volume', controls: SYNTH_PARAMS.filter(p => p.page === 'amp').map(p => tid(0, p.key)) },
    { id: 'modulation', name: 'Envelopes and LFOs', order: 5, description: 'ENV F, ENV 2, LFO 1, LFO 2, velocity modulation', controls: SYNTH_PARAMS.filter(p => ['envf', 'env2', 'lfo1', 'lfo2', 'vmod'].includes(p.page)).map(p => tid(0, p.key)) },
    { id: 'fx', name: 'FX track', order: 6, description: 'Chorus, delay, reverb, FX LFOs', controls: FX_PARAMS.filter(p => !p.key.startsWith('trig_')).map(p => fxid(p.key)) },
  ],

  controls,
  presets,
};
