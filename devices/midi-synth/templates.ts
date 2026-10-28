// ============================================================================
// midi.guide templates in the browser: the small index loads when Setup opens,
// one device file loads when you pick it. Both are cached for the session.
// Data: MIDI Guide by Pencil Research (midi.guide), CC BY-SA 4.0 -
// public/midi-guide/LICENSE.md
// ============================================================================

import { GUIDE_BASE, type GuideDevice, type GuideIndex, type GuideIndexEntry } from './guide';

let indexPromise: Promise<GuideIndex> | null = null;
const devicePromises = new Map<string, Promise<GuideDevice>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText || 'error'} loading ${url}`);
  return (await res.json()) as T;
}

export function loadGuideIndex(): Promise<GuideIndex> {
  if (!indexPromise) {
    indexPromise = getJson<GuideIndex>(`${GUIDE_BASE}/index.json`);
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

export function loadGuideDevice(id: string): Promise<GuideDevice> {
  let p = devicePromises.get(id);
  if (!p) {
    p = getJson<GuideDevice>(`${GUIDE_BASE}/devices/${encodeURIComponent(id)}.json`);
    p.catch(() => devicePromises.delete(id));
    devicePromises.set(id, p);
  }
  return p;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word of the query must appear in "manufacturer device" (any order) */
export function searchGuide(devices: GuideIndexEntry[], query: string, limit = 60): GuideIndexEntry[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return devices.slice(0, limit);
  const out: { e: GuideIndexEntry; score: number }[] = [];
  for (const e of devices) {
    const hay = norm(`${e.manufacturer} ${e.device}`);
    if (!words.every(w => hay.includes(w))) continue;
    const dev = norm(e.device);
    // Exact model matches first, then models starting with the query
    const score = (dev === words.join(' ') ? 0 : dev.startsWith(words[words.length - 1]) ? 1 : 2) + (e.cc ? 0 : 3);
    out.push({ e, score });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit).map(x => x.e);
}
