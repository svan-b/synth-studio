'use client';

import { useMemo } from 'react';
import type { DeviceSpec, KnobSpec, SwitchSpec, ButtonSpec, Lesson } from '@/types';
import Knob from '@/components/controls/Knob';
import Switch from '@/components/controls/Switch';
import Button from '@/components/controls/Button';
import PatchBay from '@/components/controls/PatchBay';
import {
  DFAM_DIMENSIONS,
  DFAM_DISPLAY,
  CONTROL_POSITIONS,
  PATCH_JACK_POSITIONS,
  SEQUENCER_LED_POSITIONS,
  mmToPx,
  getKnobSize,
  KNOB_SIZES,
} from '@/lib/devices/dfam/dfam-coordinates';

interface DFAMCoordinatePanelProps {
  spec: DeviceSpec;
  values: Record<string, number | string | boolean>;
  onChange: (controlId: string, value: number | string | boolean) => void;
  currentLesson?: Lesson;
  currentStep?: number;
  isTeachingMode?: boolean;
}

/**
 * DFAM Coordinate Panel - Pixel-Perfect Digital Twin
 * Uses coordinate-based absolute positioning for accurate hardware representation
 * All positions derived from Moog DFAM manual measurements
 */
export default function DFAMCoordinatePanel({
  spec,
  values,
  onChange,
  currentLesson,
  currentStep = 0,
  isTeachingMode = false,
}: DFAMCoordinatePanelProps) {
  // Get current lesson step info
  const currentStepInfo = useMemo(() => {
    if (!currentLesson || currentStep >= currentLesson.steps.length) return null;
    return currentLesson.steps[currentStep];
  }, [currentLesson, currentStep]);

  // Get value for a control
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

  // Build patch bay jacks from coordinate data
  const patchBayJacks = useMemo(() => {
    return PATCH_JACK_POSITIONS.map(jack => ({
      id: jack.id,
      label: jack.label,
      column: jack.column,
      row: jack.row,
      type: jack.type,
    }));
  }, []);

  // Render a knob at its coordinate position
  const renderKnob = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as KnobSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    const size = getKnobSize(controlId);
    const knobPx = KNOB_SIZES[size].px;

    return (
      <div
        key={controlId}
        className="absolute flex flex-col items-center"
        style={{
          left: mmToPx(position.x) - knobPx / 2,
          top: mmToPx(position.y) - knobPx / 2,
        }}
      >
        <Knob
          id={controlId}
          spec={{ ...controlSpec, size }}
          value={getValue(controlId)}
          onChange={(v) => onChange(controlId, v)}
          highlighted={isHighlighted(controlId)}
          targetValue={getTargetValue(controlId)}
          showTarget={isTeachingMode}
        />
      </div>
    );
  };

  // Render a switch at its coordinate position
  const renderSwitch = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as SwitchSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    return (
      <div
        key={controlId}
        className="absolute"
        style={{
          left: mmToPx(position.x) - 20,
          top: mmToPx(position.y) - 15,
        }}
      >
        <Switch
          id={controlId}
          spec={controlSpec}
          value={getValue(controlId)}
          onChange={(v) => onChange(controlId, v)}
          highlighted={isHighlighted(controlId)}
          targetValue={getTargetValue(controlId)}
        />
      </div>
    );
  };

  // Render a button at its coordinate position
  const renderButton = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as ButtonSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    return (
      <div
        key={controlId}
        className="absolute"
        style={{
          left: mmToPx(position.x) - 16,
          top: mmToPx(position.y) - 16,
        }}
      >
        <Button
          id={controlId}
          spec={controlSpec}
          value={getValue(controlId) as unknown as boolean}
          onChange={(v) => onChange(controlId, v)}
          highlighted={isHighlighted(controlId)}
        />
      </div>
    );
  };

  // Render sequencer LEDs
  const renderSequencerLEDs = () => {
    return SEQUENCER_LED_POSITIONS.map((led, index) => (
      <div
        key={`led-${led.step}`}
        className="absolute"
        style={{
          left: mmToPx(led.x) - 6,
          top: mmToPx(led.y) - 6,
        }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{
            background: index === 0 ? '#ff3333' : '#331111',
            boxShadow: index === 0 ? '0 0 8px #ff3333' : 'none',
          }}
        />
      </div>
    ));
  };

  // Calculate display dimensions
  const panelWidthPx = DFAM_DISPLAY.targetWidth;
  const panelHeightPx = mmToPx(DFAM_DIMENSIONS.panelHeight);
  const cheekWidthPx = mmToPx(DFAM_DIMENSIONS.cheekWidth);
  const totalWidthPx = panelWidthPx + cheekWidthPx * 2;

  // Control IDs organized by type
  const knobIds = [
    'vco_decay', 'vco1_eg_amount', 'vco1_frequency', 'vco1_level', 'noise_level',
    'vcf_cutoff', 'vcf_resonance', 'volume',
    'fm_amount', 'vco2_eg_amount', 'vco2_frequency', 'vco2_level',
    'vcf_decay', 'vcf_eg_amount', 'noise_vcf_mod', 'vca_decay',
    'tempo',
    'pitch_1', 'pitch_2', 'pitch_3', 'pitch_4', 'pitch_5', 'pitch_6', 'pitch_7', 'pitch_8',
    'velocity_1', 'velocity_2', 'velocity_3', 'velocity_4', 'velocity_5', 'velocity_6', 'velocity_7', 'velocity_8',
  ];

  const switchIds = [
    'seq_pitch_mod', 'vco1_wave', 'vco2_wave', 'hard_sync', 'vcf_mode', 'vca_attack_mode',
  ];

  const buttonIds = ['trigger', 'run_stop', 'advance'];

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        width: totalWidthPx,
        background: '#1a1a1a',
      }}
    >
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 bottom-0 rounded-l-lg"
        style={{
          width: cheekWidthPx,
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 rounded-r-lg"
        style={{
          width: cheekWidthPx,
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.5)',
        }}
      />

      {/* Main Black Panel */}
      <div
        className="relative rounded"
        style={{
          marginLeft: cheekWidthPx,
          marginRight: cheekWidthPx,
          width: panelWidthPx,
          height: panelHeightPx,
          background: '#111',
        }}
      >
        {/* Section Labels - Row 1 */}
        <div className="absolute text-[8px] text-gray-500 font-bold" style={{ left: mmToPx(10), top: mmToPx(5) }}>
          VCO<br/>ENVELOPE
        </div>
        <div className="absolute text-[9px] text-white font-bold" style={{ left: mmToPx(68), top: mmToPx(5) }}>
          VCO 1
        </div>
        <div className="absolute text-[8px] text-gray-500 font-bold" style={{ left: mmToPx(100), top: mmToPx(5) }}>
          MIXER
        </div>
        <div className="absolute text-[9px] text-white font-bold" style={{ left: mmToPx(140), top: mmToPx(5) }}>
          VCF
        </div>
        <div className="absolute text-[9px] text-white font-bold" style={{ left: mmToPx(190), top: mmToPx(5) }}>
          VCA
        </div>

        {/* Section Labels - Row 2 */}
        <div className="absolute text-[8px] text-gray-500 font-bold" style={{ left: mmToPx(10), top: mmToPx(38) }}>
          FM
        </div>
        <div className="absolute text-[9px] text-white font-bold" style={{ left: mmToPx(68), top: mmToPx(38) }}>
          VCO 2
        </div>
        <div className="absolute text-[8px] text-gray-500 font-bold" style={{ left: mmToPx(130), top: mmToPx(38) }}>
          VCF ENVELOPE
        </div>

        {/* Patch Bay Label */}
        <div className="absolute text-[7px] text-gray-500" style={{ left: mmToPx(235), top: mmToPx(3) }}>
          PATCH BAY
        </div>

        {/* Sequencer Section Label */}
        <div className="absolute text-[9px] text-white font-bold" style={{ left: mmToPx(110), top: mmToPx(72) }}>
          SEQUENCER
        </div>

        {/* Step Numbers */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
          <div
            key={`step-num-${n}`}
            className="absolute text-[10px] text-white font-bold text-center"
            style={{
              left: mmToPx(68 + i * 17) - 8,
              top: mmToPx(76),
              width: 16,
            }}
          >
            {n}
          </div>
        ))}

        {/* Row labels for sequencer */}
        <div
          className="absolute text-[8px] text-white font-bold"
          style={{ left: mmToPx(50), top: mmToPx(83) }}
        >
          PITCH
        </div>
        <div
          className="absolute text-[7px] text-white font-bold"
          style={{ left: mmToPx(48), top: mmToPx(100) }}
        >
          VELOCITY
        </div>

        {/* Render all knobs */}
        {knobIds.map(id => renderKnob(id))}

        {/* Render all switches */}
        {switchIds.map(id => renderSwitch(id))}

        {/* Render all buttons */}
        {buttonIds.map(id => renderButton(id))}

        {/* Render sequencer LEDs */}
        {renderSequencerLEDs()}

        {/* Separator line above sequencer */}
        <div
          className="absolute bg-gray-700"
          style={{
            left: mmToPx(8),
            top: mmToPx(70),
            width: mmToPx(200),
            height: 1,
          }}
        />

        {/* Patch Bay Section */}
        <div
          className="absolute rounded"
          style={{
            left: mmToPx(212),
            top: mmToPx(10),
            width: mmToPx(88),
            height: mmToPx(95),
            background: '#0a0a0a',
            padding: mmToPx(2),
          }}
        >
          <PatchBay
            jacks={patchBayJacks}
            onConnection={(from, to, color) => {
              console.log(`Patched: ${from} → ${to} (${color})`);
            }}
          />
        </div>

        {/* DFAM Branding - bottom of controls section */}
        <div
          className="absolute"
          style={{
            left: mmToPx(8),
            bottom: mmToPx(2),
            width: mmToPx(200),
          }}
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xl font-black text-white tracking-tight">DFAM</div>
              <div className="text-[5px] text-gray-600 tracking-widest">DRUMMER FROM ANOTHER MOTHER</div>
            </div>
            <div className="text-center">
              <div className="text-[6px] text-gray-600">SEMI-MODULAR ANALOG</div>
              <div className="text-[6px] text-gray-600">PERCUSSION SYNTHESIZER</div>
            </div>
            <div
              className="text-xl font-serif italic text-white"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              moog
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
