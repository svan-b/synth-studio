'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument, playSong } from '@/lib/guitar/audio/instrument';
import { Follower, type FollowEvent, type FollowResult } from '@/lib/guitar/engine/follow';
import { strikeBus } from '@/lib/guitar/input/bus';
import { listener } from '@/lib/guitar/input/listen';
import { useGuitar } from '@/lib/guitar/learn/store';
import { sayChord, shapeFor } from '@/lib/guitar/music/chords';
import { changeSteps, type Score, type Step } from '@/lib/guitar/music/score';
import { STRING_NAME, noteLetter, pulsesPerMeasure, sayLetter } from '@/lib/guitar/music/theory';
import { ChartView, WordsView } from './ChartView';
import { ChordDiagram } from './ChordDiagram';
import { Neck, PatternView } from './Figures';
import { useDeviceVolume, useListening } from './hooks';
import { TabView, type StepMark } from './TabView';
import { Button, Icon } from './ui';

export type SurfaceMode = 'listen' | 'wait' | 'tempo';
export type Display = 'chord' | 'chart' | 'tab' | 'hidden';

export interface SurfaceProps {
  score: Score;
  mode: SurfaceMode;
  display?: Display;
  /** Percent of the written tempo, with a beat. */
  tempoPct?: number;
  hints?: 'always' | 'delay' | 'never';
  /** Milliseconds before help is shown, when the music waits. */
  hintMs?: number;
  anyStrike?: boolean;
  changesOnly?: boolean;
  /** Chords a strum may be mistaken for, beyond the one before it. */
  confusers?: string[];
  stopAfter?: { hints: number; wrong: number } | null;
  /** Changes whenever a fresh run should begin. */
  runId: string | number;
  onDone: (result: FollowResult | null) => void;
  /** Milliseconds to wait before a demonstration begins, to read what to listen for. */
  leadIn?: number;
  /** Hide the marks while the learner judges a run. */
  veil?: boolean;
  /** Paused: nothing starts. */
  held?: boolean;
  /** Words to sing along to, shown in place of the chart when asked. */
  lyrics?: Array<[number, string]>;
  words?: boolean;
  /** The strum pattern, to show above the chart. */
  pattern?: string;
  /** Record the learner during a run with the beat. */
  record?: boolean;
  onTake?: (blob: Blob, seconds: number) => void;
  /** Something extra in the header row, such as buttons. */
  extra?: ReactNode;
  /** A tune the app plays over the chords when listening. */
  melody?: Score | null;
}

interface Note {
  tone: 'ok' | 'hint' | 'bad';
  text: string;
}

function placeWords(step: Step | undefined): string {
  const n = step?.notes[0];
  if (!n) return '';
  const where = n.place.fret === 0 ? `the open ${STRING_NAME[n.place.string]} string` : `the ${STRING_NAME[n.place.string]} string, fret ${n.place.fret}`;
  return `${sayLetter(noteLetter(n.midi))} is ${where}.`;
}

export default function PlaySurface(props: SurfaceProps) {
  const { score, mode, display = 'chart', tempoPct = 100, hints = 'delay', runId, onDone, held = false } = props;
  const latencyMs = useGuitar((s) => s.settings.latencyMs);
  const metronome = useGuitar((s) => s.settings.metronome);
  const { status, start: startListening } = useListening(mode !== 'listen');
  const deviceVolume = useDeviceVolume();
  const listening = status.state === 'listening';
  const [current, setCurrent] = useState<number | null>(null);
  const [marks, setMarks] = useState<Map<number, StepMark>>(new Map());
  const [hint, setHint] = useState<number | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [phase, setPhase] = useState<'gate' | 'countin' | 'playing' | 'done' | 'listening'>('gate');
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState<{ n: number; accent: boolean } | null>(null);
  const [heard, setHeard] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onTakeRef = useRef(props.onTake);
  onTakeRef.current = props.onTake;
  const followRef = useRef<Follower | null>(null);
  const startedRef = useRef(false);
  const [restart, setRestart] = useState(0);
  const carryNote = useRef<Note | null>(null);

  const bpm = Math.max(30, Math.round((score.tempo * (mode === 'tempo' ? tempoPct : mode === 'listen' ? tempoPct : 100)) / 100));
  // When the music waits on a strummed score, it waits for each new chord: those are the steps shown.
  const changesOnly = props.changesOnly ?? (mode === 'wait' && score.kind === 'strum');
  const steps = useMemo(() => (changesOnly && score.kind === 'strum' ? changeSteps(score) : score.steps), [changesOnly, score]);
  const stepNow = current !== null ? steps[current] : steps[0];
  const nextChord = useMemo(() => {
    if (!stepNow?.strum) return null;
    for (let i = (current ?? 0) + 1; i < steps.length; i++) {
      const c = steps[i].strum?.chord;
      if (c && c !== stepNow.strum.chord) return c;
    }
    return null;
  }, [current, stepNow, steps]);

  // A strike heard anywhere, to show the app is listening.
  useEffect(() => strikeBus.subscribe(() => setHeard((h) => h + 1)), []);

  const reset = useCallback(() => {
    setCurrent(null);
    setMarks(new Map());
    setHint(null);
    setNote(null);
    setCount(null);
    setPulse(null);
  }, []);

  // ------------------------------------------------------------- listening

  useEffect(() => {
    if (mode !== 'listen' || held) return;
    reset();
    setPhase('listening');
    let stop: (() => void) | null = null;
    let cancelled = false;
    const t = setTimeout(() => {
      void guitar.unlock().then(() => {
        // Sound may take a moment to wake. If this run was left meanwhile, it does not play.
        if (cancelled) return;
        stop = playSong(score, props.melody ?? null, { bpm, onStep: (i) => setCurrent(i), onDone: () => onDoneRef.current(null) });
      });
    }, props.leadIn ?? 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, mode, held]);

  // --------------------------------------------------------------- playing

  const begin = useCallback(() => {
    const f = followRef.current;
    if (!f || startedRef.current) return;
    startedRef.current = true;
    void guitar.unlock();
    f.start();
  }, []);

  useEffect(() => {
    if (mode === 'listen' || held || !listening) return;
    reset();
    if (carryNote.current) {
      setNote(carryNote.current);
      carryNote.current = null;
    }
    startedRef.current = false;
    const f = new Follower(score, {
      mode,
      bpm,
      hintDelayMs: hints === 'always' ? 0 : hints === 'never' ? Infinity : (props.hintMs ?? 4500),
      metronome: metronome || mode === 'tempo',
      changesOnly,
      anyStrike: props.anyStrike,
      confusers: props.confusers,
      stopAfter: props.stopAfter ?? null,
      inputDelay: 0.06 + latencyMs / 1000,
    });
    followRef.current = f;
    let recording = false;
    let recStart = 0;
    let cleanupGate: (() => void) | null = null;
    const off = f.events.subscribe((ev: FollowEvent) => {
      switch (ev.type) {
        case 'phase':
          if (ev.phase === 'countin') setPhase('countin');
          if (ev.phase === 'playing') {
            setPhase('playing');
            setCount(null);
            if (mode === 'tempo' && props.record && listener.canRecord) {
              recording = listener.startRecording();
              recStart = performance.now();
            }
          }
          break;
        case 'pulse':
          setPulse({ n: ev.number, accent: ev.accent });
          if (ev.countIn) setCount(ev.number);
          break;
        case 'step':
          setCurrent(ev.index);
          if (mode === 'wait') setHint(null);
          break;
        case 'mark':
          setMarks((m) => new Map(m).set(ev.index, ev.state));
          if (mode === 'wait' && ev.state !== 'bad') setNote(null);
          break;
        case 'hint':
          setHint(ev.index);
          break;
        case 'wrong': {
          if (mode !== 'wait') break;
          const want = steps[ev.index];
          if (ev.heard && want?.strum) setNote({ tone: 'hint', text: `That sounded more like ${sayChord(ev.heard)}. Check the picture for ${sayChord(want.strum.chord)}.` });
          else if (ev.midi !== undefined) setNote({ tone: 'hint', text: `That was ${sayLetter(noteLetter(ev.midi))}. ${placeWords(want)}` });
          break;
        }
        case 'unclear': {
          if (mode !== 'wait') break;
          const want = steps[ev.index];
          if (want?.strum) {
            setNote({
              tone: 'hint',
              text:
                ev.missing && ev.missing.length > 0
                  ? `Not every string rang. ${ev.missing.map((pc) => sayLetter(noteLetter(pc))).join(' and ')} ${ev.missing.length === 1 ? 'was' : 'were'} hard to hear. Arch your fingers and press just behind the frets.`
                  : 'That strum sounded muted. Press a little firmer, just behind the frets.',
            });
          } else setNote({ tone: 'hint', text: 'That note did not ring clearly. Press with the fingertip, just behind the fret.' });
          break;
        }
        case 'false-start':
          // This run has stopped itself. A fresh one waits for the learner, with the reason shown.
          carryNote.current = { tone: 'hint', text: 'You started before the count in finished. Wait for the clicks, then come in.' };
          setRestart((r) => r + 1);
          break;
        case 'done':
          setPhase('done');
          if (recording) {
            const seconds = (performance.now() - recStart) / 1000;
            void listener.stopRecording().then((blob) => {
              if (blob && onTakeRef.current) onTakeRef.current(blob, seconds);
            });
          }
          onDoneRef.current(ev.result);
          break;
      }
    });
    if (mode === 'wait') {
      setPhase('playing');
      startedRef.current = true;
      f.start();
    } else {
      // The run waits until the learner strums once, so their hands never leave the guitar. A button does the same.
      setPhase('gate');
      const t = setTimeout(() => {
        const unsub = strikeBus.subscribe(() => {
          unsub();
          begin();
        });
        cleanupGate = unsub;
      }, 400);
      cleanupGate = () => clearTimeout(t);
    }
    return () => {
      off();
      cleanupGate?.();
      if (recording) void listener.stopRecording();
      f.stop();
      if (followRef.current === f) followRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, mode, held, listening, score, restart]);

  useEffect(
    () => () => {
      instrument.stop();
    },
    [],
  );

  // --------------------------------------------------------------- drawing

  const pulses = pulsesPerMeasure(score.time);
  // The chart counts every strum. When the music waits it moves chord by chord, so the place is found by time.
  const chartCurrent = current !== null && steps[current] ? score.steps.findIndex((x) => Math.abs(x.start - steps[current].start) < 1e-6) : null;
  const showHint = hint !== null && hint === current;
  const notesHint = display !== 'chart' && stepNow && !stepNow.strum && (showHint || hints === 'always') ? stepNow.notes[0] : null;

  const micBlock =
    mode !== 'listen' && !listening ? (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-os-surface p-6 text-center">
        <Icon.Mic size={30} />
        <div className="max-w-md text-[1.1rem] text-os-muted">
          {status.state === 'denied'
            ? "The microphone is switched off for this app. Turn it on in the iPad's Settings, under Privacy and Security, Microphone, then come back."
            : status.state === 'error'
              ? `The microphone could not start. ${status.error ?? ''}`
              : 'The app listens to your guitar through the microphone.'}
        </div>
        {status.state !== 'denied' && (
          <Button onClick={startListening} icon={<Icon.Mic size={18} />}>
            {status.state === 'starting' ? 'Starting' : 'Start listening'}
          </Button>
        )}
      </div>
    ) : null;

  return (
    <div className={`flex h-full min-h-0 flex-col ${props.veil ? 'os-veil' : ''}`}>
      {/* What is happening now: the beat, the count, and what was heard. */}
      <div className="flex min-h-[3.5rem] shrink-0 items-center gap-4 px-7">
        {mode === 'tempo' && phase !== 'gate' && (
          <div className="flex items-center gap-2" aria-hidden>
            {Array.from({ length: pulses }, (_, i) => (
              <span key={i} className={`os-beat-dot ${pulse && pulse.n === i + 1 ? 'is-on' : ''} ${i === 0 ? 'is-accent' : ''}`} />
            ))}
          </div>
        )}
        {count !== null && phase === 'countin' && (
          <span key={count} className="os-count font-os-serif text-4xl font-semibold">
            {count}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {note && <div className={`os-fade-up text-[1.1rem] leading-snug ${note.tone === 'ok' ? 'text-os-ok' : note.tone === 'bad' ? 'text-os-bad' : 'text-os-hint-ink'}`}>{note.text}</div>}
          {!note && mode === 'listen' && deviceVolume !== null && deviceVolume < 0.4 && (
            <div className="text-[1.05rem] leading-snug text-os-hint-ink">The iPad is turned down low. Turn it up with the buttons on its side to hear this clearly.</div>
          )}
          {!note && mode === 'tempo' && phase === 'gate' && listening && (
            <div className="text-[1.15rem] font-medium text-os-ink">Strum once when you are ready, and the count in begins.</div>
          )}
          {!note && mode === 'wait' && notesHint && <div className="text-[1.1rem] text-os-muted">{placeWords(stepNow)}</div>}
        </div>
        {mode !== 'listen' && listening && (
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-os-raised text-os-muted" title="Listening">
            <Icon.Mic size={18} />
            <span key={heard} className={heard > 0 ? 'os-heard absolute inset-0 rounded-full border-2 border-os-accent' : ''} />
          </span>
        )}
        {mode === 'tempo' && phase === 'gate' && listening && (
          <Button size="sm" onClick={begin} icon={<Icon.Play size={16} />}>
            Start
          </Button>
        )}
        {props.extra}
      </div>

      <div className="min-h-0 flex-1 px-7 pb-6">
        {micBlock ?? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            {(display === 'chord' || display === 'chart') && stepNow?.strum && (
              <div className="flex shrink-0 items-end justify-center gap-8">
                <div className="flex flex-col items-center">
                  <ChordDiagram chord={stepNow.strum.chord} shape={stepNow.strum.shape} width={display === 'chord' ? 230 : 170} />
                </div>
                {nextChord && (
                  <div className="flex flex-col items-center opacity-70">
                    <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-os-faint">Next</span>
                    <ChordDiagram chord={nextChord} width={display === 'chord' ? 150 : 120} />
                  </div>
                )}
                {display === 'chart' && props.pattern && mode !== 'wait' && (
                  <div className="hidden flex-col items-center gap-2 landscape:flex">
                    <span className="text-xs font-semibold uppercase tracking-widest text-os-faint">Strum</span>
                    <PatternView pattern={props.pattern} time={score.time} />
                  </div>
                )}
              </div>
            )}
            {display === 'chord' && stepNow && !stepNow.strum && (
              <div className="flex justify-center">
                <Neck marks={stepNow.notes.map((n) => ({ string: n.place.string, fret: n.place.fret, label: noteLetter(n.midi) }))} frets={5} />
              </div>
            )}
            {display === 'chart' && (
              <div className="os-scroll min-h-0 flex-1">
                {props.words && props.lyrics ? (
                  <WordsView lyrics={props.lyrics} measure={current !== null && stepNow ? stepNow.measure + score.measureOffset : null} />
                ) : (
                  <ChartView score={score} current={chartCurrent} marks={changesOnly ? remap(marks, steps, score) : marks} />
                )}
              </div>
            )}
            {display === 'tab' && (
              <>
                <div className="min-h-0 flex-1 rounded-3xl bg-os-surface py-2">
                  <TabView score={score} current={current} marks={marks} hint={showHint ? current : null} />
                </div>
                {notesHint && (
                  <div className="flex shrink-0 justify-center">
                    <div className="w-full max-w-[420px]">
                      <Neck marks={[{ string: notesHint.place.string, fret: notesHint.place.fret, label: notesHint.finger ? String(notesHint.finger) : noteLetter(notesHint.midi) }]} frets={5} highlight={{ string: notesHint.place.string, fret: notesHint.place.fret }} />
                    </div>
                  </div>
                )}
              </>
            )}
            {display === 'hidden' && <div className="flex-1" />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Marks given against the chord changes, moved onto the full score's steps so the chart can colour its measures. */
function remap(marks: Map<number, StepMark>, steps: Step[], score: Score): Map<number, StepMark> {
  const out = new Map<number, StepMark>();
  marks.forEach((m, i) => {
    const s = steps[i];
    if (!s) return;
    const j = score.steps.findIndex((x) => Math.abs(x.start - s.start) < 1e-6);
    if (j >= 0) out.set(j, m);
  });
  return out;
}

export function chordWords(chord: string): string {
  return `${sayChord(chord)}${shapeFor(chord).tip ? `. ${shapeFor(chord).tip}` : ''}`;
}
