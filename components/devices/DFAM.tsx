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

      {/* Main Panel - Hardware-accurate layout */}
      <div
        className="relative bg-[#0a0a0a] mx-[30px] border-t-2 border-b-2 border-[#1a1a1a]"
        style={{
          width: '1200px',
          height: '450px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* TOP SECTION - Oscillators */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: '40px',
            display: 'flex',
            gap: '25px',
            alignItems: 'flex-start',
          }}
        >
          {/* VCO Decay */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <Knob {...getControlProps('vco_decay')} />
            <div style={{ fontSize: '7px', color: '#999', textTransform: 'uppercase' }}>SEQ PITCH MOD</div>
          </div>

          {/* VCO 1 Group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Knob {...getControlProps('vco1_eg')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Knob {...getControlProps('vco1_frequency')} />
            <Switch {...getControlProps('vco1_wave')} />
          </div>

          {/* FM Amount */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginTop: '20px' }}>
            <Knob {...getControlProps('fm_amount')} />
            <div style={{ fontSize: '6px', color: '#666' }}>1→2 FM AMOUNT</div>
          </div>

          {/* VCO 2 Group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Knob {...getControlProps('vco2_eg')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Knob {...getControlProps('vco2_frequency')} />
            <Switch {...getControlProps('vco2_wave')} />
          </div>

          {/* Hard Sync */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginTop: '20px' }}>
            <Switch {...getControlProps('hard_sync')} />
          </div>
        </div>

        {/* MIDDLE SECTION - Mixer & Filter */}
        <div
          style={{
            position: 'absolute',
            top: '160px',
            left: '40px',
            display: 'flex',
            gap: '30px',
            alignItems: 'center',
          }}
        >
          {/* TEMPO - Large knob */}
          <Knob {...getControlProps('tempo')} size="large" />

          {/* Mixer Group - VCO levels */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <Knob {...getControlProps('vco1_level')} />
            <Knob {...getControlProps('noise')} />
            <Knob {...getControlProps('vco2_level')} />
          </div>

          {/* Filter Group */}
          <Knob {...getControlProps('vcf_cutoff')} size="large" />
          <Knob {...getControlProps('vcf_resonance')} />
          <Knob {...getControlProps('vcf_eg')} />
          <Knob {...getControlProps('vcf_decay')} />
          <Knob {...getControlProps('noise_vcf_mod')} />

          {/* VCA Level (Volume) */}
          <Knob {...getControlProps('vca_level')} />
        </div>

        {/* VCF Mode Switch - Below filter section */}
        <div
          style={{
            position: 'absolute',
            top: '240px',
            left: '580px',
          }}
        >
          <Switch {...getControlProps('vcf_mode')} />
        </div>

        {/* BOTTOM SECTION - VCA & Sequencer */}
        <div
          style={{
            position: 'absolute',
            top: '290px',
            left: '40px',
            display: 'flex',
            gap: '30px',
            alignItems: 'flex-start',
          }}
        >
          {/* VCA Controls */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Knob {...getControlProps('vca_decay')} />
            <Knob {...getControlProps('vca_eg')} />
          </div>

          {/* 8-STEP SEQUENCER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {/* Step numbers */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '5px',
              paddingLeft: '12px',
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} style={{
                  width: '35px',
                  textAlign: 'center',
                  fontSize: '10px',
                  color: '#666',
                  fontWeight: 'bold',
                }}>
                  {i}
                </div>
              ))}
            </div>

            {/* PITCH row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Knob key={`pitch${i}`} {...getControlProps(`pitch${i}`)} size="small" />
              ))}
            </div>

            {/* VELOCITY row */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Knob key={`vel${i}`} {...getControlProps(`velocity${i}`)} size="small" />
              ))}
            </div>
          </div>

          {/* Sequencer Transport Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
            <Button {...getControlProps('run_stop')} />
            <Button {...getControlProps('advance')} />
          </div>
        </div>

        {/* PATCH BAY - Right side, 3 columns x 5 rows */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            right: '30px',
            background: '#0d0d0d',
            borderRadius: '6px',
            padding: '15px',
            border: '1px solid #222',
          }}
        >
          <div style={{
            fontSize: '8px',
            color: '#999',
            textAlign: 'center',
            marginBottom: '12px',
            letterSpacing: '0.1em',
            borderBottom: '1px solid #333',
            paddingBottom: '8px',
          }}>
            PATCH BAY
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '15px 12px',
          }}>
            {/* Column 1 - Inputs */}
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] text-teaching-current font-bold animate-pulse tracking-wider">
            ● TEACHING MODE
          </div>
        )}

        {/* Corner Screws */}
        {[
          { x: 15, y: 15 },
          { x: 1185, y: 15 },
          { x: 15, y: 435 },
          { x: 1185, y: 435 },
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
