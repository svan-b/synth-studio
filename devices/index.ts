// ============================================================================
// Device registry
// Modules are code-split: each instrument (spec, layout, lessons, DSP) loads
// only when it is selected.
// ============================================================================

import type { DeviceEntry } from './types';

export const DEVICES: DeviceEntry[] = [
  {
    id: 'dfam',
    name: 'DFAM',
    manufacturer: 'Moog',
    category: 'Percussion',
    tagline: 'Semi-modular analog percussion synthesizer',
    load: () => import('./dfam'),
  },
  {
    id: 'mother32',
    name: 'Mother-32',
    manufacturer: 'Moog',
    category: 'Synthesizer',
    tagline: 'Semi-modular analog synth with 32-step sequencer',
    load: () => import('./mother32'),
  },
  {
    id: 'subharmonicon',
    name: 'Subharmonicon',
    manufacturer: 'Moog',
    category: 'Synthesizer',
    tagline: 'Polyrhythmic analog synth built on subharmonic oscillators',
    load: () => import('./subharmonicon'),
  },
  {
    id: 'sub37',
    name: 'Sub 37',
    manufacturer: 'Moog',
    category: 'Synthesizer',
    tagline: 'Paraphonic analog keyboard synth with 2 ADSRs and Multidrive',
    load: () => import('./sub37'),
  },
  {
    id: 'analog-four',
    name: 'Analog Four MKII',
    manufacturer: 'Elektron',
    category: 'Groovebox',
    tagline: 'Four-voice analog synth with parameter-lock sequencer',
    load: () => import('./analog-four'),
  },
  {
    id: 'analog-rytm',
    name: 'Analog Rytm MKII',
    manufacturer: 'Elektron',
    category: 'Groovebox',
    tagline: 'Eight-voice analog drum machine with 12 pads',
    load: () => import('./analog-rytm'),
  },
  {
    id: 'xone96',
    name: 'Xone:96',
    manufacturer: 'Allen & Heath',
    category: 'DJ Mixer',
    tagline: 'Analog DJ mixer with dual VCF filters and FX sends',
    load: () => import('./xone96'),
  },
  {
    id: 'studio-clock',
    name: 'Studio Clock',
    manufacturer: 'Synth Studio',
    category: 'Studio',
    tagline: 'The studio tempo as patchable clock, reset and run voltages',
    silent: true,
    load: () => import('./studio-clock'),
  },
  // ---- External: bring your own gear (docs/EXTERNAL_GEAR.md) ----
  {
    id: 'midi-synth',
    name: 'Your synth (MIDI)',
    manufacturer: 'Bring your own',
    category: 'External',
    tagline: 'Play, sequence and tweak a hardware synth over MIDI, with templates from midi.guide',
    load: () => import('./midi-synth'),
  },
  {
    id: 'audio-in',
    name: 'Audio input',
    manufacturer: 'Bring your own',
    category: 'External',
    tagline: 'Hear and record your gear through an audio interface input',
    load: () => import('./audio-in'),
  },
  {
    id: 'wam-plugin',
    name: 'Web Audio plugin',
    manufacturer: 'Bring your own',
    category: 'External',
    tagline: 'Host a WAM 2 browser synth or effect',
    load: () => import('./wam-plugin'),
  },
];

export const getDeviceEntry = (id: string) => DEVICES.find(d => d.id === id);
