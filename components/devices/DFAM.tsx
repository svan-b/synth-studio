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

      {/* Main Panel - HORIZONTAL layout matching real DFAM */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: `${spec.width}px`,
          height: `${spec.height}px`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* TOP ROW - OSCILLATORS & FILTER */}
        <div className="absolute left-[30px] top-[30px] right-[280px] flex gap-[20px]">
          {/* VCO Section */}
          <div className="flex gap-[16px]">
            <Knob {...getControlProps('vco_decay')} />
            <div className="flex flex-col items-center gap-1">
              <Knob {...getControlProps('vco1_eg')} />
              <Switch {...getControlProps('vco1_wave')} />
            </div>
            <Knob {...getControlProps('vco1_frequency')} />
          </div>

          <div className="flex gap-[16px]">
            <Knob {...getControlProps('vco1_level')} />
            <Knob {...getControlProps('vcf_cutoff')} />
            <Knob {...getControlProps('vcf_resonance')} />
            <div className="flex flex-col items-center gap-1">
              <Knob {...getControlProps('vca_eg')} />
              <Switch {...getControlProps('vcf_mode')} />
            </div>
            <Knob {...getControlProps('vca_level')} />
          </div>
        </div>

        {/* MIDDLE ROW - MORE CONTROLS */}
        <div className="absolute left-[30px] top-[170px] right-[280px] flex gap-[20px]">
          <div className="flex gap-[16px]">
            <Knob {...getControlProps('fm_amount')} />
            <Switch {...getControlProps('hard_sync')} />
            <div className="flex flex-col items-center gap-1">
              <Knob {...getControlProps('vco2_eg')} />
              <Switch {...getControlProps('vco2_wave')} />
            </div>
            <Knob {...getControlProps('vco2_frequency')} />
          </div>

          <div className="flex gap-[16px]">
            <Knob {...getControlProps('vco2_level')} />
            <Knob {...getControlProps('noise')} />
            <Knob {...getControlProps('vcf_decay')} />
            <Knob {...getControlProps('vcf_eg')} />
            <Knob {...getControlProps('noise_vcf_mod')} />
            <Knob {...getControlProps('vca_decay')} />
          </div>
        </div>

        {/* BOTTOM ROW - TEMPO & SEQUENCER */}
        <div className="absolute left-[30px] bottom-[30px] right-[280px] flex gap-[20px] items-end">
          {/* Tempo */}
          <div>
            <Knob {...getControlProps('tempo')} />
          </div>

          {/* Sequencer Controls */}
          <div className="flex gap-[10px] mb-4">
            <Button {...getControlProps('run_stop')} led ledColor="#00ff00" />
            <Button {...getControlProps('advance')} />
          </div>

          {/* 8-Step Sequencer - 2 rows of 8 small knobs */}
          <div className="flex flex-col gap-[8px]">
            {/* PITCH Row */}
            <div className="flex gap-[12px]">
              <Knob {...getControlProps('pitch1')} />
              <Knob {...getControlProps('pitch2')} />
              <Knob {...getControlProps('pitch3')} />
              <Knob {...getControlProps('pitch4')} />
              <Knob {...getControlProps('pitch5')} />
              <Knob {...getControlProps('pitch6')} />
              <Knob {...getControlProps('pitch7')} />
              <Knob {...getControlProps('pitch8')} />
            </div>
            {/* VELOCITY Row */}
            <div className="flex gap-[12px]">
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
        </div>

        {/* PATCH BAY - Right side, 3 columns × 8 rows grid */}
        <div className="absolute right-[30px] top-[30px]" style={{ width: '200px' }}>
          <div className="text-[7px] font-label text-[#999] tracking-[0.2em] mb-3 text-center border-b border-[#333] pb-1">
            PATCH BAY
          </div>

          {/* 3-column grid layout */}
          <div className="grid grid-cols-3 gap-x-[14px] gap-y-[14px]">
            {/* Row 1 */}
            <Jack {...getControlProps('patch_in_trigger')} />
            <Jack {...getControlProps('patch_in_vca_cv')} />
            <Jack {...getControlProps('patch_in_velocity')} />

            {/* Row 2 */}
            <Jack {...getControlProps('patch_in_vca_decay')} />
            <Jack {...getControlProps('patch_in_ext_audio')} />
            <Jack {...getControlProps('patch_in_vcf_decay')} />

            {/* Row 3 */}
            <Jack {...getControlProps('patch_in_noise')} />
            <Jack {...getControlProps('patch_in_vco_decay')} />
            <Jack {...getControlProps('patch_in_vcf_mod')} />

            {/* Row 4 */}
            <Jack {...getControlProps('patch_in_vco1_cv')} />
            <Jack {...getControlProps('patch_in_vco2_cv')} />
            <Jack {...getControlProps('patch_in_tempo')} />

            {/* Row 5 */}
            <Jack {...getControlProps('patch_in_run_stop')} />
            <Jack {...getControlProps('patch_in_advance')} />
            <Jack {...getControlProps('patch_in_clock')} />

            {/* Row 6 - Outputs start */}
            <Jack {...getControlProps('patch_out_vca')} />
            <Jack {...getControlProps('patch_out_vca_eg')} />
            <Jack {...getControlProps('patch_out_vcf_eg')} />

            {/* Row 7 */}
            <Jack {...getControlProps('patch_out_vco_eg')} />
            <Jack {...getControlProps('patch_out_vco1')} />
            <Jack {...getControlProps('patch_out_vco2')} />

            {/* Row 8 */}
            <Jack {...getControlProps('patch_out_trigger')} />
            <Jack {...getControlProps('patch_out_velocity')} />
            <Jack {...getControlProps('patch_out_pitch')} />
          </div>
        </div>

        {/* MOOG Logo - Bottom Left */}
        <div className="absolute bottom-4 left-6">
          <div className="text-[20px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em] mt-0.5">DRUMMER FROM ANOTHER MOTHER</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em]">SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER</div>
          <div className="text-[9px] font-label text-[#666] tracking-[0.3em] mt-1">moog</div>
        </div>

        {/* Teaching Mode Indicator */}
        {isTeachingMode && currentLesson?.device === device && (
          <div className="absolute top-2 right-[300px] text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
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
