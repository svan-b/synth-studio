'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlValue, PatchConnection } from '@/types';
import type { EngineState } from '@/types/panel';
import type { SynthEngine } from './engine';
import { getAudioContext, getMasterBus, installAudioUnlock, loadWorklets, loadExtraWorklet, onAudioStateChange, resumeAudio } from './context';

export type AudioStatus = 'off' | 'starting' | 'on' | 'error';

/**
 * Owns one engine instance for the mounted device. Values and patches are pushed
 * into the engine as they change; the engine is only started (graph built) after
 * a user gesture has unlocked audio, then everything is replayed into it.
 */
export function useSynthEngine(
  createEngine: (() => SynthEngine) | null,
  values: Record<string, ControlValue>,
  patches: PatchConnection[],
  extraWorklets: string[] = [],
) {
  const workletsRef = useRef(extraWorklets);
  workletsRef.current = extraWorklets;
  const engineRef = useRef<SynthEngine | null>(null);
  const prevValues = useRef<Record<string, ControlValue>>({});
  const [status, setStatus] = useState<AudioStatus>('off');
  const [engineState, setEngineState] = useState<EngineState>({});
  const [error, setError] = useState<string | null>(null);
  const startingRef = useRef<Promise<void> | null>(null);
  const latest = useRef({ values, patches });
  latest.current = { values, patches };

  // Create / dispose engine with the device
  useEffect(() => {
    if (!createEngine) return;
    installAudioUnlock();
    const engine = createEngine();
    engineRef.current = engine;
    prevValues.current = {};
    Object.entries(latest.current.values).forEach(([k, v]) => engine.setParam(k, v));
    prevValues.current = { ...latest.current.values };
    engine.setPatches(latest.current.patches);

    let frame = 0;
    let pending: EngineState | null = null;
    const unsub = engine.subscribe(s => {
      pending = s;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) setEngineState(pending);
        });
      }
    });

    // If audio is already running (switching devices), start straight away
    const ctx = typeof window !== 'undefined' ? getAudioContext() : null;
    if (ctx && ctx.state === 'running') {
      startingRef.current = null;
      void start();
    } else {
      setStatus('off');
    }

    return () => {
      unsub();
      if (frame) cancelAnimationFrame(frame);
      engine.dispose();
      engineRef.current = null;
      startingRef.current = null;
      setEngineState({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createEngine]);

  useEffect(() => onAudioStateChange(running => {
    if (!running && engineRef.current) setStatus(s => (s === 'on' ? 'off' : s));
    if (running && engineRef.current && startingRef.current === null) void start();
    else if (running) setStatus(s => (s === 'off' ? 'on' : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const start = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (startingRef.current) return startingRef.current;
    setStatus('starting');
    const p = (async () => {
      try {
        await resumeAudio();
        await loadWorklets();
        await Promise.all(workletsRef.current.map(loadExtraWorklet));
        if (engineRef.current !== engine) return;
        engine.start(getAudioContext(), getMasterBus());
        setStatus('on');
        setError(null);
      } catch (e) {
        console.error('[audio] failed to start', e);
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
        startingRef.current = null;
      }
    })();
    startingRef.current = p;
    return p;
  }, []);

  // Push changed values
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const prev = prevValues.current;
    for (const k in values) {
      if (prev[k] !== values[k]) engine.setParam(k, values[k]);
    }
    prevValues.current = values;
  }, [values]);

  useEffect(() => {
    engineRef.current?.setPatches(patches);
  }, [patches]);

  /** Call from any user gesture - unlocks and starts audio if needed */
  const ensureAudio = useCallback(() => {
    // resume() must be invoked synchronously inside the gesture on iOS
    resumeAudio().catch(() => undefined);
    if (status !== 'on') void start();
  }, [status, start]);

  const sendEvent = useCallback((name: string, payload?: unknown) => engineRef.current?.event(name, payload), []);
  const noteOn = useCallback((n: number, v = 1) => engineRef.current?.noteOn(n, v), []);
  const noteOff = useCallback((n: number) => engineRef.current?.noteOff(n), []);

  return { status, error, engineState, ensureAudio, sendEvent, noteOn, noteOff };
}
