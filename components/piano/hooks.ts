'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { piano, type AudioStatus } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import { input, type InputMode, type RemoteAction } from '@/lib/piano/input/hub';
import { listener, type ListenStatus } from '@/lib/piano/input/listen';
import { midi, type MidiStatus } from '@/lib/piano/input/midi';
import { usePiano } from '@/lib/piano/learn/store';
import { noteBus } from '@/lib/piano/input/bus';
import { isNative, keepAwake, onSound, onWake, type SoundInfo } from '@/lib/piano/native/bridge';
import { dayKey, type Emitter } from '@/lib/piano/util/emitter';

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

/** Where the iPad's own sound is going, inside the iPad app. Null in a browser. */
export function useSound(): SoundInfo | null {
  const [info, setInfo] = useState<SoundInfo | null>(null);
  useEffect(() => onSound(setInfo), []);
  return info;
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
/** Until this moment the piano's buttons are not acted on. */
let remoteQuietUntil = 0;

/** How long after the screen changes hands before a press counts: a press already on its way was meant for what was there before. */
const QUIET_AFTER_CHANGE = 450;
/** Longer where the screen moved on by itself, since nobody chose the moment. */
export const QUIET_AFTER_AUTO = 750;

/**
 * Have the piano's buttons ignored for a moment. Called where the screen has
 * just changed under the learner's hands, so that a press meant for the old
 * screen is not taken by the new one.
 */
export function quietRemote(ms: number = QUIET_AFTER_AUTO): void {
  remoteQuietUntil = Math.max(remoteQuietUntil, performance.now() + ms);
}

/** How long a screen that closes something stays before a press can take it away: it is there to be seen. */
export const QUIET_ON_CLOSING = 900;

/** Quiet the piano's buttons for a moment when this screen appears, or when `key` changes. */
export function useQuietRemote(key: unknown = null, ms: number = QUIET_ON_CLOSING, on = true): void {
  useEffect(() => {
    if (on) quietRemote(ms);
  }, [key, ms, on]);
}

export function useRemote(
  handlers: {
    primary?: () => void;
    secondary?: () => void;
    /** On a screen with no music, the right pedal means continue as well. */
    pedal?: boolean;
  },
  enabled = true,
): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const entry = { id: ++remoteSeq };
    remoteStack.push(entry);
    // Something new has come to the front.
    quietRemote(QUIET_AFTER_CHANGE);
    const unsub = input.remote.subscribe((action: RemoteAction) => {
      if (remoteStack[remoteStack.length - 1] !== entry) return;
      if (performance.now() < remoteQuietUntil) return;
      if (action === 'primary' || (action === 'pedal' && ref.current.pedal)) ref.current.primary?.();
      else if (action === 'secondary') ref.current.secondary?.();
    });
    return () => {
      unsub();
      const i = remoteStack.indexOf(entry);
      const wasTop = i === remoteStack.length - 1;
      if (i >= 0) remoteStack.splice(i, 1);
      // What was behind it is in front again.
      if (wasTop) quietRemote(QUIET_AFTER_CHANGE);
    };
  }, [enabled]);
}

/**
 * The words under a button that name the key or pedal doing the same thing.
 * They follow Settings: with the end keys or the pedals switched off as
 * buttons, nothing is promised that will not happen.
 */
export function useHints(): { top?: string; bottom?: string; onward?: string } {
  const mode = useInputMode();
  const keys = usePiano((s) => s.settings.remoteKeys);
  const pedals = usePiano((s) => s.settings.remotePedals);
  if (mode !== 'midi') return {};
  return {
    top: keys ? 'top key' : undefined,
    bottom: keys ? 'bottom key' : undefined,
    // On a page with no music the right pedal goes on as well.
    onward: keys && pedals ? 'top key or right pedal' : keys ? 'top key' : pedals ? 'right pedal' : undefined,
  };
}

/** Keep the screen awake while practising. */
export function useWakeLock(active: boolean): void {
  // Inside the iPad app the app itself keeps the screen on, for as long as the page asks.
  useEffect(() => {
    if (!active || !isNative()) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [active]);
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
    instrument.where = settings.demoChosen ? (settings.demoOnPiano ? 'piano' : 'ipad') : 'auto';
    midi.rememberTouch(settings.touchLevel);
    input.remoteKeys = settings.remoteKeys;
    input.remotePedals = settings.remotePedals;
  }, [settings]);

  // How firmly the learner plays is kept from day to day, so the app's own playing matches from the first note.
  const setSettings = usePiano((s) => s.setSettings);
  useEffect(() => {
    const t = setInterval(() => {
      const now = midi.typicalTouch;
      const kept = usePiano.getState().settings.touchLevel ?? 0;
      if (now !== null && Math.abs(now - kept) > 0.03) setSettings({ touchLevel: Math.round(now * 100) / 100 });
    }, 20000);
    return () => clearInterval(t);
  }, [setSettings]);

  // Inside the iPad app, the iPad says where its sound is going and how long it takes to get there.
  useEffect(() => onSound((info) => piano.setDeviceDelay(info ? info.delayMs / 1000 : null)), []);
}

/**
 * How long to leave a line of instruction on screen before the music it
 * introduces begins, in milliseconds. Paced for an unhurried reader, and
 * never so long that a short line leaves the learner waiting.
 */
export function readingMs(text: string): number {
  return Math.min(6000, Math.max(1500, 400 + text.length * 52));
}

/** How long with no key played and no tap before the time stops counting: the learner has walked away. */
const IDLE_MS = 150_000;
/** How often the time is written down, so that a reload, or the app closed, loses no more than this. */
const SLICE_MS = 30_000;

/**
 * Count the time spent with an activity open, as practice. It is written
 * down as it goes, each part on the day it was spent, so time is not lost
 * when the page goes away and an evening's practice is not put on the next
 * morning. Time with the app out of sight does not count, nor time after the
 * learner has stopped playing and gone. `notes` gives the keys played so far.
 */
export function usePracticeTimer(notes?: () => number): void {
  const notesRef = useRef(notes);
  notesRef.current = notes;
  useEffect(() => {
    let from = performance.now();
    let lastSign = from;
    let visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let counted = false;
    let notesLogged = 0;
    const write = () => {
      const now = performance.now();
      // Only time in view, and no more than the idle limit after the last sign of the learner.
      const until = Math.min(now, lastSign + IDLE_MS);
      const seconds = visible ? Math.max(0, (until - from) / 1000) : 0;
      from = now;
      const played = notesRef.current?.() ?? 0;
      const more = Math.max(0, played - notesLogged);
      notesLogged = played;
      if (seconds <= 0 && more === 0 && counted) return;
      usePiano.getState().logPractice(seconds, more, counted ? 0 : 1);
      counted = true;
    };
    const sign = () => {
      const now = performance.now();
      // Back after a while away: what came before was written down up to the idle limit, and the count starts again now.
      if (now - lastSign > IDLE_MS) {
        write();
        from = now;
      }
      lastSign = now;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        write();
        visible = false;
      } else {
        visible = true;
        from = performance.now();
        lastSign = from;
      }
    };
    const unsubNotes = noteBus.subscribe((ev) => {
      if (ev.type === 'on') sign();
    });
    const timer = setInterval(write, SLICE_MS);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', write);
    window.addEventListener('pointerdown', sign, true);
    window.addEventListener('keydown', sign, true);
    return () => {
      clearInterval(timer);
      unsubNotes();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', write);
      window.removeEventListener('pointerdown', sign, true);
      window.removeEventListener('keydown', sign, true);
      write();
    };
  }, []);
}

/**
 * Today, as YYYY-MM-DD, kept current. It turns at midnight, and is looked at
 * again whenever the app comes back to the front, as after a night with the
 * iPad locked and the app still open.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      setToday(dayKey());
      if (timer) clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      // Timers sleep with the page, so an hour at most, and a fresh look on coming back.
      timer = setTimeout(check, Math.min(midnight.getTime() - now.getTime(), 3_600_000));
    };
    check();
    const onVis = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    const offWake = onWake(check);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      offWake();
    };
  }, []);
  return today;
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
