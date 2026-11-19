'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import { TakePlayer } from '@/lib/piano/audio/replay';
import { Transport, scoreEvents, type TimedEvent } from '@/lib/piano/audio/transport';
import type { Display, Hints } from '@/lib/piano/content/types';
import { FlowSession, waitingGate, type FlowResult, type Take } from '@/lib/piano/engine/flow';
import { emitNoteOff, emitNoteOn, noteBus } from '@/lib/piano/input/bus';
import { REMOTE_SECONDARY, input } from '@/lib/piano/input/hub';
import { usePiano } from '@/lib/piano/learn/store';
import { scoreRange, stepsFor, type Score } from '@/lib/piano/music/score';
import { pulsesPerMeasure, type Hand } from '@/lib/piano/music/theory';
import ChordChart from './ChordChart';
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
  /** Accept each note in any octave, so chords can be played in any position. */
  anyOctave?: boolean;
  /** Milliseconds of waiting before the key is shown, in place of the usual few seconds. */
  hintMs?: number;
  /** The keys to draw, in place of the stretch the music itself covers. */
  keys?: { low: number; high: number };
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
  /** End a waiting run early once the learner is plainly stuck, as on a first play through. */
  stopAfter?: { hints: number; wrong: number } | null;
  /** Follow a learner who begins in another octave, as on a first play through. */
  followOctave?: boolean;
  /** Count a key that had to be shown on the first step, where that step is itself the question. */
  countFirstHint?: boolean;
  /** The rhythm on any key asks for notes to be held, so the wording says play, not tap. */
  sustain?: boolean;
  /** Milliseconds before a demonstration begins, to leave time to read what to listen for. */
  leadIn?: number;
  /**
   * Play back a take of the learner's own playing over the music as it stands,
   * marks and all. Change `key` to play it again, set to null to stop.
   */
  replay?: { take: Take; key: number } | null;
  onReplayDone?: () => void;
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
  anyOctave = false,
  hintMs,
  keys,
  runId,
  onDone,
  contourLabel = 'finger',
  catchUp,
  autoStart = false,
  held = false,
  veil = false,
  click = false,
  hiddenPrompt = 'Your turn',
  stopAfter = null,
  followOctave = false,
  countFirstHint = false,
  sustain = false,
  leadIn = 350,
  replay = null,
  onReplayDone,
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
  const replayDone = useRef(onReplayDone);
  replayDone.current = onReplayDone;
  const [replaying, setReplaying] = useState(false);
  // A sheet over the stand holds the run. `held` is read when a run would start,
  // and a change to it stops or restarts only a run that has not finished: a
  // finished run stays as it is, with its marks, for as long as its reply is up.
  const heldRef = useRef(held);
  heldRef.current = held;
  const finished = useRef(false);
  const parked = useRef(false);
  const halt = useRef<(() => void) | null>(null);
  const [resume, setResume] = useState(0);
  // A word to the learner about what just happened, such as a start before the count was over.
  const [notice, setNotice] = useState<string | null>(null);
  const falseStart = useRef(false);

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
    if (keys) return keys;
    const r = scoreRange(score);
    return keyboardRange(r.low - 2, r.high + 2, touch ? 14 : 19);
  }, [keys, score, touch]);

  useEffect(() => {
    viewRef.current?.clearMarks();
    viewRef.current?.setCursor(null);
    setMarks({});
    setCount(null);
    setBeat(null);
    setPhase('ready');
    gateRef.current = null;
    finished.current = false;
    halt.current = null;
    // After a false start the run goes back to its gate, and the reason stays up until the learner starts again.
    const afterFalseStart = falseStart.current;
    if (!afterFalseStart) setNotice(null);
    falseStart.current = false;
    if (heldRef.current) {
      // It starts when the sheet is put away.
      parked.current = true;
      return;
    }
    parked.current = false;
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
      later(leadIn, () => {
        setPhase('playing');
        transport.start(events, score.totalBeats + 0.5, {
          bpm,
          fromBeat: 0,
          lead: 0.15,
          onDone: () => {
            if (cancelled) return;
            finished.current = true;
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
        // Time to think before the key is shown. The music is said to wait, so it does.
        hintDelayMs: hints === 'always' ? 0 : hints === 'delay' ? (hintMs ?? 4500) : Infinity,
        hintAfterWrong: hints === 'never' ? 4 : 2,
        metronome: click || settings.metronome,
        // Fill in the other hand when the app can play without being overheard.
        accompany: active.length < score.hands.length && inputMode !== 'listen',
        anyPitch: anyKey,
        anyOctave,
        // The run is armed a moment after it appears. A note struck in that moment still counts.
        catchUp: catchUp ?? 0.4,
        stopAfter,
        followOctave,
        countFirstHint,
        latency: { midi: 0.008 + extra, touch: 0.045 + extra, mic: 0.07 + extra, keys: 0.02 + extra },
      });
      const s = session;
      s.events.subscribe((ev) => {
        if (cancelled) return;
        if (ev.type === 'step') {
          viewRef.current?.setCursor(ev.index);
          if (mode === 'wait') {
            setMarks({});
            setNotice(null);
          }
        } else if (ev.type === 'hint') {
          const next: Record<number, KeyMark> = {};
          // Where the run is being followed in another octave, the key to show is the one under the learner's hand.
          for (const n of ev.notes) next[n.midi + ev.shift] = { kind: 'target', label: n.finger ? String(n.finger) : undefined };
          setMarks(next);
        } else if (ev.type === 'false-start') {
          // The learner began to play during the count. Back to the gate, with the reason.
          falseStart.current = true;
          setNotice('Let the count finish, then come in.');
          setResume((n) => n + 1);
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
          // The right note in the wrong place is worth saying, since the ear will not catch it.
          if (ev.octave) setNotice(ev.octave === 'high' ? 'The right note, an octave too high. Play the lit key.' : 'The right note, an octave too low. Play the lit key.');
        } else if (ev.type === 'phase') {
          if (ev.phase === 'countin' || ev.phase === 'playing' || ev.phase === 'done') setPhase(ev.phase);
          if (ev.phase === 'playing') setCount(null);
        } else if (ev.type === 'pulse') {
          setBeat({ n: ev.number, accent: ev.accent });
          setCount(ev.countIn ? ev.number : null);
        } else if (ev.type === 'done') {
          finished.current = true;
          viewRef.current?.setCursor(null);
          setMarks({});
          doneRef.current(ev.result);
        }
      });
      if (mode === 'tempo' && (!autoStart || afterFalseStart)) {
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
          setNotice(null);
          setPhase('ready');
          // A breath between the key that said go and the first click.
          later(450, () => s.start());
        };
        begin = open;
        gateRef.current = open;
        waitingGate.current = open;
        setPhase('gate');
        // The key that brought the learner here must not also start the run. After a
        // false start they may still be playing, so the gate waits for the keys to go quiet.
        let quiet: ReturnType<typeof setTimeout> | null = null;
        const arm = (ms: number) => {
          if (quiet) clearTimeout(quiet);
          quiet = setTimeout(() => {
            if (!cancelled) armed = true;
          }, ms);
          timers.push(quiet);
        };
        arm(afterFalseStart ? 1500 : 300);
        let down = 0;
        offGate = noteBus.subscribe((ev) => {
          if (!armed) {
            if (!afterFalseStart) return;
            // Still playing. A long note held is not quiet either, so the wait runs from when the keys come up.
            if (ev.type === 'on') {
              down++;
              arm(2500);
            } else {
              down = Math.max(0, down - 1);
              if (down === 0) arm(1500);
            }
            return;
          }
          if (ev.type !== 'on') return;
          // The bottom key asks to hear it, so it is left to do that.
          if (ev.source === 'midi' && input.remoteKeys && ev.midi === REMOTE_SECONDARY) return;
          open();
        });
      } else {
        later(mode === 'tempo' ? 600 : 150, () => s.start());
      }
    }

    const stop = () => {
      cancelled = true;
      offGate?.();
      if (begin && waitingGate.current === begin) waitingGate.current = null;
      gateRef.current = null;
      timers.forEach((t) => clearTimeout(t));
      session?.stop();
      transport.stop();
      instrument.stop();
    };
    halt.current = stop;
    return stop;
    // Settings and input mode are read when a run starts. Changing them mid run would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, score, mode, bpm, active, hints, anyKey, display, autoStart, resume]);

  useEffect(() => {
    if (held) {
      // Stop what is under way. A run that had already finished is left alone.
      if (!finished.current && halt.current) {
        halt.current();
        parked.current = true;
      }
    } else if (parked.current) {
      parked.current = false;
      setResume((n) => n + 1);
    }
  }, [held]);

  // The learner's own take, played back over the music that was just played.
  const replayKey = replay?.key ?? null;
  useEffect(() => {
    if (!replay) return;
    const player = new TakePlayer();
    const view = viewRef.current;
    const tempo = replay.take.bpm > 0;
    setReplaying(true);
    player.play(replay.take, {
      score,
      // The beat it was played to, unless the learner has the click switched off.
      click: tempo && (click || settings.metronome),
      onKey: (midiNote, down) =>
        setMarks((m) => {
          const next = { ...m };
          if (down) next[midiNote] = { kind: 'scale', badge: 'accent' };
          else delete next[midiNote];
          return next;
        }),
      steps,
      onStep: tempo ? (index) => view?.setCursor(index) : undefined,
      onDone: () => {
        view?.setCursor(null);
        setMarks({});
        setReplaying(false);
        replayDone.current?.();
      },
    });
    return () => {
      player.stop();
      view?.setCursor(null);
      setMarks({});
      setReplaying(false);
    };
    // A new key means play it again. The take and the music belong to the run on the stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  const pulses = pulsesPerMeasure(score.time);
  const showStaff = display === 'staff';
  const focusHand = score.hands.length === 2 && active.length === 1 ? active[0] : null;

  let status = '';
  if (replaying) status = 'Your own playing';
  else if (mode === 'listen') status = phase === 'done' ? 'That was it' : 'Listen';
  else if (phase === 'done' || held) status = '';
  else if (phase === 'gate') status = 'The count starts when you are ready';
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
        {display === 'chart' && <ChordChart ref={viewRef} score={score} steps={steps} />}
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
        {(phase === 'gate' || notice) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
            {notice && (
              <div role="status" className="mc-fade-up rounded-full bg-mc-surface px-5 py-2 text-[1rem] font-medium text-mc-hint-ink shadow-lg ring-1 ring-mc-line">
                {notice}
              </div>
            )}
            {phase === 'gate' && (
              <button
                onClick={() => gateRef.current?.()}
                className="mc-fade-up pointer-events-auto flex h-12 items-center gap-2.5 rounded-full bg-mc-ink px-6 text-[1.05rem] font-semibold text-mc-bg shadow-lg active:scale-[0.97]"
              >
                <Icon.Play size={18} />
                {/* A key starts the count, not the music, and the words say so. */}
                {touch ? 'Tap here to start the count' : anyKey && !sustain ? 'Tap any key to start the count' : 'Play any key to start the count'}
              </button>
            )}
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
        <div className="flex h-16 shrink-0 items-center justify-center text-sm text-mc-muted">
          {sustain ? 'Play the rhythm on any key of your piano, and hold each note for its full length' : 'Tap the rhythm on any key of your piano'}
        </div>
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
