// ============================================================================
// Teaching UI on demand. The coach (with its scope), the lesson list and Daily
// Review are not part of the first load: each arrives when it is first shown, and
// all of them are fetched in idle time shortly after startup, so starting a
// lesson or opening a dialog doesn't wait on the network.
// ============================================================================

export const loadCoach = () => import('./Coach');
export const loadLessonList = () => import('./LessonList');
export const loadDailyReview = () => import('./DailyReview');

let scheduled = false;

/** Fetch the teaching UI once the page has settled (the instrument comes first) */
export function prefetchTeaching(): void {
  if (scheduled || typeof window === 'undefined') return;
  scheduled = true;
  const run = () => {
    // A failed fetch (offline) is retried when the piece is actually shown
    [loadCoach, loadLessonList, loadDailyReview].forEach(load => { load().catch(() => undefined); });
  };
  // iPad Safari has no requestIdleCallback
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}
