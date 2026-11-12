// ============================================================================
// Projects: the whole studio (every instrument's knobs, cables, patterns,
// routing, tempo, the mix and the song arrangement) as one JSON file.
// ============================================================================

import { useStudioStore, type InstanceState, type StudioDoc } from '@/store/studio';
import type { ProjectAudioAsset } from '@/devices/types';
import { hub } from './hub';
import { PROJECT_VERSION, upgradeDevices } from './upgrades';
import { announceProjectReset } from './legacy';
import { history } from './history';
import { requestPersistentStorage, saveFilesOrOffer } from './platform';

export interface ProjectFile {
  format: 'synth-studio-project';
  version: number;
  name: string;
  savedAt: string;
  currentDevice: string;
  devices: Record<string, InstanceState>;
  studio: StudioDoc;
  /** Files the instruments use that live outside the studio (user samples), by instance */
  assets?: Record<string, ProjectAudioAsset[]>;
}

export function exportProject(name = 'My track'): ProjectFile {
  const s = useStudioStore.getState();
  return {
    format: 'synth-studio-project',
    version: PROJECT_VERSION,
    name,
    savedAt: new Date().toISOString(),
    currentDevice: s.currentDevice,
    devices: s.devices,
    studio: s.studio,
  };
}

/** Start an empty project (keeps the focused instrument) and forget the undo history */
export function newProject() {
  useStudioStore.getState().newProject();
  history.clear();
}

const LAST_EXPORT_KEY = 'synth-studio-last-export';

/** Instances whose instrument keeps files outside the studio (loaded modules that say they use some) */
function withAssets(file: ProjectFile): string[] {
  return file.studio.rack
    .filter(r => hub.getModule(r.device)?.assets?.has(file.devices[r.id]?.data))
    .map(r => r.id);
}

/** The project with its instruments' outside files (user samples) inside it */
export async function exportProjectWithAssets(name = 'My track'): Promise<ProjectFile> {
  const file = exportProject(name);
  const assets: Record<string, ProjectAudioAsset[]> = {};
  for (const id of withAssets(file)) {
    const r = file.studio.rack.find(x => x.id === id)!;
    const list = await hub.getModule(r.device)!.assets!.collect(file.devices[id]?.data);
    if (list.length) assets[id] = list;
  }
  return Object.keys(assets).length ? { ...file, assets } : file;
}

/** Save the project to a file (the share sheet on iPad: Save to Files) */
export function downloadProject(name = 'My track') {
  const fileName = `${name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.synthstudio.json`;
  const save = (file: ProjectFile) => {
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    void saveFilesOrOffer([{ blob, name: fileName }], 'project file');
  };
  const file = exportProject(name);
  // Straight from the tap when there's nothing to fetch, so the iPad share sheet can open;
  // with user samples to read first, a lost tap falls back to the "ready" notice's button
  if (!withAssets(file).length) save(file);
  else void exportProjectWithAssets(name).then(save, () => save(file));
  try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())); } catch { /* */ }
  requestPersistentStorage(true);
}

/** A project file's outside files back where their instruments look for them */
async function restoreAssets(parsed: Partial<ProjectFile>) {
  const rack = parsed.studio?.rack ?? [];
  for (const [instance, list] of Object.entries(parsed.assets ?? {})) {
    const device = rack.find(r => r.id === instance)?.device ?? instance.split('#')[0];
    try {
      const mod = await hub.loadModule(device);
      if (mod.assets && Array.isArray(list)) await mod.assets.restore(list);
    } catch (e) {
      console.warn('[project] could not restore the files of', instance, e);
    }
  }
}

/** When the project was last saved to a file in this browser (0 = never) */
export function lastProjectExport(): number {
  try { return Number(localStorage.getItem(LAST_EXPORT_KEY)) || 0; } catch { return 0; }
}

export async function importProject(file: File): Promise<string> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<ProjectFile>;
  if (parsed.format !== 'synth-studio-project' || !parsed.studio || !parsed.devices) {
    throw new Error('That file is not a Synth Studio project');
  }
  // Outside files first (user samples), so the instruments find them when their data arrives
  await restoreAssets(parsed);
  // Projects saved by an older version: controls whose meaning changed keep sounding the same
  const reset: string[] = [];
  const devices = upgradeDevices(parsed.devices, parsed.studio.rack ?? [], 'project', parsed.version ?? 1, (_i, device) => reset.push(device));
  useStudioStore.getState().loadProject({ devices, studio: parsed.studio, currentDevice: parsed.currentDevice });
  announceProjectReset(reset);
  // A different project: nothing to undo into
  history.clear();
  return parsed.name ?? 'Project';
}
