'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ControlValue, DeviceSpec, Lesson, LessonStep, MultipleChoice } from '@/types';
import { useStudioStore, stepKind, buildCheckState, getSpec, type StepSession } from '@/store/studio';
import { describeValue, pressTargetOf, pressesNeeded } from '@/lib/controls/mapping';
import { hub } from '@/lib/studio/hub';
import { getLessonLive, onLessonLive } from '@/lib/studio/lessonLive';
import { goTo, isStudioListen, studioAB } from '@/lib/studio/lessonRuntime';
import { onProducerLessons, producerLessonsNow } from '@/lib/studio/producerIndex';
import Scope from './Scope';
import { canShowMe, cancelShowMe, showMe } from './coachActions';
import { conceptLabel } from './concepts';

interface InstructionsProps {
  spec: DeviceSpec | null;
  onNextLesson?: () => void;
}

const KIND_LABEL: Record<string, string> = {
  do: 'Try it', patch: 'Patch it', info: 'Listen', predict: 'Predict, then test', listen: 'Compare by ear',
  match: 'Ear challenge', quiz: 'Recall', reflect: 'Explain it', challenge: 'Your turn',
};

const DAY = 86_400_000;

/**
 * The lesson coach. One step at a time, active not passive: predict before you
 * turn, compare by ear, recreate sounds from memory, explain in your own words.
 * Calm by design: one instruction, one action, details on request.
 */
export default function Instructions({ spec, onNextLesson }: InstructionsProps) {
  const lesson = useStudioStore(s => s.currentLesson);
  const currentStep = useStudioStore(s => s.currentStep);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const finished = useStudioStore(s => s.lessonFinished);
  const satisfied = useStudioStore(s => s.stepSatisfied);
  const sessionAll = useStudioStore(s => s.session);
  const focusMode = useStudioStore(s => s.focusMode);
  const snapshot = useStudioStore(s => s.lessonSnapshot);
  const instance = useStudioStore(s => s.lessonInstance);
  const lessonStudio = useStudioStore(s => s.lessonStudio);
  const backups = useStudioStore(s => s.lessonBackups);
  const store = useStudioStore.getState();
  // The Producer path's next lesson (its lessons load on demand, so the page doesn't know them)
  const [producer, setProducer] = useState(producerLessonsNow());
  useEffect(() => onProducerLessons(setProducer), []);
  const producerNext = useMemo(() => {
    if (!lesson || lesson.path !== 'producer' || !producer) return undefined;
    const sorted = [...producer].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const i = sorted.findIndex(l => l.id === lesson.id);
    return i >= 0 ? sorted[i + 1] : undefined;
  }, [lesson, producer]);
  const nextLesson = onNextLesson ?? (producerNext ? () => useStudioStore.getState().startLesson(producerNext) : undefined);
  const studioSaved = !!lessonStudio?.backupId && backups.some(b => b.id === lessonStudio.backupId);
  const [collapsed, setCollapsed] = useState(false);
  // Touch screens: the coach floats over the panel, on the side the learner picks
  const [side, setSide] = useState<'right' | 'left'>('right');
  const [showScope, setShowScope] = useState(true);
  const [showList, setShowList] = useState(false);
  const [restored, setRestored] = useState(false);
  const [announce, setAnnounce] = useState('');
  const session = sessionAll[currentStep];

  useEffect(() => setRestored(false), [lesson?.id]);

  // Autoplay demo phrase when a step asks for it
  useEffect(() => {
    if (!lesson || !instance) return;
    const st = lesson.steps[currentStep];
    if (st?.autoplay) hub.audition(st.instance ?? instance, null);
  }, [lesson, currentStep, instance]);

  // A demonstration never outlives its step
  useEffect(() => () => cancelShowMe(), [currentStep, lesson?.id]);

  // Screen readers: the new step, then whether it is done
  const step = lesson?.steps[currentStep];
  useEffect(() => {
    if (!lesson) return;
    if (finished) { setAnnounce(`Lesson complete: ${lesson.name}.`); return; }
    if (!step) return;
    const kind = stepKind(step);
    const lead = kind === 'predict' && step.predict ? step.predict.question : step.instruction;
    setAnnounce(`Step ${currentStep + 1} of ${lesson.steps.length}. ${KIND_LABEL[kind] ?? ''}. ${lead}`);
  }, [lesson, step, currentStep, finished]);
  useEffect(() => {
    if (satisfied && step && !finished) {
      const kind = stepKind(step);
      if (kind === 'do' || kind === 'patch' || kind === 'predict') setAnnounce('Done. Moving on.');
      else if (kind === 'challenge') setAnnounce('Every check passes. Press Next when you are ready.');
    }
  }, [satisfied, step, finished]);

  if (!isTeaching || !lesson) return null;
  const steps = lesson.steps;
  const target = step?.instance ?? instance ?? lesson.device;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`w-full lg:w-12 lg:h-full bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-2 text-teaching-current text-xs font-bold lg:[writing-mode:vertical-rl] coarse-lg:fixed coarse-lg:bottom-3 coarse-lg:z-30 coarse-lg:w-auto coarse-lg:h-auto coarse-lg:rounded-full coarse-lg:px-4 coarse-lg:py-3 coarse-lg:shadow-2xl coarse-lg:[writing-mode:horizontal-tb] ${side === 'left' ? 'coarse-lg:left-3' : 'coarse-lg:right-3'}`}
        aria-label={`Show the lesson coach: ${lesson.name}, ${finished ? 'done' : `step ${currentStep + 1} of ${steps.length}`}`}
      >
        {lesson.name} · {finished ? 'done' : `step ${currentStep + 1}/${steps.length}`} - show
      </button>
    );
  }

  return (
    <aside
      className={`w-full lg:w-[22rem] shrink-0 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 shadow-2xl lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] flex flex-col overflow-y-auto coarse-lg:fixed coarse-lg:top-auto coarse-lg:bottom-3 coarse-lg:z-30 coarse-lg:w-[20rem] coarse-lg:max-h-[58dvh] ${side === 'left' ? 'coarse-lg:left-3' : 'coarse-lg:right-3'}`}
      aria-label="Lesson coach"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-teaching-current font-bold text-sm uppercase tracking-wider">{lesson.name}</h3>
          {lesson.objective && <p className="text-[11px] text-gray-300 mt-1 leading-snug"><span className="text-gray-400">Goal:</span> {lesson.objective}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setSide(s => (s === 'right' ? 'left' : 'right'))} className="hidden coarse-lg:inline-block text-gray-400 hover:text-white px-2 py-1 text-sm rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300" aria-label="Move the lesson coach to the other side" title="Move to the other side">⇆</button>
          <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-white px-2 py-1 text-sm rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300" aria-label="Collapse lesson panel" title="Collapse">—</button>
          <button onClick={store.resetLesson} className="text-gray-400 hover:text-white px-2 py-1 text-sm rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300" aria-label="Stop lesson" title="Stop lesson">✕</button>
        </div>
      </div>

      {lesson.start?.studio && lessonStudio?.lesson === lesson.id && !finished && (
        <StudioBanner lesson={lesson} own={lessonStudio.own} saved={studioSaved} first={currentStep === 0} />
      )}

      <StepProgress lesson={lesson} current={currentStep} finished={finished} session={sessionAll} onJump={i => store.goToStep(i)} />

      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-gray-400">
          {finished ? 'All steps done' : <>Step {currentStep + 1} of {steps.length}{step ? <span className="text-gray-500"> · {KIND_LABEL[stepKind(step)]}</span> : null}</>}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Dim everything except what this step is about">
            <input type="checkbox" checked={focusMode} onChange={e => store.setFocusMode(e.target.checked)} className="accent-green-500" />
            Focus
          </label>
          <label className="flex items-center gap-1 text-[11px] text-gray-400" title="See the sound: waveform and spectrum">
            <input type="checkbox" checked={showScope} onChange={e => setShowScope(e.target.checked)} className="accent-green-500" />
            Scope
          </label>
        </div>
      </div>

      {showScope && <div className="mt-2"><Scope height={step?.scope === 'spectrum' ? 120 : 96} stepMode={finished ? undefined : step?.scope} /></div>}

      <div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

      {finished ? (
        <LessonSummary
          lesson={lesson}
          session={sessionAll}
          snapshot={lesson.start?.studio ? studioSaved && !restored : !!snapshot && !restored}
          studio={!!lesson.start?.studio}
          onFinish={() => store.completeLesson()}
          onNext={nextLesson ? () => { store.completeLesson(); nextLesson(); } : undefined}
          onRestore={() => { store.restoreLessonSnapshot(); setRestored(true); }}
        />
      ) : (
        step && (
          <StepCard
            key={`${lesson.id}:${currentStep}`}
            lesson={lesson}
            stepIndex={currentStep}
            step={step}
            spec={spec && spec.id === store.deviceOf(target) ? spec : getSpec(store.deviceOf(target)) ?? spec}
            satisfied={satisfied}
            session={session}
            instance={target}
            announce={setAnnounce}
          />
        )
      )}

      {!finished && (
        <div className="flex gap-2 mt-2">
          <button onClick={store.prevStep} disabled={currentStep === 0} className="flex-1 py-2 text-xs rounded bg-[#232323] text-gray-300 disabled:opacity-30 hover:bg-[#2f2f2f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">← Back</button>
          <button
            onClick={store.nextStep}
            className={`flex-1 py-2 text-xs rounded font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${satisfied ? 'bg-teaching-current text-black' : 'bg-[#232323] text-gray-300 hover:bg-[#2f2f2f]'}`}
          >
            {satisfied ? 'Next →' : 'Skip →'}
          </button>
        </div>
      )}

      <button onClick={() => setShowList(v => !v)} className="mt-3 text-[11px] text-gray-400 hover:text-gray-200 text-left" aria-expanded={showList}>
        {showList ? '▾' : '▸'} All steps
      </button>
      {showList && (
        <ol className="mt-1 space-y-1">
          {steps.map((s, i) => {
            const past = finished || i < currentStep;
            const cur = !finished && i === currentStep;
            const done = !!sessionAll[i]?.done;
            return (
              <li key={i}>
                <button
                  onClick={() => store.goToStep(i)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-1 rounded text-[11px] leading-snug ${cur ? 'bg-[#16220f] text-white' : past ? 'text-gray-400' : 'text-gray-300 hover:bg-[#1f1f1f]'}`}
                  aria-current={cur ? 'step' : undefined}
                >
                  <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${done ? 'bg-teaching-current text-black' : cur ? 'bg-teaching-target text-black' : past ? 'bg-[#3a3a3a] text-gray-300' : 'bg-[#333] text-gray-400'}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0">{s.instruction}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[10px] text-gray-500 mt-2 italic truncate">Source: {lesson.source}</p>
    </aside>
  );
}

// ---- progress --------------------------------------------------------------

/** One segment per step: done, current, still to come. Skipped steps show as gaps. */
function StepProgress({ lesson, current, finished, session, onJump }: { lesson: Lesson; current: number; finished: boolean; session: Record<number, StepSession>; onJump: (i: number) => void }) {
  const n = lesson.steps.length;
  const doneCount = lesson.steps.filter((_, i) => session[i]?.done).length;
  return (
    <div
      className="flex gap-[3px] mt-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={n}
      aria-valuenow={doneCount}
      aria-valuetext={finished ? `Lesson complete, ${doneCount} of ${n} steps done` : `Step ${current + 1} of ${n}, ${doneCount} done`}
    >
      {lesson.steps.map((s, i) => {
        const done = !!session[i]?.done;
        const cur = !finished && i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            tabIndex={-1}
            aria-hidden="true"
            title={`${i + 1}. ${KIND_LABEL[stepKind(s)]}`}
            className="flex-1 h-2 rounded-full transition-colors motion-reduce:transition-none"
            style={{
              background: done ? '#22c55e' : cur ? '#f59e0b' : i < current || finished ? '#4b5563' : '#262626',
              outline: cur ? '1px solid rgba(245,158,11,0.6)' : undefined,
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}

// ---- a step ------------------------------------------------------------------------

function StepCard({ lesson, stepIndex, step, spec, satisfied, session, instance, announce }: {
  lesson: Lesson;
  stepIndex: number;
  step: LessonStep;
  spec: DeviceSpec | null;
  satisfied: boolean;
  session: StepSession | undefined;
  instance: string;
  announce: (msg: string) => void;
}) {
  const store = useStudioStore.getState();
  const kind = stepKind(step);
  const [expanded, setExpanded] = useState(false);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const control = step.control && spec ? spec.controls[step.control] : undefined;
  const isPatch = !!(step.patchFrom && step.patchTo);
  const hints = step.hints ?? [];
  const hintsShown = session?.hints ?? 0;
  const press = pressTargetOf(step, control);
  const pressCount = session?.events?.[instance]?.[press ?? ''] ?? 0;
  const notes = session?.notes?.[instance] ?? [];
  // Live value of the step's control, for "now → target"
  const storedValue = useStudioStore(s => (step.control ? s.devices[instance]?.controlValues[step.control] : undefined));
  const liveValue = storedValue ?? (control && 'default' in control ? (control.default as ControlValue) : undefined);

  const jackLabel = (id?: string) => {
    if (!id || !spec?.patchBay) return id ?? '';
    const j = [...spec.patchBay.inputs, ...spec.patchBay.outputs].find(x => x.id === id);
    return j ? `${j.label} ${j.jackType === 'output' ? 'OUT' : 'IN'}` : id;
  };
  // A control's printed name; for an event (pads, trig keys) the button's own legend
  const labelOf = (id: string) => {
    const c = spec?.controls[id];
    if (c) return c.label;
    const el = hub.getModule(store.deviceOf(instance))?.layout.elements.find(e => e.kind === 'button' && e.event === id);
    if (el && el.kind === 'button') return el.labelText ?? el.capText ?? (el.control ? spec?.controls[el.control]?.label : undefined) ?? id;
    return id;
  };

  // Prediction gate: answer before the action counts
  const needsPrediction = kind === 'predict' && session?.answer === undefined;
  const showable = canShowMe(step) && (kind === 'do' || kind === 'patch' || kind === 'predict' || kind === 'challenge');
  // "Show me" is the last rung of the hint ladder (or the only one when a step has no hints)
  const showMeReady = showable && !satisfied && !needsPrediction && hintsShown >= hints.length;

  const runShowMe = async () => {
    setDemoRunning(true);
    setDemoMsg(null);
    const r = await showMe(step, instance, labelOf);
    setDemoRunning(false);
    if (r) { setDemoMsg(r.message); announce(r.message); }
  };

  const showHint = () => {
    store.showHint();
    const h = hints[hintsShown];
    if (h) announce(`Hint ${hintsShown + 1}: ${h}`);
  };

  return (
    <div className={`mt-3 p-3 rounded border-l-4 transition-colors motion-reduce:transition-none ${satisfied ? 'bg-[#0d1a0d] border-teaching-current' : 'bg-[#141414] border-teaching-target'}`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{KIND_LABEL[kind] ?? kind}</p>

      {kind === 'predict' && step.predict && (
        <>
          <MultipleChoiceView mc={step.predict} answer={session?.answer} onAnswer={store.answerStep} reveal={satisfied} predict />
          {!needsPrediction && <p className="text-[13px] text-white font-medium leading-snug mt-3">Now test it: {step.instruction}</p>}
        </>
      )}
      {kind !== 'predict' && <p className="text-[13px] text-white font-medium leading-snug">{step.instruction}</p>}

      {step.principle && !needsPrediction && (
        <p className="mt-2 text-[12px] text-yellow-200/90 italic leading-snug border-l-2 border-yellow-700/60 pl-2">{step.principle}</p>
      )}

      {/* What to do, and how far along it is */}
      {!needsPrediction && (kind === 'do' || kind === 'patch' || kind === 'predict') && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {isPatch ? (
            <span className="text-[11px] font-mono text-teaching-target">{jackLabel(step.patchFrom)} → {jackLabel(step.patchTo)}</span>
          ) : press ? (
            <span className="text-[11px] font-mono text-teaching-target">
              Press {labelOf(press)}{pressesNeeded(step) > 1 ? ` · ${Math.min(pressCount, pressesNeeded(step))} of ${pressesNeeded(step)}` : ''}
            </span>
          ) : step.control && step.targetValue !== undefined ? (
            <span className="text-[11px] font-mono text-teaching-target">
              {control?.label ?? step.control}: {liveValue !== undefined && !satisfied ? <span className="text-gray-400">{describeValue(control, liveValue as ControlValue)} → </span> : null}{describeValue(control, step.targetValue)}
            </span>
          ) : <span />}
          {satisfied && <span className="text-[11px] text-teaching-current font-bold">✓ Got it</span>}
        </div>
      )}
      {step.play && !needsPrediction && (
        <p className="mt-1 text-[11px] font-mono text-teaching-target">
          {step.play.notes?.length
            ? <>Play {step.play.notes.map(noteName).join(' – ')}{notes.length ? <span className="text-gray-400"> · you played {notes.slice(-step.play.notes.length).map(noteName).join(' ')}</span> : null}</>
            : <>Play {step.play.count ?? 1} note{(step.play.count ?? 1) > 1 ? 's' : ''} · {Math.min(notes.length, step.play.count ?? 1)} of {step.play.count ?? 1}</>}
        </p>
      )}

      {kind === 'listen' && step.listen && (
        <div className="mt-2 space-y-2">
          {isStudioListen(step) || step.listen.matchLoudness || lesson.start?.studio ? (
            <StudioABToggle lesson={lesson} stepIndex={stepIndex} labels={[step.listen.labels?.[0] ?? 'A', step.listen.labels?.[1] ?? 'B']} match={!!step.listen.matchLoudness} />
          ) : (
            <ABToggle
              instance={instance}
              a={step.listen.a}
              b={step.listen.b}
              labels={[step.listen.labels?.[0] ?? 'A', step.listen.labels?.[1] ?? 'B']}
            />
          )}
          {step.listen.question && <MultipleChoiceView mc={step.listen.question} answer={session?.answer} onAnswer={store.answerStep} reveal={session?.answer !== undefined} />}
        </div>
      )}

      {step.readout?.length ? <LiveReadout items={step.readout} /> : null}

      {lesson.device === 'studio' && !needsPrediction && (step.area || (step.instance && step.instance !== 'studio')) && (
        <WhereButton step={step} />
      )}

      {kind === 'match' && step.match && (
        <MatchView step={step} session={session} instance={instance} labelOf={labelOf} announce={announce} />
      )}

      {kind === 'quiz' && step.quiz && (
        <div className="mt-2"><MultipleChoiceView mc={step.quiz} answer={session?.answer} onAnswer={store.answerStep} reveal={session?.answer !== undefined} /></div>
      )}

      {kind === 'reflect' && step.reflect && (
        <ReflectView reflect={step.reflect} session={session} />
      )}

      {kind === 'challenge' && step.checklist && (
        <ChecklistView step={step} instance={instance} />
      )}

      {kind === 'info' && (
        <div className="mt-2 flex gap-2 items-center">
          <button onClick={() => hub.audition(instance, null)} className="px-3 py-1.5 rounded bg-[#1e2a36] text-sky-200 text-xs hover:bg-[#263646]">▶ Hear it</button>
          <span className="text-[11px] text-gray-400">Read, listen, then press Next.</span>
        </div>
      )}

      {/* Hint ladder - guidance that fades: vague first, specific last, then "show me" */}
      {!satisfied && !needsPrediction && (hints.length > 0 || showable) && (
        <div className="mt-2 space-y-1">
          {hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="text-[11px] text-sky-100 bg-sky-950/50 rounded px-2 py-1">Hint {i + 1}: {h}</p>
          ))}
          <div className="flex items-center gap-3">
            {hintsShown < hints.length && (
              <button onClick={showHint} className="text-[11px] text-sky-300 hover:text-sky-100 underline-offset-2 hover:underline">
                {hintsShown === 0 ? 'Need a hint?' : 'Another hint'} ({hints.length - hintsShown} left)
              </button>
            )}
            {showMeReady && kind !== 'challenge' && (
              <button onClick={runShowMe} disabled={demoRunning} className="text-[11px] text-amber-300 hover:text-amber-100 disabled:opacity-50 underline-offset-2 hover:underline">
                {demoRunning ? 'Watch the panel…' : 'Show me'}
              </button>
            )}
            {showMeReady && kind === 'challenge' && step.solution && (
              <button onClick={runShowMe} disabled={demoRunning} className="text-[11px] text-amber-300 hover:text-amber-100 disabled:opacity-50 underline-offset-2 hover:underline">
                {demoRunning ? 'Watch the panel…' : 'Show me one way'}
              </button>
            )}
          </div>
          {demoMsg && <p className="text-[11px] text-amber-100 bg-amber-950/40 rounded px-2 py-1">{demoMsg}</p>}
        </div>
      )}

      {(step.explanation || step.manualReference) && !needsPrediction && (
        <div className="mt-2">
          <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1" aria-expanded={expanded}>
            <span className="inline-block transition-transform motion-reduce:transition-none" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>▶</span>
            {expanded ? 'Less' : 'Why does this work?'}
          </button>
          {expanded && (
            <div className="mt-1.5 pl-3 border-l border-[#444] space-y-1">
              {step.explanation && <p className="text-[11px] text-gray-300 leading-relaxed">{step.explanation}</p>}
              {step.manualReference && <p className="text-[10px] text-gray-400 italic">📖 {step.manualReference}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(n: number) {
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

function MultipleChoiceView({ mc, answer, onAnswer, reveal, predict }: { mc: MultipleChoice; answer?: number; onAnswer: (i: number) => void; reveal: boolean; predict?: boolean }) {
  return (
    <div>
      <p className="text-[13px] text-white font-medium leading-snug">{mc.question}</p>
      <div className="mt-2 space-y-1.5" role="group" aria-label={predict ? 'Your prediction' : 'Your answer'}>
        {mc.options.map((opt, i) => {
          const chosen = answer === i;
          const correct = i === mc.answer;
          const show = reveal && answer !== undefined;
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              disabled={answer !== undefined}
              aria-pressed={chosen}
              className={`w-full text-left px-2.5 py-2 rounded text-[12px] border transition-colors motion-reduce:transition-none ${
                show && correct ? 'border-green-500 bg-green-950/50 text-green-100'
                  : show && chosen && !correct ? 'border-red-500 bg-red-950/40 text-red-100'
                  : chosen ? 'border-sky-500 bg-sky-950/40 text-sky-50'
                  : 'border-[#333] bg-[#1b1b1b] text-gray-200 hover:border-[#555]'
              }`}
            >
              <span className="inline-block w-4 font-bold">{show && correct ? '✓' : show && chosen ? '✗' : String.fromCharCode(65 + i)}</span> {opt}
            </button>
          );
        })}
      </div>
      {reveal && answer !== undefined && (
        <p className={`mt-2 text-[11px] leading-snug ${answer === mc.answer ? 'text-green-200' : 'text-orange-100'}`} role="status">
          {answer === mc.answer ? (predict ? 'You predicted it. ' : 'Right. ') : 'Not quite - and a wrong guess you checked sticks better than a right one you never made. '}
          {mc.explain}
        </p>
      )}
      {answer !== undefined && !reveal && <p className="mt-2 text-[11px] text-sky-200">Prediction locked in. Now do it, and listen.</p>}
    </div>
  );
}

// ---- A/B listening -----------------------------------------------------------------------

/**
 * Switch between two sounds instantly, on the same phrase. Short echoic memory is
 * the limit in ear training: fast A/B switching is how producers compare.
 */
function ABToggle({ instance, a, b, labels, patchesA }: {
  instance: string;
  a: Record<string, ControlValue> | null;
  b: Record<string, ControlValue> | null;
  labels: [string, string];
  patchesA?: { from: string; to: string }[];
}) {
  const [side, setSide] = useState<'a' | 'b' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); hub.stopAudition(); }, []);
  const play = (which: 'a' | 'b') => {
    if (timer.current) clearTimeout(timer.current);
    if (side === which) { hub.stopAudition(); setSide(null); return; }
    const ms = 3400;
    hub.audition(instance, which === 'a' ? a : b, which === 'a' && patchesA ? { patches: patchesA, ms } : { ms });
    setSide(which);
    timer.current = setTimeout(() => setSide(null), ms);
  };
  return (
    <div className="flex rounded overflow-hidden border border-[#2c3a48]" role="group" aria-label="Compare by ear">
      {(['a', 'b'] as const).map((k, i) => (
        <button
          key={k}
          onClick={() => play(k)}
          aria-pressed={side === k}
          className={`flex-1 py-2.5 font-bold text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
            side === k ? (k === 'a' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white') : k === 'a' ? 'bg-[#2a1e36] text-purple-100 hover:bg-[#35264a]' : 'bg-[#1e2a36] text-sky-100 hover:bg-[#263646]'
          } ${i === 1 ? 'border-l border-[#2c3a48]' : ''}`}
        >
          {side === k ? '■' : '▶'} {labels[i]}
        </button>
      ))}
    </div>
  );
}

/** Re-render on every live publish (meters, takes): a version counter for useSyncExternalStore */
let liveVersion = 0;
const subscribeLive = (cb: () => void) => onLessonLive(() => { liveVersion++; cb(); });
function useLessonLive() {
  useSyncExternalStore(subscribeLive, () => liveVersion, () => 0);
  return getLessonLive();
}

/**
 * Studio A/B (Lesson API v3): the whole studio plays while you switch sides - several
 * instruments, the master section or swing can differ. With loudness matching the louder
 * side is turned down after the meter, so you judge the sound, not the level.
 */
function StudioABToggle({ lesson, stepIndex, labels, match }: { lesson: Lesson; stepIndex: number; labels: [string, string]; match: boolean }) {
  const key = `${lesson.id}:${stepIndex}`;
  const info = useSyncExternalStore(
    cb => studioAB.subscribe(cb),
    () => JSON.stringify(studioAB.info(key)),
    () => '',
  );
  useEffect(() => () => studioAB.reset(), [key]);
  const parsed = info ? (JSON.parse(info) as ReturnType<typeof studioAB.info>) : null;
  const side = parsed?.side ?? null;
  const fmt = (g: number) => (Math.abs(g) < 0.05 ? '0.0' : g.toFixed(1));
  return (
    <div className="space-y-1">
      <div className="flex rounded overflow-hidden border border-[#2c3a48]" role="group" aria-label="Compare by ear">
        {(['a', 'b'] as const).map((k, i) => (
          <button
            key={k}
            onClick={() => studioAB.play(lesson, stepIndex, k)}
            aria-pressed={side === k}
            className={`flex-1 py-2.5 font-bold text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
              side === k ? (k === 'a' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white') : k === 'a' ? 'bg-[#2a1e36] text-purple-100 hover:bg-[#35264a]' : 'bg-[#1e2a36] text-sky-100 hover:bg-[#263646]'
            } ${i === 1 ? 'border-l border-[#2c3a48]' : ''}`}
          >
            {side === k ? '■' : '▶'} {labels[i]}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 leading-snug" aria-live="polite">
        {side ? 'The whole studio plays. Switch sides on the same phrase; press the lit side again to stop.' : 'Press A or B: the studio starts playing, and you can switch sides without stopping.'}
        {match && parsed && (parsed.lufs.a !== null || parsed.lufs.b !== null) && (
          <> Loudness matched: A {fmt(parsed.gainDb.a)} dB, B {fmt(parsed.gainDb.b)} dB.</>
        )}
        {match && parsed && parsed.lufs.a === null && parsed.lufs.b === null && <> Both sides will play at the same loudness.</>}
      </p>
    </div>
  );
}

const fmtNum = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));

/** Live numbers for meter steps: the same ones the checks read */
function LiveReadout({ items }: { items: NonNullable<LessonStep['readout']> }) {
  const live = useLessonLive();
  const m = live.meters?.master;
  const rows: { k: string; v: string; title: string }[] = [];
  if (!live.meters?.live || !m) {
    return <p className="mt-2 text-[11px] text-gray-400">Meters start when the audio does: press ▶.</p>;
  }
  if (items.includes('loudness')) {
    rows.push({ k: 'M / S', v: `${fmtNum(m.lufsM)} / ${fmtNum(m.lufsS)}`, title: 'Momentary (0.4 s) and short-term (3 s) loudness, LUFS' });
    rows.push({ k: 'I', v: `${fmtNum(m.lufsI)} LUFS`, title: 'Integrated loudness since Play (gated, BS.1770-4)' });
    rows.push({ k: 'measured', v: `${Math.floor(m.measuredSec / 60)}:${String(Math.floor(m.measuredSec % 60)).padStart(2, '0')}${m.fromStart ? ' from bar 1' : ''}`, title: 'Time measured since Play' });
  }
  if (items.includes('peaks')) {
    rows.push({ k: 'peak', v: `${fmtNum(m.peakDb)} dBFS`, title: 'Sample peak into the limiter, the last 3 s' });
    rows.push({ k: 'true peak', v: `${fmtNum(m.maxTruePeakDb)} dBTP`, title: 'Highest true peak since Play' });
  }
  if (items.includes('limiter')) {
    rows.push({ k: 'limiter', v: `${fmtNum(m.grDb)} dB now, ${fmtNum(m.maxGrDb)} max`, title: 'Limiter gain reduction: the last second, and the most since Play' });
  }
  const channels = items.includes('channels')
    ? Object.entries(live.meters.channels).filter(([k]) => /:[1-4ab]$/.test(k) && Number.isFinite(live.meters!.channels[k].peak) && live.meters!.channels[k].peak > -60)
    : [];
  return (
    <div className="mt-2 rounded bg-black/40 border border-[#2a2a2a] px-2 py-1.5" role="status" aria-label="Live meters">
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-[11px] tabular-nums font-mono">
          {rows.map(r => (
            <div key={r.k} className="contents" title={r.title}>
              <dt className="text-gray-400">{r.k}</dt>
              <dd className="text-gray-100">{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {channels.length > 0 && (
        <p className="text-[11px] tabular-nums font-mono text-gray-200 mt-0.5">
          {channels.map(([k, c]) => `ch ${k.split(':')[1].toUpperCase()} ${c.peak >= 0 ? '+' : ''}${fmtNum(c.peak)}${c.pk ? ' PK' : ''}`).join(' · ')}
          <span className="text-gray-500"> dBu</span>
        </p>
      )}
    </div>
  );
}

/** Take the learner to the instrument or the part of the studio a step is about */
function WhereButton({ step }: { step: LessonStep }) {
  const rack = useStudioStore(s => s.studio.rack);
  const area = step.area;
  let label = '';
  if (area === 'mixer') label = 'Show the mixer';
  else if (area === 'master') label = 'Show the master';
  else if (area === 'arranger') label = 'Show the song arranger';
  else if (area === 'rack') label = 'Show the rack';
  else if (area === 'transport') label = '';
  else if (step.instance) {
    const r = rack.find(x => x.id === step.instance || x.device === step.instance);
    const name = r ? r.label ?? getSpec(r.device)?.name ?? r.id : step.instance;
    label = `Open ${name}`;
  }
  if (!label) return null;
  return (
    <button onClick={() => goTo({ instance: area ? undefined : step.instance, area })} className="mt-2 text-[11px] text-sky-300 hover:text-sky-100 underline-offset-2 hover:underline">
      {label} ↗
    </button>
  );
}

/** A lesson that loaded its own studio: say so, and that the learner's studio is safe */
function StudioBanner({ lesson, own, saved, first }: { lesson: Lesson; own: boolean; saved: boolean; first: boolean }) {
  const ownText = lesson.start?.studio?.ownStudio;
  if (own) {
    return <p className="mt-2 text-[11px] text-sky-200 bg-sky-950/40 rounded px-2 py-1">You are doing this lesson in your own studio.</p>;
  }
  return (
    <div className="mt-2 text-[11px] text-gray-300 bg-[#151d24] border border-[#24313d] rounded px-2 py-1.5 leading-snug">
      <p>
        This lesson set up its own studio.{saved ? ' Yours is saved: bring it back at the end, or any time from Lessons.' : ''}
      </p>
      {first && ownText && (
        <button onClick={() => useStudioStore.getState().useOwnStudio()} className="mt-1 text-sky-300 hover:text-sky-100 underline underline-offset-2">
          Use my own studio instead ({ownText})
        </button>
      )}
    </div>
  );
}

function MatchView({ step, session, instance, labelOf, announce }: {
  step: LessonStep;
  session: StepSession | undefined;
  instance: string;
  labelOf: (id: string) => string;
  announce: (msg: string) => void;
}) {
  const store = useStudioStore.getState();
  const m = step.match!;
  const attempts = session?.attempts ?? 0;
  const result = session?.match;
  const solved = (result?.score ?? 0) >= 1;
  const n = m.controls.length;
  const right = result ? Math.round(result.score * n) : 0;

  // Feedback fades in: a count, then which control, then which way and how far
  const feedback = (): string => {
    if (!result) return '';
    if (solved) return attempts > 1 ? `Matched by ear in ${attempts} tries. That is the core skill of sound design.` : 'Matched by ear, first try. That is a trained ear.';
    if (attempts < 2) return `${right} of ${n} right. Flip between A and B again and listen for one thing at a time.`;
    if (attempts < 3) return `${right} of ${n} right. Still off: ${result.off.map(o => labelOf(o.id)).join(', ')}.`;
    return `${right} of ${n} right. ` + result.off.map(o => o.dir === 'different'
      ? `${labelOf(o.id)}: try another setting`
      : `${labelOf(o.id)}: go ${o.dir}${o.far ? ', a lot' : ', a little'}`).join('. ') + '.';
  };
  const lastAnnounced = useRef(0);
  useEffect(() => {
    if (result && attempts !== lastAnnounced.current) { lastAnnounced.current = attempts; announce(feedback()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, result]);

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[11px] text-gray-300">
        Adjust {m.controls.map(labelOf).join(', ')} until yours sounds like the target. Everything else is already set.
      </p>
      <ABToggle instance={instance} a={m.target} b={null} labels={['A · Target', 'B · Yours']} patchesA={m.patches} />
      {!solved && (
        <button onClick={store.checkMatch} className="w-full py-2 rounded bg-teaching-target text-black font-bold text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">
          Check my sound
        </button>
      )}
      {result && (
        <p className={`text-[11px] rounded px-2 py-1.5 ${solved ? 'bg-green-950/60 text-green-100' : 'bg-[#2a1d0e] text-orange-100'}`}>{feedback()}</p>
      )}
      {attempts >= 4 && !solved && (
        <button
          onClick={() => {
            const vals: Record<string, ControlValue> = {};
            m.controls.forEach(c => { vals[c] = m.target[c]; });
            store.markStepShown();
            store.setControlValues(instance, vals);
            setTimeout(store.checkMatch, 50);
          }}
          className="text-[11px] text-amber-300 underline"
        >
          Show me the answer
        </button>
      )}
    </div>
  );
}

function ReflectView({ reflect, session }: { reflect: { prompt: string; model: string }; session: StepSession | undefined }) {
  const store = useStudioStore.getState();
  const [text, setText] = useState('');
  const revealed = session?.revealed;
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[12px] text-gray-200">{reflect.prompt}</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="In your own words…"
        className="w-full bg-[#111] border border-[#333] rounded p-2 text-[12px] text-white"
        aria-label="Your explanation"
      />
      {!revealed ? (
        <button onClick={store.revealStep} className="w-full py-1.5 rounded bg-[#262626] text-gray-200 text-xs hover:bg-[#2f2f2f]">
          {text.trim() ? 'Compare with a model answer' : 'Write a sentence first, or peek at a model answer'}
        </button>
      ) : (
        <>
          <p className="text-[12px] text-green-100 bg-green-950/40 rounded p-2 leading-snug">{reflect.model}</p>
          <p className="text-[11px] text-gray-300">How close were you?</p>
          <div className="flex gap-1" role="group" aria-label="Rate your explanation">
            {(['got-it', 'partly', 'not-yet'] as const).map(r => (
              <button
                key={r}
                onClick={() => store.rateReflection(r)}
                aria-pressed={session?.rating === r}
                className={`flex-1 py-1.5 rounded text-[11px] ${session?.rating === r ? 'bg-teaching-current text-black font-bold' : 'bg-[#232323] text-gray-200'}`}
              >
                {r === 'got-it' ? 'Got it' : r === 'partly' ? 'Partly' : 'Not yet'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistView({ step, instance }: { step: LessonStep; instance: string }) {
  // Re-render on any store change so checks update live
  const devices = useStudioStore(s => s.devices);
  const studio = useStudioStore(s => s.studio);
  const session = useStudioStore(s => s.session[s.currentStep]);
  // Meters, takes and the song position change without a store change
  const live = useLessonLive();
  const status = useMemo(() => {
    const st = buildCheckState(instance, hub.getState(instance));
    return (step.checklist ?? []).map(c => {
      if (!c.check) return null;
      try { return c.check(st); } catch { return false; }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, studio, session, step, instance, live]);
  return (
    <ul className="mt-2 space-y-1">
      {(step.checklist ?? []).map((c, i) => (
        <li key={i} className={`flex items-start gap-2 text-[12px] ${status[i] ? 'text-green-200' : 'text-gray-200'}`}>
          <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${status[i] ? 'bg-green-600 border-green-500 text-black' : 'border-[#666]'}`} aria-hidden="true">
            {status[i] ? '✓' : status[i] === null ? '·' : ''}
          </span>
          <span>{c.text}<span className="sr-only">{status[i] ? ' - done' : ' - not yet'}</span></span>
        </li>
      ))}
    </ul>
  );
}

// ---- end of lesson -------------------------------------------------------------------------

/** What the learner did, honestly - and what comes back in Daily Review */
export function lessonStats(lesson: Lesson, session: Record<number, StepSession>) {
  let predicted = 0, predictedRight = 0, quizzed = 0, quizzedRight = 0, matched = 0, matches = 0, matchTries = 0;
  let challenges = 0, challengesDone = 0, shown = 0, hints = 0, skipped = 0;
  const ratings: string[] = [];
  lesson.steps.forEach((st, i) => {
    const s = session[i] ?? {};
    const kind = stepKind(st);
    if (s.shown) shown++;
    hints += s.hints ?? 0;
    if (!s.done && kind !== 'info') skipped++;
    if (kind === 'predict' && st.predict && s.answer !== undefined) { predicted++; if (s.answer === st.predict.answer) predictedRight++; }
    const mc = kind === 'quiz' ? st.quiz : kind === 'listen' ? st.listen?.question : undefined;
    if (mc && s.answer !== undefined) { quizzed++; if (s.answer === mc.answer) quizzedRight++; }
    if (kind === 'match') { matches++; if ((s.match?.score ?? 0) >= 1) { matched++; matchTries += s.attempts ?? 1; } }
    if (kind === 'challenge') { challenges++; if (s.done) challengesDone++; }
    if (kind === 'reflect' && s.rating) ratings.push(s.rating);
  });
  const reviewCount = (lesson.review?.length ?? 0)
    + lesson.steps.filter(st => (stepKind(st) === 'quiz' && st.quiz) || (stepKind(st) === 'predict' && st.predict)).length;
  const missed = (predicted - predictedRight) + lesson.steps.filter((st, i) => stepKind(st) === 'quiz' && st.quiz && session[i]?.answer !== undefined && session[i]?.answer !== st.quiz.answer).length;
  return { predicted, predictedRight, quizzed, quizzedRight, matched, matches, matchTries, challenges, challengesDone, shown, hints, skipped, ratings, reviewCount, missed };
}

function LessonSummary({ lesson, session, snapshot, studio, onFinish, onNext, onRestore }: {
  lesson: Lesson;
  session: Record<number, StepSession>;
  snapshot: boolean;
  /** The lesson replaced the whole studio: restoring brings back the learner's studio */
  studio?: boolean;
  onFinish: () => void;
  onNext?: () => void;
  onRestore: () => void;
}) {
  const s = lessonStats(lesson, session);
  const tomorrow = new Date(Date.now() + DAY).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const rows: { label: string; value: string }[] = [];
  if (s.predicted) rows.push({ label: 'Predictions', value: `${s.predictedRight} of ${s.predicted} first guesses right` });
  if (s.quizzed) rows.push({ label: 'Quick checks', value: `${s.quizzedRight} of ${s.quizzed} recalled` });
  if (s.matches) rows.push({ label: 'Ear challenges', value: s.matched ? `${s.matched} of ${s.matches} matched by ear${s.matched ? ` (${s.matchTries} ${s.matchTries === 1 ? 'try' : 'tries'})` : ''}` : `not matched yet` });
  if (s.challenges) rows.push({ label: 'Your turn', value: `${s.challengesDone} of ${s.challenges} done` });
  if (s.ratings.length) rows.push({ label: 'Explained it', value: s.ratings.map(r => (r === 'got-it' ? 'got it' : r === 'partly' ? 'partly' : 'not yet')).join(', ') });
  if (s.hints || s.shown) rows.push({ label: 'Help used', value: [s.hints ? `${s.hints} hint${s.hints > 1 ? 's' : ''}` : '', s.shown ? `${s.shown} "show me"` : ''].filter(Boolean).join(', ') });
  const notYet = s.ratings.includes('not-yet') || s.skipped > 1;

  return (
    <div className="mt-3 p-3 bg-[#0d1a0d] border border-teaching-current rounded" role="region" aria-label="Lesson summary">
      <p className="text-sm text-teaching-current font-bold">✓ Lesson complete</p>
      {lesson.objective && <p className="text-[12px] text-gray-200 mt-1 leading-snug"><span className="text-gray-400">You can now:</span> {lesson.objective.replace(/^By the end you can\s*/i, '')}</p>}

      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-[11px]">
          {rows.map(r => (
            <div key={r.label} className="contents">
              <dt className="text-gray-400">{r.label}</dt>
              <dd className="text-gray-100">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {lesson.concepts && lesson.concepts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Concepts practised">
          {lesson.concepts.map(c => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2a1a] text-green-200">{conceptLabel(c)}</span>
          ))}
        </div>
      )}

      {s.reviewCount > 0 && (
        <p className="text-[11px] text-sky-200 mt-2 leading-snug">
          {s.reviewCount} question{s.reviewCount > 1 ? 's' : ''} from this lesson come back in Daily Review, starting {tomorrow}
          {s.missed ? ` - the ${s.missed === 1 ? 'one' : s.missed} you missed first` : ''}. Recalling them just as you start to forget is what makes them stick.
        </p>
      )}
      <p className="text-[11px] text-gray-300 mt-2 leading-snug">
        {notYet
          ? 'Worth a second run in a day or two: the steps that felt shaky will feel easy the second time.'
          : 'Now make it yours: change one thing at a time and listen. Say what each knob will do before you touch it.'}
      </p>
      <div className="flex flex-col gap-2 mt-3">
        <div className="flex gap-2">
          <button onClick={onFinish} className="flex-1 py-2 bg-teaching-current text-black font-bold rounded text-xs hover:brightness-110">Finish</button>
          {onNext && (
            <button onClick={onNext} className="flex-1 py-2 bg-[#2d2d2d] text-white font-bold rounded text-xs hover:bg-[#3a3a3a]">Next lesson →</button>
          )}
        </div>
        {snapshot && (
          <button onClick={onRestore} className="py-1.5 rounded text-[11px] bg-[#222] text-gray-200 hover:bg-[#2c2c2c]">
            {studio ? 'Bring back the studio I had before this lesson' : 'Restore the patch I had before this lesson'}
          </button>
        )}
        {snapshot && studio && (
          <p className="text-[10px] text-gray-400 leading-snug">This lesson&apos;s studio is kept as a copy too, under Lessons, so you can come back to it.</p>
        )}
      </div>
    </div>
  );
}
