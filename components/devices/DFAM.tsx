'use client';

import { useStudioStore } from '@/store/studio';
import { DFAM_SPEC } from '@/data/dfam';
import Knob from '@/components/controls/Knob';
import Button from '@/components/controls/Button';
import Switch from '@/components/controls/Switch';

export default function DFAM() {
  const { deviceSettings, setControlValue, getControlValue, currentLesson, currentStep, isTeachingMode, completeStep } = useStudioStore();

  const device = 'DFAM';
  const spec = DFAM_SPEC;

  // Get current step if in teaching mode
  const currentStepData = isTeachingMode && currentLesson?.device === device && currentLesson.steps[currentStep];
  const highlightedControl = currentStepData?.control;

  const handleControlChange = (controlId: string, value: number | string) => {
    setControlValue(device, controlId, value);

    // Check if this completes the current step
    if (currentStepData && controlId === currentStepData.control) {
      const targetValue = currentStepData.targetValue;
      const control = spec.controls[controlId];

      // Check if value is close enough (5% tolerance)
      if (typeof targetValue === 'number' && typeof value === 'number') {
        const range = control.max - control.min;
        const tolerance = range * 0.05;
        if (Math.abs(value - targetValue) <= tolerance) {
          completeStep();
        }
      } else if (value === targetValue) {
        completeStep();
      }
    }
  };

  const getControlProps = (controlId: string) => {
    const control = spec.controls[controlId];
    const value = getControlValue(device, controlId) ?? control.default;
    const isHighlighted = isTeachingMode && highlightedControl === controlId;
    const targetValue = currentStepData?.control === controlId ? currentStepData.targetValue : undefined;

    return {
      id: controlId,
      value: typeof value === 'number' ? value : 0,
      ...control,
      onChange: (newValue: number | string) => handleControlChange(controlId, newValue),
      highlighted: isHighlighted,
      targetValue: typeof targetValue === 'number' ? targetValue : undefined,
      showTarget: isHighlighted && targetValue !== undefined,
    };
  };

  return (
    <div
      className="relative bg-gradient-to-b from-hardware-panel to-hardware-bg rounded-lg border-4 border-[#3a3a3a] shadow-2xl p-8 mx-auto"
      style={{
        width: `${spec.width}px`,
        minHeight: `${spec.height}px`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.05)',
      }}
    >
      {/* DFAM Logo / Title */}
      <div className="absolute top-4 left-8">
        <h1 className="text-2xl font-bold text-hardware-label uppercase tracking-widest">
          DFAM
        </h1>
        <p className="text-[10px] text-hardware-label font-label tracking-wider">
          DRUMMER FROM ANOTHER MOTHER
        </p>
        <p className="text-[9px] text-hardware-label font-label mt-0.5">
          MOOG
        </p>
      </div>

      {/* OSCILLATORS SECTION */}
      <div className="absolute left-0 top-24 right-0">
        <div className="text-center mb-2">
          <span className="font-label text-[10px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
            Oscillators
          </span>
        </div>

        {/* VCO 1 */}
        <Knob {...getControlProps('vco1_frequency')} />
        <Switch {...getControlProps('vco1_wave')} />
        <Knob {...getControlProps('vco1_eg')} />

        {/* VCO 2 */}
        <Knob {...getControlProps('vco2_frequency')} />
        <Switch {...getControlProps('vco2_wave')} />
        <Knob {...getControlProps('vco2_eg')} />

        {/* VCO Controls */}
        <Knob {...getControlProps('vco_decay')} />
        <Knob {...getControlProps('fm_amount')} />
        <Button {...getControlProps('hard_sync')} led ledColor="#00ff00" />
      </div>

      {/* MIXER SECTION */}
      <div className="absolute left-0 top-80">
        <div className="text-center mb-2">
          <span className="font-label text-[10px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
            Mixer
          </span>
        </div>

        <Knob {...getControlProps('vco1_level')} />
        <Knob {...getControlProps('vco2_level')} />
        <Knob {...getControlProps('noise')} />
      </div>

      {/* FILTER SECTION */}
      <div className="absolute left-[450px] top-80">
        <div className="text-center mb-2">
          <span className="font-label text-[10px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
            Filter (4-Pole Ladder)
          </span>
        </div>

        <Knob {...getControlProps('vcf_cutoff')} />
        <Knob {...getControlProps('vcf_resonance')} />
        <Knob {...getControlProps('vcf_eg')} />
        <Knob {...getControlProps('vcf_decay')} />
        <Switch {...getControlProps('vcf_mode')} />
      </div>

      {/* VCA SECTION */}
      <div className="absolute left-0 bottom-24">
        <div className="text-center mb-2">
          <span className="font-label text-[10px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
            VCA
          </span>
        </div>

        <Knob {...getControlProps('vca_decay')} />
        <Switch {...getControlProps('vca_attack')} />
        <Knob {...getControlProps('volume')} />
      </div>

      {/* SEQUENCER SECTION */}
      <div className="absolute right-8 bottom-24">
        <div className="text-center mb-2">
          <span className="font-label text-[10px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
            Tempo
          </span>
        </div>

        <Knob {...getControlProps('tempo')} />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-8 right-8 flex justify-between items-center">
        <div className="text-[9px] text-hardware-label font-label">
          Digital Twin • All specs from official manual
        </div>
        {isTeachingMode && currentLesson?.device === device && (
          <div className="text-[10px] text-teaching-current font-bold animate-pulse">
            TEACHING MODE ACTIVE
          </div>
        )}
      </div>
    </div>
  );
}
