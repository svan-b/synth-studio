'use client';

// ============================================================================
// "Your synth (MIDI)" panel widgets (custom layout elements):
//   KnobCaption  label + CC value around each CC knob (labels come from data)
//   Header       name, where the MIDI goes (port, channel), clock, actions
//   ProgramBox   program change - / + with the program's name on the Practice synth
//   MonitorBox   the last MIDI messages sent, decoded (what MIDI actually is)
//   StepEditor   16 steps with step entry: tap a note name, then play a key
// Touch targets are at least 44 px at the panel's native size.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { DEVICES } from '@/devices';
import { useStudioStore } from '@/store/studio';
import { useMidiStore } from '@/store/midi';
import { midi } from '@/lib/midi/access';
import { isClockTarget, useMidiSnapshot, usePracticeStatus } from '@/lib/midi';
import { midiNoteName } from '@/lib/midi/bytes';
import { partFor, programName } from '@/lib/midi/practice-core';
import { GUIDE_ATTRIBUTION } from './guide';
import {
  KNOB_IDS, STEPS, asData, channelClashes, isPractice, knobText, rackLabel, PRACTICE_PORT,
  type MidiSynthData, type SeqStep, type SynthUse,
} from './config';
import type { MonitorEntry } from './engine';
import SetupDialog from './setup';
import StartersDialog from './starters';

const ACCENT = '#2dd4bf';
const GREEN = '#22c55e';
const ORANGE = '#f97316';
const RED = '#ef4444';
const GREY = '#8a9a98';

/** Lesson spotlight for custom widgets: steps name them in `focus` */
const lit = (ctx: CustomRenderContext, id: string) => !!ctx.step?.focus?.includes(id);
const glow = (on: boolean) => (on ? { boxShadow: '0 0 0 3px #facc15, 0 0 18px rgba(250,204,21,0.6)' } : undefined);

// ----------------------------------------------------------------------------
// Knob captions
// ----------------------------------------------------------------------------

export function KnobCaption({ index, ctx }: { index: number; ctx: CustomRenderContext }) {
  const knobs = asData(ctx.data).knobs;
  const k = knobs[index];
  const pos = Number(ctx.values[KNOB_IDS[index]] ?? 64);
  // Empty slots stay quiet; the first one says how to fill them
  const firstFree = !k && index === knobs.length;
  return (
    <div
      style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
      className="flex flex-col items-center justify-between select-none"
      aria-hidden
    >
      <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center leading-tight" style={{ fontSize: k ? 11 : 9, color: k ? '#e6f2f0' : '#5d706e' }}>
        {k ? k.label : firstFree ? '+ more in Setup' : ''}
      </div>
      {k ? (
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-mono rounded px-1 py-0.5" style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,0,0,0.85)' }}>{knobText(k, pos)}</span>
          <span className="font-mono" style={{ fontSize: 9, color: '#7f9997' }}>CC{k.cc}{k.lsb !== undefined ? `/${k.lsb}` : ''}</span>
        </div>
      ) : <span />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Several "Your synth" instances: who uses which port and channel
// ----------------------------------------------------------------------------

/** Every "Your synth" in the rack, as a stable key (re-render only when one changes) */
function useSynthUses(): SynthUse[] {
  const key = useStudioStore(s => JSON.stringify(s.studio.rack.filter(r => r.device === 'midi-synth').map(r => {
    const d = s.devices[r.id]?.data as Partial<MidiSynthData> | undefined;
    return { instance: r.id, name: d?.name ?? '', port: d?.port ?? null, channel: d?.channel ?? 0 };
  })));
  return useMemo(() => JSON.parse(key) as SynthUse[], [key]);
}

/** "Your synth (MIDI) 2": what the rack calls an instance before it has a name */
function defaultRackName(instance: string) {
  const base = DEVICES.find(d => d.id === 'midi-synth')?.name ?? 'Your synth (MIDI)';
  return instance.includes('#') ? `${base} ${instance.split('#')[1]}` : base;
}

/** Keep the rack tab (and every routing / MIDI menu) named after the synth */
function useRackLabel(instance: string, data: MidiSynthData, uses: SynthUse[]) {
  const current = useStudioStore(s => s.studio.rack.find(r => r.id === instance)?.label);
  const wanted = rackLabel(data.name, data.channel, instance, uses) ?? defaultRackName(instance);
  useEffect(() => {
    const st = useStudioStore.getState();
    const slot = st.studio.rack.find(r => r.id === instance);
    if (!slot) return;
    if ((slot.label ?? defaultRackName(instance)) !== wanted) st.renameInstance(instance, wanted);
  }, [instance, wanted, current]);
}

// ----------------------------------------------------------------------------
// Header: name, template, where the MIDI goes, clock, actions
// ----------------------------------------------------------------------------

export function Header(ctx: CustomRenderContext) {
  const data = asData(ctx.data);
  const snap = useMidiSnapshot();
  const practice = usePracticeStatus();
  useMidiStore(s => s.clockOut); // re-render when clock targets change
  const uses = useSynthUses();
  useRackLabel(ctx.instance, data, uses);
  const [setup, setSetup] = useState(false);
  const [starters, setStarters] = useState(false);
  const virtual = isPractice(data.port);
  const out = data.port
    ? snap.outputs.find(o => o.id === data.port!.id) ?? snap.outputs.find(o => o.name === data.port!.name)
    : undefined;
  const clockOn = isClockTarget(data.port);
  const playing = !!ctx.engine.playing;
  const clashes = channelClashes(ctx.instance, data.port, data.channel, uses);
  const part = virtual ? partFor(data.channel) : undefined;

  // Where the notes go
  let color = GREEN;
  let text: string;
  let action: { label: string; run: () => void } | null = null;
  if (!data.port) {
    color = ORANGE;
    text = 'No MIDI output chosen';
    action = { label: 'Use the Practice synth', run: () => ctx.updateData(d => ({ ...asData(d), port: { ...PRACTICE_PORT } })) };
  } else if (virtual) {
    text = `Practice synth · ch ${data.channel + 1}${part ? ` · ${part.name} part` : ''}`;
    if (!part) color = ORANGE;
  } else if (!snap.support.supported) {
    color = GREY;
    text = `${data.port.name} · needs Web MIDI`;
    action = { label: 'Use the Practice synth', run: () => ctx.updateData(d => ({ ...asData(d), port: { ...PRACTICE_PORT } })) };
  } else if (snap.status !== 'ready') {
    color = ORANGE;
    text = snap.status === 'denied' ? 'MIDI is blocked for this site' : snap.status === 'requesting' ? 'Waiting for permission…' : `MIDI is off · ${data.port.name}`;
    if (snap.status !== 'requesting') action = { label: snap.status === 'denied' ? 'Try again' : 'Enable MIDI', run: () => void midi.request() };
  } else if (!out || out.state === 'disconnected') {
    color = RED;
    text = `${data.port.name} is not connected`;
  } else {
    text = `${out.name} · ch ${data.channel + 1}`;
  }

  // One line of advice, most important first
  let note: { text: string; color: string } | null = null;
  if (clashes.length) {
    note = { text: `Same output and channel as ${clashes.map(c => c.name || c.instance).join(', ')}: both play one part. Give each synth its own channel in Setup.`, color: '#fdba74' };
  } else if (virtual && !part) {
    note = { text: `Nothing on the Practice synth listens on channel ${data.channel + 1}: its parts are on 1 (bass), 2 (keys) and 10 (drums). The notes are still sent - watch the monitor.`, color: '#fdba74' };
  } else if (!snap.support.supported && (snap.support.reason === 'ios' || snap.support.reason === 'safari')) {
    note = {
      text: snap.support.reason === 'ios'
        ? 'iPad has no Web MIDI, so this plays the built-in Practice synth. For your own synth\'s MIDI, use Chrome or Edge on a computer.'
        : 'Safari has no Web MIDI, so this plays the built-in Practice synth. For your own synth\'s MIDI, use Chrome or Edge.',
      color: '#c3d1cf',
    };
  } else if (snap.support.supported && snap.status === 'denied') {
    note = { text: snap.error ?? 'Allow MIDI in the site settings (the icon left of the address), then press Try again.', color: '#fdba74' };
  } else if (virtual) {
    note = {
      text: practice.listeners
        ? 'You hear the Practice synth through Audio input: mix it, route it and record it like hardware.'
        : 'You hear the Practice synth directly, like a synth on headphones. Add an Audio input and pick it to bring it into the studio.',
      color: '#9fb3b1',
    };
  }

  return (
    <div className="w-full h-full flex items-center gap-3 px-2.5 rounded" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #26403d' }}>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-white truncate" style={{ fontSize: 18 }}>{data.name}</span>
          {data.template && (
            <a
              href={data.template.source}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline shrink min-w-0"
              style={{ fontSize: 10, color: '#7f9997' }}
              title={`Knobs from the ${data.template.manufacturer} ${data.template.device} template. ${GUIDE_ATTRIBUTION}`}
            >
              template: {data.template.manufacturer} {data.template.device} · midi.guide (CC BY-SA 4.0)
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 12 }}>
          <Chip color={color} title={virtual ? 'The built-in Practice synth: a synth at the end of a virtual MIDI cable' : 'Where this panel sends its MIDI'}>
            <span className="truncate" data-testid="midi-synth-status">{text}</span>
          </Chip>
          <Chip
            color={clockOn ? GREEN : '#4b5a58'}
            dim={!clockOn}
            title={clockOn
              ? 'This synth gets MIDI clock (24 pulses per beat) with Start and Stop, so its arpeggiator and sequencer follow the studio'
              : 'No MIDI clock to this synth. Tick "Send MIDI clock" in Setup when its arpeggiator or sequencer should follow the studio.'}
            style={glow(lit(ctx, 'clock'))}
          >
            <BeatLed on={clockOn && playing} beat={Number(ctx.engine.beat ?? 0)} />
            <span>{clockOn ? (playing ? 'clock running' : 'clock ready') : 'no clock'}</span>
          </Chip>
          <span
            className="inline-block rounded-full shrink-0"
            title="MIDI out activity"
            style={{ width: 8, height: 8, background: ctx.engine.out ? ACCENT : '#203230', boxShadow: ctx.engine.out ? `0 0 6px ${ACCENT}` : undefined }}
          />
          {action && <PanelButton small accent onClick={action.run}>{action.label}</PanelButton>}
        </div>
        {note && <div className="truncate" style={{ fontSize: 11, color: note.color }} title={note.text}>{note.text}</div>}
      </div>
      <PanelButton onClick={() => setStarters(true)} title="Ready-made setups: the Practice synth, a hardware synth with clock, a drum machine on channel 10, patterns" style={glow(lit(ctx, 'starters'))}>Starters</PanelButton>
      <PanelButton onClick={() => setSetup(true)} accent={!data.port} style={glow(lit(ctx, 'setup'))}>Setup…</PanelButton>
      <PanelButton onClick={() => ctx.sendEvent('send-all')} title="Send the program and every knob to the synth (recall this panel on the hardware)" style={glow(lit(ctx, 'send-all'))}>Send all</PanelButton>
      <PanelButton onClick={() => ctx.sendEvent('panic')} title="All notes off: silence stuck notes on this synth's channel">Panic</PanelButton>
      {setup && (
        <SetupDialog
          instance={ctx.instance}
          data={data}
          uses={uses}
          onClose={() => setSetup(false)}
          onSave={next => { ctx.updateData(() => next); setSetup(false); }}
        />
      )}
      {starters && (
        <StartersDialog
          data={data}
          onClose={() => setStarters(false)}
          onApply={(next, values) => {
            ctx.updateData(() => next);
            Object.entries(values ?? {}).forEach(([k, v]) => ctx.setValue(k, v));
            setStarters(false);
            if (!next.port) setSetup(true);
          }}
        />
      )}
    </div>
  );
}

function Chip({ children, color, title, dim, style }: { children: React.ReactNode; color: string; title?: string; dim?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 min-w-0 shrink"
      title={title}
      style={{ height: 24, background: 'rgba(0,0,0,0.45)', border: `1px solid ${dim ? '#2c403e' : `${color}88`}`, color: dim ? '#7f9997' : '#e6f2f0', ...style }}
    >
      {!dim && <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: color, boxShadow: `0 0 6px ${color}` }} />}
      {children}
    </span>
  );
}

/** Flashes on every quarter note while clock is sent and the studio plays */
function BeatLed({ on, beat }: { on: boolean; beat: number }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!on || !beat) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 90);
    return () => clearTimeout(t);
  }, [beat, on]);
  return (
    <span
      className="inline-block rounded-full shrink-0"
      aria-hidden
      style={{ width: 8, height: 8, background: on && flash ? '#facc15' : on ? '#3f4d1f' : '#26302f', boxShadow: on && flash ? '0 0 8px #facc15' : undefined }}
    />
  );
}

export function PanelButton({ children, onClick, title, accent, small, style }: {
  children: React.ReactNode; onClick: () => void; title?: string; accent?: boolean; small?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 rounded font-bold whitespace-nowrap"
      style={{
        fontSize: small ? 11 : 13,
        minHeight: small ? 26 : 44,
        padding: small ? '2px 8px' : '0 14px',
        color: accent ? '#06201d' : '#e6f2f0',
        background: accent ? ACCENT : '#22302f',
        border: `1px solid ${accent ? ACCENT : '#3c5552'}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Program change
// ----------------------------------------------------------------------------

export function ProgramBox(ctx: CustomRenderContext) {
  const data = asData(ctx.data);
  const value = Math.round(Number(ctx.values.program ?? 0));
  const name = isPractice(data.port) ? programName(data.channel, value) : null;
  const set = (v: number) => ctx.setValue('program', Math.max(0, Math.min(127, v)));
  const bank = data.bank?.msb !== null && data.bank?.msb !== undefined ? `bank ${data.bank.msb}${data.bank.lsb !== null && data.bank.lsb !== undefined ? `.${data.bank.lsb}` : ''} · ` : '';
  return (
    <div className="w-full h-full flex items-center gap-1.5 select-none rounded" style={glow(lit(ctx, 'program'))}>
      <SquareButton onClick={() => set(value - 1)} label="Previous program">−</SquareButton>
      <div className="flex-1 min-w-0 text-center leading-tight" aria-live="polite">
        <div className="font-mono font-bold text-white" style={{ fontSize: 20 }}>{String(value + 1).padStart(3, '0')}</div>
        <div className="truncate" style={{ fontSize: 10, color: name ? '#5eead4' : '#7f9997' }} title={`${bank}program ${value + 1} is sent as MIDI value ${value}`}>
          {name ?? `${bank}sends ${value}`}
        </div>
      </div>
      <SquareButton onClick={() => set(value + 1)} label="Next program">+</SquareButton>
    </div>
  );
}

function SquareButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded font-bold shrink-0 flex items-center justify-center"
      style={{ width: 44, height: 44, fontSize: 20, color: '#e6f2f0', background: '#22302f', border: '1px solid #3c5552' }}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// MIDI monitor
// ----------------------------------------------------------------------------

export function MonitorBox(ctx: CustomRenderContext) {
  const entries = (ctx.engine.monitor as MonitorEntry[] | undefined) ?? [];
  const shown = entries.slice(-5).reverse();
  return (
    <div className="w-full h-full flex flex-col rounded overflow-hidden select-none" style={{ background: '#070b0b', border: '1px solid #213533', ...glow(lit(ctx, 'monitor')) }} aria-label="MIDI monitor: the last messages sent" role="log">
      {!shown.length ? (
        <div className="flex-1 flex items-center justify-center text-center px-2 leading-snug" style={{ fontSize: 11, color: '#6f8583' }}>
          Play a key or turn a knob: every MIDI message this panel sends shows up here.
        </div>
      ) : (
        <ul className="flex-1 flex flex-col justify-start px-1.5 py-1 gap-[2px]">
          {shown.map((e, i) => (
            <li key={e.n} className="flex items-baseline gap-1.5 font-mono whitespace-nowrap" style={{ fontSize: 10.5, color: i === 0 ? '#e6f2f0' : '#9fb3b1' }}>
              <span style={{ color: '#5eead4', width: 30 }} className="shrink-0">{e.channel !== null ? `ch${e.channel + 1}` : 'sys'}</span>
              <span className="shrink-0" style={{ width: 58 }}>{e.kind}</span>
              <span className="truncate flex-1 min-w-0">{e.detail}</span>
              <span className="shrink-0" style={{ color: '#5c7472' }}>{e.hex}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Step sequencer editor
// ----------------------------------------------------------------------------

interface LastNote { note: number; velocity: number; n: number }

export function StepEditor(ctx: CustomRenderContext) {
  const data = asData(ctx.data);
  const sel = typeof ctx.ui.sel === 'number' && ctx.ui.sel >= 0 && ctx.ui.sel < STEPS ? ctx.ui.sel : null;
  const length = Math.max(1, Math.min(STEPS, Math.round(Number(ctx.values.length ?? 16))));
  const transpose = Math.round(Number(ctx.values.transpose ?? 0));
  const seqOn = ctx.values.seq !== false;
  const playing = !!ctx.engine.playing;
  const playStep = typeof ctx.engine.step === 'number' ? ctx.engine.step : -1;
  const lastNote = ctx.engine.lastNote as LastNote | undefined;
  const drums = data.channel === 9;

  const update = (fn: (steps: SeqStep[]) => SeqStep[]) =>
    ctx.updateData(d => {
      const cur: MidiSynthData = asData(d);
      return { ...cur, steps: fn(cur.steps.map(s => ({ ...s }))) };
    });

  // Step entry: with a step selected, the next note you play (on screen, computer keys
  // or MIDI input) is written into it, and the selection moves on
  const seen = useRef(lastNote?.n ?? 0);
  useEffect(() => {
    if (!lastNote || lastNote.n === seen.current) return;
    seen.current = lastNote.n;
    if (sel === null) return;
    const note = Math.max(0, Math.min(127, lastNote.note - transpose));
    const vel = Math.max(1, Math.min(127, Math.round(lastNote.velocity * 127)));
    update(steps => { steps[sel] = { on: true, note, vel }; return steps; });
    ctx.setUi({ sel: (sel + 1) % length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNote?.n]);

  const selected = sel !== null ? data.steps[sel] : null;
  const nudge = (semis: number) => sel !== null && update(steps => {
    steps[sel] = { ...steps[sel], note: Math.max(0, Math.min(127, steps[sel].note + semis)) };
    return steps;
  });
  const noteLabel = (n: number) => midiNoteName(Math.max(0, Math.min(127, n + transpose)));

  return (
    <div className="w-full h-full flex flex-col gap-1 select-none rounded" style={glow(lit(ctx, 'steps'))}>
      <div className="grid gap-[3px] flex-1" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
        {data.steps.map((s, i) => {
          const active = i < length;
          const current = playing && seqOn && i === playStep;
          const isSel = sel === i;
          return (
            <div key={i} className="flex flex-col items-stretch gap-[3px]" style={{ opacity: active ? 1 : 0.35 }}>
              <button
                onClick={() => ctx.setUi({ sel: isSel ? null : i })}
                className="rounded font-mono leading-none truncate"
                style={{
                  fontSize: 11,
                  height: 40,
                  color: s.on ? '#e6f2f0' : '#6f8583',
                  background: isSel ? '#0f4f48' : 'rgba(0,0,0,0.45)',
                  border: `1px solid ${isSel ? ACCENT : '#2c403e'}`,
                }}
                title={`Step ${i + 1}: ${noteLabel(s.note)}${drums ? ` (note ${s.note + transpose})` : ''}, velocity ${s.vel} - tap to edit, then play a key`}
                aria-pressed={isSel}
                aria-label={`Edit step ${i + 1}`}
              >
                {drums ? s.note + transpose : noteLabel(s.note)}
              </button>
              <button
                onClick={() => update(steps => { steps[i] = { ...steps[i], on: !steps[i].on }; return steps; })}
                className="rounded flex-1 relative overflow-hidden"
                style={{
                  minHeight: 52,
                  background: s.on ? '#14302d' : '#1b2726',
                  border: `2px solid ${current ? '#ffffff' : i % 4 === 0 ? '#3d5a57' : '#2c403e'}`,
                  boxShadow: current ? '0 0 10px rgba(255,255,255,0.7)' : 'inset 0 2px 4px rgba(0,0,0,0.6)',
                }}
                aria-pressed={s.on}
                aria-label={`Step ${i + 1} ${s.on ? 'on' : 'off'}, velocity ${s.vel}`}
                data-step={i}
              >
                {/* Velocity bar: how hard this step plays */}
                {s.on && (
                  <span
                    className="absolute left-0 right-0 bottom-0"
                    style={{ height: `${Math.max(12, (s.vel / 127) * 100)}%`, background: s.vel >= 112 ? '#5eead4' : ACCENT, opacity: 0.35 + 0.65 * (s.vel / 127) }}
                  />
                )}
                <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 font-bold" style={{ fontSize: 10, color: s.on ? '#04201c' : '#5d6b6a' }}>{i + 1}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 rounded px-1.5" style={{ height: 46, background: 'rgba(0,0,0,0.35)', fontSize: 12, color: '#c9d6d4' }}>
        {selected && sel !== null ? (
          <>
            <span className="font-bold text-white whitespace-nowrap">Step {sel + 1}</span>
            <span className="font-mono whitespace-nowrap" style={{ color: ACCENT, minWidth: 34 }}>{drums ? selected.note + transpose : noteLabel(selected.note)}</span>
            <MiniButton onClick={() => ctx.setUi({ sel: (sel + STEPS - 1) % STEPS })} label="Previous step">◀</MiniButton>
            <MiniButton onClick={() => ctx.setUi({ sel: (sel + 1) % STEPS })} label="Next step">▶</MiniButton>
            <MiniButton onClick={() => nudge(-1)} label="Semitone down">−1</MiniButton>
            <MiniButton onClick={() => nudge(1)} label="Semitone up">+1</MiniButton>
            <MiniButton onClick={() => nudge(-12)} label="Octave down">−12</MiniButton>
            <MiniButton onClick={() => nudge(12)} label="Octave up">+12</MiniButton>
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              vel
              <input
                type="range" min={1} max={127} value={selected.vel}
                onChange={e => { const vel = Number(e.target.value); update(steps => { steps[sel] = { ...steps[sel], vel }; return steps; }); }}
                className="w-28" style={{ accentColor: ACCENT, height: 32 }} aria-label="Step velocity"
              />
              <span className="font-mono w-7">{selected.vel}</span>
            </label>
            <span className="truncate" style={{ color: '#7f9997' }}>play a key to set the note</span>
            <MiniButton onClick={() => ctx.setUi({ sel: null })} label="Done editing">Done</MiniButton>
          </>
        ) : (
          <span className="truncate" style={{ color: '#9fb3b1' }}>
            Tap a step to switch it on or off (the bar is its velocity). Tap a note name, then play a key to enter notes.
          </span>
        )}
      </div>
    </div>
  );
}

function MiniButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded font-bold shrink-0"
      style={{ fontSize: 12, minWidth: 40, height: 40, padding: '0 6px', color: '#e6f2f0', background: '#22302f', border: '1px solid #3c5552' }}
    >
      {children}
    </button>
  );
}
