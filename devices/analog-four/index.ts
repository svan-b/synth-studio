// ============================================================================
// Elektron Analog Four MKII - device module
// ============================================================================

import type { DeviceModule } from '../types';
import { ANALOG_FOUR } from './spec';
import { ANALOG_FOUR_LAYOUT } from './layout';
import { ANALOG_FOUR_LESSONS } from './lessons';
import { AnalogFourEngine } from './engine';

const analogFour: DeviceModule = {
  spec: ANALOG_FOUR,
  layout: ANALOG_FOUR_LAYOUT,
  lessons: ANALOG_FOUR_LESSONS,
  createEngine: () => new AnalogFourEngine(),
  keyboard: { lowNote: 48 },
  transportControl: 'play',
  uiControls: ['track', 'page', 'lock_step', 'grid_rec', 'func'],
  worklets: ['/worklets/analog-four-processors.js'],
  tips: [
    'Pick a track with TRK 1-4 (FX = effects), a page with the PARAMETER keys, then turn encoders A-J - the screen shows what each one does. Press a lit OSC 1 / FILTER / LFO key again for NOISE / ENV / LFO 2.',
    'Trig keys: tap to add or remove a trig. Hold a trig and turn an encoder to parameter-lock that step (on the TRIG page, NOTE locks give each step its own pitch). With a mouse, hold a trig for half a second to latch it, tap it again when done; double-tap an orange encoder to remove a lock.',
    'Space = PLAY/STOP. Keys A-K play the selected track. FUNC (latching here) turns trig keys 1-4 into track mutes; REC off makes trig keys audition steps instead of editing.',
    'Simplified from the hardware: one 16-step pattern per kit (PATTERN/BANK and song mode not modelled), no ENV 2, no OSC 1&2 common page (AM, sync, bend, slide), EnvA shapes reduced to EXP/LIN, no CV track, FX EXT IN or FX LFO pages, up to 6 locks per trig. Value-to-Hz/seconds curves are approximations.',
  ],
};

export default analogFour;
