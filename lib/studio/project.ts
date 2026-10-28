// ============================================================================
// Projects: the whole studio (every instrument's knobs, cables, patterns,
// routing, tempo and song arrangement) as one JSON file.
// ============================================================================

import { useStudioStore, type InstanceState, type StudioDoc } from '@/store/studio';
import { PROJECT_VERSION, upgradeDevices } from './upgrades';

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

export function downloadProject(name = 'My track') {
  const file = exportProject(name);
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.synthstudio.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
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
  return parsed.name ?? 'Project';
}
