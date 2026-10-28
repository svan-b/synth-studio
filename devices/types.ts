// ============================================================================
// Device module contract
// Each instrument lives in devices/<id>/ and default-exports a DeviceModule.
// ============================================================================

import type { DeviceSpec, Lesson } from '@/types';
import type { PanelLayout } from '@/types/panel';
import type { SynthEngine } from '@/lib/audio/engine';

export interface DeviceModule {
  spec: DeviceSpec;
  layout: PanelLayout;
  lessons: Lesson[];
  createEngine: () => SynthEngine;
  /** Playable instruments: lowest MIDI note for the computer-keyboard mapping (A = lowNote) */
  keyboard?: { lowNote: number };
  /**
   * Controls that hold UI navigation state (selected track, page, mode) rather
   * than sound settings. Reset leaves them alone and presets don't need them.
   */
  uiControls?: string[];
  /** Short "how to play this thing" hints shown under the panel */
  tips?: string[];
  /** Toggle control that the Space bar flips (e.g. RUN/STOP, PLAY) */
  transportControl?: string;
}

export interface DeviceEntry {
  id: string;
  name: string;
  manufacturer: string;
  category: 'Percussion' | 'Synthesizer' | 'Groovebox' | 'DJ Mixer';
  tagline: string;
  load: () => Promise<{ default: DeviceModule }>;
}
