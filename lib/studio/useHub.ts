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

/** Load (or get the cached) device module */
export function useDeviceModule(device: string | undefined): { module: DeviceModule | null; error: string | null } {
  const [module, setModule] = useState<DeviceModule | null>(() => (device ? hub.getModule(device) ?? null : null));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!device) return;
    let alive = true;
    const cached = hub.getModule(device);
    if (cached) {
      setModule(cached);
      return;
    }
    setModule(null);
    hub.loadModule(device).then(m => alive && setModule(m)).catch(e => alive && setError(String(e)));
    return () => { alive = false; };
  }, [device]);
  return { module, error };
}

/** Live engine state (step, LEDs, meters) of an instance */
export function useEngineState(instance: string): EngineState {
  const [state, setState] = useState<EngineState>(() => hub.getState(instance));
  useEffect(() => hub.subscribeState(instance, setState), [instance]);
  return state;
}
