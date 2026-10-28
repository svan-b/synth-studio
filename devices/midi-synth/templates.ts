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

/** Shown first before you type: synths people often bring (ids missing from the data are skipped) */
const POPULAR = [
  'moog-subsequent-37', 'moog-mother-32', 'moog-subharmonicon', 'moog-grandmother', 'korg-minilogue-xd', 'korg-monologue',
  'korg-volca-keys', 'korg-volca-bass', 'korg-nts-1', 'arturia-microfreak', 'novation-bass-station-ii', 'novation-summit-and-peak',
  'sequential-prophet-6', 'sequential-take-5', 'dave-smith-instruments-ob-6', 'roland-tr-8s', 'elektron-digitone', 'elektron-digitakt',
  'elektron-analog-four-mkii', 'elektron-analog-rytm-mkii', 'dreadbox-nymphes', 'make-noise-0-coast', 'waldorf-blofeld',
  'teenage-engineering-op-1-field', 'behringer-pro-800', 'behringer-deepmind-12',
];

/** Manufacturers A-Z with how many instruments each has */
export function manufacturers(devices: GuideIndexEntry[]): { name: string; count: number }[] {
  const m = new Map<string, { name: string; count: number }>();
  devices.forEach(d => {
    const key = d.manufacturer.toLowerCase();
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { name: d.manufacturer, count: 1 });
  });
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** One manufacturer's instruments, A-Z */
export function byManufacturer(devices: GuideIndexEntry[], manufacturer: string): GuideIndexEntry[] {
  const key = manufacturer.toLowerCase();
  return devices
    .filter(d => d.manufacturer.toLowerCase() === key)
    .sort((a, b) => a.device.localeCompare(b.device, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Results grouped under their manufacturer, keeping the ranking of each group's best match */
export function groupResults(results: GuideIndexEntry[]): [string, GuideIndexEntry[]][] {
  const groups = new Map<string, GuideIndexEntry[]>();
  results.forEach(r => {
    if (!groups.has(r.manufacturer)) groups.set(r.manufacturer, []);
    groups.get(r.manufacturer)!.push(r);
  });
  return [...groups.entries()];
}

/** Every word of the query must appear in "manufacturer device" (any order) */
export function searchGuide(devices: GuideIndexEntry[], query: string, limit = 60): GuideIndexEntry[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) {
    const byId = new Map(devices.map(d => [d.id, d]));
    const popular = POPULAR.map(id => byId.get(id)).filter((d): d is GuideIndexEntry => !!d);
    return popular.length ? popular.slice(0, limit) : devices.slice(0, limit);
  }
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
