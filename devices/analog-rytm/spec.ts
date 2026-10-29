// ============================================================================
// Elektron Analog Rytm MKII - specification
//
// Every parameter of every PARAMETER page is its own control, per track:
//   <trk>_machine                    machine select (the track's compatible list)
//   <trk>_<key>                      SRC page machine parameters (bd_tun, bd_swt ...)
//   <trk>_trig_* / smp_* / flt_* / amp_* / lfo_*   TRIG, SMPL, FLTR, AMP, LFO pages
//   <trk>_trk_lev, _acc_lev, _vel_vol             track level, accent level, velocity to volume
//   fx_<key>                          FX track: DELAY, REVERB, DISTORTION, COMPRESSOR, FX LFO
// plus the globals (tempo, main volume, quick performance amount, transport,
// pad modes) and the UI state (track, page, pad mode, record mode).
// The ids and their units come from model.ts; REFERENCE.md has the sources.
// ============================================================================

import type { ControlSpec, DeviceSpec, KnobSpec } from '@/types';
import {
  FX_PAGES, FX_TRACK, FX_TRACK_LEVEL, MACHINES, PAGES, PARAM_INDEX, RETRIG_MENU, TRACKS, TRACK_EXTRA, TRACK_OPTIONS, TRACK_PAGES, TRIG_COND, TRIG_PAGE,
  formatMachineParam, formatPage, machineParamDefault, trackParamKeys, type PageParam,
} from './model';
import { KIT_PRESETS } from './presets';

const REF = {
  trig: 'Rytm MKII manual p.43: TRIG menu',
  trc: 'Rytm MKII manual p.48: conditional locks (TRC)',
  src: 'Rytm MKII manual pp.96-109: Appendix D, machines',
  smpl: 'Rytm MKII manual pp.77-78: SMPL page',
  fltr: 'Rytm MKII manual pp.78-79: FLTR page',
  amp: 'Rytm MKII manual p.79: AMP page',
  lfo: 'Rytm MKII manual pp.79-80: LFO page',
  fx: 'Rytm MKII manual pp.81-84: Appendix B, FX track',
  retrig: 'Rytm MKII manual p.41: RETRIG menu',
};

const knob = (label: string, description: string, ref: string, min: number, max: number, def: number, extra: Partial<KnobSpec> = {}): KnobSpec => ({
  type: 'knob', label, description, manualReference: ref, min, max, default: def, units: 'none', step: 1, endless: true, ...extra,
});

const pageKnob = (prefix: string, p: PageParam, ref: string, def = p.def): KnobSpec =>
  knob(`${prefix} ${p.abbr}`, `${p.name}: ${p.desc}`, ref, p.min, p.max, def, {
    bipolar: p.bipolar,
    units: p.key === 'smp_tun' ? 'semitones' : 'none',
    format: v => formatPage(p, v),
  });

/** Ids of the controls a kit stores (sounds, track levels, FX) - not the TRIG page's NOTE / VEL / LEN / PRB, which belong to the pattern */
export const KIT_CONTROL_IDS: string[] = [];
const SEQ_FIELDS = new Set(['trig_note', 'trig_vel', 'trig_len', 'trig_prob', 'trig_cond']);

function buildControls(): Record<string, ControlSpec> {
  const c: Record<string, ControlSpec> = {};
  const add = (id: string, spec: ControlSpec, kit = true) => {
    c[id] = spec;
    if (kit) KIT_CONTROL_IDS.push(id);
  };

  TRACKS.forEach((t, ti) => {
    const pre = t.name;
    add(`${t.id}_machine`, {
      type: 'switch', label: `${pre} MACHINE`, options: t.machines.map(m => MACHINES[m].name), default: t.machines.indexOf(t.machine),
      description: `Machine of track ${ti + 1} (${t.full}): which sound generator the voice runs`, manualReference: REF.src,
    });
    for (const key of trackParamKeys(t)) {
      const p = PARAM_INDEX[t.type][key];
      add(`${t.id}_${key}`, knob(`${pre} ${p.abbr}`, `${p.name}: ${p.desc}`, REF.src, p.min, p.max, machineParamDefault(t, key), {
        bipolar: p.bipolar, units: p.semis ? 'semitones' : 'none', format: v => formatMachineParam(p, v),
      }));
    }
    const pages: [PageParam[], string][] = [[TRIG_PAGE, REF.trig], [[TRIG_COND], REF.trc], [TRACK_PAGES[2], REF.smpl], [TRACK_PAGES[3], REF.fltr], [TRACK_PAGES[4], REF.amp], [TRACK_PAGES[5], REF.lfo], [TRACK_EXTRA, REF.amp], [RETRIG_MENU, REF.retrig]];
    for (const [page, ref] of pages) for (const p of page) add(`${t.id}_${p.key}`, pageKnob(pre, p, ref), !SEQ_FIELDS.has(p.key));
  });

  // FX track
  for (const page of Object.values(FX_PAGES)) for (const p of page) if (p) add(`fx_${p.key}`, pageKnob('FX', p, REF.fx));
  add('fx_trk_lev', pageKnob('FX', FX_TRACK_LEVEL, 'Rytm MKII manual p.36: FX track level'));
  add('fx_trig_prob', pageKnob('FX', TRIG_PAGE[3], REF.trig), false);
  add('fx_trig_cond', pageKnob('FX', TRIG_COND, REF.trc), false);

  // Globals (project settings, not part of a kit)
  c.bpm = knob('TEMPO', 'Project tempo in BPM ([TEMPO]). Synced to the studio, the studio clock sets it.', 'Manual: TEMPO menu', 30, 300, 124, {
    units: 'BPM', step: 0.1, format: v => v.toFixed(1),
  });
  c.main_volume = knob('MAIN VOLUME', 'Main output and headphones volume', 'Manual 3.1 Front panel: MAIN VOLUME', 0, 127, 100, { endless: false });
  c.qper = knob('QUICK PERF AMOUNT', 'Amount of the performance macros chosen with [QPER] + pads (an absolute knob)', 'Rytm MKII manual pp.30-31: QUICK PERFORMANCE', 0, 127, 0, { endless: false });
  c.fix_vel = knob('FIXED VEL', 'Velocity of the pads while [FIX] is on (AUTO = the track\'s VEL on the TRIG page)', 'Rytm MKII manual p.45: FIXED VELOCITY', 0, 127, 100, {
    format: v => (Math.round(v) <= 0 ? 'AUTO' : `${Math.round(v)}`),
  });
  c.quantize = { type: 'switch', label: 'QUANTIZE LIVE REC', options: ['OFF', 'ON'], default: 1, description: 'Live recording places pad hits on whole steps; off, they keep their micro timing ([REC] + double [PLAY])', manualReference: 'Rytm MKII manual p.40: LIVE RECORDING' };
  c.play = { type: 'button', label: 'PLAY', default: false, ledColor: '#3fd65a', description: 'Start / stop the sequencer (Space)', manualReference: 'Rytm MKII manual p.37: PATTERN CONTROL' };
  c.kit_demo = {
    type: 'switch', label: 'KIT DEMO', options: ['-', ...KIT_PRESETS.map(k => k.name)], default: 0,
    description: 'Factory kit loaded from the preset menu (selects its demo pattern)', manualReference: 'Factory kits',
  };

  // UI state
  c.track = { type: 'switch', label: 'TRACK', options: TRACK_OPTIONS, default: 0, description: 'Active track: tap a pad, or [TRK] + a trig key ([FX] for the FX track)', manualReference: 'Manual: selecting a track' };
  c.page = { type: 'switch', label: 'PAGE', options: [...PAGES], default: 1, description: 'PARAMETER page on the screen and the DATA ENTRY encoders', manualReference: 'Manual: PARAMETER pages' };
  c.pad_mode = { type: 'switch', label: 'PAD MODE', options: ['PLAY', 'MUTE', 'CHRO', 'SCNE', 'PERF'], default: 0, description: 'What the pads do: play, mute tracks, play chromatically, select scenes or play performance macros', manualReference: 'Manual: pad modes' };
  c.rec = { type: 'switch', label: 'REC', options: ['OFF', 'GRID', 'LIVE'], default: 0, description: 'OFF: trig keys 1-12 play the tracks. GRID RECORDING ([REC]): trig keys place trigs. LIVE RECORDING ([REC] + [PLAY]): pad hits are recorded.', manualReference: 'Rytm MKII manual pp.39-40: recording modes' };
  c.fix = { type: 'switch', label: 'FIX', options: ['OFF', 'ON'], default: 0, description: 'Fixed velocity for the pads', manualReference: 'Rytm MKII manual p.45: FIXED VELOCITY' };
  c.auto_trk = { type: 'switch', label: 'AUTO TRK SWITCH', options: ['OFF', 'ON'], default: 0, description: 'ON: the pad or trig key you play last becomes the active track. OFF (default): select tracks with [TRK] + pad.', manualReference: 'Rytm MKII manual p.67: SEQUENCER CONFIG' };
  return c;
}

export const ANALOG_RYTM: DeviceSpec = {
  id: 'analog-rytm',
  name: 'Analog Rytm MKII',
  manufacturer: 'Elektron',
  year: 2017,
  description: '8-voice analog drum computer & sampler: 12 velocity-sensitive pads, 12 drum tracks + FX track, 34 machines, sample layer, 64-step sequencer with parameter locks, scenes and performance macros',
  manualUrl: 'https://www.elektron.se/support-downloads/analog-rytm-mkii',
  // Elektron spec: W385 x D225 x H82 mm including knobs and feet
  dimensions: { width: 385, height: 225, depth: 82 },
  display: { width: 1240, height: 680, scale: 3.2 },
  signalFlow: [
    { id: 'voices', name: 'Machines (SRC)', description: '8 analog voices on 12 tracks: RS/CP, MT/HT, CH/OH and CY/CB share a voice', order: 1, controls: TRACKS.map(t => `${t.id}_machine`) },
    { id: 'sample', name: 'Sample layer (SMPL)', description: 'A one-shot layered with the machine before the filter', order: 2, controls: TRACKS.map(t => `${t.id}_smp_slot`) },
    { id: 'track', name: 'Overdrive > filter > amp', description: 'Per voice: analog overdrive, multimode filter with ADSR, amp envelope, pan, volume, sends', order: 3, controls: TRACKS.flatMap(t => [`${t.id}_flt_frq`, `${t.id}_amp_vol`]) },
    { id: 'fx', name: 'FX track', description: 'Digital delay and reverb sends; analog distortion and compressor on the mix', order: 4, controls: Object.values(FX_PAGES).flatMap(p => p.filter(Boolean).map(x => `fx_${x!.key}`)) },
    { id: 'seq', name: 'Sequencer', description: '64-step patterns with locks, conditions, micro timing and retrigs; chains and songs', order: 5, controls: ['bpm', 'play'] },
  ],
  controls: buildControls(),
  presets: Object.fromEntries(KIT_PRESETS.map((k, i) => [k.key, {
    name: k.name, description: k.description, source: k.factory ? 'factory' as const : 'community' as const,
    settings: { ...k.values, kit_demo: i + 1 },
  }])),
};

export const FX_TRACK_INDEX = FX_TRACK;
