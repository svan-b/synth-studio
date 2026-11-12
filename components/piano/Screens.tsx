'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { allPieces, allStages, getLesson, lessonOrder, lessonUnlocked, pieceInfo } from '@/lib/piano/content/catalog';
import { NOT_USED, PRINCIPLES, TIPS, type Strength } from '@/lib/piano/content/method';
import type { FlowResult } from '@/lib/piano/engine/flow';
import { pieceProgress } from '@/lib/piano/learn/coach';
import { EAR_LEVELS, RHYTHM_LEVELS, SIGHT_LEVELS } from '@/lib/piano/learn/generators';
import { dueReadingCards, introducedPieces, planMinutes, planSession, readsStaff, type Block, type DrillKind } from '@/lib/piano/learn/planner';
import { exportData, streak, totalMinutes, usePiano } from '@/lib/piano/learn/store';
import { parseScore } from '@/lib/piano/music/score';
import { dayKey } from '@/lib/piano/util/emitter';
import ConnectionPanel, { ConnectionChip } from './Connection';
import { useInputMode } from './hooks';
import PlaySurface from './PlaySurface';
import { Button, Card, Icon, Pill, ProgressBar, Ring, Segmented, Sheet, Toggle } from './ui';

export type View = 'today' | 'learn' | 'pieces' | 'train' | 'progress' | 'settings' | 'method';

export type Activity =
  | { kind: 'lesson'; id: string }
  | { kind: 'piece'; id: string; minutes?: number }
  | { kind: 'drill'; id: DrillKind }
  | { kind: 'session'; blocks: Block[] };

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

export function TodayScreen({ onStart, onGo }: { onStart: (a: Activity) => void; onGo: (v: View) => void }) {
  const profile = usePiano((s) => s.profile);
  const lessons = usePiano((s) => s.lessons);
  const pieces = usePiano((s) => s.pieces);
  const cards = usePiano((s) => s.cards);
  const days = usePiano((s) => s.days);
  const sessionDoneOn = usePiano((s) => s.sessionDoneOn);
  const today = dayKey();
  const plan = useMemo(() => planSession({ minutes: profile.minutes, lessons, pieces, cards }), [profile.minutes, lessons, pieces, cards]);
  const doneToday = sessionDoneOn === today;
  const minutesToday = Math.round((days[today]?.seconds ?? 0) / 60);
  const run = streak(days);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const tip = TIPS[Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000) % TIPS.length];
  const firstTime = Object.keys(lessons).length === 0 && Object.keys(days).length === 0;

  return (
    <Page title="Today" subtitle={date} right={<ConnectionChip onClick={() => onGo('settings')} />}>
      <div className="grid gap-6 landscape:grid-cols-[1fr_300px]">
        <Card className="p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-mc-serif text-2xl">{doneToday ? 'Today is done' : firstTime ? 'Your first session' : 'Your session'}</h2>
              <p className="mt-1 text-mc-muted">
                {doneToday
                  ? 'Rest is part of learning. Come back tomorrow, or carry on below if you want more.'
                  : `About ${planMinutes(plan)} minutes, in ${plan.length} ${plan.length === 1 ? 'part' : 'parts'}.`}
              </p>
            </div>
            {doneToday && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mc-ok text-white">
                <Icon.Check size={24} />
              </span>
            )}
          </div>
          <ol className="mt-5 space-y-2">
            {plan.map((b, i) => (
              <li key={`${b.kind}-${b.id}`}>
                <button
                  onClick={() => onStart(b.kind === 'lesson' ? { kind: 'lesson', id: b.id } : b.kind === 'piece' ? { kind: 'piece', id: b.id, minutes: b.minutes } : { kind: 'drill', id: b.id })}
                  className="flex w-full items-center gap-4 rounded-2xl bg-mc-bg px-4 py-3 text-left active:bg-mc-raised"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mc-surface text-mc-muted">{BLOCK_ICON[b.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {i + 1}. {b.title}
                    </span>
                    <span className="block truncate text-sm text-mc-muted">{b.detail}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-mc-muted">{b.minutes} min</span>
                </button>
              </li>
            ))}
          </ol>
          <Button size="lg" className="mt-6 w-full" onClick={() => onStart({ kind: 'session', blocks: plan })} icon={<Icon.Play size={20} />}>
            {doneToday ? 'Practise some more' : firstTime ? 'Begin' : 'Start session'}
          </Button>
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
              <div className="text-sm text-mc-muted">practised today</div>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-mc-raised text-mc-hint">
              <Icon.Flame size={30} />
            </span>
            <div>
              <div className="font-semibold">{run === 0 ? 'No streak yet' : run === 1 ? 'One day' : `${run} days in a row`}</div>
              <div className="text-sm text-mc-muted">{run === 0 ? 'It starts with today' : 'Short and regular wins'}</div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-mc-faint">Practice tip</div>
            <p className="mt-2 text-[15px] leading-relaxed text-mc-muted">{tip}</p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ learn

export function LearnScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = usePiano((s) => s.lessons);
  const completeLesson = usePiano((s) => s.completeLesson);
  const addCards = usePiano((s) => s.addCards);
  const [confirm, setConfirm] = useState<number | null>(null);
  const isDone = (id: string) => lessons[id]?.done === true;
  const nextId = lessonOrder().find((id) => !isDone(id));

  const skipStage = (stageId: number) => {
    // Everything up to and including this stage is marked as known.
    for (const stage of allStages()) {
      if (stage.id > stageId) break;
      for (const id of stage.lessons) {
        completeLesson(id);
        const cards = getLesson(id).cards;
        if (cards) addCards(cards);
      }
    }
    setConfirm(null);
  };

  return (
    <Page title="Learn" subtitle="The course, one short lesson at a time.">
      <div className="space-y-8">
        {allStages().map((stage) => {
          const doneCount = stage.lessons.filter(isDone).length;
          return (
            <section key={stage.id}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-mc-faint">Stage {stage.id}</div>
                  <h2 className="font-mc-serif text-2xl">{stage.title}</h2>
                  <p className="text-mc-muted">{stage.goal}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {doneCount < stage.lessons.length && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(stage.id)}>
                      I know this already
                    </Button>
                  )}
                  <Pill tone={doneCount === stage.lessons.length ? 'ok' : 'muted'}>
                    {doneCount} of {stage.lessons.length}
                  </Pill>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {stage.lessons.map((id) => {
                  const lesson = getLesson(id);
                  const done = isDone(id);
                  const open = lessonUnlocked(id, isDone);
                  const isNext = id === nextId;
                  return (
                    <button
                      key={id}
                      disabled={!open}
                      onClick={() => onStart({ kind: 'lesson', id })}
                      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-transform active:scale-[0.99] ${
                        isNext ? 'border-mc-ink bg-mc-surface' : 'border-mc-line bg-mc-surface'
                      } ${open ? '' : 'opacity-50'}`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          done ? 'bg-mc-ok text-white' : isNext ? 'bg-mc-ink text-mc-bg' : 'bg-mc-raised text-mc-muted'
                        }`}
                      >
                        {done ? <Icon.Check size={20} /> : open ? <Icon.Play size={16} /> : <Icon.Lock size={18} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{lesson.title}</span>
                        <span className="block truncate text-sm text-mc-muted">{lesson.summary}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-mc-muted">{lesson.minutes} min</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title="Skip ahead?">
        <p className="text-[1.05rem] leading-relaxed text-mc-muted">
          This marks every lesson up to the end of stage {confirm} as done, and adds its notes to your reading review. You can still open any of those
          lessons later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="soft" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button onClick={() => confirm !== null && skipStage(confirm)}>Mark as known</Button>
        </div>
      </Sheet>
    </Page>
  );
}

// ----------------------------------------------------------------- pieces

export function PiecesScreen({ onStart }: { onStart: (a: Activity) => void }) {
  const lessons = usePiano((s) => s.lessons);
  const states = usePiano((s) => s.pieces);
  const introduced = useMemo(() => introducedPieces(lessons), [lessons]);
  const all = allPieces();
  const groups: Array<{ title: string; note: string; ids: string[] }> = [
    { title: 'In practice', note: 'Pieces from your lessons that you are still learning.', ids: introduced.filter((id) => !states[id]?.learned) },
    { title: 'Learned', note: 'These come back for a play through now and then, so they stay with you.', ids: all.filter((p) => states[p.id]?.learned).map((p) => p.id) },
    { title: 'Ahead of you', note: 'You can open any of these whenever you like. The lessons will bring them in order.', ids: all.filter((p) => !introduced.includes(p.id) && !states[p.id]?.learned).map((p) => p.id) },
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
                          <div className="truncate text-sm text-mc-muted">{piece.composer ?? 'A study written for this course'}</div>
                        </div>
                        <Pill tone={states[id]?.learned ? 'ok' : 'muted'}>{states[id]?.learned ? 'Learned' : `Stage ${piece.stage}`}</Pill>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={progress} tone="ok" />
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-mc-muted">{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="mt-2 text-xs text-mc-faint">
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
      meta: `Level ${drills.ear?.level ?? 1} of ${EAR_LEVELS}`,
      icon: <Icon.Ear size={24} />,
    },
    {
      id: 'rhythm',
      title: 'Rhythm',
      text: 'Tap written rhythms in time with the beat, on any key.',
      meta: `Level ${drills.rhythm?.level ?? 1} of ${RHYTHM_LEVELS}`,
      icon: <Icon.Pulse size={24} />,
    },
    {
      id: 'sight',
      title: 'Sight reading',
      text: 'A new melody every time. Look it over, then play it once without stopping.',
      meta: readsStaff(lessons) ? `Level ${drills.sight?.level ?? 1} of ${SIGHT_LEVELS}` : 'Best after the reading lessons',
      icon: <Icon.Pieces size={24} />,
    },
  ];
  return (
    <Page title="Train" subtitle="Short exercises for one skill at a time. The difficulty follows how you do.">
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onStart({ kind: 'drill', id: it.id })}
            className="rounded-2xl border border-mc-line bg-mc-surface p-6 text-left transition-transform active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mc-raised text-mc-ink">{it.icon}</span>
            <div className="mt-4 font-mc-serif text-2xl">{it.title}</div>
            <p className="mt-1 text-mc-muted">{it.text}</p>
            <div className="mt-4 text-sm font-semibold text-mc-faint">{it.meta}</div>
          </button>
        ))}
      </div>
    </Page>
  );
}

// --------------------------------------------------------------- progress

export function ProgressScreen() {
  const days = usePiano((s) => s.days);
  const lessons = usePiano((s) => s.lessons);
  const pieces = usePiano((s) => s.pieces);
  const cards = usePiano((s) => s.cards);
  const profile = usePiano((s) => s.profile);
  const total = lessonOrder().length;
  const done = lessonOrder().filter((id) => lessons[id]?.done).length;
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
    [`${done} of ${total}`, 'lessons done'],
    [`${learned}`, learned === 1 ? 'piece learned' : 'pieces learned'],
    [`${notes}`, 'notes you can read'],
  ];
  return (
    <Page title="Progress" subtitle="What you have built so far.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([value, label]) => (
          <Card key={label} className="p-5">
            <div className="font-mc-serif text-3xl">{value}</div>
            <div className="mt-1 text-sm text-mc-muted">{label}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mc-serif text-2xl">The last two weeks</h2>
          <span className="text-sm text-mc-muted">minutes a day, goal {profile.minutes}</span>
        </div>
        <div className="mt-5 flex h-40 items-end gap-2">
          {last14.map((d) => (
            <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full rounded-t-md ${d.minutes >= profile.minutes ? 'bg-mc-ok' : d.minutes > 0 ? 'bg-mc-ok/45' : 'bg-mc-line'}`}
                style={{ height: `${Math.max(3, (d.minutes / peak) * 100)}%` }}
                title={`${d.minutes} minutes`}
              />
              <span className="text-xs text-mc-faint">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-6 space-y-4">
        {allStages().map((stage) => {
          const n = stage.lessons.filter((id) => lessons[id]?.done).length;
          return (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="w-48 shrink-0">
                <div className="text-xs font-semibold uppercase tracking-widest text-mc-faint">Stage {stage.id}</div>
                <div className="font-semibold">{stage.title}</div>
              </div>
              <ProgressBar value={n / stage.lessons.length} tone="ok" />
              <span className="w-14 shrink-0 text-right text-sm tabular-nums text-mc-muted">
                {n} of {stage.lessons.length}
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
        {text && <div className="text-[15px] text-mc-muted">{text}</div>}
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
  const mode = useInputMode();
  const [timing, setTiming] = useState(false);
  const [timingNote, setTimingNote] = useState<string | null>(null);
  const [backup, setBackup] = useState(false);
  const [paste, setPaste] = useState('');
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const download = () => {
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
      </section>

      <section className="mt-9">
        <h2 className="font-mc-serif text-2xl">Hands on the keys</h2>
        <p className="text-mc-muted">Run the app from the piano, so you do not have to reach for the screen.</p>
        <Card className="mt-3 divide-y divide-mc-line px-5">
          <Row title="Top and bottom keys as buttons" text="The highest key means continue. The lowest key means again, or hear it.">
            <Toggle value={settings.remoteKeys} onChange={(v) => setSettings({ remoteKeys: v })} label="Top and bottom keys as buttons" />
          </Row>
          <Row title="Left and middle pedals as buttons" text="The middle pedal means continue and the left pedal means again. The right pedal stays a pedal.">
            <Toggle value={settings.remotePedals} onChange={(v) => setSettings({ remotePedals: v })} label="Left and middle pedals as buttons" />
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
          Progress is kept in this browser on this device. Save a backup now and then, and use it to move to another browser or device.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="soft" onClick={download}>
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
        <Card className="mt-3 p-5 text-[15px] leading-relaxed text-mc-muted">
          <p>
            Middle C teaches piano the way studies of learning suggest it should be taught. Every choice, and how strong the evidence for it is, is set
            out on the method page.
          </p>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => onGo('method')}>
            Read the method
          </Button>
          <p className="mt-4">
            Piano sound: Salamander Grand Piano by Alexander Holm, used under the Creative Commons Attribution 3.0 licence. Notation drawn with VexFlow.
            {mode === 'midi' ? ' When connected over MIDI, your own piano plays its own sound.' : ''}
          </p>
        </Card>
      </section>

      <Sheet open={timing} onClose={() => setTiming(false)} title="Timing check" wide>
        <p className="mb-2 text-mc-muted">After the count in, play any key exactly with each click, eight times. Play as you normally would.</p>
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

      <Sheet open={backup} onClose={() => setBackup(false)} title="Restore from a backup">
        <p className="mb-3 text-mc-muted">Open your backup file, copy everything in it, and paste it here. This replaces the progress in this browser.</p>
        <textarea
          className="mc-selectable h-40 w-full rounded-2xl border border-mc-line bg-mc-bg p-3 font-mono text-xs text-mc-ink"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste the contents of your backup file"
        />
        {backupNote && <p className="mt-2 text-sm text-mc-muted">{backupNote}</p>}
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
        <p className="text-[1.05rem] leading-relaxed text-mc-muted">This erases all lessons, pieces and review history in this browser. Your settings are kept. It cannot be undone, so save a backup first if you might want it back.</p>
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
            <p className="mt-2 text-[15px] leading-relaxed text-mc-muted">{p.evidence}</p>
            <p className="mc-selectable mt-3 text-xs leading-relaxed text-mc-faint">{p.sources.join('. ')}.</p>
          </Card>
        ))}
      </div>
      <h2 className="mt-10 font-mc-serif text-3xl">Left out on purpose</h2>
      <div className="mt-4 space-y-3">
        {NOT_USED.map((n) => (
          <Card key={n.title} className="p-6">
            <h3 className="font-semibold">{n.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-mc-muted">{n.why}</p>
          </Card>
        ))}
      </div>
    </Page>
  );
}
