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
  transportControl: 'run_stop',
  tips: [
    'Press TRIGGER to hear one hit, or RUN/STOP (Space bar) to play the 8-step sequence.',
    'Patch: tap an output jack, then tap an input (or drag between them). Tap a cable to unplug it.',
    'Double-tap any knob to return it to its default.',
  ],
};

export default dfam;
