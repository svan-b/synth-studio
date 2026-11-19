// ============================================================================
// Light MIDI entry for UI that is always on screen: the toolbar MIDI button and
// DeviceHost. Status and labels come from the small modules; the full stack
// (router, clock in/out, Practice synth) loads right after first paint instead
// of in the first download.
// ============================================================================

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { midi, type MidiSnapshot } from './access';
import type { FocusSink } from './router';

export { midiLearnTouch, instanceLabel, controlLabel } from './learn';

type FullMidi = typeof import('./index');
let full: Promise<FullMidi> | null = null;

/** Load and start the full MIDI stack once */
export function loadMidi(): Promise<FullMidi> {
  full ??= import('./index').then(m => {
    m.initMidi();
    return m;
  });
  return full;
}

let serverSnapshot: MidiSnapshot | null = null;
const getServerSnapshot = () => (serverSnapshot ??= midi.getSnapshot());

/** Live MIDI status and port lists */
export function useMidiSnapshot(): MidiSnapshot {
  return useSyncExternalStore(midi.subscribe, midi.getSnapshot, getServerSnapshot);
}

/**
 * Route incoming MIDI notes to this instrument while it has focus, through the
 * host's own note handlers (so on-screen keys light up too). Same behaviour as
 * useMidiFocus in ./index, once the stack has loaded.
 */
export function useMidiFocus(
  instance: string,
  active: boolean,
  noteOn: (note: number, velocity?: number) => void,
  noteOff: (note: number) => void,
) {
  const handlers = useRef({ noteOn, noteOff });
  handlers.current = { noteOn, noteOff };
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    void loadMidi().then(m => {
      if (cancelled || !active) return;
      const sink: FocusSink = {
        instance,
        noteOn: (n, v) => handlers.current.noteOn(n, v),
        noteOff: n => handlers.current.noteOff(n),
      };
      release = m.midiRouter.pushFocus(sink);
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [instance, active]);
}
