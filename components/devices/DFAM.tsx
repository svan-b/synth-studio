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
    <div className="relative mx-auto" style={{ width: '1460px' }}>
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

      {/* Main Panel - 1400×380px (3.7:1 ratio) */}
      <div
        className="relative bg-[#1a1a1a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: '1400px',
          height: '380px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* TOP ROW - Oscillators (y: 40px) */}
        <div className="absolute" style={{ left: '60px', top: '40px' }}><Knob {...getControlProps('vco_decay')} size="medium" /></div>
        <div className="absolute" style={{ left: '120px', top: '40px' }}><Knob {...getControlProps('vco1_eg')} size="medium" /></div>
        <div className="absolute" style={{ left: '180px', top: '40px' }}><Knob {...getControlProps('vco1_frequency')} size="medium" /></div>
        <div className="absolute" style={{ left: '180px', top: '95px' }}><Switch {...getControlProps('vco1_wave')} /></div>

        <div className="absolute" style={{ left: '280px', top: '40px' }}><Knob {...getControlProps('fm_amount')} size="medium" /></div>

        <div className="absolute" style={{ left: '380px', top: '40px' }}><Knob {...getControlProps('vco2_eg')} size="medium" /></div>
        <div className="absolute" style={{ left: '440px', top: '40px' }}><Knob {...getControlProps('vco2_frequency')} size="medium" /></div>
        <div className="absolute" style={{ left: '440px', top: '95px' }}><Switch {...getControlProps('vco2_wave')} /></div>

        <div className="absolute" style={{ left: '540px', top: '60px' }}><Switch {...getControlProps('hard_sync')} /></div>

        {/* MIDDLE ROW - Mixer & Filter (y: 140px) */}
        <div className="absolute" style={{ left: '60px', top: '140px' }}><Knob {...getControlProps('tempo')} size="large" /></div>

        <div className="absolute" style={{ left: '160px', top: '140px' }}><Knob {...getControlProps('vco1_level')} size="medium" /></div>
        <div className="absolute" style={{ left: '220px', top: '140px' }}><Knob {...getControlProps('noise')} size="medium" /></div>
        <div className="absolute" style={{ left: '280px', top: '140px' }}><Knob {...getControlProps('vco2_level')} size="medium" /></div>

        <div className="absolute" style={{ left: '380px', top: '140px' }}><Knob {...getControlProps('vcf_cutoff')} size="large" /></div>
        <div className="absolute" style={{ left: '480px', top: '140px' }}><Knob {...getControlProps('vcf_resonance')} size="medium" /></div>
        <div className="absolute" style={{ left: '540px', top: '140px' }}><Knob {...getControlProps('vcf_eg')} size="medium" /></div>
        <div className="absolute" style={{ left: '600px', top: '140px' }}><Knob {...getControlProps('vcf_decay')} size="medium" /></div>
        <div className="absolute" style={{ left: '660px', top: '140px' }}><Knob {...getControlProps('noise_vcf_mod')} size="medium" /></div>

        <div className="absolute" style={{ left: '540px', top: '195px' }}><Switch {...getControlProps('vcf_mode')} /></div>

        <div className="absolute" style={{ left: '760px', top: '140px' }}><Knob {...getControlProps('vca_decay')} size="medium" /></div>
        <div className="absolute" style={{ left: '820px', top: '140px' }}><Knob {...getControlProps('vca_eg')} size="medium" /></div>
        <div className="absolute" style={{ left: '900px', top: '140px' }}><Knob {...getControlProps('vca_level')} size="medium" /></div>

        {/* SEQUENCER SECTION (y: 240px) */}
        <div className="absolute" style={{ left: '60px', top: '260px' }}><Button {...getControlProps('run_stop')} /></div>
        <div className="absolute" style={{ left: '120px', top: '260px' }}><Button {...getControlProps('advance')} /></div>

        {/* Step numbers */}
        <div className="absolute" style={{ left: '200px', top: '235px', display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} style={{ width: '30px', textAlign: 'center', fontSize: '8px', color: '#666' }}>{i}</div>
          ))}
        </div>

        {/* PITCH row */}
        <div className="absolute" style={{ left: '200px', top: '250px' }}><Knob {...getControlProps('pitch1')} size="small" /></div>
        <div className="absolute" style={{ left: '236px', top: '250px' }}><Knob {...getControlProps('pitch2')} size="small" /></div>
        <div className="absolute" style={{ left: '272px', top: '250px' }}><Knob {...getControlProps('pitch3')} size="small" /></div>
        <div className="absolute" style={{ left: '308px', top: '250px' }}><Knob {...getControlProps('pitch4')} size="small" /></div>
        <div className="absolute" style={{ left: '344px', top: '250px' }}><Knob {...getControlProps('pitch5')} size="small" /></div>
        <div className="absolute" style={{ left: '380px', top: '250px' }}><Knob {...getControlProps('pitch6')} size="small" /></div>
        <div className="absolute" style={{ left: '416px', top: '250px' }}><Knob {...getControlProps('pitch7')} size="small" /></div>
        <div className="absolute" style={{ left: '452px', top: '250px' }}><Knob {...getControlProps('pitch8')} size="small" /></div>

        {/* VELOCITY row */}
        <div className="absolute" style={{ left: '200px', top: '295px' }}><Knob {...getControlProps('velocity1')} size="small" /></div>
        <div className="absolute" style={{ left: '236px', top: '295px' }}><Knob {...getControlProps('velocity2')} size="small" /></div>
        <div className="absolute" style={{ left: '272px', top: '295px' }}><Knob {...getControlProps('velocity3')} size="small" /></div>
        <div className="absolute" style={{ left: '308px', top: '295px' }}><Knob {...getControlProps('velocity4')} size="small" /></div>
        <div className="absolute" style={{ left: '344px', top: '295px' }}><Knob {...getControlProps('velocity5')} size="small" /></div>
        <div className="absolute" style={{ left: '380px', top: '295px' }}><Knob {...getControlProps('velocity6')} size="small" /></div>
        <div className="absolute" style={{ left: '416px', top: '295px' }}><Knob {...getControlProps('velocity7')} size="small" /></div>
        <div className="absolute" style={{ left: '452px', top: '295px' }}><Knob {...getControlProps('velocity8')} size="small" /></div>

        {/* PATCH BAY - 3 columns × 9 rows (right side, x: 1000px) */}
        <div
          className="absolute"
          style={{
            right: '30px',
            top: '30px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '30px 25px',
          }}
        >
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

          {/* Row 6 - Outputs */}
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

        {/* MOOG Logo - Bottom Left */}
        <div className="absolute bottom-6 left-8">
          <div className="text-[18px] font-bold text-[#ddd] tracking-[0.2em] leading-none">DFAM</div>
          <div className="text-[5px] font-label text-[#888] tracking-[0.15em] mt-0.5">DRUMMER FROM ANOTHER MOTHER</div>
          <div className="text-[5px] font-label text-[#888] tracking-[0.15em]">SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER</div>
          <div className="text-[8px] font-label text-[#666] tracking-[0.3em] mt-1">moog</div>
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
          { x: 1385, y: 15 },
          { x: 15, y: 365 },
          { x: 1385, y: 365 },
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
