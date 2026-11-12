// ============================================================================
// Demo tracks - loading and playing them.
//
// A demo is a complete studio: rack, cables, routing, sync, tempo and swing,
// every instrument's sounds and patterns, the mix and the master, and the song
// arrangement. Loading one replaces the current studio, like opening a project
// (the undo history starts again), so the UI offers to save first.
//
// The builders load on demand: the instruments' data helpers they use stay out
// of the main bundle.
// ============================================================================

import { useStudioStore, type StudioDoc } from '@/store/studio';
import { transport } from '@/lib/audio/transport';
import { getAudioContext } from '@/lib/audio/context';
import { history } from '../history';
import { hub } from '../hub';
import { DEMOS, DEMO_BY_ID, DEMO_SECTION, type DemoMeta } from './meta';

export { DEMOS, DEMO_BY_ID, DEMO_SECTION, demoBars, demoSeconds, type DemoMeta, type DemoSection } from './meta';

type DemoId = DemoMeta['id'];

const BUILDERS: Record<DemoId, () => Promise<{ build: () => Parameters<ReturnType<typeof useStudioStore.getState>['loadProject']>[0] }>> = {
  'low-tide-lights': () => import('./lowTideLights'),
  'three-clocks': () => import('./threeClocks'),
  'copper-wire': () => import('./copperWire'),
};

/** The demo whose arrangement the studio holds (every section is one of its sections), if any */
export function studioDemo(studio: Pick<StudioDoc, 'arrangement'> = useStudioStore.getState().studio): DemoMeta | null {
  const secs = studio.arrangement.sections;
  if (!secs.length) return null;
  const first = DEMO_SECTION[secs[0].id]?.demo;
  if (!first) return null;
  return secs.every(s => DEMO_SECTION[s.id]?.demo === first) ? first : null;
}

/**
 * Is there anything in the current studio worth saving before a demo replaces it?
 * A fresh studio (one instrument, nothing arranged) or an untouched demo is not.
 */
export function studioHasWork(): boolean {
  const s = useStudioStore.getState();
  if (studioDemo(s.studio) && history.depth.undo === 0) return false;
  if (s.studio.rack.length > 1 || s.studio.arrangement.sections.length > 0) return true;
  return Object.values(s.devices).some(d => Object.keys(d.controlValues ?? {}).length > 0 || (d.patchConnections ?? []).length > 0);
}

/** Load a demo: replaces the studio (stops the transport first) */
export async function loadDemo(id: DemoId): Promise<DemoMeta> {
  const meta = DEMO_BY_ID[id];
  if (!meta) throw new Error(`Unknown demo ${id}`);
  const mod = await BUILDERS[id]();
  if (transport.playing) hub.stopAll();
  const project = mod.build();
  useStudioStore.getState().loadProject(project);
  // A different project: nothing to undo into
  history.clear();
  installDfamParking();
  void ready().then(ok => { if (ok) parkDfam(); });
  return meta;
}

/** Load a demo and play it from bar 1 once every instrument is running */
export async function playDemo(id: DemoId): Promise<DemoMeta> {
  hub.ensureAudio();
  const meta = await loadDemo(id);
  if (await ready()) {
    await parkDfam();
    // let routing, cables and sync settle on the new engines
    await new Promise(r => setTimeout(r, 250));
    if (!transport.playing) hub.startAll({ countIn: false });
  }
  return meta;
}

/** Resolves true once every instrument in the rack has its engine running (false after `timeoutMs`) */
export async function ready(timeoutMs = 20000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const rack = useStudioStore.getState().studio.rack;
    if (hub.status === 'on' && rack.every(r => !!hub.getStripOutput(r.id))) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// ----------------------------------------------------------------------------
// The DFAM has no reset: on the hardware you press ADVANCE until it sits on step 8,
// so the first clock pulse plays step 1 (Three Clocks, "Before pressing ▶"). The demo
// does that for you on load and after every stop, while its DFAM is clocked by cable.
// ----------------------------------------------------------------------------

let parking: Promise<void> | null = null;
let parkingInstalled = false;

function clockedDfam(): string | null {
  const st = useStudioStore.getState().studio;
  if (studioDemo(st)?.id !== 'three-clocks') return null;
  const d = st.rack.find(r => r.device === 'dfam');
  if (!d) return null;
  return st.cables.some(c => c.to.instance === d.id && c.to.jack === 'in_adv_clock') ? d.id : null;
}

function parkDfam(): Promise<void> {
  if (parking) return parking;
  const id = clockedDfam();
  const engine = id ? hub.getEngine(id) : undefined;
  if (!id || !engine || transport.playing) return Promise.resolve();
  parking = (async () => {
    try {
      // two tries: the step the panel shows can lag the worklet by a block
      for (let attempt = 0; attempt < 2; attempt++) {
        const step = Math.round(Number(engine.getState().step ?? 7));
        const n = (((7 - step) % 8) + 8) % 8;
        if (!n) return;
        for (let i = 0; i < n; i++) hub.event(id, 'advance');
        await new Promise(r => setTimeout(r, 120));
      }
    } finally {
      parking = null;
    }
  })();
  return parking;
}

function installDfamParking() {
  if (parkingInstalled || typeof window === 'undefined') return;
  parkingInstalled = true;
  transport.onEvent(e => {
    if (e.type !== 'stop') return;
    // after the last scheduled clock pulse (a song's end stops on a bar line a little ahead)
    const wait = Math.max(0, e.time - getAudioContext().currentTime) * 1000 + 150;
    setTimeout(() => { if (!transport.playing) void parkDfam(); }, wait);
  });
}

/** Play the loaded demo again from bar 1 */
export async function restartDemo(): Promise<void> {
  hub.ensureAudio();
  if (transport.playing) {
    hub.stopAll();
    await new Promise(r => setTimeout(r, 200));
  }
  await parkDfam();
  if (!transport.playing) hub.startAll({ countIn: false });
}
