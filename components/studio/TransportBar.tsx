'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '@/store/studio';
import { hub } from '@/lib/studio/hub';
import { useAudioStatus } from '@/lib/studio/useHub';
import { transport, PPQN } from '@/lib/audio/transport';
import { getAudioContext, getLatencyInfo } from '@/lib/audio/context';
import { arranger } from '@/lib/studio/arranger';
import { isRecording, recordingElapsed, startRecording, stopRecording } from '@/lib/studio/bounce';
import { MasterMeterCompact } from './MasterMeter';
import { useTransportPlaying } from './hooks';
import BounceDialog from './BounceDialog';
import AudioSettings from './AudioSettings';

/** Studio transport: one Play for everything that follows the studio clock */
export default function TransportBar() {
  const bpm = useStudioStore(s => s.studio.bpm);
  const swing = useStudioStore(s => s.studio.swing);
  const metro = useStudioStore(s => s.studio.metronome);
  const loop = useStudioStore(s => s.studio.arrangement.loop);
  const songOn = useStudioStore(s => s.studio.arrangement.enabled && s.studio.arrangement.sections.length > 0);
  const setBpm = useStudioStore(s => s.setBpm);
  const setSwing = useStudioStore(s => s.setSwing);
  const setMetronome = useStudioStore(s => s.setMetronome);
  const setArrangement = useStudioStore(s => s.setArrangement);
  const { status, error } = useAudioStatus();
  const playing = useTransportPlaying();
  const [recording, setRecording] = useState(isRecording());
  const [recTime, setRecTime] = useState(0);
  const [stems, setStems] = useState(false);
  const [bounceOpen, setBounceOpen] = useState(false);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecTime(recordingElapsed()), 250);
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
      setRecording(true);
      setRecTime(0);
      try { await startRecording({ stems }); } catch (e) { console.error(e); setRecording(false); }
    } else {
      setRecording(false);
      await stopRecording();
    }
  };

  const on = status === 'on';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-[#161616] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5">
      <button
        onClick={() => hub.ensureAudio()}
        title={error ?? (on ? 'Audio engine running · master meter: level, short-term loudness and the limiter light' : 'Browsers only allow sound after you touch the page')}
        className={`flex items-center gap-1.5 px-2.5 h-9 text-xs rounded-full border ${on ? 'border-green-900 text-green-400' : status === 'error' ? 'border-red-900 text-red-400' : 'border-orange-700 text-orange-300 animate-pulse motion-reduce:animate-none'}`}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: on ? '#22c55e' : status === 'error' ? '#ef4444' : '#f97316' }} />
        {on ? 'Audio' : status === 'starting' ? 'Starting…' : status === 'error' ? 'Audio error' : 'Tap for sound'}
        {on && <MasterMeterCompact />}
      </button>

      <button
        onClick={togglePlay}
        className={`w-12 h-9 rounded-lg font-bold text-lg flex items-center justify-center ${playing ? 'bg-green-500 text-black' : 'bg-[#2a2a2a] text-white hover:bg-[#333]'}`}
        aria-label={playing ? 'Stop studio' : 'Play studio'}
        title={playing ? 'Stop everything' : `Play everything in the studio${metro?.countIn ? ' (after a 1-bar count-in)' : ''}`}
      >
        {playing ? '■' : '▶'}
      </button>
      <Position songOn={songOn} />

      <div className="flex items-center gap-1">
        <button className="w-8 h-9 rounded bg-[#242424] text-gray-300" onClick={() => setBpm(bpm - 1)} aria-label="Slower">−</button>
        <label className="flex items-center gap-1 bg-black/60 rounded px-1.5 h-9">
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
        <button className="w-8 h-9 rounded bg-[#242424] text-gray-300" onClick={() => setBpm(bpm + 1)} aria-label="Faster">+</button>
        <button className="px-2 h-9 rounded bg-[#242424] text-gray-300 text-[11px]" onClick={tap} title="Tap at least three times">TAP</button>
      </div>

      <label className="flex items-center gap-1 text-[11px] text-gray-400" title="Swing delays every second 16th note - the shuffle in house and hip-hop">
        Swing
        <select
          value={String(Math.round(50 + swing * 50))}
          onChange={e => setSwing((Number(e.target.value) - 50) / 50)}
          className="bg-black/60 text-white rounded px-1 h-9 text-[11px]"
          aria-label="Swing"
        >
          {[50, 54, 58, 62, 66, 70, 75].map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </label>

      <div className="flex items-center rounded-lg overflow-hidden border border-[#2e2e2e]">
        <Toggle on={!!metro?.click} onClick={() => setMetronome({ click: !metro?.click })} title="Click on every beat (never recorded)">Click</Toggle>
        <Toggle on={!!metro?.countIn} onClick={() => setMetronome({ countIn: !metro?.countIn })} title="Play one bar of clicks before everything starts, so you can come in on the downbeat">Count-in</Toggle>
        <Toggle
          on={loop}
          onClick={() => setArrangement(a => ({ ...a, loop: !a.loop }))}
          title={songOn ? 'Loop the song: start again at bar 1 after the last section' : 'Loop the song (when song mode is on in the arranger): off = stop at the end'}
        >
          Loop
        </Toggle>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleRecord}
          className={`flex items-center gap-1.5 px-2.5 h-9 rounded text-[11px] font-bold ${recording ? 'bg-red-600 text-white' : 'bg-[#242424] text-gray-300'}`}
          aria-pressed={recording}
          title={recording ? 'Stop and download' : `Record what you hear to a WAV file${stems ? ', plus every channel as a stem (.zip)' : ''}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${recording ? 'bg-white animate-pulse motion-reduce:animate-none' : 'bg-red-500'}`} />
          {recording ? `${Math.floor(recTime / 60)}:${String(Math.floor(recTime % 60)).padStart(2, '0')}` : 'REC'}
        </button>
        <Toggle
          on={stems}
          onClick={() => setStems(s => !s)}
          title="Also record every channel strip and the returns as separate, sample-aligned WAV stems (one .zip)"
          disabled={recording}
          solo
        >
          Stems
        </Toggle>
        <button
          onClick={() => { hub.ensureAudio(); setBounceOpen(true); }}
          className="px-2.5 h-9 rounded bg-[#242424] text-gray-200 text-[11px] font-bold hover:bg-[#2e2e2e]"
          title="Bounce the song from bar 1 to the end (with tails) to WAV, optionally with stems and loudness normalising"
        >
          Bounce…
        </button>
      </div>
      <AudioSettings />
      <BounceDialog open={bounceOpen} onOpenChange={setBounceOpen} />
    </div>
  );
}

function Toggle({ on, onClick, title, children, disabled, solo }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean; solo?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      className={`px-2 h-9 text-[11px] disabled:opacity-40 ${solo ? 'rounded' : ''} ${on ? 'bg-sky-600 text-white' : 'bg-[#242424] text-gray-300 hover:bg-[#2c2c2c]'}`}
    >
      {children}
    </button>
  );
}

/** Bar.beat.16th of what you hear (output latency included), count-in, song section */
function Position({ songOn }: { songOn: boolean }) {
  const [label, setLabel] = useState('1.1.1');
  const [sub, setSub] = useState('');
  const [counting, setCounting] = useState(false);
  useEffect(() => {
    let raf = 0;
    let last = '';
    let lastSub = '';
    let lastCount = false;
    const loop = () => {
      const ctx = getAudioContext();
      const lat = getLatencyInfo();
      const now = ctx.currentTime - (lat ? lat.base + lat.output : 0);
      let l = last, s = lastSub, c = false;
      if (transport.playing && now < transport.startedAt) {
        // counting in: beats left before the downbeat
        const beat = 60 / transport.bpm;
        const left = Math.ceil((transport.startedAt - now) / beat);
        l = `−${Math.max(1, left)}`;
        s = 'count-in';
        c = true;
      } else if (transport.playing) {
        const t = transport.tickAt(now);
        if (t !== null) {
          const bar = Math.floor(t / (PPQN * 4));
          const beat = Math.floor((t % (PPQN * 4)) / PPQN);
          const six = Math.floor((t % PPQN) / (PPQN / 4));
          l = `${bar + 1}.${beat + 1}.${six + 1}`;
          const sec = songOn ? arranger.locate(bar) : null;
          s = sec ? `${sec.name} ${sec.bar}/${sec.bars}` : '';
        }
      } else if (last.startsWith('−')) {
        l = '1.1.1'; s = '';
      }
      if (l !== last) { last = l; setLabel(l); }
      if (s !== lastSub) { lastSub = s; setSub(s); }
      if (c !== lastCount) { lastCount = c; setCounting(c); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [songOn]);
  return (
    <div className="flex flex-col items-center justify-center bg-black/60 rounded px-2 h-9 min-w-[84px]" title="Position: bar . beat . sixteenth (what you hear now)">
      <span className={`font-mono text-[15px] leading-none tabular-nums ${counting ? 'text-amber-300' : 'text-green-400'}`} aria-label="Song position">{label}</span>
      <span className="text-[9px] leading-none mt-0.5 text-gray-400 truncate max-w-[96px]">{sub || (songOn ? 'song' : 'bar.beat.16th')}</span>
    </div>
  );
}
