'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { isNative, onWake } from '@/lib/piano/native/bridge';
import { instrument } from '@/lib/piano/audio/instrument';
import { noteBus } from '@/lib/piano/input/bus';
import { input } from '@/lib/piano/input/hub';
import { midi } from '@/lib/piano/input/midi';
import { getLesson, pieceInfo } from '@/lib/piano/content/catalog';
import { pieceProgress } from '@/lib/piano/learn/coach';
import { currentPiece, planDay, planSession, type Block } from '@/lib/piano/learn/planner';
import { saveTrouble, streak, usePiano, type SessionBase } from '@/lib/piano/learn/store';
import { addDays, dayKey, noonOf } from '@/lib/piano/util/emitter';
import Drill from './Drills';
import { useApplySettings, useHints, useRemote, useTheme, useWakeLock } from './hooks';
import LessonPlayer from './LessonPlayer';
import Onboarding from './Onboarding';
import PracticeRoom from './PracticeRoom';
import { SessionContext, type SessionLink } from './session';
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

function BlockActivity({ block, onClose }: { block: Block; onClose: (finished: boolean) => void }) {
  if (block.kind === 'lesson') return <LessonPlayer lessonId={block.id} onClose={(completed) => onClose(completed)} />;
  if (block.kind === 'piece') return <PracticeRoom pieceId={block.id} minutes={block.minutes} onClose={(finished) => onClose(finished === true)} />;
  return <Drill kind={block.id} onClose={(finished) => onClose(finished === true)} />;
}

/** What a session changed, as a short list for the screen that closes it. */
function recap(before: SessionBase, parts: Block[]): Array<[string, string]> {
  const now = usePiano.getState();
  const rows: Array<[string, string]> = [];
  const minutes = Math.round((now.days[dayKey()]?.seconds ?? 0) / 60);
  if (minutes > 0) rows.push(['At the piano today', minutes === 1 ? '1 minute' : `${minutes} minutes`]);
  for (const b of parts) {
    if (b.kind === 'lesson' && now.lessons[b.id]?.done && !before.lessons[b.id]) rows.push(['New lesson', getLesson(b.id).title]);
  }
  const seen = new Set<string>();
  for (const b of parts) {
    if (b.kind !== 'piece' || seen.has(b.id)) continue;
    seen.add(b.id);
    const info = pieceInfo(b.id);
    const was = before.pieces[b.id] ?? undefined;
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
  const day = planDay({ minutes: s.profile.minutes, lessons: s.lessons, pieces: s.pieces, cards: s.cards, days: s.days, drills: s.drills, now: noonOf(addDays(dayKey(), 1)) });
  const plan = day.blocks;
  const first = plan.find((b) => b.kind === 'lesson') ?? plan.find((b) => b.kind === 'piece') ?? plan[0];
  if (!first) return null;
  if (first.kind === 'lesson') return `Tomorrow brings a new lesson, ${first.title}.`;
  if (first.kind !== 'piece') return null;
  // Where the next lesson is waiting on the pieces, say so, so that a day without one is no surprise.
  return day.held === 'pieces' ? `Tomorrow carries on with ${first.title}. The next lesson waits until your pieces are further along.` : `Tomorrow carries on with ${first.title}.`;
}

/** How the lessons and pieces of these parts stand now, to measure the session against when it ends. */
function baseOf(parts: Block[]): SessionBase {
  const state = usePiano.getState();
  const base: SessionBase = { lessons: {}, pieces: {} };
  for (const b of parts) {
    if (b.kind === 'lesson') base.lessons[b.id] = state.lessons[b.id]?.done === true;
    else if (b.kind === 'piece') base.pieces[b.id] = state.pieces[b.id] ?? null;
  }
  return base;
}

/** Runs the parts of a daily session one after another. */
function SessionRunner({
  blocks: planned,
  from = 0,
  skipped: passed,
  base: began,
  onClose,
}: {
  blocks: Block[];
  from?: number;
  skipped?: number[];
  base?: SessionBase;
  onClose: () => void;
}) {
  // The parts can grow: when a piece is learned with time to spare, the next piece takes the rest of it.
  const [blocks, setBlocks] = useState(planned);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(from, planned.length)));
  // Parts that were passed over. They are behind, and they are not done.
  const [skipped, setSkipped] = useState<number[]>(() => passed ?? []);
  // A session goes straight into its first part, and from each finished part straight into the
  // next: the screen that closes a part says what follows. This screen in between is shown only
  // where there is something to decide: a part was left part way, or passed over.
  const [between, setBetween] = useState<null | 'left' | 'next'>(null);
  const finishSession = usePiano((s) => s.finishSession);
  const keepSession = usePiano((s) => s.keepSession);
  const lessons = usePiano((s) => s.lessons);
  const hints = useHints();
  useWakeLock(true);
  const done = index >= blocks.length;
  const marked = useRef(false);
  const base = useRef<SessionBase>(began ?? baseOf(planned));
  const blockStarted = useRef(performance.now());
  // The day the session belongs to. One that runs past midnight is still the day it began.
  const startedOn = useRef(dayKey());
  const [summary, setSummary] = useState<{ rows: Array<[string, string]>; next: string | null } | null>(null);
  // A session in which nothing was finished has not been done. It is put back as it was.
  const nothingDone = done && skipped.length >= blocks.length;

  // Where the session stands is kept as it goes, so that stopping, or the app closing, loses nothing.
  useEffect(() => {
    if (!done) keepSession({ on: startedOn.current, blocks, index, skipped, base: base.current });
  }, [blocks, done, index, keepSession, skipped]);

  useEffect(() => {
    if (!done || marked.current) return;
    marked.current = true;
    if (nothingDone) {
      keepSession(null);
      onClose();
      return;
    }
    finishSession();
    instrument.chime();
    setSummary({ rows: recap(base.current, blocks), next: tomorrow() });
  }, [blocks, done, finishSession, keepSession, nothingDone, onClose]);

  const start = useCallback(() => {
    blockStarted.current = performance.now();
    setBetween(null);
  }, []);
  const afterBlock = useCallback(
    (finished: boolean) => {
      const block = blocks[index];
      const state = usePiano.getState();
      // A part closed before its end is not finished, whatever it is. The session stays on it,
      // to be picked up again, passed over, or left for today.
      const lessonDone = block?.kind === 'lesson' && state.lessons[block.id]?.done === true;
      if (block?.kind === 'lesson' ? !lessonDone : !finished) {
        setBetween('left');
        return;
      }
      // A piece learned well inside its time leaves room to begin the next one.
      const used = (performance.now() - blockStarted.current) / 60000;
      const left = block?.kind === 'piece' ? Math.floor(block.minutes - used) : 0;
      const justLearned = block?.kind === 'piece' && state.pieces[block.id]?.learned === true && base.current.pieces[block.id]?.learned !== true;
      const nextPiece = justLearned && left >= 3 ? currentPiece(state.lessons, state.pieces) : null;
      const extra = nextPiece !== null && !blocks.some((b) => b.kind === 'piece' && b.id === nextPiece);
      if (extra && nextPiece) {
        const info = pieceInfo(nextPiece);
        const added: Block = { kind: 'piece', id: nextPiece, minutes: left, title: info.title, detail: 'There is time left, so on to the next piece' };
        base.current.pieces[nextPiece] = state.pieces[nextPiece] ?? null;
        setBlocks((list) => [...list.slice(0, index + 1), added, ...list.slice(index + 1)]);
        // The parts after it have moved along by one.
        setSkipped((list) => list.map((i) => (i > index ? i + 1 : i)));
      }
      setIndex((i) => i + 1);
      blockStarted.current = performance.now();
      // Straight on, when the part ended on its own closing screen, which named what comes next.
      // A part nobody was told about gets a screen to say so first.
      setBetween(extra ? 'next' : null);
    },
    [blocks, index],
  );
  const skip = useCallback(() => {
    setSkipped((list) => (list.includes(index) ? list : [...list, index]));
    setIndex((i) => i + 1);
    setBetween('next');
  }, [index]);
  /** Stop from the closing screen of a part: that part is done, so the session is kept from the next one. */
  const stopAfter = useCallback(() => {
    if (index + 1 >= blocks.length) finishSession();
    else keepSession({ on: startedOn.current, blocks, index: index + 1, skipped, base: base.current });
    onClose();
  }, [blocks, finishSession, index, keepSession, onClose, skipped]);
  // The bottom key means again everywhere else, so here it does nothing. Stopping is a deliberate tap.
  useRemote({ primary: done ? onClose : between ? start : undefined, pedal: true }, between !== null || done);

  const link = useMemo<SessionLink>(() => ({ next: blocks[index + 1]?.title ?? null, stop: stopAfter }), [blocks, index, stopAfter]);

  if (!done && !between) {
    return (
      <SessionContext.Provider value={link}>
        <BlockActivity key={index} block={blocks[index]} onClose={afterBlock} />
      </SessionContext.Provider>
    );
  }
  // Nothing was finished: the effect above is putting the day back as it was.
  if (nothingDone) return null;

  const block = blocks[index];
  // A lesson left part way says how far it had got.
  const at = block?.kind === 'lesson' && lessons[block.id]?.done !== true ? (lessons[block.id]?.step ?? 0) : 0;
  const steps = block?.kind === 'lesson' ? getLesson(block.id).steps.length : 0;
  const left = between === 'left';

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
              <dl className="mx-auto mt-6 w-full max-w-lg divide-y divide-mc-line rounded-2xl bg-mc-surface px-6 text-left text-[1.25rem]">
                {summary.rows.map(([label, value]) => (
                  <div key={`${label}-${value}`} className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-mc-muted">{label}</dt>
                    <dd className="text-right font-semibold text-mc-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mx-auto mt-5 max-w-2xl text-[1.3rem] leading-relaxed text-mc-muted">
              What you worked on keeps settling after you stop, and it will feel easier next time. {summary?.next ?? 'Come back tomorrow.'}
            </p>
          </div>
          <Button size="lg" onClick={onClose} className="min-w-[240px]" hint={hints.onward}>
            Finish
          </Button>
        </>
      ) : (
        <>
          <div className="mc-fade-up">
            <div className="text-[1.1rem] font-semibold uppercase tracking-widest text-mc-muted">
              {left ? 'Left part way' : 'Next'}, part {index + 1} of {blocks.length}
            </div>
            <h2 className="mt-2 font-mc-serif text-5xl">{block.title}</h2>
            <p className="mt-3 text-[1.35rem] text-mc-muted">
              {left
                ? block.kind === 'lesson'
                  ? at > 0
                    ? `You were at step ${at + 1} of ${steps}. It opens there.`
                    : 'You closed it at its first step.'
                  : 'You closed it before its end.'
                : `${block.detail.replace(/[.\s]+$/, '')}. About ${block.minutes} minutes.`}
            </p>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            {blocks.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 rounded-full ${i === index ? 'w-8 bg-mc-ink' : i < index && !skipped.includes(i) ? 'w-2.5 bg-mc-ok' : 'w-2.5 bg-mc-line'}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="ghost" size="lg" onClick={onClose}>
              Stop for today
            </Button>
            <Button variant="soft" size="lg" onClick={skip}>
              Skip this part
            </Button>
            <Button size="lg" onClick={start} className="min-w-[240px]" hint={hints.onward}>
              {left ? 'Carry on' : 'Continue'}
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
  // Progress that could not be written down in this browser. Said once a visit, not on every note.
  const [cannotSave, setCannotSave] = useState<'yes' | 'told' | null>(null);
  useEffect(() => saveTrouble.subscribe(() => setCannotSave((was) => was ?? 'yes')), []);
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
    const offWake = onWake(() => void piano.unlock());
    // Hands may never touch the screen. A key played on the piano wakes the sound too.
    const offNotes = noteBus.subscribe((ev) => {
      if (ev.type === 'on' && ev.source === 'midi') void piano.unlock();
    });
    return () => {
      offWake();
      offNotes();
    };
  }, []);

  // When the app is put away or the page closes, anything it asked the piano to play stops, so no note
  // is left sounding while nobody is there to hear it.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') instrument.stop();
    };
    const gone = () => instrument.stop();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', gone);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', gone);
    };
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
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[0.85rem] font-semibold transition-colors landscape:max-h-[76px] ${
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
          {view === 'today' && <TodayScreen onStart={setActivity} onGo={setView} front={!activity && onboarded} />}
          {view === 'learn' && <LearnScreen onStart={setActivity} />}
          {view === 'pieces' && <PiecesScreen onStart={setActivity} />}
          {view === 'train' && <TrainScreen onStart={setActivity} />}
          {view === 'progress' && <ProgressScreen />}
          {view === 'settings' && <SettingsScreen onGo={setView} />}
          {view === 'method' && <MethodScreen onGo={setView} />}
        </main>
      </div>

      {/* A finished lesson can lead straight on: to the piece it brought, or to the lesson after it. */}
      {activity?.kind === 'lesson' && <LessonPlayer key={activity.id} lessonId={activity.id} onClose={(_, then) => setActivity(then ?? null)} />}
      {activity?.kind === 'piece' && <PracticeRoom pieceId={activity.id} minutes={activity.minutes} onClose={close} />}
      {activity?.kind === 'drill' && <Drill kind={activity.id} onClose={close} />}
      {activity?.kind === 'session' && <SessionRunner blocks={activity.blocks} from={activity.from} skipped={activity.skipped} base={activity.base} onClose={close} />}
      {!onboarded && <Onboarding onDone={() => setView('today')} />}
      {cannotSave === 'yes' && (
        <div role="alert" className="absolute inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 mc-safe-bottom">
          <div className="flex max-w-3xl items-center gap-4 rounded-2xl bg-mc-ink px-5 py-3.5 text-mc-bg shadow-lg">
            <p className="text-[1.05rem] leading-snug">
              This browser is not keeping your progress. Private browsing, or a full disk, can do this. Save a backup in Settings before you close the page.
            </p>
            <Button variant="soft" onClick={() => setCannotSave('told')}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
