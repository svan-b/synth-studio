'use client';

// ============================================================================
// MIDI settings: permission, ports (hot-plug), input routing, clock out,
// following an external clock, MIDI learn and the learned mappings.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useStudioStore } from '@/store/studio';
import { useMidiLearn, useMidiStore, samePort } from '@/store/midi';
import { midi, useMidiSnapshot, midiActivity, midiClockIn, instanceLabel, controlLabel, synthClockTargets } from '@/lib/midi';
import { baseLatency, outputLatency } from '@/lib/midi/time';
import { getAudioContext } from '@/lib/audio/context';
import { transport } from '@/lib/audio/transport';
import type { MidiPortInfo } from '@/lib/midi';
import type { MidiSupport } from '@/lib/midi/support';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const card = 'rounded-lg border border-[#3a3a3a] bg-[#1d1d1d] p-3';
const select = 'bg-[#141414] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white';

export default function MidiSettings({ open, onOpenChange }: Props) {
  const snap = useMidiSnapshot();
  const arm = useMidiLearn(s => s.arm);
  const ready = snap.status === 'ready';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-4 sm:p-5 w-[calc(100%-1.5rem)] max-w-2xl shadow-2xl z-50 max-h-[92vh] overflow-y-auto text-white"
          aria-describedby="midi-settings-desc"
        >
          <div className="flex items-center gap-2 mb-1">
            <Dialog.Title className="text-lg font-bold">MIDI</Dialog.Title>
            <StatusChip status={snap.status} supported={snap.support.supported} />
          </div>
          <p id="midi-settings-desc" className="text-xs text-hardware-label mb-4">
            Play the studio from MIDI keyboards and controllers, send the studio clock to your hardware, and map controller knobs to any control.
          </p>

          {!snap.support.supported ? (
            <>
              <NoMidiHere support={snap.support} />
              {/* The Practice synth is a virtual port: its clock works without Web MIDI */}
              <ClockOutSection outputs={snap.outputs} />
            </>
          ) : !ready ? (
            <>
              <div className={`${card} mb-4`}>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void midi.request()}
                    disabled={snap.status === 'requesting'}
                    className="px-4 min-h-[44px] rounded bg-teaching-current text-black font-bold text-sm disabled:opacity-50"
                  >
                    {snap.status === 'requesting' ? 'Waiting for permission…' : snap.status === 'denied' ? 'Try again' : 'Enable MIDI'}
                  </button>
                  <span className="text-xs text-gray-300 flex-1 min-w-[12rem] leading-snug">
                    {snap.error ?? 'Your browser will ask for permission to use MIDI devices. Synth Studio asks only when you press this button.'}
                  </span>
                </div>
                {snap.support.message && <p className="text-[11px] text-gray-400 mt-2 leading-snug">{snap.support.message}</p>}
              </div>
              <ClockOutSection outputs={snap.outputs} />
            </>
          ) : (
            <>
              <InputsSection inputs={snap.inputs} />
              <ClockOutSection outputs={snap.outputs} />
              <ClockInSection inputs={snap.inputs} />
            </>
          )}

          <MappingsSection
            onLearn={() => { arm(true); onOpenChange(false); }}
            canLearn={ready}
            supported={snap.support.supported}
          />

          <p className="text-[10px] text-gray-500 mt-3 leading-snug">
            Web MIDI works in Chrome and Edge on a computer (and Opera), and in Firefox, which installs a small site-permission add-on. Safari and every browser on iPad/iPhone have no Web MIDI.
            Settings are saved in this browser - MIDI ports belong to this computer, not to a project.
          </p>
          <div className="mt-3 flex justify-end">
            <Dialog.Close asChild><button className="px-4 min-h-[44px] bg-[#3a3a3a] text-white rounded text-sm">Close</button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusChip({ status, supported }: { status: string; supported: boolean }) {
  const [color, text] = !supported ? ['#6b7280', 'not available'] :
    status === 'ready' ? ['#22c55e', 'on'] :
      status === 'requesting' ? ['#f97316', 'asking…'] :
        status === 'denied' ? ['#ef4444', 'blocked'] :
          status === 'error' ? ['#ef4444', 'error'] : ['#9ca3af', 'off'];
  return (
    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-[#3a3a3a]" style={{ color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

/** Re-render on a timer while the dialog is open (activity LEDs, clock status) */
function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Led({ on, title }: { on: boolean; title: string }) {
  return <span title={title} className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: on ? '#22c55e' : '#2b2b2b', boxShadow: on ? '0 0 6px #22c55e' : undefined }} />;
}

// ----------------------------------------------------------------------------

function InputsSection({ inputs }: { inputs: MidiPortInfo[] }) {
  useTick(120);
  const disabled = useMidiStore(s => s.disabledInputs);
  const targets = useMidiStore(s => s.inputTargets);
  const channel = useMidiStore(s => s.inputChannel);
  const setEnabled = useMidiStore(s => s.setInputEnabled);
  const setTarget = useMidiStore(s => s.setInputTarget);
  const setChannel = useMidiStore(s => s.setInputChannel);
  const rack = useStudioStore(s => s.studio.rack);
  const now = performance.now();

  return (
    <section className={`${card} mb-3`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-sm font-bold">Inputs <span className="font-normal text-gray-500">keyboards &amp; controllers</span></h3>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
          Channel
          <select className={select} value={String(channel)} onChange={e => setChannel(e.target.value === 'omni' ? 'omni' : Number(e.target.value))} aria-label="Input channel">
            <option value="omni">All (omni)</option>
            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
          </select>
        </label>
      </div>
      {!inputs.length && <p className="text-xs text-gray-500">No MIDI inputs. Plug in a keyboard or controller - it appears here by itself.</p>}
      <ul className="space-y-1.5">
        {inputs.map(p => {
          const on = !disabled.includes(p.name);
          const active = now - (midiActivity.get(p.id) ?? -1e9) < 150;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
              <input type="checkbox" checked={on} onChange={e => setEnabled(p.name, e.target.checked)} className="accent-green-500" aria-label={`Listen to ${p.name}`} />
              <Led on={on && active} title="Activity" />
              <span className={`min-w-0 truncate ${p.state === 'disconnected' ? 'text-gray-500 line-through' : on ? 'text-white' : 'text-gray-500'}`}>{p.name}</span>
              <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
                plays
                <select className={select} value={targets[p.name] ?? 'focused'} onChange={e => setTarget(p.name, e.target.value)} disabled={!on} aria-label={`${p.name} plays`}>
                  <option value="focused">the focused instrument</option>
                  {rack.map(r => <option key={r.id} value={r.id}>{instanceLabel(r.id)}</option>)}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-gray-500 mt-2">Unticked inputs are released, so other apps can use them.</p>
    </section>
  );
}

// ----------------------------------------------------------------------------

/** iPad / Safari / no Web MIDI: say why, kindly, and what works here instead */
function NoMidiHere({ support }: { support: MidiSupport }) {
  const ipad = support.reason === 'ios';
  const platform = support.reason === 'ios' || support.reason === 'safari' || support.reason === 'no-api';
  return (
    <div className={`${card} mb-3 border-amber-800/70 bg-amber-950/30`} role="note">
      <p className="text-sm text-amber-100 leading-relaxed">{support.message || 'MIDI is not available here.'}</p>
      {platform && (
        <>
          <h4 className="text-xs font-bold text-amber-200 mt-3 mb-1">What works {ipad ? 'on this iPad' : 'in this browser'}</h4>
          <ul className="text-xs text-amber-100/90 space-y-1 list-disc pl-5 leading-snug">
            <li>
              <b>Audio input</b>: {ipad ? 'a class-compliant USB audio interface (through a USB-C or Lightning adapter) or the built-in microphone' : 'your audio interface or the built-in microphone'} brings
              any synth&apos;s sound into the studio to mix and record. Play the synth with its own keys.
            </li>
            <li><b>Web Audio plugins</b>: browser synths and effects, including two built-in ones that work offline.</li>
            <li><b>Your synth (MIDI) with the Practice synth</b>: learn ports, channels, CCs, program changes and clock on the built-in synth.</li>
          </ul>
          <p className="text-xs text-amber-200/90 mt-2">
            For MIDI gear (keyboards, controllers, clock to hardware), open Synth Studio in <b>Chrome or Edge on a computer</b>.
          </p>
        </>
      )}
    </div>
  );
}

function ClockOutSection({ outputs }: { outputs: MidiPortInfo[] }) {
  const clock = useMidiStore(s => s.clockOut);
  const setTarget = useMidiStore(s => s.setClockTarget);
  const setClock = useMidiStore(s => s.setClockOut);
  // Re-render when a "Your synth" turns its clock on or off
  useStudioStore(s => s.devices);
  useStudioStore(s => s.studio.rack);
  const fromSynths = synthClockTargets();
  const [playing, setPlaying] = useState(transport.playing);
  useEffect(() => transport.onEvent(e => {
    if (e.type === 'start') setPlaying(true);
    if (e.type === 'stop') setPlaying(false);
  }), []);
  const [lat, setLat] = useState({ out: 0, base: 0 });
  useEffect(() => {
    const read = () => { try { const c = getAudioContext(); setLat({ out: outputLatency(c) * 1000, base: baseLatency(c) * 1000 }); } catch { /* */ } };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, []);
  // Saved targets that are not plugged in right now
  const missing = clock.targets.filter(t => !outputs.some(o => samePort(o, t)));
  const real = outputs.filter(o => !o.virtual);
  const builtIn = outputs.filter(o => o.virtual);

  const row = (o: MidiPortInfo) => {
    const ticked = clock.targets.some(t => samePort(o, t));
    const synths = fromSynths.filter(s => samePort(s.port, o));
    const on = ticked || synths.length > 0;
    return (
      <li key={o.id}>
        <label className="flex items-center gap-2.5 text-xs min-h-[40px]">
          <input
            type="checkbox"
            checked={on}
            disabled={!ticked && synths.length > 0}
            onChange={e => setTarget({ id: o.id, name: o.name }, e.target.checked)}
            className="accent-green-500 w-5 h-5 shrink-0"
            aria-label={`Send clock to ${o.name}`}
          />
          <span className={o.state === 'disconnected' ? 'text-gray-500' : 'text-white'}>{o.name}</span>
          {synths.length > 0 && (
            <span className="text-[10px] text-gray-400">
              from {synths.map(s => instanceLabel(s.instance)).join(', ')}{!ticked ? ' (turn it off in its Setup)' : ''}
            </span>
          )}
          {on && (
            <span className={`ml-auto flex items-center gap-1 text-[10px] ${playing ? 'text-green-300' : 'text-gray-500'}`}>
              <Led on={playing} title={playing ? 'Clock running' : 'Clock waits for Play'} />
              {playing ? 'running' : 'ready'}
            </span>
          )}
        </label>
      </li>
    );
  };

  return (
    <section className={`${card} mb-3`}>
      <h3 className="text-sm font-bold mb-1">Clock out <span className="font-normal text-gray-500">sync hardware to the studio</span></h3>
      <p className="text-[11px] text-gray-400 mb-2 leading-snug">
        24 pulses per beat plus Start / Stop / Continue and Song Position, timestamped from the studio transport. Tick a port here, or
        &quot;Send MIDI clock&quot; in a Your synth Setup; each port gets one clock however many synths share it.
      </p>
      {!real.length && !builtIn.length && <p className="text-xs text-gray-500 mb-1">No MIDI outputs.</p>}
      <ul className="space-y-0.5 mb-2">
        {real.map(row)}
        {missing.map(t => (
          <li key={t.id} className="flex items-center gap-2.5 text-xs text-gray-500 min-h-[40px]">
            <input type="checkbox" checked onChange={() => setTarget(t, false)} className="accent-green-500 w-5 h-5" aria-label={`Stop sending clock to ${t.name}`} />
            {t.name} <span className="text-[10px]">(not connected - clock resumes when it is)</span>
          </li>
        ))}
      </ul>
      {builtIn.length > 0 && (
        <>
          <h4 className="text-[10px] uppercase tracking-wider text-gray-500">Built in</h4>
          <ul className="space-y-0.5 mb-2">{builtIn.map(row)}</ul>
        </>
      )}
      <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-300">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={clock.compensate} onChange={e => setClock({ compensate: e.target.checked })} className="accent-green-500 mt-0.5" />
          <span>Line hardware up with what you hear <span className="text-gray-500">(+{lat.out.toFixed(0)} ms output latency{lat.base ? `; base ${lat.base.toFixed(0)} ms not added` : ''})</span></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={clock.spp} onChange={e => setClock({ spp: e.target.checked })} className="accent-green-500 mt-0.5" />
          <span>Song Position + Continue when starting mid-song</span>
        </label>
        <label className="flex items-center gap-2">
          Offset
          <input
            type="number" value={clock.offsetMs} min={-200} max={200} step={1}
            onChange={e => setClock({ offsetMs: Math.max(-200, Math.min(200, Number(e.target.value) || 0)) })}
            className="w-20 bg-[#141414] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white" aria-label="MIDI offset in milliseconds"
          />
          <span className="text-gray-500 text-[11px]">ms (+ later, − earlier)</span>
        </label>
      </div>
      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        Swing is not sent (clock stays even, so hardware locks its tempo); set swing on the hardware. The offset also applies to &quot;Your synth&quot; sequencers.
      </p>
    </section>
  );
}

// ----------------------------------------------------------------------------

function ClockInSection({ inputs }: { inputs: MidiPortInfo[] }) {
  useTick(300);
  const clockIn = useMidiStore(s => s.clockIn);
  const setClockIn = useMidiStore(s => s.setClockIn);
  const st = midiClockIn.status();
  const port = clockIn.port ?? '';

  return (
    <section className={`${card} mb-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={clockIn.enabled}
            onChange={e => setClockIn({ enabled: e.target.checked, port: clockIn.port ?? inputs[0]?.name ?? null })}
            className="accent-green-500"
          />
          Follow an external clock
        </label>
        <select
          className={`${select} ml-auto`}
          value={port}
          onChange={e => setClockIn({ port: e.target.value || null })}
          disabled={!clockIn.enabled}
          aria-label="Clock source"
        >
          <option value="">- choose input -</option>
          {inputs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          {port && !inputs.some(p => p.name === port) && <option value={port}>{port} (not connected)</option>}
        </select>
      </div>
      {clockIn.enabled && (
        <p className="text-[11px] mt-2 flex items-center gap-2 text-gray-300">
          <Led on={st.receiving} title="Clock received" />
          {st.receiving ? `Receiving ${st.bpm ? `${st.bpm.toFixed(1)} BPM` : 'clock…'}` : 'No clock arriving'}
          {st.running ? ' · following Start' : ''}
          {st.phaseMs !== null && st.running ? ` · phase ${st.phaseMs >= 0 ? '+' : ''}${st.phaseMs.toFixed(1)} ms` : ''}
        </p>
      )}
      <p className="text-[10px] text-gray-500 mt-1 leading-snug">
        A drum machine or DAW becomes the master: its tempo, Start, Stop and Song Position drive the studio transport. Clock is not sent back to that port.
      </p>
    </section>
  );
}

// ----------------------------------------------------------------------------

function MappingsSection({ onLearn, canLearn, supported }: { onLearn: () => void; canLearn: boolean; supported: boolean }) {
  const mappings = useMidiStore(s => s.mappings);
  const remove = useMidiStore(s => s.removeMapping);
  const clear = useMidiStore(s => s.clearMappings);
  const rack = useStudioStore(s => s.studio.rack);
  const sorted = useMemo(() => [...mappings].sort((a, b) => a.createdAt - b.createdAt), [mappings]);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-sm font-bold">MIDI learn</h3>
        <span className="text-[11px] text-gray-400">Map a controller knob to any control on screen.</span>
        <button
          onClick={onLearn}
          disabled={!canLearn}
          className="ml-auto px-3 min-h-[44px] rounded bg-sky-500 text-black font-bold text-xs disabled:opacity-40"
          title={canLearn ? 'Then touch a control on screen and move a knob on your controller' : supported ? 'Enable MIDI first' : 'Needs Web MIDI: Chrome or Edge on a computer'}
        >
          Start MIDI learn
        </button>
      </div>
      {!sorted.length ? (
        <p className="text-xs text-gray-500">
          {supported
            ? 'No mappings yet. Press Start MIDI learn, touch a control on screen, then move a knob or fader on your controller.'
            : 'MIDI learn maps a knob on a MIDI controller to any control on screen. It needs Web MIDI: Chrome or Edge on a computer.'}
        </p>
      ) : (
        <>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {sorted.map(m => {
              const present = rack.some(r => r.id === m.instance);
              return (
                <li key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-gray-300 w-24 shrink-0">CC {m.cc} · ch {m.channel + 1}</span>
                  <span className={`min-w-0 truncate ${present ? 'text-white' : 'text-gray-500'}`}>
                    → {instanceLabel(m.instance)} · {controlLabel(m.instance, m.control)}{m.toggle ? ' (toggle)' : ''}
                    {!present && ' (not in the studio)'}
                  </span>
                  {m.port && <span className="text-[10px] text-gray-500 truncate">from {m.port}</span>}
                  <button onClick={() => remove(m.id)} className="ml-auto text-red-300 hover:text-red-200 shrink-0" aria-label={`Remove mapping CC ${m.cc}`}>remove</button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => { if (confirm('Remove every MIDI mapping?')) clear(); }} className="mt-2 px-2 py-1 rounded bg-[#2a2a2a] text-[11px] text-gray-300">
            Clear all ({sorted.length})
          </button>
        </>
      )}
    </section>
  );
}
