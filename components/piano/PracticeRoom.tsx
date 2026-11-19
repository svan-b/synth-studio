'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { instrument } from '@/lib/piano/audio/instrument';
import { TakePlayer } from '@/lib/piano/audio/replay';
import { getPiece, pieceInfo, pieceScore } from '@/lib/piano/content/catalog';
import type { FlowResult, Take } from '@/lib/piano/engine/flow';
import {
  applyResult,
  newPieceState,
  nextTask,
  pieceProgress,
  planOutline,
  skipTrial,
  type PieceState,
  type Task,
  type Verdict,
} from '@/lib/piano/learn/coach';
import { readsStaff } from '@/lib/piano/learn/planner';
import { outcomeFromAccuracy } from '@/lib/piano/learn/srs';
import { usePiano } from '@/lib/piano/learn/store';
import { sliceScore } from '@/lib/piano/music/score';
import type { Hand } from '@/lib/piano/music/theory';
import { useInputMode, usePracticeTimer, useRemote, useWakeLock } from './hooks';
import PlaySurface from './PlaySurface';
import { Button, Icon, IconButton, Pill, ProgressBar, Segmented, Sheet } from './ui';

interface Free {
  section: number;
  hands: 'both' | 'R' | 'L';
  mode: 'listen' | 'wait' | 'tempo';
  tempoPct: number;
}

type Stage = 'play' | 'reflect' | 'verdict' | 'learned' | 'timeup';

function statsLine(result: FlowResult): string {
  if (result.mode === 'wait') {
    return result.clean ? 'Every note right the first time' : `${result.correctNotes} of ${result.totalNotes} notes right the first time`;
  }
  const pct = Math.round(result.accuracy * 100);
  const timing = `${Math.round(result.onTime * 100)} percent on the beat`;
  return `${pct} percent of the notes, ${timing}`;
}

/** How long a reply stays up before the next run begins by itself. Longer replies get longer, and a miss gets time to look at the marks. */
function readTime(message: string, passed: boolean): number {
  const reading = 1400 + message.length * 42;
  return passed ? Math.min(7000, Math.max(2600, reading)) : Math.min(8500, Math.max(5500, reading));
}

export default function PracticeRoom({ pieceId, minutes, onClose }: { pieceId: string; minutes?: number; onClose: () => void }) {
  const piece = useMemo(() => getPiece(pieceId), [pieceId]);
  const info = useMemo(() => pieceInfo(pieceId), [pieceId]);
  const full = useMemo(() => pieceScore(pieceId), [pieceId]);
  const stored = usePiano((s) => s.pieces[pieceId]);
  const lessons = usePiano((s) => s.lessons);
  const kept = usePiano((s) => s.recordings[pieceId]);
  const setPiece = usePiano((s) => s.setPiece);
  const keepRecording = usePiano((s) => s.keepRecording);
  const reviewCard = usePiano((s) => s.reviewCard);
  const addCards = usePiano((s) => s.addCards);
  const logPractice = usePiano((s) => s.logPractice);
  const inputMode = useInputMode();

  const [state, setState] = useState<PieceState>(() => stored ?? newPieceState(info));
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState<Stage>('play');
  const [verdict, setVerdict] = useState<{ v: Verdict; stats: string } | null>(null);
  const [free, setFree] = useState<Free | null>(null);
  const [options, setOptions] = useState(false);
  const [modelOnce, setModelOnce] = useState(false);
  // A quiet word in place of the task's prompt, as after a run in which nothing was played.
  const [aside, setAside] = useState<string | null>(null);
  // What was just played, kept so that it can be heard back.
  const [take, setTake] = useState<Take | null>(null);
  const [replay, setReplay] = useState<{ take: Take; key: number } | null>(null);
  // The learned piece, heard back from the screen that says so.
  const [encore, setEncore] = useState(false);
  const encorePlayer = useRef<TakePlayer | null>(null);
  // A learned piece has been played through and is still there. Once is enough.
  const kept1 = useRef(false);
  const [ending, setEnding] = useState<'time' | 'kept'>('time');
  const startedAt = useRef(performance.now());
  const notesPlayed = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);

  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, notesPlayed.current, 1));
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      encorePlayer.current?.stop();
    },
    [],
  );

  const task: Task | null = useMemo(() => nextTask(info, state), [info, state]);
  const trial = !free && task?.scope.type === 'trial';

  // What is on the stand right now: the coach's task, or the learner's own choice.
  const view = useMemo(() => {
    if (free) {
      const [from, to] = free.section < 0 ? [0, info.measures - 1] : info.sections[free.section];
      const hands: Hand[] = free.hands === 'both' ? info.hands : [free.hands];
      return { from, to, hands, mode: free.mode, tempoPct: free.tempoPct, stopAfter: null };
    }
    if (!task) return null;
    return {
      from: task.from,
      to: task.to,
      hands: task.hands,
      mode: modelOnce ? ('listen' as const) : task.mode,
      tempoPct: task.mode === 'wait' ? 85 : task.tempoPct,
      stopAfter: modelOnce ? null : (task.stopAfter ?? null),
    };
  }, [free, info, modelOnce, task]);

  // The stand changes only when a run begins. While a verdict is on screen it
  // still shows the music that was just played, marks and all, and the next
  // run does not start underneath it.
  const [stand, setStand] = useState({ run, view });
  if (stand.run !== run) setStand({ run, view });
  const shown = stand.run === run ? stand.view : view;

  const score = useMemo(() => (shown ? sliceScore(full, shown.from, shown.to) : full), [full, shown]);
  // Early pieces are shown as a picture of their shape until reading has been taught.
  const display = piece.stage === 1 && !readsStaff(lessons) ? 'contour' : 'staff';

  const proceed = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVerdict(null);
    setAside(null);
    setTake(null);
    setReplay(null);
    if (kept1.current) {
      kept1.current = false;
      setEnding('kept');
      setStage('timeup');
      return;
    }
    const elapsed = (performance.now() - startedAt.current) / 60000;
    if (minutes && elapsed >= minutes && !warned.current) {
      warned.current = true;
      setEnding('time');
      setStage('timeup');
      return;
    }
    setStage('play');
    setRun((r) => r + 1);
  }, [minutes]);

  const hearModel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVerdict(null);
    setAside(null);
    setTake(null);
    setReplay(null);
    setModelOnce(true);
    setStage('play');
    setRun((r) => r + 1);
  }, []);

  /** Hear what was just played, or stop hearing it. The reply stays up until the learner moves on. */
  const hearMine = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setReplay((now) => (now || !take ? null : { take, key: Date.now() }));
  }, [take]);

  const judge = useCallback(
    (result: FlowResult) => {
      if (!task) return;
      const out = applyResult(info, state, task, result);
      setState(out.state);
      setPiece(pieceId, out.state);
      if (state.learned) reviewCard(`piece:${pieceId}`, outcomeFromAccuracy(result.accuracy, result.clean));
      // A first play through that was stopped early is not a score to be shown.
      const stats = task.scope.type === 'trial' && result.cutShort ? '' : statsLine(result);
      setVerdict({ v: out.verdict, stats });
      if (out.verdict.learned) {
        addCards([`piece:${pieceId}`]);
        reviewCard(`piece:${pieceId}`, 'good');
        if (result.take) keepRecording(pieceId, result.take);
        instrument.chime();
        setStage('learned');
        return;
      }
      // Each later play through of a learned piece replaces the last, so then and now can be compared.
      if (state.learned && out.verdict.passed && result.take) keepRecording(pieceId, result.take);
      if (state.learned && out.verdict.passed && task.need === 1) kept1.current = true;
      if (out.verdict.passed && !out.verdict.plain) instrument.chime();
      setStage('verdict');
      timer.current = setTimeout(proceed, readTime(out.verdict.message, out.verdict.passed));
    },
    [addCards, info, keepRecording, pieceId, proceed, reviewCard, setPiece, state, task],
  );

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (modelOnce) {
        setModelOnce(false);
        setRun((r) => r + 1);
        return;
      }
      // A timed run in which no key was touched is not an attempt. Nothing is
      // counted, and it waits at the gate until the learner is back.
      const untouched = result !== null && result.mode === 'tempo' && result.correctNotes === 0 && result.wrongNotes === 0;
      if (untouched) {
        setAside('Nothing was played, so nothing was counted. It will wait for you.');
        setRun((r) => r + 1);
        return;
      }
      // A few stray notes are not worth hearing back.
      setTake(result?.take && result.take.notes.length >= 3 && !result.cutShort ? result.take : null);
      if (free) {
        if (result) {
          notesPlayed.current += result.totalNotes;
          setVerdict({ v: { passed: result.accuracy >= 0.87, message: 'Your own practice. Nothing is recorded.', learned: false }, stats: statsLine(result) });
        } else {
          // Heard once. It does not go round again by itself.
          setVerdict({ v: { passed: true, message: 'That is how it goes.', learned: false }, stats: 'Continue to hear it again, or choose what to play in Options.' });
        }
        setStage('verdict');
        return;
      }
      if (!task) return;
      if (!result) {
        const out = applyResult(info, state, task, null);
        setState(out.state);
        setPiece(pieceId, out.state);
        setRun((r) => r + 1);
        return;
      }
      notesPlayed.current += result.totalNotes;
      setAside(null);
      if (task.mode === 'tempo') {
        // A moment to judge it yourself before the verdict appears.
        setStage('reflect');
        timer.current = setTimeout(() => judge(result), 1500);
      } else {
        judge(result);
      }
    },
    [free, info, judge, modelOnce, pieceId, setPiece, state, task],
  );

  /** The learner says the piece is new, so it is taught from its beginning. */
  const teachFromStart = useCallback(() => {
    const next = skipTrial(state);
    setState(next);
    setPiece(pieceId, next);
    setAside(null);
    setRun((r) => r + 1);
  }, [pieceId, setPiece, state]);

  /** The recording kept when the piece was learned, played from the screen that says so. */
  const hearEncore = useCallback(() => {
    const player = (encorePlayer.current ??= new TakePlayer());
    if (encore) {
      player.stop();
      setEncore(false);
      return;
    }
    const recording = kept?.latest ?? kept?.first;
    if (!recording) return;
    setEncore(true);
    player.play(recording.take, { onDone: () => setEncore(false) });
  }, [encore, kept]);

  useRemote({
    // At time up the main choice is to stop, so the top key does that.
    primary: stage === 'verdict' ? proceed : stage === 'timeup' || stage === 'learned' ? onClose : undefined,
    secondary: stage === 'timeup' ? proceed : stage === 'learned' ? undefined : hearModel,
  });

  const progress = pieceProgress(info, state);
  const plan = useMemo(() => planOutline(info, state), [info, state]);
  const title = free ? 'Your own practice' : modelOnce ? 'Listen' : (task?.title ?? '');
  const prompt = free
    ? 'You choose what to play. The coach waits until you switch back.'
    : modelOnce
      ? 'Hear how it goes, then it is your turn again.'
      : (task?.prompt ?? '');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="truncate font-mc-serif text-xl">{piece.title}</span>
            {piece.composer && <span className="truncate text-sm text-mc-muted">{piece.composer}</span>}
          </div>
          <ProgressBar value={progress} tone="ok" className="mt-1 max-w-xs" />
        </div>
        <Button variant="soft" size="sm" onClick={hearModel} icon={<Icon.Ear size={16} />} hint={inputMode === 'midi' ? 'bottom key' : undefined}>
          Hear it
        </Button>
        <Button variant={free ? 'primary' : 'soft'} size="sm" onClick={() => setOptions(true)}>
          {free ? 'Own practice' : 'Plan and options'}
        </Button>
      </header>

      {stage === 'learned' ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
            <Icon.Check size={44} />
          </div>
          <div className="mc-fade-up">
            <div className="text-sm font-semibold uppercase tracking-widest text-mc-muted">Piece learned</div>
            <h2 className="mt-2 font-mc-serif text-4xl">{piece.title}</h2>
          </div>
          <p className="mc-fade-up max-w-xl text-[1.1rem] leading-relaxed text-mc-muted">{verdict?.v.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {kept && (
              <Button variant="soft" size="lg" onClick={hearEncore} icon={<Icon.Ear size={20} />}>
                {encore ? 'Stop' : 'Hear how you played it'}
              </Button>
            )}
            <Button size="lg" onClick={onClose} className="min-w-[220px]" hint={inputMode === 'midi' ? 'top key' : undefined}>
              Done
            </Button>
          </div>
          {kept && <p className="mc-fade-up max-w-md text-sm text-mc-faint">That last play through is kept on the Progress page, so you can hear it again later.</p>}
        </div>
      ) : stage === 'timeup' ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <h2 className="mc-fade-up font-mc-serif text-4xl">{ending === 'kept' ? 'Still yours' : 'A good place to stop'}</h2>
          <p className="mc-fade-up max-w-xl text-[1.1rem] leading-relaxed text-mc-muted">
            {ending === 'kept'
              ? 'This piece is safe in your fingers. It will come back after a longer gap, so that it stays there.'
              : 'That is the time set aside for this piece today. What you practised keeps settling after you stop, and a night of sleep helps it along. It will be easier tomorrow.'}
          </p>
          <div className="flex gap-3">
            <Button variant="soft" size="lg" onClick={proceed} hint={inputMode === 'midi' ? 'bottom key' : undefined}>
              {ending === 'kept' ? 'Play it again' : 'Keep going'}
            </Button>
            <Button size="lg" onClick={onClose} hint={inputMode === 'midi' ? 'top key' : undefined}>
              Finish
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-[4.25rem] shrink-0 items-center gap-4 px-7 pb-2">
            <div className="min-w-0 flex-1">
              {stage === 'reflect' ? (
                <div className="mc-fade-up text-[1.15rem] text-mc-muted">How did that go? Decide for yourself before you look.</div>
              ) : stage === 'verdict' && verdict ? (
                <div className="mc-fade-up">
                  <div className={`text-[1.15rem] font-medium leading-snug ${verdict.v.plain ? 'text-mc-ink' : verdict.v.passed ? 'text-mc-ok' : 'text-mc-hint-ink'}`}>
                    {verdict.v.message}
                  </div>
                  {verdict.stats && <div className="text-sm text-mc-muted">{verdict.stats}</div>}
                </div>
              ) : (
                <>
                  <div className="text-[1.15rem] font-semibold text-mc-ink">{title}</div>
                  <div className="text-[1rem] leading-snug text-mc-muted">{aside ?? prompt}</div>
                </>
              )}
            </div>
            {!free && task && task.need > 1 && stage === 'play' && !modelOnce && (
              <div className="flex items-center gap-1.5" aria-label={`${task.have} of ${task.need} good passes`}>
                {Array.from({ length: task.need }, (_, i) => (
                  <span key={i} className={`h-3 w-3 rounded-full ${i < task.have ? 'bg-mc-ok' : 'bg-mc-line'}`} />
                ))}
              </div>
            )}
            {trial && stage === 'play' && !modelOnce && (
              <Button variant="ghost" size="sm" onClick={teachFromStart}>
                It is new to me
              </Button>
            )}
            {stage === 'verdict' && take && (
              <Button variant="soft" size="sm" onClick={hearMine} icon={<Icon.Ear size={16} />}>
                {replay ? 'Stop' : 'Hear yours'}
              </Button>
            )}
            {stage === 'verdict' && (
              <Button size="sm" onClick={proceed} hint={inputMode === 'midi' ? 'top key' : undefined}>
                Continue
              </Button>
            )}
            {shown && shown.to - shown.from + 1 < info.measures && stage === 'play' && (
              <Pill>{shown.from === shown.to ? `Measure ${shown.from + 1}` : `Measures ${shown.from + 1} to ${shown.to + 1}`}</Pill>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {shown && (
              <PlaySurface
                score={score}
                hands={shown.hands}
                mode={shown.mode}
                tempoPct={shown.tempoPct}
                display={display}
                hints="delay"
                runId={`${run}-${free ? 'free' : 'coach'}`}
                onDone={onDone}
                held={options}
                veil={stage === 'reflect'}
                stopAfter={shown.stopAfter}
                // The coach's own demonstration leaves a moment to read what to listen for.
                leadIn={shown.mode === 'listen' && !modelOnce && !free ? 1300 : 350}
                replay={stage === 'verdict' ? replay : null}
                onReplayDone={() => setReplay(null)}
              />
            )}
          </div>
        </>
      )}

      <Sheet open={options} onClose={() => setOptions(false)} title="Plan and options" wide>
        <div className="text-xs font-semibold uppercase tracking-widest text-mc-faint">The plan for this piece</div>
        <div className="mt-3 space-y-2.5">
          {plan.map((row) => (
            <div key={row.title} className="flex items-center gap-4">
              <div className="w-44 shrink-0">
                <div className="font-medium leading-tight">{row.title}</div>
                {row.detail && <div className="text-xs text-mc-muted">{row.detail}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.steps.map((step) => (
                  <span
                    key={step.label}
                    className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${
                      step.state === 'done' ? 'bg-mc-ok/15 text-mc-ok' : step.state === 'now' ? 'bg-mc-ink text-mc-bg' : 'bg-mc-raised text-mc-muted'
                    }`}
                  >
                    {step.state === 'done' && <Icon.Check size={13} />}
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-mc-muted">
          The coach moves you along this as each step holds. A clean pass moves on at once, and anything you already know is skipped.
        </p>

        <div className="mt-6 border-t border-mc-line pt-5">
          <p className="mb-5 text-mc-muted">If you would rather work on something specific, set it here. Your own practice is not recorded.</p>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Who decides</span>
              <Segmented
                value={free ? 'me' : 'coach'}
                onChange={(v) => {
                  setFree(v === 'me' ? { section: -1, hands: 'both', mode: 'wait', tempoPct: 70 } : null);
                  setVerdict(null);
                  setTake(null);
                  setReplay(null);
                  setStage('play');
                  setRun((r) => r + 1);
                }}
                options={[
                  { value: 'coach', label: 'The coach' },
                  { value: 'me', label: 'I do' },
                ]}
              />
            </div>
            {free && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Part</span>
                  <Segmented
                    value={free.section}
                    onChange={(v) => setFree({ ...free, section: v })}
                    options={[{ value: -1, label: 'All' }, ...info.sections.map((_, i) => ({ value: i, label: `${i + 1}` }))]}
                  />
                </div>
                {info.hands.length === 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Hands</span>
                    <Segmented
                      value={free.hands}
                      onChange={(v) => setFree({ ...free, hands: v })}
                      options={[
                        { value: 'both', label: 'Both' },
                        { value: 'R', label: 'Right' },
                        { value: 'L', label: 'Left' },
                      ]}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">How</span>
                  <Segmented
                    value={free.mode}
                    onChange={(v) => setFree({ ...free, mode: v })}
                    options={[
                      { value: 'listen', label: 'Listen' },
                      { value: 'wait', label: 'No beat' },
                      { value: 'tempo', label: 'With beat' },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Speed, {free.tempoPct} percent</span>
                  <input
                    type="range"
                    className="mc-range w-64"
                    min={40}
                    max={110}
                    step={5}
                    value={free.tempoPct}
                    onChange={(e) => setFree({ ...free, tempoPct: Number(e.target.value) })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setOptions(false);
                    setVerdict(null);
                    setTake(null);
                    setReplay(null);
                    setStage('play');
                    setRun((r) => r + 1);
                  }}
                >
                  Play this
                </Button>
              </>
            )}
          </div>
        </div>
        {piece.note && <p className="mt-6 rounded-2xl bg-mc-raised px-4 py-3 text-[15px] leading-relaxed text-mc-muted">{piece.note}</p>}
      </Sheet>
    </div>
  );
}
