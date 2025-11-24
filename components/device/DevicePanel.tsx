'use client';

import { useMemo, useCallback } from 'react';
import type { DeviceSpec, ControlSpec, KnobSpec, SwitchSpec, ButtonSpec, Lesson } from '@/types';
import ControlRenderer from './ControlRenderer';
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
 * DevicePanel - Accurate DFAM Panel Layout
 * Based on official Moog DFAM panel layout
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

  // Get default value for a control
  const getDefaultValue = useCallback((controlId: string, controlSpec: ControlSpec): number | string | boolean => {
    switch (controlSpec.type) {
      case 'knob':
        return (controlSpec as KnobSpec).default;
      case 'switch':
        return (controlSpec as SwitchSpec).default;
      case 'button':
        return (controlSpec as ButtonSpec).default;
      default:
        return 0;
    }
  }, []);

  // Get current value for a control
  const getValue = useCallback((controlId: string): number | string | boolean => {
    if (values[controlId] !== undefined) {
      return values[controlId];
    }
    const controlSpec = spec.controls[controlId];
    if (controlSpec) {
      return getDefaultValue(controlId, controlSpec);
    }
    return 0;
  }, [values, spec.controls, getDefaultValue]);

  // Check if control is highlighted (current lesson step)
  const isHighlighted = useCallback((controlId: string): boolean => {
    return isTeachingMode && currentStepInfo?.control === controlId;
  }, [isTeachingMode, currentStepInfo]);

  // Get target value for teaching
  const getTargetValue = useCallback((controlId: string): number | string | boolean | undefined => {
    if (!isTeachingMode || !currentStepInfo || currentStepInfo.control !== controlId) {
      return undefined;
    }
    return currentStepInfo.targetValue;
  }, [isTeachingMode, currentStepInfo]);

  // Render a single control
  const renderControl = useCallback((controlId: string) => {
    const controlSpec = spec.controls[controlId];
    if (!controlSpec || controlSpec.type === 'jack') return null;

    return (
      <ControlRenderer
        key={controlId}
        id={controlId}
        spec={controlSpec}
        value={getValue(controlId)}
        onChange={(value) => onChange(controlId, value)}
        highlighted={isHighlighted(controlId)}
        targetValue={getTargetValue(controlId)}
        showTarget={isTeachingMode}
      />
    );
  }, [spec.controls, getValue, onChange, isHighlighted, getTargetValue, isTeachingMode]);

  // Build patch bay jacks from spec
  // x values determine column grouping in PatchBay:
  // col 0: x < 30, col 1: 30-55, col 2: 55-80, col 3: x >= 80
  const patchBayJacks = useMemo(() => {
    if (!spec.patchBay) return [];

    const jacks: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      type: 'input' | 'output';
    }> = [];

    // Map column numbers to x positions for proper grouping
    const columnToX = (col: number) => {
      switch (col) {
        case 0: return 15;
        case 1: return 40;
        case 2: return 65;
        case 3: return 90;
        default: return 15;
      }
    };

    spec.patchBay.inputs.forEach((input) => {
      jacks.push({
        id: input.id,
        label: input.label,
        x: columnToX(input.column),
        y: input.row * 20,
        type: 'input',
      });
    });

    spec.patchBay.outputs.forEach((output) => {
      jacks.push({
        id: output.id,
        label: output.label,
        x: columnToX(output.column),
        y: output.row * 20,
        type: 'output',
      });
    });

    return jacks;
  }, [spec.patchBay]);

  return (
    <div
      className="relative bg-[#0a0a0a] rounded-lg"
      style={{ width: 1100, padding: '15px' }}
    >
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[25px] rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #4a3528 0%, #5C4033 50%, #4a3528 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.4), inset 2px 0 4px rgba(255,255,255,0.05)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-[25px] rounded-r-lg"
        style={{
          background: 'linear-gradient(90deg, #4a3528 0%, #5C4033 50%, #4a3528 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.4), inset -2px 0 4px rgba(255,255,255,0.05)',
        }}
      />

      {/* Main Panel - Accurate DFAM Layout */}
      <div
        className="relative mx-auto rounded border border-[#333]"
        style={{
          width: 1040,
          background: '#f5f5f0',
          padding: '12px 15px',
        }}
      >
        {/* ============================================================ */}
        {/* ROW 1: VCO DECAY, VCO1 EG, VCO1 FREQ, VCO1 LEVEL, CUTOFF, RES, VOLUME */}
        {/* ============================================================ */}
        <div className="flex items-end gap-3 mb-3" style={{ marginLeft: '10px' }}>
          {/* VCO DECAY */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCO DECAY</span>
            {renderControl('vco_decay')}
          </div>

          {/* VCO 1 EG AMOUNT */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCO 1 EG AMOUNT</span>
            {renderControl('vco1_eg_amount')}
          </div>

          {/* VCO 1 FREQUENCY (Large) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-black font-bold mb-1">VCO 1 FREQUENCY</span>
            {renderControl('vco1_frequency')}
          </div>

          {/* VCO 1 LEVEL */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCO 1 LEVEL</span>
            {renderControl('vco1_level')}
          </div>

          {/* Spacer */}
          <div className="w-4" />

          {/* CUTOFF (Large) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-black font-bold mb-1">CUTOFF</span>
            {renderControl('vcf_cutoff')}
          </div>

          {/* RESONANCE */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">RESONANCE</span>
            {renderControl('vcf_resonance')}
          </div>

          {/* Spacer */}
          <div className="w-4" />

          {/* VOLUME (Large) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-black font-bold mb-1">VOLUME</span>
            {renderControl('volume')}
          </div>

          {/* Patch Bay - Right Side */}
          <div className="ml-auto" style={{ position: 'relative', zIndex: 50 }}>
            {/* Will be rendered separately */}
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 2: FM AMT, VCO2 EG, VCO2 FREQ, VCO2/NOISE LEVEL, VCF DECAY, VCF EG, NOISE MOD, VCA DECAY */}
        {/* ============================================================ */}
        <div className="flex items-end gap-3 mb-3" style={{ marginLeft: '10px' }}>
          {/* 1→2 FM AMOUNT */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">1→2 FM AMOUNT</span>
            {renderControl('fm_amount')}
          </div>

          {/* VCO 2 EG AMOUNT */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCO 2 EG AMOUNT</span>
            {renderControl('vco2_eg_amount')}
          </div>

          {/* VCO 2 FREQUENCY (Large) */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-black font-bold mb-1">VCO 2 FREQUENCY</span>
            {renderControl('vco2_frequency')}
          </div>

          {/* VCO 2 LEVEL / NOISE LEVEL */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">NOISE / EXT. LEVEL</span>
            {renderControl('noise_level')}
          </div>

          {/* Spacer */}
          <div className="w-4" />

          {/* VCF DECAY */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCF DECAY</span>
            {renderControl('vcf_decay')}
          </div>

          {/* VCF EG AMOUNT */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCF EG AMOUNT</span>
            {renderControl('vcf_eg_amount')}
          </div>

          {/* NOISE / VCF MOD */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">NOISE / VCF MOD</span>
            {renderControl('noise_vcf_mod')}
          </div>

          {/* Spacer */}
          <div className="w-4" />

          {/* VCA DECAY */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] text-black font-bold mb-1">VCA DECAY</span>
            {renderControl('vca_decay')}
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 3: Switches - SEQ PITCH MOD, VCO1 WAVE, VCO2 WAVE, HARD SYNC, VCF MODE, VCA EG */}
        {/* ============================================================ */}
        <div className="flex items-center gap-4 mb-4 border-t border-b border-gray-300 py-2" style={{ marginLeft: '10px' }}>
          {/* SEQ PITCH MOD */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">SEQ PITCH MOD</span>
            {renderControl('seq_pitch_mod')}
          </div>

          {/* VCO 1 WAVE */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">VCO 1 WAVE</span>
            {renderControl('vco1_wave')}
          </div>

          {/* VCO 2 WAVE */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">VCO 2 WAVE</span>
            {renderControl('vco2_wave')}
          </div>

          {/* HARD SYNC */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">HARD SYNC</span>
            {renderControl('hard_sync')}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* VCO 2 LEVEL (second mixer knob) */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">VCO 2 LEVEL</span>
            {renderControl('vco2_level')}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* VCF MODE (HP/LP) */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">VCF MODE</span>
            {renderControl('vcf_mode')}
          </div>

          {/* VCA EG */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-black font-bold mb-1">VCA EG</span>
            {renderControl('vca_attack_mode')}
          </div>
        </div>

        {/* ============================================================ */}
        {/* ROW 4: TRIGGER, TEMPO, RUN/STOP, ADVANCE + SEQUENCER */}
        {/* ============================================================ */}
        <div className="flex items-start gap-3">
          {/* Transport Controls */}
          <div className="flex items-end gap-2">
            {/* TRIGGER */}
            <div className="flex flex-col items-center">
              <span className="text-[6px] text-black font-bold mb-1">TRIGGER</span>
              {renderControl('trigger')}
            </div>

            {/* TEMPO (Large) */}
            <div className="flex flex-col items-center mx-2">
              <span className="text-[8px] text-black font-bold mb-1">TEMPO</span>
              {renderControl('tempo')}
            </div>

            {/* RUN/STOP */}
            <div className="flex flex-col items-center">
              <span className="text-[6px] text-black font-bold mb-1">RUN / STOP</span>
              {renderControl('run_stop')}
            </div>

            {/* ADVANCE */}
            <div className="flex flex-col items-center">
              <span className="text-[6px] text-black font-bold mb-1">ADVANCE</span>
              {renderControl('advance')}
            </div>
          </div>

          {/* Sequencer */}
          <div className="flex-1 ml-4">
            {/* Step Numbers */}
            <div className="flex justify-center gap-1 mb-1">
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} className="w-11 text-center text-[9px] text-black font-bold">{n}</div>
              ))}
            </div>

            {/* PITCH Row */}
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[7px] text-black font-bold w-8 text-right mr-1">PITCH</span>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8].map(n => renderControl(`pitch_${n}`))}
              </div>
            </div>

            {/* VELOCITY Row */}
            <div className="flex items-center gap-1">
              <span className="text-[7px] text-black font-bold w-8 text-right mr-1">VEL</span>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8].map(n => renderControl(`velocity_${n}`))}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* LOGO */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-300">
          <div>
            <div className="text-2xl font-black text-black tracking-tight">DFAM</div>
            <div className="text-[8px] text-gray-600">DRUMMER FROM ANOTHER MOTHER</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500">SEMI-MODULAR ANALOG</div>
            <div className="text-[9px] text-gray-500">PERCUSSION SYNTHESIZER</div>
          </div>
          <div className="text-2xl font-serif italic text-black">moog</div>
        </div>

        {/* ============================================================ */}
        {/* PATCH BAY - Positioned on Right Side */}
        {/* ============================================================ */}
        {spec.patchBay && patchBayJacks.length > 0 && (
          <div
            className="absolute right-[30px] top-[15px] bg-black rounded p-2"
            style={{
              width: 180,
              height: 320,
              zIndex: 100,
            }}
          >
            <div className="text-[8px] text-white uppercase tracking-wider text-center mb-2 font-bold">
              PATCH BAY
            </div>
            <PatchBay
              jacks={patchBayJacks}
              onConnection={(from, to, color) => {
                console.log(`Patched: ${from} → ${to} (${color})`);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
