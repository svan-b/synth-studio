import type { DeviceModule } from '../types';
import { MOTHER32 } from './spec';
import { MOTHER32_LAYOUT } from './layout';
import { MOTHER32_LESSONS } from './lessons';
import { Mother32Engine } from './engine';
import { KB_LOW } from './sequence';

const mother32: DeviceModule = {
  spec: MOTHER32,
  layout: MOTHER32_LAYOUT,
  lessons: MOTHER32_LESSONS,
  createEngine: () => new Mother32Engine(),
  keyboard: { lowNote: KB_LOW },
  transportControl: 'run_stop',
  worklets: ['/worklets/mother32-processors.js'],
  // REC is momentary UI state (SHIFT + RUN/STOP); Reset should not touch it
  uiControls: ['rec'],
  tips: [
    'Play the 13 keys on the panel or A–K on your computer keyboard. RUN/STOP (Space) plays the 32-step sequencer; while it runs, the keys transpose the pattern.',
    'Patch: tap an output (boxed legend), then tap an input - or drag between them. Tap a cable to unplug it. A cable into an input breaks that input\'s internal normal, exactly like the hardware.',
    'Record a pattern: tap SHIFT, then RUN/STOP (REC). Each key stores a note and moves to the next step; HOLD/REST stores a rest, RESET/ACCENT accents the next note. RUN/STOP ends recording.',
    'SHIFT is latching here (tap on, tap off) so you can turn TEMPO into GATE LENGTH with a mouse. KB ◂ / STEP ▸ change the keyboard octave.',
    'Simplified: STEP (step-edit) mode, per-step glide / ratchet / gate length, swing, pattern banks and MIDI are not modelled; ASSIGN offers two of its 16 Setup-mode sources.',
    'Double-tap any knob to return it to its default.',
  ],
};

export default mother32;
