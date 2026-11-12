'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { parseScore } from '@/lib/piano/music/score';
import { Keyboard } from './Keyboard';
import ScoreView, { type ScoreViewHandle } from './ScoreView';

const SAMPLES: Record<string, Parameters<typeof parseScore>[0]> = {
  ode: {
    key: 'C',
    rh: 'E4q:3 E4q F4q G4q | G4q F4q E4q D4q | C4q:1 C4q D4q E4q | E4q. D4e D4h | E4q E4q F4q G4q | G4q F4q E4q D4q | C4q C4q D4q E4q | D4q. C4e C4h',
    lh: 'C3w:5 | G3w:1 | C3w | G3w | C3w | G3w | C3h G3h | G3h C3h',
    chords: 'C | G | C | G | C | G | C G | G C',
  },
  dense: {
    key: 'D',
    time: [3, 4],
    pickup: 1,
    rh: 'A4q | D5e:5 C#5e B4e A4e G4e F#4e | E4q. F#4e G4q | A4s B4s C#5s D5s E5e D5e C#5q | F#4+A4+D5h. | rq Bb4e:2 A4e G#4q~ | G#4h rq | A5w. '.replace('A5w. ', 'A5h.') + '| D5h',
    lh: 'rq | D3+F#3+A3h.:531 | A2h. | D3q A3q F#3q | D3h. | G3et A3et B3et C4q rq | E2h.~ | E2h. | D3h',
  },
  single: { key: 'F', rh: 'F4q:1 G4q A4q Bb4q | C5w:5' },
  bass: { key: 'G', lh: 'G2q:5 A2q B2q C3q | D3h:1 D3h' },
};

export default function App() {
  const [status, setStatus] = useState(piano.getStatus());
  const [which, setWhich] = useState<string>(() => new URLSearchParams(window.location.search).get('s') ?? 'ode');
  const [dark, setDark] = useState(() => new URLSearchParams(window.location.search).get('dark') === '1');
  const ref = useRef<ScoreViewHandle>(null);
  useEffect(() => piano.status.subscribe(setStatus), []);
  const score = useMemo(() => parseScore(SAMPLES[which]), [which]);
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.setCursor(2);
      ref.current?.mark(score.notes[0].id, 'ok');
      ref.current?.mark(score.notes[1].id, 'ok');
      ref.current?.mark(score.notes[2].id, 'warn');
      ref.current?.mark(score.notes[3].id, 'bad');
    }, 300);
    return () => clearTimeout(t);
  }, [score]);
  return (
    <div className="mc-root" data-theme={dark ? 'dark' : 'light'}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 p-3">
          <h1 className="font-mc-serif text-2xl">Middle C</h1>
          <span className="text-sm text-mc-muted">
            {status.state} {Math.round(status.progress * 100)}%
          </span>
          <button className="rounded-full bg-mc-ink px-4 py-1 text-mc-bg" onClick={() => void piano.unlock()}>
            Begin
          </button>
          {Object.keys(SAMPLES).map((k) => (
            <button key={k} className="rounded border border-mc-line px-2" onClick={() => setWhich(k)}>
              {k}
            </button>
          ))}
          <button className="rounded border border-mc-line px-2" onClick={() => setDark((d) => !d)}>
            theme
          </button>
        </div>
        <div className="min-h-0 flex-1 px-4">
          <ScoreView ref={ref} score={score} focusHand={which === 'ode' ? null : null} />
        </div>
        <Keyboard low={48} high={84} height={170} labels="c" />
      </div>
    </div>
  );
}
