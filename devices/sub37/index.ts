import type { DeviceModule } from '../types';
import { SUB37 } from './spec';
import { SUB37_LAYOUT } from './layout';
import { SUB37_LESSONS } from './lessons';
import { Sub37Engine } from './engine';

const sub37: DeviceModule = {
  spec: SUB37,
  layout: SUB37_LAYOUT,
  lessons: SUB37_LESSONS,
  createEngine: () => new Sub37Engine(),
  // Computer keys A–K start at C3; the on-screen 37-note keyboard spans C2–C5
  keyboard: { lowNote: 48 },
  uiControls: ['knob_shift', 'pitch_bend', 'mod_wheel', 'preset_number'],
  worklets: ['/worklets/sub37-processors.js'],
  tips: [
    'Play the 37 keys with mouse or fingers (chords work on iPad), or computer keys A–K (Z/X shift octave). Drag the PITCH and MOD wheels up and down.',
    'Presets 1–11 recall patches in bank 1. The real Sub 37 has 16 banks of 16 plus SAVE and menus; those are simplified here, and the LCD shows the preset and the last control you touched.',
    'KNOB SHIFT turns each envelope\'s ATTACK / DECAY / SUSTAIN / RELEASE knobs into DELAY / HOLD / VEL AMT / KB AMT, as on the hardware.',
    'The mod wheel sets Mod 1 depth; Mod 2 is always on. PGM DEST is a menu item on the hardware (about 100 targets); here it offers WAVE, RES, EG TIME and AMP.',
    'DUO MODE: hold two keys – Osc 1 takes the lowest, Osc 2 the highest. Otherwise the Sub 37 is mono with last-note priority.',
    'Not modelled: step sequencer, envelope SYNC, arpeggiator INVERT and clock sync, EXT IN audio, headphone level. On-screen keys always play at full velocity.',
  ],
};

export default sub37;
