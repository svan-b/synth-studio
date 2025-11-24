'use client';

import { useMemo } from 'react';
import type { DeviceSpec, KnobSpec, SwitchSpec, ButtonSpec, Lesson } from '@/types';
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
 * Layout precisely matches the Moog DFAM hardware panel
 * Reference: https://api.moogmusic.com/sites/default/files/2018-04/DFAM_Manual.pdf
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

  // Get value for a control - direct function, not memoized to avoid stale closures
  const getValue = (controlId: string): number => {
    if (values[controlId] !== undefined) {
      return values[controlId] as number;
    }
    const controlSpec = spec.controls[controlId];
    if (controlSpec && 'default' in controlSpec) {
      return controlSpec.default as number;
    }
    return 0;
  };

  // Check if control is highlighted
  const isHighlighted = (controlId: string): boolean => {
    return isTeachingMode && currentStepInfo?.control === controlId;
  };

  // Get target value for teaching
  const getTargetValue = (controlId: string): number | undefined => {
    if (!isTeachingMode || !currentStepInfo || currentStepInfo.control !== controlId) {
      return undefined;
    }
    return currentStepInfo.targetValue as number;
  };

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

  // Render a knob - direct function call for proper onChange binding
  const renderKnob = (id: string, sizeOverride?: 'small' | 'medium' | 'large') => {
    const controlSpec = spec.controls[id] as KnobSpec;
    if (!controlSpec) return null;
    const finalSpec = sizeOverride ? { ...controlSpec, size: sizeOverride } : controlSpec;
    return (
      <Knob
        key={id}
        id={id}
        spec={finalSpec}
        value={getValue(id)}
        onChange={(v) => onChange(id, v)}
        highlighted={isHighlighted(id)}
        targetValue={getTargetValue(id)}
        showTarget={isTeachingMode}
      />
    );
  };

  // Render a switch
  const renderSwitch = (id: string) => {
    const controlSpec = spec.controls[id] as SwitchSpec;
    if (!controlSpec) return null;
    return (
      <Switch
        key={id}
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
  const renderButton = (id: string) => {
    const controlSpec = spec.controls[id] as ButtonSpec;
    if (!controlSpec) return null;
    return (
      <Button
        key={id}
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
        width: 1200,
        background: '#1a1a1a',
        padding: '12px',
      }}
    >
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[24px] rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-[24px] rounded-r-lg"
        style={{
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.5)',
        }}
      />

      {/* Main Black Panel */}
      <div
        className="relative ml-[24px] mr-[24px] rounded"
        style={{
          background: '#111',
          padding: '20px',
        }}
      >
        {/* Main layout: Controls on left, Patch Bay on right */}
        <div className="flex gap-6">
          {/* Left side: All controls */}
          <div className="flex-1">
            {/* ============================================================ */}
            {/* ROW 1: VCO DECAY, VCO 1 EG, VCO 1 FREQ, VCO 1 LEVEL, NOISE, CUTOFF, RESONANCE, VCA EG, VOLUME */}
            {/* ============================================================ */}
            <div className="flex items-start gap-3 mb-4">
              {/* VCO DECAY with SEQ PITCH MOD */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VCO DECAY</span>
                {renderKnob('vco_decay', 'large')}
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-[6px] text-gray-500 mb-1">SEQ PITCH MOD</span>
                  {renderSwitch('seq_pitch_mod')}
                </div>
              </div>

              {/* VCO 1 EG AMOUNT */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-gray-400 mb-1">VCO 1 EG AMT</span>
                {renderKnob('vco1_eg_amount', 'medium')}
              </div>

              {/* VCO 1 FREQUENCY with WAVE switch */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VCO 1 FREQUENCY</span>
                {renderKnob('vco1_frequency', 'large')}
                <div className="mt-1 flex flex-col items-center">
                  <span className="text-[6px] text-gray-500 mb-1">VCO 1 WAVE</span>
                  {renderSwitch('vco1_wave')}
                </div>
              </div>

              {/* VCO 1 LEVEL */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-400 mb-1">VCO 1 LEVEL</span>
                {renderKnob('vco1_level', 'small')}
              </div>

              {/* NOISE / EXT LEVEL */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-400 mb-1 text-center">NOISE /<br/>EXT LEVEL</span>
                {renderKnob('noise_level', 'small')}
              </div>

              {/* Spacer */}
              <div className="w-2" />

              {/* CUTOFF with VCF switch */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">CUTOFF</span>
                {renderKnob('vcf_cutoff', 'large')}
                <div className="mt-1 flex flex-col items-center">
                  <span className="text-[6px] text-gray-500 mb-1">VCF</span>
                  {renderSwitch('vcf_mode')}
                </div>
              </div>

              {/* RESONANCE */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">RESONANCE</span>
                {renderKnob('vcf_resonance', 'large')}
              </div>

              {/* Spacer */}
              <div className="w-2" />

              {/* VCA EG switch */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-400 mb-1">VCA EG</span>
                {renderSwitch('vca_attack_mode')}
              </div>

              {/* VOLUME */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VOLUME</span>
                {renderKnob('volume', 'large')}
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 2: 1-2 FM, VCO 2 EG, VCO 2 FREQ, VCO 2 LEVEL, VCF DECAY, VCF EG, NOISE/VCF MOD, VCA DECAY */}
            {/* ============================================================ */}
            <div className="flex items-start gap-3 mb-4">
              {/* 1-2 FM AMOUNT with HARD SYNC */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">1→2 FM AMOUNT</span>
                {renderKnob('fm_amount', 'large')}
                <div className="mt-2 flex flex-col items-center">
                  <span className="text-[6px] text-gray-500 mb-1">HARD SYNC</span>
                  {renderSwitch('hard_sync')}
                </div>
              </div>

              {/* VCO 2 EG AMOUNT */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-gray-400 mb-1">VCO 2 EG AMT</span>
                {renderKnob('vco2_eg_amount', 'medium')}
              </div>

              {/* VCO 2 FREQUENCY with WAVE switch */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VCO 2 FREQUENCY</span>
                {renderKnob('vco2_frequency', 'large')}
                <div className="mt-1 flex flex-col items-center">
                  <span className="text-[6px] text-gray-500 mb-1">VCO 2 WAVE</span>
                  {renderSwitch('vco2_wave')}
                </div>
              </div>

              {/* VCO 2 LEVEL */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-400 mb-1">VCO 2 LEVEL</span>
                {renderKnob('vco2_level', 'small')}
              </div>

              {/* Spacer to align with row 1 */}
              <div className="w-[40px]" />

              {/* VCF DECAY */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VCF DECAY</span>
                {renderKnob('vcf_decay', 'large')}
              </div>

              {/* VCF EG AMOUNT */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-gray-400 mb-1">VCF EG AMT</span>
                {renderKnob('vcf_eg_amount', 'medium')}
              </div>

              {/* NOISE / VCF MOD */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-gray-400 mb-1 text-center">NOISE /<br/>VCF MOD</span>
                {renderKnob('noise_vcf_mod', 'medium')}
              </div>

              {/* VCA DECAY */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-white font-bold mb-1">VCA DECAY</span>
                {renderKnob('vca_decay', 'large')}
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 3: SEQUENCER / TRANSPORT */}
            {/* ============================================================ */}
            <div
              className="flex items-start gap-4 pt-4"
              style={{ borderTop: '1px solid #333' }}
            >
              {/* Transport Controls */}
              <div className="flex items-center gap-3">
                {/* TRIGGER Button */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-white font-bold mb-1">TRIGGER</span>
                  {renderButton('trigger')}
                </div>

                {/* TEMPO */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-white font-bold mb-1">TEMPO</span>
                  {renderKnob('tempo', 'large')}
                  <div className="flex gap-2 mt-2">
                    <div className="flex flex-col items-center">
                      <span className="text-[6px] text-gray-500 mb-1">RUN / STOP</span>
                      {renderButton('run_stop')}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[6px] text-gray-500 mb-1">ADVANCE</span>
                      {renderButton('advance')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 8-Step Sequencer */}
              <div className="flex-1 ml-4">
                {/* Step Numbers */}
                <div className="flex gap-1 mb-1 ml-[50px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div key={`step-${n}`} className="w-[38px] flex flex-col items-center">
                      <span className="text-[10px] text-white font-bold">{n}</span>
                    </div>
                  ))}
                </div>

                {/* PITCH Row */}
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[8px] text-white font-bold w-[46px] text-right mr-1">PITCH</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div key={`pitch-${n}`} className="w-[38px] flex justify-center">
                      {renderKnob(`pitch_${n}`, 'small')}
                    </div>
                  ))}
                </div>

                {/* Step LEDs */}
                <div className="flex gap-1 mb-2 ml-[50px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div key={`led-${n}`} className="w-[38px] flex justify-center">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          background: n === 1 ? '#ff3333' : '#331111',
                          boxShadow: n === 1 ? '0 0 8px #ff3333' : 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* VELOCITY Row */}
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-white font-bold w-[46px] text-right mr-1">VELOCITY</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div key={`vel-${n}`} className="w-[38px] flex justify-center">
                      {renderKnob(`velocity_${n}`, 'small')}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* Footer: DFAM Branding */}
            {/* ============================================================ */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
              <div>
                <div className="text-2xl font-black text-white tracking-tight">DFAM</div>
                <div className="text-[8px] text-gray-500 tracking-widest">DRUMMER FROM ANOTHER MOTHER</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-gray-500">SEMI-MODULAR ANALOG</div>
                <div className="text-[9px] text-gray-500">PERCUSSION SYNTHESIZER</div>
              </div>
              <div
                className="text-3xl font-serif italic text-white"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                moog
              </div>
            </div>
          </div>

          {/* Right side: Patch Bay */}
          <div
            className="flex-shrink-0 rounded"
            style={{
              width: 180,
              background: '#0a0a0a',
              padding: '8px',
              alignSelf: 'stretch',
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
      </div>
    </div>
  );
}
