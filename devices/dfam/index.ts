import type { DeviceModule } from '../types';
import { DFAM } from './spec';
import { DFAM_LAYOUT } from './layout';
import { DFAM_LESSONS } from './lessons';
import { DfamEngine } from './engine';

const dfam: DeviceModule = {
  spec: DFAM,
  layout: DFAM_LAYOUT,
  lessons: DFAM_LESSONS,
  createEngine: () => new DfamEngine(),
  worklets: ['/worklets/dfam-processors.js'],
  transportControl: 'run_stop',
  // No MIDI on the DFAM: it syncs by patching a clock (Studio Clock CLOCK OUT) into ADV / CLOCK
  studio: { midiSync: false },
  /**
   * Lessons' "listen to the target": the sequence from step 1 at the current TEMPO.
   * If the DFAM is already running it simply keeps playing with the target settings.
   */
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'TRIGGER plays the current step. RUN / STOP (or the Space bar) plays the 8-step sequence; ADVANCE moves one step without playing it.',
    'Silent TRIGGER? The current step\'s VELOCITY is probably at 0 - TRIGGER plays at that step\'s velocity, just like the hardware.',
    'Patch: tap an output jack (white label), then an input - or drag between them. Tap a cable to unplug it.',
    'Clock it from the studio: patch Studio Clock CLOCK into ADV / CLOCK, press RUN / STOP (the DFAM waits for pulses), then press ▶. Park it on step 8 with ADVANCE so it starts on step 1.',
    'The PITCH knobs span ten octaves, shown in semitones (st). Hold Shift while dragging (desktop) for fine tuning. Double-tap any knob to reset it.',
  ],
};

export default dfam;
