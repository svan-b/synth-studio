'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { instrument } from '@/lib/guitar/audio/instrument';
import { guitar } from '@/lib/guitar/audio/engine';
import { Smoother } from '@/lib/guitar/dsp/pitch';
import { listener, type PitchEvent } from '@/lib/guitar/input/listen';
import { useGuitar } from '@/lib/guitar/learn/store';
import { OPEN_MIDI, STRINGS, STRING_LETTER, STRING_NAME, cents, midiToFreq, nearestString, type StringNo } from '@/lib/guitar/music/theory';
import { useListening } from './hooks';
import { Button, Icon } from './ui';

/** Cents either side of the note that count as in tune. */
const IN_TUNE = 5;
/** How long a string must hold in tune before it counts, in milliseconds. */
const HOLD_MS = 700;
const ORDER: StringNo[] = [6, 5, 4, 3, 2, 1];

function Gauge({ off, active }: { off: number | null; active: boolean }) {
  const clamped = off === null ? 0 : Math.max(-50, Math.min(50, off));
  const angle = (clamped / 50) * 60;
  const inTune = off !== null && Math.abs(off) <= IN_TUNE;
  const W = 360;
  const cx = W / 2;
  const cy = 190;
  const r = 150;
  const tick = (a: number, len: number, w: number, key: string) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return (
      <line
        key={key}
        x1={cx + Math.cos(rad) * (r - len)}
        y1={cy + Math.sin(rad) * (r - len)}
        x2={cx + Math.cos(rad) * r}
        y2={cy + Math.sin(rad) * r}
        stroke="rgb(var(--os-ink))"
        strokeOpacity={a === 0 ? 0.9 : 0.35}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  };
  const rad = ((angle - 90) * Math.PI) / 180;
  return (
    <svg width="100%" viewBox={`0 0 ${W} 210`} style={{ maxWidth: 460 }} role="img" aria-label={off === null ? 'Waiting for a note' : `${Math.round(off)} cents`}>
      <path d={`M ${cx - r * Math.sin(Math.PI / 3)} ${cy - r * Math.cos(Math.PI / 3)} A ${r} ${r} 0 0 1 ${cx + r * Math.sin(Math.PI / 3)} ${cy - r * Math.cos(Math.PI / 3)}`} fill="none" stroke="rgb(var(--os-line))" strokeWidth={14} strokeLinecap="round" />
      <path
        d={`M ${cx - r * Math.sin((6 * Math.PI) / 180)} ${cy - r * Math.cos((6 * Math.PI) / 180)} A ${r} ${r} 0 0 1 ${cx + r * Math.sin((6 * Math.PI) / 180)} ${cy - r * Math.cos((6 * Math.PI) / 180)}`}
        fill="none"
        stroke="rgb(var(--os-ok))"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {[-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60].map((a) => tick(a, a === 0 ? 30 : 16, a === 0 ? 3 : 2, `t${a}`))}
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.cos(rad) * (r - 8)}
        y2={cy + Math.sin(rad) * (r - 8)}
        stroke={!active || off === null ? 'rgb(var(--os-faint))' : inTune ? 'rgb(var(--os-ok))' : 'rgb(var(--os-hint))'}
        strokeWidth={5}
        strokeLinecap="round"
        style={{ transition: 'all 120ms ease-out' }}
      />
      <circle cx={cx} cy={cy} r={10} fill="rgb(var(--os-ink))" />
      <text x={cx - r + 6} y={cy + 6} fontSize={15} fill="rgb(var(--os-muted))" fontWeight={600}>
        low
      </text>
      <text x={cx + r - 6} y={cy + 6} fontSize={15} fill="rgb(var(--os-muted))" fontWeight={600} textAnchor="end">
        high
      </text>
    </svg>
  );
}

/**
 * The tuner. It goes string by string from the thickest, or follows whichever
 * string is played when set to listen for any. A string that holds in tune
 * for a moment is ticked, and the next one comes up.
 */
export default function Tuner({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const markTuned = useGuitar((s) => s.markTuned);
  const { status, start } = useListening(true);
  const listening = status.state === 'listening';
  const [target, setTarget] = useState<StringNo | 'any'>(6);
  const [done, setDone] = useState<Set<StringNo>>(new Set());
  const [reading, setReading] = useState<{ string: StringNo; off: number; freq: number } | null>(null);
  const smoother = useRef(new Smoother(5));
  const holdSince = useRef<number | null>(null);
  const lastSeen = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const doneRef = useRef(done);
  doneRef.current = done;
  const finished = useRef(false);

  const advance = useCallback(
    (s: StringNo) => {
      setDone((prev) => {
        const next = new Set(prev).add(s);
        if (targetRef.current !== 'any') {
          const nextString = ORDER.find((x) => !next.has(x));
          if (nextString) {
            setTarget(nextString);
            smoother.current.reset();
          }
        }
        if (next.size === 6 && !finished.current) {
          finished.current = true;
          markTuned();
          instrument.chime();
          setTimeout(() => onDone?.(), 900);
        }
        return next;
      });
    },
    [markTuned, onDone],
  );

  useEffect(() => {
    if (!listening) return;
    const stop = listener.wantPitch();
    const off = listener.pitch.subscribe((p: PitchEvent | null) => {
      const now = performance.now();
      if (!p || p.clarity < 0.86 || p.levelDb < -58) {
        if (now - lastSeen.current > 600) {
          setReading(null);
          holdSince.current = null;
          smoother.current.reset();
        }
        return;
      }
      lastSeen.current = now;
      const want = targetRef.current;
      let freq = p.freq;
      let s: StringNo = want === 'any' ? nearestString(freq) : want;
      const open = midiToFreq(OPEN_MIDI[s]);
      // An octave out is the string's own harmonic: fold it back.
      let c = cents(freq, open);
      if (want !== 'any' && Math.abs(c) > 900 && Math.abs(Math.abs(c) - 1200) < 150) {
        freq = c > 0 ? freq / 2 : freq * 2;
        c = cents(freq, open);
      }
      if (want === 'any') s = nearestString(freq);
      const smooth = smoother.current.push(c);
      setReading({ string: s, off: smooth, freq });
      if (Math.abs(smooth) <= IN_TUNE && smoother.current.count >= 3) {
        if (holdSince.current === null) holdSince.current = now;
        else if (now - holdSince.current >= HOLD_MS) {
          holdSince.current = null;
          if (!doneRef.current.has(s)) advance(s);
        }
      } else {
        holdSince.current = null;
      }
    });
    return () => {
      off();
      stop();
    };
  }, [advance, listening]);

  const shown: StringNo = target === 'any' ? (reading?.string ?? 6) : target;
  const off = reading && reading.string === shown ? reading.off : null;
  const far = off !== null && Math.abs(off) > 300;
  const words =
    off === null
      ? target === 'any'
        ? 'Pick any string and let it ring.'
        : `Pick the ${STRING_NAME[shown]} string, string ${shown}, and let it ring.`
      : Math.abs(off) <= IN_TUNE
        ? 'In tune. Hold it there.'
        : far
          ? off < 0
            ? `That is much lower than ${STRING_LETTER[shown].toUpperCase()}. Is it the right string? If so, tighten it slowly.`
            : `That is much higher than ${STRING_LETTER[shown].toUpperCase()}. Is it the right string? If so, loosen it slowly.`
          : off < 0
            ? Math.abs(off) > 25
              ? 'Too low. Tighten the string, turning the peg slowly.'
              : 'A little low. Tighten it, just a touch.'
            : Math.abs(off) > 25
              ? 'Too high. Loosen the string a little.'
              : 'A little high. Loosen it, just a touch.';

  const hear = () => {
    void guitar.unlock();
    instrument.reference(OPEN_MIDI[shown], shown);
  };

  if (!listening) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-os-surface p-8 text-center">
        <Icon.Tuner size={40} />
        <p className="max-w-md text-[1.15rem] text-os-muted">
          {status.state === 'denied'
            ? "The microphone is switched off for this app. Turn it on in the iPad's Settings, under Privacy and Security, Microphone."
            : 'The tuner listens to each string through the microphone.'}
        </p>
        {status.state !== 'denied' && (
          <Button size="lg" onClick={start} icon={<Icon.Mic size={20} />}>
            Start listening
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-3' : 'gap-5'}`}>
      <div className="flex items-baseline gap-4">
        <span className="font-os-serif text-[5.5rem] font-semibold leading-none">{STRING_LETTER[shown].toUpperCase()}</span>
        <span className="text-[1.15rem] text-os-muted">
          string {shown}
          {off !== null && <span className="ml-3 tabular-nums">{off > 0 ? '+' : ''}{Math.round(off)} cents</span>}
        </span>
      </div>
      <Gauge off={off} active={listening} />
      <p className={`min-h-[3.5rem] max-w-lg text-center text-[1.3rem] font-medium leading-snug ${off !== null && Math.abs(off) <= IN_TUNE ? 'text-os-ok' : 'text-os-ink'}`}>{words}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {STRINGS.map((s) => {
          const ok = done.has(s);
          const isNow = target !== 'any' && s === target;
          return (
            <button
              key={s}
              onClick={() => {
                setTarget(s);
                smoother.current.reset();
              }}
              className={`flex h-16 w-14 flex-col items-center justify-center rounded-2xl border-2 text-lg font-bold transition-colors ${
                ok ? 'border-os-ok bg-os-ok/15 text-os-ok' : isNow ? 'border-os-ink bg-os-surface' : 'border-os-line bg-os-surface text-os-muted'
              }`}
              aria-label={`${STRING_NAME[s]} string${ok ? ', in tune' : ''}`}
            >
              {ok ? <Icon.Check size={22} /> : STRING_LETTER[s].toUpperCase()}
              <span className="text-[11px] font-semibold opacity-70">{s}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="soft" onClick={hear} icon={<Icon.Ear size={18} />}>
          Hear {STRING_LETTER[shown].toUpperCase()}
        </Button>
        <Button variant={target === 'any' ? 'primary' : 'soft'} onClick={() => setTarget(target === 'any' ? (ORDER.find((x) => !done.has(x)) ?? 6) : 'any')}>
          {target === 'any' ? 'Go string by string' : 'Any string'}
        </Button>
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            {done.size === 6 ? 'Continue' : 'It is in tune already'}
          </Button>
        )}
      </div>
    </div>
  );
}
