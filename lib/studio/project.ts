// ============================================================================
// Projects: the whole studio (every instrument's knobs, cables, patterns,
// routing, tempo, the mix and the song arrangement) as one JSON file.
// ============================================================================

import { useStudioStore, type InstanceState, type StudioDoc } from '@/store/studio';
import { PROJECT_VERSION, upgradeDevices } from './upgrades';
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

/** Save the project to a file (the share sheet on iPad: Save to Files) */
export function downloadProject(name = 'My track') {
  const file = exportProject(name);
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  void saveFilesOrOffer([{ blob, name: `${name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.synthstudio.json` }], 'project file');
  try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())); } catch { /* */ }
  requestPersistentStorage(true);
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
  // Projects saved by an older version: controls whose meaning changed keep sounding the same
  const devices = upgradeDevices(parsed.devices, parsed.studio.rack ?? [], 'project', parsed.version ?? 1);
  useStudioStore.getState().loadProject({ devices, studio: parsed.studio, currentDevice: parsed.currentDevice });
  // A different project: nothing to undo into
  history.clear();
  return parsed.name ?? 'Project';
}
