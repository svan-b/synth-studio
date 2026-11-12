'use client';

import { useEffect, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { allLessons } from '@/lib/piano/content/catalog';
import { noteBus } from '@/lib/piano/input/bus';
import { input } from '@/lib/piano/input/hub';
import { midi } from '@/lib/piano/input/midi';
import { usePiano } from '@/lib/piano/learn/store';
import { useApplySettings, useAudioStatus, useTheme } from './hooks';
import LessonPlayer from './LessonPlayer';
import { Button } from './ui';

export default function App() {
  const theme = useTheme();
  const audio = useAudioStatus();
  const [lesson, setLesson] = useState<string | null>(null);
  const lessons = usePiano((s) => s.lessons);
  useApplySettings();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mcdebug')) {
      // Development tools, loaded only when asked for in the address.
      void Promise.all([import('@/lib/piano/dev/robot'), import('@/lib/piano/content/catalog'), import('@/lib/piano/engine/flow')]).then(
        ([robot, catalog, flow]) => {
          (window as unknown as { __mc: unknown }).__mc = { piano, midi, noteBus, input, store: usePiano, robot, catalog, flow };
        },
      );
    }
  }, []);

  return (
    <div className="mc-root" data-theme={theme}>
      <div className="mc-scroll h-full p-8">
        <h1 className="font-mc-serif text-4xl">Middle C</h1>
        <p className="mt-1 text-mc-muted">
          sound {audio.state} {Math.round(audio.progress * 100)}%
        </p>
        <Button className="mt-4" onClick={() => void piano.unlock()}>
          Begin
        </Button>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {allLessons().map((l) => (
            <button key={l.id} className="rounded-2xl border border-mc-line bg-mc-surface p-4 text-left" onClick={() => setLesson(l.id)}>
              <div className="font-semibold">
                {l.title} {lessons[l.id]?.done ? '(done)' : ''}
              </div>
              <div className="text-sm text-mc-muted">{l.summary}</div>
            </button>
          ))}
        </div>
      </div>
      {lesson && <LessonPlayer lessonId={lesson} onClose={() => setLesson(null)} />}
    </div>
  );
}
