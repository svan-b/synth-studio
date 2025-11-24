// ============================================================================
// Device Registry
// Central registry for all synthesizer specifications
// ============================================================================

import type { DeviceSpec, DeviceRegistry, Lesson } from '@/types';
import { DFAM, DFAM_LESSONS } from './dfam';

// All registered devices
const devices: Record<string, DeviceSpec> = {
  dfam: DFAM,
  // Future devices:
  // mother32: MOTHER32,
  // subharmonicon: SUBHARMONICON,
};

// All lessons across devices
const lessons: Lesson[] = [
  ...DFAM_LESSONS,
  // Future lessons from other devices
];

// Registry implementation
export const deviceRegistry: DeviceRegistry = {
  devices,

  getDevice: (id: string): DeviceSpec | undefined => {
    return devices[id.toLowerCase()];
  },

  listDevices: () => {
    return Object.entries(devices).map(([id, spec]) => ({
      id,
      name: spec.name,
      manufacturer: spec.manufacturer,
    }));
  },
};

// Lesson utilities
export const lessonRegistry = {
  getAllLessons: (): Lesson[] => lessons,

  getLessonsForDevice: (deviceId: string): Lesson[] => {
    return lessons.filter(l => l.device === deviceId.toLowerCase());
  },

  getLesson: (lessonId: string): Lesson | undefined => {
    return lessons.find(l => l.id === lessonId);
  },

  getLessonsByDifficulty: (difficulty: Lesson['difficulty']): Lesson[] => {
    return lessons.filter(l => l.difficulty === difficulty);
  },

  getLessonsByTag: (tag: string): Lesson[] => {
    return lessons.filter(l => l.tags?.includes(tag));
  },
};

// Re-export individual devices for direct access
export { DFAM, DFAM_LESSONS };

// Default export
export default deviceRegistry;
