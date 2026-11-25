'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument, playScore } from '@/lib/guitar/audio/instrument';
import { changeScore, getLesson, getSong, resolveMusic } from '@/lib/guitar/content/catalog';
import type { Step } from '@/lib/guitar/content/types';
import { Follower, notAttempted, type FollowEvent, type FollowResult } from '@/lib/guitar/engine/follow';
import { diagnose, tempoSummary, waitSummary } from '@/lib/guitar/learn/coach';
import { useGuitar } from '@/lib/guitar/learn/store';
import { playedStrings, sayChord, shapeFor, shapeNoteOn } from '@/lib/guitar/music/chords';
import { parseScore } from '@/lib/guitar/music/score';
import { OPEN_MIDI, STRING_NAME, noteLetter, noteName, sayLetter, type StringNo } from '@/lib/guitar/music/theory';
import { ChordDiagram, type StringMark } from './ChordDiagram';
import FigureView, { StringsFigure } from './Figures';
import { readingMs, useKnownChords, useListening, usePracticeTimer, useWakeLock } from './hooks';
import PlaySurface from './PlaySurface';
import Tuner from './Tuner';
import { Button, Icon, IconButton, Pill, ProgressBar, Prose } from './ui';

type StepOf<K extends Step['kind']> = Extract<Step, { kind: K }>;

function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-2xl border border-os-line">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-semibold text-os-muted" onClick={() => setOpen((o) => !o)}>
        <Icon.Info size={18} />
        Why it is taught this way
        <span className="ml-auto text-sm">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <p className="px-4 pb-4 text-[1rem] leading-relaxed text-os-muted">{text}</p>}
    </div>
  );
}

function TextStep({ title, children, onNext, nextLabel = 'Continue' }: { title?: string; children: ReactNode; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="os-scroll min-h-0 flex-1">
        <div className="os-fade-up mx-auto w-full max-w-2xl px-8 py-8">
          {title && <h2 className="mb-4 font-os-serif text-[2.2rem] leading-tight">{title}</h2>}
          {children}
        </div>
      </div>
      <div className="flex shrink-0 justify-center px-8 pb-6 pt-3">
        <Button size="lg" onClick={onNext} className="min-w-[240px]">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

/** The instruction line above anything played, with room for buttons. */
function Brief({ text, children, tone }: { text: string; children?: ReactNode; tone?: 'ok' | 'hint' }) {
  return (
    <div className="flex shrink-0 items-center gap-4 px-7 pb-1 pt-2">
      <div className={`min-w-0 flex-1 text-[1.25rem] leading-snug ${tone === 'ok' ? 'text-os-ok' : tone === 'hint' ? 'text-os-hint-ink' : 'text-os-ink'}`}>
        <Prose text={text} />
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function SayStep({ step, onNext }: { step: StepOf<'say'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} onNext={onNext}>
      <Prose text={step.text} className="text-[1.3rem] leading-relaxed text-os-muted" />
      {step.figure && (
        <div className="mt-6">
          <FigureView figure={step.figure} />
        </div>
      )}
      {step.why && <Why text={step.why} />}
    </TextStep>
  );
}

function CheckStep({ step, onNext }: { step: StepOf<'check'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} onNext={onNext} nextLabel="I am set">
      {step.text && <Prose text={step.text} className="mb-5 text-[1.3rem] leading-relaxed text-os-muted" />}
      <ul className="space-y-3">
        {step.items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-os-surface px-4 py-3.5 text-[1.2rem] leading-snug">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-os-ink/10 text-os-ink">
              <Icon.Check size={16} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </TextStep>
  );
}

function TuneStep({ step, onNext }: { step: StepOf<'tune'>; onNext: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={step.text} />
      <div className="os-scroll min-h-0 flex-1 px-7 pb-6 pt-2">
        <Tuner onDone={onNext} />
      </div>
    </div>
  );
}

function ListenStep({ step, onNext }: { step: StepOf<'listen'>; onNext: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const song = 'song' in step.music ? getSong(step.music.song) : null;
  const melody = useMemo(() => songMelody(song?.id ?? null, score), [score, song]);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const again = useCallback(() => {
    setDone(false);
    setRun((r) => r + 1);
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={step.text}>
        <Button variant="soft" size="sm" onClick={again} icon={<Icon.Repeat size={16} />}>
          Again
        </Button>
        <Button variant={done ? 'primary' : 'ghost'} size="sm" onClick={onNext} className={done ? 'os-pulse' : ''}>
          {done ? 'My turn' : 'Skip'}
        </Button>
      </Brief>
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          melody={melody}
          mode="listen"
          display={step.display ?? 'chart'}
          runId={run}
          onDone={() => setDone(true)}
          leadIn={run === 0 ? readingMs(step.text) : 350}
          lyrics={song?.lyrics}
        />
      </div>
    </div>
  );
}

/** The tune of a song, to play over its chords, when the passage played is the whole song. */
export function songMelody(songId: string | null, score: ReturnType<typeof resolveMusic>) {
  const song = songId ? getSong(songId) : null;
  if (!song?.melody || score.measureOffset !== 0 || score.measureCount !== resolveMusic({ song: song.id }).measureCount) return null;
  return parseScore({ line: song.melody, time: song.time, tempo: song.tempo, pickup: song.pickup });
}

function describe(result: FollowResult): string {
  if (result.mode === 'wait') {
    if (result.clean) return result.totalSteps === 1 ? 'That is the one.' : result.kind === 'strum' ? 'Every chord right the first time.' : 'Every note right the first time.';
    if (result.totalSteps === 1) return 'You found it on a later try.';
    return `${waitSummary(result)}.`;
  }
  return `${tempoSummary(result)}.`;
}

function PlayStep({ step, onNext }: { step: StepOf<'play'>; onNext: () => void }) {
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const song = 'song' in step.music ? getSong(step.music.song) : null;
  const mode = step.mode ?? 'wait';
  const need = step.passes ?? 1;
  const known = useKnownChords();
  const [run, setRun] = useState(0);
  const [have, setHave] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const again = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVerdict(null);
    setRun((r) => r + 1);
  }, []);
  const onDone = useCallback(
    (result: FollowResult | null) => {
      if (!result) return;
      if (notAttempted(result)) {
        again();
        return;
      }
      const ok =
        mode === 'wait'
          ? result.accuracy >= (score.kind === 'strum' ? 0.5 : 0.6) && result.hintedSteps <= Math.max(1, result.totalSteps * 0.5)
          : result.accuracy >= 0.7 && (result.chordsRight === null || result.chordsRight >= 0.5);
      const text = describe(result);
      if (ok) {
        const total = have + 1;
        setHave(total);
        if (total >= need) {
          setVerdict({ ok: true, text });
          instrument.chime();
          timer.current = setTimeout(onNext, 1900);
        } else {
          setVerdict({ ok: true, text: `${text} Once more to make it stick.` });
          timer.current = setTimeout(again, 1900);
        }
      } else {
        setHave(0);
        const found = diagnose(result);
        setVerdict({ ok: false, text: `${text} ${found ?? (mode === 'wait' ? 'Go slowly, and look at each shape before you play it.' : 'Try again, and keep the strumming hand going through any slip.')}` });
      }
    },
    [again, have, mode, need, onNext, score.kind],
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={verdict ? verdict.text : step.text} tone={verdict ? (verdict.ok ? 'ok' : 'hint') : undefined}>
        {need > 1 && (
          <Pill tone={have > 0 ? 'ok' : 'muted'}>
            {have} of {need}
          </Pill>
        )}
        {verdict && !verdict.ok ? (
          <>
            <Button variant="ghost" size="sm" onClick={onNext}>
              Move on
            </Button>
            <Button size="sm" onClick={again} icon={<Icon.Repeat size={16} />}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <IconButton label="Start again" onClick={again}>
              <Icon.Repeat size={20} />
            </IconButton>
            <Button variant="ghost" size="sm" onClick={onNext}>
              Skip
            </Button>
          </>
        )}
      </Brief>
      {step.why && !verdict && (
        <div className="px-7">
          <details className="text-[15px] text-os-muted">
            <summary className="cursor-pointer font-semibold">Why it is taught this way</summary>
            <p className="mt-1 max-w-3xl leading-relaxed">{step.why}</p>
          </details>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          mode={mode}
          tempoPct={step.tempoPct ?? 100}
          display={step.display ?? 'chart'}
          hints={step.hints ?? 'delay'}
          anyStrike={step.anyStrike}
          changesOnly={step.changesOnly}
          confusers={known}
          pattern={song?.strum ?? ('strum' in step.music ? step.music.strum : undefined)}
          runId={run}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

/** A chord checked one string at a time: the app says which strings rang. */
function StringsStep({ step, onNext }: { step: StepOf<'strings'>; onNext: () => void }) {
  const shape = useMemo(() => shapeFor(step.chord, step.variant), [step.chord, step.variant]);
  const strings = useMemo(() => playedStrings(shape), [shape]);
  const score = useMemo(() => parseScore({ line: strings.map((s) => `${noteName(shapeNoteOn(shape, s) as number)}q@${s}`).join(' '), time: [strings.length, 4] as [number, number], tempo: 60 }), [shape, strings]);
  const { status, start } = useListening(true);
  const [marks, setMarks] = useState<Partial<Record<StringNo, StringMark>>>({});
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [tries, setTries] = useState<Record<number, number>>({});
  const [result, setResult] = useState<'all' | 'some' | null>(null);
  const [run, setRun] = useState(0);
  const triesRef = useRef(tries);
  triesRef.current = tries;

  useEffect(() => {
    if (status.state !== 'listening') return;
    setMarks({ [strings[0]]: 'now' });
    setIndex(0);
    setNote(null);
    setResult(null);
    setTries({});
    const f = new Follower(score, { mode: 'wait', hintDelayMs: Infinity, hintAfterWrong: 99 });
    let missed = 0;
    const off = f.events.subscribe((ev: FollowEvent) => {
      const s = strings[ev.type === 'done' ? 0 : (ev as { index: number }).index] as StringNo;
      if (ev.type === 'step') {
        setIndex(ev.index);
        setMarks((m) => ({ ...m, [strings[ev.index]]: m[strings[ev.index]] === 'bad' ? 'bad' : 'now' }));
      } else if (ev.type === 'mark') {
        const bad = (triesRef.current[ev.index] ?? 0) > 0;
        if (bad) missed++;
        setMarks((m) => ({ ...m, [s]: bad ? 'bad' : 'ok' }));
        setNote(null);
      } else if (ev.type === 'unclear' || ev.type === 'wrong') {
        setTries((t) => ({ ...t, [ev.index]: (t[ev.index] ?? 0) + 1 }));
        setMarks((m) => ({ ...m, [s]: 'bad' }));
        const fret = shape.frets[6 - s] ?? 0;
        const finger = shape.fingers[6 - s];
        const want = sayLetter(noteLetter(shapeNoteOn(shape, s) as number));
        setNote(
          ev.type === 'unclear'
            ? fret === 0
              ? `The open ${STRING_NAME[s]} string did not ring. A finger is probably leaning on it. Arch your fingers a little more.`
              : `The ${STRING_NAME[s]} string did not ring clearly. Press with the tip of finger ${finger}, just behind the fret.`
            : ev.midi === undefined
              ? `Check the ${STRING_NAME[s]} string.`
              : fret === 0
                ? `That was ${sayLetter(noteLetter(ev.midi))}. The ${STRING_NAME[s]} string should ring open as ${want}, so check that no finger is pressing it.`
                : `That was ${sayLetter(noteLetter(ev.midi))}, not ${want}. Check that finger ${finger} is at fret ${fret} on the ${STRING_NAME[s]} string.`,
        );
      } else if (ev.type === 'done') {
        setResult(missed === 0 ? 'all' : 'some');
        if (missed === 0) instrument.chime();
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [run, score, shape, status.state, strings]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={result === 'all' ? `Every string rang. That is a clean ${sayChord(step.chord)}.` : result === 'some' ? 'Done. The red strings needed another try. They will ring more easily each day.' : (note ?? step.text)} tone={result === 'all' ? 'ok' : note || result === 'some' ? 'hint' : undefined}>
        {result ? (
          <>
            <Button variant="soft" size="sm" onClick={() => setRun((r) => r + 1)} icon={<Icon.Repeat size={16} />}>
              Again
            </Button>
            <Button size="sm" onClick={onNext}>
              Continue
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Skip
          </Button>
        )}
      </Brief>
      <div className="os-scroll min-h-0 flex-1 px-7 pb-6">
        {status.state !== 'listening' ? (
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={start} icon={<Icon.Mic size={20} />}>
              Start listening
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-2">
            <ChordDiagram shape={shape} width={260} strings={marks} />
            {!result && (
              <div className="text-[1.25rem] font-semibold">
                Now the {STRING_NAME[strings[index]]} string{shape.frets[6 - strings[index]] === 0 ? ', open' : ''}
              </div>
            )}
            {step.why && !result && <Why text={step.why} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Strings asked for by name. */
function FindStep({ step, onNext }: { step: StepOf<'find'>; onNext: () => void }) {
  const score = useMemo(() => parseScore({ line: step.strings.map((s) => `${noteName(OPEN_MIDI[s])}q@${s}`).join(' '), time: [step.strings.length, 4] as [number, number], tempo: 60 }), [step.strings]);
  const [run, setRun] = useState(0);
  const [at, setAt] = useState(0);
  const [done, setDone] = useState(false);
  const { status, start } = useListening(true);
  const [note, setNote] = useState<string | null>(null);
  const [hinted, setHinted] = useState(false);
  useEffect(() => {
    if (status.state !== 'listening') return;
    setAt(0);
    setDone(false);
    setNote(null);
    const f = new Follower(score, { mode: 'wait', hintDelayMs: 6000, hintAfterWrong: 2 });
    const off = f.events.subscribe((ev) => {
      if (ev.type === 'step') {
        setAt(ev.index);
        setHinted(false);
      } else if (ev.type === 'hint') setHinted(true);
      else if (ev.type === 'mark') setNote(null);
      else if (ev.type === 'wrong' && ev.midi !== undefined) {
        const s = ([6, 5, 4, 3, 2, 1] as StringNo[]).find((x) => OPEN_MIDI[x] === ev.midi);
        setNote(s ? `That was the ${STRING_NAME[s]} string.` : `That was ${sayLetter(noteLetter(ev.midi))}. Play the string open, with no fingers on it.`);
      } else if (ev.type === 'done') {
        setDone(true);
        instrument.chime();
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [run, score, status.state]);
  const s = step.strings[Math.min(at, step.strings.length - 1)];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={done ? 'Every string, found by name.' : (note ?? step.text)} tone={done ? 'ok' : note ? 'hint' : undefined}>
        {done ? (
          <Button size="sm" onClick={onNext}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Skip
          </Button>
        )}
      </Brief>
      <div className="os-scroll min-h-0 flex-1 px-7 pb-6">
        {status.state !== 'listening' ? (
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={start} icon={<Icon.Mic size={20} />}>
              Start listening
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 pt-4">
            {!done && (
              <div className="text-center">
                <div className="font-os-serif text-[3.4rem] font-semibold leading-none">The {STRING_NAME[s]} string</div>
                <div className="mt-2 text-[1.2rem] text-os-muted">string {s}</div>
              </div>
            )}
            <StringsFigure highlight={hinted || done ? (done ? undefined : [s]) : undefined} />
            {step.why && <Why text={step.why} />}
          </div>
        )}
      </div>
      <span className="hidden">{run}</span>
    </div>
  );
}

/** Hear a short pattern, then play it back. */
function EchoStep({ step, onNext }: { step: StepOf<'echo'>; onNext: () => void }) {
  const scores = useMemo(() => step.motifs.map((m) => parseScore({ line: m, tempo: 84 })), [step.motifs]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'play'>('listen');
  const [run, setRun] = useState(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [tries, setTries] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const hear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, []);
  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (index + 1 >= scores.length) {
      onNext();
      return;
    }
    setIndex((i) => i + 1);
    setTries(0);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, [index, onNext, scores.length]);
  const onDone = useCallback(
    (result: FollowResult | null) => {
      if (phase === 'listen') {
        timer.current = setTimeout(() => {
          setPhase('play');
          setRun((r) => r + 1);
        }, 400);
        return;
      }
      if (!result) return;
      if (result.wrongTries === 0 && result.hintedSteps === 0) {
        setNote({ ok: true, text: 'Exactly right.' });
        instrument.chime();
        timer.current = setTimeout(advance, 1500);
      } else {
        const t = tries + 1;
        setTries(t);
        setNote({ ok: false, text: t >= 2 ? 'Close. Listen once more, then on to the next.' : 'Not quite. Listen again.' });
        timer.current = setTimeout(t >= 2 ? advance : hear, 1800);
      }
    },
    [advance, hear, phase, tries],
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={note ? note.text : phase === 'listen' ? `${step.text} Listen.` : 'Now play it back.'} tone={note ? (note.ok ? 'ok' : 'hint') : undefined}>
        <Pill>
          {index + 1} of {scores.length}
        </Pill>
        <Button variant="soft" size="sm" onClick={hear} icon={<Icon.Ear size={16} />}>
          Hear again
        </Button>
        <Button variant="ghost" size="sm" onClick={onNext}>
          Skip
        </Button>
      </Brief>
      <div className="min-h-0 flex-1">
        <PlaySurface score={scores[index]} mode={phase === 'listen' ? 'listen' : 'wait'} display="hidden" hints="delay" hintMs={7000} runId={`${index}-${run}-${phase}`} onDone={onDone} leadIn={phase === 'listen' ? 500 : 0} />
      </div>
      {step.why && (
        <div className="px-7 pb-4">
          <Why text={step.why} />
        </div>
      )}
    </div>
  );
}

/** Back and forth between two chords, one strum each, with how quick the changes were. */
function ChangesStep({ step, onNext }: { step: StepOf<'changes'>; onNext: () => void }) {
  const score = useMemo(() => changeScore(step.from, step.to, step.times), [step.from, step.to, step.times]);
  const known = useKnownChords();
  const [run, setRun] = useState(0);
  const [current, setCurrent] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const { status, start } = useListening(true);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (status.state !== 'listening') return;
    setCurrent(0);
    setVerdict(null);
    setNote(null);
    const f = new Follower(score, { mode: 'wait', hintDelayMs: Infinity, hintAfterWrong: 99, confusers: known });
    const off = f.events.subscribe((ev) => {
      if (ev.type === 'step') setCurrent(ev.index);
      else if (ev.type === 'mark') setNote(null);
      else if (ev.type === 'wrong' && ev.heard) setNote(`That sounded like ${sayChord(ev.heard)}.`);
      else if (ev.type === 'unclear') setNote('Not every string rang. Settle the fingers, then strum again.');
      else if (ev.type === 'done') {
        const times = ev.result.changes.map((c) => c.seconds ?? 0).filter((x) => x > 0);
        const avg = times.length ? times.reduce((a, x) => a + x, 0) / times.length : 0;
        const best = times.length ? Math.min(...times) : 0;
        instrument.chime();
        setVerdict(
          avg > 0
            ? `Your changes took about ${avg.toFixed(1)} seconds each, the quickest ${best.toFixed(1)}. With practice they shrink toward a single beat.`
            : 'Done.',
        );
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [known, run, score, status.state]);
  const now = current % 2 === 0 ? step.from : step.to;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brief text={verdict ?? note ?? step.text} tone={verdict ? 'ok' : note ? 'hint' : undefined}>
        {!verdict && <Pill>{Math.max(0, current)} of {step.times} changes</Pill>}
        {verdict ? (
          <>
            <Button variant="soft" size="sm" onClick={() => setRun((r) => r + 1)} icon={<Icon.Repeat size={16} />}>
              Again
            </Button>
            <Button size="sm" onClick={onNext}>
              Continue
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Skip
          </Button>
        )}
      </Brief>
      <div className="os-scroll min-h-0 flex-1 px-7 pb-6">
        {status.state !== 'listening' ? (
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={start} icon={<Icon.Mic size={20} />}>
              Start listening
            </Button>
          </div>
        ) : (
          <div className="flex items-end justify-center gap-10 pt-4">
            {[step.from, step.to].map((c) => (
              <div key={c} className={`rounded-3xl p-3 transition-all ${c === now && !verdict ? 'bg-os-accent/10 ring-2 ring-os-accent' : 'opacity-50'}`}>
                <ChordDiagram chord={c} width={c === now ? 230 : 170} />
              </div>
            ))}
          </div>
        )}
        {step.why && <Why text={step.why} />}
      </div>
    </div>
  );
}

function QuizStep({ step, onNext }: { step: StepOf<'quiz'>; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const hear = useMemo(() => (step.hear ? resolveMusic(step.hear) : null), [step.hear]);
  const play = useCallback(() => {
    if (!hear) return;
    void guitar.unlock().then(() => playScore(hear, {}));
  }, [hear]);
  useEffect(() => {
    if (!hear) return;
    const t = setTimeout(play, 500);
    return () => clearTimeout(t);
  }, [hear, play]);
  const right = picked === step.answer;
  return (
    <TextStep title={step.question} onNext={onNext} nextLabel={picked === null ? 'Skip' : 'Continue'}>
      {step.figure && (
        <div className="mb-6">
          <FigureView figure={step.figure} />
        </div>
      )}
      {hear && (
        <Button variant="soft" className="mb-6" onClick={play} icon={<Icon.Ear size={18} />}>
          Hear it again
        </Button>
      )}
      <div className="space-y-3">
        {step.choices.map((c, i) => {
          const chosen = picked === i;
          const show = picked !== null && (i === step.answer || chosen);
          return (
            <button
              key={i}
              disabled={picked !== null}
              onClick={() => {
                setPicked(i);
                if (i === step.answer) instrument.chime();
              }}
              className={`flex w-full items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-[1.25rem] font-medium transition-colors ${
                show ? (i === step.answer ? 'border-os-ok bg-os-ok/10' : 'border-os-bad bg-os-bad/10') : 'border-os-line bg-os-surface'
              }`}
            >
              {c}
              {show && i === step.answer && <Icon.Check size={24} />}
            </button>
          );
        })}
      </div>
      {picked !== null && step.explain && <p className={`mt-5 text-[1.2rem] leading-relaxed ${right ? 'text-os-ok' : 'text-os-muted'}`}>{right ? `Right. ${step.explain}` : step.explain}</p>}
    </TextStep>
  );
}

export default function LessonPlayer({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const lesson = getLesson(lessonId);
  const progress = useGuitar((s) => s.lessons[lessonId]);
  const setLessonStep = useGuitar((s) => s.setLessonStep);
  const completeLesson = useGuitar((s) => s.completeLesson);
  const addCards = useGuitar((s) => s.addCards);
  const logPractice = useGuitar((s) => s.logPractice);
  const [index, setIndex] = useState(() => Math.min(progress?.done ? 0 : (progress?.step ?? 0), lesson.steps.length - 1));
  const [finished, setFinished] = useState(false);
  useWakeLock(true);
  usePracticeTimer((seconds) => logPractice(seconds, 0, 1));
  const step = lesson.steps[index];
  const next = useCallback(() => {
    if (index + 1 >= lesson.steps.length) {
      completeLesson(lessonId);
      if (lesson.chords) addCards(lesson.chords.map((c) => `chord:${c}`));
      instrument.chime();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setLessonStep(lessonId, index + 1);
  }, [addCards, completeLesson, index, lesson, lessonId, setLessonStep]);
  const back = () => index > 0 && setIndex(index - 1);

  let body: JSX.Element;
  if (finished) {
    const songs = (lesson.songs ?? []).map((id) => getSong(id).title);
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="os-pop flex h-20 w-20 items-center justify-center rounded-full bg-os-ok text-white">
          <Icon.Check size={44} />
        </div>
        <div className="os-fade-up">
          <div className="text-sm font-semibold uppercase tracking-widest text-os-muted">Lesson done</div>
          <h2 className="mt-2 font-os-serif text-5xl">{lesson.title}</h2>
          {(lesson.chords?.length || songs.length > 0) && (
            <p className="mx-auto mt-4 max-w-xl text-[1.25rem] leading-relaxed text-os-muted">
              {lesson.chords?.length ? `New ${lesson.chords.length === 1 ? 'chord' : 'chords'}: ${lesson.chords.join(', ')}. ` : ''}
              {songs.length ? `${songs.join(' and ')} ${songs.length === 1 ? 'has' : 'have'} joined your songs.` : ''}
            </p>
          )}
        </div>
        <Button size="lg" onClick={onClose} className="min-w-[240px]">
          Finish
        </Button>
      </div>
    );
  } else {
    switch (step.kind) {
      case 'say':
        body = <SayStep key={index} step={step} onNext={next} />;
        break;
      case 'check':
        body = <CheckStep key={index} step={step} onNext={next} />;
        break;
      case 'tune':
        body = <TuneStep key={index} step={step} onNext={next} />;
        break;
      case 'listen':
        body = <ListenStep key={index} step={step} onNext={next} />;
        break;
      case 'play':
        body = <PlayStep key={index} step={step} onNext={next} />;
        break;
      case 'strings':
        body = <StringsStep key={index} step={step} onNext={next} />;
        break;
      case 'find':
        body = <FindStep key={index} step={step} onNext={next} />;
        break;
      case 'echo':
        body = <EchoStep key={index} step={step} onNext={next} />;
        break;
      case 'changes':
        body = <ChangesStep key={index} step={step} onNext={next} />;
        break;
      case 'quiz':
        body = <QuizStep key={index} step={step} onNext={next} />;
        break;
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-3 px-4">
        <IconButton label="Close" onClick={onClose}>
          <Icon.Close />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="truncate font-os-serif text-[1.3rem]">{lesson.title}</div>
          <ProgressBar value={finished ? 1 : index / lesson.steps.length} tone="ok" className="mt-1 max-w-sm" />
        </div>
        {!finished && index > 0 && (
          <Button variant="ghost" size="sm" onClick={back} icon={<Icon.Left size={16} />}>
            Back
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
