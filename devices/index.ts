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
];

export const getDeviceEntry = (id: string) => DEVICES.find(d => d.id === id);
