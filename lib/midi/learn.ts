// ============================================================================
// MIDI learn: arm, touch a control on screen, move a hardware knob.
// DeviceHost calls midiLearnTouch() from every on-screen control change; it is
// a no-op unless learn is armed, so it costs nothing while you play.
// ============================================================================

import { useMidiLearn } from '@/store/midi';
import { useStudioStore, getSpec } from '@/store/studio';
import { DEVICES } from '@/devices';

/** The hook DeviceHost's onChange calls: remembers the control you just touched while learn is armed */
export function midiLearnTouch(instance: string, control: string): void {
  const s = useMidiLearn.getState();
  if (!s.armed) return;
  if (s.target && s.target.instance === instance && s.target.control === control) return;
  s.setTarget({ instance, control });
}

/** "Sub 37 2" - the name the rack tabs use */
export function instanceLabel(instance: string): string {
  const st = useStudioStore.getState();
  const slot = st.studio.rack.find(r => r.id === instance);
  const device = slot?.device ?? st.deviceOf(instance);
  const entry = DEVICES.find(d => d.id === device);
  if (slot?.label) return slot.label;
  const base = entry?.name ?? device;
  return instance.includes('#') ? `${base} ${instance.split('#')[1]}` : base;
}

/** "CUTOFF" - a control's panel label */
export function controlLabel(instance: string, control: string): string {
  const st = useStudioStore.getState();
  const device = st.deviceOf(instance);
  // "Your synth" knobs are named by the user (device data), not the spec
  const k = /^k(\d+)$/.exec(control);
  if (device === 'midi-synth' && k) {
    const knob = (st.devices[instance]?.data as { knobs?: { label?: string }[] } | undefined)?.knobs?.[Number(k[1]) - 1];
    if (knob?.label) return knob.label;
  }
  const spec = getSpec(device)?.controls[control];
  return spec?.label || control;
}
