'use client';

// The "MIDI" header button: status dot, opens the settings dialog, and shows
// the MIDI learn banner while learning (so the dialog can stay closed while you
// touch controls).

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useMidiLearn } from '@/store/midi';
import { loadMidi, useMidiSnapshot, instanceLabel, controlLabel } from '@/lib/midi/lite';

// The settings dialog loads when it is first opened
const MidiSettings = dynamic(() => import('./MidiSettings'), { ssr: false });

export default function MidiButton() {
  const [open, setOpen] = useState(false);
  const snap = useMidiSnapshot();
  useEffect(() => { void loadMidi(); }, []);

  const ready = snap.status === 'ready';
  const color = !snap.support.supported ? '#4b5563' : ready ? '#22c55e' : snap.status === 'denied' || snap.status === 'error' ? '#ef4444' : '#6b7280';
  // Hardware ports only: the built-in Practice synth is always there
  const realOut = snap.outputs.filter(o => !o.virtual).length;
  const ports = snap.inputs.length + realOut;
  const title = !snap.support.supported
    ? 'No Web MIDI in this browser - press for what works here'
    : ready ? `MIDI on · ${snap.inputs.length} in, ${realOut} out` : 'MIDI keyboards, controllers and clock';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg text-sm border border-[#3a3a3a] text-gray-300 flex items-center gap-1.5"
        title={title}
        aria-label={`MIDI settings (${ready ? 'on' : 'off'})`}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: ready ? `0 0 5px ${color}` : undefined }} />
        MIDI{ready && ports ? <span className="text-[10px] text-gray-500 tabular-nums">{ports}</span> : null}
      </button>
      {open && <MidiSettings open={open} onOpenChange={setOpen} />}
      <LearnBanner onOpenSettings={() => setOpen(true)} />
    </>
  );
}

/** Floating MIDI learn guide: touch a control, move a hardware knob */
function LearnBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const armed = useMidiLearn(s => s.armed);
  const target = useMidiLearn(s => s.target);
  const last = useMidiLearn(s => s.last);
  const arm = useMidiLearn(s => s.arm);
  const snap = useMidiSnapshot();
  if (!armed || typeof document === 'undefined') return null;

  let text: React.ReactNode;
  if (snap.status !== 'ready') text = 'MIDI is off - enable it in MIDI settings first.';
  else if (target) text = <>Now move a knob, fader or button on your controller for <b>{instanceLabel(target.instance)} · {controlLabel(target.instance, target.control)}</b></>;
  else if (last) text = <>Mapped CC {last.cc} (ch {last.channel + 1}) → <b>{instanceLabel(last.instance)} · {controlLabel(last.instance, last.control)}</b>. Touch another control, or press Done.</>;
  else text = <>MIDI learn: <b>touch a control on screen</b>, then move a knob on your controller.</>;

  return createPortal(
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-xl rounded-xl border-2 border-sky-500 bg-[#0b1d2a]/95 shadow-2xl px-3 py-2 flex items-center gap-3 text-sm text-sky-50"
      role="status"
      aria-live="polite"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse motion-reduce:animate-none shrink-0" />
      <span className="flex-1 min-w-0 leading-snug">{text}</span>
      {snap.status !== 'ready' && <button onClick={onOpenSettings} className="px-2 py-1 rounded bg-[#1e3a50] text-xs shrink-0">Settings</button>}
      <button onClick={() => arm(false)} className="px-3 py-1.5 rounded bg-sky-500 text-black font-bold text-xs shrink-0">Done</button>
    </div>,
    document.body,
  );
}
