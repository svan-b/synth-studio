'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import type { Lesson } from '@/types';
import type { DeviceModule } from '@/devices/types';
import { DEVICES } from '@/devices';
import { useStudioStore, dueReviewItems } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { arranger } from '@/lib/studio/arranger';
import { STUDIO_LESSONS } from '@/lib/studio/lessons';
import { downloadProject, importProject, newProject, lastProjectExport } from '@/lib/studio/project';
import { history } from '@/lib/studio/history';
import { showNotice } from '@/lib/studio/notices';
import { isStandalone } from '@/lib/studio/platform';
import DeviceHost from '@/components/DeviceHost';
import TransportBar from '@/components/studio/TransportBar';
import UndoRedo from '@/components/studio/UndoRedo';
import SystemNotices from '@/components/studio/SystemNotices';
import type { WelcomeChoice } from '@/components/onboarding/Welcome';
import MidiButton from '@/components/midi/MidiButton'; // external gear: MIDI settings

// Shown only in a tab, a dialog or a running lesson: loaded on demand so the
// first visit (an iPad on a phone connection) downloads less up front.
const StudioView = dynamic(() => import('@/components/studio/StudioView'), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-400 p-6 animate-pulse motion-reduce:animate-none">Opening the studio…</p>,
});
const Instructions = dynamic(() => import('@/components/teaching/Instructions'), {
  ssr: false,
  loading: () => <aside className="w-full lg:w-96 shrink-0 p-4 text-sm text-gray-400">Loading the lesson…</aside>,
});
const LessonBrowser = dynamic(() => import('@/components/teaching/LessonBrowser'), { ssr: false });
const ReviewSession = dynamic(() => import('@/components/teaching/ReviewSession'), { ssr: false });
const Welcome = dynamic(() => import('@/components/onboarding/Welcome'), { ssr: false });

type View = 'instrument' | 'studio';

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hub.init();
    arranger.init();
    // after the hub: undo history never sits between a knob and its engine
    history.init();
    setHydrated(true);
    // Fetch the on-demand views once the page is idle, so the first click on the
    // Studio tab or a lesson is instant while the first download stays small
    const prefetch = () => {
      void import('@/components/studio/StudioView');
      void import('@/components/teaching/Instructions');
      void import('@/components/teaching/LessonBrowser');
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(prefetch, { timeout: 1500 });
    else setTimeout(prefetch, 1200); // Safari has no requestIdleCallback
  }, []);
  if (!hydrated) return <div className="min-h-screen bg-hardware-bg" />;
  return <App />;
}

function App() {
  const currentDevice = useStudioStore(s => s.currentDevice);
  const rack = useStudioStore(s => s.studio.rack);
  const setCurrentDevice = useStudioStore(s => s.setCurrentDevice);
  const addToRack = useStudioStore(s => s.addToRack);
  const startLesson = useStudioStore(s => s.startLesson);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const currentLesson = useStudioStore(s => s.currentLesson);
  const lessonInstance = useStudioStore(s => s.lessonInstance);
  const completed = useStudioStore(s => s.completedLessons);
  const review = useStudioStore(s => s.review);
  const deviceOf = useStudioStore(s => s.deviceOf);
  const [view, setView] = useState<View>('instrument');
  const [module, setModule] = useState<DeviceModule | null>(null);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [projectMsg, setProjectMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // First visit: welcome screen
  useEffect(() => {
    try { if (!localStorage.getItem('synth-studio-welcomed')) setWelcomeOpen(true); } catch { /* private mode */ }
  }, []);

  // Messages ask for a project save / open (storage full, Home Screen import)
  const projectName = useCallback(() => {
    const st = useStudioStore.getState();
    const dev = st.deviceOf(st.currentDevice);
    const e = DEVICES.find(d => d.id === dev);
    return e ? `${e.name} session` : 'My track';
  }, []);
  useEffect(() => {
    const save = () => downloadProject(projectName());
    const open = () => fileRef.current?.click();
    window.addEventListener('synth-studio:save-project', save);
    window.addEventListener('synth-studio:open-project', open);
    return () => {
      window.removeEventListener('synth-studio:save-project', save);
      window.removeEventListener('synth-studio:open-project', open);
    };
  }, [projectName]);

  // Home Screen apps on iPad get their own, empty storage: offer to bring a project over.
  // And now and then, a nudge to keep a project file (browsers can clear site data).
  useEffect(() => {
    let first = false;
    try { first = !localStorage.getItem('synth-studio-launched'); localStorage.setItem('synth-studio-launched', String(Date.now())); } catch { /* */ }
    if (first && isStandalone()) {
      showNotice({
        id: 'home-import', level: 'info', once: true,
        text: 'This Home Screen app keeps its own storage, separate from Safari. Started a project in Safari? Save it there (Project ▾ → Save project to a file), then open the file here.',
        action: { label: 'Open project file…', run: () => window.dispatchEvent(new CustomEvent('synth-studio:open-project')) },
      });
    }
    const t = setTimeout(() => {
      const st = useStudioStore.getState().studio;
      const worked = st.rack.length > 1 || st.arrangement.sections.length > 0 || history.depth.undo >= 15;
      if (worked && Date.now() - lastProjectExport() > 7 * 86_400_000) {
        showNotice({
          id: 'export', level: 'info',
          text: 'Your studio saves in this browser, but browsers can clear site data (and iPad Home Screen apps keep their own). Keep a copy: save the project to a file now and then.',
          action: { label: 'Save project to a file', run: () => window.dispatchEvent(new CustomEvent('synth-studio:save-project')) },
        });
      }
    }, 15 * 60_000);
    return () => clearTimeout(t);
  }, []);
  // The Producer path follows its steps: a step on an instrument shows that instrument, a step
  // about the mixer, the master, the arranger or the rack shows the studio. Only when a step
  // begins, so the learner can still look around within a step.
  const currentStep = useStudioStore(s => s.currentStep);
  useEffect(() => {
    if (!isTeaching || !currentLesson || currentLesson.path !== 'producer') return;
    const step = currentLesson.steps[currentStep];
    if (!step) return;
    if (step.area && step.area !== 'transport') { setView('studio'); return; }
    const ref = step.instance;
    if (!ref || ref === 'studio') return;
    const now = useStudioStore.getState().studio.rack;
    const inst = now.find(r => r.id === ref)?.id ?? now.find(r => r.device === ref)?.id;
    if (inst) { setCurrentDevice(inst); setView('instrument'); }
  }, [isTeaching, currentLesson, currentStep, setCurrentDevice]);

  const closeWelcome = () => {
    setWelcomeOpen(false);
    try { localStorage.setItem('synth-studio-welcomed', '1'); } catch { /* ignore */ }
  };
  const onWelcome = (c: WelcomeChoice) => {
    closeWelcome();
    hub.ensureAudio();
    if (c === 'learn') { openInstrument('sub37'); setTimeout(() => setLessonsOpen(true), 300); }
    if (c === 'explore') setDevicesOpen(true);
    if (c === 'track' || c === 'moog-studio') setView('studio');
  };

  const focusInstance = rack.some(r => r.id === currentDevice) ? currentDevice : rack[0]?.id;
  const focusDevice = focusInstance ? deviceOf(focusInstance) : 'dfam';
  const entry = DEVICES.find(d => d.id === focusDevice);
  const onModuleLoaded = useCallback((m: DeviceModule) => setModule(m), []);
  const lessons = useMemo(() => (module?.spec.id === focusDevice ? module.lessons : []), [module, focusDevice]);
  const dueCount = dueReviewItems(review).length;

  const nextLesson = useMemo(() => {
    if (!currentLesson) return undefined;
    const pool = currentLesson.device === 'studio' ? STUDIO_LESSONS : lessons;
    const sorted = [...pool].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const i = sorted.findIndex(l => l.id === currentLesson.id);
    return i >= 0 ? sorted[i + 1] : undefined;
  }, [lessons, currentLesson]);

  const focus = (instance: string) => {
    setCurrentDevice(instance);
    setView('instrument');
  };

  /**
   * Open an instrument from the picker. With a single instrument (the normal
   * case) it is swapped, like changing instruments in the original app: the old
   * one stops. Once you have built a studio (2+ instruments) it opens as a tab
   * and plays along with the rest.
   */
  const openInstrument = (deviceId: string) => {
    const st = useStudioStore.getState();
    const existing = st.studio.rack.find(r => r.device === deviceId);
    if (existing) { focus(existing.id); return; }
    if (st.studio.rack.length <= 1) {
      const id = st.replaceInRack(focusInstance ?? st.studio.rack[0]?.id, deviceId);
      focus(id);
    } else {
      const id = addToRack(deviceId);
      focus(id);
    }
  };
  const addInstrumentToStudio = (deviceId: string) => {
    const st = useStudioStore.getState();
    const dup = st.studio.rack.some(r => r.device === deviceId);
    const id = addToRack(deviceId, { duplicate: dup });
    focus(id);
  };
  const singleInstrument = rack.length <= 1;

  const begin = (lesson: Lesson) => {
    hub.ensureAudio();
    startLesson(lesson);
    setLessonsOpen(false);
    setView(lesson.device === 'studio' ? 'studio' : 'instrument');
  };

  const labelFor = (id: string) => {
    const r = rack.find(x => x.id === id);
    const e = DEVICES.find(d => d.id === r?.device);
    return r?.label ?? (id.includes('#') ? `${e?.name ?? id} ${id.split('#')[1]}` : e?.name ?? id);
  };

  const coachVisible = isTeaching && currentLesson && (
    currentLesson.device === 'studio' ? true : view === 'instrument' && lessonInstance === focusInstance
  );

  return (
    <div className="min-h-screen bg-hardware-bg px-3 py-3 sm:px-5">
      <header className="max-w-[1800px] mx-auto mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-2">
          <h1 className="text-lg xl:text-xl font-bold text-white leading-none">SYNTH STUDIO</h1>
          <p className="text-[11px] text-hardware-label mt-0.5 hidden xl:block">Play it. Patch it. Understand it.</p>
        </div>
        <TransportBar />
      </header>

      <div className="max-w-[1800px] mx-auto"><SystemNotices /></div>
      {projectMsg && <p className="max-w-[1800px] mx-auto text-xs text-sky-300 mb-2">{projectMsg}</p>}

      {/* Rack tabs: Studio overview + one tab per instrument */}
      <div className="max-w-[1800px] mx-auto mb-3 flex items-center gap-2">
        <nav className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Instruments">
          <TabButton active={view === 'studio'} onClick={() => setView('studio')}>
            ◫ Studio <span className="text-[10px] text-gray-400 ml-1">{rack.length}</span>
          </TabButton>
          {rack.map(r => (
            <TabButton key={r.id} active={view === 'instrument' && r.id === focusInstance} onClick={() => focus(r.id)}>
              {labelFor(r.id)}
            </TabButton>
          ))}
          <button onClick={() => setDevicesOpen(true)} className="px-3 py-2 rounded-lg text-sm text-gray-300 border border-dashed border-[#444] hover:border-[#666] whitespace-nowrap">
            {singleInstrument ? 'Instruments…' : '+ Instrument'}
          </button>
        </nav>
        <div className="shrink-0 flex items-center gap-2">
          <UndoRedo />
          <button
            onClick={() => setReviewOpen(true)}
            className={`px-3 py-2 rounded-lg text-sm border ${dueCount ? 'border-sky-500 text-sky-200 bg-sky-950/40' : 'border-[#3a3a3a] text-gray-300'}`}
            title="Spaced review of what you've learned"
          >
            Review{dueCount ? ` (${dueCount})` : ''}
          </button>
          <button
            onClick={() => setLessonsOpen(true)}
            className="px-4 py-2 bg-teaching-current text-black font-bold rounded-lg text-sm hover:brightness-110"
          >
            Lessons
            {lessons.length > 0 && <span className="ml-2 text-[11px] font-normal">{lessons.filter(l => completed.includes(l.id)).length}/{lessons.length}</span>}
          </button>
          <button onClick={() => setWelcomeOpen(true)} className="px-3 py-2 rounded-lg text-sm border border-[#3a3a3a] text-gray-300" title="Getting started">
            ?
          </button>
          <MidiButton />
          <ProjectMenu
            onSave={() => downloadProject(projectName())}
            onOpen={() => fileRef.current?.click()}
            onNew={() => { if (confirm('Start a new empty project? Save first if you want to keep this one.')) newProject(); }}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { setProjectMsg(`Loaded “${await importProject(f)}”`); } catch (err) { setProjectMsg(String(err)); }
              e.target.value = '';
              setTimeout(() => setProjectMsg(null), 4000);
            }}
          />
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">
          {view === 'studio' ? (
            <StudioView onAddInstrument={() => setDevicesOpen(true)} onFocus={focus} />
          ) : focusInstance ? (
            <DeviceHost instance={focusInstance} keyboardActive onModuleLoaded={onModuleLoaded} />
          ) : null}
        </div>
        {coachVisible && (
          <Instructions spec={module?.spec ?? null} onNextLesson={nextLesson ? () => begin(nextLesson) : undefined} />
        )}
      </main>

      <footer className="max-w-[1800px] mx-auto mt-8 text-center text-[11px] text-hardware-label space-y-1">
        <p>Synth Studio · educational recreations, not affiliated with Moog, Elektron or Allen &amp; Heath.</p>
        {module?.spec.manualUrl && (
          <p>
            <a href={module.spec.manualUrl} target="_blank" rel="noopener noreferrer" className="hover:text-teaching-current underline">
              {module.spec.manufacturer} {module.spec.name} manual
            </a>
          </p>
        )}
      </footer>

      {welcomeOpen && <Welcome open={welcomeOpen} onClose={closeWelcome} onChoose={onWelcome} />}

      {/* Instrument picker */}
      <Dialog.Root open={devicesOpen} onOpenChange={setDevicesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-5 w-[calc(100%-2rem)] max-w-3xl shadow-2xl z-50 max-h-[88dvh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-white mb-1">Instruments</Dialog.Title>
            <Dialog.Description className="text-xs text-hardware-label mb-4">
              {singleInstrument
                ? 'Switch to another instrument, or add it to your studio to play several together.'
                : 'Open an instrument, or add another one. Everything in your studio plays together.'}
            </Dialog.Description>
            {(['Percussion', 'Synthesizer', 'Groovebox', 'DJ Mixer', 'Studio', 'External'] as const).map(cat => {
              const items = DEVICES.filter(d => d.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} className="mb-4">
                  <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">{cat}</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {items.map(d => {
                      const inRack = rack.some(r => r.device === d.id);
                      return (
                        <div key={d.id} className={`p-3 rounded border ${inRack ? 'border-[#3f5a3f] bg-[#132013]' : 'border-[#3a3a3a] bg-[#1a1a1a]'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-hardware-label">{d.manufacturer}</span>
                            {inRack && <span className="text-[10px] text-green-400">in studio</span>}
                          </div>
                          <div className="font-bold text-white mt-0.5">{d.name}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{d.tagline}</div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => { openInstrument(d.id); setDevicesOpen(false); }} className="px-3 py-1.5 rounded bg-teaching-current text-black text-xs font-bold">
                              {inRack ? 'Open' : singleInstrument ? 'Switch to this' : 'Open'}
                            </button>
                            <button
                              onClick={() => { addInstrumentToStudio(d.id); setDevicesOpen(false); }}
                              className="px-3 py-1.5 rounded bg-[#2a2a2a] text-white text-xs"
                              title="Keep what you have and add this one - everything in the studio plays together"
                            >
                              {inRack ? 'Add another' : 'Add to studio'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="mt-2 flex justify-end">
              <Dialog.Close asChild><button className="px-4 py-2 bg-[#3a3a3a] text-white rounded text-sm">Close</button></Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Lessons */}
      <Dialog.Root open={lessonsOpen} onOpenChange={setLessonsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-5 w-[calc(100%-2rem)] max-w-2xl shadow-2xl z-50 max-h-[90dvh] flex flex-col">
            <Dialog.Title className="text-lg font-bold text-white">{entry?.name ?? 'Instrument'} lessons</Dialog.Title>
            <Dialog.Description className="text-xs text-hardware-label mb-3">
              Short, hands-on lessons. You will predict, listen, match sounds by ear and explain ideas in your own words - the
              things that make learning stick.
            </Dialog.Description>
            <LessonBrowser lessons={lessons} studioLessons={STUDIO_LESSONS} deviceName={entry?.name ?? 'Instrument'} completed={completed} onStart={begin} />
            <div className="mt-3 flex justify-end">
              <Dialog.Close asChild><button className="px-4 py-2 bg-[#3a3a3a] text-white rounded text-sm">Close</button></Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Daily review */}
      <Dialog.Root open={reviewOpen} onOpenChange={setReviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-5 w-[calc(100%-2rem)] max-w-lg shadow-2xl z-50 max-h-[88dvh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-white mb-1">Daily review</Dialog.Title>
            <Dialog.Description className="text-xs text-hardware-label mb-3">A few quick questions from earlier lessons, timed to come back just before you would forget them.</Dialog.Description>
            {reviewOpen && <ReviewSession onClose={() => setReviewOpen(false)} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border ${active ? 'bg-[#2a2a2a] border-[#555] text-white font-bold' : 'bg-[#171717] border-[#2a2a2a] text-gray-300 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function ProjectMenu({ onSave, onOpen, onNew }: { onSave: () => void; onOpen: () => void; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Close on a tap anywhere else (iPad has no mouseleave), or Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="px-3 py-2 rounded-lg text-sm border border-[#3a3a3a] text-gray-300" aria-expanded={open}>
        Project ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-[#1b1b1b] border border-[#3a3a3a] rounded-lg shadow-2xl z-30 p-1">
          <MenuItem onClick={() => { onSave(); setOpen(false); }}>Save project to a file</MenuItem>
          <MenuItem onClick={() => { onOpen(); setOpen(false); }}>Open project file…</MenuItem>
          <MenuItem onClick={() => { onNew(); setOpen(false); }}>New empty project</MenuItem>
          <p className="text-[10px] text-gray-500 px-2 py-1.5">Your work also saves automatically in this browser. Use REC or Bounce… in the top bar to export WAV files and stems.</p>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-[#2a2a2a]">
      {children}
    </button>
  );
}
