import type { DeviceModule } from '../types';
import { SUBHARMONICON } from './spec';
import { SUBHARMONICON_LAYOUT } from './layout';
import { SUBHARMONICON_LESSONS } from './lessons';
import { SubharmoniconEngine } from './engine';

export const spec = SUBHARMONICON;
export const layout = SUBHARMONICON_LAYOUT;
export const lessons = SUBHARMONICON_LESSONS;
export const createEngine = () => new SubharmoniconEngine();
export const transportControl = 'play';
export const tips = [
  'PLAY (Space) starts the sequencers. Each RHYTHM knob divides TEMPO by 1-16; its SEQ 1 / SEQ 2 buttons choose which sequencer it clocks. Two rhythms on two sequencers = a polyrhythm.',
  'SUB FREQ knobs divide their VCO by a whole number (÷1 fully clockwise … ÷16). Hold EG until it blinks (HELD) for a drone to tune chords by ear.',
  'QUANTIZE and SEQ OCT: press the button to cycle, or tap an LED legend. EG: tap = ON/OFF, press and hold = HELD.',
  'Patch: tap an output (white label) then an input, or drag. Tap a cable to unplug. Inserting a cable breaks the normal (VCF EG → CUTOFF, VCA EG → VCA, SUB 1 → PWM, VCO 1 → VCO 2 pitch).',
  'Simplified: MIDI IN is not connected - the computer keyboard (A-K) stands in for it, transposing both VCOs from Middle C and gating the envelopes. RHYTHM LOGIC is a global/MIDI setting on the hardware, shown here as a switch. CV into SUB and RHYTHM inputs shifts divisions by about 1.5 per volt (approximate scaling).',
];
export const worklets = ['/worklets/subharmonicon-processors.js'];

const subharmonicon: DeviceModule = {
  spec,
  layout,
  lessons,
  createEngine,
  transportControl,
  tips,
  worklets,
  keyboard: { lowNote: 60 },
};

export default subharmonicon;
