'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import { Transport, scoreEvents, type TimedEvent } from '@/lib/piano/audio/transport';
import type { Display, Hints } from '@/lib/piano/content/types';
import { FlowSession, waitingGate, type FlowResult } from '@/lib/piano/engine/flow';
import { emitNoteOff, emitNoteOn, noteBus } from '@/lib/piano/input/bus';
import { REMOTE_SECONDARY, input } from '@/lib/piano/input/hub';
import { usePiano } from '@/lib/piano/learn/store';
import { scoreRange, stepsFor, type Score } from '@/lib/piano/music/score';
import { pulsesPerMeasure, type Hand } from '@/lib/piano/music/theory';
import ContourView from './ContourView';
import { useInputMode } from './hooks';
import { Keyboard, flashKey, keyboardRange, type KeyMark } from './Keyboard';
import ScoreView, { type ScoreViewHandle } from './ScoreView';
import { Icon } from './ui';

export interface PlaySurfaceProps {
  score: Score;
  /** Hands the learner plays. Defaults to every hand in the score. */
  hands?: Hand[];
  mode: 'listen' | 'wait' | 'tempo';
  /** Percent of the written tempo. */
  tempoPct?: number;
  display?: Display;
  hints?: Hints;
  fingering?: boolean;
  names?: boolean;
  /** Judge rhythm only and accept any key. */
  anyKey?: boolean;
  /** Change this to start again. */
  runId: number | string;
  onDone: (result: FlowResult | null) => void;
  /** What to write on the bars of the contour view. */
  contourLabel?: 'finger' | 'letter' | 'none';
  /** Seconds of playing just before the run began to take in. For playing back what was just heard. */
  catchUp?: number;
  /**
   * A timed run waits for the learner to play a key before it counts in, so
   * nothing starts while they are reading or away. Set this where they have
   * just said they are ready.
   */
  autoStart?: boolean;
  /** Start nothing and stop what is running, as while a sheet covers the stand. */
  held?: boolean;
  /** Keep the marks on the notes back, while the learner judges the run for themselves. */
  veil?: boolean;
  /** Always sound the click, whatever the setting, as the timing check needs. */
  click?: boolean;
  /** What to say when the music is kept out of sight and it is the learner's turn. */
  hiddenPrompt?: string;
}

type Phase = 'ready' | 'gate' | 'countin' | 'playing' | 'done';

export default function PlaySurface({
  score,
  hands,
  mode,
  tempoPct = 100,
  display = 'staff',
  hints = 'delay',
  fingering = true,
  names = false,
  anyKey = false,
  runId,
  onDone,
  contourLabel = 'finger',
  catchUp,
  autoStart = false,
  held = false,
  veil = false,
  click = false,
  hiddenPrompt = 'Your turn',
}: PlaySurfaceProps) {
  const inputMode = useInputMode();
  const settings = usePiano((s) => s.settings);
  // Chord letters stay off the stand until the lesson that explains them has been opened.
  const chordsTaught = usePiano((s) => Boolean(s.lessons['triads']));
  const viewRef = useRef<ScoreViewHandle>(null);
  const kbRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const gateRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState<number | null>(null);
  const [beat, setBeat] = useState<{ n: number; accent: boolean } | null>(null);
  const [marks, setMarks] = useState<Record<number, KeyMark>>({});

  const active = useMemo(() => {
    const h = (hands ?? score.hands).filter((x) => score.hands.includes(x));
    return h.length > 0 ? h : score.hands;
  }, [hands, score]);
  const steps = useMemo(() => stepsFor(score, active), [score, active]);
  const bpm = Math.max(30, Math.round((score.tempo * tempoPct) / 100));
  const touch = inputMode === 'touch';

  const range = useMemo(() => {
    const r = scoreRange(score);
    return keyboardRange(r.low - 2, r.high + 2, touch ? 14 : 19);
  }, [score, touch]);

  useEffect(() => {
    viewRef.current?.clearMarks();
    viewRef.current?.setCursor(null);
    setMarks({});
    setCount(null);
    setBeat(null);
    setPhase('ready');
    gateRef.current = null;
    if (held) return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let offGate: (() => void) | null = null;
    let begin: (() => void) | null = null;
    let cancelled = false;
    let session: FlowSession | null = null;
    const transport = new Transport();

    const later = (ms: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, ms),
      );
    };
    const atAudio = (when: number, fn: () => void) => later(Math.max(0, (when - piano.now()) * 1000), fn);

    if (mode === 'listen') {
      const secondsPerBeat = 60 / bpm;
      const events: TimedEvent[] = scoreEvents(score, secondsPerBeat, {
        hands: active,
        onNote: (_id, when, midiNote, seconds) => {
          // When the point is to listen, the keys must not give the answer away.
          if (display === 'hidden') return;
          const note = score.notes.find((n) => n.id === _id);
          atAudio(when, () =>
            setMarks((m) => ({ ...m, [midiNote]: { kind: 'scale', label: note?.finger ? String(note.finger) : undefined, badge: 'accent' } })),
          );
          atAudio(when + Math.max(0.1, seconds - 0.03), () =>
            setMarks((m) => {
              const next = { ...m };
              delete next[midiNote];
              return next;
            }),
          );
        },
      });
      steps.forEach((step, index) => {
        events.push({ beat: step.start, run: (when) => atAudio(when, () => viewRef.current?.setCursor(index)) });
      });
      later(350, () => {
        setPhase('playing');
        transport.start(events, score.totalBeats + 0.5, {
          bpm,
          fromBeat: 0,
          lead: 0.15,
          onDone: () => {
            if (cancelled) return;
            viewRef.current?.setCursor(null);
            setPhase('done');
            doneRef.current(null);
          },
        });
      });
    } else {
      const extra = settings.latencyMs / 1000;
      session = new FlowSession(score, {
        mode,
        hands: active,
        bpm,
        hintDelayMs: hints === 'always' ? 0 : hints === 'delay' ? 3500 : Infinity,
        hintAfterWrong: hints === 'never' ? 4 : 2,
        metronome: click || settings.metronome,
        // Fill in the other hand when the app can play without being overheard.
        accompany: active.length < score.hands.length && inputMode !== 'listen',
        anyPitch: anyKey,
        // The run is armed a moment after it appears. A note struck in that moment still counts.
        catchUp: catchUp ?? 0.4,
        latency: { midi: 0.008 + extra, touch: 0.045 + extra, mic: 0.07 + extra, keys: 0.02 + extra },
      });
      const s = session;
      s.events.subscribe((ev) => {
        if (cancelled) return;
        if (ev.type === 'step') {
          viewRef.current?.setCursor(ev.index);
          if (mode === 'wait') setMarks({});
        } else if (ev.type === 'hint') {
          const next: Record<number, KeyMark> = {};
          for (const n of ev.notes) next[n.midi] = { kind: 'target', label: n.finger ? String(n.finger) : undefined };
          setMarks(next);
        } else if (ev.type === 'note') {
          viewRef.current?.mark(ev.id, ev.state);
          if (ev.state !== 'bad') flashKey(kbRef.current, ev.midi, 'ok');
          setMarks((m) => {
            if (!(ev.midi in m)) return m;
            const next = { ...m };
            delete next[ev.midi];
            return next;
          });
        } else if (ev.type === 'wrong') {
          flashKey(kbRef.current, ev.midi, 'bad');
        } else if (ev.type === 'phase') {
          if (ev.phase === 'countin' || ev.phase === 'playing' || ev.phase === 'done') setPhase(ev.phase);
          if (ev.phase === 'playing') setCount(null);
        } else if (ev.type === 'pulse') {
          setBeat({ n: ev.number, accent: ev.accent });
          setCount(ev.countIn ? ev.number : null);
        } else if (ev.type === 'done') {
          viewRef.current?.setCursor(null);
          setMarks({});
          doneRef.current(ev.result);
        }
      });
      if (mode === 'tempo' && !autoStart) {
        // The run waits at a gate. Any key on the piano opens it, or a tap.
        let begun = false;
        let armed = false;
        const open = () => {
          if (cancelled || begun) return;
          begun = true;
          offGate?.();
          offGate = null;
          if (waitingGate.current === open) waitingGate.current = null;
          gateRef.current = null;
          setPhase('ready');
          // A breath between the key that said go and the first click.
          later(450, () => s.start());
        };
        begin = open;
        gateRef.current = open;
        waitingGate.current = open;
        setPhase('gate');
        // The key that brought the learner here must not also start the run.
        later(300, () => {
          armed = true;
        });
        offGate = noteBus.subscribe((ev) => {
          if (ev.type !== 'on' || !armed) return;
          // The bottom key asks to hear it, so it is left to do that.
          if (ev.source === 'midi' && input.remoteKeys && ev.midi === REMOTE_SECONDARY) return;
          open();
        });
      } else {
        later(mode === 'tempo' ? 600 : 150, () => s.start());
      }
    }

    return () => {
      cancelled = true;
      offGate?.();
      if (begin && waitingGate.current === begin) waitingGate.current = null;
      gateRef.current = null;
      timers.forEach((t) => clearTimeout(t));
      session?.stop();
      transport.stop();
      instrument.stop();
    };
    // Settings and input mode are read when a run starts. Changing them mid run would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, score, mode, bpm, active, hints, anyKey, display, held, autoStart]);

  const pulses = pulsesPerMeasure(score.time);
  const showStaff = display === 'staff';
  const focusHand = score.hands.length === 2 && active.length === 1 ? active[0] : null;

  let status = '';
  if (mode === 'listen') status = phase === 'done' ? 'That was it' : 'Listen';
  else if (phase === 'done' || held) status = '';
  else if (phase === 'gate') status = 'It starts when you do';
  else if (phase === 'countin') status = 'Get ready';
  else if (mode === 'wait') status = anyKey ? 'Play each note, any key' : 'The music waits for you';
  else if (phase === 'ready') status = 'Get ready';
  else status = 'Play';

  return (
    <div className={`flex h-full min-h-0 flex-col ${veil ? 'mc-veil' : ''}`}>
      <div className="relative min-h-0 flex-1 px-5">
        {showStaff && (
          <ScoreView ref={viewRef} score={score} steps={steps} showFingering={fingering} showNames={names} focusHand={focusHand} showChords={chordsTaught} />
        )}
        {display === 'contour' && <ContourView ref={viewRef} score={score} steps={steps} label={contourLabel} />}
        {display === 'hidden' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-mc-muted">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-mc-raised ${mode === 'listen' && phase === 'playing' ? 'mc-pulse' : ''}`}>
              {mode === 'listen' ? <Icon.Ear size={44} /> : <Icon.Piano size={44} />}
            </div>
            <div className="font-mc-serif text-2xl text-mc-ink">{mode === 'listen' ? 'Listen closely' : hiddenPrompt}</div>
          </div>
        )}
        {count !== null && (
          // In the corner, so the first notes stay in view while the count runs.
          <div className="pointer-events-none absolute bottom-2 right-6 flex h-24 w-24 items-center justify-center rounded-full bg-mc-bg/85">
            <div key={`${count}-${beat?.n}`} className="mc-count font-mc-serif text-[4.5rem] leading-none text-mc-accent">
              {count}
            </div>
          </div>
        )}
        {phase === 'gate' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button
              onClick={() => gateRef.current?.()}
              className="mc-fade-up pointer-events-auto flex h-12 items-center gap-2.5 rounded-full bg-mc-ink px-6 text-[1.05rem] font-semibold text-mc-bg shadow-lg active:scale-[0.97]"
            >
              <Icon.Play size={18} />
              {touch ? 'Tap here when you are ready' : anyKey ? 'Tap any key when you are ready' : 'Play any key when you are ready'}
            </button>
          </div>
        )}
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between px-6 text-sm text-mc-muted">
        <span className="font-medium">{status}</span>
        {mode === 'tempo' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" aria-hidden="true">
              {Array.from({ length: pulses }, (_, i) => (
                <span
                  key={i}
                  className={`mc-beat-dot ${i === 0 ? 'is-accent' : ''} ${beat && phase !== 'done' && beat.n === i + 1 ? 'is-on' : ''}`}
                />
              ))}
            </div>
            <span className="tabular-nums">{bpm} beats a minute</span>
          </div>
        )}
        {mode === 'listen' && <span className="tabular-nums">{bpm} beats a minute</span>}
      </div>

      {anyKey && touch ? (
        <TapPad />
      ) : anyKey ? (
        <div className="flex h-16 shrink-0 items-center justify-center text-sm text-mc-muted">Tap the rhythm on any key of your piano</div>
      ) : (
        <div ref={kbRef} className="shrink-0">
          <Keyboard
            low={range.low}
            high={range.high}
            height={touch ? 188 : 116}
            marks={marks}
            labels="c"
            interactive={touch}
            sound={touch}
            className={touch ? '' : 'mc-keys-mini'}
          />
        </div>
      )}
    </div>
  );
}

/** A big button to tap rhythms on when there is no piano connected. */
function TapPad() {
  return (
    <div className="shrink-0 px-6 pb-5">
      <button
        className="h-28 w-full rounded-3xl bg-mc-raised text-lg font-semibold text-mc-muted transition-transform active:scale-[0.985] active:bg-mc-accent/15"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault();
          void piano.resume();
          piano.noteOn(72, 0.6);
          emitNoteOn(72, 0.6, piano.now(), 'touch');
        }}
        onPointerUp={() => {
          piano.noteOff(72);
          emitNoteOff(72, piano.now(), 'touch');
        }}
      >
        Tap here
      </button>
    </div>
  );
}
