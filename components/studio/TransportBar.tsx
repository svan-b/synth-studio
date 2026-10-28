'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { useAudioStatus } from '@/lib/studio/useHub';
import { transport, PPQN } from '@/lib/audio/transport';
import { getAudioContext, getMasterBus, getOutputLevel } from '@/lib/audio/context';
import { masterRecorder } from '@/lib/audio/recorder';

/** Studio transport: one Play for everything that follows the studio clock */
export default function TransportBar() {
  const bpm = useStudioStore(s => s.studio.bpm);
  const swing = useStudioStore(s => s.studio.swing);
  const setBpm = useStudioStore(s => s.setBpm);
  const setSwing = useStudioStore(s => s.setSwing);
  const { status, error } = useAudioStatus();
  const [playing, setPlaying] = useState(transport.playing);
  const [position, setPosition] = useState('1.1.1');
  const [metronome, setMetronome] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const taps = useRef<number[]>([]);

  useEffect(() => transport.onEvent(e => {
    if (e.type === 'start') setPlaying(true);
    if (e.type === 'stop') setPlaying(false);
  }), []);

  // Bar.beat.16th readout + metronome clicks
  useEffect(() => transport.onTick(t => {
    if (t.tick % (PPQN / 4) === 0) {
      const delay = Math.max(0, (t.time - getAudioContext().currentTime) * 1000);
      const label = `${t.bar + 1}.${Math.floor(t.beat % 4) + 1}.${(t.sixteenth % 4) + 1}`;
      setTimeout(() => setPosition(label), delay);
    }
    if (metronome && t.tick % PPQN === 0) click(t.time, t.tick % (PPQN * 4) === 0);
  }), [metronome]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecTime(masterRecorder.elapsed()), 250);
    return () => clearInterval(id);
  }, [recording]);

  const togglePlay = () => {
    if (transport.playing) hub.stopAll();
    else hub.startAll();
  };

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter(t => now - t < 2500), now];
    if (taps.current.length >= 3) {
      const iv = (taps.current[taps.current.length - 1] - taps.current[0]) / (taps.current.length - 1);
      setBpm(60000 / iv);
    }
  };

  const toggleRecord = async () => {
    hub.ensureAudio();
    if (!recording) {
      await masterRecorder.start();
      setRecording(true);
      setRecTime(0);
    } else {
      const blob = await masterRecorder.stop();
      setRecording(false);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `synth-studio-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }
  };

  const on = status === 'on';
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#161616] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5">
      <button
        onClick={() => hub.ensureAudio()}
        title={error ?? (on ? 'Audio engine running' : 'Browsers only allow sound after you touch the page')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border ${on ? 'border-green-900 text-green-400' : status === 'error' ? 'border-red-900 text-red-400' : 'border-orange-700 text-orange-300 animate-pulse motion-reduce:animate-none'}`}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: on ? '#22c55e' : status === 'error' ? '#ef4444' : '#f97316' }} />
        {on ? 'Audio' : status === 'starting' ? 'Starting…' : status === 'error' ? 'Audio error' : 'Tap for sound'}
        {on && <LevelMeter />}
      </button>

      <button
        onClick={togglePlay}
        className={`w-11 h-9 rounded-lg font-bold text-lg flex items-center justify-center ${playing ? 'bg-green-500 text-black' : 'bg-[#2a2a2a] text-white hover:bg-[#333]'}`}
        aria-label={playing ? 'Stop studio' : 'Play studio'}
        title="Play / stop everything in the studio"
      >
        {playing ? '■' : '▶'}
      </button>
      <span className="font-mono text-xs text-green-400 bg-black/60 rounded px-2 py-1.5 w-[64px] text-center tabular-nums" aria-label="Song position">{position}</span>

      <div className="flex items-center gap-1">
        <button className="w-7 h-8 rounded bg-[#242424] text-gray-300" onClick={() => setBpm(bpm - 1)} aria-label="Slower">−</button>
        <label className="flex items-center gap-1 bg-black/60 rounded px-1.5 py-1">
          <input
            type="number"
            min={20}
            max={300}
            value={bpm}
            onChange={e => setBpm(Number(e.target.value) || 120)}
            className="w-12 bg-transparent text-white text-sm font-mono text-right outline-none"
            aria-label="Tempo in BPM"
          />
          <span className="text-[10px] text-gray-500">BPM</span>
        </label>
        <button className="w-7 h-8 rounded bg-[#242424] text-gray-300" onClick={() => setBpm(bpm + 1)} aria-label="Faster">+</button>
        <button className="px-2 h-8 rounded bg-[#242424] text-gray-300 text-[11px]" onClick={tap} title="Tap at least three times">TAP</button>
      </div>

      <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Swing delays every second 16th note - the shuffle in house and hip-hop">
        Swing
        <select
          value={String(Math.round(50 + swing * 50))}
          onChange={e => setSwing((Number(e.target.value) - 50) / 50)}
          className="bg-black/60 text-white rounded px-1 py-1 text-[11px]"
          aria-label="Swing"
        >
          {[50, 54, 58, 62, 66, 70, 75].map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </label>

      <button
        onClick={() => setMetronome(m => !m)}
        className={`px-2 h-8 rounded text-[11px] ${metronome ? 'bg-sky-600 text-white' : 'bg-[#242424] text-gray-300'}`}
        aria-pressed={metronome}
        title="Click on every beat"
      >
        Click
      </button>

      <button
        onClick={toggleRecord}
        className={`flex items-center gap-1.5 px-2.5 h-8 rounded text-[11px] font-bold ${recording ? 'bg-red-600 text-white' : 'bg-[#242424] text-gray-300'}`}
        aria-pressed={recording}
        title="Record what you hear to a WAV file"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${recording ? 'bg-white animate-pulse motion-reduce:animate-none' : 'bg-red-500'}`} />
        {recording ? `${Math.floor(recTime / 60)}:${String(Math.floor(recTime % 60)).padStart(2, '0')}` : 'REC'}
      </button>
    </div>
  );
}

/** Short metronome blip scheduled on the audio clock */
function click(time: number, accent: boolean) {
  const ctx = getAudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  o.connect(g).connect(getMasterBus());
  o.start(time);
  o.stop(time + 0.06);
}

function LevelMeter() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let held = 0;
    const tick = () => {
      held = Math.max(getOutputLevel(), held * 0.9);
      if (ref.current) {
        ref.current.style.width = `${Math.min(100, held * 100)}%`;
        ref.current.style.background = held > 0.95 ? '#ef4444' : held > 0.7 ? '#eab308' : '#22c55e';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="relative w-10 h-1.5 rounded-full bg-black/60 overflow-hidden" aria-hidden>
      <span ref={ref} className="absolute inset-y-0 left-0 rounded-full" style={{ width: 0 }} />
    </span>
  );
}
