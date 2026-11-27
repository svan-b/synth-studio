'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { instrument } from '@/lib/guitar/audio/instrument';
import { changeScore, getSong, simpleStrum, songChords, songInfo, songScore } from '@/lib/guitar/content/catalog';
import { notAttempted, type FollowResult } from '@/lib/guitar/engine/follow';
import {
  applyResult,
  fitState,
  isKept,
  jumpTo,
  newSongState,
  nextTask,
  planOutline,
  skipTask,
  skipTrial,
  songProgress,
  tempoSummary,
  waitSummary,
  type SongState,
  type Task,
  type Verdict, type PlanPlace } from '@/lib/guitar/learn/coach';
import { outcomeFromAccuracy } from '@/lib/guitar/learn/srs';
import { useGuitar } from '@/lib/guitar/learn/store';
import { deleteTake, exportTake, loadTake, playTake, saveTake } from '@/lib/guitar/learn/takes';
import { sliceScore } from '@/lib/guitar/music/score';
import { dayKey } from '@/lib/guitar/util/emitter';
import { readingMs, useListening, usePracticeTimer, useWakeLock } from './hooks';
import { songMelody } from './LessonPlayer';
import PlaySurface from './PlaySurface';
import { ActionBar, StageMessage, useFocus } from './Stage';
import { Button, Icon, IconButton, ProgressBar, Segmented, Sheet } from './ui';

interface Free {
  section: number;
  mode: 'listen' | 'wait' | 'tempo';
  tempoPct: number;
  simple: boolean;
}

type Stage = 'play' | 'reflect' | 'verdict' | 'learned' | 'timeup';

function statsLine(result: FollowResult): string {
  return result.mode === 'wait' ? waitSummary(result) : tempoSummary(result);
}

function readTime(message: string, passed: boolean): number {
  const reading = 1400 + message.length * 45;
  return passed ? Math.min(7500, Math.max(2800, reading)) : Math.min(9000, Math.max(5500, reading));
}

export default function SongRoom({ songId, minutes, onClose }: { songId: string; minutes?: number; onClose: () => void }) {
  const song = useMemo(() => getSong(songId), [songId]);
  const info = useMemo(() => songInfo(songId), [songId]);
  const stored = useGuitar((s) => s.songs[songId]);
  const kept = useGuitar((s) => s.recordings[songId]);
  const setSong = useGuitar((s) => s.setSong);
  const keepRecording = useGuitar((s) => s.keepRecording);
  const reviewCard = useGuitar((s) => s.reviewCard);
  const addCards = useGuitar((s) => s.addCards);
  const logPractice = useGuitar((s) => s.logPractice);
  // The likely slips in a song are its other chords.
  const songChordList = useMemo(() => songChords(songId), [songId]);

  const [state, setState] = useState<SongState>(() => (stored ? fitState(info, stored) : newSongState(info)));
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState<Stage>('play');
  const stageRef = useRef<Stage>('play');
  stageRef.current = stage;
  const [verdict, setVerdict] = useState<{ v: Verdict; stats: string; auto?: number } | null>(null);
  // The way to start a timed run while it waits to be started, for the bar.
  const [gate, setGate] = useState<(() => void) | null>(null);
  const onGate = useCallback((start: (() => void) | null) => setGate(() => start), []);
  const [free, setFree] = useState<Free | null>(null);
  const [options, setOptions] = useState(false);
  // A step of the plan behind the place reached, tapped in the plan: going back to it is asked about first.
  const [goBack, setGoBack] = useState<{ place: PlanPlace; name: string } | null>(null);
  const [modelOnce, setModelOnce] = useState(false);
  const [words, setWords] = useState(Boolean(song.lyrics));
  const [aside, setAside] = useState<string | null>(null);
  const [take, setTake] = useState<Blob | null>(null);
  const [playing2, setPlaying] = useState<'mine' | 'kept' | null>(null);
  const stopPlay = useRef<(() => void) | null>(null);
  const kept1 = useRef(false);
  const [ending, setEnding] = useState<'time' | 'kept'>('time');
  const pending = useRef<FollowResult | null>(null);
  const judgeNow = useRef<(result: FollowResult) => boolean>(() => false);
  const startedAt = useRef(performance.now());
  const played = useRef(0);
  const reported = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);
  const latestTake = useRef<Blob | null>(null);
  // The run each recording belongs to, so a take from an earlier run is never heard or kept for a later one.
  const takeRun = useRef(-1);
  const runRef = useRef(0);

  const away = useFocus();
  useWakeLock(true);
  // The microphone is held while the song is open. It still steps aside for every example.
  useListening(true);
  usePracticeTimer((seconds, first) => {
    // Strums and notes heard since the last report.
    const heard = played.current - reported.current;
    reported.current = played.current;
    logPractice(seconds, heard, first ? 1 : 0);
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      stopPlay.current?.();
      // A run that ended a moment before the song was closed still counts: it is judged and saved on the way out.
      if (pending.current) {
        const result = pending.current;
        pending.current = null;
        judgeNow.current(result);
      }
    },
    [],
  );

  runRef.current = run;

  const task: Task | null = useMemo(() => nextTask(info, state), [info, state]);
  const trial = !free && task?.scope.type === 'trial';

  const view = useMemo(() => {
    if (free) {
      const [from, to] = free.section < 0 ? [0, info.measures - 1] : info.sections[free.section];
      return { from, to, mode: free.mode, tempoPct: free.tempoPct, simple: free.simple, change: null as Task['change'] | null, stopAfter: null };
    }
    if (!task) return null;
    return {
      from: task.from,
      to: task.to,
      mode: modelOnce ? ('listen' as const) : task.mode,
      tempoPct: task.mode === 'wait' ? 90 : task.tempoPct,
      simple: task.simple,
      change: task.change ?? null,
      stopAfter: modelOnce ? null : (task.stopAfter ?? null),
    };
  }, [free, info, modelOnce, task]);

  // The stand changes only when a run begins, so a verdict still shows the music just played.
  const [stand, setStand] = useState({ run, view });
  if (stand.run !== run) setStand({ run, view });
  const shown = stand.run === run ? stand.view : view;

  const score = useMemo(() => {
    if (shown?.change) return changeScore(shown.change.from, shown.change.to, 4, 60);
    const base = songScore(songId, { simple: shown?.simple });
    return shown ? sliceScore(base, shown.from, shown.to) : base;
  }, [shown, songId]);
  const melody = useMemo(() => (shown?.mode === 'listen' && !shown.change ? songMelody(songId, score) : null), [score, shown, songId]);
  const display = shown?.change ? 'chord' : song.kind === 'strum' ? 'chart' : 'tab';

  const stopPlayback = () => {
    stopPlay.current?.();
    stopPlay.current = null;
    setPlaying(null);
  };

  const proceed = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    stopPlayback();
    setVerdict(null);
    setAside(null);
    setTake(null);
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
    if (pending.current) {
      const result = pending.current;
      pending.current = null;
      judgeNow.current(result);
      return;
    }
    stopPlayback();
    setVerdict(null);
    setAside(null);
    setTake(null);
    setModelOnce(true);
    setStage('play');
    setRun((r) => r + 1);
  }, []);

  const hearMine = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (playing2) {
      stopPlayback();
      return;
    }
    if (!take) return;
    setPlaying('mine');
    stopPlay.current = playTake(take, () => setPlaying(null));
  }, [playing2, take]);

  /** Keep a recording of the learner: the first time through a learned song, and the latest since. */
  const keep = useCallback(
    async (blob: Blob, seconds: number) => {
      const day = dayKey();
      const key = `${songId}:${Date.now()}`;
      const first = !useGuitar.getState().recordings[songId];
      // In the Files app: the first time through under its date, and the latest, which replaces the one before.
      // This copy is made whether or not the one inside the app can be, so a full store does not lose the recording.
      void exportTake(song.title, first ? `first time, ${day}` : 'latest', blob, false);
      if (!(await saveTake(key, blob))) return;
      // The latest recording replaces the one before it. The first is kept for good.
      for (const old of keepRecording(songId, { on: day, key, seconds: Math.round(seconds) })) void deleteTake(old.key);
    },
    [keepRecording, song.title, songId],
  );

  const judge = useCallback(
    (result: FollowResult): boolean => {
      if (!task) return false;
      const out = applyResult(info, state, task, result);
      setState(out.state);
      setSong(songId, out.state);
      // How well a learned song is remembered is told by playing the whole of it, not by a short drill on one change.
      if (state.learned && task.scope.type === 'whole') reviewCard(`song:${songId}`, out.verdict.passed ? outcomeFromAccuracy(result.accuracy, result.clean) : 'again');
      const stats = task.scope.type === 'trial' && result.cutShort ? '' : statsLine(result);
      setVerdict({ v: out.verdict, stats, auto: readTime(`${out.verdict.message} ${out.verdict.aside ?? ''} ${stats}`, out.verdict.passed) / 1000 });
      const blob = takeRun.current === runRef.current ? latestTake.current : null;
      if (out.verdict.learned) {
        addCards([`song:${songId}`]);
        reviewCard(`song:${songId}`, 'good');
        if (blob) void keep(blob, result.seconds);
        instrument.chime();
        setStage('learned');
        return true;
      }
      if (state.learned && out.verdict.passed && blob) void keep(blob, result.seconds);
      if (state.learned && out.verdict.passed && isKept(out.state)) kept1.current = true;
      if (out.verdict.passed && !out.verdict.plain) instrument.chime();
      setStage('verdict');
      return false;
    },
    [addCards, info, keep, reviewCard, setSong, songId, state, task],
  );
  judgeNow.current = judge;

  const openOptions = useCallback(() => {
    if (pending.current) {
      const result = pending.current;
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
      if (judgeNow.current(result)) return;
    }
    if (timer.current) clearTimeout(timer.current);
    stopPlayback();
    setOptions(true);
  }, []);

  const onDone = useCallback(
    (result: FollowResult | null) => {
      if (stageRef.current !== 'play') return;
      if (modelOnce) {
        setModelOnce(false);
        setRun((r) => r + 1);
        return;
      }
      const idle = result ? notAttempted(result) : null;
      if (idle) {
        setAside(idle === 'nothing' ? 'Nothing was heard, so nothing was counted. It will wait for you.' : 'Only a strum or two was heard, so nothing was counted. It will wait for you.');
        setRun((r) => r + 1);
        return;
      }
      // This run's recording arrives a moment after the run ends, through onTake.
      setTake(result?.mode === 'tempo' && takeRun.current === runRef.current ? latestTake.current : null);
      if (free) {
        if (result) {
          played.current += result.totalSteps;
          setVerdict({ v: { passed: result.accuracy >= 0.85, message: 'Your own practice. Nothing is recorded.', learned: false }, stats: statsLine(result) });
        } else {
          setVerdict({ v: { passed: true, message: 'That is how it goes.', learned: false }, stats: 'Continue to hear it again, or choose what to play in Plan and options.' });
        }
        setStage('verdict');
        return;
      }
      if (!task) return;
      if (!result) {
        const out = applyResult(info, state, task, null);
        setState(out.state);
        setSong(songId, out.state);
        setRun((r) => r + 1);
        return;
      }
      played.current += result.totalSteps;
      setAside(null);
      if (task.mode === 'tempo') {
        // A moment to judge it yourself before the verdict appears.
        setStage('reflect');
        pending.current = result;
        timer.current = setTimeout(() => {
          pending.current = null;
          judge(result);
        }, 1600);
      } else {
        judge(result);
      }
    },
    [free, info, judge, modelOnce, setSong, songId, state, task],
  );

  const onTake = useCallback((blob: Blob) => {
    latestTake.current = blob;
    takeRun.current = runRef.current;
    if (stageRef.current === 'verdict' || stageRef.current === 'reflect') setTake(blob);
  }, []);

  const goOn = useCallback(
    (next: SongState | null) => {
      if (!next) return;
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
      stopPlayback();
      setState(next);
      setSong(songId, next);
      setFree(null);
      setVerdict(null);
      setAside(null);
      setTake(null);
      setModelOnce(false);
      setOptions(false);
      setStage('play');
      setRun((r) => r + 1);
    },
    [setSong, songId],
  );
  const skippable = useMemo(() => !free && skipTask(info, state) !== null, [free, info, state]);

  const teachFromStart = useCallback(() => {
    const next = skipTrial(state);
    setState(next);
    setSong(songId, next);
    setAside(null);
    setRun((r) => r + 1);
  }, [setSong, songId, state]);

  const hearKept = useCallback(async () => {
    if (playing2) {
      stopPlayback();
      return;
    }
    const rec = kept?.latest ?? kept?.first;
    if (!rec) return;
    const blob = await loadTake(rec.key);
    if (!blob) return;
    setPlaying('kept');
    stopPlay.current = playTake(blob, () => setPlaying(null));
  }, [kept, playing2]);

  const shareKept = useCallback(async () => {
    const rec = kept?.latest ?? kept?.first;
    if (!rec) return;
    const blob = await loadTake(rec.key);
    if (blob) void exportTake(song.title, `${kept?.latest ? 'latest' : 'first time'}, ${rec.on}`, blob, true);
  }, [kept, song.title]);

  const progress = songProgress(info, state);
  const plan = useMemo(() => planOutline(info, state), [info, state]);
  const title = free ? 'Your own practice' : modelOnce ? 'Listen' : (task?.title ?? '');
  const prompt = free ? 'You choose what to play. The coach waits until you switch back.' : modelOnce ? 'Hear how it goes, then it is your turn again.' : (task?.prompt ?? '');
  const pattern = shown?.simple ? simpleStrum(song.time) : song.strum;

  const playing = stage === 'play' || stage === 'reflect' || stage === 'verdict';
  const wordsToggle = song.lyrics && song.kind === 'strum' && !shown?.change ? { label: words ? 'Chords' : 'Words', onClick: () => setWords((w) => !w) } : null;
  const verdictTone = verdict && !verdict.v.plain ? (verdict.v.passed ? ('ok' as const) : ('hint' as const)) : undefined;
  const pips =
    !free && task && task.need > 1 && stage === 'play' && !modelOnce ? (
      <div className="flex items-center gap-2" aria-label={`${task.have} of ${task.need} good runs`}>
        {Array.from({ length: task.need }, (_, i) => (
          <span key={i} className={`h-5 w-5 rounded-full ${i < task.have ? 'bg-os-ok' : 'bg-os-line'}`} />
        ))}
      </div>
    ) : null;
  const where = shown && !shown.change && shown.to - shown.from + 1 < info.measures && stage === 'play' ? (shown.from === shown.to ? `Measure ${shown.from + 1}` : `Measures ${shown.from + 1} to ${shown.to + 1}`) : null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        <IconButton label="Close" onClick={onClose} className="h-14 w-14">
          <Icon.Close size={26} />
        </IconButton>
        <div className={`min-w-0 flex-1 transition-opacity duration-300 ${away ? 'opacity-0' : ''}`}>
          <div className="truncate font-os-serif text-[1.5rem] leading-tight">{song.title}</div>
          <ProgressBar value={progress} tone="ok" className="mt-1 max-w-sm" />
        </div>
      </header>

      {stage === 'learned' ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <div className="os-pop flex h-24 w-24 items-center justify-center rounded-full bg-os-ok text-white">
              <Icon.Check size={54} />
            </div>
            <div className="os-fade-up">
              <div className="text-[1.15rem] font-semibold uppercase tracking-widest text-os-muted">Song learned</div>
              <h2 className="mt-2 font-os-serif text-[3.4rem] leading-tight">{song.title}</h2>
            </div>
            <p className="os-say os-fade-up max-w-2xl">{verdict?.v.message} Now play it for someone. A song played for a person, even once, is the best practice there is.</p>
            {kept && <p className="os-fade-up max-w-xl text-[1.15rem] text-os-muted">Your recording is kept on the Progress page, so you can hear it again later.</p>}
          </div>
          <ActionBar
            extras={kept ? [{ label: playing2 === 'kept' ? 'Stop' : 'Hear yours', onClick: () => void hearKept(), icon: <Icon.Ear size={20} /> }, { label: 'Share it', onClick: () => void shareKept(), icon: <Icon.Share size={20} /> }] : []}
            primary={{ label: 'Done', onClick: onClose, auto: 15 }}
          />
        </>
      ) : stage === 'timeup' ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <h2 className="os-fade-up font-os-serif text-[3.4rem] leading-tight">{ending === 'kept' ? 'Still yours' : 'A good place to stop'}</h2>
            <p className="os-say os-fade-up max-w-2xl">
              {ending === 'kept'
                ? 'This song is safe in your fingers. It will come back now and then, so it stays there.'
                : 'That is the time set aside for this song today. What you practised keeps settling after you stop, and a night of sleep helps it along. It will be easier tomorrow.'}
            </p>
          </div>
          <ActionBar again={{ label: ending === 'kept' ? 'Play it again' : 'Keep going', onClick: proceed }} primary={{ label: 'Finish', onClick: onClose, auto: 10 }} />
        </>
      ) : (
        <>
          {stage === 'reflect' ? (
            <StageMessage text="How did that go? Decide for yourself before you look." />
          ) : stage === 'verdict' && verdict ? (
            <StageMessage text={verdict.v.message} sub={[verdict.v.aside, verdict.stats].filter(Boolean).join(' ') || null} tone={verdictTone} />
          ) : (
            <StageMessage
              text={title}
              sub={aside ?? prompt}
              right={
                pips || where ? (
                  <>
                    {where && <span className="whitespace-nowrap rounded-full bg-os-raised px-4 py-2 text-[1.1rem] font-semibold text-os-muted">{where}</span>}
                    {pips}
                  </>
                ) : undefined
              }
            />
          )}
          <div className="min-h-0 flex-1">
            {shown && (
              <PlaySurface
                score={score}
                melody={melody}
                mode={shown.mode}
                tempoPct={shown.tempoPct}
                display={display}
                hints="delay"
                hintMs={6500}
                confusers={songChordList}
                stopAfter={shown.stopAfter}
                runId={`${run}-${free ? 'free' : 'coach'}`}
                onDone={onDone}
                onGate={onGate}
                held={options}
                veil={stage === 'reflect'}
                lyrics={song.lyrics}
                words={words && !shown.change}
                pattern={pattern}
                record={shown.mode === 'tempo'}
                onTake={onTake}
                leadIn={shown.mode === 'listen' && !modelOnce && !free ? readingMs(prompt) : 350}
              />
            )}
          </div>
          {/* Everything to touch is here, in the same places every time. The next thing happens by itself where it can. */}
          {playing && (
            <ActionBar
              extras={[
                { label: 'Hear it', onClick: hearModel, icon: <Icon.Ear size={20} /> },
                stage === 'verdict' && take ? { label: playing2 === 'mine' ? 'Stop' : 'Hear yours', onClick: hearMine, icon: <Icon.Record size={20} /> } : null,
                wordsToggle,
                { label: free ? 'Own practice' : 'Plan', onClick: openOptions, icon: <Icon.Steps size={20} /> },
              ]}
              skip={
                stage !== 'play' || modelOnce
                  ? null
                  : trial
                    ? { label: 'It is new to me', onClick: teachFromStart }
                    : skippable
                      ? { label: 'Next step', onClick: () => goOn(skipTask(info, state)) }
                      : null
              }
              primary={
                stage === 'verdict'
                  ? { label: 'Continue', onClick: proceed, auto: free ? undefined : verdict?.auto }
                  : stage === 'play' && gate
                    ? { label: 'Start', onClick: gate, icon: <Icon.Play size={22} />, hint: 'or strum once' }
                    : null
              }
            />
          )}
        </>
      )}

      <Sheet open={options} onClose={() => setOptions(false)} title="Plan and options" wide>
        {!free && (
          <>
            <div className="text-xs font-semibold uppercase tracking-widest text-os-faint">The plan for this song</div>
            <div className="mt-3 space-y-2.5">
              {plan.map((row) => (
                <div key={row.title} className="flex items-center gap-4">
                  <div className="w-44 shrink-0">
                    <div className="text-[1.1rem] font-medium leading-tight">{row.title}</div>
                    {row.detail && <div className="text-sm text-os-muted">{row.detail}</div>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.steps.map((st) => (
                      <button
                        key={st.label}
                        disabled={!st.place || state.learned}
                        onClick={() => {
                          if (!st.place) return;
                          // Forward is taken at once. Back gives up steps already held, so it is asked about first.
                          if (st.state === 'done') setGoBack({ place: st.place, name: `${row.title}, ${st.label}` });
                          else {
                            setGoBack(null);
                            goOn(jumpTo(info, state, st.place));
                          }
                        }}
                        className={`inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-[1.05rem] font-semibold ${
                          st.state === 'done' ? 'bg-os-ok/15 text-os-ok-ink' : st.state === 'now' ? 'bg-os-ink text-os-bg' : 'bg-os-raised text-os-muted'
                        }`}
                      >
                        {st.state === 'done' && <Icon.Check size={16} />}
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {goBack ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-os-raised px-5 py-4">
                <p className="min-w-0 flex-1 text-[1.15rem] leading-snug">Go back to {goBack.name}? The steps after it will be played again.</p>
                <Button variant="soft" onClick={() => setGoBack(null)}>
                  Stay here
                </Button>
                <Button
                  onClick={() => {
                    const place = goBack.place;
                    setGoBack(null);
                    goOn(jumpTo(info, state, place));
                  }}
                >
                  Go back
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-[1.1rem] leading-relaxed text-os-muted">The coach moves you along this as each step holds. A clean run moves on at once. Tap any step to go straight to it: what comes before it is taken as known.</p>
            )}
          </>
        )}
        <div className={free ? '' : 'mt-6 border-t border-os-line pt-5'}>
          <p className="mb-5 text-os-muted">To work on something of your own choosing, set it here. Your own practice is not recorded.</p>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Who decides</span>
              <Segmented
                value={free ? 'me' : 'coach'}
                onChange={(v) => {
                  setFree(v === 'me' ? { section: -1, mode: 'wait', tempoPct: 70, simple: song.kind === 'strum' } : null);
                  setVerdict(null);
                  setTake(null);
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
                  <Segmented value={free.section} onChange={(v) => setFree({ ...free, section: v })} options={[{ value: -1, label: 'All' }, ...info.sections.map((_, i) => ({ value: i, label: `${i + 1}` }))]} />
                </div>
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
                {song.kind === 'strum' && free.mode !== 'wait' && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Strum</span>
                    <Segmented
                      value={free.simple ? 'simple' : 'song'}
                      onChange={(v) => setFree({ ...free, simple: v === 'simple' })}
                      options={[
                        { value: 'simple', label: 'Once a beat' },
                        { value: 'song', label: 'The song\'s pattern' },
                      ]}
                    />
                  </div>
                )}
                {free.mode !== 'wait' && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Speed, {free.tempoPct} percent</span>
                    <input type="range" className="os-range w-64" min={40} max={110} step={5} value={free.tempoPct} onChange={(e) => setFree({ ...free, tempoPct: Number(e.target.value) })} />
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => {
                    setOptions(false);
                    setVerdict(null);
                    setTake(null);
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
        {song.note && <p className="mt-6 rounded-2xl bg-os-raised px-4 py-3 text-[1rem] leading-relaxed text-os-muted">{song.note}</p>}
      </Sheet>
    </div>
  );
}
