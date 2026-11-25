'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TakePlayer } from '@/lib/piano/audio/replay';
import { allPieces, allStages, getLesson, getPiece, lessonOrder, pieceInfo } from '@/lib/piano/content/catalog';
import { NOT_USED, PRINCIPLES, TIPS, type Strength } from '@/lib/piano/content/method';
import type { FlowResult } from '@/lib/piano/engine/flow';
import { pieceProgress } from '@/lib/piano/learn/coach';
import { CHORD_LEVELS, EAR_LEVELS, RHYTHM_LEVELS, SIGHT_LEVELS, TECH_LEVELS } from '@/lib/piano/learn/generators';
import { milestones } from '@/lib/piano/learn/milestones';
import { markKnownThrough, undoKnown } from '@/lib/piano/learn/placement';
import {
  DRILL_LESSON,
  dueReadingCards,
  introducedPieces,
  openDrills,
  PIECES_IN_HAND,
  planDay,
  planMinutes,
  skippedPieces,
  type Block,
  type DrillKind,
} from '@/lib/piano/learn/planner';
import { exportData, streak, totalMinutes, usePiano, type Recording, type SessionBase } from '@/lib/piano/learn/store';
import { isNative, shareFile } from '@/lib/piano/native/bridge';
import { parseScore } from '@/lib/piano/music/score';
import { dayKey } from '@/lib/piano/util/emitter';
import { CreditsText, PrivacyText } from './About';
import ConnectionPanel, { ConnectionChip, ConnectionReport } from './Connection';
import { useHints, useInputMode, useRemote, useSound } from './hooks';
import PlaySurface from './PlaySurface';
import { Button, Card, Icon, Pill, ProgressBar, Ring, Segmented, Sheet, Toggle } from './ui';

export type View = 'today' | 'learn' | 'pieces' | 'train' | 'progress' | 'settings' | 'method';

export type Activity =
  | { kind: 'lesson'; id: string }
  | { kind: 'piece'; id: string; minutes?: number }
  | { kind: 'drill'; id: DrillKind }
  | {
      kind: 'session';
      blocks: Block[];
      /** The part to begin at, when a session is picked up again. */
      from?: number;
      /** Parts that were passed over before it was stopped. */
      skipped?: number[];
      /** How things stood when it began, kept so the closing account covers the whole of it. */
      base?: SessionBase;
    };

function Page({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mc-scroll h-full">
      <div className="mx-auto w-full max-w-5xl px-8 pb-16 pt-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-mc-serif text-[2.6rem] leading-none">{title}</h1>
            {subtitle && <p className="mt-2 text-[1.05rem] text-mc-muted">{subtitle}</p>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

const BLOCK_ICON = {
  lesson: <Icon.Learn size={20} />,
  piece: <Icon.Pieces size={20} />,
  drill: <Icon.Train size={20} />,
};

// ------------------------------------------------------------------ today

export function TodayScreen({
  onStart,
  onGo,
  front = true,
}: {
  onStart: (a: Activity) => void;
  onGo: (v: View) => void;
  /** Nothing is open in front of this page. Only then do the piano's keys act on it. */
  front?: boolean;
}) {
  const profile = usePiano((s) => s.profile);
  const lessons = usePiano((s) => s.lessons);
  const pieces = usePiano((s) => s.pieces);
  const cards = usePiano((s) => s.cards);
  const days = usePiano((s) => s.days);
  const sessionDoneOn = usePiano((s) => s.sessionDoneOn);
  const saved = usePiano((s) => s.session);
  const drills = usePiano((s) => s.drills);
  const sound = useSound();
  const hints = useHints();
  const today = dayKey();
  const doneToday = sessionDoneOn === today;
  const day = useMemo(
    () => planDay({ minutes: profile.minutes, lessons, pieces, cards, days, drills, again: doneToday }),
    [profile.minutes, lessons, pieces, cards, days, drills, doneToday],
  );
  const plan = day.blocks;
  const minutesToday = Math.round((days[today]?.seconds ?? 0) / 60);
  const run = streak(days);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const tip = TIPS[Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000) % TIPS.length];
  const firstTime = Object.keys(lessons).length === 0 && Object.keys(days).length === 0;
  // The next lesson, for a learner who wants more than the day's plan holds, with the reason it is not in the plan.
  const upNext = day.upNext;
  const offerLesson = upNext !== undefined && day.held !== null && !firstTime;
  const lessonToday = Object.values(lessons).some((l) => l.done && !l.skipped && l.doneOn === today);
  const word = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
  const count = word(day.waiting.length);
  // How many of them have to be learned before the next lesson comes of itself.
  const toLearn = Math.max(1, day.waiting.length - PIECES_IN_HAND + 1);
  const whyHeld =
    day.held === 'pieces'
      ? `You have ${count} pieces still to learn, so today is for them, and what you were taught gets played. A new lesson comes once ${
          toLearn === 1 ? 'one of them is' : `${word(toLearn)} of them are`
        } learned${day.comesIn === null ? '' : day.comesIn === 1 ? ', or after one more day of practice at the latest' : `, or after ${word(day.comesIn)} more days of practice at the latest`}.`
      : day.held === 'turn'
        ? `With ${profile.minutes} minutes a day, lessons and pieces take the days in turn, and today is the piece's.`
        : lessonToday
          ? 'The course moves at one new lesson a day at most, because that is what holds best.'
          : 'The session for today is done, and extra practice has nothing new in it.';
  // A session begun today is picked up where it stopped, with the parts it had then.
  const resume = useMemo(() => {
    if (!saved || saved.on !== today || doneToday) return null;
    const blocks = saved.blocks as Block[];
    let at = saved.index;
    // A lesson finished some other way since then is behind us.
    while (at < blocks.length && blocks[at].kind === 'lesson' && lessons[blocks[at].id]?.done) at++;
    return at < blocks.length ? { blocks, at, skipped: saved.skipped ?? [], base: saved.base } : null;
  }, [doneToday, lessons, saved, today]);
  const parts = resume?.blocks ?? plan;
  const at = resume?.at ?? 0;
  const next: Block | undefined = parts[at];
  /** How far a lesson has got, when it was left part way. */
  const stepOf = (id: string) => (lessons[id]?.done ? 0 : (lessons[id]?.step ?? 0));
  const partDetail = (b: Block) => {
    const step = b.kind === 'lesson' ? stepOf(b.id) : 0;
    return step > 0 ? `Left at step ${step + 1} of ${getLesson(b.id).steps.length}. It opens there` : b.detail;
  };
  const begin = useCallback(() => {
    if (parts.length > 0) onStart({ kind: 'session', blocks: parts, from: at, skipped: resume?.skipped, base: resume?.base });
  }, [at, onStart, parts, resume]);
  // The top key starts the day from the piano. It does so only while this page is in front, and
  // not once the day is done: extra practice is asked for with a tap.
  useRemote({ primary: begin }, front && parts.length > 0 && !doneToday);
  // A session that was begun, or whose first part is a lesson left part way, is carried on, not started.
  const begun = at > 0 || (next?.kind === 'lesson' && stepOf(next.id) > 0);
  // The first day keeps both of its lessons at every session length, so it can run over.
  const runsLong = firstTime && planMinutes(plan) > profile.minutes + 2;
  const left = planMinutes(parts.slice(at));
  // Lessons opened from the course and left part way, which the day's parts would not lead back to.
  const halfway = lessonOrder().filter((id) => stepOf(id) > 0 && !parts.some((b) => b.kind === 'lesson' && b.id === id));
  const open = (b: Block) =>
    onStart(b.kind === 'lesson' ? { kind: 'lesson', id: b.id } : b.kind === 'piece' ? { kind: 'piece', id: b.id, minutes: b.minutes } : { kind: 'drill', id: b.id });

  return (
    <Page title="Today" subtitle={date} right={<ConnectionChip onClick={() => onGo('settings')} />}>
      {sound?.route === 'bluetooth' && (
        <button onClick={() => onGo('settings')} className="mb-5 block w-full rounded-2xl border border-mc-hint/40 bg-mc-hint/10 px-5 py-3.5 text-left">
          <span className="font-semibold text-mc-hint-ink">The iPad&apos;s sound is going over Bluetooth{sound.name ? ` to ${sound.name}` : ''}, which makes it late.</span>{' '}
          <span className="text-mc-muted">The click will lag behind your hands. Settings says what to do.</span>
        </button>
      )}
      <div className="grid gap-6 landscape:grid-cols-[1fr_300px]">
        <Card className="p-7">
          {/* One thing to do, said large enough to read from the bench: what comes next, and the button that starts it. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[0.95rem] font-semibold uppercase tracking-widest text-mc-muted">
                {doneToday
                  ? 'Your session'
                  : at > 0
                    ? `Your session, part ${at + 1} of ${parts.length}`
                    : firstTime
                      ? `Your first session, about ${planMinutes(parts)} minutes`
                      : `Your session, about ${planMinutes(parts)} minutes in ${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`}
              </div>
              <h2 className="mt-1 font-mc-serif text-[2.5rem] leading-tight">{doneToday || !next ? 'Today is done' : next.title}</h2>
              <p className="mt-1.5 max-w-2xl text-[1.25rem] leading-snug text-mc-muted">
                {doneToday || !next
                  ? parts.length > 0
                    ? 'Rest is part of learning. Come back tomorrow. If you want more today, this is extra practice with nothing new in it.'
                    : 'Rest is part of learning. Come back tomorrow.'
                  : at > 0
                    ? `${partDetail(next).replace(/[.\s]+$/, '')}. About ${left} minutes are left.`
                    : firstTime && parts.length > 1
                      ? `By the end of it you will have played your first tune.${runsLong ? ` It is longer than your usual ${profile.minutes} minutes, today only, and you can stop after any part.` : ''}`
                      : `${partDetail(next).replace(/[.\s]+$/, '')}.`}
              </p>
            </div>
            {doneToday && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mc-ok text-white">
                <Icon.Check size={26} />
              </span>
            )}
          </div>
          {parts.length > 0 && (
            <Button
              size="lg"
              variant={doneToday ? 'soft' : 'primary'}
              className="mt-5 w-full"
              onClick={begin}
              icon={<Icon.Play size={22} />}
              // The session starts from the piano: sit down, press the top key, play.
              hint={doneToday ? undefined : hints.top}
            >
              {doneToday ? 'Practise some more' : begun ? 'Carry on' : firstTime ? 'Begin' : 'Start session'}
            </Button>
          )}
          <ol className="mt-6 space-y-2">
            {parts.map((b, i) => {
              const behind = !doneToday && i < at;
              // A part that was passed over is behind, and it is not done.
              const passed = behind && (resume?.skipped ?? []).includes(i);
              const finished = behind && !passed;
              const isNext = !doneToday && i === at;
              return (
                <li key={`${b.kind}-${b.id}-${i}`}>
                  <button
                    onClick={() => open(b)}
                    aria-current={isNext ? 'step' : undefined}
                    className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left active:bg-mc-raised ${isNext ? 'bg-mc-bg ring-2 ring-inset ring-mc-ink/60' : 'bg-mc-bg'}`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${finished ? 'bg-mc-ok text-white' : 'bg-mc-surface text-mc-muted'}`}
                      aria-label={finished ? 'Done' : undefined}
                    >
                      {finished ? <Icon.Check size={22} /> : BLOCK_ICON[b.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold ${behind ? 'text-mc-muted' : ''}`}>
                        {i + 1}. {b.title}
                      </span>
                      <span className="block truncate text-[1.05rem] text-mc-muted">{finished ? 'Done' : passed ? 'Passed over. Tap to do it after all' : partDetail(b)}</span>
                    </span>
                    {!behind && <span className="shrink-0 text-[1.05rem] tabular-nums text-mc-muted">{b.minutes} min</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {halfway.slice(0, 2).map((id) => (
            <div key={id} className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-mc-line px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{getLesson(id).title}</div>
                <div className="text-[1.05rem] leading-snug text-mc-muted">
                  A lesson you left at step {stepOf(id) + 1} of {getLesson(id).steps.length}.
                </div>
              </div>
              <Button variant="soft" className="shrink-0" onClick={() => onStart({ kind: 'lesson', id })}>
                Carry on
              </Button>
            </div>
          ))}
          {offerLesson && upNext && (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-mc-line px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">Want something new?</div>
                <div className="text-[1.05rem] leading-snug text-mc-muted">
                  {whyHeld} The next is <span className="text-mc-ink">{getLesson(upNext).title}</span>, and taking it now is your call.
                </div>
              </div>
              <Button variant="soft" className="shrink-0" onClick={() => onStart({ kind: 'lesson', id: upNext })}>
                Take it now
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <Ring value={Math.min(1, minutesToday / Math.max(1, profile.minutes))} size={64}>
              {minutesToday}
            </Ring>
            <div>
              <div className="font-semibold">
                {minutesToday} of {profile.minutes} minutes
              </div>
              <div className="text-[1.05rem] text-mc-muted">practised today</div>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-mc-raised text-mc-hint">
              <Icon.Flame size={30} />
            </span>
            <div>
              <div className="font-semibold">{run === 0 ? 'No streak yet' : run === 1 ? 'One day' : `${run} days in a row`}</div>
              <div className="text-[1.05rem] text-mc-muted">{run === 0 ? 'It starts with today' : 'Short and regular wins'}</div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[0.9rem] font-semibold uppercase tracking-widest text-mc-muted">Practice tip</div>
            <p className="mt-2 text-[1.1rem] leading-relaxed text-mc-muted">{tip}</p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ learn

export function LearnScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = usePiano((s) => s.lessons);
  const [confirm, setConfirm] = useState<number | null>(null);
  const isDone = (id: string) => lessons[id]?.done === true;
  const isKnown = (id: string) => lessons[id]?.skipped === true;
  const order = lessonOrder();
  const nextId = order.find((id) => !isDone(id));
  const first = allStages()[0];

  // Open at the stage the learner has reached. A new learner is already there, at the top of the page.
  const here = useRef<HTMLElement>(null);
  useEffect(() => {
    if (nextId && !first.lessons.includes(nextId)) here.current?.scrollIntoView({ block: 'start' });
    // Only when the page opens. It does not jump about while a stage is marked or unmarked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page title="Learn" subtitle="The course, one short lesson at a time. Any lesson opens, and the next in order is marked.">
      <div className="space-y-8">
        {allStages().map((stage) => {
          const known = stage.lessons.filter(isKnown).length;
          const taken = stage.lessons.filter(isDone).length - known;
          const all = taken + known === stage.lessons.length;
          return (
            <section key={stage.id} ref={stage.lessons.includes(nextId ?? '') ? here : undefined} className="scroll-mt-4">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[0.9rem] font-semibold uppercase tracking-widest text-mc-muted">Stage {stage.id}</div>
                  <h2 className="font-mc-serif text-2xl">{stage.title}</h2>
                  <p className="text-mc-muted">{stage.goal}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {/* Marking a stage as known is a guess about oneself, so it can be taken back. */}
                  {known > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => undoKnown(stage.id)}>
                      Undo marked as known
                    </Button>
                  ) : (
                    !all && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(stage.id)}>
                        I know this already
                      </Button>
                    )
                  )}
                  <Pill tone={all && known === 0 ? 'ok' : 'muted'}>
                    {known === stage.lessons.length ? 'Marked as known' : known > 0 ? `${taken} done, ${known} known` : `${taken} of ${stage.lessons.length}`}
                  </Pill>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {stage.lessons.map((id) => {
                  const lesson = getLesson(id);
                  const done = isDone(id);
                  const skipped = isKnown(id);
                  const isNext = id === nextId;
                  // Nothing is locked. The course has an order, and the next lesson in it is marked, but any lesson opens.
                  return (
                    <button
                      key={id}
                      onClick={() => onStart({ kind: 'lesson', id })}
                      aria-current={isNext ? 'step' : undefined}
                      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-transform active:scale-[0.99] ${
                        isNext ? 'border-mc-ink bg-mc-surface ring-1 ring-mc-ink' : 'border-mc-line bg-mc-surface'
                      }`}
                    >
                      {/* A lesson taken is filled in. One only marked as known is outlined: it was passed over, not done. */}
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ${
                          skipped
                            ? 'border-2 border-mc-line text-mc-muted'
                            : done
                              ? 'bg-mc-ok text-white'
                              : isNext
                                ? 'bg-mc-ink text-mc-bg'
                                : 'bg-mc-raised text-mc-muted'
                        }`}
                      >
                        {done && !skipped ? <Icon.Check size={22} /> : order.indexOf(id) + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-semibold leading-snug">{lesson.title}</span>
                        <span className="line-clamp-2 text-[1.05rem] text-mc-muted">{lesson.summary}</span>
                      </span>
                      {/* A lesson left part way through says so. */}
                      {!done && (lessons[id]?.step ?? 0) > 0 ? (
                        <Pill tone="accent">Started</Pill>
                      ) : skipped ? (
                        <Pill>Known</Pill>
                      ) : isNext ? (
                        <Pill tone="accent">Next</Pill>
                      ) : (
                        <span className="shrink-0 text-[1.05rem] tabular-nums text-mc-muted">{lesson.minutes} min</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title="Skip ahead?">
        <p className="text-[1.15rem] leading-relaxed text-mc-muted">
          This marks every lesson up to the end of stage {confirm} as known, and adds its notes to your reading review. The lessons stay open, their
          pieces stay on the Pieces page, and the mark can be undone here whenever you like.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="soft" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (confirm !== null) markKnownThrough(confirm);
              setConfirm(null);
            }}
          >
            Mark as known
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

// ----------------------------------------------------------------- pieces

export function PiecesScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = usePiano((s) => s.lessons);
  const states = usePiano((s) => s.pieces);
  const introduced = useMemo(() => introducedPieces(lessons, states), [lessons, states]);
  const passed = useMemo(() => skippedPieces(lessons, states), [lessons, states]);
  const all = allPieces();
  const groups: Array<{ title: string; note: string; ids: string[] }> = [
    { title: 'In practice', note: 'Pieces from your lessons that you are still learning.', ids: introduced.filter((id) => !states[id]?.learned) },
    { title: 'Learned', note: 'These come back for a play through now and then, so they stay with you.', ids: all.filter((p) => states[p.id]?.learned).map((p) => p.id) },
    { title: 'From lessons you skipped', note: 'Easier pieces from the part of the course you marked as known. Open any you would like to play.', ids: passed.filter((id) => !states[id]?.learned) },
    { title: 'Ahead of you', note: 'You can open any of these whenever you like. The lessons will bring them in order.', ids: all.filter((p) => !introduced.includes(p.id) && !passed.includes(p.id) && !states[p.id]?.learned).map((p) => p.id) },
  ];
  return (
    <Page title="Pieces" subtitle="Everything you can play, and everything still to come.">
      <div className="space-y-8">
        {groups
          .filter((g) => g.ids.length > 0)
          .map((g) => (
            <section key={g.title}>
              <h2 className="font-mc-serif text-2xl">{g.title}</h2>
              <p className="mb-3 text-mc-muted">{g.note}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.ids.map((id) => {
                  const piece = all.find((p) => p.id === id)!;
                  const info = pieceInfo(id);
                  const progress = pieceProgress(info, states[id]);
                  return (
                    <button
                      key={id}
                      onClick={() => onStart({ kind: 'piece', id })}
                      className="rounded-2xl border border-mc-line bg-mc-surface p-4 text-left transition-transform active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{piece.title}</div>
                          <div className="truncate text-[1.05rem] text-mc-muted">{piece.composer ?? 'A study written for this course'}</div>
                        </div>
                        <Pill tone={states[id]?.learned ? 'ok' : 'muted'}>{states[id]?.learned ? 'Learned' : `Stage ${piece.stage}`}</Pill>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={progress} tone="ok" />
                        <span className="w-10 shrink-0 text-right text-[0.85rem] tabular-nums text-mc-muted">{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="mt-2 text-[1rem] text-mc-muted">
                        {info.hands.length === 2 ? 'Both hands' : info.hands[0] === 'R' ? 'Right hand' : 'Left hand'}, {info.measures} measures
                      </div>
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

// ------------------------------------------------------------------ train

export function TrainScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const cards = usePiano((s) => s.cards);
  const drills = usePiano((s) => s.drills);
  const lessons = usePiano((s) => s.lessons);
  const due = dueReadingCards(cards, new Date()).length;
  const known = Object.keys(cards).filter((id) => id.startsWith('read:')).length;
  const open = openDrills(lessons);
  // What an exercise says under its name while the lesson that prepares it is still to come.
  const waits = (kind: Exclude<DrillKind, 'reading'>, ready: string) => (open.includes(kind) ? ready : `Best after the lesson called ${getLesson(DRILL_LESSON[kind]).title}`);
  const items: Array<{ id: DrillKind; title: string; text: string; meta: string; icon: ReactNode }> = [
    {
      id: 'reading',
      title: 'Note reading',
      text: 'A note appears on the staff and you play it. Notes you know well come back less often.',
      meta: known === 0 ? 'Opens with the reading lessons' : due > 0 ? `${due} due now, ${known} notes in all` : `${known} notes, none due`,
      icon: <Icon.Eye size={24} />,
    },
    {
      id: 'ear',
      title: 'Play by ear',
      text: 'Hear a short pattern and play it back, with nothing to look at.',
      meta: waits('ear', `Level ${drills.ear?.level ?? 1} of ${EAR_LEVELS}`),
      icon: <Icon.Ear size={24} />,
    },
    {
      id: 'rhythm',
      title: 'Rhythm',
      text: 'Tap written rhythms in time with the beat, on any key.',
      meta: waits('rhythm', `Level ${drills.rhythm?.level ?? 1} of ${RHYTHM_LEVELS}`),
      icon: <Icon.Pulse size={24} />,
    },
    {
      id: 'sight',
      title: 'Sight reading',
      text: 'A new melody every time. Look it over, then play it once without stopping.',
      meta: waits('sight', `Level ${drills.sight?.level ?? 1} of ${SIGHT_LEVELS}`),
      icon: <Icon.Pieces size={24} />,
    },
    {
      id: 'technique',
      title: 'Scales and arpeggios',
      text: 'A scale or an arpeggio, played with the beat. The app listens for an even run, every note the same length.',
      meta: waits('technique', `Level ${drills.technique?.level ?? 1} of ${TECH_LEVELS}`),
      icon: <Icon.Steps size={24} />,
    },
    {
      id: 'chords',
      title: 'Chords',
      text: 'Chord symbols appear and you play them, whole or one note at a time, anywhere on the keyboard.',
      meta: waits('chords', `Level ${drills.chords?.level ?? 1} of ${CHORD_LEVELS}`),
      icon: <Icon.Chord size={24} />,
    },
  ];
  return (
    <Page title="Train" subtitle="Short exercises for one skill at a time. The difficulty follows how you do.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onStart({ kind: 'drill', id: it.id })}
            // Cards in a row share a height. Their contents start from the top, so the icons and titles line up.
            className="flex flex-col items-start rounded-2xl border border-mc-line bg-mc-surface p-6 text-left transition-transform active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mc-raised text-mc-ink">{it.icon}</span>
            <div className="mt-4 font-mc-serif text-2xl">{it.title}</div>
            <p className="mt-1 text-mc-muted">{it.text}</p>
            <div className="mt-auto pt-4 text-[1.05rem] font-semibold text-mc-muted">{it.meta}</div>
          </button>
        ))}
      </div>
    </Page>
  );
}

// --------------------------------------------------------------- progress

/** A day as people write it: 4 March, with the year only when it is not this one. */
function dayText(day: string): string {
  const d = new Date(day + 'T12:00:00');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ProgressScreen() {
  const days = usePiano((s) => s.days);
  const lessons = usePiano((s) => s.lessons);
  const pieces = usePiano((s) => s.pieces);
  const cards = usePiano((s) => s.cards);
  const profile = usePiano((s) => s.profile);
  const recordings = usePiano((s) => s.recordings);
  const path = useMemo(() => milestones(profile.startedOn, lessons, pieces), [profile.startedOn, lessons, pieces]);
  const [allPath, setAllPath] = useState(false);
  // One recording plays at a time. `hearing` names it.
  const player = useRef<TakePlayer | null>(null);
  const [hearing, setHearing] = useState<string | null>(null);
  useEffect(() => () => player.current?.stop(), []);
  const hear = (key: string, recording: Recording) => {
    const p = (player.current ??= new TakePlayer());
    p.stop();
    if (hearing === key) {
      setHearing(null);
      return;
    }
    setHearing(key);
    p.play(recording.take, { onDone: () => setHearing((now) => (now === key ? null : now)) });
  };
  const kept = allPieces().filter((p) => recordings[p.id]);
  const total = lessonOrder().length;
  const known = lessonOrder().filter((id) => lessons[id]?.skipped).length;
  const done = lessonOrder().filter((id) => lessons[id]?.done).length - known;
  const learned = Object.values(pieces).filter((p) => p.learned).length;
  const notes = Object.keys(cards).filter((id) => id.startsWith('read:')).length;
  const last14 = useMemo(() => {
    const out: Array<{ key: string; minutes: number; label: string }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = dayKey(d);
      out.push({ key, minutes: Math.round((days[key]?.seconds ?? 0) / 60), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) });
    }
    return out;
  }, [days]);
  const peak = Math.max(profile.minutes, ...last14.map((d) => d.minutes));
  const stats: Array<[string, string]> = [
    [`${streak(days)}`, 'days in a row'],
    [`${totalMinutes(days)}`, 'minutes in all'],
    [`${done} of ${total}`, known > 0 ? `lessons done, and ${known} marked as known` : 'lessons done'],
    [`${learned}`, learned === 1 ? 'piece learned' : 'pieces learned'],
    [`${notes}`, 'notes you can read'],
  ];
  return (
    <Page title="Progress" subtitle="What you have built so far.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([value, label]) => (
          <Card key={label} className="p-5">
            <div className="font-mc-serif text-3xl">{value}</div>
            <div className="mt-1 text-[1.05rem] text-mc-muted">{label}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mc-serif text-2xl">The last two weeks</h2>
          <span className="text-[1.05rem] text-mc-muted">minutes a day, goal {profile.minutes}</span>
        </div>
        <div className="mt-5 flex h-40 items-end gap-2">
          {last14.map((d) => (
            <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full rounded-t-md ${d.minutes >= profile.minutes ? 'bg-mc-ok' : d.minutes > 0 ? 'bg-mc-ok/45' : 'bg-mc-line'}`}
                style={{ height: `${Math.max(3, (d.minutes / peak) * 100)}%` }}
                title={`${d.minutes} minutes`}
              />
              <span className="text-[0.9rem] text-mc-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-6 grid gap-6 landscape:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-mc-serif text-2xl">Your path so far</h2>
          <ol className="mt-4">
            {(allPath ? path : path.slice(0, 6)).map((m, i, shown) => (
              <li key={`${m.on}-${m.title}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.kind === 'start' ? 'bg-mc-line' : 'bg-mc-ok'}`} />
                  {i < shown.length - 1 && <span className="w-px flex-1 bg-mc-line" />}
                </div>
                <div className="pb-4">
                  <div className="font-semibold leading-snug">{m.title}</div>
                  <div className="text-[1.05rem] text-mc-muted">{dayText(m.on)}</div>
                </div>
              </li>
            ))}
          </ol>
          {path.length > 6 && (
            <Button variant="ghost" size="sm" className="-ml-4" onClick={() => setAllPath((v) => !v)}>
              {allPath ? 'Show less' : `Show all ${path.length}`}
            </Button>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-mc-serif text-2xl">Your recordings</h2>
          {kept.length === 0 ? (
            <p className="mt-3 text-[1.1rem] leading-relaxed text-mc-muted">
              When you learn a piece, your own playing of it is kept here. Later play throughs are kept beside the first, so you can hear how far you have come.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-mc-line">
              {kept.map((p) => {
                const r = recordings[p.id];
                const takes: Array<[string, string, Recording]> = [[`${p.id}:first`, r.latest ? 'First' : 'Recorded', r.first]];
                if (r.latest) takes.push([`${p.id}:latest`, 'Latest', r.latest]);
                return (
                  <li key={p.id} className="py-3">
                    <div className="font-semibold">{getPiece(p.id).title}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {takes.map(([key, label, recording]) => (
                        <button
                          key={key}
                          onClick={() => hear(key, recording)}
                          className={`flex h-11 items-center gap-2 rounded-full px-4 text-[1.1rem] font-semibold active:scale-[0.97] ${
                            hearing === key ? 'bg-mc-ink text-mc-bg' : 'bg-mc-raised text-mc-ink'
                          }`}
                        >
                          {hearing === key ? <Icon.Close size={16} /> : <Icon.Play size={15} />}
                          <span>
                            {label}, {dayText(recording.on)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-6 space-y-4">
        {allStages().map((stage) => {
          const skipped = stage.lessons.filter((id) => lessons[id]?.skipped).length;
          const n = stage.lessons.filter((id) => lessons[id]?.done).length - skipped;
          return (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="w-48 shrink-0">
                <div className="text-[0.9rem] font-semibold uppercase tracking-widest text-mc-muted">Stage {stage.id}</div>
                <div className="font-semibold">{stage.title}</div>
              </div>
              {/* A stage marked as known is not shown as done: the bar is for lessons taken. */}
              <ProgressBar value={n / stage.lessons.length} tone="ok" />
              <span className="w-40 shrink-0 text-right text-[1.05rem] tabular-nums text-mc-muted">
                {skipped === stage.lessons.length ? 'Marked as known' : skipped > 0 ? `${n} done, ${skipped} known` : `${n} of ${stage.lessons.length}`}
              </span>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

// --------------------------------------------------------------- settings

function Row({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {text && <div className="text-[1.1rem] text-mc-muted">{text}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TimingCheck({ onDone }: { onDone: (biasMs: number | null) => void }) {
  const score = useMemo(() => parseScore({ rh: 'C4q C4q C4q C4q | C4q C4q C4q C4q', tempo: 84 }), []);
  return (
    <div className="h-[420px]">
      <PlaySurface
        score={score}
        mode="tempo"
        display="contour"
        contourLabel="none"
        anyKey
        click
        runId="timing"
        onDone={(r: FlowResult | null) => onDone(r && r.correctNotes >= 5 ? r.biasMs : null)}
      />
    </div>
  );
}

export function SettingsScreen({ onGo }: { onGo: (v: View) => void }) {
  const settings = usePiano((s) => s.settings);
  const profile = usePiano((s) => s.profile);
  const setSettings = usePiano((s) => s.setSettings);
  const setProfile = usePiano((s) => s.setProfile);
  const importData = usePiano((s) => s.importData);
  const resetAll = usePiano((s) => s.resetAll);
  const [about, setAbout] = useState<'privacy' | 'credits' | null>(null);
  const mode = useInputMode();
  const native = isNative();
  const [timing, setTiming] = useState(false);
  const [timingNote, setTimingNote] = useState<string | null>(null);
  const [backup, setBackup] = useState(false);
  const [paste, setPaste] = useState('');
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<boolean | 'failed'>(false);

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(exportData());
      setCopied(true);
    } catch {
      setCopied('failed');
    }
  };

  const restoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPaste(await file.text());
      setBackupNote(null);
    } catch {
      setBackupNote('That file could not be read.');
    }
  };

  const download = () => {
    // The iPad app hands the file to the share sheet: Files, AirDrop, Mail.
    if (shareFile(`middle-c-${dayKey()}.json`, exportData())) return;
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `middle-c-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Page title="Settings">
      <section>
        <h2 className="mb-3 font-mc-serif text-2xl">Your piano</h2>
        <ConnectionPanel />
        <div className="mt-4">
          <ConnectionReport />
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">Hands on the keys</h2>
        <p className="text-mc-muted">Run the app from the piano, so you do not have to reach for the screen.</p>
        <Card className="mt-3 divide-y divide-mc-line px-5">
          <Row title="Top and bottom keys as buttons" text="The top key of the piano means go on. The bottom key means again, or back on a page of words.">
            <Toggle value={settings.remoteKeys} onChange={(v) => setSettings({ remoteKeys: v })} label="Top and bottom keys as buttons" />
          </Row>
          <Row
            title="Pedals as buttons"
            text="The middle pedal means go on and the left pedal means again. On a page with no music, the right pedal means go on too. While music is on the stand it stays a pedal."
          >
            <Toggle value={settings.remotePedals} onChange={(v) => setSettings({ remotePedals: v })} label="Pedals as buttons" />
          </Row>
        </Card>
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">Sound and timing</h2>
        <Card className="mt-3 divide-y divide-mc-line px-5">
          <Row title="Metronome click" text="The count in is always played.">
            <Toggle value={settings.metronome} onChange={(v) => setSettings({ metronome: v })} label="Metronome click" />
          </Row>
          <Row title="Click volume">
            <input type="range" className="mc-range w-56" min={0} max={1} step={0.05} value={settings.clickVolume} onChange={(e) => setSettings({ clickVolume: Number(e.target.value) })} />
          </Row>
          <Row title="Piano volume" text="The sampled piano inside the app.">
            <input type="range" className="mc-range w-56" min={0} max={1} step={0.05} value={settings.pianoVolume} onChange={(e) => setSettings({ pianoVolume: Number(e.target.value) })} />
          </Row>
          <Row
            title="Timing check"
            text={
              timingNote ??
              (settings.latencyMs === 0
                ? 'If the app says you are late when you are not, run this once. It matters most with Bluetooth sound.'
                : `Adjusted by ${Math.round(settings.latencyMs)} milliseconds.`)
            }
          >
            <div className="flex gap-2">
              {settings.latencyMs !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSettings({ latencyMs: 0 })}>
                  Clear
                </Button>
              )}
              <Button variant="soft" size="sm" onClick={() => setTiming(true)}>
                Run
              </Button>
            </div>
          </Row>
        </Card>
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">Practice</h2>
        <Card className="mt-3 divide-y divide-mc-line px-5">
          <Row title="Daily session" text="How long you want to practise on a normal day.">
            <Segmented
              value={profile.minutes}
              onChange={(v) => setProfile({ minutes: v })}
              options={[
                { value: 10, label: '10 min' },
                { value: 20, label: '20 min' },
                { value: 30, label: '30 min' },
              ]}
            />
          </Row>
          <Row title="Appearance">
            <Segmented
              value={settings.theme}
              onChange={(v) => setSettings({ theme: v })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Row>
        </Card>
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">Your data</h2>
        <p className="text-mc-muted">
          {native
            ? 'Progress is kept on this iPad, and a dated copy is put in the Files app under Middle C each day you practise. Save a backup to carry it to another device.'
            : 'Progress is kept in this browser on this device. Save a backup now and then, and use it to move to another browser or device.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            variant="soft"
            onClick={() => {
              setCopied(false);
              setSaving(true);
            }}
          >
            Save a backup
          </Button>
          <Button variant="soft" onClick={() => setBackup(true)}>
            Restore from a backup
          </Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Start over
          </Button>
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">About</h2>
        <Card className="mt-3 p-5 text-[1.1rem] leading-relaxed text-mc-muted">
          <p>
            Middle C teaches piano the way studies of learning suggest it should be taught. Every choice, and how strong the evidence for it is, is set
            out on the method page.
          </p>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => onGo('method')}>
            Read the method
          </Button>
          <p className="mt-4">Middle C collects nothing about you, and the work of others it contains is credited here.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="soft" size="sm" onClick={() => setAbout('privacy')}>
              Privacy
            </Button>
            <Button variant="soft" size="sm" onClick={() => setAbout('credits')}>
              Acknowledgements
            </Button>
          </div>
        </Card>
      </section>

      <Sheet open={about === 'privacy'} onClose={() => setAbout(null)} title="Privacy" wide>
        <PrivacyText />
      </Sheet>
      <Sheet open={about === 'credits'} onClose={() => setAbout(null)} title="Acknowledgements" wide>
        <CreditsText />
      </Sheet>

      <Sheet open={timing} onClose={() => setTiming(false)} title="Timing check" wide>
        <p className="mb-2 text-mc-muted">Play any key to begin. After the count in, play a key exactly with each click, eight times, as you normally would.</p>
        {timing && (
          <TimingCheck
            onDone={(bias) => {
              setTiming(false);
              if (bias === null) {
                setTimingNote('That did not register enough notes. Try again when you are ready.');
                return;
              }
              const next = Math.max(-150, Math.min(300, settings.latencyMs + bias));
              setSettings({ latencyMs: Math.round(next) });
              setTimingNote(`Done. Timing is now adjusted by ${Math.round(next)} milliseconds.`);
            }}
          />
        )}
      </Sheet>

      <Sheet open={saving} onClose={() => setSaving(false)} title="Save a backup">
        <p className="mb-4 text-mc-muted">
          Save your progress as a file, or copy it and paste it somewhere safe such as a note. Either can be restored later, here or on another
          device.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={download}>Save as a file</Button>
          <Button variant="soft" onClick={() => void copyBackup()}>
            {copied === true ? 'Copied' : 'Copy to the clipboard'}
          </Button>
        </div>
        {copied === 'failed' && <p className="mt-3 text-[1.05rem] text-mc-muted">Copying is not allowed here. Select the text below and copy it by hand.</p>}
        {saving && (
          <textarea
            readOnly
            className="mc-selectable mt-4 h-32 w-full rounded-2xl border border-mc-line bg-mc-bg p-3 font-mono text-[0.85rem] text-mc-muted"
            value={exportData()}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </Sheet>

      <Sheet open={backup} onClose={() => setBackup(false)} title="Restore from a backup">
        <p className="mb-3 text-mc-muted">Choose your backup file, or paste its contents below. This replaces the progress {native ? 'on this iPad' : 'in this browser'}.</p>
        <label className="mb-3 inline-flex h-11 cursor-pointer items-center rounded-full bg-mc-raised px-5 font-semibold active:scale-[0.97]">
          Choose a file
          <input type="file" accept=".json,application/json,text/plain" className="sr-only" onChange={(e) => void restoreFile(e.target.files?.[0])} />
        </label>
        <textarea
          className="mc-selectable h-40 w-full rounded-2xl border border-mc-line bg-mc-bg p-3 font-mono text-[0.85rem] text-mc-ink"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste the contents of your backup file"
        />
        {backupNote && <p className="mt-2 text-[1.05rem] text-mc-muted">{backupNote}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="soft" onClick={() => setBackup(false)}>
            Cancel
          </Button>
          <Button
            disabled={paste.trim().length === 0}
            onClick={() => {
              const ok = importData(paste);
              setBackupNote(ok ? 'Restored.' : 'That does not look like a Middle C backup.');
              if (ok) {
                setPaste('');
                setTimeout(() => setBackup(false), 900);
              }
            }}
          >
            Restore
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Start over?">
        <p className="text-[1.05rem] leading-relaxed text-mc-muted">This erases all lessons, pieces and review history {native ? 'on this iPad' : 'in this browser'}. Your settings are kept. It cannot be undone, so save a backup first if you might want it back.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="soft" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              resetAll();
              setConfirmReset(false);
            }}
          >
            Erase my progress
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

// ----------------------------------------------------------------- method

const STRENGTH: Record<Strength, { label: string; tone: 'ok' | 'accent' | 'hint' }> = {
  strong: { label: 'Well supported', tone: 'ok' },
  moderate: { label: 'Supported, with limits', tone: 'accent' },
  limited: { label: 'Thin or mixed evidence', tone: 'hint' },
};

export function MethodScreen({ onGo }: { onGo: (v: View) => void }) {
  return (
    <Page
      title="The method"
      subtitle="How this app teaches, and how sure anyone can be that each choice is right."
      right={
        <Button variant="soft" size="sm" onClick={() => onGo('settings')} icon={<Icon.Left size={16} />}>
          Back
        </Button>
      }
    >
      <p className="max-w-3xl text-[1.1rem] leading-relaxed text-mc-muted">
        Much advice about practising is folklore. Before building this, each idea was checked against the studies behind it. Some held up well. Some
        turned out weaker than their reputation, and a few were dropped. Each one below is marked with how far the evidence goes.
      </p>
      <div className="mt-7 space-y-4">
        {PRINCIPLES.map((p) => (
          <Card key={p.title} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mc-serif text-2xl">{p.title}</h2>
              <Pill tone={STRENGTH[p.strength].tone}>{STRENGTH[p.strength].label}</Pill>
            </div>
            <p className="mt-2 text-[1.05rem] leading-relaxed text-mc-ink">{p.what}</p>
            <p className="mt-2 text-[1.1rem] leading-relaxed text-mc-muted">{p.evidence}</p>
            <p className="mc-selectable mt-3 text-[0.9rem] leading-relaxed text-mc-muted">{p.sources.join('. ')}.</p>
          </Card>
        ))}
      </div>
      <h2 className="mt-10 font-mc-serif text-3xl">Left out on purpose</h2>
      <div className="mt-4 space-y-3">
        {NOT_USED.map((n) => (
          <Card key={n.title} className="p-6">
            <h3 className="font-semibold">{n.title}</h3>
            <p className="mt-1 text-[1.1rem] leading-relaxed text-mc-muted">{n.why}</p>
          </Card>
        ))}
      </div>
    </Page>
  );
}
