'use client';

// ============================================================================
// "Your synth (MIDI)" panel widgets (custom layout elements):
//   KnobCaption  label + CC value around each CC knob (labels come from data)
//   Header       name, port status, Setup / Send all / Panic
//   StepEditor   16 steps with step entry: tap a note name, then play a key
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CustomRenderContext } from '@/types/panel';
import { midi } from '@/lib/midi/access';
import { useMidiSnapshot } from '@/lib/midi';
import { midiNoteName } from '@/lib/midi/bytes';
import { GUIDE_ATTRIBUTION } from './guide';
import { KNOB_IDS, STEPS, asData, knobText, type MidiSynthData, type SeqStep } from './config';
import SetupDialog from './setup';

const ACCENT = '#2dd4bf';

// ----------------------------------------------------------------------------
// Knob captions
// ----------------------------------------------------------------------------

export function KnobCaption({ index, ctx }: { index: number; ctx: CustomRenderContext }) {
  const k = asData(ctx.data).knobs[index];
  const pos = Number(ctx.values[KNOB_IDS[index]] ?? 64);
  return (
    <div
      style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
      className="flex flex-col items-center justify-between select-none"
      aria-hidden
    >
      <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center leading-tight" style={{ fontSize: 11, color: k ? '#e6f2f0' : '#5d6b6a' }}>
        {k ? k.label : 'not set'}
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
// Header: name, template, port status and actions
// ----------------------------------------------------------------------------

export function Header(ctx: CustomRenderContext) {
  const data = asData(ctx.data);
  const snap = useMidiSnapshot();
  const [setup, setSetup] = useState(false);
  const out = data.port
    ? snap.outputs.find(o => o.id === data.port!.id) ?? snap.outputs.find(o => o.name === data.port!.name)
    : undefined;

  let color = '#22c55e';
  let text: string;
  let enable = false;
  if (!snap.support.supported) {
    color = '#8a8a8a';
    text = snap.support.reason === 'ios'
      ? 'No Web MIDI on iPad/iPhone - use Chrome, Edge or Firefox on a computer'
      : snap.support.reason === 'safari' ? 'Safari has no Web MIDI - use Chrome, Edge or Firefox' : 'No Web MIDI in this browser';
  } else if (snap.status !== 'ready') {
    color = '#f97316';
    text = snap.status === 'denied' ? 'MIDI is blocked for this site' : snap.status === 'requesting' ? 'Waiting for permission…' : 'MIDI is off';
    enable = snap.status !== 'requesting';
  } else if (!data.port) {
    color = '#f97316';
    text = 'No output chosen - open Setup';
  } else if (!out || out.state === 'disconnected') {
    color = '#ef4444';
    text = `${data.port.name} is not connected`;
  } else {
    text = `${out.name} · channel ${data.channel + 1}`;
  }

  return (
    <div className="w-full h-full flex items-center gap-3 px-2 rounded" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid #26403d' }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-white truncate" style={{ fontSize: 17 }}>{data.name}</span>
          {data.template && (
            <a
              href={data.template.source}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline"
              style={{ fontSize: 9, color: '#7f9997' }}
              title={`Knobs from the ${data.template.manufacturer} ${data.template.device} template. ${GUIDE_ATTRIBUTION}`}
            >
              template: {data.template.manufacturer} {data.template.device} · midi.guide (CC BY-SA 4.0)
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#c9d6d4' }}>
          <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="truncate">{text}</span>
          <span
            className="inline-block rounded-full ml-1"
            title="MIDI out activity"
            style={{ width: 6, height: 6, background: ctx.engine.out ? ACCENT : '#203230', boxShadow: ctx.engine.out ? `0 0 6px ${ACCENT}` : undefined }}
          />
        </div>
      </div>
      {enable && (
        <PanelButton onClick={() => void midi.request()} accent>Enable MIDI</PanelButton>
      )}
      <PanelButton onClick={() => setSetup(true)} accent={!enable && !data.port}>Setup…</PanelButton>
      <PanelButton onClick={() => ctx.sendEvent('send-all')} title="Send every knob's value to the synth (recall this panel on the hardware)">Send all</PanelButton>
      <PanelButton onClick={() => ctx.sendEvent('panic')} title="All notes off: silence stuck notes">Panic</PanelButton>
      {setup && (
        <SetupDialog
          data={data}
          onClose={() => setSetup(false)}
          onSave={next => { ctx.updateData(() => next); setSetup(false); }}
        />
      )}
    </div>
  );
}

function PanelButton({ children, onClick, title, accent }: { children: React.ReactNode; onClick: () => void; title?: string; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 rounded font-bold whitespace-nowrap"
      style={{
        fontSize: 11,
        padding: '5px 10px',
        color: accent ? '#06201d' : '#e6f2f0',
        background: accent ? ACCENT : '#22302f',
        border: `1px solid ${accent ? ACCENT : '#3c5552'}`,
      }}
    >
      {children}
    </button>
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

  return (
    <div className="w-full h-full flex flex-col gap-1 select-none">
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
                  fontSize: 10,
                  height: 22,
                  color: s.on ? '#e6f2f0' : '#6f8583',
                  background: isSel ? '#0f4f48' : 'rgba(0,0,0,0.45)',
                  border: `1px solid ${isSel ? ACCENT : '#2c403e'}`,
                }}
                title={`Step ${i + 1}: ${midiNoteName(s.note + transpose)} - tap to edit, then play a key`}
                aria-pressed={isSel}
                aria-label={`Edit step ${i + 1}`}
              >
                {midiNoteName(Math.max(0, Math.min(127, s.note + transpose)))}
              </button>
              <button
                onClick={() => update(steps => { steps[i] = { ...steps[i], on: !steps[i].on }; return steps; })}
                className="rounded flex-1 relative"
                style={{
                  minHeight: 34,
                  background: s.on ? (s.vel >= 112 ? '#5eead4' : ACCENT) : '#1b2726',
                  border: `2px solid ${current ? '#ffffff' : i % 4 === 0 ? '#3d5a57' : '#2c403e'}`,
                  boxShadow: current ? '0 0 10px rgba(255,255,255,0.7)' : s.on ? `0 0 8px ${ACCENT}66` : 'inset 0 2px 4px rgba(0,0,0,0.6)',
                }}
                aria-pressed={s.on}
                aria-label={`Step ${i + 1} ${s.on ? 'on' : 'off'}`}
                data-step={i}
              >
                <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 font-bold" style={{ fontSize: 9, color: s.on ? '#06201d' : '#5d6b6a' }}>{i + 1}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 rounded px-1.5" style={{ height: 26, background: 'rgba(0,0,0,0.35)', fontSize: 11, color: '#c9d6d4' }}>
        {selected && sel !== null ? (
          <>
            <span className="font-bold text-white whitespace-nowrap">Step {sel + 1}</span>
            <span className="font-mono whitespace-nowrap" style={{ color: ACCENT }}>{midiNoteName(Math.max(0, Math.min(127, selected.note + transpose)))}</span>
            <MiniButton onClick={() => ctx.setUi({ sel: (sel + STEPS - 1) % STEPS })} label="Previous step">◀</MiniButton>
            <MiniButton onClick={() => ctx.setUi({ sel: (sel + 1) % STEPS })} label="Next step">▶</MiniButton>
            <MiniButton onClick={() => nudge(-1)} label="Semitone down">−1</MiniButton>
            <MiniButton onClick={() => nudge(1)} label="Semitone up">+1</MiniButton>
            <MiniButton onClick={() => nudge(-12)} label="Octave down">−12</MiniButton>
            <MiniButton onClick={() => nudge(12)} label="Octave up">+12</MiniButton>
            <label className="flex items-center gap-1 whitespace-nowrap">
              vel
              <input
                type="range" min={1} max={127} value={selected.vel}
                onChange={e => { const vel = Number(e.target.value); update(steps => { steps[sel] = { ...steps[sel], vel }; return steps; }); }}
                className="w-20" style={{ accentColor: ACCENT }} aria-label="Step velocity"
              />
              <span className="font-mono w-6">{selected.vel}</span>
            </label>
            <span className="truncate" style={{ color: '#7f9997' }}>play a key to set the note</span>
            <MiniButton onClick={() => ctx.setUi({ sel: null })} label="Done editing">Done</MiniButton>
          </>
        ) : (
          <span className="truncate" style={{ color: '#9fb3b1' }}>
            Tap a step to switch it on or off. Tap a note name, then play a key (on screen, computer keys or MIDI) to enter notes.
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
      style={{ fontSize: 10, minWidth: 24, height: 20, padding: '0 5px', color: '#e6f2f0', background: '#22302f', border: '1px solid #3c5552' }}
    >
      {children}
    </button>
  );
}
