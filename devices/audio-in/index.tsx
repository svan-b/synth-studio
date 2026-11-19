// ============================================================================
// Audio input: your hardware (through an audio interface) as a studio
// instrument. Its output is routed like any twin - master, a mixer channel, or
// a cable into another instrument's input - and REC records it; "Record take"
// records the input alone. Works on iPad Safari too (getUserMedia), where Web
// MIDI does not exist. With no gear, the built-in Practice synth or a line-up
// tone stand in for the interface.
// ============================================================================

import { createElement } from 'react';
import type { DeviceSpec } from '@/types';
import type { PanelLayout } from '@/types/panel';
import type { DeviceModule } from '../types';
import { AudioInEngine } from './engine';
import { MODES, initialInputData, migrateInputData } from './config';
import { InputHeader, LatencyBox, LevelCheck, MeterBox, ModeSelector, RouteRecord, SourcePicker } from './ui';
import { AUDIO_IN_LESSONS } from './lessons';

export { MODES } from './config';

const spec: DeviceSpec = {
  id: 'audio-in',
  name: 'Audio input',
  manufacturer: 'Bring your own',
  description: 'An audio interface input (or microphone) as a studio instrument',
  dimensions: { width: 200, height: 131 },
  display: { width: 800, height: 524, scale: 4 },
  signalFlow: [],
  controls: {
    gain: {
      type: 'knob', label: 'GAIN', min: -24, max: 24, default: 0, units: 'dB', bipolar: true,
      description: 'Input level into the studio. Set it so the loudest parts peak around -12 dBFS (the green zone) and never CLIP.',
    },
    mode: {
      type: 'switch', label: 'MODE', options: MODES, default: 0,
      description: 'IN 1 / IN 2: one input of your interface, in the middle (a mono synth). L+R: both summed. STEREO: input 1 left, input 2 right.',
    },
    mute: {
      type: 'button', label: 'MUTE', default: false, ledColor: '#ef4444',
      description: 'Silence the input in the studio (the meter and takes keep working). Mute when you monitor directly through your interface.',
    },
  },
  patchBay: {
    inputs: [],
    outputs: [
      { id: 'out_l', label: 'OUT L', jackType: 'output', signalType: 'audio', column: 0, row: 0 },
      { id: 'out_r', label: 'OUT R', jackType: 'output', signalType: 'audio', column: 1, row: 0 },
    ],
  },
  presets: {
    'mono-in1': { name: 'Setup / Mono synth on input 1', source: 'factory', description: 'Most mono synths: one cable into input 1, heard in the middle.', settings: { mode: 0, gain: 0, mute: false } },
    'mono-in2': { name: 'Setup / Mono synth on input 2', source: 'factory', description: 'A second synth on input 2 (add another Audio input for the one on input 1).', settings: { mode: 1, gain: 0, mute: false } },
    stereo: { name: 'Setup / Stereo synth on inputs 1 + 2', source: 'factory', description: 'Left output into input 1, right into input 2.', settings: { mode: 3, gain: 0, mute: false } },
    summed: { name: 'Setup / Two inputs summed to mono (L+R)', source: 'factory', description: 'Both inputs mixed together in the middle.', settings: { mode: 2, gain: 0, mute: false } },
    direct: { name: 'Monitoring / Direct monitoring through the interface', source: 'factory', description: 'You hear the synth from your interface with no delay; the studio stays silent but meters and records.', settings: { mute: true } },
    studio: { name: 'Monitoring / Monitor through the studio', source: 'factory', description: 'Hear the input through the studio (mixer, effects); turn your interface\'s direct monitoring off.', settings: { mute: false } },
  },
};

const layout: PanelLayout = {
  width: 200,
  height: 131,
  pxPerMm: 4,
  theme: {
    background: 'linear-gradient(180deg, #2a241a 0%, #17130d 100%)',
    text: '#f3ead8',
    muted: '#b3a585',
    accent: '#f59e0b',
    jack: { ring: '#8a7650', outputLabelBg: '#f3ead8', outputLabelText: '#17130d' },
  },
  elements: [
    { kind: 'custom', x: 5, y: 3, w: 190, h: 14, render: ctx => createElement(InputHeader, ctx) },
    { kind: 'custom', x: 5, y: 19.5, w: 123, h: 26.5, render: ctx => createElement(SourcePicker, ctx) },
    { kind: 'custom', x: 130.5, y: 19.5, w: 64.5, h: 26.5, render: ctx => createElement(LatencyBox, ctx) },
    { kind: 'custom', x: 5, y: 48.5, w: 190, h: 17, render: ctx => createElement(MeterBox, ctx) },
    { kind: 'section', x: 5, y: 68.5, w: 93, h: 41, border: '1px solid #3b3326', radius: 2 },
    { kind: 'knob', control: 'gain', x: 17, y: 90.5, diameter: 14, variant: 'moog-black', capColor: '#f59e0b' },
    // MODE is how your synth is cabled to the interface: a big 2 x 2 selector (uiControls below)
    { kind: 'custom', x: 28, y: 71.5, w: 47, h: 36, render: ctx => createElement(ModeSelector, ctx) },
    { kind: 'button', control: 'mute', x: 86, y: 90.5, shape: 'rect', w: 15, h: 11.5, color: '#2b251b', ledColor: '#ef4444' },
    { kind: 'custom', x: 100.5, y: 68.5, w: 94.5, h: 41, render: ctx => createElement(LevelCheck, ctx) },
    { kind: 'custom', x: 5, y: 112.5, w: 147, h: 15, render: ctx => createElement(RouteRecord, ctx) },
    { kind: 'jack', jack: 'out_l', x: 163, y: 122 },
    { kind: 'jack', jack: 'out_r', x: 183, y: 122 },
  ],
};

const audioIn: DeviceModule = {
  spec,
  layout,
  lessons: AUDIO_IN_LESSONS,
  createEngine: () => new AudioInEngine(),
  studio: { stereo: true },
  // MODE describes the cabling (which interface inputs your synth uses), not the sound: Reset leaves it alone
  uiControls: ['mode'],
  data: { initial: initialInputData, migrate: migrateInputData },
  // "Hear it" in lessons: a phrase from the Practice synth when this input plays it
  audition: api => { api.event('audition'); },
  tips: [
    'Plug your synth\'s output into your audio interface, choose Interface / mic and press Connect. Echo cancellation, noise suppression and auto gain are switched off, so you get the raw signal.',
    'No gear? Choose Practice synth (play it from Your synth (MIDI)) or Test tone: everything else works the same.',
    'Set GAIN so the loudest parts peak around -12 dBFS (the green zone). Check level listens for 5 seconds and tells you how far to move GAIN. CLIP stays lit until you tap it; IN means it clipped in your interface.',
    'MODE: a mono synth on input 1 -> IN 1 (it plays in the middle). A stereo source on inputs 1+2 -> STEREO.',
    'OUTPUT sends it to the master or a mixer channel. Record take saves this input alone as a WAV (and starts the studio); REC in the top bar records the whole mix.',
    'Hearing the synth twice? Your interface\'s direct monitoring is on: turn it off, or press MUTE here (MUTE still meters and records).',
    'Latency: in + base + out is how much later the hardware reaches your ears than the twins. Lower your interface\'s buffer size if you can feel it.',
  ],
};

export default audioIn;
