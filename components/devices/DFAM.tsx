'use client';

import { useStudioStore } from '@/store/studio';
import DFAMCoordinatePanel from '@/components/devices/DFAMCoordinatePanel';
import { DFAM as DFAMSpec, DFAM_LESSONS } from '@/data/devices';

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
    currentLesson,
    currentStep,
    isTeachingMode,
  } = useStudioStore();

  const device = 'dfam';

  // Build values object from store
  const values: Record<string, number | string | boolean> = {};
  Object.keys(DFAMSpec.controls).forEach(controlId => {
    const value = getControlValue(device, controlId);
    if (value !== undefined) {
      values[controlId] = value;
    }
  });

  // Handle control changes
  const handleChange = (controlId: string, value: number | string | boolean) => {
    setControlValue(device, controlId, value);
  };

  return (
    <DFAMCoordinatePanel
      spec={DFAMSpec}
      values={values}
      onChange={handleChange}
      currentLesson={currentLesson}
      currentStep={currentStep}
      isTeachingMode={isTeachingMode}
    />
  );
}

// Re-export lessons for convenience
export { DFAM_LESSONS };
