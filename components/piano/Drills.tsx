'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import type { FlowResult } from '@/lib/piano/engine/flow';
import { noteBus } from '@/lib/piano/input/bus';
import { input, isRemoteKey } from '@/lib/piano/input/hub';
import { EAR_LEVELS, RHYTHM_LEVELS, SIGHT_LEVELS, daySeed, earExercise, rhythmExercise, sightExercise } from '@/lib/piano/learn/generators';
import { dueReadingCards, type DrillKind } from '@/lib/piano/learn/planner';
import { outcomeFromAnswer } from '@/lib/piano/learn/srs';
import { usePiano } from '@/lib/piano/learn/store';
import { parseScore } from '@/lib/piano/music/score';
import { midiLabel, midiName } from '@/lib/piano/music/theory';
import { shuffle } from '@/lib/piano/util/emitter';
import { useInputMode, usePracticeTimer, useRemote, useWakeLock } from './hooks';
import { Keyboard, flashKey, keyboardRange, type KeyMark } from './Keyboard';
import PlaySurface from './PlaySurface';
import ScoreView from './ScoreView';
import { Button, Icon, IconButton, Pill, ProgressBar } from './ui';

function Shell({ title, progress, onClose, children }: { title: string; progress: number; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <ProgressBar value={progress} tone="ok" />
        </div>
        <div className="max-w-[18rem] truncate text-right text-sm font-medium text-mc-muted">{title}</div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Summary({ title, lines, onDone }: { title: string; lines: string[]; onDone: () => void }) {
  useRemote({ primary: onDone });
  useEffect(() => {
    instrument.chime();
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
        <Icon.Check size={44} />
      </div>
      <h2 className="mc-fade-up font-mc-serif text-4xl">{title}</h2>
      <div className="mc-fade-up max-w-xl space-y-1 text-[1.1rem] text-mc-muted">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <Button size="lg" onClick={onDone} className="min-w-[220px]">
        Done
      </Button>
    </div>
  );
}

// --------------------------------------------------------------- reading

interface ReadCard {
  id: string;
  clef: 'T' | 'B';
  midi: number;
}

function parseCard(id: string): ReadCard {
  const [, clef, m] = id.split(':');
  return { id, clef: clef as 'T' | 'B', midi: Number(m) };
}

function ReadingDrill({ onClose }: { onClose: () => void }) {
  const cards = usePiano((s) => s.cards);
  const reviewCard = usePiano((s) => s.reviewCard);
  const recordDrill = usePiano((s) => s.recordDrill);
  const mode = useInputMode();
  const kbRef = useRef<HTMLDivElement>(null);

  const deck = useMemo(() => {
    const due = dueReadingCards(cards, new Date());
    const rest = shuffle(Object.keys(cards).filter((id) => id.startsWith('read:') && !due.includes(id)));
    // Due notes first, topped up with others so a round is never too short.
    return [...due, ...rest].slice(0, 10).map(parseCard);
    // The deck is fixed for the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [right, setRight] = useState(0);
  const [reveal, setReveal] = useState<{ ok: boolean; midi: number } | null>(null);
  const shownAt = useRef(performance.now());
  const answered = useRef(false);
  const card = deck[index];

  const range = useMemo(() => {
    const ms = deck.map((c) => c.midi);
    if (ms.length === 0) return { low: 48, high: 72 };
    return keyboardRange(Math.min(...ms) - 2, Math.max(...ms) + 2, mode === 'touch' ? 14 : 19);
  }, [deck, mode]);

  const score = useMemo(() => {
    if (!card) return null;
    const name = midiName(card.midi);
    return parseScore(card.clef === 'T' ? { rh: `${name}w` } : { lh: `${name}w` });
  }, [card]);

  useEffect(() => {
    if (!card) return;
    shownAt.current = performance.now();
    answered.current = false;
    setReveal(null);
    input.expect([card.midi]);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = noteBus.subscribe((ev) => {
      if (ev.type !== 'on' || answered.current) return;
      if (ev.source === 'midi' && isRemoteKey(ev.midi)) return;
      answered.current = true;
      const ok = ev.midi === card.midi;
      const seconds = (performance.now() - shownAt.current) / 1000;
      reviewCard(card.id, outcomeFromAnswer(ok, seconds));
      recordDrill('reading', ok);
      flashKey(kbRef.current, ev.midi, ok ? 'ok' : 'bad', 900);
      if (ok) setRight((r) => r + 1);
      setReveal({ ok, midi: card.midi });
      timer = setTimeout(() => setIndex((i) => i + 1), ok ? 900 : 2200);
    });
    return () => {
      unsub();
      input.expect(null);
      if (timer) clearTimeout(timer);
    };
  }, [card, recordDrill, reviewCard]);

  if (deck.length === 0) {
    return (
      <Shell title="Note reading" progress={0} onClose={onClose}>
        <Summary title="Nothing to review yet" lines={['Notes join this review as the lessons on reading teach them.']} onDone={onClose} />
      </Shell>
    );
  }
  if (!card || !score) {
    return (
      <Shell title="Note reading" progress={1} onClose={onClose}>
        <Summary
          title="Reading done"
          lines={[`${right} of ${deck.length} right.`, 'Notes you found quickly will wait longer before they come back.']}
          onDone={onClose}
        />
      </Shell>
    );
  }
  const marks: Record<number, KeyMark> = reveal && !reveal.ok ? { [reveal.midi]: { kind: 'target', label: midiLabel(reveal.midi) } } : {};
  return (
    <Shell title="Note reading" progress={index / deck.length} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-7 text-[1.15rem] text-mc-muted">
          {reveal ? (
            <span className={reveal.ok ? 'text-mc-ok' : 'text-mc-hint'}>
              {reveal.ok ? 'Yes.' : 'Not that one.'} This note is <strong>{midiLabel(reveal.midi)}</strong>.
            </span>
          ) : (
            'Play this note on your piano.'
          )}
        </div>
        <div className="mx-auto min-h-0 w-full max-w-xl flex-1 py-4">
          <ScoreView key={card.id} score={score} showFingering={false} showMeasureNumbers={false} showTime={false} maxZoom={2.2} minZoom={1.4} />
        </div>
        <div ref={kbRef} className="shrink-0">
          <Keyboard
            low={range.low}
            high={range.high}
            height={mode === 'touch' ? 188 : 116}
            marks={marks}
            labels="c"
            interactive={mode === 'touch'}
            sound={mode === 'touch'}
            className={mode === 'touch' ? '' : 'mc-keys-mini'}
          />
        </div>
      </div>
    </Shell>
  );
}

// --------------------------------------------------- generated exercises

interface Round {
  kind: 'rhythm' | 'ear' | 'sight';
  title: string;
  count: number;
  maxLevel: number;
}

const ROUNDS: Record<'rhythm' | 'ear' | 'sight', Round> = {
  rhythm: { kind: 'rhythm', title: 'Rhythm', count: 3, maxLevel: RHYTHM_LEVELS },
  ear: { kind: 'ear', title: 'Play by ear', count: 5, maxLevel: EAR_LEVELS },
  sight: { kind: 'sight', title: 'Sight reading', count: 3, maxLevel: SIGHT_LEVELS },
};

function GeneratedDrill({ kind, onClose }: { kind: 'rhythm' | 'ear' | 'sight'; onClose: () => void }) {
  const round = ROUNDS[kind];
  const stored = usePiano((s) => s.drills[kind]);
  const recordDrill = usePiano((s) => s.recordDrill);
  const setDrillLevel = usePiano((s) => s.setDrillLevel);
  const [level, setLevel] = useState(() => Math.max(1, Math.min(round.maxLevel, stored?.level ?? 1)));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'look' | 'listen' | 'play'>(kind === 'ear' ? 'listen' : kind === 'sight' ? 'look' : 'play');
  const [run, setRun] = useState(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [good, setGood] = useState(0);
  const [tries, setTries] = useState(0);
  const [levelNote, setLevelNote] = useState<string | null>(null);
  const streakRef = useRef(0);
  const seedBase = useRef(daySeed(Math.floor(Math.random() * 1000)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const score = useMemo(() => {
    const seed = seedBase.current + index * 13;
    const music = kind === 'rhythm' ? rhythmExercise(level, seed) : kind === 'ear' ? earExercise(level, seed) : sightExercise(level, seed);
    return parseScore(music);
    // A new exercise for each item. The level is read when the item starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, kind]);

  const finished = index >= round.count;

  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNote(null);
    setTries(0);
    setIndex((i) => i + 1);
    setPhase(kind === 'ear' ? 'listen' : kind === 'sight' ? 'look' : 'play');
    setRun((r) => r + 1);
  }, [kind]);

  const hear = useCallback(() => {
    if (kind !== 'ear') return;
    if (timer.current) clearTimeout(timer.current);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, [kind]);

  const adapt = useCallback(
    (ok: boolean) => {
      recordDrill(kind, ok);
      if (ok) {
        setGood((g) => g + 1);
        streakRef.current = Math.max(1, streakRef.current + 1);
        if (streakRef.current >= 2 && level < round.maxLevel) {
          streakRef.current = 0;
          setLevel(level + 1);
          setDrillLevel(kind, level + 1);
          setLevelNote('That is going well, so the next ones are a little harder.');
        }
      } else {
        streakRef.current = Math.min(-1, streakRef.current - 1);
        if (streakRef.current <= -2 && level > 1) {
          streakRef.current = 0;
          setLevel(level - 1);
          setDrillLevel(kind, level - 1);
          setLevelNote('The next ones are a little easier, to rebuild from solid ground.');
        }
      }
    },
    [kind, level, recordDrill, round.maxLevel, setDrillLevel],
  );

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (phase === 'listen') {
        timer.current = setTimeout(() => {
          setPhase('play');
          setRun((r) => r + 1);
        }, 350);
        return;
      }
      if (!result) return;
      if (kind === 'ear') {
        if (result.clean) {
          adapt(true);
          setNote({ ok: true, text: 'Yes, that is it.' });
          timer.current = setTimeout(advance, 1100);
        } else if (tries < 1) {
          setTries(1);
          setNote({ ok: false, text: 'Not quite. Listen once more.' });
          timer.current = setTimeout(hear, 1300);
        } else {
          adapt(false);
          setNote({ ok: false, text: 'You got there. On to the next.' });
          timer.current = setTimeout(advance, 1500);
        }
        return;
      }
      const ok = kind === 'rhythm' ? result.accuracy >= 0.85 && result.onTime >= 0.65 : result.accuracy >= 0.85;
      adapt(ok);
      const pct = Math.round(result.accuracy * 100);
      setNote({
        ok,
        text: ok
          ? kind === 'rhythm'
            ? `Steady. ${Math.round(result.onTime * 100)} percent on the beat.`
            : `${pct} percent, and you kept going.`
          : kind === 'rhythm'
            ? result.biasMs > 0
              ? 'A little behind the beat. Listen for the click and land with it.'
              : 'A little ahead of the beat. Let the click lead you.'
            : `${pct} percent. Reading at sight is about keeping going, so never stop to fix a note.`,
      });
      timer.current = setTimeout(advance, ok ? 2000 : 3200);
    },
    [adapt, advance, hear, kind, phase, tries],
  );

  useRemote({
    primary: phase === 'look' ? () => setPhase('play') : note ? advance : undefined,
    secondary: hear,
  });

  if (finished) {
    return (
      <Shell title={round.title} progress={1} onClose={onClose}>
        <Summary
          title={`${round.title} done`}
          lines={[`${good} of ${round.count} went well.`, levelNote ?? 'The difficulty follows how you do, so it stays just within reach.']}
          onDone={onClose}
        />
      </Shell>
    );
  }

  const brief =
    kind === 'rhythm'
      ? 'Tap this rhythm in time with the clicks, on any key.'
      : kind === 'ear'
        ? 'Listen, then play it back. It starts on **C**.'
        : phase === 'look'
          ? 'Look it over before you play. Where does it start? Where does it step, skip or repeat?'
          : 'Play it with the beat. Keep going whatever happens.';

  return (
    <Shell title={round.title} progress={index / round.count} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-4 px-7 pb-2 pt-1">
          <div className={`min-w-0 flex-1 text-[1.15rem] leading-snug ${note ? (note.ok ? 'text-mc-ok' : 'text-mc-hint') : 'text-mc-muted'}`}>
            {note ? note.text : brief.split('**').map((part, i) => (i % 2 ? <strong key={i} className="text-mc-ink">{part}</strong> : <span key={i}>{part}</span>))}
          </div>
          <Pill>Level {level}</Pill>
          {kind === 'ear' && (
            <Button variant="soft" size="sm" onClick={hear} icon={<Icon.Ear size={16} />}>
              Hear it
            </Button>
          )}
          {phase === 'look' && (
            <Button size="sm" onClick={() => setPhase('play')} className="mc-pulse">
              I am ready
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={advance}>
            Skip
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {phase === 'look' ? (
            <div className="h-full px-5 pb-16">
              <ScoreView score={score} showFingering />
            </div>
          ) : (
            <PlaySurface
              score={score}
              mode={phase === 'listen' ? 'listen' : kind === 'ear' ? 'wait' : 'tempo'}
              display={kind === 'ear' ? 'hidden' : 'staff'}
              hints="never"
              anyKey={kind === 'rhythm'}
              runId={`${index}-${run}`}
              onDone={onDone}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

export default function Drill({ kind, onClose }: { kind: DrillKind; onClose: () => void }) {
  const logPractice = usePiano((s) => s.logPractice);
  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, 0, 1));
  if (kind === 'reading') return <ReadingDrill onClose={onClose} />;
  return <GeneratedDrill kind={kind} onClose={onClose} />;
}
