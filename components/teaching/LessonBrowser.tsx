'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lesson } from '@/types';
import { useStudioStore } from '@/store/studio';
import { loadProducerLessons, producerLessonsNow } from '@/lib/studio/producerIndex';
import { conceptLabel } from './concepts';

const PATHS: { id: NonNullable<Lesson['path']> | 'other'; title: string; blurb: string }[] = [
  { id: 'foundations', title: 'Foundations', blurb: 'What every control does, one idea at a time.' },
  { id: 'sound-design', title: 'Sound design', blurb: 'Build classic sounds and understand why they work.' },
  { id: 'ear-training', title: 'Ear training', blurb: 'Hear a sound, recreate it. The core skill.' },
  { id: 'sequencing', title: 'Sequencing & rhythm', blurb: 'Patterns, grooves, polyrhythm and song structure.' },
  { id: 'performance', title: 'Performance', blurb: 'Play it live: tweaks, fills, transitions.' },
  { id: 'studio', title: 'Studio & full tracks', blurb: 'Wire instruments together and finish a track.' },
  { id: 'other', title: 'More lessons', blurb: '' },
];

interface Props {
  /** This instrument's lessons - always listed first */
  lessons: Lesson[];
  /** Cross-instrument studio lessons - listed after */
  studioLessons?: Lesson[];
  deviceName: string;
  completed: string[];
  onStart: (lesson: Lesson) => void;
}

export default function LessonBrowser({ lessons, studioLessons = [], deviceName, completed, onStart }: Props) {
  const [difficulty, setDifficulty] = useState<'all' | Lesson['difficulty']>('all');
  // The Producer path loads on demand (its lessons are long)
  const [producer, setProducer] = useState<Lesson[] | null>(producerLessonsNow());
  const [producerError, setProducerError] = useState(false);
  useEffect(() => {
    if (producer) return;
    let alive = true;
    loadProducerLessons().then(l => { if (alive) setProducer(l); }).catch(() => { if (alive) setProducerError(true); });
    return () => { alive = false; };
  }, [producer]);

  const byOrder = (a: Lesson, b: Lesson) => (a.order ?? 999) - (b.order ?? 999);
  const sorted = useMemo(() => [...lessons].sort(byOrder), [lessons]);
  const studioSorted = useMemo(() => [...studioLessons].filter(l => l.path !== 'producer').sort(byOrder), [studioLessons]);
  const producerSorted = useMemo(() => {
    const all = [...(producer ?? []), ...studioLessons.filter(l => l.path === 'producer')];
    const seen = new Set<string>();
    return all.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true))).sort(byOrder);
  }, [producer, studioLessons]);
  // First lesson on this instrument not done whose prerequisites are done; studio lessons only after
  const recommended = useMemo(() => {
    const ready = (l: Lesson) => !completed.includes(l.id) && (l.prerequisites ?? []).every(p => completed.includes(p));
    return sorted.find(ready) ?? studioSorted.find(ready) ?? producerSorted.find(ready);
  }, [sorted, studioSorted, producerSorted, completed]);
  const filter = (ls: Lesson[]) => (difficulty === 'all' ? ls : ls.filter(l => l.difficulty === difficulty));
  const shown = filter(sorted);

  // The instrument's own lessons first: grouped by path if they have one,
  // otherwise one "<instrument> lessons" section. Studio lessons and the Producer path come last.
  const byPath = [
    ...PATHS.filter(p => p.id !== 'other').map(p => ({ ...p, lessons: shown.filter(l => l.path === p.id) })),
    { id: 'device' as const, title: `${deviceName} lessons`, blurb: '', lessons: shown.filter(l => !l.path) },
    { id: 'studio-all' as const, title: 'Studio & full tracks', blurb: 'Wire instruments together, sync them, mix and arrange a whole track.', lessons: filter(studioSorted) },
    {
      id: 'producer' as const,
      title: 'Producer path',
      blurb: 'From a beat to a mastered, bounced track, in a ready-made studio: frequency slots, space, arrangement, mixdown and mastering. Your own studio is saved first.',
      lessons: filter(producerSorted),
    },
  ].filter(p => p.lessons.length);
  // Untagged lessons belong at the top, before any path sections
  const tail = (id: string) => (id === 'studio-all' ? 1 : id === 'producer' ? 2 : 0);
  byPath.sort((a, b) => (a.id === 'device' ? -1 : b.id === 'device' ? 1 : tail(a.id) - tail(b.id)));

  return (
    <div className="flex flex-col min-h-0">
      {recommended && (
        <button
          onClick={() => onStart(recommended)}
          className="text-left p-3 mb-3 rounded-lg border border-teaching-current bg-[#132013] hover:bg-[#183018]"
        >
          <span className="text-[10px] uppercase tracking-wider text-teaching-current font-bold">Recommended next</span>
          <span className="block font-bold text-white text-sm mt-0.5">{recommended.name}</span>
          {recommended.objective && <span className="block text-[11px] text-gray-300 mt-0.5">{recommended.objective}</span>}
        </button>
      )}
      <SavedStudios />
      <div className="flex gap-1 mb-3">
        {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(d => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`px-3 py-1 rounded-full text-xs capitalize ${difficulty === d ? 'bg-white text-black' : 'bg-[#262626] text-gray-300'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="space-y-4 overflow-y-auto min-h-0 flex-1 pr-1">
        {byPath.map(p => {
          const done = p.lessons.filter(l => completed.includes(l.id)).length;
          return (
            <section key={p.id}>
              <div className="flex items-baseline justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">{p.title}</h4>
                <span className="text-[10px] text-gray-500">{done}/{p.lessons.length} done</span>
              </div>
              {p.blurb && <p className="text-[11px] text-gray-500 mb-1.5">{p.blurb}</p>}
              <div className="space-y-1.5">
                {p.lessons.map(lesson => {
                  const isDone = completed.includes(lesson.id);
                  const locked = (lesson.prerequisites ?? []).some(x => !completed.includes(x));
                  const kinds = new Set(lesson.steps.map(s => s.kind ?? (s.patchFrom ? 'patch' : s.control ? 'do' : 'info')));
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => onStart(lesson)}
                      className={`w-full text-left p-2.5 bg-[#1a1a1a] hover:bg-[#242424] border rounded group ${isDone ? 'border-green-900' : 'border-[#333]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white group-hover:text-teaching-current text-[13px]">
                          {isDone && <span className="text-green-500 mr-1">✓</span>}{lesson.name}
                        </span>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${lesson.difficulty === 'beginner' ? 'bg-green-900 text-green-300' : lesson.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                          {lesson.difficulty}
                        </span>
                      </div>
                      <p className="text-[11px] text-hardware-label mt-0.5">{lesson.objective ?? lesson.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {locked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-gray-400">suggested after earlier lessons</span>}
                        {lesson.start?.studio && <Tag className="bg-[#16242a] text-teal-200">loads its own studio</Tag>}
                        {kinds.has('patch') && <Tag className="bg-[#2a1f12] text-orange-300">patching</Tag>}
                        {kinds.has('match') && <Tag className="bg-[#26162e] text-purple-300">ear challenge</Tag>}
                        {kinds.has('predict') && <Tag className="bg-[#14222e] text-sky-300">predict</Tag>}
                        {(lesson.concepts ?? []).slice(0, 3).map(c => <Tag key={c} className="bg-[#1c2430] text-sky-200">{conceptLabel(c)}</Tag>)}
                        {lesson.estimatedMinutes && <span className="text-[10px] text-gray-500 px-1">~{lesson.estimatedMinutes} min</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!producer && !producerError && <p className="text-[11px] text-gray-500" role="status">Loading the Producer path…</p>}
        {producerError && <p className="text-[11px] text-orange-200">The Producer path didn&apos;t load (offline?). Close and open Lessons to try again.</p>}
        {!byPath.length && <p className="text-sm text-gray-500 text-center py-6">No lessons at this level yet.</p>}
      </div>
    </div>
  );
}

/** Studios saved before lessons replaced them: bring one back, or let it go */
function SavedStudios() {
  const backups = useStudioStore(s => s.lessonBackups);
  const teaching = useStudioStore(s => s.isTeachingMode);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!backups.length) return null;
  const when = (t: number) => new Date(t).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <section className="mb-3 rounded-lg border border-[#24313d] bg-[#121a20] p-2.5" aria-label="Saved studios">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Saved studios</h4>
      <p className="text-[11px] text-gray-400 mb-1.5">Lessons that set up their own studio save yours first. Bringing one back saves the studio you have now in its place.</p>
      <ul className="space-y-1">
        {backups.map(b => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-gray-100 min-w-0 flex-1">
              {b.label}
              <span className="text-gray-500"> · {when(b.at)} · {b.studio.rack.length} instrument{b.studio.rack.length === 1 ? '' : 's'}{b.pinned ? ' · your own' : ''}</span>
            </span>
            <button
              onClick={() => { if (teaching) useStudioStore.getState().resetLesson(); useStudioStore.getState().restoreStudioBackup(b.id); }}
              className="px-2 py-1 rounded bg-sky-800 text-white text-[11px] font-bold"
            >
              Bring it back
            </button>
            {confirm === b.id ? (
              <button onClick={() => { useStudioStore.getState().deleteStudioBackup(b.id); setConfirm(null); }} className="px-2 py-1 rounded bg-red-900 text-red-100 text-[11px]">
                Delete it for good
              </button>
            ) : (
              <button onClick={() => setConfirm(b.id)} className="px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 text-[11px]" aria-label={`Delete ${b.label}`}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${className}`}>{children}</span>;
}
