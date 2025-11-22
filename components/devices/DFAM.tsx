'use client';

import { useStudioStore } from '@/store/studio';
import { DFAM_SPEC } from '@/data/dfam';
import Knob from '@/components/controls/Knob';
import Button from '@/components/controls/Button';
import Switch from '@/components/controls/Switch';
import Jack from '@/components/controls/Jack';

export default function DFAM() {
  const { deviceSettings, setControlValue, getControlValue, currentLesson, currentStep, isTeachingMode, completeStep } = useStudioStore();

  const device = 'DFAM';
  const spec = DFAM_SPEC;

  const currentStepData = (isTeachingMode && currentLesson?.device === device) ? currentLesson.steps[currentStep] : undefined;
  const highlightedControl = currentStepData?.control;

  const handleControlChange = (controlId: string, value: number | string | boolean) => {
    // Convert boolean to number for storage
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

      {/* Main Panel */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: `${spec.width}px`,
          height: `${spec.height}px`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* MOOG Logo and Title */}
        <div className="absolute top-4 left-6">
          <div className="text-[9px] font-label text-[#666] tracking-[0.3em] mb-1">MOOG</div>
          <div className="text-[24px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[7px] font-label text-[#888] tracking-[0.15em] mt-1">DRUMMER FROM ANOTHER MOTHER</div>
        </div>

        {/* Section Dividers */}
        <div className="absolute left-[400px] top-[40px] bottom-[40px] w-[1px] bg-[#333]" />
        <div className="absolute left-[880px] top-[40px] bottom-[40px] w-[1px] bg-[#333]" />
        <div className="absolute left-[40px] right-[40px] top-[380px] h-[1px] bg-[#333]" />
        <div className="absolute left-[40px] right-[400px] top-[520px] h-[1px] bg-[#333]" />

        {/* OSCILLATORS SECTION */}
        <div className="absolute left-[40px] top-[60px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1 w-[320px]">
            OSCILLATORS
          </div>
          <div className="flex gap-[40px]">
            <div>
              <Knob {...getControlProps('vco1_frequency')} />
              <div className="mt-2">
                <Switch {...getControlProps('vco1_wave')} />
              </div>
            </div>
            <div>
              <Knob {...getControlProps('vco2_frequency')} />
              <div className="mt-2">
                <Switch {...getControlProps('vco2_wave')} />
              </div>
            </div>
            <div className="mt-4">
              <Switch {...getControlProps('hard_sync')} />
            </div>
          </div>
        </div>

        {/* MIXER SECTION */}
        <div className="absolute left-[40px] top-[260px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1 w-[320px]">
            MIXER
          </div>
          <div className="flex gap-[40px]">
            <Knob {...getControlProps('vco1_level')} />
            <Knob {...getControlProps('vco2_level')} />
            <Knob {...getControlProps('noise')} />
          </div>
        </div>

        {/* FILTER SECTION */}
        <div className="absolute left-[420px] top-[80px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1 w-[400px]">
            FILTER — 4-POLE LADDER
          </div>
          <div className="flex gap-[40px] items-start">
            <Knob {...getControlProps('vcf_cutoff')} />
            <div>
              <Knob {...getControlProps('vcf_resonance')} />
              <div className="mt-4">
                <Switch {...getControlProps('vcf_mode')} />
              </div>
            </div>
            <Knob {...getControlProps('vcf_eg')} />
          </div>
        </div>

        {/* ENVELOPES SECTION */}
        <div className="absolute left-[40px] top-[400px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1 w-[800px]">
            ENVELOPE GENERATORS
          </div>
          <div className="flex gap-[40px]">
            <div>
              <Knob {...getControlProps('vco_decay')} />
            </div>
            <div>
              <Knob {...getControlProps('vcf_decay')} />
            </div>
            <div>
              <Knob {...getControlProps('vca_decay')} />
            </div>
            <div className="ml-[80px]">
              <Knob {...getControlProps('vca_eg')} />
            </div>
            <div>
              <Knob {...getControlProps('vca_level')} />
            </div>
            <div>
              <Knob {...getControlProps('tempo')} />
            </div>
          </div>
        </div>

        {/* SEQUENCER SECTION */}
        <div className="absolute left-[40px] top-[530px] right-[400px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1">
            8-STEP SEQUENCER
          </div>

          {/* Pitch Row Label */}
          <div className="text-[7px] font-label text-[#777] tracking-[0.2em] mb-1 ml-1">PITCH</div>
          <div className="flex gap-[20px] mb-3">
            <Knob {...getControlProps('pitch1')} />
            <Knob {...getControlProps('pitch2')} />
            <Knob {...getControlProps('pitch3')} />
            <Knob {...getControlProps('pitch4')} />
            <Knob {...getControlProps('pitch5')} />
            <Knob {...getControlProps('pitch6')} />
            <Knob {...getControlProps('pitch7')} />
            <Knob {...getControlProps('pitch8')} />
          </div>

          {/* Velocity Row Label */}
          <div className="text-[7px] font-label text-[#777] tracking-[0.2em] mb-1 ml-1">VELOCITY</div>
          <div className="flex gap-[20px] mb-3">
            <Knob {...getControlProps('velocity1')} />
            <Knob {...getControlProps('velocity2')} />
            <Knob {...getControlProps('velocity3')} />
            <Knob {...getControlProps('velocity4')} />
            <Knob {...getControlProps('velocity5')} />
            <Knob {...getControlProps('velocity6')} />
            <Knob {...getControlProps('velocity7')} />
            <Knob {...getControlProps('velocity8')} />
          </div>

          {/* Sequencer Controls */}
          <div className="flex gap-6 mt-4">
            <Button {...getControlProps('run_stop')} led ledColor="#00ff00" />
            <Button {...getControlProps('advance')} />
          </div>
        </div>

        {/* PATCH BAY SECTION */}
        <div className="absolute right-[40px] top-[60px] bottom-[40px]">
          <div className="text-[8px] font-label text-[#999] tracking-[0.2em] mb-3 border-b border-[#333] pb-1">
            PATCH BAY
          </div>

          <div className="flex gap-[80px]">
            {/* INPUTS Column */}
            <div>
              <div className="text-[7px] font-label text-[#777] tracking-[0.2em] mb-2">INPUTS</div>
              <div className="flex flex-col gap-[6px]">
                <Jack {...getControlProps('patch_in_trigger')} />
                <Jack {...getControlProps('patch_in_vca_cv')} />
                <Jack {...getControlProps('patch_in_velocity')} />
                <Jack {...getControlProps('patch_in_vca_decay')} />
                <Jack {...getControlProps('patch_in_ext_audio')} />
                <Jack {...getControlProps('patch_in_vcf_decay')} />
                <Jack {...getControlProps('patch_in_noise')} />
                <Jack {...getControlProps('patch_in_vco_decay')} />
                <Jack {...getControlProps('patch_in_vcf_mod')} />
                <Jack {...getControlProps('patch_in_vco1_cv')} />
                <Jack {...getControlProps('patch_in_vco2_cv')} />
                <Jack {...getControlProps('patch_in_tempo')} />
                <Jack {...getControlProps('patch_in_run_stop')} />
                <Jack {...getControlProps('patch_in_advance')} />
                <Jack {...getControlProps('patch_in_clock')} />
              </div>
            </div>

            {/* OUTPUTS Column */}
            <div>
              <div className="text-[7px] font-label text-[#777] tracking-[0.2em] mb-2">OUTPUTS</div>
              <div className="flex flex-col gap-[12px]">
                <Jack {...getControlProps('patch_out_vca')} />
                <Jack {...getControlProps('patch_out_vca_eg')} />
                <Jack {...getControlProps('patch_out_vcf_eg')} />
                <Jack {...getControlProps('patch_out_vco_eg')} />
                <Jack {...getControlProps('patch_out_vco1')} />
                <Jack {...getControlProps('patch_out_vco2')} />
                <Jack {...getControlProps('patch_out_trigger')} />
                <Jack {...getControlProps('patch_out_velocity')} />
                <Jack {...getControlProps('patch_out_pitch')} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info Bar */}
        <div className="absolute bottom-2 left-6 right-6 flex justify-between items-center">
          <div className="text-[7px] text-[#555] font-label tracking-wider">
            60HP • 319mm × 107mm • 24 PATCH POINTS • SEMI-MODULAR ANALOG
          </div>
          {isTeachingMode && currentLesson?.device === device && (
            <div className="text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
              ● TEACHING MODE
            </div>
          )}
        </div>

        {/* Screw Mounts (decorative) */}
        {[
          { x: 20, y: 20 },
          { x: spec.width - 20, y: 20 },
          { x: 20, y: spec.height - 20 },
          { x: spec.width - 20, y: spec.height - 20 },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-[8px] h-[8px] rounded-full bg-[#2a2a2a] border border-[#444]"
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[4px] h-[1px] bg-[#555]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
