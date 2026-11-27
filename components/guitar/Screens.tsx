'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument, playScore } from '@/lib/guitar/audio/instrument';
import { allSongs, allStages, chordsKnown, getLesson, getSong, hasSong, lessonForSong, lessonUnlocked, songChords, songInfo } from '@/lib/guitar/content/catalog';
import { NOT_USED, PRINCIPLES, TIPS, type Strength } from '@/lib/guitar/content/method';
import { Follower } from '@/lib/guitar/engine/follow';
import { listener } from '@/lib/guitar/input/listen';
import { songProgress } from '@/lib/guitar/learn/coach';
import { milestones } from '@/lib/guitar/learn/milestones';
import { DRILL_LABEL, DRILL_LESSON, SONGS_IN_HAND, planDay, planMinutes, type Block, type DrillKind } from '@/lib/guitar/learn/planner';
import { canSpeak, speak, stopSpeaking } from '@/lib/guitar/audio/speech';
import { daysAway, daysPlayed, daysThisWeek, exportData, readBackup, textSizeOf, totalMinutes, useGuitar, type ThemeChoice } from '@/lib/guitar/learn/store';
import { clearTakes, exportTake, loadTake, playTake } from '@/lib/guitar/learn/takes';
import { isNative, onRemindersOff, setReminder, shareFile } from '@/lib/guitar/native/bridge';
import { parseScore } from '@/lib/guitar/music/score';
import { dayKey } from '@/lib/guitar/util/emitter';
import { useDeviceVolume, useListening, useToday } from './hooks';
import Tuner from './Tuner';
import { Button, Card, Icon, Pill, ProgressBar, Ring, Segmented, Toggle } from './ui';

export type View = 'today' | 'lessons' | 'songs' | 'practice' | 'progress' | 'settings' | 'method';

export type Activity =
  | { kind: 'lesson'; id: string }
  | { kind: 'song'; id: string; minutes?: number }
  | { kind: 'drill'; id: DrillKind }
  | { kind: 'tune' }
  | { kind: 'session'; blocks: Block[]; /** The part to pick up at, when a session begun earlier today is carried on. */ from?: number; opened?: number };

function Page({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="os-scroll h-full">
      <div className="mx-auto w-full max-w-5xl px-7 pb-16 pt-8">
        <header className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-os-serif text-[2.8rem] leading-none">{title}</h1>
            {subtitle && <p className="mt-2 text-[1.1rem] text-os-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
        {children}
      </div>
    </div>
  );
}

const BLOCK_ICON: Record<Block['kind'], JSX.Element> = {
  tune: <Icon.Tuner size={20} />,
  lesson: <Icon.Learn size={20} />,
  song: <Icon.Songs size={20} />,
  drill: <Icon.Train size={20} />,
};

const word = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function timeWords(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------- today

export function TodayScreen({ onStart, onGo }: { onStart: (a: Activity) => void; onGo: (v: View) => void }) {
  const today = useToday();
  const profile = useGuitar((s) => s.profile);
  const lessons = useGuitar((s) => s.lessons);
  const songs = useGuitar((s) => s.songs);
  const cards = useGuitar((s) => s.cards);
  const days = useGuitar((s) => s.days);
  const drills = useGuitar((s) => s.drills);
  const sessionDoneOn = useGuitar((s) => s.sessionDoneOn);
  const sessionAt = useGuitar((s) => s.sessionAt);
  const doneToday = sessionDoneOn === today;
  // A session begun earlier today and left part way is carried on from where it stopped.
  const resume = !doneToday && sessionAt && sessionAt.day === today && sessionAt.index > 0 && sessionAt.index < sessionAt.blocks.length ? sessionAt : null;
  // The plan is made again when the day changes, as when the iPad has sat overnight with the app open.
  const day = useMemo(
    () => planDay({ minutes: profile.minutes, lessons, songs, cards, days, drills, again: doneToday, now: new Date(today + 'T12:00:00') }),
    [profile.minutes, lessons, songs, cards, days, drills, doneToday, today],
  );
  const plan = day.blocks;
  const minutesToday = Math.round((days[today]?.seconds ?? 0) / 60);
  const week = daysThisWeek(days);
  const playedThisWeek = week.filter(Boolean).length;
  const away = daysAway(days);
  const firstTime = Object.keys(lessons).length === 0 && Object.keys(days).length === 0;
  const tip = TIPS[Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000) % TIPS.length];
  const isDone = (id: string) => lessons[id]?.done === true;
  const upNext = day.upNext;
  const offerLesson = upNext !== undefined && day.held !== null && !firstTime;
  const toLearn = Math.max(1, day.waiting.length - SONGS_IN_HAND + 1);
  const whyHeld =
    day.held === 'songs'
      ? `You have ${word(day.waiting.length)} songs still to learn, so today is for them. A new lesson comes once ${toLearn === 1 ? 'one of them is' : `${word(toLearn)} of them are`} learned${
          day.comesIn === null ? '' : day.comesIn === 1 ? ', or after one more day of practice at the latest' : `, or after ${word(day.comesIn)} more days of practice at the latest`
        }.`
      : day.held === 'turn'
        ? `With ${profile.minutes} minutes a day, lessons and songs take the days in turn, and today is the songs'.`
        : 'The course moves at one new lesson a day at most, because that is what holds best.';
  const dayNames = useMemo(() => {
    const base = new Date(today + 'T12:00:00');
    return Array.from({ length: 7 }, (_, i) => new Date(base.getTime() - (6 - i) * 86400000).toLocaleDateString(undefined, { weekday: 'narrow' }));
  }, [today]);
  const when = timeWords(profile.playAt);

  return (
    <Page title={greeting()} subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
      {away !== null && away >= 2 && !doneToday && (
        <Card className="mb-6 flex items-center gap-4 border-os-accent/40 bg-os-accent/5 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-os-accent/15 text-os-accent">
            <Icon.Guitar size={24} />
          </span>
          <p className="text-[1.15rem] leading-snug">
            <strong>Welcome back.</strong> It has been {word(away)} days. That is fine. A missed day does not undo what you have learned. A short session today picks it straight back up.
          </p>
        </Card>
      )}
      <div className="grid gap-6 landscape:grid-cols-[1fr_300px]">
        <Card className="p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-os-serif text-[2rem]">{doneToday ? 'Today is done' : firstTime ? 'Your first session' : 'Your session'}</h2>
              <p className="mt-1 text-[1.1rem] text-os-muted">
                {doneToday
                  ? 'Rest is part of learning. Come back tomorrow. If you want more today, this is extra practice with nothing new in it.'
                  : firstTime
                    ? `About ${planMinutes(plan)} minutes. By the end you will have played your first chord.`
                    : `About ${planMinutes(plan)} minutes, in ${plan.length} ${plan.length === 1 ? 'part' : 'parts'}.`}
              </p>
            </div>
            {doneToday && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-os-ok text-white">
                <Icon.Check size={26} />
              </span>
            )}
          </div>
          <ol className="mt-5 space-y-2">
            {plan.map((b, i) => {
              const waits = b.kind === 'lesson' && !lessonUnlocked(b.id, isDone);
              return (
                <li key={`${b.kind}-${b.id}-${i}`}>
                  <button
                    disabled={waits}
                    onClick={() =>
                      onStart(b.kind === 'lesson' ? { kind: 'lesson', id: b.id } : b.kind === 'song' ? { kind: 'song', id: b.id, minutes: b.minutes } : b.kind === 'tune' ? { kind: 'tune' } : { kind: 'drill', id: b.id })
                    }
                    className="flex w-full items-center gap-4 rounded-2xl bg-os-bg px-4 py-3.5 text-left active:bg-os-raised"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-os-surface text-os-muted">{waits ? <Icon.Lock size={18} /> : BLOCK_ICON[b.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[1.15rem] font-semibold">
                        {i + 1}. {b.title}
                      </span>
                      <span className="block truncate text-[15px] text-os-muted">{waits ? 'Follows on from the lesson before it' : b.detail}</span>
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums text-os-muted">{b.minutes} min</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {plan.length > 0 && (
            <Button
              size="lg"
              className="mt-6 w-full"
              onClick={() => onStart(resume ? { kind: 'session', blocks: resume.blocks, from: resume.index, opened: resume.opened } : { kind: 'session', blocks: plan })}
              icon={<Icon.Play size={22} />}
            >
              {doneToday ? 'Practise some more' : resume ? `Carry on, part ${resume.index + 1} of ${resume.blocks.length}` : firstTime ? 'Begin' : 'Start session'}
            </Button>
          )}
          {offerLesson && upNext && (
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-os-line px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">Want something new?</div>
                <div className="text-[15px] leading-snug text-os-muted">
                  {whyHeld} The next is <span className="text-os-ink">{getLesson(upNext).title}</span>, and taking it now is your call.
                </div>
              </div>
              <Button variant="soft" size="sm" className="shrink-0" onClick={() => onStart({ kind: 'lesson', id: upNext })}>
                Take it now
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">This week</div>
              <div className="text-[15px] text-os-muted">{playedThisWeek === 0 ? 'Not yet' : `${word(playedThisWeek)} ${playedThisWeek === 1 ? 'day' : 'days'}`}</div>
            </div>
            <div className="mt-3 flex justify-between">
              {week.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${p ? 'bg-os-ok text-white' : i === 6 ? 'border-2 border-dashed border-os-line' : 'bg-os-raised'}`}>{p && <Icon.Check size={16} />}</span>
                  <span className="text-xs font-semibold text-os-faint">{dayNames[i]}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <Ring value={Math.min(1, minutesToday / Math.max(1, profile.minutes))} size={64}>
              {minutesToday}
            </Ring>
            <div>
              <div className="font-semibold">
                {minutesToday} of {profile.minutes} minutes
              </div>
              <div className="text-[15px] text-os-muted">at the guitar today</div>
            </div>
          </Card>
          {when && (
            <button onClick={() => onGo('settings')} className="block w-full text-left">
              <Card className="flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-os-raised text-os-muted">
                  <Icon.Clock size={22} />
                </span>
                <div>
                  <div className="font-semibold">Your time to play</div>
                  <div className="text-[15px] text-os-muted">{when} each day</div>
                </div>
              </Card>
            </button>
          )}
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-os-faint">Tip</div>
            <p className="mt-2 text-[1.05rem] leading-relaxed text-os-muted">{tip}</p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

// -------------------------------------------------------------------- lessons

export function LessonsScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = useGuitar((s) => s.lessons);
  const skipLesson = useGuitar((s) => s.skipLesson);
  const isDone = (id: string) => lessons[id]?.done === true;
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Page title="Lessons" subtitle="Six stages, from your first chord to songs of your own.">
      <div className="space-y-8">
        {allStages().map((stage) => {
          const done = stage.lessons.filter(isDone).length;
          return (
            <section key={stage.id}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-os-faint">Stage {stage.id}</div>
                  <h2 className="font-os-serif text-[1.9rem]">{stage.title}</h2>
                  <p className="text-[1.05rem] text-os-muted">{stage.goal}</p>
                </div>
                <Pill tone={done === stage.lessons.length ? 'ok' : 'muted'}>
                  {done} of {stage.lessons.length}
                </Pill>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {stage.lessons.map((id) => {
                  const l = getLesson(id);
                  const open = lessonUnlocked(id, isDone);
                  const state = lessons[id];
                  return (
                    <Card key={id} className={`p-5 ${open ? '' : 'opacity-55'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[1.2rem] font-semibold leading-tight">{l.title}</div>
                          <div className="mt-1 text-[15px] text-os-muted">{l.summary}</div>
                        </div>
                        {state?.done ? (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-os-ok/15 text-os-ok">
                            <Icon.Check size={18} />
                          </span>
                        ) : !open ? (
                          <Icon.Lock size={20} className="shrink-0 text-os-faint" />
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" variant={state?.done ? 'soft' : 'primary'} disabled={!open} onClick={() => onStart({ kind: 'lesson', id })}>
                          {state?.done ? 'Again' : state && state.step > 0 ? 'Carry on' : 'Start'}
                        </Button>
                        <span className="text-[15px] text-os-faint">{l.minutes} min</span>
                        {open && !state?.done && (
                          confirm === id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              onClick={() => {
                                skipLesson(id);
                                setConfirm(null);
                              }}
                            >
                              Yes, I know it
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setConfirm(id)}>
                              I know this
                            </Button>
                          )
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------- songs

export function SongsScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = useGuitar((s) => s.lessons);
  const songs = useGuitar((s) => s.songs);
  const known = useMemo(() => chordsKnown((id) => lessons[id]?.done === true), [lessons]);
  const groups = useMemo(() => allStages().map((st) => ({ stage: st, songs: allSongs().filter((s) => s.stage === st.id) })), []);
  return (
    <Page title="Songs" subtitle="Any song whose chords you know is open to you, whenever you like.">
      <div className="space-y-8">
        {groups.map(({ stage, songs: list }) => (
          <section key={stage.id}>
            <h2 className="mb-3 font-os-serif text-[1.6rem]">{stage.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((song) => {
                const chords = songChords(song.id);
                const missing = chords.filter((c) => !known.includes(c));
                const from = lessonForSong(song.id);
                const introduced = from ? lessons[from.id]?.done === true : false;
                const open = introduced || missing.length === 0;
                const state = songs[song.id];
                const p = songProgress(songInfo(song.id), state);
                return (
                  <button key={song.id} disabled={!open} onClick={() => onStart({ kind: 'song', id: song.id })} className={`text-left ${open ? '' : 'opacity-55'}`}>
                    <Card className="flex h-full items-center gap-4 p-5">
                      <Ring value={p} size={56}>
                        {state?.learned ? <Icon.Check size={20} /> : open ? `${Math.round(p * 100)}` : <Icon.Lock size={16} />}
                      </Ring>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[1.2rem] font-semibold">{song.title}</div>
                        <div className="truncate text-[15px] text-os-muted">{song.origin}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {song.kind === 'melody' ? (
                            <Pill>Tune</Pill>
                          ) : (
                            chords.map((c) => (
                              <Pill key={c} tone={known.includes(c) ? 'muted' : 'hint'}>
                                {c}
                              </Pill>
                            ))
                          )}
                          {song.kind === 'pick' && <Pill tone="accent">Picked</Pill>}
                        </div>
                        {!open && from && <div className="mt-1 text-[13px] text-os-faint">Opens with the lesson {from.title}</div>}
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------- practice

export function PracticeScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = useGuitar((s) => s.lessons);
  const drills = useGuitar((s) => s.drills);
  const kinds: DrillKind[] = ['changes', 'rhythm', 'recall', 'ear'];
  return (
    <Page title="Practice" subtitle="The tuner, and exercises to do on your own.">
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-os-serif text-[1.7rem]">Tuner</h2>
        <Tuner compact />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {kinds.map((k) => {
          const open = lessons[DRILL_LESSON[k]]?.done === true;
          const d = drills[k];
          return (
            <Card key={k} className={`p-5 ${open ? '' : 'opacity-55'}`}>
              <div className="text-[1.2rem] font-semibold">{DRILL_LABEL[k][0]}</div>
              <div className="mt-1 text-[15px] text-os-muted">{DRILL_LABEL[k][1]}</div>
              <div className="mt-4 flex items-center gap-3">
                <Button size="sm" disabled={!open} onClick={() => onStart({ kind: 'drill', id: k })}>
                  Start
                </Button>
                <span className="text-[14px] text-os-faint">{open ? (d?.lastOn ? `Last ${d.lastOn === dayKey() ? 'today' : d.lastOn}` : 'Not tried yet') : `Opens with ${getLesson(DRILL_LESSON[k]).title}`}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------- progress

function dayText(day: string): string {
  return new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function RecordingRow({ songId, label, rec }: { songId: string; label: string; rec: { on: string; key: string; seconds: number } }) {
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const toggle = async () => {
    if (playing) {
      stop.current?.();
      setPlaying(false);
      return;
    }
    const blob = await loadTake(rec.key);
    if (!blob) return;
    setPlaying(true);
    stop.current = playTake(blob, () => setPlaying(false));
  };
  const share = async () => {
    const blob = await loadTake(rec.key);
    if (blob) void exportTake(getSong(songId).title, `${label.toLowerCase()}, ${rec.on}`, blob, true);
  };
  return (
    <div className="flex items-center gap-3 py-2">
      <Button size="sm" variant="soft" onClick={() => void toggle()} icon={playing ? <Icon.Stop size={14} /> : <Icon.Play size={14} />}>
        {playing ? 'Stop' : 'Play'}
      </Button>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-[14px] text-os-muted">{dayText(rec.on)}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => void share()} icon={<Icon.Share size={16} />}>
        Share
      </Button>
    </div>
  );
}

export function ProgressScreen() {
  const profile = useGuitar((s) => s.profile);
  const lessons = useGuitar((s) => s.lessons);
  const songs = useGuitar((s) => s.songs);
  const days = useGuitar((s) => s.days);
  const changes = useGuitar((s) => s.changes);
  const recordings = useGuitar((s) => s.recordings);
  const learned = allSongs().filter((s) => songs[s.id]?.learned);
  const known = chordsKnown((id) => lessons[id]?.done === true);
  const path = useMemo(() => milestones(profile.startedOn, lessons, songs, changes), [changes, lessons, profile.startedOn, songs]);
  const last14 = useMemo(() => {
    const base = new Date(dayKey() + 'T12:00:00');
    return Array.from({ length: 14 }, (_, i) => {
      const d = dayKey(new Date(base.getTime() - (13 - i) * 86400000));
      return { d, m: Math.round((days[d]?.seconds ?? 0) / 60) };
    });
  }, [days]);
  const peak = Math.max(10, ...last14.map((x) => x.m));
  const pairs = Object.entries(changes).sort((a, b) => b[1].best - a[1].best);
  return (
    <Page title="Progress" subtitle={`Playing since ${dayText(profile.startedOn)}.`}>
      <div className="grid grid-cols-2 gap-3 landscape:grid-cols-4">
        {[
          [String(daysPlayed(days)), 'days played'],
          [String(totalMinutes(days)), 'minutes in all'],
          [String(known.length), known.length === 1 ? 'chord known' : 'chords known'],
          [String(learned.length), learned.length === 1 ? 'song learned' : 'songs learned'],
        ].map(([n, label]) => (
          <Card key={label} className="p-5">
            <div className="font-os-serif text-[2.6rem] leading-none">{n}</div>
            <div className="mt-1 text-[15px] text-os-muted">{label}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-os-serif text-[1.5rem]">The last two weeks</h2>
        <div className="mt-4 flex h-32 items-end gap-1.5 border-b border-os-line">
          {last14.map(({ d, m }) => (
            <div key={d} className="flex h-full flex-1 flex-col items-center justify-end" title={`${dayText(d)}: ${m} minutes`}>
              <div className={`w-full rounded-t-md ${m > 0 ? 'bg-os-accent' : 'bg-os-line'}`} style={{ height: m > 0 ? `${Math.max(6, (m / peak) * 100)}%` : '3px' }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[13px] text-os-faint">
          <span>{dayText(last14[0].d)}</span>
          <span>Today</span>
        </div>
      </Card>

      {pairs.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-os-serif text-[1.5rem]">One minute changes, your best</h2>
          <div className="mt-3 divide-y divide-os-line">
            {pairs.map(([key, rec]) => {
              const [a, b] = key.split('|');
              const first = rec.history[0]?.[1] ?? rec.best;
              return (
                <div key={key} className="flex items-center gap-4 py-2.5">
                  <div className="w-32 font-semibold">
                    {a} and {b}
                  </div>
                  <div className="flex-1">
                    <ProgressBar value={Math.min(1, rec.best / 60)} tone="accent" />
                  </div>
                  <div className="w-40 text-right text-[15px] text-os-muted">
                    <span className="font-semibold text-os-ink">{rec.best}</span>
                    {rec.history.length > 1 && first < rec.best ? `, up from ${first}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {Object.keys(recordings).length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-os-serif text-[1.5rem]">Hear how far you have come</h2>
          <p className="mt-1 text-[15px] text-os-muted">The first time through each learned song, kept with your latest.</p>
          <div className="mt-3 divide-y divide-os-line">
            {Object.entries(recordings)
              // A recording of a song this version does not have is passed over, not allowed to stop the page.
              .filter(([id]) => hasSong(id))
              .map(([id, r]) => (
              <div key={id} className="py-2">
                <div className="text-[1.1rem] font-semibold">{getSong(id).title}</div>
                <RecordingRow songId={id} label="The first time" rec={r.first} />
                {r.latest && <RecordingRow songId={id} label="Latest" rec={r.latest} />}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="font-os-serif text-[1.5rem]">Your path</h2>
        <ol className="mt-3 space-y-3">
          {path.map((m, i) => (
            <li key={i} className="flex items-baseline gap-4">
              <span className="w-32 shrink-0 text-[15px] text-os-muted">{dayText(m.on)}</span>
              <span className={`text-[1.1rem] ${m.kind === 'song' || m.kind === 'stage' ? 'font-semibold' : ''}`}>{m.title}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Page>
  );
}

// ------------------------------------------------------------------- settings

function Row({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="text-[1.1rem] font-semibold">{title}</div>
        {text && <div className="text-[15px] leading-snug text-os-muted">{text}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Is the iPad loud enough? The app plays its guitar, then its click, and the
 * learner turns the iPad up until both are easy to hear from the chair. It
 * needs no guitar, so it can be done before the first lesson.
 *
 * An iPad keeps two volumes. Examples play with the microphone set aside, at
 * the ordinary volume. The click plays while the app is listening, and the
 * iPad gives that its own, separate volume. So each is played here the way it
 * will be heard in a lesson, to be set while it sounds.
 */
export function SoundCheck() {
  const volume = useDeviceVolume();
  const [playing, setPlaying] = useState<'guitar' | 'click' | null>(null);
  const [heardGuitar, setHeardGuitar] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const example = useMemo(() => parseScore({ chart: 'Em | G | D | Em', strum: 'D.DU.UDU', tempo: 84 }), []);
  useEffect(() => () => stop.current?.(), []);
  const halt = () => {
    stop.current?.();
    stop.current = null;
    setPlaying(null);
  };
  const playGuitar = () => {
    halt();
    setPlaying('guitar');
    setHeardGuitar(true);
    void guitar.unlock().then(() => {
      const end = playScore(example, { onDone: () => setPlaying((p) => (p === 'guitar' ? null : p)) });
      stop.current = end;
    });
  };
  const playClick = () => {
    halt();
    setPlaying('click');
    // The click is heard in lessons with the microphone open, so it is played that way here.
    const release = listener.use();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    stop.current = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      release();
    };
    void guitar
      .unlock()
      .then(() => listener.start(false))
      .then(() => {
        if (cancelled) return;
        const t = guitar.now() + 0.25;
        const beats = 12;
        for (let i = 0; i < beats; i++) guitar.click(t + i * 0.6, i % 4 === 0);
        listener.suppress(t + beats * 0.6);
        timer = setTimeout(
          () => {
            release();
            stop.current = null;
            setPlaying((p) => (p === 'click' ? null : p));
          },
          beats * 600 + 400,
        );
      });
  };
  const low = volume !== null && volume < 0.55;
  return (
    <div className="max-w-md space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="sm" variant={playing === 'guitar' ? 'soft' : 'primary'} onClick={playing === 'guitar' ? halt : playGuitar} icon={<Icon.Volume size={16} />}>
          {playing === 'guitar' ? 'Stop' : 'Play the guitar'}
        </Button>
        <Button size="sm" variant="soft" onClick={playing === 'click' ? halt : playClick}>
          {playing === 'click' ? 'Stop' : 'Play the click'}
        </Button>
        {volume !== null && <span className="text-[14px] text-os-muted">iPad volume {Math.round(volume * 100)} percent</span>}
      </div>
      <div className="text-[15px] leading-snug text-os-muted">
        {playing === 'click'
          ? listener.stepsAside
            ? 'This is the click you play along with. The iPad keeps a separate volume for it, so if it is quiet, press volume up now, while it clicks.'
            : 'This is the click you play along with. It should be easy to hear over your own strumming.'
          : low
            ? `The iPad is turned down to ${Math.round((volume ?? 0) * 100)} percent. Press the volume up button on its side while the guitar plays. Near the top works best beside a real guitar.`
            : heardGuitar
              ? 'It should be easy to hear from your chair, about as loud as someone talking across the table. If not, press volume up on the side of the iPad while it plays.'
              : 'Play each one, and turn the iPad up with the buttons on its side until it is easy to hear from your chair.'}
      </div>
    </div>
  );
}

/** Strum along with clicks, and find how far behind the microphone hears it. */
type TimingOutcome = { biasMs: number } | { problem: 'too-few' | 'early' };

/**
 * Strum along with clicks, and find how far behind the microphone hears it.
 * The run hears with no allowance at all, so what it finds is the whole delay.
 * The microphone is held only while the check runs.
 */
function TimingCheck({ onDone }: { onDone: (outcome: TimingOutcome) => void }) {
  const [state, setState] = useState<'idle' | 'opening' | 'running'>('idle');
  const { status, start, ask } = useListening(state !== 'idle');
  const follower = useRef<Follower | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => () => follower.current?.stop(), []);
  useEffect(() => {
    if (state !== 'opening' || status.state !== 'listening') return;
    follower.current?.stop();
    setState('running');
    const score = parseScore({ chart: 'Em | Em | Em', strum: 'D.D.D.D.', tempo: 80 });
    const f = new Follower(score, { mode: 'tempo', anyStrike: true, inputDelay: 0, metronome: true });
    follower.current = f;
    f.events.subscribe((ev) => {
      if (ev.type === 'false-start') {
        // Strummed during the four clicks that count in. The run has stopped itself.
        setState('idle');
        onDoneRef.current({ problem: 'early' });
      } else if (ev.type === 'done') {
        setState('idle');
        onDoneRef.current(ev.result.totalSteps - ev.result.missedSteps >= 6 ? { biasMs: ev.result.biasMs } : { problem: 'too-few' });
      }
    });
    f.start();
  }, [state, status.state]);
  const go = () => {
    void guitar.unlock();
    setState('opening');
    start();
  };
  if (state !== 'idle' && ask && status.state === 'denied')
    return <span className="max-w-xs text-[14px] text-os-muted">The microphone is switched off for this app. Turn it on in the iPad&apos;s Settings, under Privacy and Security, Microphone.</span>;
  return (
    <Button size="sm" variant="soft" disabled={state !== 'idle'} onClick={go}>
      {state === 'running' ? 'Four clicks, then strum' : state === 'opening' ? 'Getting ready' : 'Run the timing check'}
    </Button>
  );
}

export function SettingsScreen({ onGo }: { onGo: (v: View) => void }) {
  const profile = useGuitar((s) => s.profile);
  const settings = useGuitar((s) => s.settings);
  const days = useGuitar((s) => s.days);
  const setProfile = useGuitar((s) => s.setProfile);
  const setSettings = useGuitar((s) => s.setSettings);
  const importData = useGuitar((s) => s.importData);
  const resetAll = useGuitar((s) => s.resetAll);
  const [timing, setTiming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // The iPad says when a reminder was asked for but notifications are switched off for the app.
  const [remindersOff, setRemindersOff] = useState(false);
  useEffect(() => onRemindersOff(() => setRemindersOff(true)), []);
  // A backup that has been chosen and read, waiting for a yes before it replaces what is here.
  const [restore, setRestore] = useState<{ text: string; about: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const native = isNative();

  const applyReminder = (on: boolean, at: string | null) => {
    if (!at) return;
    const [h, m] = at.split(':').map(Number);
    setReminder(on, h, m, (days[dayKey()]?.seconds ?? 0) >= 60, 'A few minutes with your guitar? Your session is ready.');
  };

  const backup = () => {
    const text = exportData();
    const name = `open-string-${dayKey()}.json`;
    if (shareFile(name, text)) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <Page title="Settings">
      <Card className="divide-y divide-os-line px-6">
        <Row title="Session length" text="How long a normal day's session runs.">
          <Segmented
            value={profile.minutes}
            onChange={(v) => setProfile({ minutes: v })}
            options={[
              { value: 10, label: '10' },
              { value: 15, label: '15' },
              { value: 20, label: '20' },
              { value: 30, label: '30' },
            ]}
          />
        </Row>
        <Row title="Your time to play" text="Playing at the same time each day helps the habit form.">
          <input
            type="time"
            value={profile.playAt ?? ''}
            onChange={(e) => {
              const v = e.target.value || null;
              setProfile({ playAt: v });
              // With no time to play there is nothing to remind at, so the reminders set already are taken off.
              if (settings.reminder) {
                if (v) applyReminder(true, v);
                else setReminder(false, 0, 0, false, '');
              }
            }}
            className="h-12 rounded-2xl border border-os-line bg-os-bg px-3 text-[1.1rem]"
          />
        </Row>
        {native && (
          <Row
            title="Remind me"
            text={
              remindersOff && settings.reminder
                ? "Notifications are switched off for Fretward, so no reminder can be shown. Turn them on in the iPad's Settings, under Notifications, Fretward."
                : 'A gentle note on the iPad at your time to play, only on days you have not played yet.'
            }
          >
            <Toggle
              label="Remind me"
              value={settings.reminder}
              onChange={(v) => {
                setSettings({ reminder: v });
                applyReminder(v, profile.playAt ?? '19:00');
                if (v && !profile.playAt) setProfile({ playAt: '19:00' });
              }}
            />
          </Row>
        )}
      </Card>

      <h2 className="mb-2 mt-8 font-os-serif text-[1.6rem]">Sound</h2>
      <Card className="divide-y divide-os-line px-6">
        <Row title="Guitar sound" text="The examples the app plays.">
          <input type="range" className="os-range w-56" min={0.3} max={1} step={0.05} value={settings.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} />
        </Row>
        <Row title="Click" text="The metronome.">
          <input type="range" className="os-range w-56" min={0.1} max={1} step={0.05} value={settings.clickVolume} onChange={(e) => setSettings({ clickVolume: Number(e.target.value) })} />
        </Row>
        <Row title="Sound check" text="Hear the app's guitar and its click, and set the iPad's volume. No guitar needed.">
          <SoundCheck />
        </Row>
        <Row title="Timing check" text={timing ?? 'Four clicks count in, then strum once on each click. The app allows for any delay in hearing you.'}>
          <TimingCheck
            onDone={(outcome) => {
              if ('problem' in outcome) {
                setTiming(
                  outcome.problem === 'early'
                    ? 'That began during the four clicks that count in. Try again, and start strumming on the fifth click.'
                    : 'Not enough strums were heard. Try again, strumming once on each click.',
                );
                return;
              }
              // The run heard with no allowance, so it found the whole delay. Every run hears with 60 milliseconds already allowed, so the setting is what is left.
              const latency = Math.round(Math.max(-150, Math.min(250, outcome.biasMs - 60)));
              setSettings({ latencyMs: latency });
              setTiming(`Done. The app now allows for a delay of ${latency + 60} milliseconds in hearing you.`);
            }}
          />
        </Row>
      </Card>

      <h2 className="mb-2 mt-8 font-os-serif text-[1.6rem]">Seeing it</h2>
      <Card className="divide-y divide-os-line px-6">
        <Row title="Text size" text="Choose it from where you sit with the guitar.">
          <Segmented
            value={textSizeOf(settings)}
            onChange={(v) => setSettings({ textSize: v })}
            options={[
              { value: 0, label: 'Standard' },
              { value: 1, label: 'Large' },
              { value: 2, label: 'Largest' },
            ]}
          />
        </Row>
        {canSpeak() && (
          <Row title="Read aloud" text="The app says what to do and how it went, so your eyes can stay on your hands.">
            <Toggle
              label="Read aloud"
              value={settings.speak === true}
              onChange={(v) => {
                setSettings({ speak: v });
                if (v) speak('This is how the app sounds when it reads to you.');
                else stopSpeaking();
              }}
            />
          </Row>
        )}
        <Row title="Left handed" text="Chord pictures drawn for a guitar held the other way round.">
          <Toggle label="Left handed" value={settings.leftHanded} onChange={(v) => setSettings({ leftHanded: v })} />
        </Row>
        <Row title="Light or dark">
          <Segmented
            value={settings.theme}
            onChange={(v: ThemeChoice) => setSettings({ theme: v })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </Card>

      <h2 className="mb-2 mt-8 font-os-serif text-[1.6rem]">Hands on the guitar</h2>
      <Card className="space-y-3 px-6 py-5 text-[1.05rem] leading-relaxed text-os-muted">
        <p>
          <strong className="text-os-ink">The app moves on by itself.</strong> When it hears you get something right, the next step comes after a moment, and a miss sets up another try. Touch anywhere to hold it where it is.
        </p>
        <p>
          <strong className="text-os-ink">A strum starts things.</strong> Playing with the beat begins when you strum once, and a strum carries a session on from one part to the next.
        </p>
        <p>
          <strong className="text-os-ink">A foot pedal works too.</strong> A Bluetooth page turning pedal, the kind used for sheet music, does the next thing with its right pedal and goes back or repeats with its left. So do the arrow keys, space and return on a keyboard.
        </p>
      </Card>

      <h2 className="mb-2 mt-8 font-os-serif text-[1.6rem]">Your progress</h2>
      <Card className="divide-y divide-os-line px-6">
        <Row title="Save a backup" text={native ? 'A copy also goes into the Files app each day you play, under Fretward.' : 'A file with all your progress, to keep or move to another device.'}>
          <Button size="sm" variant="soft" onClick={backup} icon={<Icon.Share size={16} />}>
            Save
          </Button>
        </Row>
        <Row title="Restore from a backup" text={restore ? `${restore.about} Everything here now will be replaced by it.` : (message ?? 'Replace your progress with a saved copy.')}>
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Cleared, so the same file can be chosen again.
                e.target.value = '';
                if (!f) return;
                void f.text().then((t) => {
                  const data = readBackup(t);
                  if (!data) {
                    setRestore(null);
                    setMessage('That file is not a Fretward backup. Nothing was changed.');
                    return;
                  }
                  const lessons = Object.values(data.lessons ?? {}).filter((l) => l?.done).length;
                  const days = Object.keys(data.days ?? {}).length;
                  setRestore({ text: t, about: `This backup holds ${lessons} ${lessons === 1 ? 'lesson' : 'lessons'} done and ${days} ${days === 1 ? 'day' : 'days'} of playing.` });
                });
              }}
            />
            {restore ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRestore(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setMessage(importData(restore.text) ? 'Restored.' : 'That file could not be read. Nothing was changed.');
                    setRestore(null);
                  }}
                >
                  Yes, replace
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>
                Restore
              </Button>
            )}
          </>
        </Row>
        <Row title="Start again" text="Clear all progress. Your settings stay.">
          {confirmReset ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                resetAll();
                // The recordings go too, not only the list of them.
                clearTakes();
                setConfirmReset(false);
              }}
            >
              Yes, clear it
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              Clear progress
            </Button>
          )}
        </Row>
      </Card>

      <button onClick={() => onGo('method')} className="mt-8 block w-full text-left">
        <Card className="flex items-center gap-4 p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-os-raised">
            <Icon.Info size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[1.15rem] font-semibold">How the app teaches</div>
            <div className="text-[15px] text-os-muted">Each choice, the studies behind it, and how strong the evidence is.</div>
          </div>
          <Icon.Right size={20} />
        </Card>
      </button>
      <p className="mt-6 text-[14px] leading-relaxed text-os-faint">
        Fretward. The guitar sound is made on the device from a model of a plucked string. The note detector was checked against GuitarSet, recordings of real acoustic guitars made by the Music and Audio Research Lab at New York University. All songs are traditional, in the public domain, or written for the course.
      </p>
    </Page>
  );
}

// --------------------------------------------------------------------- method

const STRENGTH: Record<Strength, { label: string; tone: 'ok' | 'accent' | 'hint' }> = {
  strong: { label: 'Strong evidence', tone: 'ok' },
  moderate: { label: 'Moderate evidence', tone: 'accent' },
  limited: { label: 'Limited evidence', tone: 'hint' },
};

export function MethodScreen({ onGo }: { onGo: (v: View) => void }) {
  return (
    <Page
      title="How the app teaches"
      subtitle="Every choice here comes from research on how people learn to play, or from long teaching practice where research is thin. The strength of each is given honestly."
      right={
        <Button variant="soft" size="sm" onClick={() => onGo('settings')} icon={<Icon.Left size={16} />}>
          Settings
        </Button>
      }
    >
      <div className="space-y-4">
        {PRINCIPLES.map((p) => (
          <Card key={p.title} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-os-serif text-[1.55rem]">{p.title}</h2>
              <Pill tone={STRENGTH[p.strength].tone}>{STRENGTH[p.strength].label}</Pill>
            </div>
            <p className="mt-2 text-[1.1rem] leading-relaxed">{p.what}</p>
            <p className="mt-2 text-[1rem] leading-relaxed text-os-muted">{p.evidence}</p>
            {p.sources.length > 0 && <p className="os-selectable mt-3 text-[13px] leading-relaxed text-os-faint">{p.sources.join('. ')}.</p>}
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-os-serif text-[1.9rem]">What the app leaves out, and why</h2>
      <div className="space-y-3">
        {NOT_USED.map((n) => (
          <Card key={n.title} className="p-5">
            <div className="text-[1.15rem] font-semibold">{n.title}</div>
            <p className="mt-1 text-[1rem] leading-relaxed text-os-muted">{n.why}</p>
          </Card>
        ))}
      </div>
    </Page>
  );
}

export { instrument };
