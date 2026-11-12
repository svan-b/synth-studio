'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { noteBus } from '@/lib/piano/input/bus';
import { input } from '@/lib/piano/input/hub';
import { midi } from '@/lib/piano/input/midi';
import { planSession, type Block } from '@/lib/piano/learn/planner';
import { usePiano } from '@/lib/piano/learn/store';
import Drill from './Drills';
import { useApplySettings, useInputMode, useRemote, useTheme } from './hooks';
import LessonPlayer from './LessonPlayer';
import Onboarding from './Onboarding';
import PracticeRoom from './PracticeRoom';
import { LearnScreen, MethodScreen, PiecesScreen, ProgressScreen, SettingsScreen, TodayScreen, TrainScreen, type Activity, type View } from './Screens';
import { Button, Icon } from './ui';

const NAV: Array<{ view: View; label: string; icon: (p: { size?: number }) => JSX.Element }> = [
  { view: 'today', label: 'Today', icon: Icon.Today },
  { view: 'learn', label: 'Learn', icon: Icon.Learn },
  { view: 'pieces', label: 'Pieces', icon: Icon.Pieces },
  { view: 'train', label: 'Train', icon: Icon.Train },
  { view: 'progress', label: 'Progress', icon: Icon.Progress },
  { view: 'settings', label: 'Settings', icon: Icon.Settings },
];

function BlockActivity({ block, onClose }: { block: Block; onClose: () => void }) {
  if (block.kind === 'lesson') return <LessonPlayer lessonId={block.id} onClose={onClose} />;
  if (block.kind === 'piece') return <PracticeRoom pieceId={block.id} minutes={block.minutes} onClose={onClose} />;
  return <Drill kind={block.id} onClose={onClose} />;
}

/** Runs the parts of a daily session one after another. */
function SessionRunner({ blocks, onClose }: { blocks: Block[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [between, setBetween] = useState(true);
  const finishSession = usePiano((s) => s.finishSession);
  const mode = useInputMode();
  const done = index >= blocks.length;
  const marked = useRef(false);

  useEffect(() => {
    if (done && !marked.current) {
      marked.current = true;
      finishSession();
      piano.chime();
    }
  }, [done, finishSession]);

  const start = useCallback(() => setBetween(false), []);
  const afterBlock = useCallback(() => {
    setIndex((i) => i + 1);
    setBetween(true);
  }, []);
  useRemote({ primary: done ? onClose : between ? start : undefined, secondary: between ? onClose : undefined }, between || done);

  if (!done && !between) return <BlockActivity key={index} block={blocks[index]} onClose={afterBlock} />;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-mc-bg px-8 text-center mc-safe-top mc-safe-bottom">
      {done ? (
        <>
          <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
            <Icon.Check size={44} />
          </div>
          <div className="mc-fade-up">
            <h2 className="font-mc-serif text-5xl">Session complete</h2>
            <p className="mx-auto mt-3 max-w-xl text-[1.15rem] leading-relaxed text-mc-muted">
              That is today done. What you worked on keeps settling after you stop, and it will feel easier next time. Come back tomorrow.
            </p>
          </div>
          <Button size="lg" onClick={onClose} className="min-w-[220px]">
            Finish
          </Button>
        </>
      ) : (
        <>
          <div className="mc-fade-up">
            <div className="text-sm font-semibold uppercase tracking-widest text-mc-muted">
              {index === 0 ? 'First' : 'Next'}, part {index + 1} of {blocks.length}
            </div>
            <h2 className="mt-2 font-mc-serif text-5xl">{blocks[index].title}</h2>
            <p className="mt-3 text-[1.15rem] text-mc-muted">
              {blocks[index].detail}. About {blocks[index].minutes} minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {blocks.map((_, i) => (
              <span key={i} className={`h-2.5 rounded-full ${i < index ? 'w-2.5 bg-mc-ok' : i === index ? 'w-8 bg-mc-ink' : 'w-2.5 bg-mc-line'}`} />
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={onClose}>
              Stop for today
            </Button>
            <Button size="lg" onClick={start} className="min-w-[220px]" hint={mode === 'midi' ? 'or the top key' : undefined}>
              {index === 0 ? 'Start' : 'Continue'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const theme = useTheme();
  const onboarded = usePiano((s) => s.profile.onboarded);
  const autoMidi = usePiano((s) => s.settings.autoMidi);
  const [view, setView] = useState<View>('today');
  const [activity, setActivity] = useState<Activity | null>(null);
  useApplySettings();

  // Sound can only start from a tap, so the first touch anywhere unlocks it
  // and, where the browser has MIDI, reconnects the piano.
  useEffect(() => {
    let done = false;
    const unlock = () => {
      if (done) return;
      done = true;
      void piano.unlock();
      if (autoMidi && onboarded && midi.getStatus().webMidi && midi.getStatus().state === 'idle') void midi.connect();
      window.removeEventListener('pointerdown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    return () => window.removeEventListener('pointerdown', unlock, true);
  }, [autoMidi, onboarded]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mcdebug')) {
      // Development tools, loaded only when asked for in the address.
      void Promise.all([import('@/lib/piano/dev/robot'), import('@/lib/piano/content/catalog'), import('@/lib/piano/engine/flow')]).then(
        ([robot, catalog, flow]) => {
          (window as unknown as { __mc: unknown }).__mc = { piano, midi, noteBus, input, store: usePiano, robot, catalog, flow, planSession };
        },
      );
    }
  }, []);

  // Keep the app and its piano samples on the device, so it opens without a connection.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/piano-sw.js', { scope: '/piano' }).catch(() => undefined);
  }, []);

  const close = useCallback(() => setActivity(null), []);

  return (
    <div className="mc-root" data-theme={theme}>
      <div className="flex h-full landscape:flex-row portrait:flex-col-reverse">
        <nav
          className="flex shrink-0 border-mc-line bg-mc-surface/70 landscape:w-[88px] landscape:flex-col landscape:border-r landscape:py-5 portrait:h-[72px] portrait:border-t portrait:px-2 mc-safe-bottom"
          aria-label="Main"
        >
          <div className="mb-5 hidden items-center justify-center landscape:flex">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mc-ink font-mc-serif text-xl text-mc-bg">C</span>
          </div>
          {NAV.map((item) => {
            const active = view === item.view || (item.view === 'settings' && view === 'method');
            const I = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors landscape:max-h-[76px] ${
                  item.view === 'settings' ? 'landscape:mt-auto landscape:flex-none landscape:py-3' : ''
                } ${active ? 'text-mc-ink' : 'text-mc-faint'}`}
              >
                <span className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-mc-ink/10' : ''}`}>
                  <I size={22} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 mc-safe-top">
          {view === 'today' && <TodayScreen onStart={setActivity} onGo={setView} />}
          {view === 'learn' && <LearnScreen onStart={setActivity} />}
          {view === 'pieces' && <PiecesScreen onStart={setActivity} />}
          {view === 'train' && <TrainScreen onStart={setActivity} />}
          {view === 'progress' && <ProgressScreen />}
          {view === 'settings' && <SettingsScreen onGo={setView} />}
          {view === 'method' && <MethodScreen onGo={setView} />}
        </main>
      </div>

      {activity?.kind === 'lesson' && <LessonPlayer lessonId={activity.id} onClose={close} />}
      {activity?.kind === 'piece' && <PracticeRoom pieceId={activity.id} minutes={activity.minutes} onClose={close} />}
      {activity?.kind === 'drill' && <Drill kind={activity.id} onClose={close} />}
      {activity?.kind === 'session' && <SessionRunner blocks={activity.blocks} onClose={close} />}
      {!onboarded && <Onboarding onDone={() => setView('today')} />}
    </div>
  );
}
