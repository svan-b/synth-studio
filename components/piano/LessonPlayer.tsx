'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { getLesson, getPiece, resolveMusic } from '@/lib/piano/content/catalog';
import type { Lesson, Step } from '@/lib/piano/content/types';
import type { FlowResult } from '@/lib/piano/engine/flow';
import { noteBus } from '@/lib/piano/input/bus';
import { isRemoteKey } from '@/lib/piano/input/hub';
import { usePiano } from '@/lib/piano/learn/store';
import { pitchClass } from '@/lib/piano/music/theory';
import FigureView from './Figures';
import { useInputMode, usePracticeTimer, useRemote, useWakeLock } from './hooks';
import { Keyboard, flashKey } from './Keyboard';
import PlaySurface from './PlaySurface';
import { Button, Icon, IconButton, Pill, ProgressBar, Prose } from './ui';

type StepOf<K extends Step['kind']> = Extract<Step, { kind: K }>;

function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-2xl border border-mc-line">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-mc-muted" onClick={() => setOpen((o) => !o)}>
        <Icon.Info size={18} />
        Why it is taught this way
        <span className="ml-auto text-xs">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <p className="px-4 pb-4 text-[15px] leading-relaxed text-mc-muted">{text}</p>}
    </div>
  );
}

/** A column of text with a button at the foot. */
function TextStep({ title, children, onNext, nextLabel = 'Continue' }: { title?: string; children: ReactNode; onNext: () => void; nextLabel?: string }) {
  const mode = useInputMode();
  useRemote({ primary: onNext });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mc-scroll min-h-0 flex-1">
        <div className="mc-fade-up mx-auto w-full max-w-2xl px-8 py-8">
          {title && <h2 className="mb-4 font-mc-serif text-[2rem] leading-tight">{title}</h2>}
          {children}
        </div>
      </div>
      <div className="flex shrink-0 justify-center px-8 pb-6 pt-3">
        <Button size="lg" onClick={onNext} hint={mode === 'midi' ? 'or the top key' : undefined} className="min-w-[220px]">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function SayStep({ step, onNext }: { step: StepOf<'say'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} onNext={onNext}>
      <Prose text={step.text} className="text-[1.2rem] leading-relaxed text-mc-muted" />
      {step.figure && (
        <div className="mt-6">
          <FigureView figure={step.figure} />
        </div>
      )}
      {step.why && <Why text={step.why} />}
    </TextStep>
  );
}

function CheckStep({ step, onNext }: { step: StepOf<'check'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} onNext={onNext} nextLabel="I am set">
      {step.text && <Prose text={step.text} className="mb-5 text-[1.2rem] leading-relaxed text-mc-muted" />}
      <ul className="space-y-3">
        {step.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-mc-surface px-4 py-3 text-[1.1rem] leading-snug">
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
      <div className={`min-w-0 flex-1 text-[1.15rem] leading-snug ${tone === 'ok' ? 'text-mc-ok' : tone === 'hint' ? 'text-mc-hint' : 'text-mc-muted'}`}>
        <Prose text={text} />
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function ListenStep({ step, onNext }: { step: StepOf<'listen'>; onNext: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const mode = useInputMode();
  const again = useCallback(() => {
    setDone(false);
    setRun((r) => r + 1);
  }, []);
  useRemote({ primary: onNext, secondary: again });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={step.text}>
        <Button variant="soft" size="sm" onClick={again} icon={<Icon.Repeat size={16} />}>
          Again
        </Button>
        <Button size="sm" onClick={onNext} className={done ? 'mc-pulse' : ''} hint={mode === 'midi' ? 'top key' : undefined}>
          {done ? 'My turn' : 'Skip'}
        </Button>
      </Brief>
      <div className="min-h-0 flex-1">
        <PlaySurface score={score} hands={step.hands} mode="listen" display={step.display ?? 'staff'} runId={run} onDone={() => setDone(true)} />
      </div>
    </div>
  );
}

function describe(result: FlowResult): string {
  if (result.mode === 'wait') {
    if (result.clean) return 'Every note right the first time.';
    return `${result.correctNotes} of ${result.totalNotes} right the first time.`;
  }
  const pct = Math.round(result.accuracy * 100);
  const timing = result.onTime >= 0.8 ? 'well in time' : result.biasMs > 25 ? 'a little behind the beat' : result.biasMs < -25 ? 'a little ahead of the beat' : 'a bit uneven';
  return `${pct} percent of the notes, ${timing}.`;
}

function PlayStep({ step, onNext }: { step: StepOf<'play'>; onNext: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const mode = step.mode ?? 'wait';
  const need = step.passes ?? 1;
  const [run, setRun] = useState(0);
  const [have, setHave] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const inputMode = useInputMode();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const again = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVerdict(null);
    setRun((r) => r + 1);
  }, []);

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (!result) return;
      let ok = mode === 'wait' ? result.accuracy >= 0.6 : result.accuracy >= 0.7;
      let text = describe(result);
      if (ok && step.touch && result.velocity !== null) {
        if (step.touch === 'soft' && result.velocity > 0.45) {
          ok = false;
          text = 'Right notes, but louder than soft. Let the keys down gently.';
        } else if (step.touch === 'loud' && result.velocity < 0.6) {
          ok = false;
          text = 'Right notes, but not yet full. Let the weight of your arm fall into the keys.';
        }
      }
      if (ok) {
        const total = have + 1;
        setHave(total);
        if (total >= need) {
          setVerdict({ ok: true, text });
          piano.chime();
          timer.current = setTimeout(onNext, 1700);
        } else {
          setVerdict({ ok: true, text: `${text} Once more to make it stick.` });
          timer.current = setTimeout(again, 1700);
        }
      } else {
        setHave(0);
        setVerdict({
          ok: false,
          text: mode === 'wait' ? `${text} Go slower and look at each note before you play it.` : `${text} Try again and keep going through any slip.`,
        });
      }
    },
    [again, have, mode, need, onNext, step.touch],
  );

  useRemote({ primary: verdict && !verdict.ok ? again : verdict ? onNext : undefined, secondary: again });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={verdict ? verdict.text : step.text} tone={verdict ? (verdict.ok ? 'ok' : 'hint') : undefined}>
        {need > 1 && (
          <Pill tone={have > 0 ? 'ok' : 'muted'}>
            {have} of {need}
          </Pill>
        )}
        {verdict && !verdict.ok ? (
          <>
            <Button variant="ghost" size="sm" onClick={onNext}>
              Move on
            </Button>
            <Button size="sm" onClick={again} hint={inputMode === 'midi' ? 'top key' : undefined} icon={<Icon.Repeat size={16} />}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <IconButton label="Start again" onClick={again}>
              <Icon.Repeat size={20} />
            </IconButton>
            <Button variant="ghost" size="sm" onClick={onNext}>
              Skip
            </Button>
          </>
        )}
      </Brief>
      {step.why && !verdict && (
        <div className="px-7">
          <details className="text-sm text-mc-muted">
            <summary className="cursor-pointer font-semibold">Why it is taught this way</summary>
            <p className="mt-1 max-w-3xl leading-relaxed">{step.why}</p>
          </details>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          hands={step.hands}
          mode={mode}
          tempoPct={step.tempoPct ?? 100}
          display={step.display ?? 'staff'}
          hints={step.hints ?? 'delay'}
          fingering={step.fingering ?? true}
          names={step.names ?? false}
          anyKey={step.anyKey}
          contourLabel={step.anyKey ? 'none' : 'finger'}
          runId={run}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function EchoStep({ step, onNext }: { step: StepOf<'echo'>; onNext: () => void }) {
  const scores = useMemo(
    () => step.motifs.map((m) => resolveMusic(step.hand === 'L' ? { lh: m, key: step.key, tempo: 88 } : { rh: m, key: step.key, tempo: 88 })),
    [step],
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'play'>('listen');
  const [run, setRun] = useState(0);
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (index + 1 >= scores.length) {
      onNext();
      return;
    }
    setIndex((i) => i + 1);
    setTries(0);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, [index, onNext, scores.length]);

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (phase === 'listen') {
        timer.current = setTimeout(() => {
          setPhase('play');
          setRun((r) => r + 1);
        }, 350);
        return;
      }
      if (!result) return;
      if (result.clean) {
        setNote({ ok: true, text: 'Yes, that is it.' });
        timer.current = setTimeout(advance, 1100);
      } else if (tries < 1) {
        setTries((t) => t + 1);
        setNote({ ok: false, text: 'Not quite. Listen once more.' });
        timer.current = setTimeout(hear, 1300);
      } else {
        setNote({ ok: false, text: 'You found it in the end. On to the next.' });
        timer.current = setTimeout(advance, 1500);
      }
    },
    [advance, hear, phase, tries],
  );

  useRemote({ primary: advance, secondary: hear });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={note ? note.text : step.text} tone={note ? (note.ok ? 'ok' : 'hint') : undefined}>
        <Pill>
          {index + 1} of {scores.length}
        </Pill>
        <Button variant="soft" size="sm" onClick={hear} icon={<Icon.Ear size={16} />}>
          Hear it
        </Button>
        <Button variant="ghost" size="sm" onClick={advance}>
          Skip
        </Button>
      </Brief>
      {step.why && !note && phase === 'listen' && index === 0 && (
        <div className="px-7">
          <details className="text-sm text-mc-muted">
            <summary className="cursor-pointer font-semibold">Why it is taught this way</summary>
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
          runId={`${index}-${run}`}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function FindStep({ step, onNext }: { step: StepOf<'find'>; onNext: () => void }) {
  const mode = useInputMode();
  const kbRef = useRef<HTMLDivElement>(null);
  const found = useRef(new Set<number>());
  const [count, setCount] = useState(0);
  const low = step.low ?? 48;
  const high = step.high ?? 83;

  useEffect(() => {
    found.current = new Set();
    setCount(0);
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = noteBus.subscribe((ev) => {
      if (ev.type !== 'on' || finished) return;
      if (ev.source === 'midi' && isRemoteKey(ev.midi)) return;
      if (step.pitchClasses.includes(pitchClass(ev.midi))) {
        flashKey(kbRef.current, ev.midi, 'ok', 700);
        if (!found.current.has(ev.midi)) {
          found.current.add(ev.midi);
          setCount(found.current.size);
          if (found.current.size >= step.count) {
            finished = true;
            piano.chime();
            timer = setTimeout(onNext, 1000);
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
  }, [step, onNext]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 text-center">
        <Prose text={step.text} className="mc-fade-up max-w-2xl font-mc-serif text-[2rem] leading-snug text-mc-ink" />
        <div className="flex items-center gap-2">
          {Array.from({ length: step.count }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full transition-colors ${i < count ? 'bg-mc-ok' : 'bg-mc-line'}`} />
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onNext}>
          Skip
        </Button>
      </div>
      <div ref={kbRef} className="shrink-0">
        <Keyboard low={low} high={high} height={mode === 'touch' ? 200 : 130} labels={step.labels ?? 'none'} interactive={mode === 'touch'} sound={mode === 'touch'} />
      </div>
    </div>
  );
}

function QuizStep({ step, onNext }: { step: StepOf<'quiz'>; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const mode = useInputMode();
  const answered = picked !== null;
  useRemote({ primary: answered ? onNext : undefined });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mc-scroll min-h-0 flex-1">
        <div className="mc-fade-up mx-auto w-full max-w-2xl px-8 py-8">
          <h2 className="font-mc-serif text-[1.9rem] leading-tight">{step.question}</h2>
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left text-[1.15rem] font-medium transition-colors ${
                    state === 'idle'
                      ? 'border-mc-line bg-mc-surface active:bg-mc-raised'
                      : state === 'right'
                        ? 'border-mc-ok bg-mc-ok/10 text-mc-ok'
                        : state === 'wrong'
                          ? 'border-mc-bad bg-mc-bad/10 text-mc-bad'
                          : 'border-mc-line bg-mc-surface opacity-50'
                  }`}
                >
                  {choice}
                  {state === 'right' && <Icon.Check size={22} />}
                  {state === 'wrong' && <Icon.Close size={22} />}
                </button>
              );
            })}
          </div>
          {answered && step.explain && (
            <p className="mc-fade-up mt-5 text-[1.1rem] leading-relaxed text-mc-muted">
              {picked === step.answer ? 'Right. ' : 'Not quite. '}
              {step.explain}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 justify-center px-8 pb-6 pt-3">
        <Button size="lg" disabled={!answered} onClick={onNext} hint={mode === 'midi' && answered ? 'or the top key' : undefined} className="min-w-[220px]">
          Continue
        </Button>
      </div>
    </div>
  );
}

function Complete({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  useRemote({ primary: onDone });
  useEffect(() => {
    piano.chime();
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
        <Icon.Check size={44} />
      </div>
      <div className="mc-fade-up">
        <div className="text-sm font-semibold uppercase tracking-widest text-mc-muted">Lesson complete</div>
        <h2 className="mt-2 font-mc-serif text-4xl">{lesson.title}</h2>
      </div>
      {(lesson.pieces?.length || lesson.cards?.length) && (
        <div className="mc-fade-up max-w-xl space-y-2 text-[1.1rem] text-mc-muted">
          {lesson.pieces && lesson.pieces.length > 0 && (
            <p>
              Added to your practice: <strong className="text-mc-ink">{lesson.pieces.map((id) => getPiece(id).title).join(', ')}</strong>.
            </p>
          )}
          {lesson.cards && lesson.cards.length > 0 && <p>{lesson.cards.length === 1 ? 'One new note joins' : `${lesson.cards.length} new notes join`} your daily reading review.</p>}
        </div>
      )}
      <Button size="lg" onClick={onDone} className="min-w-[220px]">
        Done
      </Button>
    </div>
  );
}

export default function LessonPlayer({ lessonId, onClose }: { lessonId: string; onClose: (completed: boolean) => void }) {
  const lesson = useMemo(() => getLesson(lessonId), [lessonId]);
  const stored = usePiano((s) => s.lessons[lessonId]);
  const setLessonStep = usePiano((s) => s.setLessonStep);
  const completeLesson = usePiano((s) => s.completeLesson);
  const addCards = usePiano((s) => s.addCards);
  const logPractice = usePiano((s) => s.logPractice);
  const [index, setIndex] = useState(() => (stored && !stored.done ? Math.min(stored.step, lesson.steps.length - 1) : 0));
  const [finished, setFinished] = useState(false);
  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, 0, 1));

  const indexRef = useRef(index);
  indexRef.current = index;

  const next = useCallback(() => {
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

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const step = lesson.steps[index];

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close lesson" onClick={() => onClose(finished)}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <ProgressBar value={finished ? 1 : index / lesson.steps.length} tone="ok" />
        </div>
        <div className="w-40 truncate text-right text-sm font-medium text-mc-muted">{lesson.title}</div>
        {index > 0 && !finished && (
          <IconButton label="Previous step" onClick={back}>
            <Icon.Left size={20} />
          </IconButton>
        )}
      </header>
      <main className="min-h-0 flex-1">
        {finished ? (
          <Complete lesson={lesson} onDone={() => onClose(true)} />
        ) : (
          <StepView key={`${lessonId}-${index}`} step={step} onNext={next} />
        )}
      </main>
    </div>
  );
}

export function StepView({ step, onNext }: { step: Step; onNext: () => void }) {
  switch (step.kind) {
    case 'say':
      return <SayStep step={step} onNext={onNext} />;
    case 'check':
      return <CheckStep step={step} onNext={onNext} />;
    case 'listen':
      return <ListenStep step={step} onNext={onNext} />;
    case 'play':
      return <PlayStep step={step} onNext={onNext} />;
    case 'echo':
      return <EchoStep step={step} onNext={onNext} />;
    case 'find':
      return <FindStep step={step} onNext={onNext} />;
    case 'quiz':
      return <QuizStep step={step} onNext={onNext} />;
  }
}
