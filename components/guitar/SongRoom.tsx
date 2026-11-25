'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { instrument } from '@/lib/guitar/audio/instrument';
import { changeScore, getSong, simpleStrum, songInfo, songScore } from '@/lib/guitar/content/catalog';
import { notAttempted, type FollowResult } from '@/lib/guitar/engine/follow';
import {
  applyResult,
  fitState,
  isKept,
  newSongState,
  nextTask,
  planOutline,
  skipTrial,
  songProgress,
  tempoSummary,
  waitSummary,
  type SongState,
  type Task,
  type Verdict,
} from '@/lib/guitar/learn/coach';
import { outcomeFromAccuracy } from '@/lib/guitar/learn/srs';
import { useGuitar } from '@/lib/guitar/learn/store';
import { deleteTake, exportTake, loadTake, playTake, saveTake } from '@/lib/guitar/learn/takes';
import { sliceScore } from '@/lib/guitar/music/score';
import { dayKey } from '@/lib/guitar/util/emitter';
import { readingMs, useKnownChords, usePracticeTimer, useWakeLock } from './hooks';
import { songMelody } from './LessonPlayer';
import PlaySurface from './PlaySurface';
import { Button, Icon, IconButton, Pill, ProgressBar, Segmented, Sheet } from './ui';

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
  const known = useKnownChords();

  const [state, setState] = useState<SongState>(() => (stored ? fitState(info, stored) : newSongState(info)));
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState<Stage>('play');
  const stageRef = useRef<Stage>('play');
  stageRef.current = stage;
  const [verdict, setVerdict] = useState<{ v: Verdict; stats: string } | null>(null);
  const [free, setFree] = useState<Free | null>(null);
  const [options, setOptions] = useState(false);
  const [modelOnce, setModelOnce] = useState(false);
  const [words, setWords] = useState(Boolean(song.lyrics));
  const [aside, setAside] = useState<string | null>(null);
  const [take, setTake] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState<'mine' | 'kept' | null>(null);
  const stopPlay = useRef<(() => void) | null>(null);
  const kept1 = useRef(false);
  const [ending, setEnding] = useState<'time' | 'kept'>('time');
  const pending = useRef<FollowResult | null>(null);
  const judgeNow = useRef<(result: FollowResult) => boolean>(() => false);
  const startedAt = useRef(performance.now());
  const played = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);
  const latestTake = useRef<Blob | null>(null);

  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, played.current, 1));
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      stopPlay.current?.();
    },
    [],
  );

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
    if (playing) {
      stopPlayback();
      return;
    }
    if (!take) return;
    setPlaying('mine');
    stopPlay.current = playTake(take, () => setPlaying(null));
  }, [playing, take]);

  /** Keep a recording of the learner: the first time through a learned song, and the latest since. */
  const keep = useCallback(
    async (blob: Blob, seconds: number) => {
      const day = dayKey();
      const key = `${songId}:${Date.now()}`;
      const first = !useGuitar.getState().recordings[songId];
      if (!(await saveTake(key, blob))) return;
      // The latest recording replaces the one before it. The first is kept for good.
      for (const old of keepRecording(songId, { on: day, key, seconds: Math.round(seconds) })) void deleteTake(old.key);
      // In the Files app too: the first time through under its date, and the latest, which replaces the one before.
      void exportTake(song.title, first ? `first time, ${day}` : 'latest', blob, false);
    },
    [keepRecording, song.title, songId],
  );

  const judge = useCallback(
    (result: FollowResult): boolean => {
      if (!task) return false;
      const out = applyResult(info, state, task, result);
      setState(out.state);
      setSong(songId, out.state);
      if (state.learned) reviewCard(`song:${songId}`, outcomeFromAccuracy(result.accuracy, result.clean));
      const stats = task.scope.type === 'trial' && result.cutShort ? '' : statsLine(result);
      setVerdict({ v: out.verdict, stats });
      const blob = latestTake.current;
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
      timer.current = setTimeout(proceed, readTime(`${out.verdict.message} ${out.verdict.aside ?? ''}`, out.verdict.passed));
      return false;
    },
    [addCards, info, keep, proceed, reviewCard, setSong, songId, state, task],
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
      setTake(result?.mode === 'tempo' ? latestTake.current : null);
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
    if (stageRef.current === 'verdict') setTake(blob);
  }, []);

  const teachFromStart = useCallback(() => {
    const next = skipTrial(state);
    setState(next);
    setSong(songId, next);
    setAside(null);
    setRun((r) => r + 1);
  }, [setSong, songId, state]);

  const hearKept = useCallback(async () => {
    if (playing) {
      stopPlayback();
      return;
    }
    const rec = kept?.latest ?? kept?.first;
    if (!rec) return;
    const blob = await loadTake(rec.key);
    if (!blob) return;
    setPlaying('kept');
    stopPlay.current = playTake(blob, () => setPlaying(null));
  }, [kept, playing]);

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

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="truncate font-os-serif text-[1.4rem]">{song.title}</span>
            <span className="hidden truncate text-sm text-os-muted landscape:inline">{song.origin}</span>
          </div>
          <ProgressBar value={progress} tone="ok" className="mt-1 max-w-xs" />
        </div>
        {stage !== 'learned' && stage !== 'timeup' && (
          <>
            {song.lyrics && song.kind === 'strum' && !shown?.change && (
              <Button variant={words ? 'primary' : 'soft'} size="sm" onClick={() => setWords((w) => !w)}>
                {words ? 'Chords' : 'Words'}
              </Button>
            )}
            <Button variant="soft" size="sm" onClick={hearModel} icon={<Icon.Ear size={16} />}>
              Hear it
            </Button>
            <Button variant={free ? 'primary' : 'soft'} size="sm" onClick={openOptions}>
              {free ? 'Own practice' : 'Plan'}
            </Button>
          </>
        )}
      </header>

      {stage === 'learned' ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="os-pop flex h-20 w-20 items-center justify-center rounded-full bg-os-ok text-white">
            <Icon.Check size={44} />
          </div>
          <div className="os-fade-up">
            <div className="text-sm font-semibold uppercase tracking-widest text-os-muted">Song learned</div>
            <h2 className="mt-2 font-os-serif text-5xl">{song.title}</h2>
          </div>
          <p className="os-fade-up max-w-xl text-[1.25rem] leading-relaxed text-os-muted">
            {verdict?.v.message} Now play it for someone. A song played for a person, even once, is the best practice there is.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {kept && (
              <>
                <Button variant="soft" size="lg" onClick={() => void hearKept()} icon={<Icon.Ear size={20} />}>
                  {playing === 'kept' ? 'Stop' : 'Hear how you played it'}
                </Button>
                <Button variant="soft" size="lg" onClick={() => void shareKept()} icon={<Icon.Share size={20} />}>
                  Share it
                </Button>
              </>
            )}
            <Button size="lg" onClick={onClose} className="min-w-[220px]">
              Done
            </Button>
          </div>
          {kept && <p className="os-fade-up max-w-md text-[15px] text-os-faint">Your recording is kept on the Progress page, so you can hear it again later.</p>}
        </div>
      ) : stage === 'timeup' ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <h2 className="os-fade-up font-os-serif text-5xl">{ending === 'kept' ? 'Still yours' : 'A good place to stop'}</h2>
          <p className="os-fade-up max-w-xl text-[1.25rem] leading-relaxed text-os-muted">
            {ending === 'kept'
              ? 'This song is safe in your fingers. It will come back now and then, so it stays there.'
              : 'That is the time set aside for this song today. What you practised keeps settling after you stop, and a night of sleep helps it along. It will be easier tomorrow.'}
          </p>
          <div className="flex gap-3">
            <Button variant="soft" size="lg" onClick={proceed}>
              {ending === 'kept' ? 'Play it again' : 'Keep going'}
            </Button>
            <Button size="lg" onClick={onClose}>
              Finish
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-[4.75rem] shrink-0 items-center gap-4 px-7 pb-1">
            <div className="min-w-0 flex-1">
              {stage === 'reflect' ? (
                <div className="os-fade-up text-[1.25rem] text-os-muted">How did that go? Decide for yourself before you look.</div>
              ) : stage === 'verdict' && verdict ? (
                <div className="os-fade-up">
                  <div className={`text-[1.25rem] font-medium leading-snug ${verdict.v.plain ? 'text-os-ink' : verdict.v.passed ? 'text-os-ok' : 'text-os-hint-ink'}`}>{verdict.v.message}</div>
                  {verdict.v.aside && <div className="text-[1.05rem] leading-snug text-os-ink">{verdict.v.aside}</div>}
                  {verdict.stats && <div className="text-[15px] text-os-muted">{verdict.stats}</div>}
                </div>
              ) : (
                <>
                  <div className="text-[1.25rem] font-semibold text-os-ink">{title}</div>
                  <div className="text-[1.05rem] leading-snug text-os-muted">{aside ?? prompt}</div>
                </>
              )}
            </div>
            {!free && task && task.need > 1 && stage === 'play' && !modelOnce && (
              <div className="flex items-center gap-1.5" aria-label={`${task.have} of ${task.need} good runs`}>
                {Array.from({ length: task.need }, (_, i) => (
                  <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < task.have ? 'bg-os-ok' : 'bg-os-line'}`} />
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
                {playing === 'mine' ? 'Stop' : 'Hear yours'}
              </Button>
            )}
            {stage === 'verdict' && (
              <Button size="sm" onClick={proceed}>
                Continue
              </Button>
            )}
            {shown && !shown.change && shown.to - shown.from + 1 < info.measures && stage === 'play' && (
              <Pill>{shown.from === shown.to ? `Measure ${shown.from + 1}` : `Measures ${shown.from + 1} to ${shown.to + 1}`}</Pill>
            )}
          </div>
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
                confusers={known}
                stopAfter={shown.stopAfter}
                runId={`${run}-${free ? 'free' : 'coach'}`}
                onDone={onDone}
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
        </>
      )}

      <Sheet open={options} onClose={() => setOptions(false)} title="Plan and options" wide>
        {!free && (
          <>
            <div className="text-xs font-semibold uppercase tracking-widest text-os-faint">The plan for this song</div>
            <div className="mt-3 space-y-2.5">
              {plan.map((row) => (
                <div key={row.title} className="flex items-center gap-4">
                  <div className="w-40 shrink-0">
                    <div className="font-medium leading-tight">{row.title}</div>
                    {row.detail && <div className="text-xs text-os-muted">{row.detail}</div>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.steps.map((st) => (
                      <span
                        key={st.label}
                        className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[14px] font-semibold ${
                          st.state === 'done' ? 'bg-os-ok/15 text-os-ok' : st.state === 'now' ? 'bg-os-ink text-os-bg' : 'bg-os-raised text-os-muted'
                        }`}
                      >
                        {st.state === 'done' && <Icon.Check size={13} />}
                        {st.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[1rem] leading-relaxed text-os-muted">The coach moves you along this as each step holds. A clean run moves on at once, and anything you already know is skipped.</p>
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
