import type { DeviceModule } from '../types';
import { ANALOG_RYTM } from './spec';
import { ANALOG_RYTM_LAYOUT } from './layout';
import { ANALOG_RYTM_LESSONS } from './lessons';
import { AnalogRytmEngine } from './engine';

// Simplified honestly (see the engine.ts and params.ts headers):
// one fixed analog machine per track, no sample layer, no parameter locks,
// scenes or performance macros, one pattern per kit, free-running LFOs.
const analogRytm: DeviceModule = {
  spec: ANALOG_RYTM,
  layout: ANALOG_RYTM_LAYOUT,
  lessons: ANALOG_RYTM_LESSONS,
  createEngine: () => new AnalogRytmEngine(),
  transportControl: 'play',
  uiControls: ['track', 'page', 'pad_mode', 'accent_edit'],
  tips: [
    'Tap a pad to play it and make it the active track. Press [PLAY] (or Space) to run the 16-step pattern.',
    'Pick a PARAMETER page (TRIG, SRC, FLTR, AMP, LFO): the screen and the eight DATA ENTRY encoders A–H follow the active track and page. [FX] selects the FX track: SRC = DELAY, SMPL = REVERB, FLTR = DIST, AMP = COMP. [TEMPO] puts BPM and SWING on A and B.',
    'The 16 trig keys edit the active track. Press [ACCENT] to edit accent trigs instead (they play at full velocity); the TRIG page VEL sets the level of normal trigs and pad hits.',
    'MUTE mode: tap pads to mute or unmute their sequencer tracks. RS/CP, MT/HT, CH/OH and CY/CB share an analog voice, so they choke each other (the right-hand pad wins).',
    'Simplified: one classic machine per track, no sample layer (SMPL), no parameter locks, scenes or performance macros, a single pattern per kit. CHRO/SCNE/PERF, BANK/PTN/KIT, FUNC and REC are drawn for orientation only. Pads play at the TRIG VEL instead of reading pressure.',
  ],
};

export default analogRytm;
