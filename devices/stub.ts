// Temporary placeholder module used while an instrument is being built.
import type { DeviceModule } from './types';
import { BaseEngine } from '@/lib/audio/engine';

class SilentEngine extends BaseEngine {
  protected build(): void {}
  protected onParam(): void {}
}

export function makeStub(id: string, name: string, manufacturer: string): DeviceModule {
  return {
    spec: {
      id, name, manufacturer,
      dimensions: { width: 300, height: 100 },
      display: { width: 900, height: 300, scale: 3 },
      signalFlow: [],
      controls: {},
    },
    layout: {
      width: 300, height: 100, pxPerMm: 3,
      theme: { background: '#151515', text: '#fff' },
      elements: [{ kind: 'label', text: `${manufacturer} ${name} - in development`, x: 150, y: 50, size: 16 }],
    },
    lessons: [],
    createEngine: () => new SilentEngine(),
  };
}
