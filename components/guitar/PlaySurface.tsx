'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { whenQuiet } from '@/lib/guitar/audio/speech';
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
import { setFocus, useRemoteKey } from './Stage';
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
  /** Told the way to start a timed run while it waits to be started, and null otherwise, so the screen's own bar can offer it. */
  onGate?: (start: (() => void) | null) => void;
  /** When the music waits: tries at one step before it is let go. 0 for never. */
  giveAfter?: number;
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
  const { status, start: startListening, ask } = useListening(mode !== 'listen');
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
  // What the last strum was judged to be, shown on the chord itself.
  const [flash, setFlash] = useState<{ key: number; tone: StepMark } | null>(null);
  const [heardAs, setHeardAs] = useState<string | null>(null);
  // Where in the strum pattern the music is.
  const [slot, setSlot] = useState<number | null>(null);
  const flashKey = useRef(0);
  const onGateRef = useRef(props.onGate);
  onGateRef.current = props.onGate;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onTakeRef = useRef(props.onTake);
  onTakeRef.current = props.onTake;
  const followRef = useRef<Follower | null>(null);
  const startedRef = useRef(false);
  const givenRef = useRef<number | null>(null);
  const phaseRef = useRef<'gate' | 'countin' | 'playing' | 'done' | 'listening'>('gate');
  const [restart, setRestart] = useState(0);
  const carryNote = useRef<Note | null>(null);

  const bpm = Math.max(30, Math.round((score.tempo * (mode === 'tempo' ? tempoPct : mode === 'listen' ? tempoPct : 100)) / 100));
  // When the music waits on a strummed score, it waits for each new chord: those are the steps shown.
  const changesOnly = props.changesOnly ?? (mode === 'wait' && score.kind === 'strum');
  const steps = useMemo(() => (changesOnly && score.kind === 'strum' ? changeSteps(score) : score.steps), [changesOnly, score]);
  const stepNow = current !== null ? steps[current] : steps[0];
  const nextUp = useMemo(() => {
    if (!stepNow?.strum) return null;
    for (let i = (current ?? 0) + 1; i < steps.length; i++) {
      const c = steps[i].strum?.chord;
      // Within a beat of the change, the next chord is the thing to look at.
      if (c && c !== stepNow.strum.chord) return { chord: c, soon: steps[i].start - stepNow.start <= 1 };
    }
    return null;
  }, [current, stepNow, steps]);
  const nextChord = nextUp?.chord ?? null;

  // A strike heard anywhere, to show the app is listening.
  useEffect(() => strikeBus.subscribe(() => setHeard((h) => h + 1)), []);

  const reset = useCallback(() => {
    setCurrent(null);
    setMarks(new Map());
    setHint(null);
    setNote(null);
    setCount(null);
    setPulse(null);
    setFlash(null);
    setHeardAs(null);
    setSlot(null);
  }, []);

  // ------------------------------------------------------------- listening

  useEffect(() => {
    if (mode !== 'listen' || held) return;
    reset();
    setPhase('listening');
    let stop: (() => void) | null = null;
    let cancelled = false;
    const t = setTimeout(() => {
      void guitar
        .unlock()
        // Where the instruction is being read aloud, the example waits for the voice to finish.
        .then(() => whenQuiet())
        .then(() => {
          // Sound may take a moment to wake. If this run was left meanwhile, it does not play.
          if (cancelled) return;
          stop = playSong(score, props.melody ?? null, {
            bpm,
            onStep: (i) => setCurrent(i),
            onDone: () => onDoneRef.current(null),
          });
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
      // A chord the microphone keeps mishearing is let go after three tries, so nobody is left stranded.
      giveAfter: mode === 'wait' ? (props.giveAfter ?? 3) : 0,
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
        case 'step': {
          setCurrent(ev.index);
          if (mode === 'wait') setHint(null);
          const st = f.steps[ev.index];
          if (mode === 'tempo' && st) setSlot(Math.round((st.start - (score.measureStarts[st.measure] ?? 0)) * 2));
          break;
        }
        case 'given':
          // Said as the music moves on, and left up until the next thing is played.
          givenRef.current = ev.index;
          setNote({
            tone: 'hint',
            text: 'Near enough for now. On to the next one.',
          });
          break;
        case 'mark':
          flashKey.current += 1;
          setFlash({ key: flashKey.current, tone: ev.state });
          if (ev.state !== 'bad') setHeardAs(null);
          setMarks((m) => new Map(m).set(ev.index, ev.state));
          if (mode === 'wait' && ev.state !== 'bad' && givenRef.current !== ev.index) setNote(null);
          break;
        case 'hint':
          setHint(ev.index);
          break;
        case 'wrong': {
          if (mode !== 'wait') break;
          const want = steps[ev.index];
          flashKey.current += 1;
          setFlash({ key: flashKey.current, tone: 'warn' });
          if (ev.heard && want?.strum) {
            setHeardAs(ev.heard);
            setNote({
              tone: 'hint',
              text: `That sounded more like ${sayChord(ev.heard)}. Check the picture for ${sayChord(want.strum.chord)}.`,
            });
          } else if (ev.midi !== undefined)
            setNote({
              tone: 'hint',
              text: `That was ${sayLetter(noteLetter(ev.midi))}. ${placeWords(want)}`,
            });
          break;
        }
        case 'unclear': {
          if (mode !== 'wait') break;
          const want = steps[ev.index];
          flashKey.current += 1;
          setFlash({ key: flashKey.current, tone: 'warn' });
          if (want?.strum) {
            setNote({
              tone: 'hint',
              text:
                ev.missing && ev.missing.length > 0
                  ? `Not every string rang. ${ev.missing.map((pc) => sayLetter(noteLetter(pc))).join(' and ')} ${ev.missing.length === 1 ? 'was' : 'were'} hard to hear. Arch your fingers and press just behind the frets.`
                  : 'That strum sounded muted. Press a little firmer, just behind the frets.',
            });
          } else
            setNote({
              tone: 'hint',
              text: 'That note did not ring clearly. Press with the fingertip, just behind the fret.',
            });
          break;
        }
        case 'false-start':
          // This run has stopped itself. A fresh one waits for the learner, with the reason shown.
          carryNote.current = {
            tone: 'hint',
            text: 'You started before the count in finished. Wait for the clicks, then come in.',
          };
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

  // A run with the beat that is cut into, by the iPad being put away or another app coming up, is not a run
  // to be judged. It is dropped, and a fresh one waits for the learner when they come back.
  phaseRef.current = phase;
  useEffect(() => {
    if (mode !== 'tempo') return;
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (phaseRef.current === 'countin' || phaseRef.current === 'playing') setRestart((r) => r + 1);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [mode]);

  // --------------------------------------------------------------- drawing

  const pulses = pulsesPerMeasure(score.time);
  // The chart counts every strum. When the music waits it moves chord by chord, so the place is found by time.
  const chartCurrent = current !== null && steps[current] ? score.steps.findIndex((x) => Math.abs(x.start - steps[current].start) < 1e-6) : null;
  const showHint = hint !== null && hint === current;
  const notesHint = display !== 'chart' && stepNow && !stepNow.strum && (showHint || hints === 'always') ? stepNow.notes[0] : null;

  const micBlock =
    mode !== 'listen' && ask ? (
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

  // The screen's own bar offers Start while a timed run waits to begin. The pedal starts it too.
  const gateOpen = mode === 'tempo' && phase === 'gate' && listening && !held;
  useEffect(() => {
    onGateRef.current?.(gateOpen ? begin : null);
    return () => onGateRef.current?.(null);
  }, [begin, gateOpen, runId, restart]);
  useRemoteKey('forward', gateOpen ? begin : null, 5);

  // While a run with the beat is under way, everything but the music steps back.
  const underWay = mode === 'tempo' && (phase === 'countin' || phase === 'playing');
  useEffect(() => {
    setFocus(underWay);
    return () => setFocus(false);
  }, [underWay]);

  const strumNow = (display === 'chord' || display === 'chart') && stepNow?.strum ? stepNow.strum : null;
  const big = display === 'chord';
  const flashClass = flash ? (flash.tone === 'ok' ? 'os-flash-ok' : 'os-flash-warn') : '';
  const wrongNow = heardAs !== null && mode === 'wait';
  const beatNow = current !== null && steps[current] ? steps[current].start : null;
  const changeSoon = Boolean(nextUp?.soon) && mode === 'tempo' && phase === 'playing' && current !== null;

  return (
    <div className={`relative flex h-full min-h-0 flex-col ${props.veil ? 'os-veil' : ''}`}>
      {/* What is happening now: the beat, and what was heard. */}
      <div className="flex min-h-[3.25rem] shrink-0 items-center gap-4 px-7">
        {mode === 'tempo' && phase !== 'gate' && (
          <div className="flex items-center gap-3" aria-hidden>
            {Array.from({ length: pulses }, (_, i) => (
              <span key={i} className={`os-beat-dot ${pulse && pulse.n === i + 1 ? 'is-on' : ''} ${i === 0 ? 'is-accent' : ''}`} />
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Waiting to begin: one plain line, large, and a strum is all it takes. */}
          {gateOpen && !note && (
            <div className="os-fade-up inline-flex items-center gap-3 rounded-full bg-os-accent py-2 pl-2 pr-6 text-white">
              <span className="os-pulse flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Icon.Guitar size={24} />
              </span>
              <span className="text-[1.55rem] font-semibold leading-tight">Strum once to begin</span>
            </div>
          )}
          {note && <div className={`os-fade-up text-[1.35rem] font-medium leading-snug ${note.tone === 'ok' ? 'text-os-ok-ink' : note.tone === 'bad' ? 'text-os-bad' : 'text-os-hint-ink'}`}>{note.text}</div>}
          {!note && mode === 'listen' && deviceVolume !== null && deviceVolume < 0.5 && (
            <div className="text-[1.25rem] leading-snug text-os-hint-ink">The iPad is turned down low. Turn it up with the buttons on its side to hear this clearly.</div>
          )}
          {!note && mode === 'wait' && notesHint && <div className="text-[1.35rem] text-os-ink">{placeWords(stepNow)}</div>}
        </div>
        {mode !== 'listen' && listening && (
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-os-raised text-os-muted" title="Listening">
            <Icon.Mic size={22} />
            <span key={heard} className={heard > 0 ? 'os-heard absolute inset-0 rounded-full border-[3px] border-os-accent' : ''} />
          </span>
        )}
        {props.extra}
      </div>

      <div className="min-h-0 flex-1 px-7 pb-3">
        {micBlock ?? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            {strumNow && (
              <div className={`grid min-h-0 flex-1 gap-x-8 gap-y-4 ${big ? '' : 'landscape:grid-cols-[auto_minmax(0,1fr)] portrait:grid-rows-[auto_minmax(0,1fr)]'}`}>
                {/* The chord to play now, the largest thing in view, with the next one beside it. */}
                <div className={`flex items-end justify-center gap-7 ${big ? 'h-full items-center' : 'landscape:items-start'}`}>
                  <div key={flash?.key ?? 'still'} className={`flex flex-col items-center rounded-[2rem] px-4 pb-2 pt-1 ${flashClass} ${wrongNow ? 'ring-[6px] ring-os-hint' : ''}`}>
                    <div className={`font-os-serif font-semibold leading-none ${big ? 'text-[6.5rem]' : 'text-[5.25rem]'}`}>{strumNow.chord}</div>
                    {wrongNow && <div className="os-fade-up mt-1 text-[1.6rem] font-semibold text-os-hint-ink">Heard {heardAs}</div>}
                    <ChordDiagram chord={strumNow.chord} shape={strumNow.shape} width={big ? 310 : 270} name={false} />
                  </div>
                  {nextChord && (
                    <div className={`flex flex-col items-center rounded-[1.5rem] px-3 pb-2 pt-1 transition-colors duration-150 ${changeSoon ? 'bg-os-accent/20 ring-4 ring-os-accent' : ''}`}>
                      <span className={`text-[1.15rem] font-semibold uppercase tracking-widest ${changeSoon ? 'text-os-ink' : 'text-os-muted'}`}>Next</span>
                      <span className="font-os-serif text-[3rem] font-semibold leading-tight">{nextChord}</span>
                      <ChordDiagram chord={nextChord} width={big ? 190 : 160} name={false} />
                    </div>
                  )}
                </div>
                {!big && (
                  <div className="flex min-h-0 flex-col gap-4">
                    {props.pattern && mode !== 'wait' && (
                      <div className="flex shrink-0 justify-center landscape:justify-start">
                        <PatternView pattern={props.pattern} time={score.time} now={mode === 'tempo' && phase === 'playing' ? slot : null} large />
                      </div>
                    )}
                    <div className="os-scroll min-h-0 flex-1">
                      {props.words && props.lyrics ? (
                        <WordsView lyrics={props.lyrics} measure={current !== null && stepNow ? stepNow.measure + score.measureOffset : null} score={score} beat={beatNow} />
                      ) : (
                        <ChartView score={score} current={chartCurrent} marks={changesOnly ? remap(marks, steps, score) : marks} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {display === 'chart' && !strumNow && (
              <div className="os-scroll min-h-0 flex-1">
                <ChartView score={score} current={chartCurrent} marks={changesOnly ? remap(marks, steps, score) : marks} />
              </div>
            )}
            {display === 'chord' && stepNow && !stepNow.strum && (
              <div className="flex justify-center">
                <Neck
                  marks={stepNow.notes.map((n) => ({
                    string: n.place.string,
                    fret: n.place.fret,
                    label: noteLetter(n.midi),
                  }))}
                  frets={5}
                />
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
                      <Neck
                        marks={[
                          {
                            string: notesHint.place.string,
                            fret: notesHint.place.fret,
                            label: notesHint.finger ? String(notesHint.finger) : noteLetter(notesHint.midi),
                          },
                        ]}
                        frets={5}
                        highlight={{
                          string: notesHint.place.string,
                          fret: notesHint.place.fret,
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            {display === 'hidden' && <div className="flex-1" />}
          </div>
        )}
      </div>

      {/* The count in, in the middle of everything, where the eyes already are. */}
      {phase === 'countin' && count !== null && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span key={count} className="os-count-big flex h-[15rem] w-[15rem] items-center justify-center rounded-full bg-os-ink/90 font-os-serif text-[10rem] font-semibold leading-none text-os-bg shadow-2xl">
            {count}
          </span>
        </div>
      )}
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
