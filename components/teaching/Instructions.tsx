'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DeviceSpec, LessonStep, MultipleChoice } from '@/types';
import { useStudioStore, stepKind, buildCheckState, getSpec } from '@/store/studio';
import { describeValue } from '@/lib/controls/mapping';
import { hub } from '@/lib/studio/hub';
import Scope from './Scope';

interface InstructionsProps {
  spec: DeviceSpec | null;
  onNextLesson?: () => void;
}

const CONCEPT_LABELS: Record<string, string> = {
  'oscillator-pitch': 'Pitch', 'oscillator-waveform': 'Waveforms', 'oscillator-sync': 'Hard sync',
  'frequency-modulation': 'FM', subharmonics: 'Subharmonics', noise: 'Noise', mixing: 'Mixing',
  'envelope-attack': 'Attack', 'envelope-decay': 'Decay', 'envelope-sustain': 'Sustain', 'envelope-release': 'Release',
  'envelope-shape': 'Envelope shape', 'filter-cutoff': 'Filter cutoff', 'filter-resonance': 'Resonance',
  'filter-type': 'Filter type', lfo: 'LFO', 'modulation-source': 'Mod sources', 'modulation-depth': 'Mod depth',
  'signal-routing': 'Patching', 'velocity-dynamics': 'Velocity', glide: 'Glide', 'timing-tempo': 'Tempo',
  'sequencer-pattern': 'Sequencing', polyrhythm: 'Polyrhythm', 'parameter-locks': 'Parameter locks',
  effects: 'Effects', equalization: 'EQ', 'dj-mixing': 'DJ mixing', 'gain-staging': 'Gain staging',
};

export function conceptLabel(c: string) {
  return CONCEPT_LABELS[c] ?? c;
}

const KIND_LABEL: Record<string, string> = {
  do: 'Try it', patch: 'Patch it', info: 'Listen', predict: 'Predict, then test', listen: 'Compare by ear',
  match: 'Ear challenge', quiz: 'Recall', reflect: 'Explain it', challenge: 'Your turn',
};

/**
 * The lesson coach. One step at a time, active not passive: predict before you
 * turn, compare by ear, recreate sounds from memory, explain in your own words.
 */
export default function Instructions({ spec, onNextLesson }: InstructionsProps) {
  const lesson = useStudioStore(s => s.currentLesson);
  const currentStep = useStudioStore(s => s.currentStep);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const finished = useStudioStore(s => s.lessonFinished);
  const satisfied = useStudioStore(s => s.stepSatisfied);
  const session = useStudioStore(s => s.session[s.currentStep]);
  const focusMode = useStudioStore(s => s.focusMode);
  const snapshot = useStudioStore(s => s.lessonSnapshot);
  const instance = useStudioStore(s => s.lessonInstance);
  const store = useStudioStore.getState();
  const [collapsed, setCollapsed] = useState(false);
  const [showScope, setShowScope] = useState(true);
  const [showList, setShowList] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => setRestored(false), [lesson?.id]);

  // Autoplay demo phrase when a step asks for it
  useEffect(() => {
    if (!lesson || !instance) return;
    const st = lesson.steps[currentStep];
    if (st?.autoplay) hub.audition(st.instance ?? instance, null);
  }, [lesson, currentStep, instance]);

  if (!isTeaching || !lesson) return null;
  const steps = lesson.steps;
  const step = steps[currentStep];
  const progress = finished ? 100 : (currentStep / steps.length) * 100;
  const target = step?.instance ?? instance ?? lesson.device;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full lg:w-12 lg:h-full bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-2 text-teaching-current text-xs font-bold lg:[writing-mode:vertical-rl]"
      >
        {lesson.name} · {finished ? 'done' : `step ${currentStep + 1}/${steps.length}`} - show
      </button>
    );
  }

  return (
    <aside
      className="w-full lg:w-[22rem] shrink-0 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 shadow-2xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col overflow-y-auto"
      aria-label="Lesson coach"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-teaching-current font-bold text-sm uppercase tracking-wider">{lesson.name}</h3>
          {lesson.objective && <p className="text-[11px] text-gray-300 mt-1 leading-snug"><span className="text-gray-500">Goal:</span> {lesson.objective}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setCollapsed(true)} className="text-hardware-label hover:text-white px-1.5 text-sm" aria-label="Collapse lesson panel" title="Collapse">—</button>
          <button onClick={store.resetLesson} className="text-hardware-label hover:text-white px-1.5 text-sm" aria-label="Stop lesson" title="Stop lesson">✕</button>
        </div>
      </div>

      <div className="relative overflow-hidden bg-[#1a1a1a] rounded-full w-full h-1.5 mt-3" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="absolute inset-y-0 left-0 bg-teaching-current transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] text-hardware-label">{finished ? 'All steps done' : `Step ${currentStep + 1} of ${steps.length}`}</p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-gray-400" title="Dim everything except what this step is about">
            <input type="checkbox" checked={focusMode} onChange={e => store.setFocusMode(e.target.checked)} className="accent-green-500" />
            Focus
          </label>
          <label className="flex items-center gap-1 text-[10px] text-gray-400" title="See the sound: waveform and spectrum">
            <input type="checkbox" checked={showScope} onChange={e => setShowScope(e.target.checked)} className="accent-green-500" />
            Scope
          </label>
        </div>
      </div>

      {showScope && <div className="mt-2"><Scope height={96} /></div>}

      <div aria-live="polite" className="sr-only">{finished ? 'Lesson complete' : step?.instruction}</div>

      {finished ? (
        <div className="mt-3 p-3 bg-[#0d1a0d] border border-teaching-current rounded">
          <p className="text-sm text-teaching-current font-bold text-center">✓ Lesson complete</p>
          {lesson.concepts && lesson.concepts.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-hardware-label uppercase tracking-wider mb-1">You practised</p>
              <div className="flex flex-wrap gap-1">
                {lesson.concepts.map(c => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2a1a] text-green-300">{conceptLabel(c)}</span>
                ))}
              </div>
            </div>
          )}
          {(lesson.review?.length ?? 0) > 0 && (
            <p className="text-[11px] text-sky-300 mt-2">{lesson.review!.length} question{lesson.review!.length > 1 ? 's' : ''} from this lesson will come back in your Daily Review - recalling them later is what makes them stick.</p>
          )}
          <p className="text-[11px] text-hardware-label mt-2 leading-snug">
            Now make it yours: change one thing at a time and listen. Ask yourself what each knob did before you touch the next.
          </p>
          <div className="flex flex-col gap-2 mt-3">
            <div className="flex gap-2">
              <button onClick={() => store.completeLesson()} className="flex-1 py-2 bg-teaching-current text-black font-bold rounded text-xs hover:brightness-110">Finish</button>
              {onNextLesson && (
                <button onClick={() => { store.completeLesson(); onNextLesson(); }} className="flex-1 py-2 bg-[#2d2d2d] text-white font-bold rounded text-xs hover:bg-[#3a3a3a]">Next lesson →</button>
              )}
            </div>
            {snapshot && !restored && (
              <button onClick={() => { store.restoreLessonSnapshot(); setRestored(true); }} className="py-1.5 rounded text-[11px] bg-[#222] text-gray-300 hover:bg-[#2c2c2c]">
                Restore the patch I had before this lesson
              </button>
            )}
          </div>
        </div>
      ) : (
        step && <StepCard step={step} spec={spec ?? getSpec(store.deviceOf(target)) ?? null} satisfied={satisfied} session={session} instance={target} />
      )}

      {!finished && (
        <div className="flex gap-2 mt-2">
          <button onClick={store.prevStep} disabled={currentStep === 0} className="flex-1 py-2 text-xs rounded bg-[#232323] text-gray-300 disabled:opacity-30 hover:bg-[#2f2f2f]">← Back</button>
          <button onClick={store.nextStep} className={`flex-1 py-2 text-xs rounded font-bold ${satisfied ? 'bg-teaching-current text-black' : 'bg-[#232323] text-gray-300 hover:bg-[#2f2f2f]'}`}>
            {satisfied ? 'Next →' : 'Skip →'}
          </button>
        </div>
      )}

      <button onClick={() => setShowList(v => !v)} className="mt-3 text-[11px] text-gray-500 hover:text-gray-300 text-left">
        {showList ? '▾' : '▸'} All steps
      </button>
      {showList && (
        <ol className="mt-1 space-y-1">
          {steps.map((s, i) => {
            const past = finished || i < currentStep;
            const cur = !finished && i === currentStep;
            return (
              <li key={i}>
                <button
                  onClick={() => store.goToStep(i)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-1 rounded text-[11px] leading-snug ${cur ? 'bg-[#16220f] text-white' : past ? 'text-gray-500' : 'text-gray-400 hover:bg-[#1f1f1f]'}`}
                >
                  <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${past ? 'bg-teaching-current text-black' : cur ? 'bg-teaching-target text-black' : 'bg-[#333] text-gray-400'}`}>
                    {past ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0">{s.instruction}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[9px] text-hardware-label mt-2 italic truncate">Source: {lesson.source}</p>
    </aside>
  );
}

function StepCard({ step, spec, satisfied, session, instance }: {
  step: LessonStep;
  spec: DeviceSpec | null;
  satisfied: boolean;
  session: ReturnType<typeof useStudioStore.getState>['session'][number] | undefined;
  instance: string;
}) {
  const store = useStudioStore.getState();
  const kind = stepKind(step);
  const [expanded, setExpanded] = useState(false);
  const control = step.control && spec ? spec.controls[step.control] : undefined;
  const isPatch = !!(step.patchFrom && step.patchTo);
  const hints = step.hints ?? [];
  const hintsShown = session?.hints ?? 0;

  const jackLabel = (id?: string) => {
    if (!id || !spec?.patchBay) return id ?? '';
    const j = [...spec.patchBay.inputs, ...spec.patchBay.outputs].find(x => x.id === id);
    return j ? `${j.label} ${j.jackType === 'output' ? 'OUT' : 'IN'}` : id;
  };
  const labelOf = (id: string) => spec?.controls[id]?.label ?? id;

  // Prediction gate: answer before the action counts
  const needsPrediction = kind === 'predict' && session?.answer === undefined;

  return (
    <div className={`mt-3 p-3 rounded border-l-4 transition-colors ${satisfied ? 'bg-[#0d1a0d] border-teaching-current' : 'bg-[#141414] border-teaching-target'}`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{KIND_LABEL[kind] ?? kind}</p>

      {kind === 'predict' && step.predict && (
        <>
          <MultipleChoiceView mc={step.predict} answer={session?.answer} onAnswer={store.answerStep} reveal={satisfied} />
          {!needsPrediction && <p className="text-[13px] text-white font-medium leading-snug mt-3">Now test it: {step.instruction}</p>}
        </>
      )}
      {kind !== 'predict' && <p className="text-[13px] text-white font-medium leading-snug">{step.instruction}</p>}

      {step.principle && !needsPrediction && (
        <div className="mt-2 flex items-start gap-1.5">
          <span className="text-[11px]" aria-hidden>💡</span>
          <p className="text-[12px] text-yellow-300/90 italic leading-snug">{step.principle}</p>
        </div>
      )}

      {/* Targets */}
      {!needsPrediction && (kind === 'do' || kind === 'patch' || kind === 'predict') && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {isPatch ? (
            <span className="text-[11px] font-mono text-teaching-target">{jackLabel(step.patchFrom)} → {jackLabel(step.patchTo)}</span>
          ) : step.control && step.targetValue !== undefined ? (
            <span className="text-[11px] font-mono text-teaching-target">{control?.label ?? step.control}: {describeValue(control, step.targetValue)}</span>
          ) : <span />}
          {satisfied && <span className="text-[11px] text-teaching-current font-bold">✓ Got it</span>}
        </div>
      )}

      {kind === 'listen' && step.listen && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            {(['a', 'b'] as const).map((k, i) => (
              <button
                key={k}
                onClick={() => hub.audition(instance, step.listen![k])}
                className="flex-1 py-2.5 rounded bg-[#1e2a36] text-sky-200 font-bold text-sm hover:bg-[#263646]"
              >
                ▶ {step.listen!.labels?.[i] ?? (i === 0 ? 'A' : 'B')}
              </button>
            ))}
          </div>
          {step.listen.question && <MultipleChoiceView mc={step.listen.question} answer={session?.answer} onAnswer={store.answerStep} reveal={session?.answer !== undefined} />}
        </div>
      )}

      {kind === 'match' && step.match && (
        <MatchView step={step} session={session} instance={instance} labelOf={labelOf} />
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
        <div className="mt-2 flex gap-2">
          <button onClick={() => hub.audition(instance, null)} className="px-3 py-1.5 rounded bg-[#1e2a36] text-sky-200 text-xs">▶ Hear it</button>
          <span className="text-[11px] text-gray-500 self-center">Read, listen, then press Next.</span>
        </div>
      )}

      {/* Hint ladder - guidance that fades: ask only when stuck */}
      {hints.length > 0 && !satisfied && (
        <div className="mt-2 space-y-1">
          {hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="text-[11px] text-sky-200 bg-sky-950/40 rounded px-2 py-1">Hint {i + 1}: {h}</p>
          ))}
          {hintsShown < hints.length && (
            <button onClick={store.showHint} className="text-[11px] text-sky-300 hover:text-sky-200">Need a hint? ({hints.length - hintsShown} left)</button>
          )}
        </div>
      )}

      {(step.explanation || step.manualReference) && !needsPrediction && (
        <div className="mt-2">
          <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-hardware-label hover:text-white flex items-center gap-1">
            <span className="inline-block transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>▶</span>
            {expanded ? 'Less' : 'Why does this work?'}
          </button>
          {expanded && (
            <div className="mt-1.5 pl-3 border-l border-[#444] space-y-1">
              {step.explanation && <p className="text-[11px] text-gray-300 leading-relaxed">{step.explanation}</p>}
              {step.manualReference && <p className="text-[10px] text-hardware-label italic">📖 {step.manualReference}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MultipleChoiceView({ mc, answer, onAnswer, reveal }: { mc: MultipleChoice; answer?: number; onAnswer: (i: number) => void; reveal: boolean }) {
  return (
    <div>
      <p className="text-[13px] text-white font-medium leading-snug">{mc.question}</p>
      <div className="mt-2 space-y-1.5">
        {mc.options.map((opt, i) => {
          const chosen = answer === i;
          const correct = i === mc.answer;
          const show = reveal && answer !== undefined;
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              disabled={answer !== undefined}
              className={`w-full text-left px-2.5 py-2 rounded text-[12px] border transition-colors ${
                show && correct ? 'border-green-500 bg-green-950/50 text-green-200'
                  : show && chosen && !correct ? 'border-red-500 bg-red-950/40 text-red-200'
                  : chosen ? 'border-sky-500 bg-sky-950/40 text-sky-100'
                  : 'border-[#333] bg-[#1b1b1b] text-gray-200 hover:border-[#555]'
              }`}
            >
              <span className="inline-block w-4 font-bold">{show && correct ? '✓' : show && chosen ? '✗' : String.fromCharCode(65 + i)}</span> {opt}
            </button>
          );
        })}
      </div>
      {reveal && answer !== undefined && (
        <p className={`mt-2 text-[11px] leading-snug ${answer === mc.answer ? 'text-green-300' : 'text-orange-200'}`}>
          {answer === mc.answer ? 'Right. ' : 'Not quite - and that is how learning works: a wrong guess you check sticks better than a right one you never made. '}
          {mc.explain}
        </p>
      )}
      {answer !== undefined && !reveal && <p className="mt-2 text-[11px] text-sky-300">Prediction locked in. Now do it and listen.</p>}
    </div>
  );
}

function MatchView({ step, session, instance, labelOf }: {
  step: LessonStep;
  session: { attempts?: number; match?: { score: number; off: { id: string; dir: string }[] } } | undefined;
  instance: string;
  labelOf: (id: string) => string;
}) {
  const store = useStudioStore.getState();
  const m = step.match!;
  const attempts = session?.attempts ?? 0;
  const result = session?.match;
  const solved = (result?.score ?? 0) >= 1;
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[11px] text-gray-400">
        Adjust: {m.controls.map(labelOf).join(', ')}. Listen to the target, then to yours, until they match.
      </p>
      <div className="flex gap-2">
        <button onClick={() => hub.audition(instance, m.target, { patches: m.patches })} className="flex-1 py-2.5 rounded bg-[#2a1e36] text-purple-200 font-bold text-sm hover:bg-[#35264a]">▶ Target</button>
        <button onClick={() => hub.audition(instance, null)} className="flex-1 py-2.5 rounded bg-[#1e2a36] text-sky-200 font-bold text-sm hover:bg-[#263646]">▶ Mine</button>
      </div>
      {!solved && (
        <button onClick={store.checkMatch} className="w-full py-2 rounded bg-teaching-target text-black font-bold text-xs">Check my sound</button>
      )}
      {result && (
        <div className={`text-[11px] rounded px-2 py-1.5 ${solved ? 'bg-green-950/60 text-green-200' : 'bg-[#2a1d0e] text-orange-200'}`}>
          {solved ? (
            <>Matched by ear{attempts > 1 ? ` in ${attempts} tries` : ' first time'}. That is the core skill of sound design.</>
          ) : (
            <>
              {Math.round(result.score * m.controls.length)} of {m.controls.length} right.
              {/* Feedback fades in: just a count first, then which control, then which direction */}
              {attempts >= 2 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.off.map(o => (
                    <li key={o.id}>{labelOf(o.id)}{attempts >= 3 ? (o.dir === 'higher' ? ': go higher' : o.dir === 'lower' ? ': go lower' : ': try another setting') : ' is off'}</li>
                  ))}
                </ul>
              )}
              {attempts < 2 && <span> Listen again and compare.</span>}
            </>
          )}
        </div>
      )}
      {attempts >= 4 && !solved && (
        <button
          onClick={() => {
            const vals: Record<string, string | number | boolean> = {};
            m.controls.forEach(c => { vals[c] = m.target[c]; });
            store.setControlValues(instance, vals);
            setTimeout(store.checkMatch, 50);
          }}
          className="text-[11px] text-gray-400 underline"
        >
          Show me the answer
        </button>
      )}
    </div>
  );
}

function ReflectView({ reflect, session }: { reflect: { prompt: string; model: string }; session: { revealed?: boolean; rating?: string } | undefined }) {
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
        <button onClick={store.revealStep} className="w-full py-1.5 rounded bg-[#262626] text-gray-200 text-xs">Compare with a model answer</button>
      ) : (
        <>
          <p className="text-[12px] text-green-200 bg-green-950/40 rounded p-2 leading-snug">{reflect.model}</p>
          <p className="text-[11px] text-gray-400">How close were you?</p>
          <div className="flex gap-1">
            {(['got-it', 'partly', 'not-yet'] as const).map(r => (
              <button
                key={r}
                onClick={() => store.rateReflection(r)}
                className={`flex-1 py-1.5 rounded text-[11px] ${session?.rating === r ? 'bg-teaching-current text-black font-bold' : 'bg-[#232323] text-gray-300'}`}
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
  const status = useMemo(() => {
    const st = buildCheckState(instance, hub.getState(instance));
    return (step.checklist ?? []).map(c => {
      if (!c.check) return null;
      try { return c.check(st); } catch { return false; }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, studio, step, instance]);
  return (
    <ul className="mt-2 space-y-1">
      {(step.checklist ?? []).map((c, i) => (
        <li key={i} className={`flex items-start gap-2 text-[12px] ${status[i] ? 'text-green-300' : 'text-gray-300'}`}>
          <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${status[i] ? 'bg-green-600 border-green-500 text-black' : 'border-[#555]'}`}>
            {status[i] ? '✓' : status[i] === null ? '·' : ''}
          </span>
          {c.text}
        </li>
      ))}
    </ul>
  );
}
