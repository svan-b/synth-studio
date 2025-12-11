'use client';

import { useMemo, useState, useEffect } from 'react';
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
} from '@/lib/devices/dfam/dfam-coordinates';

interface DFAMCoordinatePanelProps {
  spec: DeviceSpec;
  values: Record<string, number | string | boolean>;
  onChange: (controlId: string, value: number | string | boolean) => void;
  onResetControls?: () => void;
  onClearCables?: () => void;
  currentLesson?: Lesson;
  currentStep?: number;
  isTeachingMode?: boolean;
  activeSequencerStep?: number;
  isAudioReady?: boolean;
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
  onResetControls,
  onClearCables,
  currentLesson,
  currentStep = 0,
  isTeachingMode = false,
  activeSequencerStep = 0,
  isAudioReady = false,
}: DFAMCoordinatePanelProps) {
  // Track clear cables trigger
  const [clearCablesTrigger, setClearCablesTrigger] = useState(0);

  // Handle clear cables button click
  const handleClearCablesClick = () => {
    setClearCablesTrigger(prev => prev + 1);
    onClearCables?.();
  };

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
  // With anchor-based positioning, the knob center = coordinate center
  const renderKnob = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as KnobSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    const size = getKnobSize(controlId);

    // Determine if this is a sequencer knob (no label needed - numbers shown above)
    const isSequencerKnob = controlId.startsWith('pitch_') || controlId.startsWith('velocity_');

    // Pitch knobs: show value on hover only (to avoid overlapping with LEDs below)
    // Velocity knobs: always show value (nothing below them to overlap)
    const isPitchKnob = controlId.startsWith('pitch_');

    return (
      <div
        key={controlId}
        className="absolute"
        style={{
          left: mmToPx(position.x),
          top: mmToPx(position.y),
          transform: 'translate(-50%, -50%)',  // Center the knob at the coordinate
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
          showLabel={!isSequencerKnob}
          showValueOnHover={isPitchKnob}
        />
      </div>
    );
  };

  // Render a switch at its coordinate position
  // With anchor-based positioning, the switch center = coordinate center
  const renderSwitch = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as SwitchSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    return (
      <div
        key={controlId}
        className="absolute"
        style={{
          left: mmToPx(position.x),
          top: mmToPx(position.y),
          transform: 'translate(-50%, -50%)',  // Center the switch at the coordinate
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

  // Get button configuration based on DFAM manual layout
  // - TRIGGER: small button with label to the right
  // - RUN/STOP: large button with NO label (label is with the LED indicator)
  // - ADVANCE: medium button with label above
  const getButtonConfig = (controlId: string): {
    labelPosition: 'above' | 'below' | 'left' | 'right' | 'none';
    size: 'small' | 'medium' | 'large';
  } => {
    switch (controlId) {
      case 'trigger':
        return { labelPosition: 'right', size: 'small' };
      case 'run_stop':
        return { labelPosition: 'none', size: 'large' };
      case 'advance':
        return { labelPosition: 'above', size: 'medium' };
      default:
        return { labelPosition: 'above', size: 'medium' };
    }
  };

  // Render a button at its coordinate position
  // With anchor-based positioning, the button center = coordinate center
  const renderButton = (controlId: string) => {
    const controlSpec = spec.controls[controlId] as ButtonSpec;
    const position = CONTROL_POSITIONS[controlId];
    if (!controlSpec || !position) return null;

    const { labelPosition, size } = getButtonConfig(controlId);

    return (
      <div
        key={controlId}
        className="absolute"
        style={{
          left: mmToPx(position.x),
          top: mmToPx(position.y),
          transform: 'translate(-50%, -50%)',  // Center the button at the coordinate
        }}
      >
        <Button
          id={controlId}
          spec={controlSpec}
          value={getValue(controlId) as unknown as boolean}
          onChange={(v) => onChange(controlId, v)}
          highlighted={isHighlighted(controlId)}
          labelPosition={labelPosition}
          size={size}
        />
      </div>
    );
  };

  // Render the transport LED indicator at "10 o'clock" position on RUN/STOP button
  // RUN/STOP button is at x:35, y:94, so LED at approximately x:27, y:87
  const renderTransportLED = () => {
    const isRunning = getValue('run_stop') as unknown as boolean;
    return (
      <>
        {/* LED at 10 o'clock position relative to RUN/STOP button */}
        <div
          className="absolute"
          style={{
            left: mmToPx(27),
            top: mmToPx(87),
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isRunning ? '#ff3333' : '#331111',
              boxShadow: isRunning ? '0 0 6px #ff3333' : 'none',
            }}
          />
        </div>
        {/* RUN / STOP label below the LED */}
        <div
          className="absolute text-[6px] text-gray-400 font-bold"
          style={{
            left: mmToPx(35),
            top: mmToPx(87),
            transform: 'translateX(-50%)',
          }}
        >
          RUN / STOP
        </div>
      </>
    );
  };

  // Render sequencer LEDs
  // Using transform-based centering for consistency
  // LED lights up based on activeSequencerStep from audio engine
  const renderSequencerLEDs = () => {
    const isRunning = values.run_stop as boolean;

    return SEQUENCER_LED_POSITIONS.map((led, index) => {
      const isActive = isRunning && index === activeSequencerStep;

      return (
        <div
          key={`led-${led.step}`}
          className="absolute"
          style={{
            left: mmToPx(led.x),
            top: mmToPx(led.y),
            transform: 'translate(-50%, -50%)',  // Center LED at coordinate
          }}
        >
          <div
            className="w-3 h-3 rounded-full transition-all duration-75"
            style={{
              background: isActive ? '#ff3333' : '#331111',
              boxShadow: isActive ? '0 0 8px #ff3333' : 'none',
            }}
          />
        </div>
      );
    });
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

  // Add extra height for labels and value displays
  const extraPadding = 30;

  return (
    <div
      className="relative rounded-lg"
      style={{
        width: totalWidthPx,
        height: panelHeightPx + extraPadding,
        background: '#1a1a1a',
      }}
    >
      {/* Wooden Side Cheeks */}
      <div
        className="absolute left-0 top-0 rounded-l-lg"
        style={{
          width: cheekWidthPx,
          height: panelHeightPx + extraPadding,
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute right-0 top-0 rounded-r-lg"
        style={{
          width: cheekWidthPx,
          height: panelHeightPx + extraPadding,
          background: 'linear-gradient(90deg, #3d2b1f 0%, #5C4033 50%, #3d2b1f 100%)',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.5)',
        }}
      />

      {/* Utility Buttons - positioned outside left side of panel */}
      <div
        className="absolute flex flex-col gap-2"
        style={{
          left: -80,
          top: 10,
        }}
      >
        {onResetControls && (
          <button
            onClick={onResetControls}
            className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-white rounded whitespace-nowrap transition-colors"
            title="Reset all knobs to default values"
          >
            Reset Knobs
          </button>
        )}
        {onClearCables && (
          <button
            onClick={handleClearCablesClick}
            className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-white rounded whitespace-nowrap transition-colors"
            title="Remove all patch cables"
          >
            Clear Cables
          </button>
        )}
        {/* Audio status indicator */}
        <div
          className="flex items-center gap-1 text-[9px] text-gray-500 mt-2"
          title={isAudioReady ? 'Audio engine active' : 'Click any control to enable audio'}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isAudioReady ? '#22c55e' : '#666',
              boxShadow: isAudioReady ? '0 0 4px #22c55e' : 'none',
            }}
          />
          <span>{isAudioReady ? 'Audio ON' : 'Audio OFF'}</span>
        </div>
      </div>

      {/* Main Black Panel */}
      <div
        className="relative rounded overflow-visible"
        style={{
          marginLeft: cheekWidthPx,
          marginRight: cheekWidthPx,
          width: panelWidthPx,
          height: panelHeightPx + extraPadding,
          background: '#111',
        }}
      >

        {/* Step Numbers 1-8 above sequencer pitch row */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
          <div
            key={`step-num-${n}`}
            className="absolute text-white font-bold text-center"
            style={{
              left: mmToPx(105 + i * 15),
              top: mmToPx(68),
              transform: 'translateX(-50%)',
              fontSize: '9px',
            }}
          >
            {n}
          </div>
        ))}

        {/* Row labels for sequencer - positioned left of step knobs with right alignment */}
        <div
          className="absolute text-[7px] text-gray-400 font-bold text-right"
          style={{ left: mmToPx(86), top: mmToPx(77), width: mmToPx(12) }}
        >
          PITCH
        </div>
        <div
          className="absolute text-[6px] text-gray-400 font-bold text-right"
          style={{ left: mmToPx(82), top: mmToPx(91), width: mmToPx(16) }}
        >
          VELOCITY
        </div>

        {/* Render all knobs */}
        {knobIds.map(id => renderKnob(id))}

        {/* Render all switches */}
        {switchIds.map(id => renderSwitch(id))}

        {/* Render all buttons */}
        {buttonIds.map(id => renderButton(id))}

        {/* Render transport LED indicator (between TRIGGER and RUN/STOP) */}
        {renderTransportLED()}

        {/* Render sequencer LEDs */}
        {renderSequencerLEDs()}

        {/* Patch Bay Section - positioned on right side of panel */}
        <div
          className="absolute rounded"
          style={{
            left: mmToPx(240),
            top: mmToPx(8),
            width: mmToPx(62),
            height: mmToPx(98),
            background: '#0a0a0a',
            padding: mmToPx(2),
          }}
        >
          <PatchBay
            jacks={patchBayJacks}
            onConnection={(from, to, color) => {
              console.log(`Patched: ${from} → ${to} (${color})`);
            }}
            clearAllTrigger={clearCablesTrigger}
          />
        </div>

        {/* DFAM Branding - positioned at absolute bottom, below all controls */}
        <div
          className="absolute flex items-center"
          style={{
            left: mmToPx(8),
            bottom: 4,
            width: mmToPx(225),
            height: 22,
          }}
        >
          {/* Left: DFAM logo */}
          <div style={{ width: '25%' }}>
            <div className="text-lg font-black text-white tracking-tight leading-none">DFAM</div>
            <div className="text-[4px] text-gray-600 tracking-widest leading-tight">DRUMMER FROM ANOTHER MOTHER</div>
          </div>
          {/* Center: Product type - positioned explicitly */}
          <div style={{ width: '50%' }} className="text-center">
            <div className="text-[5px] text-gray-600 leading-tight">SEMI-MODULAR ANALOG</div>
            <div className="text-[5px] text-gray-600 leading-tight">PERCUSSION SYNTHESIZER</div>
          </div>
          {/* Right: Moog logo */}
          <div
            style={{ width: '25%', fontFamily: 'Georgia, serif' }}
            className="text-lg font-serif italic text-white text-right leading-none"
          >
            moog
          </div>
        </div>
      </div>
    </div>
  );
}
