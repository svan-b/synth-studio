// ============================================================================
// Settings that a rebuild could not convert (lib/studio/upgrades.ts entries
// marked `reset`). The upgrade drops them so the rebuilt instrument starts
// clean, but they are the learner's work: keep a copy in this browser and
// offer it as a file, never lose it silently.
// ============================================================================

import type { Values } from '@/types/panel';
import { DEVICES } from '@/devices';
import { showNotice } from './notices';
import { saveFilesOrOffer } from './platform';

const KEY = 'synth-studio-old-settings';

export interface OldSettings {
  instance: string;
  device: string;
  /** Where it was: the studio, or a studio kept while a lesson ran */
  from: 'studio' | 'lesson backup';
  values: Values;
}

interface Kept {
  kept: { savedAt: string; storeVersion: number; settings: OldSettings[] }[];
}

function read(): Kept {
  try {
    const k = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Kept>;
    return { kept: Array.isArray(k.kept) ? k.kept : [] };
  } catch {
    return { kept: [] };
  }
}

const nameOf = (device: string) => {
  const d = DEVICES.find(e => e.id === device);
  return d ? `${d.manufacturer} ${d.name}` : device;
};

function list(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Offer the kept settings as a file (a tap on iPad) */
export function saveOldSettings() {
  const blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' });
  void saveFilesOrOffer([{ blob, name: 'synth-studio-old-settings.json' }], 'old settings');
}

/**
 * Keep the settings a browser-save upgrade dropped, and tell the learner once,
 * with the file one tap away. Called from the store's migrate.
 */
export function keepOldSettings(settings: OldSettings[], storeVersion: number) {
  if (!settings.length) return;
  try {
    const k = read();
    k.kept.push({ savedAt: new Date().toISOString(), storeVersion, settings });
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    // Storage full: the notice below still offers the file while the page is open
  }
  const names = list([...new Set(settings.map(s => nameOf(s.device)))]);
  const many = new Set(settings.map(s => s.device)).size > 1;
  // After hydration, so the message shows once the app is on screen
  setTimeout(() => showNotice({
    id: 'old-settings', level: 'info',
    text: `The ${names} ${many ? 'were' : 'was'} rebuilt from ${many ? 'their manuals' : 'its manual'}, so the settings you made before the rebuild couldn't carry over and ${many ? 'they start' : 'it starts'} fresh. Your old settings are kept in this browser: save them to a file to keep a copy.`,
    action: { label: 'Save old settings', run: saveOldSettings },
  }), 0);
}

/** A project file from before a rebuild: the file itself is the copy, so only say what happened */
export function announceProjectReset(devices: string[]) {
  if (!devices.length) return;
  const many = new Set(devices).size > 1;
  showNotice({
    id: 'old-settings', level: 'info',
    text: `This project was saved before the ${list([...new Set(devices)].map(nameOf))} ${many ? 'were' : 'was'} rebuilt from ${many ? 'their manuals' : 'its manual'}, so ${many ? 'their' : 'its'} settings start fresh. The project file itself is unchanged.`,
  });
}
