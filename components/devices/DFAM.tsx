'use client';

import { useStudioStore } from '@/store/studio';
import { DevicePanel } from '@/components/device';
import { DFAM as DFAMSpec, DFAM_LESSONS } from '@/data/devices';

/**
 * DFAM Component - Moog Drummer From Another Mother
 *
 * This is a thin wrapper around the generic DevicePanel component.
 * All DFAM-specific data (controls, layout, specs) comes from data/devices/dfam.ts
 *
 * This architecture allows:
 * - Single source of truth for DFAM specifications
 * - Easy addition of new devices by creating new spec files
 * - Consistent rendering across all devices
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
    <DevicePanel
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
