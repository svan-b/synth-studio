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
    <div className="relative mx-auto" style={{ width: '1260px' }}>
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

      {/* Main Panel - GRID SYSTEM: 20 units × 6 units, 1 unit = 60px */}
      <div
        className="relative bg-[#1a1a1a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: '1200px',
          height: '360px',
          display: 'grid',
          gridTemplateColumns: 'repeat(20, 60px)',
          gridTemplateRows: 'repeat(6, 60px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* ROW 1 - OSCILLATORS */}
        <div style={{ gridColumn: '1', gridRow: '1' }}><Knob {...getControlProps('vco_decay')} size="medium" /></div>
        <div style={{ gridColumn: '2', gridRow: '1' }}><Knob {...getControlProps('vco1_eg')} size="medium" /></div>
        <div style={{ gridColumn: '3', gridRow: '1' }}>
          <Knob {...getControlProps('vco1_frequency')} size="medium" />
        </div>
        <div style={{ gridColumn: '3', gridRow: '2', marginTop: '-20px' }}>
          <Switch {...getControlProps('vco1_wave')} />
        </div>

        <div style={{ gridColumn: '5', gridRow: '1' }}><Knob {...getControlProps('fm_amount')} size="medium" /></div>

        <div style={{ gridColumn: '6', gridRow: '1' }}><Knob {...getControlProps('vco2_eg')} size="medium" /></div>
        <div style={{ gridColumn: '7', gridRow: '1' }}>
          <Knob {...getControlProps('vco2_frequency')} size="medium" />
        </div>
        <div style={{ gridColumn: '7', gridRow: '2', marginTop: '-20px' }}>
          <Switch {...getControlProps('vco2_wave')} />
        </div>

        <div style={{ gridColumn: '8', gridRow: '1' }}><Switch {...getControlProps('hard_sync')} /></div>

        {/* ROW 2 - MIXER & FILTER */}
        <div style={{ gridColumn: '1', gridRow: '3' }}><Knob {...getControlProps('tempo')} size="large" /></div>

        <div style={{ gridColumn: '3', gridRow: '3' }}><Knob {...getControlProps('vco1_level')} size="medium" /></div>
        <div style={{ gridColumn: '4', gridRow: '3' }}><Knob {...getControlProps('noise')} size="medium" /></div>
        <div style={{ gridColumn: '5', gridRow: '3' }}><Knob {...getControlProps('vco2_level')} size="medium" /></div>

        <div style={{ gridColumn: '6', gridRow: '3' }}><Knob {...getControlProps('vcf_cutoff')} size="large" /></div>
        <div style={{ gridColumn: '8', gridRow: '3' }}><Knob {...getControlProps('vcf_resonance')} size="medium" /></div>
        <div style={{ gridColumn: '9', gridRow: '3' }}><Knob {...getControlProps('vcf_eg')} size="medium" /></div>
        <div style={{ gridColumn: '10', gridRow: '3' }}><Knob {...getControlProps('vcf_decay')} size="medium" /></div>
        <div style={{ gridColumn: '11', gridRow: '3' }}><Knob {...getControlProps('noise_vcf_mod')} size="medium" /></div>
        <div style={{ gridColumn: '9', gridRow: '4', marginTop: '-20px' }}>
          <Switch {...getControlProps('vcf_mode')} />
        </div>

        <div style={{ gridColumn: '12', gridRow: '3' }}><Knob {...getControlProps('vca_decay')} size="medium" /></div>
        <div style={{ gridColumn: '13', gridRow: '3' }}><Knob {...getControlProps('vca_eg')} size="medium" /></div>
        <div style={{ gridColumn: '14', gridRow: '3' }}><Knob {...getControlProps('vca_level')} size="medium" /></div>

        {/* SEQUENCER BUTTONS */}
        <div style={{ gridColumn: '2', gridRow: '5' }}><Button {...getControlProps('run_stop')} /></div>
        <div style={{ gridColumn: '2', gridRow: '6' }}><Button {...getControlProps('advance')} /></div>

        {/* SEQUENCER - 8-column grid for pitch/velocity */}
        <div
          style={{
            gridColumn: '3 / 11',
            gridRow: '5 / 7',
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '4px',
            padding: '5px',
          }}
        >
          {/* PITCH row */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={`pitch${i}`}>
              <Knob {...getControlProps(`pitch${i}`)} size="small" />
            </div>
          ))}

          {/* VELOCITY row */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={`vel${i}`}>
              <Knob {...getControlProps(`velocity${i}`)} size="small" />
            </div>
          ))}
        </div>

        {/* PATCH BAY - 3×9 grid on right side */}
        <div
          style={{
            gridColumn: '16 / 20',
            gridRow: '1 / 7',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(9, 1fr)',
            gap: '8px',
            padding: '10px',
            background: '#0d0d0d',
            borderRadius: '4px',
            margin: '10px',
          }}
        >
          {/* Inputs */}
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

          {/* Outputs */}
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

        {/* MOOG Logo */}
        <div style={{ gridColumn: '1 / 4', gridRow: '6', alignSelf: 'end', paddingLeft: '8px', paddingBottom: '4px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ddd', letterSpacing: '0.2em', lineHeight: '1' }}>
            DFAM
          </div>
          <div style={{ fontSize: '5px', color: '#888', letterSpacing: '0.15em', marginTop: '2px' }}>
            DRUMMER FROM ANOTHER MOTHER
          </div>
          <div style={{ fontSize: '5px', color: '#888', letterSpacing: '0.15em' }}>
            SEMI-MODULAR ANALOG PERCUSSION SYNTHESIZER
          </div>
          <div style={{ fontSize: '7px', color: '#666', letterSpacing: '0.3em', marginTop: '4px' }}>
            moog
          </div>
        </div>

        {/* Teaching Mode Indicator */}
        {isTeachingMode && currentLesson?.device === device && (
          <div style={{
            gridColumn: '8 / 13',
            gridRow: '1',
            textAlign: 'center',
            fontSize: '8px',
            color: '#00ff88',
            fontWeight: 'bold',
            animation: 'pulse 2s infinite',
          }}>
            ● TEACHING MODE
          </div>
        )}
      </div>
    </div>
  );
}
