'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { guitar, type AudioStatus } from '@/lib/guitar/audio/engine';
import { chordsKnown } from '@/lib/guitar/content/catalog';
import { listener, type ListenStatus } from '@/lib/guitar/input/listen';
import { useGuitar } from '@/lib/guitar/learn/store';
import { audioListening, isNative, onVolume } from '@/lib/guitar/native/bridge';
import type { Emitter } from '@/lib/guitar/util/emitter';

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
  return useEmitted(guitar.status, () => guitar.getStatus());
}

export function useListenStatus(): ListenStatus {
  return useEmitted(listener.status, () => listener.getStatus());
}

/**
 * Listen through the microphone while this screen is up. Inside the iPad app
 * it starts by itself. In a browser it needs a tap the first time, so the
 * caller shows a button when `state` is idle.
 */
export function useListening(active = true): { status: ListenStatus; start: () => void } {
  const status = useListenStatus();
  useEffect(() => {
    if (!active) return;
    if (isNative() || listener.getStatus().state === 'listening') void listener.start();
  }, [active]);
  useEffect(() => {
    if (status.state === 'listening') audioListening(true);
  }, [status.state]);
  return { status, start: () => void listener.start() };
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
        void guitar.resume();
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

/** The theme setting, resolved against the system's. */
export function useTheme(): 'light' | 'dark' {
  const choice = useGuitar((s) => s.settings.theme);
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

/** Push stored settings into the sound engine. */
export function useApplySettings(): void {
  const settings = useGuitar((s) => s.settings);
  useEffect(() => {
    guitar.setVolume(settings.volume);
    guitar.setClickVolume(settings.clickVolume);
  }, [settings]);
}

/** Time to read a line of instruction before the music it introduces begins, in milliseconds. */
export function readingMs(text: string): number {
  return Math.min(6000, Math.max(1500, 400 + text.length * 52));
}

/** Seconds spent with an activity open, reported when it closes. Time with the app hidden is left out. */
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

/** The chords the learner has been taught, for the chord check to compare a strum with. */
export function useKnownChords(): string[] {
  const lessons = useGuitar((s) => s.lessons);
  return useMemo(() => chordsKnown((id) => lessons[id]?.done === true), [lessons]);
}

/** The iPad's output volume from 0 to 1, inside the iPad app. Null where it cannot be known. */
export function useDeviceVolume(): number | null {
  const [volume, setVolume] = useState<number | null>(null);
  useEffect(() => onVolume(setVolume), []);
  return volume;
}
