'use client';

import dynamic from 'next/dynamic';
import { loadDailyReview } from './onDemand';

/** Daily Review (./DailyReview), loaded on demand (./onDemand) */
const ReviewSession = dynamic<{ onClose: () => void }>(loadDailyReview, {
  ssr: false,
  loading: () => <p className="py-6 text-center text-xs text-gray-400" role="status">Loading questions…</p>,
});

export default ReviewSession;
