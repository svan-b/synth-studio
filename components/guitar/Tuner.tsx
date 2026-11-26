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
      <path
        d={`M ${cx - r * Math.sin(Math.PI / 3)} ${cy - r * Math.cos(Math.PI / 3)} A ${r} ${r} 0 0 1 ${cx + r * Math.sin(Math.PI / 3)} ${cy - r * Math.cos(Math.PI / 3)}`}
        fill="none"
        stroke="rgb(var(--os-line))"
        strokeWidth={14}
        strokeLinecap="round"
      />
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
export default function Tuner({ onDone, compact = false, bar = false }: { onDone?: () => void; compact?: boolean; /** The screen has a bar of its own to move on with. */ bar?: boolean }) {
  const markTuned = useGuitar((s) => s.markTuned);
  const { status, start, ask } = useListening(true);
  const listening = status.state === 'listening';
  const [target, setTarget] = useState<StringNo | 'any'>(6);
  const [done, setDone] = useState<Set<StringNo>>(new Set());
  const [reading, setReading] = useState<{
    string: StringNo;
    off: number;
    freq: number;
  } | null>(null);
  const smoother = useRef(new Smoother(5));
  const holdSince = useRef<number | null>(null);
  const lastSeen = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const doneRef = useRef(done);
  doneRef.current = done;
  const finished = useRef(false);
  const other = useRef<{ s: StringNo; n: number }>({ s: 6, n: 0 });
  // The tuner hands on once, whether by itself after the last string or by a tap, never twice.
  const handedOn = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handOn = useCallback(() => {
    if (handedOn.current) return;
    handedOn.current = true;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    onDoneRef.current?.();
  }, []);
  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    },
    [],
  );

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
          autoTimer.current = setTimeout(handOn, 900);
        }
        return next;
      });
    },
    [handOn, markTuned],
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
      let want = targetRef.current;
      // Whichever string is plucked is the one tuned, as the best tuners do it. A string heard
      // close to its own pitch, and far from the one asked for, is taken a few readings in a row to be meant.
      if (want !== 'any') {
        const heard = nearestString(p.freq);
        const near = Math.abs(cents(p.freq, midiToFreq(OPEN_MIDI[heard])));
        const fromWanted = Math.abs(cents(p.freq, midiToFreq(OPEN_MIDI[want])));
        const octave = Math.abs(fromWanted - 1200) < 150;
        if (heard !== want && near < 120 && fromWanted > 250 && !octave) {
          other.current = other.current.s === heard ? { s: heard, n: other.current.n + 1 } : { s: heard, n: 1 };
          if (other.current.n >= 4) {
            other.current = { s: heard, n: 0 };
            want = heard;
            targetRef.current = heard;
            setTarget(heard);
            smoother.current.reset();
            holdSince.current = null;
          } else {
            return;
          }
        } else {
          other.current = { s: want, n: 0 };
        }
      }
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
        : `Pick the ${STRING_NAME[shown]} string, string ${shown}, and let it ring. Or pick any other, and the tuner follows.`
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

  if (ask) {
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

  // Side by side where the screen is wide, so the needle and the strings are all in view at once.
  return (
    <div className={`grid items-center justify-items-center gap-x-10 ${compact ? 'gap-y-3' : 'gap-y-4'} landscape:grid-cols-2`}>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-baseline gap-4">
          <span className="font-os-serif text-[6rem] font-semibold leading-none">{STRING_LETTER[shown].toUpperCase()}</span>
          <span className="text-[1.4rem] text-os-muted">
            string {shown}
            {off !== null && (
              <span className="ml-3 tabular-nums">
                {off > 0 ? '+' : ''}
                {Math.round(off)} cents
              </span>
            )}
          </span>
        </div>
        <div className="w-[24rem] max-w-full">
          <Gauge off={off} active={listening} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex min-h-[6.5rem] flex-col items-center text-center">
          {off !== null && (
            <div className={`flex items-center gap-3 font-os-serif text-[2.8rem] font-semibold leading-none ${Math.abs(off) <= IN_TUNE ? 'text-os-ok-ink' : 'text-os-ink'}`}>
              {Math.abs(off) <= IN_TUNE ? (
                'In tune'
              ) : off < 0 ? (
                <>
                  Tighten
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 20V5M5 12l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Loosen
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 4v15M5 12l7 7 7-7" />
                  </svg>
                </>
              )}
            </div>
          )}
          <p className={`mt-2 max-w-xl text-[1.4rem] font-medium leading-snug ${off !== null && Math.abs(off) <= IN_TUNE ? 'text-os-ok-ink' : off === null ? 'text-os-ink' : 'text-os-muted'}`}>{words}</p>
        </div>
        <div className="flex items-center justify-center gap-2">
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
                className={`flex h-20 w-16 flex-col items-center justify-center rounded-2xl border-[3px] text-[1.6rem] font-bold leading-tight transition-colors ${
                  ok ? 'border-os-ok bg-os-ok/15 text-os-ok-ink' : isNow ? 'border-os-ink bg-os-surface' : 'border-os-line bg-os-surface text-os-muted'
                }`}
                aria-label={`${STRING_NAME[s]} string${ok ? ', in tune' : ''}`}
              >
                {ok ? <Icon.Check size={28} /> : STRING_LETTER[s].toUpperCase()}
                <span className="text-[15px] font-semibold opacity-70">{s}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="soft" size="lg" onClick={hear} icon={<Icon.Ear size={20} />} className="px-6">
            Hear {STRING_LETTER[shown].toUpperCase()}
          </Button>
          {onDone && !bar && (
            <Button variant="ghost" size="lg" onClick={handOn} className="border border-os-line px-6 text-os-ink">
              {done.size === 6 ? 'Continue' : 'It is in tune already'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
