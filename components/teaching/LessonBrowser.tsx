'use client';

import dynamic from 'next/dynamic';
import type { LessonListProps } from './LessonList';
import { loadLessonList } from './onDemand';

/** The Lessons dialog's list (./LessonList), loaded on demand (./onDemand) */
const LessonBrowser = dynamic<LessonListProps>(loadLessonList, {
  ssr: false,
  loading: () => <p className="py-8 text-center text-xs text-gray-400" role="status">Loading lessons…</p>,
});

export default LessonBrowser;
