'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Lesson } from '@/types';
import type { DeviceModule } from '@/devices/types';
import { DEVICES, getDeviceEntry } from '@/devices';
import { useStudioStore } from '@/store/studio';
import DeviceHost from '@/components/DeviceHost';
import Instructions, { conceptLabel } from '@/components/teaching/Instructions';

type Difficulty = 'all' | Lesson['difficulty'];

export default function Home() {
  const currentDevice = useStudioStore(s => s.currentDevice);
  const setCurrentDevice = useStudioStore(s => s.setCurrentDevice);
  const startLesson = useStudioStore(s => s.startLesson);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const currentLesson = useStudioStore(s => s.currentLesson);
  const completed = useStudioStore(s => s.completedLessons);
  const [mod, setMod] = useState<{ id: string; deviceModule: DeviceModule } | null>(null);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const [hydrated, setHydrated] = useState(false);

  // Persisted store hydrates on the client; avoid rendering the wrong device first
  useEffect(() => setHydrated(true), []);

  const entry = getDeviceEntry(currentDevice) ?? DEVICES[0];
  const deviceModule = mod?.id === entry.id ? mod.deviceModule : null;
  const lessons = useMemo(() => deviceModule?.lessons ?? [], [deviceModule]);
  const shownLessons = difficulty === 'all' ? lessons : lessons.filter(l => l.difficulty === difficulty);
  const onModuleLoaded = useCallback((m: DeviceModule) => setMod({ id: m.spec.id, deviceModule: m }), []);

  const nextLesson = useMemo(() => {
    if (!currentLesson) return undefined;
    const i = lessons.findIndex(l => l.id === currentLesson.id);
    return i >= 0 ? lessons[i + 1] : undefined;
  }, [lessons, currentLesson]);

  const completedHere = lessons.filter(l => completed.includes(l.id)).length;

  return (
    <div className="min-h-screen bg-hardware-bg px-3 py-4 sm:px-6">
      <header className="max-w-[1800px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white leading-none">SYNTH STUDIO</h1>
          <p className="text-xs text-hardware-label mt-1">Playable digital twins · learn synthesis by doing</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDevicesOpen(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-hardware-panel border-2 border-[#3a3a3a] text-white hover:brightness-110 min-w-[220px] justify-between"
          >
            <span className="text-left leading-tight">
              <span className="block text-[10px] uppercase tracking-wider text-hardware-label">{entry.manufacturer}</span>
              <span className="font-bold">{entry.name}</span>
            </span>
            <span className="text-hardware-label">▼</span>
          </button>
          <button
            onClick={() => setLessonsOpen(true)}
            disabled={!lessons.length}
            className="px-5 py-3 bg-teaching-current text-black font-bold rounded-lg text-sm hover:brightness-110 disabled:opacity-40"
          >
            {isTeaching ? 'Lessons' : 'Start a lesson'}
            {lessons.length > 0 && <span className="ml-2 text-[11px] font-normal">{completedHere}/{lessons.length}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">
          {hydrated && <DeviceHost entry={entry} onModuleLoaded={onModuleLoaded} />}
        </div>
        {isTeaching && currentLesson?.device === entry.id && (
          <Instructions
            spec={deviceModule?.spec ?? null}
            onNextLesson={nextLesson ? () => startLesson(nextLesson) : undefined}
          />
        )}
      </main>

      <footer className="max-w-[1800px] mx-auto mt-8 text-center text-[11px] text-hardware-label space-y-1">
        <p>Synth Studio · educational recreations, not affiliated with Moog, Elektron or Allen &amp; Heath.</p>
        {deviceModule?.spec.manualUrl && (
          <p>
            <a href={deviceModule.spec.manualUrl} target="_blank" rel="noopener noreferrer" className="hover:text-teaching-current underline">
              {deviceModule.spec.manufacturer} {deviceModule.spec.name} manual
            </a>
          </p>
        )}
      </footer>

      {/* Device picker */}
      <Dialog.Root open={devicesOpen} onOpenChange={setDevicesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-5 w-[calc(100%-2rem)] max-w-2xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-white mb-1">Choose an instrument</Dialog.Title>
            <Dialog.Description className="text-xs text-hardware-label mb-4">Every instrument is playable, patchable and comes with guided lessons.</Dialog.Description>
            <div className="grid sm:grid-cols-2 gap-2">
              {DEVICES.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setCurrentDevice(d.id); setDevicesOpen(false); }}
                  className={`text-left p-3 rounded border transition-colors ${d.id === entry.id ? 'border-teaching-current bg-[#132013]' : 'border-[#3a3a3a] bg-[#1a1a1a] hover:bg-[#242424]'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-hardware-label">{d.manufacturer}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-gray-400">{d.category}</span>
                  </div>
                  <div className="font-bold text-white mt-0.5">{d.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{d.tagline}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 bg-[#3a3a3a] text-white rounded text-sm">Close</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Lesson browser */}
      <Dialog.Root open={lessonsOpen} onOpenChange={setLessonsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-5 w-[calc(100%-2rem)] max-w-xl shadow-2xl z-50 max-h-[88vh] flex flex-col">
            <Dialog.Title className="text-lg font-bold text-white">{entry.name} lessons</Dialog.Title>
            <Dialog.Description className="text-xs text-hardware-label mb-3">
              Controls light up orange until they are set right, then turn green and the lesson moves on.
            </Dialog.Description>
            <div className="flex gap-1 mb-3">
              {(['all', 'beginner', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1 rounded-full text-xs capitalize ${difficulty === d ? 'bg-white text-black' : 'bg-[#262626] text-gray-300'}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
              {shownLessons.map(lesson => (
                <button
                  key={lesson.id}
                  onClick={() => { startLesson(lesson); setLessonsOpen(false); }}
                  className="w-full text-left p-3 bg-[#1a1a1a] hover:bg-[#242424] border border-[#3a3a3a] rounded group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white group-hover:text-teaching-current text-sm">
                      {lesson.name}
                      {completed.includes(lesson.id) && <span className="ml-2 text-xs text-green-500 font-normal">✓ done</span>}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${lesson.difficulty === 'beginner' ? 'bg-green-900 text-green-300' : lesson.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                        {lesson.difficulty}
                      </span>
                      <span className="text-[10px] text-hardware-label bg-[#2a2a2a] px-1.5 py-0.5 rounded">{lesson.steps.length} steps</span>
                    </div>
                  </div>
                  <p className="text-xs text-hardware-label mt-1">{lesson.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lesson.steps.some(s => s.patchFrom) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a1f12] text-orange-300">patching</span>}
                    {(lesson.concepts ?? []).slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2430] text-sky-300">{conceptLabel(c)}</span>
                    ))}
                    {lesson.estimatedMinutes && <span className="text-[10px] text-gray-500 px-1">~{lesson.estimatedMinutes} min</span>}
                  </div>
                </button>
              ))}
              {!shownLessons.length && <p className="text-sm text-gray-500 text-center py-6">No lessons at this level yet.</p>}
            </div>
            <div className="mt-3 flex justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 bg-[#3a3a3a] text-white rounded text-sm">Close</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
