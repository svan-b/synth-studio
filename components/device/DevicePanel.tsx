'use client';

import { useMemo, useCallback } from 'react';
import type { DeviceSpec, ControlSpec, KnobSpec, SwitchSpec, ButtonSpec, Lesson } from '@/types';
import Knob from '@/components/controls/Knob';
import Switch from '@/components/controls/Switch';
import Button from '@/components/controls/Button';
import PatchBay from '@/components/controls/PatchBay';

interface DevicePanelProps {
  spec: DeviceSpec;
  values: Record<string, number | string | boolean>;
  onChange: (controlId: string, value: number | string | boolean) => void;
  currentLesson?: Lesson;
  currentStep?: number;
  isTeachingMode?: boolean;
}

/**
 * DevicePanel - Accurate DFAM Digital Twin
 * Precisely matches the Moog DFAM hardware layout
 */
export default function DevicePanel({
  spec,
  values,
  onChange,
  currentLesson,
  currentStep = 0,
  isTeachingMode = false,
}: DevicePanelProps) {
  // Get current lesson step info
  const currentStepInfo = useMemo(() => {
    if (!currentLesson || currentStep >= currentLesson.steps.length) return null;
    return currentLesson.steps[currentStep];
  }, [currentLesson, currentStep]);

  // Get value for a control
  const getValue = useCallback((controlId: string): number => {
    if (values[controlId] !== undefined) {
      return values[controlId] as number;
    }
    const controlSpec = spec.controls[controlId];
    if (controlSpec && 'default' in controlSpec) {
      return controlSpec.default as number;
    }
    return 0;
  }, [values, spec.controls]);

  // Check if control is highlighted
  const isHighlighted = useCallback((controlId: string): boolean => {
    return isTeachingMode && currentStepInfo?.control === controlId;
  }, [isTeachingMode, currentStepInfo]);

  // Get target value for teaching
  const getTargetValue = useCallback((controlId: string): number | undefined => {
    if (!isTeachingMode || !currentStepInfo || currentStepInfo.control !== controlId) {
      return undefined;
    }
    return currentStepInfo.targetValue as number;
  }, [isTeachingMode, currentStepInfo]);

  // Build patch bay jacks
  const patchBayJacks = useMemo(() => {
    if (!spec.patchBay) return [];
    const jacks: Array<{
      id: string;
      label: string;
      column: number;
      row: number;
      type: 'input' | 'output';
    }> = [];

    spec.patchBay.inputs.forEach((input) => {
      jacks.push({
        id: input.id,
        label: input.label,
        column: input.column,
        row: input.row,
        type: 'input',
      });
    });

    spec.patchBay.outputs.forEach((output) => {
      jacks.push({
        id: output.id,
        label: output.label,
        column: output.column,
        row: output.row,
        type: 'output',
      });
    });

    return jacks;
  }, [spec.patchBay]);

  // Render a large knob (like VCO FREQ, CUTOFF, VOLUME, TEMPO)
  const LargeKnob = ({ id, label }: { id: string; label: string }) => {
    const controlSpec = spec.controls[id] as KnobSpec;
    if (!controlSpec) return null;
    return (
      <div className="flex flex-col items-center">
        <Knob
          id={id}
          spec={controlSpec}
          value={getValue(id)}
          onChange={(v) => onChange(id, v)}
          highlighted={isHighlighted(id)}
          targetValue={getTargetValue(id)}
          showTarget={isTeachingMode}
        />
      </div>
    );
  };

  // Render a medium knob
  const MediumKnob = ({ id, label }: { id: string; label: string }) => {
    const controlSpec = spec.controls[id] as KnobSpec;
    if (!controlSpec) return null;
    return (
      <div className="flex flex-col items-center">
        <Knob
          id={id}
          spec={{ ...controlSpec, size: 'medium' }}
          value={getValue(id)}
          onChange={(v) => onChange(id, v)}
          highlighted={isHighlighted(id)}
          targetValue={getTargetValue(id)}
          showTarget={isTeachingMode}
        />
      </div>
    );
  };

  // Render a small knob (like VCO LEVEL)
  const SmallKnob = ({ id, label }: { id: string; label: string }) => {
    const controlSpec = spec.controls[id] as KnobSpec;
    if (!controlSpec) return null;
    return (
      <div className="flex flex-col items-center">
        <Knob
          id={id}
          spec={{ ...controlSpec, size: 'small' }}
          value={getValue(id)}
          onChange={(v) => onChange(id, v)}
          highlighted={isHighlighted(id)}
          targetValue={getTargetValue(id)}
          showTarget={isTeachingMode}
        />
      </div>
    );
  };

  // Render a switch
  const SwitchControl = ({ id }: { id: string }) => {
    const controlSpec = spec.controls[id] as SwitchSpec;
    if (!controlSpec) return null;
    return (
      <Switch
        id={id}
        spec={controlSpec}
        value={getValue(id)}
        onChange={(v) => onChange(id, v)}
        highlighted={isHighlighted(id)}
        targetValue={getTargetValue(id)}
      />
    );
  };

  // Render a button
  const ButtonControl = ({ id }: { id: string }) => {
    const controlSpec = spec.controls[id] as ButtonSpec;
    if (!controlSpec) return null;
    return (
      <Button
        id={id}
        spec={controlSpec}
        value={getValue(id) as unknown as boolean}
        onChange={(v) => onChange(id, v)}
        highlighted={isHighlighted(id)}
      />
    );
  };

  return (
    <div
      className="relative rounded-lg"
      style={{
        width: 1100,
        background: '#1a1a1a',
        padding: '12px',
      }}
    >
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[20px] rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-[20px] rounded-r-lg"
        style={{
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.5)',
        }}
      />

      {/* Main Black Panel */}
      <div
        className="relative ml-[20px] mr-[20px] rounded"
        style={{
          background: '#111',
          padding: '15px',
          minHeight: '380px',
        }}
      >
        {/* ============================================================ */}
        {/* ROW 1: VCO Section + Filter Section + Output */}
        {/* ============================================================ */}
        <div className="flex items-start gap-2 mb-4">
          {/* VCO DECAY with SEQ PITCH MOD switch */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[9px] text-white font-bold mb-1 tracking-wide">VCO DECAY</span>
            <LargeKnob id="vco_decay" label="VCO DECAY" />
            <div className="mt-2">
              <span className="text-[7px] text-gray-400 block text-center mb-1">SEQ PITCH MOD</span>
              <SwitchControl id="seq_pitch_mod" />
            </div>
          </div>

          {/* VCO 1 EG AMOUNT */}
          <div className="flex flex-col items-center" style={{ width: 65 }}>
            <span className="text-[8px] text-white font-bold mb-1 text-center leading-tight">VCO 1<br/>EG AMOUNT</span>
            <MediumKnob id="vco1_eg_amount" label="VCO 1 EG AMT" />
          </div>

          {/* VCO 1 FREQUENCY with WAVE switch */}
          <div className="flex flex-col items-center" style={{ width: 80 }}>
            <span className="text-[7px] text-gray-400 mb-1">VCO 1 WAVE</span>
            <SwitchControl id="vco1_wave" />
            <span className="text-[9px] text-white font-bold mt-2 mb-1">VCO 1 FREQUENCY</span>
            <LargeKnob id="vco1_frequency" label="VCO 1 FREQ" />
          </div>

          {/* VCO 1 LEVEL + NOISE LEVEL stacked */}
          <div className="flex flex-col items-center gap-1" style={{ width: 55 }}>
            <span className="text-[7px] text-gray-400">VCO 1 LEVEL</span>
            <SmallKnob id="vco1_level" label="VCO 1 LEVEL" />
            <span className="text-[7px] text-gray-400 mt-1">NOISE / EXT LEVEL</span>
            <SmallKnob id="noise_level" label="NOISE LEVEL" />
          </div>

          {/* VCF MODE Switch (HP/LP) */}
          <div className="flex flex-col items-center" style={{ width: 45 }}>
            <span className="text-[7px] text-gray-400 mb-1">VCF</span>
            <SwitchControl id="vcf_mode" />
          </div>

          {/* CUTOFF */}
          <div className="flex flex-col items-center" style={{ width: 80 }}>
            <span className="text-[9px] text-white font-bold mb-1">CUTOFF</span>
            <LargeKnob id="vcf_cutoff" label="CUTOFF" />
          </div>

          {/* RESONANCE */}
          <div className="flex flex-col items-center" style={{ width: 75 }}>
            <span className="text-[9px] text-white font-bold mb-1">RESONANCE</span>
            <MediumKnob id="vcf_resonance" label="RESONANCE" />
          </div>

          {/* VCA EG Switch */}
          <div className="flex flex-col items-center" style={{ width: 50 }}>
            <span className="text-[7px] text-gray-400 mb-1">VCA EG</span>
            <SwitchControl id="vca_attack_mode" />
          </div>

          {/* VOLUME */}
          <div className="flex flex-col items-center" style={{ width: 75 }}>
            <span className="text-[9px] text-white font-bold mb-1">VOLUME</span>
            <LargeKnob id="volume" label="VOLUME" />
          </div>

          {/* PATCH BAY */}
          <div
            className="ml-auto rounded"
            style={{
              width: 175,
              height: 300,
              background: '#0a0a0a',
              padding: '8px',
              position: 'absolute',
              right: 15,
              top: 15,
            }}
          >
            <PatchBay
              jacks={patchBayJacks}
              onConnection={(from, to, color) => {
                console.log(`Patched: ${from} → ${to} (${color})`);
              }}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 2: FM, VCO2, VCF Envelope, VCA Decay */}
        {/* ============================================================ */}
        <div className="flex items-start gap-2 mb-4">
          {/* 1-2 FM AMOUNT with HARD SYNC */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[8px] text-white font-bold mb-1 text-center leading-tight">1-2 FM<br/>AMOUNT</span>
            <MediumKnob id="fm_amount" label="FM AMOUNT" />
            <div className="mt-2">
              <span className="text-[7px] text-gray-400 block text-center mb-1">HARD SYNC</span>
              <SwitchControl id="hard_sync" />
            </div>
          </div>

          {/* VCO 2 EG AMOUNT */}
          <div className="flex flex-col items-center" style={{ width: 65 }}>
            <span className="text-[8px] text-white font-bold mb-1 text-center leading-tight">VCO 2<br/>EG AMOUNT</span>
            <MediumKnob id="vco2_eg_amount" label="VCO 2 EG AMT" />
          </div>

          {/* VCO 2 FREQUENCY with WAVE switch */}
          <div className="flex flex-col items-center" style={{ width: 80 }}>
            <span className="text-[7px] text-gray-400 mb-1">VCO 2 WAVE</span>
            <SwitchControl id="vco2_wave" />
            <span className="text-[9px] text-white font-bold mt-2 mb-1">VCO 2 FREQUENCY</span>
            <LargeKnob id="vco2_frequency" label="VCO 2 FREQ" />
          </div>

          {/* VCO 2 LEVEL */}
          <div className="flex flex-col items-center" style={{ width: 55 }}>
            <span className="text-[7px] text-gray-400">VCO 2 LEVEL</span>
            <SmallKnob id="vco2_level" label="VCO 2 LEVEL" />
          </div>

          {/* Spacer */}
          <div style={{ width: 45 }} />

          {/* VCF DECAY */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[9px] text-white font-bold mb-1">VCF DECAY</span>
            <MediumKnob id="vcf_decay" label="VCF DECAY" />
          </div>

          {/* VCF EG AMOUNT */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[8px] text-white font-bold mb-1 text-center leading-tight">VCF EG<br/>AMOUNT</span>
            <MediumKnob id="vcf_eg_amount" label="VCF EG AMT" />
          </div>

          {/* NOISE / VCF MOD */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[8px] text-white font-bold mb-1 text-center leading-tight">NOISE /<br/>VCF MOD</span>
            <MediumKnob id="noise_vcf_mod" label="NOISE VCF MOD" />
          </div>

          {/* VCA DECAY */}
          <div className="flex flex-col items-center" style={{ width: 70 }}>
            <span className="text-[9px] text-white font-bold mb-1">VCA DECAY</span>
            <MediumKnob id="vca_decay" label="VCA DECAY" />
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 3: Transport + Sequencer */}
        {/* ============================================================ */}
        <div className="flex items-start gap-3 mt-6">
          {/* TRIGGER Button */}
          <div className="flex flex-col items-center" style={{ width: 50 }}>
            <span className="text-[7px] text-gray-400 mb-1">TRIGGER</span>
            <ButtonControl id="trigger" />
          </div>

          {/* TEMPO + RUN/STOP + ADVANCE */}
          <div className="flex flex-col items-center" style={{ width: 80 }}>
            <span className="text-[9px] text-white font-bold mb-1">TEMPO</span>
            <LargeKnob id="tempo" label="TEMPO" />
            <div className="flex gap-2 mt-2">
              <div className="flex flex-col items-center">
                <span className="text-[6px] text-gray-400 mb-1">RUN/STOP</span>
                <ButtonControl id="run_stop" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[6px] text-gray-400 mb-1">ADVANCE</span>
                <ButtonControl id="advance" />
              </div>
            </div>
          </div>

          {/* 8-Step Sequencer */}
          <div className="flex-1 ml-4">
            {/* PITCH Row Label + Knobs */}
            <div className="flex items-center mb-2">
              <span className="text-[8px] text-white font-bold w-12 text-right mr-3">PITCH</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={`pitch-${n}`} className="flex flex-col items-center">
                    {/* Step LED indicator */}
                    <div
                      className="w-2 h-2 rounded-full mb-1"
                      style={{
                        background: n === 1 ? '#ff3333' : '#331111',
                        boxShadow: n === 1 ? '0 0 4px #ff3333' : 'none',
                      }}
                    />
                    {/* Step number */}
                    <span className="text-[8px] text-white font-bold mb-1">{n}</span>
                    <SmallKnob id={`pitch_${n}`} label={`${n}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* VELOCITY Row */}
            <div className="flex items-center">
              <span className="text-[8px] text-white font-bold w-12 text-right mr-3">VELOCITY</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={`vel-${n}`} className="flex flex-col items-center">
                    <SmallKnob id={`velocity_${n}`} label={`${n}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Footer: DFAM Branding */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between mt-6 pt-3 border-t border-gray-800">
          <div>
            <div className="text-xl font-black text-white tracking-tight">DFAM</div>
            <div className="text-[7px] text-gray-500 tracking-wide">DRUMMER FROM ANOTHER MOTHER</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-gray-500">SEMI-MODULAR ANALOG</div>
            <div className="text-[8px] text-gray-500">PERCUSSION SYNTHESIZER</div>
          </div>
          <div
            className="text-2xl font-serif italic text-white"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            moog
          </div>
        </div>
      </div>
    </div>
  );
}
