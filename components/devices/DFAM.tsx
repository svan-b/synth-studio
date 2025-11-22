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

  const currentStepData = (isTeachingMode && currentLesson?.device === device) ? currentLesson.steps[currentStep] : undefined;
  const highlightedControl = currentStepData?.control;

  const handleControlChange = (controlId: string, value: number | string | boolean) => {
    const storageValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    setControlValue(device, controlId, storageValue);

    if (currentStepData && controlId === currentStepData.control) {
      const targetValue = currentStepData.targetValue;
      const control = spec.controls[controlId];

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
      onChange: (newValue: number | string | boolean) => handleControlChange(controlId, newValue),
      highlighted: isHighlighted,
    };

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

    if (control.type === 'jack') {
      return {
        ...baseProps,
        value: Boolean(value),
        type: controlId.startsWith('patch_in_') ? 'input' : 'output',
      };
    }

    return baseProps;
  };

  return (
    <div className="relative mx-auto" style={{ width: `${spec.width + 60}px` }}>
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[30px] rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #5C4033 0%, #6F5645 50%, #5C4033 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3), inset 2px 0 4px rgba(255,255,255,0.1)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-[30px] rounded-r-lg"
        style={{
          background: 'linear-gradient(90deg, #5C4033 0%, #6F5645 50%, #5C4033 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.3), inset -2px 0 4px rgba(255,255,255,0.1)',
        }}
      />

      {/* Main Panel - All controls absolutely positioned */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: `${spec.width}px`,
          height: `${spec.height}px`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* OSCILLATORS SECTION - Top Row */}
        <div className="absolute" style={{ left: '100px', top: '120px' }}><Knob {...getControlProps('vco1_frequency')} /></div>
        <div className="absolute" style={{ left: '100px', top: '240px' }}><Switch {...getControlProps('vco1_wave')} /></div>
        <div className="absolute" style={{ left: '200px', top: '120px' }}><Knob {...getControlProps('vco1_eg')} /></div>

        <div className="absolute" style={{ left: '320px', top: '120px' }}><Knob {...getControlProps('vco2_frequency')} /></div>
        <div className="absolute" style={{ left: '320px', top: '240px' }}><Switch {...getControlProps('vco2_wave')} /></div>
        <div className="absolute" style={{ left: '420px', top: '120px' }}><Knob {...getControlProps('vco2_eg')} /></div>

        <div className="absolute" style={{ left: '540px', top: '120px' }}><Knob {...getControlProps('vco_decay')} /></div>
        <div className="absolute" style={{ left: '660px', top: '120px' }}><Knob {...getControlProps('fm_amount')} /></div>
        <div className="absolute" style={{ left: '760px', top: '140px' }}><Button {...getControlProps('hard_sync')} /></div>

        {/* MIXER SECTION */}
        <div className="absolute" style={{ left: '100px', top: '320px' }}><Knob {...getControlProps('vco1_level')} /></div>
        <div className="absolute" style={{ left: '220px', top: '320px' }}><Knob {...getControlProps('vco2_level')} /></div>
        <div className="absolute" style={{ left: '340px', top: '320px' }}><Knob {...getControlProps('noise')} /></div>

        {/* FILTER SECTION */}
        <div className="absolute" style={{ left: '520px', top: '320px' }}><Knob {...getControlProps('vcf_cutoff')} /></div>
        <div className="absolute" style={{ left: '660px', top: '320px' }}><Knob {...getControlProps('vcf_resonance')} /></div>
        <div className="absolute" style={{ left: '780px', top: '320px' }}><Knob {...getControlProps('vcf_eg')} /></div>
        <div className="absolute" style={{ left: '880px', top: '320px' }}><Knob {...getControlProps('vcf_decay')} /></div>
        <div className="absolute" style={{ left: '1000px', top: '340px' }}><Switch {...getControlProps('vcf_mode')} /></div>
        <div className="absolute" style={{ left: '1000px', top: '320px' }}><Knob {...getControlProps('noise_vcf_mod')} /></div>

        {/* VCA SECTION */}
        <div className="absolute" style={{ left: '100px', top: '480px' }}><Knob {...getControlProps('vca_decay')} /></div>
        <div className="absolute" style={{ left: '220px', top: '500px' }}><Switch {...getControlProps('vca_attack')} /></div>
        <div className="absolute" style={{ left: '340px', top: '480px' }}><Knob {...getControlProps('volume')} /></div>

        {/* SEQUENCER SECTION */}
        <div className="absolute" style={{ left: '900px', top: '480px' }}><Knob {...getControlProps('tempo')} /></div>

        {/* 8-step sequencer buttons */}
        <div className="absolute" style={{ left: '100px', top: '520px' }}><Button {...getControlProps('step1')} /></div>
        <div className="absolute" style={{ left: '180px', top: '520px' }}><Button {...getControlProps('step2')} /></div>
        <div className="absolute" style={{ left: '260px', top: '520px' }}><Button {...getControlProps('step3')} /></div>
        <div className="absolute" style={{ left: '340px', top: '520px' }}><Button {...getControlProps('step4')} /></div>
        <div className="absolute" style={{ left: '420px', top: '520px' }}><Button {...getControlProps('step5')} /></div>
        <div className="absolute" style={{ left: '500px', top: '520px' }}><Button {...getControlProps('step6')} /></div>
        <div className="absolute" style={{ left: '580px', top: '520px' }}><Button {...getControlProps('step7')} /></div>
        <div className="absolute" style={{ left: '660px', top: '520px' }}><Button {...getControlProps('step8')} /></div>

        {/* PITCH row */}
        <div className="absolute" style={{ left: '100px', top: '580px' }}><Knob {...getControlProps('pitch1')} /></div>
        <div className="absolute" style={{ left: '180px', top: '580px' }}><Knob {...getControlProps('pitch2')} /></div>
        <div className="absolute" style={{ left: '260px', top: '580px' }}><Knob {...getControlProps('pitch3')} /></div>
        <div className="absolute" style={{ left: '340px', top: '580px' }}><Knob {...getControlProps('pitch4')} /></div>
        <div className="absolute" style={{ left: '420px', top: '580px' }}><Knob {...getControlProps('pitch5')} /></div>
        <div className="absolute" style={{ left: '500px', top: '580px' }}><Knob {...getControlProps('pitch6')} /></div>
        <div className="absolute" style={{ left: '580px', top: '580px' }}><Knob {...getControlProps('pitch7')} /></div>
        <div className="absolute" style={{ left: '660px', top: '580px' }}><Knob {...getControlProps('pitch8')} /></div>

        {/* VELOCITY row */}
        <div className="absolute" style={{ left: '100px', top: '640px' }}><Knob {...getControlProps('velocity1')} /></div>
        <div className="absolute" style={{ left: '180px', top: '640px' }}><Knob {...getControlProps('velocity2')} /></div>
        <div className="absolute" style={{ left: '260px', top: '640px' }}><Knob {...getControlProps('velocity3')} /></div>
        <div className="absolute" style={{ left: '340px', top: '640px' }}><Knob {...getControlProps('velocity4')} /></div>
        <div className="absolute" style={{ left: '420px', top: '640px' }}><Knob {...getControlProps('velocity5')} /></div>
        <div className="absolute" style={{ left: '500px', top: '640px' }}><Knob {...getControlProps('velocity6')} /></div>
        <div className="absolute" style={{ left: '580px', top: '640px' }}><Knob {...getControlProps('velocity7')} /></div>
        <div className="absolute" style={{ left: '660px', top: '640px' }}><Knob {...getControlProps('velocity8')} /></div>

        {/* Sequencer controls */}
        <div className="absolute" style={{ left: '780px', top: '540px' }}><Button {...getControlProps('run_stop')} /></div>
        <div className="absolute" style={{ left: '780px', top: '600px' }}><Button {...getControlProps('adv_step')} /></div>
        <div className="absolute" style={{ left: '780px', top: '660px' }}><Button {...getControlProps('trigger')} /></div>

        {/* MOOG Logo - Bottom Right */}
        <div className="absolute bottom-8 right-8">
          <div className="text-[20px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em] mt-0.5">DRUMMER FROM ANOTHER MOTHER</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em]">SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER</div>
          <div className="text-[9px] font-label text-[#666] tracking-[0.3em] mt-1">moog</div>
        </div>

        {/* Teaching Mode Indicator */}
        {isTeachingMode && currentLesson?.device === device && (
          <div className="absolute top-4 left-4 text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
            ● TEACHING MODE
          </div>
        )}

        {/* Corner Screws */}
        {[
          { x: 15, y: 15 },
          { x: spec.width - 15, y: 15 },
          { x: 15, y: spec.height - 15 },
          { x: spec.width - 15, y: spec.height - 15 },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-[6px] h-[6px] rounded-full bg-[#2a2a2a] border border-[#444]"
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
