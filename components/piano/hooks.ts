'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { piano, type AudioStatus } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import { input, type InputMode, type RemoteAction } from '@/lib/piano/input/hub';
import { listener, type ListenStatus } from '@/lib/piano/input/listen';
import { midi, type MidiStatus } from '@/lib/piano/input/midi';
import { usePiano } from '@/lib/piano/learn/store';
import type { Emitter } from '@/lib/piano/util/emitter';

/** Follow a status emitter as React state. */
export function useEmitted<T>(emitter: Emitter<T>, initial: () => T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    setValue(initial());
    return emitter.subscribe(setValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitter]);
  return value;
}

export function useAudioStatus(): AudioStatus {
  return useEmitted(piano.status, () => piano.getStatus());
}

export function useMidiStatus(): MidiStatus {
  return useEmitted(midi.status, () => midi.getStatus());
}

export function useListenStatus(): ListenStatus {
  return useEmitted(listener.status, () => listener.getStatus());
}

/** How the learner is playing right now. */
export function useInputMode(): InputMode {
  const m = useMidiStatus();
  const l = useListenStatus();
  return useMemo(() => {
    void m;
    void l;
    return input.mode;
  }, [m, l]);
}

/**
 * Let the piano drive the screen. The top key or the middle pedal is
 * "primary" (continue), the bottom key or the left pedal is "secondary"
 * (again, or back). Only the most recently mounted listener responds.
 */
const remoteStack: Array<{ id: number }> = [];
let remoteSeq = 0;

export function useRemote(handlers: { primary?: () => void; secondary?: () => void }, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const entry = { id: ++remoteSeq };
    remoteStack.push(entry);
    const unsub = input.remote.subscribe((action: RemoteAction) => {
      if (remoteStack[remoteStack.length - 1] !== entry) return;
      if (action === 'primary') ref.current.primary?.();
      else ref.current.secondary?.();
    });
    return () => {
      unsub();
      const i = remoteStack.indexOf(entry);
      if (i >= 0) remoteStack.splice(i, 1);
    };
  }, [enabled]);
}

/** Keep the screen awake while practising. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (!nav.wakeLock || document.visibilityState !== 'visible') return;
        const s = await nav.wakeLock.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* not supported or not allowed */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
        void piano.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Resolve the theme setting against the system preference. */
export function useTheme(): 'light' | 'dark' {
  const choice = usePiano((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return choice === 'auto' ? (systemDark ? 'dark' : 'light') : choice;
}

/** Push stored settings into the sound and input engines. */
export function useApplySettings(): void {
  const settings = usePiano((s) => s.settings);
  useEffect(() => {
    piano.setPianoVolume(settings.pianoVolume);
    piano.setClickVolume(settings.clickVolume);
    instrument.preferPiano = settings.demoOnPiano;
    input.remoteKeys = settings.remoteKeys;
    input.remotePedals = settings.remotePedals;
  }, [settings]);
}

/** Seconds spent with an activity open, reported when it closes. */
export function usePracticeTimer(onDone: (seconds: number) => void): void {
  const ref = useRef(onDone);
  ref.current = onDone;
  useEffect(() => {
    const start = performance.now();
    let hidden = 0;
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = performance.now();
      else if (hiddenAt !== null) {
        hidden += performance.now() - hiddenAt;
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      ref.current(Math.max(0, (performance.now() - start - hidden) / 1000));
    };
  }, []);
}

/** Element size, for layouts that depend on it. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize((p) => (Math.abs(p.w - r.width) > 1 || Math.abs(p.h - r.height) > 1 ? { w: r.width, h: r.height } : p));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
