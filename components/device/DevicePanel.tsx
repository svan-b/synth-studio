'use client';

import { useMemo, useCallback } from 'react';
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

  // Render a knob with configurable size
  const renderKnob = useCallback((id: string, sizeOverride?: 'small' | 'medium' | 'large') => {
    const controlSpec = spec.controls[id] as KnobSpec;
    if (!controlSpec) return null;
    const finalSpec = sizeOverride ? { ...controlSpec, size: sizeOverride } : controlSpec;
    return (
      <Knob
        id={id}
        spec={finalSpec}
        value={getValue(id)}
        onChange={(v) => onChange(id, v)}
        highlighted={isHighlighted(id)}
        targetValue={getTargetValue(id)}
        showTarget={isTeachingMode}
      />
    );
  }, [spec.controls, getValue, onChange, isHighlighted, getTargetValue, isTeachingMode]);

  // Render a switch
  const renderSwitch = useCallback((id: string) => {
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
  }, [spec.controls, getValue, onChange, isHighlighted, getTargetValue]);

  // Render a button
  const renderButton = useCallback((id: string) => {
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
  }, [spec.controls, getValue, onChange, isHighlighted]);

  // Control group with label
  const ControlGroup = ({ children, label, width = 'auto', className = '' }: {
    children: React.ReactNode;
    label?: string;
    width?: string | number;
    className?: string;
  }) => (
    <div className={`flex flex-col items-center ${className}`} style={{ width }}>
      {label && (
        <span className="text-[8px] text-gray-400 font-bold mb-1 tracking-wide text-center leading-tight whitespace-pre-line">
          {label}
        </span>
      )}
      {children}
    </div>
  );

  // Section label
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[9px] text-white font-bold tracking-wide">
      {children}
    </span>
  );

  return (
    <div
      className="relative rounded-lg"
      style={{
        width: 1150,
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
          padding: '16px 20px',
          minHeight: '420px',
        }}
      >
        {/* Main layout: Controls on left, Patch Bay on right */}
        <div className="flex gap-5">
          {/* Left side: All controls */}
          <div className="flex-1">
            {/* ============================================================ */}
            {/* ROW 1: VCO Envelope + VCO 1 + Mixer + Filter + VCA */}
            {/* Matches actual DFAM top row from left to right */}
            {/* ============================================================ */}
            <div className="flex items-start gap-4 mb-5">
              {/* VCO DECAY Section */}
              <div className="flex flex-col items-center" style={{ width: 70 }}>
                <SectionLabel>VCO DECAY</SectionLabel>
                <div className="mt-1">{renderKnob('vco_decay', 'large')}</div>
                <div className="mt-3">
                  <span className="text-[7px] text-gray-500 block text-center mb-1">SEQ PITCH MOD</span>
                  {renderSwitch('seq_pitch_mod')}
                </div>
              </div>

              {/* VCO 1 Section */}
              <div className="flex items-start gap-2" style={{ borderLeft: '1px solid #333', paddingLeft: 12 }}>
                {/* VCO 1 EG Amount */}
                <ControlGroup label="VCO 1\nEG AMT" width={55}>
                  {renderKnob('vco1_eg_amount', 'medium')}
                </ControlGroup>

                {/* VCO 1 Frequency with Wave Switch */}
                <div className="flex flex-col items-center" style={{ width: 75 }}>
                  <span className="text-[7px] text-gray-500 mb-1">VCO 1 WAVE</span>
                  {renderSwitch('vco1_wave')}
                  <SectionLabel>VCO 1</SectionLabel>
                  <div className="mt-1">{renderKnob('vco1_frequency', 'large')}</div>
                </div>
              </div>

              {/* FM Section */}
              <div className="flex items-start gap-2" style={{ borderLeft: '1px solid #333', paddingLeft: 12 }}>
                {/* 1→2 FM Amount */}
                <div className="flex flex-col items-center" style={{ width: 60 }}>
                  <ControlGroup label="1→2 FM\nAMT">
                    {renderKnob('fm_amount', 'medium')}
                  </ControlGroup>
                  <div className="mt-2">
                    <span className="text-[7px] text-gray-500 block text-center mb-1">HARD SYNC</span>
                    {renderSwitch('hard_sync')}
                  </div>
                </div>

                {/* VCO 2 EG Amount */}
                <ControlGroup label="VCO 2\nEG AMT" width={55}>
                  {renderKnob('vco2_eg_amount', 'medium')}
                </ControlGroup>

                {/* VCO 2 Frequency with Wave Switch */}
                <div className="flex flex-col items-center" style={{ width: 75 }}>
                  <span className="text-[7px] text-gray-500 mb-1">VCO 2 WAVE</span>
                  {renderSwitch('vco2_wave')}
                  <SectionLabel>VCO 2</SectionLabel>
                  <div className="mt-1">{renderKnob('vco2_frequency', 'large')}</div>
                </div>
              </div>

              {/* Mixer Section */}
              <div className="flex flex-col items-center gap-1" style={{ borderLeft: '1px solid #333', paddingLeft: 12, width: 55 }}>
                <SectionLabel>MIXER</SectionLabel>
                <span className="text-[6px] text-gray-500">VCO 1</span>
                {renderKnob('vco1_level', 'small')}
                <span className="text-[6px] text-gray-500 mt-1">VCO 2</span>
                {renderKnob('vco2_level', 'small')}
                <span className="text-[6px] text-gray-500 mt-1">NOISE</span>
                {renderKnob('noise_level', 'small')}
              </div>

              {/* Filter Section */}
              <div className="flex items-start gap-3" style={{ borderLeft: '1px solid #333', paddingLeft: 12 }}>
                {/* VCF Mode Switch */}
                <div className="flex flex-col items-center" style={{ width: 40 }}>
                  <span className="text-[7px] text-gray-500 mb-1">VCF</span>
                  {renderSwitch('vcf_mode')}
                </div>

                {/* Cutoff */}
                <ControlGroup label="" width={70}>
                  <SectionLabel>CUTOFF</SectionLabel>
                  <div className="mt-1">{renderKnob('vcf_cutoff', 'large')}</div>
                </ControlGroup>

                {/* Resonance */}
                <ControlGroup label="RESONANCE" width={60}>
                  {renderKnob('vcf_resonance', 'medium')}
                </ControlGroup>

                {/* VCF EG Amount */}
                <ControlGroup label="VCF EG\nAMT" width={55}>
                  {renderKnob('vcf_eg_amount', 'medium')}
                </ControlGroup>

                {/* VCF Decay */}
                <ControlGroup label="VCF\nDECAY" width={55}>
                  {renderKnob('vcf_decay', 'medium')}
                </ControlGroup>

                {/* Noise/VCF Mod */}
                <ControlGroup label="NOISE\nVCF MOD" width={55}>
                  {renderKnob('noise_vcf_mod', 'small')}
                </ControlGroup>
              </div>

              {/* VCA Section */}
              <div className="flex items-start gap-2" style={{ borderLeft: '1px solid #333', paddingLeft: 12 }}>
                {/* VCA Mode Switch */}
                <div className="flex flex-col items-center" style={{ width: 45 }}>
                  <span className="text-[7px] text-gray-500 mb-1">VCA EG</span>
                  {renderSwitch('vca_attack_mode')}
                </div>

                {/* VCA Decay */}
                <ControlGroup label="VCA\nDECAY" width={55}>
                  {renderKnob('vca_decay', 'medium')}
                </ControlGroup>

                {/* Volume */}
                <ControlGroup label="" width={70}>
                  <SectionLabel>VOLUME</SectionLabel>
                  <div className="mt-1">{renderKnob('volume', 'large')}</div>
                </ControlGroup>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 2: 8-Step Sequencer */}
            {/* ============================================================ */}
            <div
              className="flex items-start gap-4 pt-4"
              style={{ borderTop: '1px solid #333' }}
            >
              {/* Transport Controls */}
              <div className="flex items-start gap-3">
                {/* TRIGGER Button */}
                <div className="flex flex-col items-center" style={{ width: 45 }}>
                  <span className="text-[7px] text-gray-500 mb-1">TRIGGER</span>
                  {renderButton('trigger')}
                </div>

                {/* TEMPO */}
                <div className="flex flex-col items-center" style={{ width: 70 }}>
                  <SectionLabel>TEMPO</SectionLabel>
                  <div className="mt-1">{renderKnob('tempo', 'large')}</div>
                </div>

                {/* RUN/STOP Button */}
                <div className="flex flex-col items-center" style={{ width: 50 }}>
                  <span className="text-[7px] text-gray-500 mb-1">RUN/STOP</span>
                  {renderButton('run_stop')}
                </div>

                {/* ADVANCE Button */}
                <div className="flex flex-col items-center" style={{ width: 50 }}>
                  <span className="text-[7px] text-gray-500 mb-1">ADV/CLK</span>
                  {renderButton('advance')}
                </div>
              </div>

              {/* 8-Step Sequencer */}
              <div className="flex-1" style={{ borderLeft: '1px solid #333', paddingLeft: 16 }}>
                <div className="text-[8px] text-gray-500 mb-2 text-center font-bold">8-STEP SEQUENCER</div>

                {/* Step Numbers and LEDs */}
                <div className="flex justify-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div key={`step-${n}`} className="flex flex-col items-center" style={{ width: 36 }}>
                      {/* Step LED indicator */}
                      <div
                        className="w-2 h-2 rounded-full mb-1"
                        style={{
                          background: n === 1 ? '#ff3333' : '#331111',
                          boxShadow: n === 1 ? '0 0 6px #ff3333' : 'none',
                        }}
                      />
                      {/* Step number */}
                      <span className="text-[8px] text-white font-bold">{n}</span>
                    </div>
                  ))}
                </div>

                {/* PITCH Row */}
                <div className="flex items-center mb-1">
                  <span className="text-[7px] text-gray-400 font-bold w-10 text-right mr-2">PITCH</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <div key={`pitch-${n}`} style={{ width: 36 }}>
                        {renderKnob(`pitch_${n}`, 'small')}
                      </div>
                    ))}
                  </div>
                </div>

                {/* VELOCITY Row */}
                <div className="flex items-center">
                  <span className="text-[7px] text-gray-400 font-bold w-10 text-right mr-2">VEL</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <div key={`vel-${n}`} style={{ width: 36 }}>
                        {renderKnob(`velocity_${n}`, 'small')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* Footer: DFAM Branding */}
            {/* ============================================================ */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
              <div>
                <div className="text-2xl font-black text-white tracking-tight">DFAM</div>
                <div className="text-[7px] text-gray-500 tracking-widest">DRUMMER FROM ANOTHER MOTHER</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] text-gray-500">SEMI-MODULAR ANALOG</div>
                <div className="text-[8px] text-gray-500">PERCUSSION SYNTHESIZER</div>
              </div>
              <div
                className="text-3xl font-serif italic text-white"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                moog
              </div>
            </div>
          </div>
          {/* End of Left side controls */}

          {/* Right side: Patch Bay */}
          <div
            className="flex-shrink-0 rounded"
            style={{
              width: 185,
              background: '#0a0a0a',
              padding: '10px',
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="text-[8px] text-gray-400 text-center font-bold mb-2 tracking-wide">
              PATCH BAY
            </div>
            <div className="flex-1">
              <PatchBay
                jacks={patchBayJacks}
                onConnection={(from, to, color) => {
                  console.log(`Patched: ${from} → ${to} (${color})`);
                }}
              />
            </div>
          </div>
        </div>
        {/* End of main flex layout */}
      </div>
    </div>
  );
}
