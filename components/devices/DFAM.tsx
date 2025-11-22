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
    <div className="relative mx-auto" style={{ width: '1060px' }}>
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

      {/* Main Panel - Grid Layout */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: '1000px',
          height: '500px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Grid Container with Named Areas */}
        <div
          style={{
            display: 'grid',
            gridTemplateAreas: `
              "oscillators oscillators filter filter patchbay"
              "mixer mixer vcf-envelopes vcf-envelopes patchbay"
              "vco-envelopes vco-envelopes vca vca patchbay"
              "sequencer sequencer sequencer sequencer patchbay"
              "sequencer sequencer sequencer sequencer patchbay"
            `,
            gridTemplateColumns: '1fr 1fr 1fr 1fr 180px',
            gridTemplateRows: 'auto auto auto auto auto',
            gap: '20px',
            padding: '30px 20px',
            height: '100%',
          }}
        >
          {/* OSCILLATORS SECTION - Top Left */}
          <div style={{ gridArea: 'oscillators' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">OSCILLATORS</div>
            <div className="grid grid-cols-4 gap-4">
              {/* VCO 1 */}
              <div className="flex flex-col items-center gap-2">
                <Knob {...getControlProps('vco1_frequency')} />
                <Switch {...getControlProps('vco1_wave')} />
              </div>
              <div className="flex flex-col items-center">
                <Knob {...getControlProps('vco1_eg')} />
              </div>

              {/* VCO 2 */}
              <div className="flex flex-col items-center gap-2">
                <Knob {...getControlProps('vco2_frequency')} />
                <Switch {...getControlProps('vco2_wave')} />
              </div>
              <div className="flex flex-col items-center">
                <Knob {...getControlProps('vco2_eg')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Knob {...getControlProps('fm_amount')} />
              <Switch {...getControlProps('hard_sync')} />
            </div>
          </div>

          {/* FILTER SECTION - Top Right */}
          <div style={{ gridArea: 'filter' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">FILTER</div>
            <div className="grid grid-cols-3 gap-3">
              <Knob {...getControlProps('vcf_cutoff')} />
              <Knob {...getControlProps('vcf_resonance')} />
              <Knob {...getControlProps('vcf_eg')} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Switch {...getControlProps('vcf_mode')} />
              <Knob {...getControlProps('noise_vcf_mod')} />
            </div>
          </div>

          {/* MIXER SECTION */}
          <div style={{ gridArea: 'mixer' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">MIXER</div>
            <div className="grid grid-cols-3 gap-4">
              <Knob {...getControlProps('vco1_level')} />
              <Knob {...getControlProps('vco2_level')} />
              <Knob {...getControlProps('noise')} />
            </div>
          </div>

          {/* VCF ENVELOPES */}
          <div style={{ gridArea: 'vcf-envelopes' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">VCF ENVELOPE</div>
            <div className="grid grid-cols-1 gap-4">
              <Knob {...getControlProps('vcf_decay')} />
            </div>
          </div>

          {/* VCO ENVELOPES */}
          <div style={{ gridArea: 'vco-envelopes' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">VCO ENVELOPE</div>
            <div className="grid grid-cols-2 gap-4">
              <Knob {...getControlProps('vco_decay')} />
              <Knob {...getControlProps('tempo')} />
            </div>
          </div>

          {/* VCA SECTION */}
          <div style={{ gridArea: 'vca' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">VCA</div>
            <div className="grid grid-cols-2 gap-4">
              <Knob {...getControlProps('vca_decay')} />
              <Knob {...getControlProps('vca_eg')} />
            </div>
            <div className="mt-4">
              <Knob {...getControlProps('vca_level')} />
            </div>
          </div>

          {/* SEQUENCER - 8 columns x 2 rows */}
          <div style={{ gridArea: 'sequencer' }} className="bg-[#111] rounded p-4 border border-[#222]">
            <div className="text-[8px] font-label text-[#666] tracking-[0.2em] mb-3 text-center">8-STEP SEQUENCER</div>
            <div className="grid grid-cols-8 gap-2 mb-4">
              {/* Pitch row */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={`pitch${i}`} className="flex flex-col items-center">
                  <Knob {...getControlProps(`pitch${i}`)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-8 gap-2">
              {/* Velocity row */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={`vel${i}`} className="flex flex-col items-center">
                  <Knob {...getControlProps(`velocity${i}`)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Button {...getControlProps('run_stop')} />
              <Button {...getControlProps('advance')} />
            </div>
          </div>

          {/* PATCH BAY - Right side */}
          <div style={{ gridArea: 'patchbay' }} className="bg-[#0d0d0d] rounded p-3 border border-[#222] overflow-y-auto">
            <div className="text-[7px] font-label text-[#999] tracking-[0.2em] mb-3 text-center border-b border-[#333] pb-1">
              PATCH BAY
            </div>

            <div className="mb-4">
              <div className="text-[6px] font-label text-[#666] tracking-wider mb-2">INPUTS</div>
              <div className="flex flex-col gap-2">
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

            <div>
              <div className="text-[6px] font-label text-[#666] tracking-wider mb-2">OUTPUTS</div>
              <div className="flex flex-col gap-2">
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

        {/* MOOG Logo - Bottom Left */}
        <div className="absolute bottom-4 left-6">
          <div className="text-[16px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[5px] font-label text-[#888] tracking-[0.15em] mt-0.5">DRUMMER FROM ANOTHER MOTHER</div>
          <div className="text-[5px] font-label text-[#888] tracking-[0.15em]">SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER</div>
          <div className="text-[7px] font-label text-[#666] tracking-[0.3em] mt-1">moog</div>
        </div>

        {/* Teaching Mode Indicator */}
        {isTeachingMode && currentLesson?.device === device && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
            ● TEACHING MODE
          </div>
        )}

        {/* Corner Screws */}
        {[
          { x: 15, y: 15 },
          { x: 985, y: 15 },
          { x: 15, y: 485 },
          { x: 985, y: 485 },
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
