'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { history } from '@/lib/studio/history';
import { hub } from '@/lib/studio/hub';
import { transport } from '@/lib/audio/transport';

/** Undo / redo availability and labels */
export function useHistory() {
  const version = useSyncExternalStore(
    l => history.subscribe(l),
    () => history.version,
    () => 0,
  );
  void version;
  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.describe('undo'),
    redoLabel: history.describe('redo'),
  };
}

export function useTransportPlaying(): boolean {
  const [playing, setPlaying] = useState(transport.playing);
  useEffect(() => transport.onEvent(e => {
    if (e.type === 'start') setPlaying(true);
    if (e.type === 'stop') setPlaying(false);
  }), []);
  return playing;
}

/** Re-render when engines start or stop (strips appear once an instrument's engine runs) */
export function useSlotsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => hub.onSlotsChange(() => setV(n => n + 1)), []);
  useEffect(() => hub.onStatusChange(() => setV(n => n + 1)), []);
  return v;
}

/** iPad-ish touch device (bigger targets, no hover) */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(pointer: coarse)');
    setCoarse(m.matches);
    const on = () => setCoarse(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return coarse;
}
