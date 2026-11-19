// ============================================================================
// The page loads the lesson coach, the lesson browser and Daily Review on demand
// (app/page.tsx), so they are not part of the first load. Once an instrument is
// up (DeviceHost), fetch them in idle time: the first lesson or dialog then
// opens without waiting on the network.
// ============================================================================

const LOADERS = [() => import('./Instructions'), () => import('./LessonBrowser'), () => import('./ReviewSession')];

let scheduled = false;

export function prefetchTeaching(): void {
  if (scheduled || typeof window === 'undefined') return;
  scheduled = true;
  // A failed fetch (offline) is simply retried when the piece is shown
  const run = () => LOADERS.forEach(load => { load().catch(() => undefined); });
  // iPad Safari has no requestIdleCallback
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}
