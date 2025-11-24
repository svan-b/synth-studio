'use client';

import { useMemo } from 'react';
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
 * DevicePanel - Data-driven device renderer
 * Renders any synthesizer from its DeviceSpec
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
  const getDefaultValue = (controlId: string, spec: ControlSpec): number | string | boolean => {
    switch (spec.type) {
      case 'knob':
        return (spec as KnobSpec).default;
      case 'switch':
        return (spec as SwitchSpec).default;
      case 'button':
        return (spec as ButtonSpec).default;
      default:
        return 0;
    }
  };

  // Get current value for a control
  const getValue = (controlId: string): number | string | boolean => {
    if (values[controlId] !== undefined) {
      return values[controlId];
    }
    const controlSpec = spec.controls[controlId];
    if (controlSpec) {
      return getDefaultValue(controlId, controlSpec);
    }
    return 0;
  };

  // Check if control is highlighted (current lesson step)
  const isHighlighted = (controlId: string): boolean => {
    return isTeachingMode && currentStepInfo?.control === controlId;
  };

  // Get target value for teaching
  const getTargetValue = (controlId: string): number | string | boolean | undefined => {
    if (!isTeachingMode || !currentStepInfo || currentStepInfo.control !== controlId) {
      return undefined;
    }
    return currentStepInfo.targetValue;
  };

  // Render controls for a signal flow section
  const renderSection = (sectionId: string) => {
    const section = spec.signalFlow.find(s => s.id === sectionId);
    if (!section) return null;

    return (
      <div key={sectionId} className="flex flex-col gap-2">
        <h3 className="text-[10px] text-hardware-label uppercase tracking-widest font-bold border-b border-hardware-panel pb-1">
          {section.name}
        </h3>
        <div className="flex flex-wrap gap-3">
          {section.controls.map(controlId => {
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
          })}
        </div>
      </div>
    );
  };

  // Build patch bay jacks from spec
  const patchBayJacks = useMemo(() => {
    if (!spec.patchBay) return [];

    const jacks: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      type: 'input' | 'output';
    }> = [];

    // Column spacing
    const colWidth = 35;
    const rowHeight = 28;
    const baseX = 10;
    const baseY = 20;

    spec.patchBay.inputs.forEach((input) => {
      jacks.push({
        id: input.id,
        label: input.label,
        x: baseX + input.column * colWidth,
        y: baseY + input.row * rowHeight,
        type: 'input',
      });
    });

    spec.patchBay.outputs.forEach((output) => {
      jacks.push({
        id: output.id,
        label: output.label,
        x: baseX + output.column * colWidth,
        y: baseY + output.row * rowHeight,
        type: 'output',
      });
    });

    return jacks;
  }, [spec.patchBay]);

  return (
    <div
      className="relative bg-[#0a0a0a] rounded-lg overflow-hidden"
      style={{ width: spec.display.width + 60, padding: '20px' }}
    >
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

      {/* Main Panel */}
      <div
        className="relative mx-auto rounded border-2 border-[#2a2a2a]"
        style={{
          width: spec.display.width,
          minHeight: spec.display.height,
          background: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        }}
      >
        {/* Panel Content */}
        <div className="flex">
          {/* Main Controls Area */}
          <div className="flex-1 p-4">
            {/* Top Section: Oscillators + Filter */}
            <div className="flex gap-6 mb-4">
              {/* Oscillators Section */}
              <div className="flex-1">
                <div className="flex gap-4">
                  {/* VCO 1 */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[9px] text-hardware-label uppercase tracking-wider">VCO 1</h4>
                    <div className="flex gap-2">
                      {['vco1_frequency', 'vco1_eg_amount'].map(id => {
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      {['vco1_wave'].map(id => {
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* FM + Sync */}
                  <div className="flex flex-col gap-2 items-center">
                    {['fm_amount', 'hard_sync'].map(id => {
                      const controlSpec = spec.controls[id];
                      if (!controlSpec) return null;
                      return (
                        <ControlRenderer
                          key={id}
                          id={id}
                          spec={controlSpec}
                          value={getValue(id)}
                          onChange={(value) => onChange(id, value)}
                          highlighted={isHighlighted(id)}
                          targetValue={getTargetValue(id)}
                          showTarget={isTeachingMode}
                        />
                      );
                    })}
                  </div>

                  {/* VCO 2 */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[9px] text-hardware-label uppercase tracking-wider">VCO 2</h4>
                    <div className="flex gap-2">
                      {['vco2_frequency', 'vco2_eg_amount'].map(id => {
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      {['vco2_wave'].map(id => {
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* VCO Envelope */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[9px] text-hardware-label uppercase tracking-wider">VCO EG</h4>
                    {['vco_decay', 'seq_pitch_mod'].map(id => {
                      const controlSpec = spec.controls[id];
                      if (!controlSpec) return null;
                      return (
                        <ControlRenderer
                          key={id}
                          id={id}
                          spec={controlSpec}
                          value={getValue(id)}
                          onChange={(value) => onChange(id, value)}
                          highlighted={isHighlighted(id)}
                          targetValue={getTargetValue(id)}
                          showTarget={isTeachingMode}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Filter Section */}
              <div className="border-l border-hardware-panel pl-4">
                <h4 className="text-[9px] text-hardware-label uppercase tracking-wider mb-2">FILTER</h4>
                <div className="flex gap-3">
                  {['vcf_cutoff', 'vcf_resonance', 'vcf_eg_amount'].map(id => {
                    const controlSpec = spec.controls[id];
                    if (!controlSpec) return null;
                    return (
                      <ControlRenderer
                        key={id}
                        id={id}
                        spec={controlSpec}
                        value={getValue(id)}
                        onChange={(value) => onChange(id, value)}
                        highlighted={isHighlighted(id)}
                        targetValue={getTargetValue(id)}
                        showTarget={isTeachingMode}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  {['vcf_mode', 'vcf_decay', 'noise_vcf_mod'].map(id => {
                    const controlSpec = spec.controls[id];
                    if (!controlSpec) return null;
                    return (
                      <ControlRenderer
                        key={id}
                        id={id}
                        spec={controlSpec}
                        value={getValue(id)}
                        onChange={(value) => onChange(id, value)}
                        highlighted={isHighlighted(id)}
                        targetValue={getTargetValue(id)}
                        showTarget={isTeachingMode}
                      />
                    );
                  })}
                </div>
              </div>

              {/* VCA Section */}
              <div className="border-l border-hardware-panel pl-4">
                <h4 className="text-[9px] text-hardware-label uppercase tracking-wider mb-2">VCA</h4>
                <div className="flex gap-2">
                  {['vca_decay', 'vca_attack_mode', 'volume'].map(id => {
                    const controlSpec = spec.controls[id];
                    if (!controlSpec) return null;
                    return (
                      <ControlRenderer
                        key={id}
                        id={id}
                        spec={controlSpec}
                        value={getValue(id)}
                        onChange={(value) => onChange(id, value)}
                        highlighted={isHighlighted(id)}
                        targetValue={getTargetValue(id)}
                        showTarget={isTeachingMode}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Middle Section: Mixer */}
            <div className="flex gap-6 mb-4">
              <div>
                <h4 className="text-[9px] text-hardware-label uppercase tracking-wider mb-2">MIXER</h4>
                <div className="flex gap-2">
                  {['vco1_level', 'vco2_level', 'noise_level'].map(id => {
                    const controlSpec = spec.controls[id];
                    if (!controlSpec) return null;
                    return (
                      <ControlRenderer
                        key={id}
                        id={id}
                        spec={controlSpec}
                        value={getValue(id)}
                        onChange={(value) => onChange(id, value)}
                        highlighted={isHighlighted(id)}
                        targetValue={getTargetValue(id)}
                        showTarget={isTeachingMode}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Section: Sequencer */}
            <div className="border-t border-hardware-panel pt-3">
              <div className="flex gap-4 items-start">
                {/* Tempo */}
                <div>
                  <ControlRenderer
                    id="tempo"
                    spec={spec.controls.tempo}
                    value={getValue('tempo')}
                    onChange={(value) => onChange('tempo', value)}
                    highlighted={isHighlighted('tempo')}
                    targetValue={getTargetValue('tempo')}
                    showTarget={isTeachingMode}
                  />
                </div>

                {/* Sequencer Steps */}
                <div className="flex-1">
                  <h4 className="text-[9px] text-hardware-label uppercase tracking-wider mb-2">SEQUENCER</h4>

                  {/* Step Numbers */}
                  <div className="flex gap-1 mb-1 ml-8">
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <div key={n} className="w-10 text-center text-[8px] text-hardware-label">{n}</div>
                    ))}
                  </div>

                  {/* Pitch Row */}
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[8px] text-hardware-label w-7">PITCH</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6,7,8].map(n => {
                        const id = `pitch_${n}`;
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Velocity Row */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-hardware-label w-7">VEL</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6,7,8].map(n => {
                        const id = `velocity_${n}`;
                        const controlSpec = spec.controls[id];
                        if (!controlSpec) return null;
                        return (
                          <ControlRenderer
                            key={id}
                            id={id}
                            spec={controlSpec}
                            value={getValue(id)}
                            onChange={(value) => onChange(id, value)}
                            highlighted={isHighlighted(id)}
                            targetValue={getTargetValue(id)}
                            showTarget={isTeachingMode}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Transport */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[9px] text-hardware-label uppercase tracking-wider">TRANSPORT</h4>
                  <div className="flex gap-2">
                    {['trigger', 'run_stop', 'advance'].map(id => {
                      const controlSpec = spec.controls[id];
                      if (!controlSpec) return null;
                      return (
                        <ControlRenderer
                          key={id}
                          id={id}
                          spec={controlSpec}
                          value={getValue(id)}
                          onChange={(value) => onChange(id, value)}
                          highlighted={isHighlighted(id)}
                          targetValue={getTargetValue(id)}
                          showTarget={isTeachingMode}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Patch Bay */}
          {spec.patchBay && patchBayJacks.length > 0 && (
            <div
              className="bg-[#0d0d0d] rounded border-l-2 border-hardware-panel p-2"
              style={{ width: 160 }}
            >
              <h4 className="text-[9px] text-hardware-label uppercase tracking-wider text-center mb-2">
                PATCH BAY
              </h4>
              <PatchBay
                jacks={patchBayJacks}
                onConnection={(from, to, color) => {
                  console.log(`Patched: ${from} → ${to} (${color})`);
                }}
              />
            </div>
          )}
        </div>

        {/* Logo */}
        <div className="absolute bottom-3 left-4">
          <div className="text-lg font-bold text-gray-300">{spec.name}</div>
          <div className="text-[8px] text-hardware-label">{spec.description}</div>
        </div>
      </div>
    </div>
  );
}
