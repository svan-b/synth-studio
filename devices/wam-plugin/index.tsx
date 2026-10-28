// ============================================================================
// Web Audio plugin: hosts a WAM 2 plugin (instrument or effect) as a studio
// instrument - or one of the two built-in plugins, which work offline. Notes
// from the keys, the computer keyboard and MIDI input go to the plugin; its own
// window opens in an overlay; its output routes like any twin. See
// lib/wam/host.ts, lib/wam/builtin.ts and docs/EXTERNAL_GEAR.md.
// ============================================================================

import { createElement } from 'react';
import type { DeviceSpec } from '@/types';
import type { PanelLayout } from '@/types/panel';
import type { DeviceModule } from '../types';
import { WamPluginEngine } from './engine';
import { initialWamData, migrateWamData } from './config';
import { PluginHeader, PluginMeterBox } from './ui';
import { WAM_PLUGIN_LESSONS } from './lessons';

const spec: DeviceSpec = {
  id: 'wam-plugin',
  name: 'Web Audio plugin',
  manufacturer: 'Bring your own',
  description: 'Hosts a WAM 2 (Web Audio Modules) plugin: a browser synth or effect',
  dimensions: { width: 240, height: 112 },
  display: { width: 960, height: 448, scale: 4 },
  signalFlow: [],
  controls: {
    level: {
      type: 'knob', label: 'LEVEL', min: -30, max: 12, default: 0, units: 'dB', bipolar: true,
      description: 'Output level of the plugin into the studio',
    },
    bypass: {
      type: 'button', label: 'BYPASS', default: false, ledColor: '#f59e0b',
      description: 'Effects: pass the IN signal through untouched (compare with and without the plugin)',
    },
  },
  patchBay: {
    inputs: [{ id: 'in', label: 'IN', jackType: 'input', signalType: 'audio', column: 0, row: 0 }],
    outputs: [{ id: 'out', label: 'OUT', jackType: 'output', signalType: 'audio', column: 1, row: 0 }],
  },
};

const layout: PanelLayout = {
  width: 240,
  height: 112,
  pxPerMm: 4,
  theme: {
    background: 'linear-gradient(180deg, #221d31 0%, #14111d 100%)',
    text: '#ece8f7',
    muted: '#a99fc4',
    accent: '#a78bfa',
    jack: { ring: '#6d5fa0', outputLabelBg: '#ece8f7', outputLabelText: '#14111d' },
  },
  elements: [
    { kind: 'custom', x: 6, y: 4, w: 228, h: 26, render: ctx => createElement(PluginHeader, ctx) },
    { kind: 'section', x: 6, y: 33, w: 228, h: 30, border: '1px solid #3a3150', radius: 2 },
    { kind: 'label', text: 'WEB AUDIO PLUGIN', x: 12, y: 41, size: 11, weight: 800, letterSpacing: 1.2, align: 'left' },
    { kind: 'label', text: 'WAM 2 host · built-in or web plugins', x: 12, y: 47, size: 7.5, weight: 500, color: '#a99fc4', align: 'left' },
    { kind: 'label', text: 'web plugins run third-party code', x: 12, y: 52, size: 7.5, weight: 500, color: '#a99fc4', align: 'left' },
    { kind: 'knob', control: 'level', x: 118, y: 49, diameter: 12, variant: 'moog-black', capColor: '#a78bfa' },
    { kind: 'button', control: 'bypass', x: 146, y: 49, shape: 'rect', w: 15, h: 11, color: '#2a2440', ledColor: '#f59e0b' },
    { kind: 'custom', x: 164, y: 36, w: 8, h: 24, render: ctx => createElement(PluginMeterBox, ctx) },
    { kind: 'jack', jack: 'in', x: 190, y: 50 },
    { kind: 'jack', jack: 'out', x: 216, y: 50 },
    { kind: 'keyboard', x: 6, y: 66, w: 228, h: 42, lowNote: 48, numKeys: 25 },
  ],
};

const wamPlugin: DeviceModule = {
  spec,
  layout,
  lessons: WAM_PLUGIN_LESSONS,
  createEngine: () => new WamPluginEngine(),
  keyboard: { lowNote: 48 },
  studio: { midiSync: true, stereo: true },
  data: { initial: initialWamData, migrate: migrateWamData },
  // Instruments play a riff; effects get a short groove into IN
  audition: api => {
    api.event('audition');
    return () => api.event('audition:stop');
  },
  tips: [
    'Choose plugin… starts with two built-in plugins that work offline (Studio Mono, Studio Echo), then known WAM 2 instruments and effects from the web, or paste the URL of any plugin\'s index.js. A web plugin runs its own code in this page, so only load ones you trust.',
    'Instruments play from the keys here, A-K on your computer keyboard and MIDI input (focused instrument). Effects: patch another instrument\'s output into IN, or press Test sound.',
    'Open plugin window shows the plugin\'s own controls. Closing it saves the plugin\'s settings with your project (when the plugin supports it).',
    'Its output routes like any twin in the Studio view, and with Sync to studio clock the plugin gets the studio tempo and play state - Studio Echo uses it to lock its repeats to the beat.',
  ],
};

export default wamPlugin;
