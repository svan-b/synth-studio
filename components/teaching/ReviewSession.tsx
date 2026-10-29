'use client';

import { useEffect, useState } from 'react';
import type { Lesson, MultipleChoice } from '@/types';
import { useStudioStore, dueReviewItems, registerLessons, resolveReviewItem, questionFingerprint } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { DEVICES } from '@/devices';

interface Item { id: string; lesson: Lesson; mc: MultipleChoice }

/**
 * Daily review - spaced retrieval practice. Questions from finished lessons come
 * back after 1, 3, 7, 16 and 35 days; a miss sends a question back to tomorrow.
 * Recalling something just as you are about to forget it is what makes it stick.
 *
 * Opening it settles the queue against the lessons as they are now: questions whose
 * lesson was rebuilt or removed are dropped, and a question whose wording changed
 * starts again from the first box.
 */
export default function ReviewSession({ onClose }: { onClose: () => void }) {
  const recordReview = useStudioStore(s => s.recordReview);
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  // Load every module so review can pull questions from any instrument, then settle the queue
  useEffect(() => {
    let alive = true;
    Promise.all(DEVICES.map(d => hub.loadModule(d.id).then(m => { registerLessons(d.id, m.lessons); return true; }).catch(() => false)))
      .then(loaded => {
        if (!alive) return;
        const st = useStudioStore.getState();
        // Only when every device's lessons are known can an unknown lesson be called an orphan
        st.reconcileReview({ complete: loaded.every(Boolean) });
        const due = dueReviewItems(useStudioStore.getState().review);
        setItems(due
          .map(([id, r]) => {
            const res = resolveReviewItem(id, r, true);
            return res ? { id, lesson: res.lesson, mc: res.mc } : null;
          })
          .filter((x): x is Item => !!x));
      });
    return () => { alive = false; };
  }, []);

  if (!items) return <p className="text-sm text-gray-300 motion-safe:animate-pulse" role="status">Gathering your review questions…</p>;

  if (!items.length || index >= items.length) {
    const review = useStudioStore.getState().review;
    const nextDue = Object.values(review).map(r => r.due).filter(d => d > Date.now()).sort((a, b) => a - b)[0];
    return (
      <div className="text-center py-4" role="status">
        <p className="text-lg font-bold text-white">{items.length ? 'Review done' : 'Nothing due right now'}</p>
        {score.total > 0 && <p className="text-sm text-green-200 mt-1">{score.right} of {score.total} recalled</p>}
        <p className="text-xs text-gray-300 mt-2 max-w-sm mx-auto">
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
    recordReview(item.id, ok, item.lesson.id, { fp: questionFingerprint(item.mc), device: item.lesson.device });
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
        <span>From “{item.lesson.name}”</span>
        <span aria-label={`Question ${index + 1} of ${items.length}`}>{index + 1} / {items.length}</span>
      </div>
      <div className="flex gap-[3px] mb-3" aria-hidden="true">
        {items.map((_, i) => (
          <span key={i} className="flex-1 h-1.5 rounded-full" style={{ background: i < index ? '#22c55e' : i === index ? '#f59e0b' : '#2a2a2a' }} />
        ))}
      </div>
      <p className="text-[15px] text-white font-medium leading-snug">{item.mc.question}</p>
      <div className="mt-3 space-y-2" role="group" aria-label="Your answer">
        {item.mc.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            disabled={answered}
            aria-pressed={answer === i}
            className={`w-full text-left px-3 py-2.5 rounded border text-[13px] ${
              answered && i === item.mc.answer ? 'border-green-500 bg-green-950/50 text-green-100'
                : answered && i === answer ? 'border-red-500 bg-red-950/40 text-red-100'
                : 'border-[#333] bg-[#1b1b1b] text-gray-100 hover:border-[#555]'
            }`}
          >
            <b className="mr-1">{String.fromCharCode(65 + i)}</b> {opt}
          </button>
        ))}
      </div>
      {answered && (
        <div className="mt-3">
          <p className={`text-[12px] ${correct ? 'text-green-200' : 'text-orange-100'}`} role="status">
            {correct ? 'Recalled - it comes back later, at a longer gap.' : 'Missed - it comes back tomorrow.'} {item.mc.explain}
          </p>
          <button onClick={() => { setAnswer(null); setIndex(i => i + 1); }} className="mt-3 w-full py-2 rounded bg-teaching-current text-black font-bold text-sm">
            {index + 1 < items.length ? 'Next question' : 'Finish'}
          </button>
        </div>
      )}
    </div>
  );
}
