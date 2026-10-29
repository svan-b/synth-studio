'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useStudioStore } from '@/store/studio';
import type { CoachProps } from './Coach';
import { loadCoach, prefetchTeaching } from './onDemand';

export { conceptLabel } from './concepts';

const Coach = dynamic<CoachProps>(loadCoach, { ssr: false, loading: () => <CoachLoading /> });

/**
 * The lesson coach (./Coach), loaded when a lesson starts - it and its scope are
 * not part of the first load (./onDemand). Renders nothing outside a lesson.
 */
export default function Instructions(props: CoachProps) {
  const running = useStudioStore(s => s.isTeachingMode && !!s.currentLesson);
  useEffect(prefetchTeaching, []);
  return running ? <Coach {...props} /> : null;
}

/** Holds the coach's place for the moment it takes to arrive, so the panel doesn't jump twice */
function CoachLoading() {
  return (
    <div
      className="w-full lg:w-[22rem] shrink-0 min-h-[16rem] bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg"
      role="status"
      aria-label="Loading the lesson coach"
    />
  );
}
