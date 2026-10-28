'use client';

import { useEffect, useState } from 'react';
import type { DeviceSpec, LessonStep } from '@/types';
import { useStudioStore } from '@/store/studio';
import { describeValue } from '@/lib/controls/mapping';

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

/**
 * Docked lesson coach. Shows the current step big and clear (what to do, the
 * one-line principle behind it, the target), with Back/Skip, and the whole
 * step list for orientation.
 */
export default function Instructions({ spec, onNextLesson }: InstructionsProps) {
  const lesson = useStudioStore(s => s.currentLesson);
  const currentStep = useStudioStore(s => s.currentStep);
  const isTeaching = useStudioStore(s => s.isTeachingMode);
  const finished = useStudioStore(s => s.lessonFinished);
  const satisfied = useStudioStore(s => s.stepSatisfied);
  const { resetLesson, completeLesson, nextStep, prevStep, goToStep } = useStudioStore.getState();
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setExpanded(false), [currentStep, lesson?.id]);

  if (!isTeaching || !lesson) return null;

  const steps = lesson.steps;
  const step = steps[currentStep];
  const progress = finished ? 100 : (currentStep / steps.length) * 100;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full lg:w-12 lg:h-full bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-2 text-teaching-current text-xs font-bold lg:[writing-mode:vertical-rl]"
      >
        {lesson.name} · {finished ? 'done' : `step ${currentStep + 1}/${steps.length}`} — show
      </button>
    );
  }

  return (
    <aside className="w-full lg:w-80 shrink-0 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 shadow-2xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-teaching-current font-bold text-sm uppercase tracking-wider truncate">{lesson.name}</h3>
          <p className="text-[11px] text-hardware-label mt-0.5 leading-snug">{lesson.description}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setCollapsed(true)} className="text-hardware-label hover:text-white px-1.5 text-sm" aria-label="Collapse lesson panel" title="Collapse">—</button>
          <button onClick={resetLesson} className="text-hardware-label hover:text-white px-1.5 text-sm" aria-label="Stop lesson" title="Stop lesson">✕</button>
        </div>
      </div>

      <div className="relative overflow-hidden bg-[#1a1a1a] rounded-full w-full h-1.5 mt-3">
        <div className="absolute inset-y-0 left-0 bg-teaching-current transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[10px] text-hardware-label mt-1 text-right">
        {finished ? 'All steps done' : `Step ${currentStep + 1} of ${steps.length}`}
      </p>

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
          <p className="text-[11px] text-hardware-label mt-2 leading-snug">
            Now break it: change one knob at a time and listen to what moves. That is how you make it yours.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { completeLesson(); }} className="flex-1 py-2 bg-teaching-current text-black font-bold rounded text-xs hover:brightness-110">
              Finish
            </button>
            {onNextLesson && (
              <button onClick={() => { completeLesson(); onNextLesson(); }} className="flex-1 py-2 bg-[#2d2d2d] text-white font-bold rounded text-xs hover:bg-[#3a3a3a]">
                Next lesson →
              </button>
            )}
          </div>
        </div>
      ) : (
        step && (
          <CurrentStep
            step={step}
            spec={spec}
            satisfied={satisfied}
            expanded={expanded}
            onToggle={() => setExpanded(e => !e)}
          />
        )
      )}

      {!finished && (
        <div className="flex gap-2 mt-2">
          <button onClick={prevStep} disabled={currentStep === 0} className="flex-1 py-1.5 text-xs rounded bg-[#232323] text-gray-300 disabled:opacity-30 hover:bg-[#2f2f2f]">
            ← Back
          </button>
          <button onClick={nextStep} className={`flex-1 py-1.5 text-xs rounded font-bold ${satisfied ? 'bg-teaching-current text-black' : 'bg-[#232323] text-gray-300 hover:bg-[#2f2f2f]'}`}>
            {satisfied ? 'Next →' : 'Skip →'}
          </button>
        </div>
      )}

      <ol className="mt-3 space-y-1 overflow-y-auto min-h-0 flex-1 pr-1">
        {steps.map((s, i) => {
          const past = finished || i < currentStep;
          const cur = !finished && i === currentStep;
          return (
            <li key={i}>
              <button
                onClick={() => goToStep(i)}
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
      <p className="text-[9px] text-hardware-label mt-2 italic truncate">Source: {lesson.source}</p>
    </aside>
  );
}

function CurrentStep({ step, spec, satisfied, expanded, onToggle }: {
  step: LessonStep;
  spec: DeviceSpec | null;
  satisfied: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const control = step.control && spec ? spec.controls[step.control] : undefined;
  const isPatch = !!(step.patchFrom && step.patchTo);
  const jackLabel = (id?: string) => {
    if (!id || !spec?.patchBay) return id ?? '';
    const j = [...spec.patchBay.inputs, ...spec.patchBay.outputs].find(x => x.id === id);
    return j ? `${j.label} ${j.jackType === 'output' ? 'OUT' : 'IN'}` : id;
  };

  return (
    <div className={`mt-3 p-3 rounded border-l-4 transition-colors ${satisfied ? 'bg-[#0d1a0d] border-teaching-current' : 'bg-[#141414] border-teaching-target'}`}>
      <p className="text-[13px] text-white font-medium leading-snug">{step.instruction}</p>

      {step.principle && (
        <div className="mt-2 flex items-start gap-1.5">
          <span className="text-[11px]" aria-hidden>💡</span>
          <p className="text-[12px] text-yellow-300/90 italic leading-snug">{step.principle}</p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {isPatch ? (
          <span className="text-[11px] font-mono text-teaching-target">
            {jackLabel(step.patchFrom)} → {jackLabel(step.patchTo)}
          </span>
        ) : step.control && step.targetValue !== undefined ? (
          <span className="text-[11px] font-mono text-teaching-target">
            {control?.label ?? step.control}: {describeValue(control, step.targetValue)}
          </span>
        ) : (
          <span className="text-[11px] text-gray-400">Read, listen, then press Next.</span>
        )}
        {satisfied && (step.control || isPatch) && <span className="text-[11px] text-teaching-current font-bold">✓ Got it</span>}
      </div>

      {(step.explanation || step.manualReference) && (
        <div className="mt-2">
          <button onClick={onToggle} className="text-[11px] text-hardware-label hover:text-white flex items-center gap-1">
            <span className="inline-block transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>▶</span>
            {expanded ? 'Less' : 'Why?'}
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
