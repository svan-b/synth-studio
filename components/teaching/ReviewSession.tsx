'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lesson, MultipleChoice } from '@/types';
import { useStudioStore, dueReviewItems, stepKind } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { DEVICES } from '@/devices';
import { STUDIO_LESSONS } from '@/lib/studio/lessons';

/**
 * Daily review - spaced retrieval practice. Questions from finished lessons come
 * back after 1, 3, 7, 16 and 35 days; a miss sends a question back to tomorrow.
 * Recalling something just as you are about to forget it is what makes it stick.
 */
export default function ReviewSession({ onClose }: { onClose: () => void }) {
  const review = useStudioStore(s => s.review);
  const recordReview = useStudioStore(s => s.recordReview);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  // Load every module so review can pull questions from any instrument
  useEffect(() => {
    let alive = true;
    Promise.all(DEVICES.map(d => hub.loadModule(d.id).then(m => m.lessons).catch(() => [] as Lesson[])))
      .then(all => alive && setLessons([...all.flat(), ...STUDIO_LESSONS]));
    return () => { alive = false; };
  }, []);

  // Snapshot of due items when the session starts
  const [queue] = useState(() => dueReviewItems(useStudioStore.getState().review).map(([id]) => id));
  const items = useMemo(() => {
    if (!lessons) return [];
    return queue
      .map(id => {
        const [lessonId, ref] = id.split(':');
        const lesson = lessons.find(l => l.id === lessonId);
        if (!lesson || !ref) return null;
        const n = Number(ref.slice(1));
        let mc: MultipleChoice | undefined;
        if (ref[0] === 'r') mc = lesson.review?.[n];
        if (ref[0] === 'q') {
          const st = lesson.steps[n];
          if (st && stepKind(st) === 'quiz') mc = st.quiz;
        }
        return mc ? { id, lesson, mc } : null;
      })
      .filter((x): x is { id: string; lesson: Lesson; mc: MultipleChoice } => !!x);
  }, [lessons, queue]);

  if (!lessons) return <p className="text-sm text-gray-400 animate-pulse">Gathering your review questions…</p>;

  if (!items.length || index >= items.length) {
    const nextDue = Object.values(review).map(r => r.due).filter(d => d > Date.now()).sort((a, b) => a - b)[0];
    return (
      <div className="text-center py-4">
        <p className="text-lg font-bold text-white">{items.length ? 'Review done' : 'Nothing due right now'}</p>
        {score.total > 0 && <p className="text-sm text-green-300 mt-1">{score.right} of {score.total} recalled</p>}
        <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
          {nextDue ? `Next questions come back ${new Date(nextDue).toLocaleDateString()}.` : 'Finish lessons to add questions here.'}
          {' '}Short, spaced reviews beat long cramming sessions.
        </p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded bg-teaching-current text-black font-bold text-sm">Done</button>
      </div>
    );
  }

  const item = items[index];
  const answered = answer !== null;
  const correct = answered && answer === item.mc.answer;

  const choose = (i: number) => {
    if (answered) return;
    setAnswer(i);
    const ok = i === item.mc.answer;
    recordReview(item.id, ok, item.lesson.id);
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
        <span>From “{item.lesson.name}”</span>
        <span>{index + 1} / {items.length}</span>
      </div>
      <p className="text-[15px] text-white font-medium leading-snug">{item.mc.question}</p>
      <div className="mt-3 space-y-2">
        {item.mc.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            disabled={answered}
            className={`w-full text-left px-3 py-2.5 rounded border text-[13px] ${
              answered && i === item.mc.answer ? 'border-green-500 bg-green-950/50 text-green-200'
                : answered && i === answer ? 'border-red-500 bg-red-950/40 text-red-200'
                : 'border-[#333] bg-[#1b1b1b] text-gray-200 hover:border-[#555]'
            }`}
          >
            <b className="mr-1">{String.fromCharCode(65 + i)}</b> {opt}
          </button>
        ))}
      </div>
      {answered && (
        <div className="mt-3">
          <p className={`text-[12px] ${correct ? 'text-green-300' : 'text-orange-200'}`}>
            {correct ? 'Recalled - this one comes back later.' : 'Missed - it will come back tomorrow.'} {item.mc.explain}
          </p>
          <button onClick={() => { setAnswer(null); setIndex(i => i + 1); }} className="mt-3 w-full py-2 rounded bg-teaching-current text-black font-bold text-sm">
            {index + 1 < items.length ? 'Next question' : 'Finish'}
          </button>
        </div>
      )}
    </div>
  );
}
