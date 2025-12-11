'use client';

import { useMemo, useCallback, useState } from 'react';
import { useStudioStore } from '@/store/studio';
import DFAMCoordinatePanel from '@/components/devices/DFAMCoordinatePanel';
import { DFAM as DFAMSpec, DFAM_LESSONS } from '@/data/devices';
import { useDFAMAudio } from '@/lib/audio/use-dfam-audio';

/**
 * DFAM Component - Moog Drummer From Another Mother
 *
 * Uses coordinate-based positioning for pixel-perfect hardware accuracy.
 * All DFAM-specific data (controls, layout, specs) comes from data/devices/dfam.ts
 * Coordinates are defined in lib/devices/dfam/dfam-coordinates.ts
 *
 * This architecture allows:
 * - Pixel-perfect positioning based on actual hardware measurements
 * - Single source of truth for DFAM specifications
 * - Easy addition of new devices by creating new spec files
 * - Teaching system that works with any device
 */
export default function DFAM() {
  const {
    getControlValue,
    setControlValue,
    resetControlsToSpec,
    clearPatchConnections,
    currentLesson,
    currentStep,
    isTeachingMode,
  } = useStudioStore();

  const device = 'dfam';

  // Build default values from spec
  const specDefaults = useMemo(() => {
    const defaults: Record<string, number | string | boolean> = {};
    Object.entries(DFAMSpec.controls).forEach(([controlId, spec]) => {
      if ('default' in spec && spec.default !== undefined) {
        defaults[controlId] = spec.default;
      }
    });
    return defaults;
  }, []);

  // Track active sequencer step for visual feedback
  const [activeStep, setActiveStep] = useState(0);

  // Build values object from store (with defaults from spec)
  const values: Record<string, number | string | boolean> = {};
  Object.keys(DFAMSpec.controls).forEach(controlId => {
    const value = getControlValue(device, controlId);
    if (value !== undefined) {
      values[controlId] = value;
    } else {
      // Use spec default if no value in store
      const spec = DFAMSpec.controls[controlId];
      if ('default' in spec && spec.default !== undefined) {
        values[controlId] = spec.default;
      }
    }
  });

  // Connect to audio engine
  const { isAudioReady, currentStep, initializeAudio, triggerSound } = useDFAMAudio({
    values,
    onStepChange: setActiveStep,
  });

  // Handle control changes - also initialize audio on first interaction
  const handleChange = useCallback((controlId: string, value: number | string | boolean) => {
    // Initialize audio on first interaction (browser autoplay policy)
    if (!isAudioReady) {
      initializeAudio();
    }

    setControlValue(device, controlId, value);

    // Special handling for trigger button
    if (controlId === 'trigger' && value === true) {
      triggerSound();
    }
  }, [isAudioReady, initializeAudio, setControlValue, triggerSound]);

  // Reset all controls to spec defaults
  const handleResetControls = useCallback(() => {
    resetControlsToSpec(device, specDefaults);
  }, [resetControlsToSpec, specDefaults]);

  // Clear all patch cables
  const handleClearCables = useCallback(() => {
    clearPatchConnections(device);
  }, [clearPatchConnections]);

  return (
    <DFAMCoordinatePanel
      spec={DFAMSpec}
      values={values}
      onChange={handleChange}
      onResetControls={handleResetControls}
      onClearCables={handleClearCables}
      currentLesson={currentLesson}
      currentStep={currentStep}
      isTeachingMode={isTeachingMode}
      activeSequencerStep={activeStep}
      isAudioReady={isAudioReady}
    />
  );
}

// Re-export lessons for convenience
export { DFAM_LESSONS };
