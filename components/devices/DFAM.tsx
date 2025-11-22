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

      {/* Main Panel - CSS Grid Layout */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: `${spec.width}px`,
          height: `${spec.height}px`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Grid Container for Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gridTemplateRows: 'repeat(6, 1fr)',
            gap: '10px',
            padding: '20px',
            height: '100%',
          }}
        >
          {/* ROW 1: VCO 1 */}
          <div style={{ gridColumn: '1', gridRow: '1' }}><Knob {...getControlProps('vco1_frequency')} /></div>
          <div style={{ gridColumn: '2', gridRow: '1' }}><Knob {...getControlProps('vco1_eg')} /></div>
          <div style={{ gridColumn: '1', gridRow: '2' }}><Switch {...getControlProps('vco1_wave')} /></div>

          {/* ROW 1: VCO 2 */}
          <div style={{ gridColumn: '3', gridRow: '1' }}><Knob {...getControlProps('vco2_frequency')} /></div>
          <div style={{ gridColumn: '4', gridRow: '1' }}><Knob {...getControlProps('vco2_eg')} /></div>
          <div style={{ gridColumn: '3', gridRow: '2' }}><Switch {...getControlProps('vco2_wave')} /></div>

          {/* FM and Hard Sync */}
          <div style={{ gridColumn: '2', gridRow: '2' }}><Knob {...getControlProps('fm_amount')} /></div>
          <div style={{ gridColumn: '4', gridRow: '2' }}><Switch {...getControlProps('hard_sync')} /></div>

          {/* ROW 2: MIXER */}
          <div style={{ gridColumn: '1', gridRow: '3' }}><Knob {...getControlProps('vco1_level')} /></div>
          <div style={{ gridColumn: '2', gridRow: '3' }}><Knob {...getControlProps('vco2_level')} /></div>
          <div style={{ gridColumn: '3', gridRow: '3' }}><Knob {...getControlProps('noise')} /></div>

          {/* ROW 1-2: FILTER (Right side) */}
          <div style={{ gridColumn: '6', gridRow: '1' }}><Knob {...getControlProps('vcf_cutoff')} /></div>
          <div style={{ gridColumn: '7', gridRow: '1' }}><Knob {...getControlProps('vcf_resonance')} /></div>
          <div style={{ gridColumn: '8', gridRow: '1' }}><Knob {...getControlProps('vcf_eg')} /></div>
          <div style={{ gridColumn: '7', gridRow: '2' }}><Switch {...getControlProps('vcf_mode')} /></div>
          <div style={{ gridColumn: '8', gridRow: '2' }}><Knob {...getControlProps('noise_vcf_mod')} /></div>

          {/* ROW 3: ENVELOPES */}
          <div style={{ gridColumn: '1', gridRow: '4' }}><Knob {...getControlProps('vco_decay')} /></div>
          <div style={{ gridColumn: '2', gridRow: '4' }}><Knob {...getControlProps('vcf_decay')} /></div>
          <div style={{ gridColumn: '3', gridRow: '4' }}><Knob {...getControlProps('vca_decay')} /></div>

          {/* VCA */}
          <div style={{ gridColumn: '6', gridRow: '4' }}><Knob {...getControlProps('vca_eg')} /></div>
          <div style={{ gridColumn: '7', gridRow: '4' }}><Knob {...getControlProps('vca_level')} /></div>

          {/* TEMPO */}
          <div style={{ gridColumn: '8', gridRow: '4' }}><Knob {...getControlProps('tempo')} /></div>

          {/* ROW 5: PITCH SEQUENCER */}
          <div style={{ gridColumn: '1', gridRow: '5' }}><Knob {...getControlProps('pitch1')} /></div>
          <div style={{ gridColumn: '2', gridRow: '5' }}><Knob {...getControlProps('pitch2')} /></div>
          <div style={{ gridColumn: '3', gridRow: '5' }}><Knob {...getControlProps('pitch3')} /></div>
          <div style={{ gridColumn: '4', gridRow: '5' }}><Knob {...getControlProps('pitch4')} /></div>
          <div style={{ gridColumn: '5', gridRow: '5' }}><Knob {...getControlProps('pitch5')} /></div>
          <div style={{ gridColumn: '6', gridRow: '5' }}><Knob {...getControlProps('pitch6')} /></div>
          <div style={{ gridColumn: '7', gridRow: '5' }}><Knob {...getControlProps('pitch7')} /></div>
          <div style={{ gridColumn: '8', gridRow: '5' }}><Knob {...getControlProps('pitch8')} /></div>

          {/* ROW 6: VELOCITY SEQUENCER */}
          <div style={{ gridColumn: '1', gridRow: '6' }}><Knob {...getControlProps('velocity1')} /></div>
          <div style={{ gridColumn: '2', gridRow: '6' }}><Knob {...getControlProps('velocity2')} /></div>
          <div style={{ gridColumn: '3', gridRow: '6' }}><Knob {...getControlProps('velocity3')} /></div>
          <div style={{ gridColumn: '4', gridRow: '6' }}><Knob {...getControlProps('velocity4')} /></div>
          <div style={{ gridColumn: '5', gridRow: '6' }}><Knob {...getControlProps('velocity5')} /></div>
          <div style={{ gridColumn: '6', gridRow: '6' }}><Knob {...getControlProps('velocity6')} /></div>
          <div style={{ gridColumn: '7', gridRow: '6' }}><Knob {...getControlProps('velocity7')} /></div>
          <div style={{ gridColumn: '8', gridRow: '6' }}><Knob {...getControlProps('velocity8')} /></div>

          {/* SEQUENCER BUTTONS */}
          <div style={{ gridColumn: '9', gridRow: '5' }}><Button {...getControlProps('run_stop')} /></div>
          <div style={{ gridColumn: '9', gridRow: '6' }}><Button {...getControlProps('advance')} /></div>

          {/* PATCH BAY - Right side columns */}
          <div style={{ gridColumn: '11 / 12', gridRow: '1 / 7', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
            <div className="text-[7px] font-label text-[#999] tracking-[0.2em] mb-2 text-center border-b border-[#333] pb-1">
              INPUTS
            </div>
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

          <div style={{ gridColumn: '12', gridRow: '1 / 7', display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px' }}>
            <div className="text-[7px] font-label text-[#999] tracking-[0.2em] mb-2 text-center border-b border-[#333] pb-1">
              OUTPUTS
            </div>
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

        {/* MOOG Logo - Bottom Left */}
        <div className="absolute bottom-8 left-8">
          <div className="text-[20px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em] mt-0.5">DRUMMER FROM ANOTHER MOTHER</div>
          <div className="text-[6px] font-label text-[#888] tracking-[0.15em]">SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER</div>
          <div className="text-[9px] font-label text-[#666] tracking-[0.3em] mt-1">moog</div>
        </div>

        {/* Teaching Mode Indicator */}
        {isTeachingMode && currentLesson?.device === device && (
          <div className="absolute top-4 right-[300px] text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
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
