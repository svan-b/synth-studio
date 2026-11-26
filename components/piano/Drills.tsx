'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { instrument } from '@/lib/piano/audio/instrument';
import { notAttempted, type FlowResult } from '@/lib/piano/engine/flow';
import { noteBus } from '@/lib/piano/input/bus';
import { input, isRemoteKey } from '@/lib/piano/input/hub';
import {
  CHORD_LEVELS,
  EAR_LEVELS,
  RHYTHM_LEVELS,
  SIGHT_LEVELS,
  TECH_LEVELS,
  chordExercise,
  chordLevelCap,
  rhythmLevelCap,
  sightLevelCap,
  daySeed,
  earExercise,
  evenness,
  rhythmExercise,
  sightExercise,
  techniqueExercise,
  techniqueLevelCap,
  type ChordExercise,
} from '@/lib/piano/learn/generators';
import { dueReadingCards, type DrillKind } from '@/lib/piano/learn/planner';
import { outcomeFromAnswer } from '@/lib/piano/learn/srs';
import { usePiano } from '@/lib/piano/learn/store';
import { parseScore } from '@/lib/piano/music/score';
import { midiLabel, midiName } from '@/lib/piano/music/theory';
import { shuffle } from '@/lib/piano/util/emitter';
import { useHints, useInputMode, usePracticeTimer, useRemote, useWakeLock } from './hooks';
import { Keyboard, flashKey, keyboardRange, type KeyMark } from './Keyboard';
import PlaySurface from './PlaySurface';
import ScoreView from './ScoreView';
import { useOnward } from './session';
import { Button, Icon, IconButton, Pill, ProgressBar } from './ui';

function Shell({ title, progress, onClose, children }: { title: string; progress: number; onClose: () => void; children: ReactNode }) {
  const { session } = useOnward();
  // On the closing screen of a part of the day's session, closing means stopping for today. Going on has its own button.
  const close = () => (progress >= 1 && session ? session.stop() : onClose());
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={close}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <ProgressBar value={progress} tone="ok" />
        </div>
        <div className="max-w-[18rem] truncate text-right text-[1.05rem] font-medium text-mc-muted">{title}</div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Summary({ title, lines, onDone }: { title: string; lines: string[]; onDone: () => void }) {
  const hints = useHints();
  // Inside the day's session, the way out of a finished exercise is the way on to the next part.
  const { label, session } = useOnward();
  useRemote({ primary: onDone, pedal: true });
  useEffect(() => {
    instrument.chime();
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="mc-pop flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
        <Icon.Check size={44} />
      </div>
      <h2 className="mc-fade-up font-mc-serif text-5xl">{title}</h2>
      <div className="mc-fade-up max-w-2xl space-y-1 text-[1.3rem] text-mc-muted">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {session?.next && (
          <Button variant="ghost" size="lg" onClick={session.stop}>
            Stop for today
          </Button>
        )}
        <Button size="lg" onClick={onDone} className="min-w-[260px]" hint={hints.onward}>
          {label}
        </Button>
      </div>
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

function ReadingDrill({ onClose }: { onClose: (finished?: boolean) => void }) {
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
      <Shell title="Note reading" progress={0} onClose={() => onClose(true)}>
        <Summary title="Nothing to review yet" lines={['Notes join this review as the lessons on reading teach them.']} onDone={() => onClose(true)} />
      </Shell>
    );
  }
  if (!card || !score) {
    return (
      <Shell title="Note reading" progress={1} onClose={() => onClose(true)}>
        <Summary
          title="Reading done"
          lines={[`${right} of ${deck.length} right.`, 'Notes you found quickly will wait longer before they come back.']}
          onDone={() => onClose(true)}
        />
      </Shell>
    );
  }
  const marks: Record<number, KeyMark> = reveal && !reveal.ok ? { [reveal.midi]: { kind: 'target', label: midiLabel(reveal.midi) } } : {};
  return (
    <Shell title="Note reading" progress={index / deck.length} onClose={() => onClose(false)}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-7 text-[1.35rem] text-mc-ink/85">
          {reveal ? (
            <span className={reveal.ok ? 'text-mc-ok' : 'text-mc-hint-ink'}>
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

type Generated = 'rhythm' | 'ear' | 'sight' | 'chords' | 'technique';

const CHORD_KEYS = { low: 48, high: 84 };

/** How long a reply stays up before the next item comes, in milliseconds. Long enough to read, and longer after a miss. */
function staysFor(text: string, ok: boolean): number {
  const reading = 900 + text.length * 45;
  return Math.min(6500, Math.max(ok ? 1800 : 3200, reading));
}

interface Round {
  kind: Generated;
  title: string;
  count: number;
  maxLevel: number;
}

const ROUNDS: Record<Generated, Round> = {
  rhythm: { kind: 'rhythm', title: 'Rhythm', count: 3, maxLevel: RHYTHM_LEVELS },
  ear: { kind: 'ear', title: 'Play by ear', count: 5, maxLevel: EAR_LEVELS },
  sight: { kind: 'sight', title: 'Sight reading', count: 3, maxLevel: SIGHT_LEVELS },
  chords: { kind: 'chords', title: 'Chords', count: 4, maxLevel: CHORD_LEVELS },
  technique: { kind: 'technique', title: 'Scales and arpeggios', count: 3, maxLevel: TECH_LEVELS },
};

function GeneratedDrill({ kind, onClose }: { kind: Generated; onClose: (finished?: boolean) => void }) {
  const round = ROUNDS[kind];
  const stored = usePiano((s) => s.drills[kind]);
  const lessons = usePiano((s) => s.lessons);
  const recordDrill = usePiano((s) => s.recordDrill);
  const setDrillLevel = usePiano((s) => s.setDrillLevel);
  // Each exercise climbs only as far as the lessons have gone: no minor chords before the lesson on them,
  // no eighth notes in a rhythm before the lesson that teaches them, and so on.
  const lessonDone = (id: string) => lessons[id]?.done === true;
  const cap =
    kind === 'chords'
      ? chordLevelCap(lessonDone)
      : kind === 'technique'
        ? techniqueLevelCap(lessonDone)
        : kind === 'rhythm'
          ? rhythmLevelCap(lessonDone)
          : kind === 'sight'
            ? sightLevelCap(lessonDone)
            : round.maxLevel;
  const top = Math.min(round.maxLevel, cap);
  // Before the lesson on the staff, a rhythm is shown as its shape, each note as long as it lasts.
  const shapeOnly = kind === 'rhythm' && !lessonDone('the-staff');
  const [level, setLevel] = useState(() => Math.max(1, Math.min(top, stored?.level ?? 1)));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'look' | 'listen' | 'play'>(kind === 'ear' ? 'listen' : kind === 'sight' ? 'look' : 'play');
  const [run, setRun] = useState(0);
  // The reply above the stand. Where the music is out of sight, `stand` is what the stand itself says to match.
  const [note, setNote] = useState<{ ok: boolean; text: string; stand?: string } | null>(null);
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

  // The chords set for each item so far, so that the same four do not come twice running.
  const chordIds = useRef<Record<number, string>>({});
  const { score, chord, named } = useMemo(() => {
    const seed = seedBase.current + index * 13;
    const made: ChordExercise | null = kind === 'chords' ? chordExercise(level, seed, chordIds.current[index - 1]) : null;
    if (made) chordIds.current[index] = made.id;
    const run = kind === 'technique' ? techniqueExercise(level, seed) : null;
    const music = made
      ? made.music
      : run
        ? run.music
        : kind === 'rhythm'
          ? rhythmExercise(level, seed)
          : kind === 'ear'
            ? earExercise(level, seed)
            : sightExercise(level, seed);
    return { score: parseScore(music), chord: made, named: run?.name ?? null };
    // A new exercise for each item. The level is read when the item starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, kind]);

  const finished = index >= round.count;

  const quiet = useRef(0);
  const advance = useCallback((auto?: boolean) => {
    // A press that was already on its way when the exercise moved on by itself is not a wish to skip the next one.
    const now = performance.now();
    if (auto === true) quiet.current = now + 750;
    else if (now < quiet.current) return;
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
        if (streakRef.current >= 2 && level < top) {
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
    [kind, level, recordDrill, setDrillLevel, top],
  );

  const onDone = useCallback(
    (result: FlowResult | null) => {
      if (phase === 'listen') {
        timer.current = setTimeout(() => {
          setPhase('play');
          setRun((r) => r + 1);
        }, 120);
        return;
      }
      if (!result) return;
      if (kind === 'ear') {
        if (result.clean) {
          adapt(true);
          setNote({ ok: true, text: 'Yes, that is it.', stand: 'That is it' });
          timer.current = setTimeout(() => advance(true), 1100);
        } else if (tries < 1) {
          setTries(1);
          setNote({ ok: false, text: 'Not quite. Listen once more.', stand: 'Listen again' });
          timer.current = setTimeout(hear, 1300);
        } else {
          adapt(false);
          setNote({ ok: false, text: 'You got there. On to the next.', stand: 'On to the next' });
          timer.current = setTimeout(() => advance(true), 1500);
        }
        return;
      }
      if (kind === 'chords') {
        const ok = result.clean;
        adapt(ok);
        const shown = result.hintedSteps;
        const wrong = result.wrongNotes;
        const text = ok
          ? 'Yes. Every chord found first time.'
          : shown > 0
            ? shown === 1
              ? 'One of them had to be shown. It will come round again.'
              : `${shown} of them had to be shown. They will come round again.`
            : `${wrong === 1 ? 'One wrong key' : `${wrong} wrong keys`} on the way. Picture the shape before you press.`;
        setNote({ ok, text });
        timer.current = setTimeout(() => advance(true), staysFor(text, ok));
        return;
      }
      // A run in which nothing was played is not an attempt, and changes nothing.
      if (notAttempted(result)) {
        setNote(null);
        if (kind === 'sight') setPhase('look');
        setRun((r) => r + 1);
        return;
      }
      if (kind === 'technique') {
        // A scale with a note missing, or a wrong key in it, is not yet the scale. Heard by ear, one slip may be the microphone's.
        const missed = result.missedNotes;
        const wrong = result.wrongNotes;
        const whole = missed + wrong <= (result.byEar ? 1 : 0);
        const ok = whole && result.onTime >= 0.7;
        adapt(ok);
        // How even the run was, from how far its notes strayed from one another around the beat.
        const timed = result.detail.filter((d) => d.errMs !== undefined);
        const spread = evenness(timed.map((d) => d.errMs as number));
        // How long the keys stayed down, as a share of each note. A run should join up, not peck.
        const holds = result.detail.filter((d) => d.held !== undefined).map((d) => d.held as number);
        const joined = holds.length >= 4 ? holds.reduce((a, h) => a + h, 0) / holds.length : null;
        const text = ok
          ? joined !== null && joined < 0.45
            ? 'Right notes, in time, but short and detached. Hold each key until the next one goes down.'
            : result.biasMs > 70
              ? 'Even, and a little behind the beat throughout. Land with the click, not after it.'
              : result.biasMs < -70
                ? 'Even, and a little ahead of the beat throughout. Let the click lead you.'
                : spread !== null && spread <= 28
                  ? 'Even and steady, each note flowing into the next. That is the sound to aim for.'
                  : 'Right notes, in time. Now make the run even, so that no note comes early or late.'
          : !whole
            ? missed > 0
              ? `${missed === 1 ? 'One note was' : `${missed} notes were`} left out. Every note of the run counts, so follow the finger numbers through.`
              : `${wrong === 1 ? 'One wrong key' : `${wrong} wrong keys`} on the way. Picture where the hand goes next, and follow the finger numbers.`
            : result.biasMs > 25
              ? 'The notes were right but behind the beat. Land with the click.'
              : result.biasMs < -25
                ? 'The notes were right but ahead of the beat. Let the click lead you.'
                : 'The notes were right but uneven. Feel each click and fit the notes to it.';
        setNote({ ok, text });
        timer.current = setTimeout(() => advance(true), staysFor(text, ok));
        return;
      }
      const ok = kind === 'rhythm' ? result.accuracy >= 0.85 && result.onTime >= 0.65 : result.accuracy >= 0.85;
      adapt(ok);
      const pct = Math.round(result.accuracy * 100);
      const text = ok
        ? kind === 'rhythm'
          ? `Steady. ${Math.round(result.onTime * 100)} percent on the beat.`
          : `${pct} percent, and you kept going.`
        : kind === 'rhythm'
          ? result.onTime >= 0.65
            ? 'The beat was steady, but some notes were missing or extra. Count each beat and hold the long notes for their full length.'
            : result.biasMs > 25
              ? 'A little behind the beat. Listen for the click and land with it.'
              : result.biasMs < -25
                ? 'A little ahead of the beat. Let the click lead you.'
                : 'Uneven against the beat. Count along with the click.'
          : `${pct} percent. Reading at sight is about keeping going, so never stop to fix a note.`;
      setNote({ ok, text });
      timer.current = setTimeout(() => advance(true), staysFor(text, ok));
    },
    [adapt, advance, hear, kind, phase, tries],
  );

  // As in a lesson: the top key always goes on, and the bottom key hears it again where there is something to hear.
  useRemote({
    primary: phase === 'look' ? () => setPhase('play') : () => advance(),
    secondary: hear,
  });
  const hints = useHints();

  if (finished) {
    return (
      <Shell title={round.title} progress={1} onClose={() => onClose(true)}>
        <Summary
          title={`${round.title} done`}
          lines={[`${good} of ${round.count} went well.`, levelNote ?? 'The difficulty follows how you do, so it stays just within reach.']}
          onDone={() => onClose(true)}
        />
      </Shell>
    );
  }

  const brief =
    kind === 'chords'
      ? `${chord?.byNumber ? `In the key of **${chord.key}**. ` : ''}${
          chord?.style === 'broken'
            ? '**One note at a time.** Play each chord from the note it is named after: bottom, middle, top, middle.'
            : '**All three notes together.** Any position on the keyboard will do.'
        }`
      : kind === 'technique'
        ? `${named ?? 'A scale'}. Play it with the beat, smooth and even.`
        : kind === 'rhythm'
          ? 'Tap this rhythm in time with the clicks, on any key.'
          : kind === 'ear'
            ? 'Listen, then play it back. It starts on **C**.'
            : phase === 'look'
              ? 'Look it over before you play. Where does it start? Where does it step, skip or repeat?'
              : 'Play it with the beat. Keep going whatever happens.';

  return (
    <Shell title={round.title} progress={index / round.count} onClose={() => onClose(false)}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-4 px-7 pb-2 pt-1">
          <div className={`min-w-0 flex-1 text-[1.35rem] leading-snug ${note ? (note.ok ? 'text-mc-ok' : 'text-mc-hint-ink') : 'text-mc-ink/85'}`}>
            {note ? note.text : brief.split('**').map((part, i) => (i % 2 ? <strong key={i} className="text-mc-ink">{part}</strong> : <span key={i}>{part}</span>))}
          </div>
          <Pill>Level {level}</Pill>
          {kind === 'ear' && (
            <Button variant="soft" onClick={hear} icon={<Icon.Ear size={18} />} hint={hints.bottom}>
              Hear it
            </Button>
          )}
          {phase === 'look' ? (
            <Button onClick={() => setPhase('play')} className="mc-pulse" hint={hints.top}>
              I am ready
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => advance()} hint={hints.top}>
              {note ? 'Go on' : 'Skip'}
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {phase === 'look' ? (
            <div className="h-full px-5 pb-16">
              <ScoreView score={score} showFingering />
            </div>
          ) : (
            <PlaySurface
              score={score}
              mode={phase === 'listen' ? 'listen' : kind === 'ear' || kind === 'chords' ? 'wait' : 'tempo'}
              display={kind === 'ear' ? 'hidden' : kind === 'chords' ? 'chart' : shapeOnly ? 'contour' : 'staff'}
              contourLabel={shapeOnly ? 'none' : undefined}
              // A chord not found in a while is shown, so nobody is left stuck. It then counts as shown.
              hints={kind === 'chords' ? 'delay' : 'never'}
              // Working a chord out from its symbol takes a while. The first one counts like the rest.
              hintMs={kind === 'chords' ? 12000 : undefined}
              countFirstHint={kind === 'chords'}
              anyOctave={kind === 'chords'}
              // Chords may be played anywhere, so three octaves of keys are shown to mirror them.
              keys={kind === 'chords' ? CHORD_KEYS : undefined}
              // While a reply is up, the stand does not go on asking for the same thing.
              hiddenPrompt={note?.stand ?? 'Now play what you heard'}
              catchUp={kind === 'ear' ? 2.2 : undefined}
              // Sight reading starts when the learner says they have looked it over.
              autoStart={kind === 'sight'}
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

export default function Drill({ kind, onClose }: { kind: DrillKind; onClose: (finished?: boolean) => void }) {
  useWakeLock(true);
  usePracticeTimer();
  if (kind === 'reading') return <ReadingDrill onClose={onClose} />;
  return <GeneratedDrill kind={kind} onClose={onClose} />;
}
