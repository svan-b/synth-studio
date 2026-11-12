'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EngineState } from '@/types/panel';
import type { DeviceModule } from '@/devices/types';
import { hub, type AudioStatus } from './hub';

/** Audio status of the shared studio engine */
export function useAudioStatus(): { status: AudioStatus; error: string | null } {
  const status = useSyncExternalStore(
    l => hub.onStatusChange(l),
    () => hub.status,
    () => 'off' as AudioStatus,
  );
  return { status, error: hub.error };
}

/**
 * Load (or get the cached) device module. Always returns the module for the
 * *current* `device` (or null while it loads) - never the previous device's
 * module for one render after a switch, which would pair one instrument's
 * layout with another instrument's data.
 */
export function useDeviceModule(device: string | undefined): { module: DeviceModule | null; error: string | null } {
  const [, setVersion] = useState(0);
  const [error, setError] = useState<{ device: string; message: string } | null>(null);
  const mod = device ? hub.getModule(device) ?? null : null;
  useEffect(() => {
    if (!device || hub.getModule(device)) return;
    let alive = true;
    hub.loadModule(device)
      .then(() => alive && setVersion(v => v + 1))
      .catch(e => alive && setError({ device, message: String(e) }));
    return () => { alive = false; };
  }, [device]);
  return { module: mod, error: error && error.device === device ? error.message : null };
}

/** Live engine state (step, LEDs, meters) of an instance */
export function useEngineState(instance: string): EngineState {
  const [state, setState] = useState<EngineState>(() => hub.getState(instance));
  useEffect(() => hub.subscribeState(instance, setState), [instance]);
  return state;
}
