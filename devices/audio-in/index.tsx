// ============================================================================
// Audio input: your hardware (through an audio interface) as a studio
// instrument. Its output is routed like any twin - master, a mixer channel, or
// a cable into another instrument's input - and REC records it.
// Works on iPad Safari too (getUserMedia), where Web MIDI does not exist.
// ============================================================================

import { createElement } from 'react';
import type { DeviceSpec } from '@/types';
import type { PanelLayout } from '@/types/panel';
import type { DeviceModule } from '../types';
import { AudioInEngine } from './engine';
import { initialInputData, migrateInputData } from './config';
import { InputPanel, Meter } from './ui';

export const MODES = ['IN 1', 'IN 2', 'L+R', 'STEREO'];

const spec: DeviceSpec = {
  id: 'audio-in',
  name: 'Audio input',
  manufacturer: 'Bring your own',
  description: 'An audio interface input (or microphone) as a studio instrument',
  dimensions: { width: 124, height: 122 },
  display: { width: 422, height: 415, scale: 3.4 },
  signalFlow: [],
  controls: {
    gain: {
      type: 'knob', label: 'GAIN', min: -24, max: 24, default: 0, units: 'dB', bipolar: true,
      description: 'Input level into the studio. Set it so loud parts reach the yellow, never CLIP.',
    },
    mode: {
      type: 'switch', label: 'MODE', options: MODES, default: 0,
      description: 'IN 1 / IN 2: one input of your interface, in the middle (a mono synth). L+R: both summed. STEREO: input 1 left, input 2 right.',
    },
    mute: {
      type: 'button', label: 'MUTE', default: false, ledColor: '#ef4444',
      description: 'Silence the input (the meter keeps working). Mute if you already hear the synth through your interface\'s direct monitoring.',
    },
  },
  patchBay: {
    inputs: [],
    outputs: [
      { id: 'out_l', label: 'OUT L', jackType: 'output', signalType: 'audio', column: 0, row: 0 },
      { id: 'out_r', label: 'OUT R', jackType: 'output', signalType: 'audio', column: 1, row: 0 },
    ],
  },
};

const layout: PanelLayout = {
  width: 124,
  height: 122,
  pxPerMm: 3.4,
  theme: {
    background: 'linear-gradient(180deg, #2a241a 0%, #17130d 100%)',
    text: '#f3ead8',
    muted: '#b3a585',
    accent: '#f59e0b',
    jack: { ring: '#8a7650', outputLabelBg: '#f3ead8', outputLabelText: '#17130d' },
  },
  elements: [
    { kind: 'label', text: 'AUDIO INPUT', x: 62, y: 7.5, size: 13, weight: 800, letterSpacing: 1.5 },
    { kind: 'label', text: 'your gear → the studio', x: 62, y: 13, size: 7.5, color: '#b3a585', weight: 500 },
    { kind: 'custom', x: 5, y: 17, w: 114, h: 25, render: ctx => createElement(InputPanel, ctx) },
    { kind: 'custom', x: 5, y: 45, w: 114, h: 12, render: ctx => createElement(Meter, { instance: ctx.instance }) },
    { kind: 'section', x: 5, y: 61, w: 114, h: 34, border: '1px solid #3b3326', radius: 2 },
    { kind: 'knob', control: 'gain', x: 24, y: 78, diameter: 13, variant: 'moog-black', capColor: '#f59e0b' },
    { kind: 'switch', control: 'mode', x: 62, y: 78, style: 'rotary', scale: 1.2 },
    { kind: 'button', control: 'mute', x: 100, y: 78, shape: 'rect', w: 13, h: 8, color: '#2b251b', ledColor: '#ef4444' },
    { kind: 'jack', jack: 'out_l', x: 44, y: 111 },
    { kind: 'jack', jack: 'out_r', x: 80, y: 111 },
  ],
};

const audioIn: DeviceModule = {
  spec,
  layout,
  lessons: [],
  createEngine: () => new AudioInEngine(),
  studio: { stereo: true },
  data: { initial: initialInputData, migrate: migrateInputData },
  tips: [
    'Plug your synth\'s output into your audio interface, press Connect and pick the interface. Echo cancellation, noise suppression and auto gain are switched off, so you get the raw signal.',
    'MODE: a mono synth on input 1 -> IN 1 (it plays in the middle). A stereo source on inputs 1+2 -> STEREO.',
    'Route it like any instrument in the Studio view (Output), patch OUT L / OUT R into another instrument, and REC records it with everything else.',
    'Hearing the synth twice? Your interface\'s direct monitoring is on: turn it off, or press MUTE here.',
    'The panel shows the latency: input (Chrome reports it) + base + output. Sound from the hardware reaches your ears about that much later than the twins.',
    'Pair it with "Your synth (MIDI)" to play and sequence the hardware from the studio. On iPad, Audio input works even though Web MIDI does not.',
  ],
};

export default audioIn;
