'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { isNative, onWake } from '@/lib/piano/native/bridge';
import { instrument } from '@/lib/piano/audio/instrument';
import { noteBus } from '@/lib/piano/input/bus';
import { input } from '@/lib/piano/input/hub';
import { midi } from '@/lib/piano/input/midi';
import { getLesson, pieceInfo } from '@/lib/piano/content/catalog';
import { pieceProgress } from '@/lib/piano/learn/coach';
import { currentPiece, planDay, planSession, type Block } from '@/lib/piano/learn/planner';
import { streak, usePiano } from '@/lib/piano/learn/store';
import { dayKey } from '@/lib/piano/util/emitter';
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

/** What a session changed, as a short list for the screen that closes it. */
function recap(before: ReturnType<typeof usePiano.getState>, parts: Block[]): Array<[string, string]> {
  const now = usePiano.getState();
  const rows: Array<[string, string]> = [];
  const minutes = Math.round((now.days[dayKey()]?.seconds ?? 0) / 60);
  if (minutes > 0) rows.push(['At the piano today', minutes === 1 ? '1 minute' : `${minutes} minutes`]);
  for (const b of parts) {
    if (b.kind === 'lesson' && now.lessons[b.id]?.done && !before.lessons[b.id]?.done) rows.push(['New lesson', getLesson(b.id).title]);
  }
  const seen = new Set<string>();
  for (const b of parts) {
    if (b.kind !== 'piece' || seen.has(b.id)) continue;
    seen.add(b.id);
    const info = pieceInfo(b.id);
    const was = before.pieces[b.id];
    const is = now.pieces[b.id];
    if (!is) continue;
    // Only what was played in this session is spoken for. A piece that was opened and left alone says nothing.
    const today = dayKey();
    const played = is.lastOn === today && (was?.lastOn !== today || is.tasksToday > (was?.tasksToday ?? 0));
    if (!played) continue;
    if (is.learned && !was?.learned) rows.push([info.title, 'Learned']);
    else if (is.learned) rows.push([info.title, is.wholeRung >= 3 ? 'Still in your fingers' : 'A little rusty, and coming back']);
    else {
      const from = Math.round(pieceProgress(info, was) * 100);
      const to = Math.round(pieceProgress(info, is) * 100);
      if (to > from) rows.push([info.title, `${from} to ${to} percent learned`]);
    }
  }
  const run = streak(now.days);
  if (run >= 2) rows.push(['Days in a row', String(run)]);
  return rows;
}

/** What tomorrow's session opens with, to give the next visit something to come back to. */
function tomorrow(): string | null {
  const s = usePiano.getState();
  const day = planDay({ minutes: s.profile.minutes, lessons: s.lessons, pieces: s.pieces, cards: s.cards, days: s.days, drills: s.drills, now: new Date(Date.now() + 86400000) });
  const plan = day.blocks;
  const first = plan.find((b) => b.kind === 'lesson') ?? plan.find((b) => b.kind === 'piece') ?? plan[0];
  if (!first) return null;
  if (first.kind === 'lesson') return `Tomorrow brings a new lesson, ${first.title}.`;
  if (first.kind !== 'piece') return null;
  // Where the next lesson is waiting on the pieces, say so, so that a day without one is no surprise.
  return day.held === 'pieces' ? `Tomorrow carries on with ${first.title}. The next lesson waits until your pieces are further along.` : `Tomorrow carries on with ${first.title}.`;
}

/** Runs the parts of a daily session one after another. */
function SessionRunner({ blocks: planned, onClose }: { blocks: Block[]; onClose: () => void }) {
  // The parts can grow: when a piece is learned with time to spare, the next piece takes the rest of it.
  const [blocks, setBlocks] = useState(planned);
  const [index, setIndex] = useState(0);
  const [between, setBetween] = useState(true);
  const finishSession = usePiano((s) => s.finishSession);
  const mode = useInputMode();
  const done = index >= blocks.length;
  const marked = useRef(false);
  const before = useRef(usePiano.getState());
  const blockStarted = useRef(0);
  const [summary, setSummary] = useState<{ rows: Array<[string, string]>; next: string | null } | null>(null);

  useEffect(() => {
    if (done && !marked.current) {
      marked.current = true;
      finishSession();
      instrument.chime();
      setSummary({ rows: recap(before.current, blocks), next: tomorrow() });
    }
  }, [blocks, done, finishSession]);

  const start = useCallback(() => {
    blockStarted.current = performance.now();
    setBetween(false);
  }, []);
  const afterBlock = useCallback(() => {
    // A lesson that was closed part way is not finished. The session stays on
    // it, so it can be picked up again or the session stopped.
    const block = blocks[index];
    const state = usePiano.getState();
    const unfinished = block?.kind === 'lesson' && state.lessons[block.id]?.done !== true;
    if (!unfinished) {
      // A piece learned well inside its time leaves room to begin the next one.
      const used = (performance.now() - blockStarted.current) / 60000;
      const left = block?.kind === 'piece' ? Math.floor(block.minutes - used) : 0;
      const justLearned = block?.kind === 'piece' && state.pieces[block.id]?.learned === true && before.current.pieces[block.id]?.learned !== true;
      const nextPiece = justLearned && left >= 3 ? currentPiece(state.lessons, state.pieces) : null;
      if (nextPiece && !blocks.some((b) => b.kind === 'piece' && b.id === nextPiece)) {
        const info = pieceInfo(nextPiece);
        const extra: Block = { kind: 'piece', id: nextPiece, minutes: left, title: info.title, detail: 'There is time left, so on to the next piece' };
        setBlocks((list) => [...list.slice(0, index + 1), extra, ...list.slice(index + 1)]);
      }
      setIndex((i) => i + 1);
    }
    setBetween(true);
  }, [blocks, index]);
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
            {summary && summary.rows.length > 0 && (
              <dl className="mx-auto mt-6 w-full max-w-md divide-y divide-mc-line rounded-2xl bg-mc-surface px-5 text-left">
                {summary.rows.map(([label, value]) => (
                  <div key={`${label}-${value}`} className="flex items-baseline justify-between gap-6 py-2.5">
                    <dt className="text-mc-muted">{label}</dt>
                    <dd className="text-right font-semibold text-mc-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-mc-muted">
              What you worked on keeps settling after you stop, and it will feel easier next time. {summary?.next ?? 'Come back tomorrow.'}
            </p>
          </div>
          <Button size="lg" onClick={onClose} className="min-w-[220px]" hint={mode === 'midi' ? 'top key' : undefined}>
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
              {blocks[index].detail.replace(/[.\s]+$/, '')}. About {blocks[index].minutes} minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {blocks.map((_, i) => (
              <span key={i} className={`h-2.5 rounded-full ${i < index ? 'w-2.5 bg-mc-ok' : i === index ? 'w-8 bg-mc-ink' : 'w-2.5 bg-mc-line'}`} />
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={onClose} hint={mode === 'midi' ? 'or the bottom key' : undefined}>
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

  // Browsers only let sound start in answer to a deliberate action. On a
  // touch screen that means lifting the finger, not putting it down. So every
  // tap, click and key press wakes the sound if it is asleep, and the first
  // one also reconnects the piano where the browser has MIDI.
  useEffect(() => {
    let reconnected = false;
    const wake = () => {
      void piano.unlock();
      if (!reconnected) {
        reconnected = true;
        if (autoMidi && onboarded && midi.getStatus().webMidi && midi.getStatus().state === 'idle') void midi.connect();
      }
    };
    const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, wake, true));
    return () => events.forEach((e) => window.removeEventListener(e, wake, true));
  }, [autoMidi, onboarded]);

  // The iPad app has MIDI built in and needs no permission, so it looks for
  // the piano as soon as it opens and keeps looking.
  // It may also start its sound without a tap, so sound is ready before the
  // first key is played, and again each time the app comes back to the front.
  useEffect(() => {
    if (!isNative()) return;
    void midi.connect();
    void piano.unlock();
    onWake(() => void piano.unlock());
    // Hands may never touch the screen. A key played on the piano wakes the sound too.
    return noteBus.subscribe((ev) => {
      if (ev.type === 'on' && ev.source === 'midi') void piano.unlock();
    });
  }, []);

  // Once a piano has been connected by hand, later visits reconnect to it by
  // themselves. Until then the browser is not asked for MIDI unprompted.
  useEffect(
    () =>
      midi.status.subscribe((st) => {
        const s = usePiano.getState();
        if (st.state === 'connected' && st.inputs.length > 0 && !s.settings.autoMidi) s.setSettings({ autoMidi: true });
      }),
    [],
  );

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
    // The iPad app carries its files inside it, so it has no need of this.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || isNative()) return;
    navigator.serviceWorker.register('/piano-sw.js', { scope: '/piano' }).catch(() => undefined);
  }, []);

  const close = useCallback(() => setActivity(null), []);

  const behind = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // While the welcome screens are up, what lies behind them cannot be reached.
    behind.current?.toggleAttribute('inert', !onboarded);
    if (onboarded) behind.current?.removeAttribute('aria-hidden');
    else behind.current?.setAttribute('aria-hidden', 'true');
  }, [onboarded]);

  return (
    <div className="mc-root" data-theme={theme}>
      <div ref={behind} className="flex h-full landscape:flex-row portrait:flex-col-reverse">
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
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors landscape:max-h-[76px] ${
                  item.view === 'settings' ? 'landscape:mt-auto landscape:flex-none landscape:py-3' : ''
                } ${active ? 'text-mc-ink' : 'text-mc-muted'}`}
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
