'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { guitar, type AudioStatus } from '@/lib/guitar/audio/engine';
import { chordsKnown } from '@/lib/guitar/content/catalog';
import { listener, type ListenStatus } from '@/lib/guitar/input/listen';
import { useGuitar } from '@/lib/guitar/learn/store';
import { isNative, onVolume } from '@/lib/guitar/native/bridge';
import { dayKey, type Emitter } from '@/lib/guitar/util/emitter';

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
 * Listen through the microphone while this screen is up, and let it go when
 * the screen goes. Inside the iPad app it starts by itself. In a browser it
 * needs a tap the first time, so the caller shows a button while `ask` is true.
 *
 * `status.state` is `listening` only while the microphone is open. It is
 * `resting` while the app plays an example, when the microphone steps aside.
 */
export function useListening(active = true): { status: ListenStatus; start: () => void; ask: boolean } {
  const status = useListenStatus();
  useEffect(() => {
    if (!active) return;
    const release = listener.use();
    if (isNative()) void listener.start(false);
    return release;
  }, [active]);
  return { status, start: () => void listener.start(false), ask: micAsks(status) };
}

/** Must the learner do something before the app can listen: tap to start, or allow the microphone? Not while it is only starting, or resting for an example. */
export function micAsks(status: ListenStatus): boolean {
  return status.state === 'denied' || status.state === 'error' || (status.state === 'idle' && !listener.agreedTo);
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

/**
 * Time spent with an activity open. It is reported as it goes, not only at
 * the end: every half minute, whenever the app is put away, and when the
 * activity closes. So minutes played are kept even if the iPad is closed in
 * the middle of a song and the app never comes back, and they land on the
 * day they were played. Time with the app hidden is left out.
 *
 * `first` is true for the first report of an activity, for counting it once.
 */
export function usePracticeTimer(onReport: (seconds: number, first: boolean) => void): void {
  const ref = useRef(onReport);
  ref.current = onReport;
  useEffect(() => {
    let since: number | null = document.visibilityState === 'hidden' ? null : performance.now();
    let first = true;
    const report = () => {
      if (since === null) return;
      const now = performance.now();
      const seconds = Math.max(0, (now - since) / 1000);
      since = now;
      ref.current(seconds, first);
      first = false;
    };
    const away = () => {
      report();
      since = null;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') away();
      else if (since === null) since = performance.now();
    };
    const tick = setInterval(report, 30000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', away);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', away);
      report();
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

/** Today's date, kept current: it moves on at midnight and when the app comes back to the front. */
export function useToday(): string {
  const [today, setToday] = useState(dayKey);
  useEffect(() => {
    const check = () => setToday((d) => (d === dayKey() ? d : dayKey()));
    const timer = setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
