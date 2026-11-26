'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { instrument } from '@/lib/piano/audio/instrument';
import { getLesson, getPiece, lessonOrder, resolveMusic } from '@/lib/piano/content/catalog';
import type { Lesson, Step } from '@/lib/piano/content/types';
import { notAttempted, type FlowResult } from '@/lib/piano/engine/flow';
import { noteBus } from '@/lib/piano/input/bus';
import { ANSWER_KEYS, answerKeys } from '@/lib/piano/learn/answers';
import { diagnose, waitSummary } from '@/lib/piano/learn/coach';
import { REMOTE_PRIMARY, REMOTE_SECONDARY, isRemoteKey } from '@/lib/piano/input/hub';
import { midi } from '@/lib/piano/input/midi';
import { usePiano } from '@/lib/piano/learn/store';
import { pitchClass } from '@/lib/piano/music/theory';
import FigureView from './Figures';
import { QUIET_AFTER_AUTO, quietRemote, readingMs, useHints, useInputMode, usePracticeTimer, useQuietRemote, useRemote, useWakeLock } from './hooks';
import { Keyboard, flashKey } from './Keyboard';
import PlaySurface from './PlaySurface';
import type { Activity } from './Screens';
import { useOnward } from './session';
import { Button, Icon, IconButton, Pill, Prose } from './ui';

type StepOf<K extends Step['kind']> = Extract<Step, { kind: K }>;

/** A way back to the step before, for the steps that offer it from the piano. Null on the first step. */
const BackContext = createContext<(() => void) | null>(null);

function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-2xl border border-mc-line">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-[1.05rem] font-semibold text-mc-muted" onClick={() => setOpen((o) => !o)}>
        <Icon.Info size={18} />
        Why it is taught this way
        <span className="ml-auto text-[0.85rem]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <p className="px-4 pb-4 text-[1.1rem] leading-relaxed text-mc-muted">{text}</p>}
    </div>
  );
}

/** A column of text with a button at the foot. */
function TextStep({
  title,
  children,
  aside,
  onNext,
  nextLabel = 'Continue',
  pedal = true,
}: {
  title?: string;
  children: ReactNode;
  /** A picture that goes with the words. On a wide screen it stands beside them, so both are in view without scrolling. */
  aside?: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  /** Whether the right pedal turns the page. Not on a page that asks for the pedal to be tried. */
  pedal?: boolean;
}) {
  const back = useContext(BackContext);
  // Nothing is being played on a page of words, so the bottom key is free to turn back a page.
  useRemote({ primary: onNext, secondary: back ?? undefined, pedal });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mc-scroll min-h-0 flex-1">
        {/* Set large and dark: this is read from the bench, at arm's length. */}
        <div className={`mc-fade-up mx-auto w-full px-8 py-6 ${aside ? 'max-w-6xl landscape:grid landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] landscape:items-center landscape:gap-10' : 'max-w-3xl'}`}>
          <div>
            {title && <h2 className="mb-4 font-mc-serif text-[2.6rem] leading-tight">{title}</h2>}
            {children}
          </div>
          {aside && <div className="mt-6 landscape:mt-0">{aside}</div>}
        </div>
      </div>
      <StepFoot onNext={onNext} nextLabel={nextLabel} pedal={pedal} />
    </div>
  );
}

/** The foot of a step that is read, not played: back on the left, on in the middle, both within reach of the keys. */
function StepFoot({ onNext, nextLabel = 'Continue', disabled, pedal }: { onNext: () => void; nextLabel?: string; disabled?: boolean; pedal?: boolean }) {
  const back = useContext(BackContext);
  const hints = useHints();
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 pb-6 pt-3">
      <div>
        {back && (
          <Button variant="ghost" size="lg" onClick={back} hint={hints.bottom} icon={<Icon.Left size={20} />}>
            Back
          </Button>
        )}
      </div>
      <Button size="lg" disabled={disabled} onClick={onNext} hint={disabled ? undefined : pedal ? hints.onward : hints.top} className="min-w-[260px]">
        {nextLabel}
      </Button>
      <div />
    </div>
  );
}

function SayStep({ step, onNext }: { step: StepOf<'say'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} onNext={onNext} pedal={!/pedal/i.test(step.text)} aside={step.figure ? <FigureView figure={step.figure} /> : undefined}>
      <Prose text={step.text} className="text-[1.6rem] leading-normal text-mc-ink/85" />
      {step.why && <Why text={step.why} />}
    </TextStep>
  );
}

function CheckStep({ step, onNext }: { step: StepOf<'check'>; onNext: () => void }) {
  // On a page that asks the learner to try things at the piano, the pedal is a pedal.
  const pedal = !step.playing && !/pedal/i.test(`${step.text ?? ''} ${step.items.join(' ')}`);
  return (
    <TextStep title={step.title} onNext={onNext} nextLabel={step.button ?? 'Continue'} pedal={pedal}>
      {step.text && <Prose text={step.text} className="mb-5 text-[1.6rem] leading-normal text-mc-ink/85" />}
      <ul className="space-y-3">
        {step.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-mc-surface px-5 py-3.5 text-[1.45rem] leading-snug">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mc-ink/10 text-mc-ink">
              <Icon.Check size={15} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </TextStep>
  );
}

/** Instruction line above a playing surface, with room for buttons. */
function Brief({ text, children, tone }: { text: string; children?: ReactNode; tone?: 'ok' | 'hint' }) {
  return (
    <div className="flex shrink-0 items-center gap-4 px-7 pb-2 pt-1">
      <div className={`min-w-0 flex-1 text-[1.45rem] leading-snug ${tone === 'ok' ? 'text-mc-ok-ink' : tone === 'hint' ? 'text-mc-hint-ink' : 'text-mc-ink/85'}`}>
        <Prose text={text} />
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** How long a finished demonstration stays up before the lesson goes on by itself. */
const FLOW_MS = 2600;

function ListenStep({ step, onNext, onAuto }: { step: StepOf<'listen'>; onNext: () => void; onAuto: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const hints = useHints();
  const again = useCallback(() => {
    setDone(false);
    setRun((r) => r + 1);
  }, []);
  // Once it has been heard it goes on by itself after a moment, so the hands can stay on the keys.
  // Asking to hear it again within that moment keeps it here.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onAuto, FLOW_MS);
    return () => clearTimeout(t);
  }, [done, onAuto]);
  useRemote({ primary: onNext, secondary: again });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={step.text}>
        <Button variant="soft" onClick={again} icon={<Icon.Repeat size={18} />} hint={hints.bottom}>
          Again
        </Button>
        <Button variant={done ? 'primary' : 'ghost'} onClick={onNext} className="relative overflow-hidden" hint={hints.top}>
          {done ? 'Go on' : 'Skip'}
          {done && <span className="mc-lead absolute bottom-0 left-0 h-1 bg-mc-bg/60" style={{ animationDuration: `${FLOW_MS}ms` }} aria-hidden="true" />}
        </Button>
      </Brief>
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          hands={step.hands}
          mode="listen"
          display={step.display ?? 'staff'}
          runId={run}
          onDone={() => setDone(true)}
          // The first time, leave time to read what to listen for. A longer line gets longer.
          leadIn={run === 0 ? readingMs(step.text) : 350}
        />
      </div>
    </div>
  );
}

function describe(result: FlowResult): string {
  if (result.mode === 'wait') {
    if (result.clean) return result.totalNotes === 1 ? 'That is the one.' : 'Every note right the first time.';
    if (result.totalNotes === 1) return 'You found it on a later try.';
    return `${waitSummary(result)}.`;
  }
  const pct = Math.round(result.accuracy * 100);
  const timing = result.onTime >= 0.8 ? 'well in time' : result.biasMs > 25 ? 'a little behind the beat' : result.biasMs < -25 ? 'a little ahead of the beat' : 'a bit uneven';
  return `${pct} percent of the notes, ${timing}.`;
}

function PlayStep({ step, onNext, onAuto }: { step: StepOf<'play'>; onNext: () => void; onAuto: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const mode = step.mode ?? 'wait';
  const need = step.passes ?? 1;
  const [run, setRun] = useState(0);
  const [have, setHave] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  // Hearing the music played first, between attempts. Not where it is to be played from memory or only tapped.
  const [hearing, setHearing] = useState(false);
  const canHear = step.display !== 'hidden' && !step.anyKey;
  const inputMode = useInputMode();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // How many times the right pedal went down in this run, for the steps that are about it.
  const pedalPresses = useRef(0);
  useEffect(() => {
    if (!step.pedal) return;
    let down = false;
    return midi.pedals.subscribe((ev) => {
      if (ev.pedal !== 'sustain') return;
      const now = down ? ev.value > 0.3 : ev.value >= 0.6;
      if (now && !down) pedalPresses.current++;
      down = now;
    });
  }, [step.pedal]);

  const again = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setHearing(false);
    pedalPresses.current = 0;
    setVerdict(null);
    setRun((r) => r + 1);
  }, []);

  /** Play the music through once, then the learner's turn comes back as it was. */
  const hear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVerdict(null);
    setHearing(true);
    setRun((r) => r + 1);
  }, []);

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (hearing) {
        setHearing(false);
        setRun((r) => r + 1);
        return;
      }
      if (!result) return;
      // A timed run in which no key was touched is not an attempt. It waits at the gate again.
      if (notAttempted(result)) {
        again();
        return;
      }
      // Without a beat, most of it has to come with no wrong key, and no more than half with the key shown.
      let ok = mode === 'wait' ? result.accuracy >= 0.6 && result.hintedSteps <= Math.max(1, result.totalSteps * 0.5) : result.accuracy >= 0.7;
      let text = describe(result);
      if (ok && step.touch && result.velocity !== null) {
        if (step.touch === 'soft' && result.velocity > 0.45) {
          ok = false;
          text = 'Right notes, but louder than soft. Let the keys down gently.';
        } else if (step.touch === 'loud' && result.velocity < 0.6) {
          ok = false;
          text = 'Right notes, but not yet full. Let the weight of your arm fall into the keys.';
        }
        // The notes were right, so there is nothing to slow down for. Only the touch is to be put right.
        if (!ok) {
          setHave(0);
          setVerdict({ ok: false, text });
          return;
        }
      }
      // Where the step is about the pedal, the notes alone are not the point. Only a piano over MIDI reports its pedal.
      if (ok && step.pedal && inputMode === 'midi') {
        const presses = pedalPresses.current;
        if (presses === 0) {
          ok = false;
          text =
            result.totalSteps >= 3
              ? 'Right notes, but the pedal stayed up. Press the right pedal after the first chord, and change it after each new one.'
              : 'Right notes, but the pedal stayed up. Put the right pedal down and play it again.';
        } else if (presses === 1 && result.totalSteps >= 3) {
          ok = false;
          text = 'The pedal went down and stayed down, so the chords ran into each other. Let it up and straight back down just after each new chord.';
        }
        if (!ok) {
          setHave(0);
          setVerdict({ ok: false, text });
          return;
        }
      }
      // Where the step is about holding long notes, letting them go early is the thing to put right.
      if (ok && step.hold && result.held !== null && result.held < 0.75) {
        ok = false;
        text = 'The rhythm was right, but the long notes were let go early. Keep each key down for all of its beats.';
        setHave(0);
        setVerdict({ ok: false, text });
        return;
      }
      if (ok) {
        const total = have + 1;
        setHave(total);
        if (total >= need) {
          setVerdict({ ok: true, text });
          instrument.chime();
          timer.current = setTimeout(onAuto, 1700);
        } else {
          setVerdict({ ok: true, text: `${text} Once more to make it stick.` });
          timer.current = setTimeout(again, 1700);
        }
      } else {
        setHave(0);
        // Say what went wrong where the playing shows it, and fall back on general advice where it does not.
        const found = diagnose(result);
        setVerdict({
          ok: false,
          text:
            mode !== 'wait'
              ? `${text} ${found ?? 'Try again and keep going through any slip.'}`
              : result.totalNotes === 1
                ? `${text} Have another look at where it sits, then play it once more.`
                : `${text} ${found ? `${found} Go slower there.` : 'Go slower and look at each note before you play it.'}`,
        });
      }
    },
    [again, have, hearing, inputMode, mode, need, onAuto, step.hold, step.pedal, step.touch],
  );

  // The same two keys mean the same two things all the way through: the top key goes on, the bottom key plays it again.
  useRemote({ primary: onNext, secondary: again });
  const hints = useHints();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={verdict ? verdict.text : step.text} tone={verdict ? (verdict.ok ? 'ok' : 'hint') : undefined}>
        {need > 1 && (
          <Pill tone={have > 0 ? 'ok' : 'muted'}>
            {have} of {need}
          </Pill>
        )}
        {canHear && !hearing && (
          <Button variant="soft" onClick={hear} icon={<Icon.Ear size={18} />}>
            Hear it
          </Button>
        )}
        {verdict && !verdict.ok ? (
          <>
            <Button onClick={again} hint={hints.bottom} icon={<Icon.Repeat size={18} />}>
              Try again
            </Button>
            <Button variant="soft" onClick={onNext} hint={hints.top}>
              Move on
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={again} hint={hints.bottom} icon={<Icon.Repeat size={18} />}>
              Again
            </Button>
            <Button variant="ghost" onClick={onNext} hint={hints.top}>
              {verdict ? 'Go on' : 'Skip'}
            </Button>
          </>
        )}
      </Brief>
      {step.why && !verdict && (
        <div className="px-7">
          <details className="text-[1.05rem] text-mc-muted">
            <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold">Why it is taught this way</summary>
            <p className="mt-1 max-w-3xl leading-relaxed">{step.why}</p>
          </details>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          hands={step.hands}
          mode={hearing ? 'listen' : mode}
          tempoPct={step.tempoPct ?? 100}
          display={step.display ?? 'staff'}
          hints={step.hints ?? 'delay'}
          // With nothing on the stand the learner is recalling, so the key waits longer before it shows itself.
          hintMs={step.display === 'hidden' ? 9000 : undefined}
          fingering={step.fingering ?? true}
          names={step.names ?? false}
          anyKey={step.anyKey}
          sustain={step.hold}
          contourLabel={step.anyKey ? 'none' : 'finger'}
          runId={run}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function EchoStep({ step, onNext, onAuto }: { step: StepOf<'echo'>; onNext: () => void; onAuto: () => void }) {
  const scores = useMemo(
    () => step.motifs.map((m) => resolveMusic(step.hand === 'L' ? { lh: m, key: step.key, tempo: 88 } : { rh: m, key: step.key, tempo: 88 })),
    [step],
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'play'>('listen');
  const [run, setRun] = useState(0);
  const [tries, setTries] = useState(0);
  // The reply above the stand, with the few words shown on the stand itself to match it.
  const [note, setNote] = useState<{ ok: boolean; text: string; stand: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hints = useHints();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const hear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, []);

  const advance = useCallback((auto?: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    if (index + 1 >= scores.length) {
      if (auto === true) onAuto();
      else onNext();
      return;
    }
    // Moved on by itself: a press already on its way is not a wish to skip the pattern that follows.
    if (auto === true) quietRemote(QUIET_AFTER_AUTO);
    setIndex((i) => i + 1);
    setTries(0);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, [index, onAuto, onNext, scores.length]);

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (phase === 'listen') {
        timer.current = setTimeout(() => {
          setPhase('play');
          setRun((r) => r + 1);
        }, 120);
        return;
      }
      if (!result) return;
      if (result.clean) {
        setNote({ ok: true, text: 'Yes, that is it.', stand: 'That is it' });
        timer.current = setTimeout(() => advance(true), 1100);
      } else if (tries < 1) {
        setTries((t) => t + 1);
        setNote({ ok: false, text: 'Not quite. Listen once more.', stand: 'Listen again' });
        timer.current = setTimeout(hear, 1300);
      } else {
        setNote({ ok: false, text: 'You found it in the end. On to the next.', stand: 'On to the next' });
        timer.current = setTimeout(() => advance(true), 1500);
      }
    },
    [advance, hear, phase, tries],
  );

  useRemote({ primary: () => advance(), secondary: hear });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={note ? note.text : step.text} tone={note ? (note.ok ? 'ok' : 'hint') : undefined}>
        <Pill>
          {index + 1} of {scores.length}
        </Pill>
        <Button variant="soft" onClick={hear} icon={<Icon.Ear size={18} />} hint={hints.bottom}>
          Hear it
        </Button>
        <Button variant="ghost" onClick={() => advance()} hint={hints.top}>
          Skip
        </Button>
      </Brief>
      {step.why && !note && phase === 'listen' && index === 0 && (
        <div className="px-7">
          <details className="text-[1.05rem] text-mc-muted">
            <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold">Why it is taught this way</summary>
            <p className="mt-1 max-w-3xl leading-relaxed">{step.why}</p>
          </details>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={scores[index]}
          mode={phase === 'listen' ? 'listen' : 'wait'}
          display="hidden"
          hints="never"
          // While a reply is up, the stand does not go on asking for the same thing.
          hiddenPrompt={note ? note.stand : 'Now play what you heard'}
          catchUp={2.2}
          runId={`${index}-${run}`}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function FindStep({ step, onNext, onAuto }: { step: StepOf<'find'>; onNext: () => void; onAuto: () => void }) {
  const kbRef = useRef<HTMLDivElement>(null);
  const found = useRef(new Set<number>());
  const [count, setCount] = useState(0);
  const low = step.low ?? 48;
  const high = step.high ?? 83;
  const back = useContext(BackContext);
  // The top key is a C and the bottom key an A. Where the step asks for that note, the key is
  // an answer like any other. Where it does not, the key keeps its usual meaning.
  const wanted = useCallback((midi: number) => step.pitchClasses.includes(pitchClass(midi)), [step.pitchClasses]);
  const topSkips = !wanted(REMOTE_PRIMARY);
  useRemote({ primary: topSkips ? onNext : undefined, secondary: wanted(REMOTE_SECONDARY) ? undefined : (back ?? undefined) });
  const mode = useInputMode();
  const hints = useHints();

  useEffect(() => {
    found.current = new Set();
    setCount(0);
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = noteBus.subscribe((ev) => {
      if (ev.type !== 'on' || finished) return;
      if (ev.source === 'midi' && isRemoteKey(ev.midi) && !step.pitchClasses.includes(pitchClass(ev.midi))) return;
      if (step.pitchClasses.includes(pitchClass(ev.midi))) {
        flashKey(kbRef.current, ev.midi, 'ok', 700);
        if (!found.current.has(ev.midi)) {
          found.current.add(ev.midi);
          setCount(found.current.size);
          if (found.current.size >= step.count) {
            finished = true;
            instrument.chime();
            timer = setTimeout(onAuto, 1000);
          }
        }
      } else {
        flashKey(kbRef.current, ev.midi, 'bad');
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [step, onAuto]);
  const backByKey = !wanted(REMOTE_SECONDARY);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 text-center">
        <Prose text={step.text} className="mc-fade-up max-w-2xl font-mc-serif text-[2rem] leading-snug text-mc-ink" />
        <div className="flex items-center gap-2">
          {Array.from({ length: step.count }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full transition-colors ${i < count ? 'bg-mc-ok' : 'bg-mc-line'}`} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {back && (
            <Button variant="ghost" onClick={back} hint={backByKey ? hints.bottom : undefined} icon={<Icon.Left size={18} />}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onNext} hint={topSkips ? hints.top : undefined}>
            Skip
          </Button>
        </div>
        {/* Where an end key is one of the notes asked for, it is an answer, so it is said. */}
        {hints.top && !topSkips && <p className="text-[1.05rem] text-mc-muted">The top key of the piano is one of them too.</p>}
      </div>
      <div ref={kbRef} className="shrink-0">
        <Keyboard low={low} high={high} height={mode === 'touch' ? 200 : 130} labels={step.labels ?? 'none'} interactive={mode === 'touch'} sound={mode === 'touch'} />
      </div>
    </div>
  );
}

/** How long a question is up before the piano can answer it, so a note still sounding from the music before is not taken as one. */
const ARM_MS = 900;

function QuizStep({ step, onNext }: { step: StepOf<'quiz'>; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const mode = useInputMode();
  const back = useContext(BackContext);
  const answered = picked !== null;
  const keys = useMemo(() => (mode === 'midi' ? answerKeys(step.choices) : null), [mode, step.choices]);
  // A question about the pedal may have the learner try it, so there the pedal stays a pedal.
  const pedal = !/pedal/i.test(`${step.question} ${step.choices.join(' ')}`);
  useRemote({ primary: answered ? onNext : undefined, secondary: back ?? undefined, pedal });
  // Answered from the piano, so the hands stay where they are.
  useEffect(() => {
    if (!keys || answered) return;
    const from = performance.now() + ARM_MS;
    const down = new Set<number>();
    // Keys still held from the step before have to come up first.
    let clear = false;
    return noteBus.subscribe((ev) => {
      if (ev.source !== 'midi' || isRemoteKey(ev.midi)) return;
      if (ev.type === 'off') {
        down.delete(ev.midi);
        return;
      }
      const ready = performance.now() >= from && (clear || down.size === 0);
      down.add(ev.midi);
      if (!ready) return;
      clear = true;
      const i = keys.pcs.indexOf(pitchClass(ev.midi));
      if (i >= 0) setPicked(i);
    });
  }, [answered, keys]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mc-scroll min-h-0 flex-1">
        <div className="mc-fade-up mx-auto w-full max-w-3xl px-8 py-6">
          <h2 className="font-mc-serif text-[2.4rem] leading-tight">{step.question}</h2>
          {keys && !answered && (
            <p className="mt-2 text-[1.25rem] text-mc-ink/75">
              {keys.byNote ? 'Answer by playing that note on the piano, in any octave, or tap it.' : 'Answer on the piano with the key shown beside each one, in any octave, or tap it.'}
            </p>
          )}
          {step.figure && (
            <div className="mt-5">
              <FigureView figure={step.figure} />
            </div>
          )}
          <div className="mt-6 space-y-3">
            {step.choices.map((choice, i) => {
              const isAnswer = i === step.answer;
              const state = !answered ? 'idle' : isAnswer ? 'right' : i === picked ? 'wrong' : 'dim';
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => setPicked(i)}
                  className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left text-[1.5rem] font-medium transition-colors ${
                    state === 'idle'
                      ? 'border-mc-line bg-mc-surface active:bg-mc-raised'
                      : state === 'right'
                        ? 'border-mc-ok bg-mc-ok/10 text-mc-ok-ink'
                        : state === 'wrong'
                          ? 'border-mc-bad bg-mc-bad/10 text-mc-bad'
                          : 'border-mc-line bg-mc-surface opacity-50'
                  }`}
                >
                  {/* A key to press is shown only where the choice does not name its own. */}
                  {keys && !keys.byNote && (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-mc-line bg-mc-bg font-mc-serif text-[1.3rem] text-mc-ink" aria-hidden="true">
                      {ANSWER_KEYS[i].name}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">{choice}</span>
                  {state === 'right' && <Icon.Check size={24} />}
                  {state === 'wrong' && <Icon.Close size={24} />}
                </button>
              );
            })}
          </div>
          {answered && step.explain && (
            <p className="mc-fade-up mt-5 text-[1.45rem] leading-normal text-mc-ink/85">
              {picked === step.answer ? 'Right. ' : 'Not quite. '}
              {step.explain}
            </p>
          )}
        </div>
      </div>
      <StepFoot onNext={onNext} disabled={!answered} pedal={pedal} />
    </div>
  );
}

function Complete({ lesson, onDone }: { lesson: Lesson; onDone: (then?: Activity) => void }) {
  const hints = useHints();
  const { label, session } = useOnward();
  const lessons = usePiano((s) => s.lessons);
  const pieces = usePiano((s) => s.pieces);
  // Opened by itself, a finished lesson still leads somewhere: to the piece it brought, or to the lesson after it.
  const follow = useMemo<{ label: string; to: Activity } | null>(() => {
    if (session) return null;
    const piece = lesson.pieces?.find((id) => !pieces[id]?.learned);
    if (piece) return { label: `Practise ${getPiece(piece).title}`, to: { kind: 'piece', id: piece } };
    const order = lessonOrder();
    const after = order.slice(order.indexOf(lesson.id) + 1).find((id) => !lessons[id]?.done);
    return after ? { label: `Next lesson: ${getLesson(after).title}`, to: { kind: 'lesson', id: after } } : null;
  }, [lesson, lessons, pieces, session]);
  const onward = useCallback(() => onDone(follow?.to), [follow, onDone]);
  useRemote({ primary: onward, pedal: true });
  // The screen that closes a lesson is there to be seen. A second press hard on the first does not take it away.
  useQuietRemote();
  useEffect(() => {
    instrument.chime();
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
        <Icon.Check size={44} />
      </div>
      <div className="mc-fade-up">
        <div className="text-[1.1rem] font-semibold uppercase tracking-widest text-mc-muted">Lesson complete</div>
        <h2 className="mt-2 font-mc-serif text-5xl">{lesson.title}</h2>
      </div>
      {(lesson.pieces?.length || lesson.cards?.length) && (
        <div className="mc-fade-up max-w-2xl space-y-2 text-[1.3rem] text-mc-muted">
          {lesson.pieces && lesson.pieces.length > 0 && (
            <p>
              Added to your practice: <strong className="text-mc-ink">{lesson.pieces.map((id) => getPiece(id).title).join(', ')}</strong>.
            </p>
          )}
          {lesson.cards && lesson.cards.length > 0 && <p>{lesson.cards.length === 1 ? 'One new note joins' : `${lesson.cards.length} new notes join`} your daily reading review.</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {session ? (
          // After the last part there is nothing left to stop before.
          session.next && (
            <Button variant="ghost" size="lg" onClick={session.stop}>
              Stop for today
            </Button>
          )
        ) : (
          follow && (
            <Button variant="ghost" size="lg" onClick={() => onDone()}>
              Done
            </Button>
          )
        )}
        <Button size="lg" onClick={onward} className="min-w-[260px]" hint={hints.onward}>
          {follow ? follow.label : label}
        </Button>
      </div>
    </div>
  );
}

export default function LessonPlayer({ lessonId, onClose }: { lessonId: string; onClose: (completed: boolean, then?: Activity) => void }) {
  const lesson = useMemo(() => getLesson(lessonId), [lessonId]);
  const stored = usePiano((s) => s.lessons[lessonId]);
  const setLessonStep = usePiano((s) => s.setLessonStep);
  const completeLesson = usePiano((s) => s.completeLesson);
  const addCards = usePiano((s) => s.addCards);
  // A lesson left part way opens where it was left. So does one marked as known and then opened to look through.
  const resumable = stored && (!stored.done || stored.skipped);
  const [index, setIndex] = useState(() => (resumable ? Math.min(stored.step, lesson.steps.length - 1) : 0));
  const [finished, setFinished] = useState(false);
  useWakeLock(true);
  usePracticeTimer();

  const indexRef = useRef(index);
  indexRef.current = index;

  const lastNext = useRef(0);
  const quiet = useRef(0);
  const next = useCallback((auto?: boolean) => {
    const now = performance.now();
    if (auto === true) {
      // The lesson has moved on by itself. A press that was already on its way is not a wish to skip what comes next.
      quiet.current = now + QUIET_AFTER_AUTO;
      quietRemote(QUIET_AFTER_AUTO);
    } else {
      if (now < quiet.current) return;
      // Two quick taps on Continue are one wish to go on, not two.
      if (now - lastNext.current < 400) return;
    }
    lastNext.current = now;
    const n = indexRef.current + 1;
    if (n >= lesson.steps.length) {
      setFinished(true);
      completeLesson(lessonId);
      if (lesson.cards) addCards(lesson.cards);
      return;
    }
    indexRef.current = n;
    setLessonStep(lessonId, n);
    setIndex(n);
  }, [addCards, completeLesson, lesson, lessonId, setLessonStep]);

  /**
   * Go straight to any step, back or ahead. Nothing in a lesson is locked.
   * Looking ahead does not move the place the lesson is kept at: only going
   * on from a step does.
   */
  const jump = useCallback(
    (to: number) => {
      const n = Math.max(0, Math.min(lesson.steps.length - 1, to));
      indexRef.current = n;
      setIndex(n);
    },
    [lesson.steps.length],
  );
  const onward = useCallback(() => next(), [next]);
  const moveOn = useCallback(() => next(true), [next]);
  const { session } = useOnward();
  const back = useCallback(() => jump(indexRef.current - 1), [jump]);
  const step = lesson.steps[index];
  // How far the lesson has got. Turning back to look at something does not lose the place.
  const reached = Math.max(index, resumable ? stored.step : 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        {/* On the closing screen of a part of the day's session, closing means stopping for today. Going on has its own button. */}
        <IconButton label="Close lesson" onClick={() => (finished && session ? session.stop() : onClose(finished))}>
          <Icon.Close />
        </IconButton>
        <div className="max-w-[15rem] shrink-0 truncate text-[1.05rem] font-semibold text-mc-ink">{lesson.title}</div>
        {/* One mark for each step. Where the learner is, what is behind, what is ahead, and a way to any of them. */}
        <nav className="flex min-w-0 flex-1 items-center gap-1 px-2" aria-label="Steps of this lesson">
          {lesson.steps.map((s, i) => {
            const state = finished ? 'done' : i === index ? 'now' : i < reached ? 'done' : 'todo';
            return (
              <button
                key={i}
                onClick={() => !finished && jump(i)}
                aria-label={`Step ${i + 1} of ${lesson.steps.length}${state === 'now' ? ', this one' : ''}`}
                aria-current={state === 'now' ? 'step' : undefined}
                className="group flex h-11 min-w-0 flex-1 items-center"
              >
                <span
                  className={`block w-full rounded-full transition-all ${
                    state === 'now' ? 'h-2.5 bg-mc-ink' : state === 'done' ? 'h-1.5 bg-mc-ok' : 'h-1.5 bg-mc-line group-active:bg-mc-muted'
                  }`}
                />
              </button>
            );
          })}
        </nav>
        {!finished && (
          <>
            <span className="shrink-0 text-[1.1rem] tabular-nums text-mc-ink/75">
              {index + 1} of {lesson.steps.length}
            </span>
            <IconButton label="Previous step" onClick={back} disabled={index === 0} className="disabled:opacity-30">
              <Icon.Left size={22} />
            </IconButton>
            <IconButton label="Next step" onClick={onward}>
              <Icon.Right size={22} />
            </IconButton>
          </>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {finished ? (
          <Complete lesson={lesson} onDone={(then) => onClose(true, then)} />
        ) : (
          <BackContext.Provider value={index > 0 ? back : null}>
            <StepView key={`${lessonId}-${index}`} step={step} onNext={onward} onAuto={moveOn} />
          </BackContext.Provider>
        )}
      </div>
    </div>
  );
}

export function StepView({ step, onNext, onAuto }: { step: Step; onNext: () => void; /** The step has finished and moves on by itself. */ onAuto: () => void }) {
  switch (step.kind) {
    case 'say':
      return <SayStep step={step} onNext={onNext} />;
    case 'check':
      return <CheckStep step={step} onNext={onNext} />;
    case 'listen':
      return <ListenStep step={step} onNext={onNext} onAuto={onAuto} />;
    case 'play':
      return <PlayStep step={step} onNext={onNext} onAuto={onAuto} />;
    case 'echo':
      return <EchoStep step={step} onNext={onNext} onAuto={onAuto} />;
    case 'find':
      return <FindStep step={step} onNext={onNext} onAuto={onAuto} />;
    case 'quiz':
      return <QuizStep step={step} onNext={onNext} />;
  }
}
