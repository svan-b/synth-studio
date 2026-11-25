'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument } from '@/lib/guitar/audio/instrument';
import { getLesson, songInfo } from '@/lib/guitar/content/catalog';
import { listener } from '@/lib/guitar/input/listen';
import { songProgress } from '@/lib/guitar/learn/coach';
import { currentSong, planDay, type Block } from '@/lib/guitar/learn/planner';
import { daysThisWeek, useGuitar } from '@/lib/guitar/learn/store';
import { isNative, onWake, setReminder } from '@/lib/guitar/native/bridge';
import { dayKey } from '@/lib/guitar/util/emitter';
import Drill from './Drills';
import { useApplySettings, usePracticeTimer, useTheme, useToday, useWakeLock } from './hooks';
import LessonPlayer from './LessonPlayer';
import Onboarding from './Onboarding';
import { LessonsScreen, MethodScreen, PracticeScreen, ProgressScreen, SettingsScreen, SongsScreen, TodayScreen, type Activity, type View } from './Screens';
import SongRoom from './SongRoom';
import Tuner from './Tuner';
import { Button, Icon, IconButton } from './ui';

const NAV: Array<{ view: View; label: string; icon: (p: { size?: number }) => JSX.Element }> = [
  { view: 'today', label: 'Today', icon: Icon.Today },
  { view: 'lessons', label: 'Lessons', icon: Icon.Learn },
  { view: 'songs', label: 'Songs', icon: Icon.Songs },
  { view: 'practice', label: 'Practice', icon: Icon.Tuner },
  { view: 'progress', label: 'Progress', icon: Icon.Progress },
  { view: 'settings', label: 'Settings', icon: Icon.Settings },
];

const REMINDER = 'A few minutes with your guitar? Your session is ready.';

/** Tuning up, as the first part of a session or on its own. */
function TuneActivity({ onClose }: { onClose: () => void }) {
  const logPractice = useGuitar((s) => s.logPractice);
  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, 0, 1));
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1 truncate font-os-serif text-[1.4rem]">Tune up</div>
      </header>
      <div className="os-scroll min-h-0 flex-1">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-7 py-6">
          <p className="mb-6 text-center text-[1.1rem] text-os-muted">String by string, from the thickest. The app moves on by itself when each one is in tune.</p>
          <Tuner onDone={onClose} />
        </div>
      </div>
    </div>
  );
}

function BlockActivity({ block, onClose }: { block: Block; onClose: () => void }) {
  if (block.kind === 'tune') return <TuneActivity onClose={onClose} />;
  if (block.kind === 'lesson') return <LessonPlayer lessonId={block.id} onClose={onClose} />;
  if (block.kind === 'song') return <SongRoom songId={block.id} minutes={block.minutes} onClose={onClose} />;
  return <Drill kind={block.id} onClose={onClose} />;
}

type Snapshot = ReturnType<typeof useGuitar.getState>;

/** What a session changed, as a short list for the screen that closes it. */
function recap(before: Snapshot, parts: Block[]): Array<[string, string]> {
  const now = useGuitar.getState();
  const today = dayKey();
  const rows: Array<[string, string]> = [];
  const minutes = Math.round((now.days[today]?.seconds ?? 0) / 60);
  if (minutes > 0) rows.push(['At the guitar today', minutes === 1 ? '1 minute' : `${minutes} minutes`]);
  for (const b of parts) {
    if (b.kind === 'lesson' && now.lessons[b.id]?.done && !before.lessons[b.id]?.done) rows.push(['New lesson', getLesson(b.id).title]);
  }
  const seen = new Set<string>();
  for (const b of parts) {
    if (b.kind !== 'song' || seen.has(b.id)) continue;
    seen.add(b.id);
    const info = songInfo(b.id);
    const was = before.songs[b.id];
    const is = now.songs[b.id];
    if (!is) continue;
    // Only what was played in this session is spoken for.
    const played = is.lastOn === today && (was?.lastOn !== today || is.tasksToday > (was?.tasksToday ?? 0));
    if (!played) continue;
    if (is.learned && !was?.learned) rows.push([info.title, 'Learned']);
    else if (is.learned) rows.push([info.title, 'Still in your fingers']);
    else {
      const from = Math.round(songProgress(info, was) * 100);
      const to = Math.round(songProgress(info, is) * 100);
      if (to > from) rows.push([info.title, `${from} to ${to} percent learned`]);
    }
  }
  for (const [key, rec] of Object.entries(now.changes)) {
    const old = before.changes[key]?.best ?? 0;
    if (rec.best > old && old > 0) {
      const [a, b] = key.split('|');
      rows.push([`${a} and ${b} changes`, `New best, ${rec.best} in a minute`]);
    }
  }
  const week = daysThisWeek(now.days).filter(Boolean).length;
  if (week >= 2) rows.push(['Days played this week', String(week)]);
  return rows;
}

/** What tomorrow's session holds, to give the next visit something to come back to. */
function tomorrow(): string | null {
  const s = useGuitar.getState();
  const day = planDay({ minutes: s.profile.minutes, lessons: s.lessons, songs: s.songs, cards: s.cards, days: s.days, drills: s.drills, now: new Date(Date.now() + 86400000) });
  const first = day.blocks.find((b) => b.kind === 'lesson') ?? day.blocks.find((b) => b.kind === 'song');
  if (!first) return null;
  if (first.kind === 'lesson') return `Tomorrow brings a new lesson, ${first.title}.`;
  return day.held === 'songs' ? `Tomorrow carries on with ${first.title}. The next lesson waits until your songs are further along.` : `Tomorrow carries on with ${first.title}.`;
}

/** Runs the parts of a daily session one after another. */
function SessionRunner({ blocks: planned, onClose }: { blocks: Block[]; onClose: () => void }) {
  // The parts can grow: when a song is learned with time to spare, the next song takes the rest of it.
  const [blocks, setBlocks] = useState(planned);
  const [index, setIndex] = useState(0);
  // The tune up needs no introduction: the session opens straight onto it.
  const [between, setBetween] = useState(planned[0]?.kind !== 'tune');
  const finishSession = useGuitar((s) => s.finishSession);
  const done = index >= blocks.length;
  const marked = useRef(false);
  const before = useRef(useGuitar.getState());
  const blockStarted = useRef(performance.now());
  // Each part is closed once. A second call for the same part, from a timer and a tap together, is ignored.
  const closed = useRef(false);
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
    closed.current = false;
    setBetween(false);
  }, []);

  const afterBlock = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    // A lesson closed part way is not finished. The session stays on it, so it can be picked up again or the session stopped.
    const block = blocks[index];
    const state = useGuitar.getState();
    const unfinished = block?.kind === 'lesson' && state.lessons[block.id]?.done !== true;
    if (!unfinished) {
      const used = (performance.now() - blockStarted.current) / 60000;
      const left = block?.kind === 'song' ? Math.floor(block.minutes - used) : 0;
      const justLearned = block?.kind === 'song' && state.songs[block.id]?.learned === true && before.current.songs[block.id]?.learned !== true;
      const nextSong = justLearned && left >= 3 ? currentSong(state.lessons, state.songs) : null;
      if (nextSong && !blocks.some((b) => b.kind === 'song' && b.id === nextSong)) {
        const extra: Block = { kind: 'song', id: nextSong, minutes: left, title: songInfo(nextSong).title, detail: 'There is time left, so on to the next song' };
        setBlocks((list) => [...list.slice(0, index + 1), extra, ...list.slice(index + 1)]);
      }
      setIndex((i) => i + 1);
    }
    setBetween(true);
  }, [blocks, index]);

  if (!done && !between) return <BlockActivity key={index} block={blocks[index]} onClose={afterBlock} />;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-os-bg px-8 text-center os-safe-top os-safe-bottom">
      {done ? (
        <>
          <div className="os-pop flex h-20 w-20 items-center justify-center rounded-full bg-os-ok text-white">
            <Icon.Check size={44} />
          </div>
          <div className="os-fade-up">
            <h2 className="font-os-serif text-5xl">Session complete</h2>
            {summary && summary.rows.length > 0 && (
              <dl className="mx-auto mt-6 w-full max-w-md divide-y divide-os-line rounded-2xl bg-os-surface px-5 text-left">
                {summary.rows.map(([label, value]) => (
                  <div key={`${label}-${value}`} className="flex items-baseline justify-between gap-6 py-2.5">
                    <dt className="text-os-muted">{label}</dt>
                    <dd className="text-right font-semibold text-os-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-os-muted">
              What you worked on keeps settling after you stop, and it will feel easier next time. {summary?.next ?? 'Come back tomorrow.'}
            </p>
          </div>
          <Button size="lg" onClick={onClose} className="min-w-[220px]">
            Finish
          </Button>
        </>
      ) : (
        <>
          <div className="os-fade-up">
            <div className="text-sm font-semibold uppercase tracking-widest text-os-muted">
              {index === 0 ? 'First' : 'Next'}, part {index + 1} of {blocks.length}
            </div>
            <h2 className="mt-2 font-os-serif text-5xl">{blocks[index].title}</h2>
            <p className="mt-3 text-[1.15rem] text-os-muted">
              {blocks[index].detail.replace(/[.\s]+$/, '')}. About {blocks[index].minutes} {blocks[index].minutes === 1 ? 'minute' : 'minutes'}.
            </p>
          </div>
          <div className="flex items-center gap-2" aria-hidden>
            {blocks.map((_, i) => (
              <span key={i} className={`h-2.5 rounded-full ${i < index ? 'w-2.5 bg-os-ok' : i === index ? 'w-8 bg-os-ink' : 'w-2.5 bg-os-line'}`} />
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={onClose}>
              Stop for today
            </Button>
            <Button size="lg" onClick={start} className="min-w-[220px]">
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
  const onboarded = useGuitar((s) => s.profile.onboarded);
  const bigText = useGuitar((s) => s.settings.bigText);
  const reminder = useGuitar((s) => s.settings.reminder);
  const playAt = useGuitar((s) => s.profile.playAt);
  const today = useToday();
  const playedToday = useGuitar((s) => (s.days[today]?.seconds ?? 0) >= 60);
  const [view, setView] = useState<View>('today');
  const [activity, setActivity] = useState<Activity | null>(null);
  useApplySettings();

  // Browsers only let sound start in answer to a deliberate action. On a touch
  // screen that means lifting the finger, not putting it down, so every tap
  // wakes the sound if it is asleep.
  useEffect(() => {
    const wake = () => void guitar.unlock();
    const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, wake, true));
    return () => events.forEach((e) => window.removeEventListener(e, wake, true));
  }, []);

  // The iPad app may start its sound without a tap, so it is ready before the
  // first strum, and again each time the app comes back to the front. The
  // microphone comes back too, if the iPad took it away while the app was away.
  useEffect(() => {
    const back = () => {
      void guitar.unlock();
      // The iPad hands the microphone back a moment after the app returns.
      setTimeout(() => listener.revive(), 700);
    };
    if (isNative()) {
      void guitar.unlock();
      onWake(back);
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') back();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // The reminder at the time to play is set again whenever it could have
  // changed, so it never comes on a day that has been played already.
  useEffect(() => {
    if (!isNative() || !onboarded) return;
    // With no time to play there is nothing to remind at, so any reminders set before are taken off.
    if (!playAt) {
      setReminder(false, 0, 0, playedToday, REMINDER);
      return;
    }
    const [h, m] = playAt.split(':').map(Number);
    setReminder(reminder, h, m, playedToday, REMINDER);
  }, [onboarded, playAt, playedToday, reminder]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('osdebug')) {
      // Development tools, loaded only when asked for in the address.
      void Promise.all([import('@/lib/guitar/dev/robot'), import('@/lib/guitar/content/catalog'), import('@/lib/guitar/engine/follow'), import('@/lib/guitar/input/bus')]).then(
        ([robot, catalog, follow, bus]) => {
          (window as unknown as { __os: unknown }).__os = { guitar, listener, store: useGuitar, robot, catalog, follow, bus, planDay };
        },
      );
    }
  }, []);

  // Keep the app on the device, so it opens without a connection.
  useEffect(() => {
    // The iPad app carries its files inside it, so it has no need of this.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || isNative()) return;
    navigator.serviceWorker.register('/guitar-sw.js', { scope: '/guitar' }).catch(() => undefined);
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
    <div className="os-root" data-theme={theme} data-size={bigText ? 'big' : 'normal'}>
      <div ref={behind} className="flex h-full landscape:flex-row portrait:flex-col-reverse">
        <nav
          className="flex shrink-0 border-os-line bg-os-surface/70 landscape:w-[92px] landscape:flex-col landscape:border-r landscape:py-5 portrait:h-[76px] portrait:border-t portrait:px-2 os-safe-bottom"
          aria-label="Main"
        >
          <div className="mb-5 hidden items-center justify-center landscape:flex">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-os-ink text-os-bg">
              <Icon.Guitar size={24} />
            </span>
          </div>
          {NAV.map((item) => {
            const active = view === item.view || (item.view === 'settings' && view === 'method');
            const I = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors landscape:max-h-[80px] ${
                  item.view === 'settings' ? 'landscape:mt-auto landscape:flex-none landscape:py-3' : ''
                } ${active ? 'text-os-ink' : 'text-os-muted'}`}
              >
                <span className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-os-ink/10' : ''}`}>
                  <I size={23} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 os-safe-top">
          {view === 'today' && <TodayScreen onStart={setActivity} onGo={setView} />}
          {view === 'lessons' && <LessonsScreen onStart={setActivity} />}
          {view === 'songs' && <SongsScreen onStart={setActivity} />}
          {view === 'practice' && <PracticeScreen onStart={setActivity} />}
          {view === 'progress' && <ProgressScreen />}
          {view === 'settings' && <SettingsScreen onGo={setView} />}
          {view === 'method' && <MethodScreen onGo={setView} />}
        </main>
      </div>

      {activity?.kind === 'lesson' && <LessonPlayer lessonId={activity.id} onClose={close} />}
      {activity?.kind === 'song' && <SongRoom songId={activity.id} minutes={activity.minutes} onClose={close} />}
      {activity?.kind === 'drill' && <Drill kind={activity.id} onClose={close} />}
      {activity?.kind === 'tune' && <TuneActivity onClose={close} />}
      {activity?.kind === 'session' && <SessionRunner blocks={activity.blocks} onClose={close} />}
      {!onboarded && <Onboarding onDone={() => setView('today')} />}
    </div>
  );
}
