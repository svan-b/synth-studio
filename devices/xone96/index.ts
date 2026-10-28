import type { DeviceModule } from '../types';
import { XONE96, CHANNELS } from './spec';
import { XONE96_LAYOUT } from './layout';
import { XONE96_LESSONS } from './lessons';
import { Xone96Engine } from './engine';

// Allen & Heath Xone:96 digital twin.
// Simplified honestly (see spec.ts header): no USB audio interface, MIDI, X:LINK,
// PHONES 2 / second cue, RTN C/D, MASTER 2 or booth EQ; the FX unit on SEND/RTN
// is built in; the built-in decks share one tempo (no pitch faders / beatmatching).
const xone96: DeviceModule = {
  spec: XONE96,
  layout: XONE96_LAYOUT,
  lessons: XONE96_LESSONS,
  createEngine: () => new Xone96Engine(),
  transportControl: 'play',
  uiControls: CHANNELS.map(c => `ch${c}_src`),
  tips: [
    'Press PLAY (or Space) to start all six built-in decks in sync. Pick what each channel plays in the DECK menus above the mixer, or LOAD FILE to loop your own audio on that channel\'s USB input.',
    'Drag faders and the crossfader with a mouse or finger; drag knobs up/down. Double-tap any control to reset it.',
    'Channels A and B default to RTN: SEND 1 goes to a tempo-synced delay returned on channel A, SEND 2 to a reverb returned on channel B (a built-in stand-in for the external FX unit you would plug in).',
    'A browser has one output, so YOU HEAR chooses MASTER, BOOTH or PHONES. Choose PHONES to hear what you CUE (CUE/MST blends cue with the mix; SPLIT puts cue left, mix right).',
    'Not modelled: the USB audio interface, MIDI, X:LINK, the second cue system (PHONES 2), returns C/D, MASTER 2, booth EQ and pitch faders - all decks share one tempo.',
  ],
};

export default xone96;
