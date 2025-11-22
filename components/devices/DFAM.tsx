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
  const currentStepData = (isTeachingMode && currentLesson?.device === device) ? currentLesson.steps[currentStep] : undefined;
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

  const getControlProps = (controlId: string): any => {
    const control = spec.controls[controlId];
    const value = getControlValue(device, controlId) ?? control.default;
    const isHighlighted = isTeachingMode && highlightedControl === controlId;
    const targetValue = currentStepData?.control === controlId ? currentStepData.targetValue : undefined;

    const baseProps = {
      id: controlId,
      label: control.label,
      position: control.position,
      onChange: (newValue: number | string) => handleControlChange(controlId, newValue),
      highlighted: isHighlighted,
    };

    // Type-specific props
    if (control.type === 'knob') {
      return {
        ...baseProps,
        value: typeof value === 'number' ? value : control.default,
        min: control.min,
        max: control.max,
        default: control.default,
        defaultValue: control.default,
        units: control.units,
        bipolar: control.bipolar,
        size: control.size,
        targetValue: typeof targetValue === 'number' ? targetValue : undefined,
        showTarget: isHighlighted && targetValue !== undefined,
      };
    }

    if (control.type === 'switch') {
      return {
        ...baseProps,
        value: typeof value === 'string' ? value : (control.options?.[0] || String(control.default)),
        options: control.options || [],
      };
    }

    if (control.type === 'button') {
      return {
        ...baseProps,
        value: Boolean(value),
        led: (control as any).led,
        ledColor: (control as any).ledColor,
      };
    }

    return baseProps;
  };

  return (
    <div
      className="relative bg-[#1a1a1a] rounded-lg border-4 border-[#3a3a3a] shadow-2xl mx-auto"
      style={{
        width: `${spec.width}px`,
        minHeight: `${spec.height + 200}px`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.05)',
      }}
    >
      {/* DFAM Logo / Title */}
      <div className="absolute top-6 left-8">
        <h1 className="text-3xl font-bold text-hardware-label uppercase tracking-widest">
          DFAM
        </h1>
        <p className="text-[11px] text-hardware-label font-label tracking-wider">
          DRUMMER FROM ANOTHER MOTHER
        </p>
        <p className="text-[10px] text-hardware-label font-label mt-0.5">
          MOOG
        </p>
      </div>

      {/* Main Grid Container */}
      <div className="pt-24 px-8 pb-8">

        {/* TOP ROW - OSCILLATORS */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <span className="font-label text-[11px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
              OSCILLATORS
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '20px',
            alignItems: 'start',
            justifyItems: 'center'
          }}>
            {/* VCO 1 */}
            <Knob {...getControlProps('vco1_frequency')} />
            <Switch {...getControlProps('vco1_wave')} />
            <Knob {...getControlProps('vco1_eg')} />
            <Knob {...getControlProps('fm_amount')} />

            {/* VCO 2 */}
            <Knob {...getControlProps('vco2_frequency')} />
            <Switch {...getControlProps('vco2_wave')} />
            <Knob {...getControlProps('vco2_eg')} />
            <div className="flex flex-col items-center">
              <Button {...getControlProps('hard_sync')} led ledColor="#00ff00" />
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION - MIXER & FILTER */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <span className="font-label text-[11px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
              MIXER & FILTER
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: '16px',
            alignItems: 'start',
            justifyItems: 'center'
          }}>
            <Knob {...getControlProps('vco1_level')} />
            <Knob {...getControlProps('vco2_level')} />
            <Knob {...getControlProps('noise')} />
            <Knob {...getControlProps('vco_decay')} />
            <Knob {...getControlProps('vcf_cutoff')} />
            <Knob {...getControlProps('vcf_resonance')} />
            <Knob {...getControlProps('vcf_eg')} />
            <Knob {...getControlProps('vcf_decay')} />
            <Knob {...getControlProps('noise_vcf_mod')} />
          </div>
        </div>

        {/* LOWER SECTION - VCA */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <span className="font-label text-[11px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
              VCA & MASTER
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '40px',
            alignItems: 'start',
            justifyItems: 'center',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <Switch {...getControlProps('vca_attack')} />
            <Knob {...getControlProps('vca_decay')} />
            <Knob {...getControlProps('volume')} />
            <Knob {...getControlProps('tempo')} />
          </div>
        </div>

        {/* BOTTOM - SEQUENCER */}
        <div className="border-t-2 border-hardware-label pt-6 mt-8">
          <div className="text-center mb-4">
            <span className="font-label text-[11px] text-hardware-label uppercase tracking-widest border-b border-hardware-label pb-1">
              8-STEP SEQUENCER
            </span>
          </div>

          {/* Step Buttons */}
          <div className="mb-3">
            <div className="text-[9px] text-hardware-label text-center mb-2 font-label">STEPS</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '12px',
              maxWidth: '720px',
              margin: '0 auto'
            }}>
              <Button {...getControlProps('step1')} led ledColor="#ff0000" />
              <Button {...getControlProps('step2')} led ledColor="#ff0000" />
              <Button {...getControlProps('step3')} led ledColor="#ff0000" />
              <Button {...getControlProps('step4')} led ledColor="#ff0000" />
              <Button {...getControlProps('step5')} led ledColor="#ff0000" />
              <Button {...getControlProps('step6')} led ledColor="#ff0000" />
              <Button {...getControlProps('step7')} led ledColor="#ff0000" />
              <Button {...getControlProps('step8')} led ledColor="#ff0000" />
            </div>
          </div>

          {/* Pitch Row */}
          <div className="mb-3">
            <div className="text-[9px] text-hardware-label text-center mb-2 font-label">PITCH (CV)</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '12px',
              maxWidth: '720px',
              margin: '0 auto'
            }}>
              <Knob {...getControlProps('pitch1')} />
              <Knob {...getControlProps('pitch2')} />
              <Knob {...getControlProps('pitch3')} />
              <Knob {...getControlProps('pitch4')} />
              <Knob {...getControlProps('pitch5')} />
              <Knob {...getControlProps('pitch6')} />
              <Knob {...getControlProps('pitch7')} />
              <Knob {...getControlProps('pitch8')} />
            </div>
          </div>

          {/* Velocity Row */}
          <div className="mb-4">
            <div className="text-[9px] text-hardware-label text-center mb-2 font-label">VELOCITY</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '12px',
              maxWidth: '720px',
              margin: '0 auto'
            }}>
              <Knob {...getControlProps('velocity1')} />
              <Knob {...getControlProps('velocity2')} />
              <Knob {...getControlProps('velocity3')} />
              <Knob {...getControlProps('velocity4')} />
              <Knob {...getControlProps('velocity5')} />
              <Knob {...getControlProps('velocity6')} />
              <Knob {...getControlProps('velocity7')} />
              <Knob {...getControlProps('velocity8')} />
            </div>
          </div>

          {/* Sequencer Controls */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            maxWidth: '400px',
            margin: '0 auto',
            marginTop: '20px'
          }}>
            <div className="flex flex-col items-center">
              <Button {...getControlProps('run_stop')} led ledColor="#00ff00" />
            </div>
            <div className="flex flex-col items-center">
              <Button {...getControlProps('adv_step')} />
            </div>
            <div className="flex flex-col items-center">
              <Button {...getControlProps('trigger')} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-8 right-8 flex justify-between items-center">
        <div className="text-[9px] text-hardware-label font-label">
          Digital Twin • All specs from official manual • 25+ Controls
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
