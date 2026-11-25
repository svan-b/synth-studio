'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument, playScore } from '@/lib/guitar/audio/instrument';
import { allLessons, changeScore, chordsKnown, songScore } from '@/lib/guitar/content/catalog';
import { Follower, type FollowResult } from '@/lib/guitar/engine/follow';
import { DRILL_LABEL, dueChords, introducedSongs, type DrillKind } from '@/lib/guitar/learn/planner';
import { outcomeFromAnswer } from '@/lib/guitar/learn/srs';
import { pairKey, useGuitar } from '@/lib/guitar/learn/store';
import { chordColour, sayChord } from '@/lib/guitar/music/chords';
import { changesIn, parseScore } from '@/lib/guitar/music/score';
import { OPEN_MIDI, STRING_NAME, noteName, type StringNo } from '@/lib/guitar/music/theory';
import { mulberry32, pick, shuffle } from '@/lib/guitar/util/emitter';
import { ChordDiagram } from './ChordDiagram';
import { PatternView } from './Figures';
import { useKnownChords, useListening, usePracticeTimer, useWakeLock } from './hooks';
import PlaySurface from './PlaySurface';
import { Button, Icon, IconButton, Pill } from './ui';

function Frame({ title, onClose, children, right }: { title: string; onClose: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1 truncate font-os-serif text-[1.4rem]">{title}</div>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function MicNeeded({ start, denied }: { start: () => void; denied: boolean }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 text-center">
      <p className="max-w-md text-[1.15rem] text-os-muted">{denied ? "The microphone is switched off for this app. Turn it on in the iPad's Settings, under Privacy and Security, Microphone." : 'The app listens to your guitar through the microphone.'}</p>
      {!denied && (
        <Button size="lg" onClick={start} icon={<Icon.Mic size={20} />}>
          Start listening
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------ one minute changes

/** Pairs of chords worth practising: the changes in the learner's songs, then any two chords they know. */
export function changePairs(lessons: Record<string, { done: boolean }>, songs: Record<string, unknown>): Array<[string, string]> {
  const known = chordsKnown((id) => lessons[id]?.done === true);
  const out: Array<[string, string]> = [];
  const add = (a: string, b: string) => {
    if (a === b || !known.includes(a) || !known.includes(b)) return;
    if (!out.some(([x, y]) => pairKey(x, y) === pairKey(a, b))) out.push([a, b]);
  };
  for (const id of introducedSongs(lessons as never, songs as never)) for (const c of changesIn(songScore(id))) add(c.from, c.to);
  for (const l of allLessons()) if (lessons[l.id]?.done) for (const st of l.steps) if (st.kind === 'changes') add(st.from, st.to);
  for (let i = 1; i < known.length; i++) add(known[i - 1], known[i]);
  return out;
}

function ChangesDrill({ onClose }: { onClose: () => void }) {
  const lessons = useGuitar((s) => s.lessons);
  const songs = useGuitar((s) => s.songs);
  const records = useGuitar((s) => s.changes);
  const recordChanges = useGuitar((s) => s.recordChanges);
  const recordDrill = useGuitar((s) => s.recordDrill);
  const known = useKnownChords();
  const pairs = useMemo(() => changePairs(lessons, songs), [lessons, songs]);
  // The pair never tried, or the slowest one, comes first.
  const suggested = useMemo(() => pairs.slice().sort((a, b) => (records[pairKey(...a)]?.best ?? -1) - (records[pairKey(...b)]?.best ?? -1))[0] ?? (['Em', 'E'] as [string, string]), [pairs, records]);
  const [pair, setPair] = useState<[string, string]>(suggested);
  const [phase, setPhase] = useState<'ready' | 'going' | 'done'>('ready');
  const [left, setLeft] = useState(60);
  const [count, setCount] = useState(0);
  const [at, setAt] = useState(0);
  const [outcome, setOutcome] = useState<{ count: number; best: boolean; before: number } | null>(null);
  const { status, start } = useListening(true);
  const follower = useRef<Follower | null>(null);
  useWakeLock(true);

  const begin = useCallback(() => {
    void guitar.unlock();
    const score = changeScore(pair[0], pair[1], 240, 60);
    const f = new Follower(score, { mode: 'wait', hintDelayMs: Infinity, hintAfterWrong: 99, confusers: known });
    follower.current = f;
    let changes = 0;
    f.events.subscribe((ev) => {
      if (ev.type === 'step') setAt(ev.index);
      if (ev.type === 'mark' && ev.index > 0) {
        changes++;
        setCount(changes);
      }
    });
    setCount(0);
    setAt(0);
    setLeft(60);
    setPhase('going');
    f.start();
  }, [known, pair]);

  useEffect(() => {
    if (phase !== 'going') return;
    const t0 = performance.now();
    const t = setInterval(() => {
      const remaining = Math.max(0, 60 - Math.floor((performance.now() - t0) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(t);
        follower.current?.stop();
        setPhase('done');
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    const r = recordChanges(pair[0], pair[1], count);
    recordDrill('changes', count > 0);
    setOutcome({ count, ...r });
    instrument.chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => follower.current?.stop(), []);

  const rec = records[pairKey(...pair)];
  const now = at % 2 === 0 ? pair[0] : pair[1];
  return (
    <Frame title="One minute changes" onClose={onClose} right={phase === 'going' ? <Pill tone="accent">{left} seconds</Pill> : undefined}>
      {status.state !== 'listening' ? (
        <MicNeeded start={start} denied={status.state === 'denied'} />
      ) : (
        <div className="os-scroll flex h-full flex-col items-center gap-6 px-8 pb-8 pt-2">
          {phase === 'ready' && (
            <>
              <p className="max-w-xl text-center text-[1.25rem] leading-relaxed text-os-muted">
                Change between the two chords for a minute, one strum each. Only clean changes count. Fast comes from relaxed, so do not rush.
              </p>
              <div className="flex items-end gap-8">
                <ChordDiagram chord={pair[0]} width={190} />
                <ChordDiagram chord={pair[1]} width={190} />
              </div>
              <div className="text-[1.15rem] text-os-muted">{rec ? `Your best is ${rec.best} changes.` : 'Your first try at this pair.'}</div>
              <div className="flex flex-wrap justify-center gap-2">
                {pairs.slice(0, 8).map((p) => (
                  <button key={pairKey(...p)} onClick={() => setPair(p)} className={`h-11 rounded-full px-4 text-[15px] font-semibold ${pairKey(...p) === pairKey(...pair) ? 'bg-os-ink text-os-bg' : 'bg-os-raised text-os-muted'}`}>
                    {p[0]} and {p[1]}
                  </button>
                ))}
              </div>
              <Button size="lg" onClick={begin} icon={<Icon.Play size={20} />} className="min-w-[240px]">
                Start the minute
              </Button>
            </>
          )}
          {phase === 'going' && (
            <>
              <div className="font-os-serif text-[6rem] font-semibold leading-none tabular-nums">{count}</div>
              <div className="-mt-3 text-[1.15rem] text-os-muted">clean changes</div>
              <div className="flex items-end gap-8">
                {pair.map((c) => (
                  <div key={c} className={`rounded-3xl p-3 transition-all ${c === now ? 'bg-os-accent/10 ring-2 ring-os-accent' : 'opacity-45'}`}>
                    <ChordDiagram chord={c} width={c === now ? 210 : 160} />
                  </div>
                ))}
              </div>
            </>
          )}
          {phase === 'done' && outcome && (
            <>
              <div className="os-pop font-os-serif text-[6rem] font-semibold leading-none tabular-nums">{outcome.count}</div>
              <div className="-mt-3 text-[1.25rem] font-medium">{outcome.best ? `A new best, up from ${outcome.before}!` : outcome.before > 0 ? `Your best is ${Math.max(outcome.before, outcome.count)}.` : 'Your first score. Beat it another day.'}</div>
              <p className="max-w-lg text-center text-[1.1rem] text-os-muted">Numbers like this climb quickly over a few days of short tries. The Progress page keeps them all.</p>
              <div className="flex gap-3">
                <Button variant="soft" size="lg" onClick={() => setPhase('ready')}>
                  Another minute
                </Button>
                <Button size="lg" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ strumming

const RHYTHMS: Array<{ pattern: string; time: [number, number]; tempo: number; say: string }> = [
  { pattern: 'D.D.D.D.', time: [4, 4], tempo: 70, say: 'One down strum on each beat.' },
  { pattern: 'DUDUDUDU', time: [4, 4], tempo: 60, say: 'Down on the beat, up in between. One and two and.' },
  { pattern: 'D.D.DUDU', time: [4, 4], tempo: 66, say: 'Down, down, down up, down up.' },
  { pattern: 'D.DU.UDU', time: [4, 4], tempo: 70, say: 'Down, down up, up down up. Keep swinging through the gap.' },
  { pattern: 'B.D.D.', time: [3, 4], tempo: 84, say: 'Waltz time: bass, strum, strum.' },
  { pattern: 'D.DUD.DU', time: [4, 4], tempo: 76, say: 'Down, down up, down, down up.' },
  { pattern: 'D..D..', time: [6, 8], tempo: 78, say: 'In six eight time, two slow swaying strums a bar.' },
];

function RhythmDrill({ onClose }: { onClose: () => void }) {
  const drill = useGuitar((s) => s.drills.rhythm);
  const recordDrill = useGuitar((s) => s.recordDrill);
  const known = useKnownChords();
  const [level, setLevel] = useState(() => Math.min(RHYTHMS.length, Math.max(1, drill?.level ?? 1)));
  const [run, setRun] = useState(0);
  const [streak, setStreak] = useState(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const chord = known.includes('G') ? 'G' : known.includes('Em') ? 'Em' : 'Em';
  const r = RHYTHMS[level - 1];
  const score = useMemo(() => parseScore({ chart: Array(4).fill(chord).join(' | '), strum: r.pattern, time: r.time, tempo: r.tempo }), [chord, r]);
  useWakeLock(true);
  const onDone = useCallback(
    (result: FollowResult | null) => {
      if (!result) return;
      const ok = result.accuracy >= 0.85 && result.onTime >= 0.7 && result.extraStrikes <= 2;
      recordDrill('rhythm', ok, level);
      if (ok) {
        const s = streak + 1;
        setStreak(s);
        instrument.chime();
        if (s >= 2 && level < RHYTHMS.length) {
          setNote({ ok: true, text: 'Steady twice. On to the next pattern.' });
          setLevel(level + 1);
          setStreak(0);
          recordDrill('rhythm', true, level + 1);
        } else setNote({ ok: true, text: `${Math.round(result.onTime * 100)} percent on the beat. Once more like that.` });
      } else {
        setStreak(0);
        setNote({ ok: false, text: result.extraStrikes > 2 ? 'Extra strums crept in. Keep the hand moving but miss the strings on the gaps.' : result.biasMs > 40 ? 'A little behind the click. Play into it.' : result.biasMs < -40 ? 'A little ahead of the click. Let it lead.' : 'Some strums came early and some late. Feel each click.' });
      }
      setTimeout(() => setRun((x) => x + 1), 2600);
    },
    [level, recordDrill, streak],
  );
  return (
    <Frame title={`Strumming, pattern ${level} of ${RHYTHMS.length}`} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-col items-center gap-3 px-7 pb-2">
          <div className={`text-center text-[1.25rem] ${note ? (note.ok ? 'text-os-ok' : 'text-os-hint-ink') : 'text-os-ink'}`}>{note?.text ?? `${r.say} Hold ${sayChord(chord)}. Only the timing counts.`}</div>
          <PatternView pattern={r.pattern} time={r.time} />
        </div>
        <div className="min-h-0 flex-1">
          <PlaySurface score={score} mode="tempo" display="chart" anyStrike tempoPct={100} runId={`${level}-${run}`} onDone={onDone} />
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ chord check

function RecallDrill({ onClose }: { onClose: () => void }) {
  const cards = useGuitar((s) => s.cards);
  const lessons = useGuitar((s) => s.lessons);
  const reviewCard = useGuitar((s) => s.reviewCard);
  const recordDrill = useGuitar((s) => s.recordDrill);
  const known = useKnownChords();
  const queue = useMemo(() => {
    const due = dueChords(cards, new Date());
    if (due.length >= 3) return due.slice(0, 8);
    // Nothing much due: a few known chords, in a fresh order.
    const extra = shuffle(chordsKnown((id) => lessons[id]?.done === true).filter((c) => !due.includes(c)), mulberry32(Date.now() % 100000));
    return [...due, ...extra].slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { status, start } = useListening(true);
  const t0 = useRef(performance.now());
  // Looking at the picture before playing is help, and the chord comes back sooner for it.
  const peeked = useRef(false);
  useWakeLock(true);
  const chord = queue[i];
  const score = useMemo(() => (chord ? parseScore({ line: `[${chord}]w`, tempo: 60 }) : null), [chord]);
  useEffect(() => {
    if (!score || status.state !== 'listening') return;
    setShown(false);
    setNote(null);
    t0.current = performance.now();
    peeked.current = false;
    let wrong = 0;
    const f = new Follower(score, { mode: 'wait', hintDelayMs: 7000, hintAfterWrong: 2, confusers: known });
    const off = f.events.subscribe((ev) => {
      if (ev.type === 'hint') setShown(true);
      if (ev.type === 'wrong') {
        wrong++;
        setNote(ev.heard ? `That sounded like ${sayChord(ev.heard)}.` : 'Not quite. Try again.');
      }
      if (ev.type === 'unclear') {
        wrong++;
        setNote('Not every string rang. Settle the fingers and strum again.');
      }
      if (ev.type === 'done') {
        const seconds = (performance.now() - t0.current) / 1000;
        const helped = ev.result.hintedSteps > 0 || peeked.current;
        const clean = wrong === 0 && !helped;
        reviewCard(`chord:${chord}`, helped ? 'again' : outcomeFromAnswer(clean, seconds, 4, 10));
        recordDrill('recall', clean);
        instrument.chime();
        setNote(clean ? (seconds < 4 ? 'Quick and clean.' : 'Right.') : 'Got it.');
        setTimeout(() => {
          if (i + 1 >= queue.length) setDone(true);
          else setI(i + 1);
        }, 1300);
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [chord, i, known, queue.length, recordDrill, reviewCard, score, status.state]);
  return (
    <Frame title="Chord check" onClose={onClose} right={!done && queue.length > 0 ? <Pill>{i + 1} of {queue.length}</Pill> : undefined}>
      {status.state !== 'listening' ? (
        <MicNeeded start={start} denied={status.state === 'denied'} />
      ) : done || !chord ? (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="os-pop flex h-20 w-20 items-center justify-center rounded-full bg-os-ok text-white">
            <Icon.Check size={44} />
          </div>
          <h2 className="font-os-serif text-4xl">{chord ? 'All checked' : 'Nothing to check yet'}</h2>
          <p className="max-w-md text-[1.15rem] text-os-muted">Each chord comes back on a schedule that stretches as you get it right.</p>
          <Button size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center gap-5 px-8 pt-4 text-center">
          <div className="text-[1.15rem] text-os-muted">Play this chord, from its name alone. Strum when your fingers are in place.</div>
          <div className="font-os-serif text-[6rem] font-semibold leading-none">{chord}</div>
          <div className="text-[1.25rem] text-os-muted">{sayChord(chord)}</div>
          {note && <div className="text-[1.2rem] text-os-hint-ink">{note}</div>}
          {shown ? (
            <ChordDiagram chord={chord} width={200} name={false} />
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                peeked.current = true;
                setShown(true);
              }}
            >
              Show me
            </Button>
          )}
        </div>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ ear

type EarQ = { kind: 'string'; string: StringNo } | { kind: 'colour'; chord: string };

function EarDrill({ onClose }: { onClose: () => void }) {
  const lessons = useGuitar((s) => s.lessons);
  const recordDrill = useGuitar((s) => s.recordDrill);
  const known = useKnownChords();
  const questions = useMemo<EarQ[]>(() => {
    const rnd = mulberry32(Date.now() % 100000);
    const out: EarQ[] = [];
    const colours = known.filter((c) => chordColour(c) !== 'other');
    const minor = lessons['a-minor']?.done === true && colours.some((c) => chordColour(c) === 'minor');
    for (let k = 0; k < 6; k++) {
      if (minor && k % 2 === 1) out.push({ kind: 'colour', chord: pick(colours, rnd) });
      else out.push({ kind: 'string', string: pick([6, 5, 4, 3, 2, 1] as StringNo[], rnd) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const [listenRun, setListenRun] = useState(0);
  const [phase, setPhase] = useState<'hear' | 'answer'>('hear');
  const q = questions[i];
  const { status, start } = useListening(q?.kind === 'string');
  usePracticeTimer(() => undefined);

  const hear = useCallback(() => {
    if (!q) return;
    void guitar.unlock().then(() => {
      if (q.kind === 'string') instrument.pluck(OPEN_MIDI[q.string], undefined, { string: q.string, velocity: 0.85, seconds: 2 });
      else playScore(parseScore({ line: `[${q.chord}]w`, tempo: 60 }), {});
    });
    setPhase('answer');
  }, [q]);

  useEffect(() => {
    setAnswered(null);
    setPhase('hear');
    const t = setTimeout(hear, 600);
    return () => clearTimeout(t);
  }, [i, hear, listenRun]);

  const next = useCallback(
    (ok: boolean) => {
      setAnswered(ok);
      recordDrill('ear', ok);
      if (ok) {
        setRight((r) => r + 1);
        instrument.chime();
      }
      setTimeout(() => {
        if (i + 1 >= questions.length) setFinished(true);
        else setI(i + 1);
      }, 1500);
    },
    [i, questions.length, recordDrill],
  );

  const stringScore = useMemo(() => (q?.kind === 'string' ? parseScore({ line: `${noteName(OPEN_MIDI[q.string])}w@${q.string}`, tempo: 60 }) : null), [q]);

  return (
    <Frame title="Ear" onClose={onClose} right={!finished ? <Pill>{i + 1} of {questions.length}</Pill> : undefined}>
      {finished ? (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
          <h2 className="font-os-serif text-5xl">
            {right} of {questions.length}
          </h2>
          <p className="max-w-md text-[1.15rem] text-os-muted">Your ear grows with every session, the same way your fingers do.</p>
          <Button size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : q.kind === 'string' ? (
        status.state !== 'listening' ? (
          <MicNeeded start={start} denied={status.state === 'denied'} />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-col items-center gap-3 px-8 pt-2 text-center">
              <div className={`text-[1.3rem] ${answered === null ? 'text-os-ink' : answered ? 'text-os-ok' : 'text-os-hint-ink'}`}>
                {answered === null ? 'Which open string was that? Play it back.' : answered ? `Yes, the ${STRING_NAME[q.string]} string.` : `It was the ${STRING_NAME[q.string]} string.`}
              </div>
              <div className="flex gap-3">
                <Button variant="soft" onClick={() => setListenRun((x) => x + 1)} icon={<Icon.Ear size={18} />}>
                  Hear it again
                </Button>
                <Button variant="ghost" onClick={() => next(false)}>
                  Show me
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {stringScore && phase === 'answer' && answered === null && (
                <PlaySurface
                  score={stringScore}
                  mode="wait"
                  display="hidden"
                  hints="never"
                  runId={`${i}-${listenRun}`}
                  onDone={(r) => {
                    if (r) next(r.wrongTries === 0);
                  }}
                />
              )}
            </div>
          </div>
        )
      ) : (
        <div className="flex h-full flex-col items-center gap-6 px-8 pt-6 text-center">
          <div className={`text-[1.3rem] ${answered === null ? 'text-os-ink' : answered ? 'text-os-ok' : 'text-os-hint-ink'}`}>
            {answered === null ? 'Major or minor?' : `${answered ? 'Right: ' : 'It was '}${sayChord(q.chord)}, ${chordColour(q.chord)}.`}
          </div>
          <Button variant="soft" onClick={() => setListenRun((x) => x + 1)} icon={<Icon.Ear size={18} />}>
            Hear it again
          </Button>
          <div className="flex gap-4">
            {(['major', 'minor'] as const).map((c) => (
              <button
                key={c}
                disabled={answered !== null}
                onClick={() => next(chordColour(q.chord) === c)}
                className="h-24 w-48 rounded-3xl border-2 border-os-line bg-os-surface text-[1.5rem] font-semibold"
              >
                {c === 'major' ? 'Major' : 'Minor'}
                <span className="block text-[1rem] font-normal text-os-muted">{c === 'major' ? 'bright' : 'thoughtful'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}

export default function Drill({ kind, onClose }: { kind: DrillKind; onClose: () => void }) {
  const logPractice = useGuitar((s) => s.logPractice);
  usePracticeTimer((seconds) => logPractice(seconds, 0, 1));
  if (kind === 'changes') return <ChangesDrill onClose={onClose} />;
  if (kind === 'rhythm') return <RhythmDrill onClose={onClose} />;
  if (kind === 'recall') return <RecallDrill onClose={onClose} />;
  return <EarDrill onClose={onClose} />;
}

export { DRILL_LABEL };
