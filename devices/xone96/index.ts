import type { ControlValue } from '@/types';
import type { DeviceModule, DeviceUiApi } from '../types';
import { XONE96 } from './spec';
import { currentLayout } from './layout';
import { XONE96_LESSONS } from './lessons';
import { Xone96Engine } from './engine';
import { CHANNELS, RETURNS, STUDIO_INPUTS, TYPE_MASK, typeOfMask } from './model';

// Allen & Heath Xone:96 digital twin - the studio mixer.
// Studio instruments route into CH 1-4 (LINE), CH A/B (RTN) and RTN C/D.
// Not modelled (see REFERENCE.md): the USB soundcards, MIDI, X:LINK, the master
// insert, the RECORD and AUDIO SYNC outputs, and the LN/PH and LN/Hi-Z switches.

const CUE_IDS = [...CHANNELS.map(c => `ch${c}_cue`), ...RETURNS.map(r => `rtn${r}_cue`)];

/** Filter type switches pressed together within this window combine (HPF + LPF = notch) */
const COMBINE_MS = 350;
const lastTypePress: Record<string, { v: number; t: number }> = {};

function interceptChange(id: string, value: ControlValue, api: DeviceUiApi): boolean {
  // AUTO-CUE (the hardware default, guide p.9): selecting a CUE cancels the others, unless LATCH CUE is lit
  if (value === true && CUE_IDS.includes(id) && !api.values.cue_latch) {
    CUE_IDS.forEach(c => { if (c !== id && api.values[c]) api.setValue(c, false); });
    return false;
  }
  const f = /^f([12])_type$/.exec(id);
  if (f && typeof value === 'number' && value <= 2) {
    const now = Date.now();
    const last = lastTypePress[f[1]];
    lastTypePress[f[1]] = { v: value, t: now };
    if (last && last.v !== value && now - last.t < COMBINE_MS) {
      const mask = (TYPE_MASK[Number(api.values[id] ?? 0)] ?? 0) | (TYPE_MASK[value] ?? 0);
      api.setValue(id, typeOfMask(mask));
      return true;
    }
  }
  return false;
}

const xone96: DeviceModule = {
  spec: XONE96,
  // Two arrangements of the same controls: the hardware panel, and a compact one for iPad landscape
  get layout() {
    return currentLayout();
  },
  lessons: XONE96_LESSONS,
  createEngine: () => new Xone96Engine(),
  worklets: ['/worklets/xone96-processors.js'],
  transportControl: 'play',
  uiControls: CHANNELS.map(c => `ch${c}_src`),
  interceptChange,
  studio: {
    mixerInputs: STUDIO_INPUTS.map(({ id, label }) => ({ id, label })),
    midiSync: true,
    stereo: true,
  },
  /** Lessons' "listen": the decks from bar 17, where every part of the tracks plays */
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'This is the studio mixer. In the Studio tab, set an instrument\'s Output to a Xone:96 channel: it plays through that channel\'s LINE input (RTN on A and B) instead of the built-in deck, and the strip shows STUDIO: its name.',
    'Press PLAY (Space) or the studio ▶: the built-in decks follow the studio tempo. Pick what each channel plays in the deck strip above the mixer, or LOAD FILE to loop your own audio on a channel\'s USB input.',
    'Set GAIN first with the fader down: the meter should average around 0 with peaks near +6. Then ride the faders. MASTER 1 is unity at 8.',
    'FILTER: assign channels with their FILTER switch, press ON (blue), pick HPF / BPF / LPF and sweep FREQ. Press two type switches together to combine them (HPF + LPF = notch, all three = all-pass).',
    'Channels A and B return the stand-in FX unit: SEND 1 → delay → channel A, SEND 2 → reverb → channel B. The sends leave before the filters, so the effects hear the unfiltered channel.',
    'A browser has one output, so YOU HEAR picks MASTER, BOOTH, PHONES (the MONITOR headphones, to hear what you CUE), PHONES 2 (the second cue system) or MST 2.',
    'MIC on channel A or B is a clean feed: the mic reaches MASTER 1 and 2 only. It skips the filters, and it never reaches the booth or the headphones\' MST blend.',
    'COMPACT VIEW (top of the deck strip) fits the EQ, faders and crossfader on an iPad screen; it turns on by itself on touch screens. Drag knobs up and down, double-tap to reset.',
  ],
};

export default xone96;
