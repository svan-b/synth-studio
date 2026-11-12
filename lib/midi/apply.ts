// ============================================================================
// Writing control values from MIDI.
//
// A controller knob or a pitch wheel can send hundreds of messages a second.
// Writing each one to the (persisted) studio store would re-render panels and
// serialise the project hundreds of times a second, so values are coalesced
// and flushed once per frame (~60 Hz) - the latest value per control wins.
//
// A flush goes through the same path as touching the control on screen:
// the device's interceptChange first (Elektron parameter locks while a trig is
// held), the transport control through hub.setControl (starts the studio),
// everything else in one store update per instrument.
// ============================================================================

import type { ControlValue } from '@/types';
import type { DeviceUiApi } from '@/devices/types';
import { hub } from '@/lib/studio/hub';
import { useStudioStore } from '@/store/studio';
import { useUiStore } from '@/store/ui';

type Flush = (instance: string, values: Record<string, ControlValue>) => void;

export class ControlWriter {
  private pending = new Map<string, Record<string, ControlValue>>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private flushFn: Flush, private delayMs = 16) {}

  write(instance: string, control: string, value: ControlValue) {
    let p = this.pending.get(instance);
    if (!p) { p = {}; this.pending.set(instance, p); }
    p[control] = value;
    if (!this.timer) this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = this.pending;
    this.pending = new Map();
    batch.forEach((values, instance) => {
      try { this.flushFn(instance, values); } catch (e) { console.warn('[midi] control write failed', e); }
    });
  }
}

/** Apply values to an instrument the way an on-screen change would */
export function applyControlValues(instance: string, values: Record<string, ControlValue>) {
  const st = useStudioStore.getState();
  if (!st.studio.rack.some(r => r.id === instance)) return;
  const mod = hub.getModule(st.deviceOf(instance));
  const plain: Record<string, ControlValue> = {};
  Object.entries(values).forEach(([id, v]) => {
    if (mod?.interceptChange && mod.interceptChange(id, v, uiApi(instance))) return;
    if (mod?.transportControl === id) hub.setControl(instance, id, v);
    else plain[id] = v;
  });
  if (Object.keys(plain).length) st.setControlValues(instance, plain);
}

/** The DeviceUiApi a device's hooks expect, built from the stores */
export function uiApi(instance: string): DeviceUiApi {
  const st = useStudioStore.getState();
  return {
    values: hub.valuesFor(instance),
    data: st.devices[instance]?.data,
    ui: useUiStore.getState().ui[instance] ?? {},
    setValue: (id, v) => hub.setControl(instance, id, v),
    updateData: fn => useStudioStore.getState().updateDeviceData(instance, fn),
    setUi: patch => useUiStore.getState().setUi(instance, patch),
  };
}
