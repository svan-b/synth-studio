'use client';

import { useStudioStore } from '@/store/studio';
import * as Progress from '@radix-ui/react-progress';

export default function Instructions() {
  const { currentLesson, currentStep, isTeachingMode, resetLesson, completeLesson } = useStudioStore();

  if (!isTeachingMode || !currentLesson) {
    return null;
  }

  const steps = currentLesson.steps;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isComplete = currentStep === steps.length - 1;

  return (
    <div className="fixed right-6 top-6 w-80 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-6 shadow-2xl">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-teaching-current font-bold text-sm uppercase tracking-wider">
              {currentLesson.name}
            </h3>
            <p className="text-xs text-hardware-label mt-1">
              {currentLesson.description}
            </p>
            <p className="text-[10px] text-hardware-label mt-1 italic">
              Source: {currentLesson.source}
            </p>
          </div>
          <button
            onClick={resetLesson}
            className="text-xs text-hardware-label hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <Progress.Root
          className="relative overflow-hidden bg-[#1a1a1a] rounded-full w-full h-2 mt-4"
          style={{ transform: 'translateZ(0)' }}
          value={progress}
        >
          <Progress.Indicator
            className="bg-teaching-current w-full h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${100 - progress}%)` }}
          />
        </Progress.Root>
        <p className="text-[10px] text-hardware-label mt-1 text-right">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {steps.map((step, index) => {
          const isPast = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <div
              key={index}
              className={`
                p-3 rounded border-l-4 transition-all
                ${isPast ? 'bg-[#0d1a0d] border-teaching-current opacity-60' : ''}
                ${isCurrent ? 'bg-[#0d1a0d] border-teaching-current' : ''}
                ${isFuture ? 'bg-[#0d0d0d] border-[#333]' : ''}
              `}
            >
              <div className="flex items-start gap-2">
                <span className={`
                  flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${isPast ? 'bg-teaching-current text-black' : ''}
                  ${isCurrent ? 'bg-teaching-target text-black' : ''}
                  ${isFuture ? 'bg-[#333] text-hardware-label' : ''}
                `}>
                  {isPast ? '✓' : index + 1}
                </span>
                <div className="flex-1">
                  <p className={`text-xs leading-relaxed ${isCurrent ? 'text-white font-medium' : 'text-hardware-label'}`}>
                    {step.instruction}
                  </p>
                  {step.manualReference && (
                    <p className="text-[10px] text-hardware-label mt-1 italic">
                      {step.manualReference}
                    </p>
                  )}
                  {isCurrent && (
                    <p className="text-[10px] text-teaching-target mt-2 font-mono">
                      Target: {String(step.targetValue)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion */}
      {isComplete && (
        <div className="mt-4 p-3 bg-[#0d1a0d] border border-teaching-current rounded">
          <p className="text-sm text-teaching-current font-bold text-center mb-2">
            ✓ Lesson Complete!
          </p>
          <button
            onClick={completeLesson}
            className="w-full py-2 bg-teaching-current text-black font-bold rounded hover:brightness-110 transition-all"
          >
            Finish & Close
          </button>
        </div>
      )}
    </div>
  );
}
