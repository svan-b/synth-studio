'use client';

import { useEffect, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { noteBus } from '@/lib/piano/input/bus';
import { listener } from '@/lib/piano/input/listen';
import { midi, type MonitorLine } from '@/lib/piano/input/midi';
import { usePiano } from '@/lib/piano/learn/store';
import { midiLabel } from '@/lib/piano/music/theory';
import { useInputMode, useListenStatus, useMidiStatus } from './hooks';
import { Button, Icon, Pill } from './ui';

/** A small light that blinks when a note arrives from any source. */
export function SignalDot() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = noteBus.subscribe((ev) => {
      if (ev.type !== 'on') return;
      setOn(true);
      if (t) clearTimeout(t);
      t = setTimeout(() => setOn(false), 180);
    });
    return () => {
      unsub();
      if (t) clearTimeout(t);
    };
  }, []);
  return <span className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${on ? 'bg-mc-ok' : 'bg-mc-line'}`} />;
}

/** One line saying how the piano is connected, for headers. */
export function ConnectionChip({ onClick }: { onClick?: () => void }) {
  const mode = useInputMode();
  const m = useMidiStatus();
  const label = mode === 'midi' ? (m.inputs[0]?.name ?? 'Piano') : mode === 'listen' ? 'Listening' : 'Screen keys';
  const icon = mode === 'midi' ? m.transport === 'bluetooth' ? <Icon.Bluetooth size={16} /> : <Icon.Cable size={16} /> : mode === 'listen' ? <Icon.Mic size={16} /> : <Icon.Piano size={16} />;
  return (
    <button onClick={onClick} className="flex h-10 items-center gap-2 rounded-full border border-mc-line bg-mc-surface px-4 text-sm font-semibold text-mc-ink">
      {icon}
      <span className="max-w-[160px] truncate">{label}</span>
      <SignalDot />
    </button>
  );
}

function LastNote() {
  const [text, setText] = useState<string | null>(null);
  useEffect(
    () =>
      noteBus.subscribe((ev) => {
        if (ev.type === 'on') setText(`${midiLabel(ev.midi, false, true)}${ev.source === 'midi' ? `, strength ${Math.round(ev.velocity * 127)}` : ''}`);
      }),
    [],
  );
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-mc-raised px-4 py-3">
      <SignalDot />
      <span className="text-[15px] text-mc-muted">{text ? <>Heard <strong className="text-mc-ink">{text}</strong></> : 'Play any key to check the connection'}</span>
    </div>
  );
}

function Monitor() {
  const [lines, setLines] = useState<MonitorLine[]>([]);
  useEffect(() => midi.monitor.subscribe((l) => setLines((prev) => [l, ...prev].slice(0, 6))), []);
  if (lines.length === 0) return null;
  return (
    <div className="rounded-2xl bg-mc-raised px-4 py-3 font-mono text-xs leading-relaxed text-mc-muted">
      {lines.map((l, i) => (
        <div key={`${l.time}-${i}`} style={{ opacity: 1 - i * 0.14 }}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Everything about getting notes from the piano into the app, used both
 * in first run setup and in settings.
 */
export default function ConnectionPanel({ compact }: { compact?: boolean }) {
  const m = useMidiStatus();
  const l = useListenStatus();
  const mode = useInputMode();
  const settings = usePiano((s) => s.settings);
  const setSettings = usePiano((s) => s.setSettings);
  const [tested, setTested] = useState(false);
  const noMidiAtAll = !m.webMidi && !m.bluetooth;

  const connectMidi = async () => {
    await piano.unlock();
    listener.stop();
    await midi.connect();
  };
  const connectBluetooth = async () => {
    await piano.unlock();
    listener.stop();
    await midi.connectBluetooth();
  };
  const listen = async () => {
    await piano.unlock();
    await listener.start();
  };
  const testOutput = async () => {
    await piano.unlock();
    const now = piano.now();
    [60, 64, 67].forEach((n, i) => midi.playNote(n, 0.5, 0.6, now + 0.1 + i * 0.3));
    setTested(true);
  };

  return (
    <div className="space-y-4">
      {mode === 'midi' && (
        <div className="rounded-2xl border border-mc-ok/40 bg-mc-ok/10 px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-mc-ok">
            <Icon.Check size={20} />
            Connected to {m.inputs.map((p) => p.name).join(', ')}
          </div>
          <p className="mt-1 text-[15px] text-mc-muted">
            The app sees every key you press, how firmly, and the pedals. The keyboard on screen mirrors your playing.
          </p>
        </div>
      )}
      {m.state === 'connected' && m.inputs.length === 0 && (
        <div className="rounded-2xl border border-mc-hint/40 bg-mc-hint/10 px-5 py-4 text-[15px] text-mc-muted">
          <strong className="text-mc-ink">MIDI is on, but no piano was found.</strong> Check that the piano is switched on and the cable is in the
          socket marked USB TO HOST. For Bluetooth, pair the piano with the iPad first. It will appear here as soon as it is seen.
        </div>
      )}
      {mode === 'listen' && (
        <div className="rounded-2xl border border-mc-accent/30 bg-mc-accent/10 px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-mc-accent">
            <Icon.Mic size={20} />
            Listening through the microphone
          </div>
          <p className="mt-1 text-[15px] text-mc-muted">
            Works well for single notes and simple chords at a steady pace. It cannot hear how long you hold a key or how hard you strike it, and fast
            or thick passages can be misheard. A cable or Bluetooth connection is exact.
          </p>
          {l.source && (
            <p className="mt-2 text-[15px] text-mc-muted">
              Sound is coming in through <span className="font-semibold text-mc-ink">{l.source}</span>.
            </p>
          )}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mc-line">
            <div className="h-full rounded-full bg-mc-accent transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(100, (l.level + 60) * 1.8))}%` }} />
          </div>
        </div>
      )}

      {(mode === 'midi' || mode === 'listen') && <LastNote />}
      {mode === 'midi' && !compact && <Monitor />}

      {mode === 'midi' && midi.hasOutput && (
        <div className="rounded-2xl border border-mc-line bg-mc-surface px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Play demonstrations on the piano</div>
              <div className="text-[15px] text-mc-muted">When the app shows you how something goes, your piano plays it with its own sound.</div>
            </div>
            <Button variant="soft" size="sm" onClick={() => void testOutput()}>
              Test
            </Button>
          </div>
          {tested && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[15px] text-mc-muted">Did the piano play three notes?</span>
              <Button size="sm" variant={settings.demoOnPiano ? 'primary' : 'soft'} onClick={() => setSettings({ demoOnPiano: true })}>
                Yes, use the piano
              </Button>
              <Button size="sm" variant={!settings.demoOnPiano ? 'primary' : 'soft'} onClick={() => setSettings({ demoOnPiano: false })}>
                No, use the iPad
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {m.webMidi && (
          <button onClick={() => void connectMidi()} className="rounded-2xl border border-mc-line bg-mc-surface p-5 text-left active:bg-mc-raised">
            <div className="flex items-center gap-2 font-semibold">
              <Icon.Cable size={20} />
              Connect by cable or Bluetooth
              {mode === 'midi' && m.transport === 'webmidi' && <Pill tone="ok">On</Pill>}
            </div>
            <p className="mt-1 text-[15px] text-mc-muted">MIDI from your piano. Exact, and the best way to use this app.</p>
          </button>
        )}
        {m.bluetooth && (
          <button onClick={() => void connectBluetooth()} className="rounded-2xl border border-mc-line bg-mc-surface p-5 text-left active:bg-mc-raised">
            <div className="flex items-center gap-2 font-semibold">
              <Icon.Bluetooth size={20} />
              Pair over Bluetooth
              {mode === 'midi' && m.transport === 'bluetooth' && <Pill tone="ok">On</Pill>}
            </div>
            <p className="mt-1 text-[15px] text-mc-muted">A direct Bluetooth MIDI link to a piano that has it built in.</p>
          </button>
        )}
        <button onClick={() => void (l.state === 'listening' ? listener.stop() : listen())} className="rounded-2xl border border-mc-line bg-mc-surface p-5 text-left active:bg-mc-raised">
          <div className="flex items-center gap-2 font-semibold">
            <Icon.Mic size={20} />
            {l.state === 'listening' ? 'Stop listening' : 'Listen through the microphone'}
            {l.state === 'listening' && <Pill tone="accent">On</Pill>}
          </div>
          <p className="mt-1 text-[15px] text-mc-muted">No cable needed. Stand the iPad on the piano and it hears what you play.</p>
        </button>
        {mode !== 'touch' && (
          <button
            onClick={() => {
              midi.disconnect();
              listener.stop();
              // A deliberate choice, so the piano is not reconnected behind the learner's back.
              setSettings({ autoMidi: false });
            }}
            className="rounded-2xl border border-mc-line bg-mc-surface p-5 text-left active:bg-mc-raised"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Icon.Piano size={20} />
              Use the keys on screen
            </div>
            <p className="mt-1 text-[15px] text-mc-muted">Disconnect and tap the keyboard on the iPad instead.</p>
          </button>
        )}
      </div>

      {(m.state === 'denied' || m.state === 'error') && m.error && (
        <p className="rounded-2xl bg-mc-bad/10 px-4 py-3 text-[15px] text-mc-bad">
          {m.state === 'denied' ? 'The browser refused access to MIDI. Allow it in the browser settings for this page, then try again.' : m.error}
        </p>
      )}
      {(l.state === 'denied' || l.state === 'error') && (
        <p className="rounded-2xl bg-mc-bad/10 px-4 py-3 text-[15px] text-mc-bad">
          {l.state === 'denied' ? 'The microphone is blocked for this page. Allow it in the browser settings, then try again.' : (l.error ?? 'The microphone could not be started.')}
        </p>
      )}

      {noMidiAtAll && (
        <div className="rounded-2xl border border-mc-line bg-mc-surface px-5 py-4 text-[15px] leading-relaxed text-mc-muted">
          <strong className="text-mc-ink">This browser cannot receive MIDI.</strong> Safari on iPad has no MIDI support, and neither do other browsers
          built on it. To plug your piano in on an iPad, open this same page in a browser app that adds MIDI, such as MIDIWeb Browser from the App
          Store. On a computer, Chrome and Edge work directly. Until then, listening through the microphone works here.
        </div>
      )}
    </div>
  );
}
