'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { instrument, playScore } from '@/lib/guitar/audio/instrument';
import { changeScore, getLesson, getSong, resolveMusic } from '@/lib/guitar/content/catalog';
import type { Step } from '@/lib/guitar/content/types';
import { Follower, notAttempted, type FollowEvent, type FollowResult } from '@/lib/guitar/engine/follow';
import { diagnose, tempoSummary, waitSummary } from '@/lib/guitar/learn/coach';
import { useGuitar } from '@/lib/guitar/learn/store';
import { playedStrings, sayChord, shapeFor, shapeNoteOn } from '@/lib/guitar/music/chords';
import { chordsUsed, parseScore } from '@/lib/guitar/music/score';
import { OPEN_MIDI, STRING_NAME, noteLetter, noteName, sayLetter, type StringNo } from '@/lib/guitar/music/theory';
import { ChordDiagram, type StringMark } from './ChordDiagram';
import FigureView, { StringsFigure } from './Figures';
import { readingMs, useListenStatus, useListening, usePracticeTimer, useWakeLock } from './hooks';
import PlaySurface from './PlaySurface';
import { ActionBar, StageMessage, useFocus, useSpoken, type PrimaryAction } from './Stage';
import Tuner from './Tuner';
import { Button, Icon, IconButton, Pill, Prose } from './ui';

type StepOf<K extends Step['kind']> = Extract<Step, { kind: K }>;

/** The way back to the step before, for whichever step is showing. */
const BackContext = createContext<(() => void) | null>(null);
const useBack = () => useContext(BackContext);

/** Seconds to leave a line on the screen before moving on by itself. */
function readSeconds(text: string): number {
  return Math.min(9, Math.max(3, 2 + text.length * 0.05));
}

function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 w-full max-w-2xl rounded-2xl border border-os-line">
      <button className="flex h-14 w-full items-center gap-2 px-4 text-left text-[1.1rem] font-semibold text-os-muted" onClick={() => setOpen((o) => !o)}>
        <Icon.Info size={20} />
        Why it is taught this way
        <span className="ml-auto text-base">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <p className="px-4 pb-4 text-[1.2rem] leading-relaxed text-os-muted">{text}</p>}
    </div>
  );
}

/** The kinds of step that are played, not read or heard. A lesson counts as taken when at least one of them was played through. */
const PLAYING = new Set(['play', 'strings', 'find', 'echo', 'changes']);

/** Start listening, when the browser needs a tap for it. Inside the iPad app it starts by itself. */
function MicStart({ start }: { start: () => void }) {
  const status = useListenStatus();
  if (status.state === 'denied' || status.state === 'error')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <Icon.Mic size={34} />
        <p className="os-say max-w-2xl">
          {status.state === 'denied'
            ? "The microphone is switched off for this app, so it cannot hear your guitar. Turn it on in the iPad's Settings, under Privacy and Security, Microphone, then come back."
            : `The microphone could not start. ${status.error ?? ''}`}
        </p>
        {status.state === 'error' && (
          <Button size="xl" onClick={start} icon={<Icon.Mic size={24} />}>
            Try again
          </Button>
        )}
      </div>
    );
  return (
    <div className="flex h-full items-center justify-center">
      <Button size="xl" onClick={start} icon={<Icon.Mic size={24} />}>
        {status.state === 'starting' ? 'Starting' : 'Start listening'}
      </Button>
    </div>
  );
}

/** A page to read: words on one side, a picture on the other where there is one. */
function TextStep({ title, children, figure, primary, skip, extras, say }: { title?: string; children: ReactNode; figure?: ReactNode; primary: PrimaryAction | null; skip?: { label: string; onClick: () => void } | null; extras?: Array<{ label: string; onClick: () => void; icon?: ReactNode }>; say?: string }) {
  const back = useBack();
  useSpoken(say);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="os-scroll min-h-0 flex-1">
        <div className="flex min-h-full items-center">
          <div className={`os-fade-up mx-auto grid w-full items-center gap-x-10 gap-y-6 px-8 py-5 ${figure ? 'max-w-6xl landscape:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'max-w-4xl'}`}>
            <div>
              {title && <h2 className="mb-4 font-os-serif text-[2.7rem] leading-tight">{title}</h2>}
              {children}
            </div>
            {figure && <div className="flex w-full justify-center">{figure}</div>}
          </div>
        </div>
      </div>
      <ActionBar back={back} extras={extras} skip={skip} primary={primary} />
    </div>
  );
}

function SayStep({ step, onNext }: { step: StepOf<'say'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} primary={{ label: 'Continue', onClick: onNext }} figure={step.figure ? <FigureView figure={step.figure} large /> : undefined} say={`${step.title ? `${step.title}. ` : ''}${step.text}`}>
      <Prose text={step.text} className="os-say" />
      {step.why && <Why text={step.why} />}
    </TextStep>
  );
}

function CheckStep({ step, onNext }: { step: StepOf<'check'>; onNext: () => void }) {
  return (
    <TextStep title={step.title} primary={{ label: 'I am set', onClick: onNext }} say={`${step.title ? `${step.title}. ` : ''}${step.text ?? ''} ${step.items.join(' ')}`}>
      {step.text && <Prose text={step.text} className="os-say mb-5" />}
      <ul className="space-y-3">
        {step.items.map((item, i) => (
          <li key={i} className="flex items-start gap-4 rounded-2xl bg-os-surface px-5 py-4 text-[1.45rem] leading-snug">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-os-ink/10 text-os-ink">
              <Icon.Check size={18} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </TextStep>
  );
}

function TuneStep({ step, onNext }: { step: StepOf<'tune'>; onNext: () => void }) {
  const back = useBack();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StageMessage text={step.text} />
      <div className="os-scroll min-h-0 flex-1 px-7 pb-2 pt-1">
        <div className="flex min-h-full flex-col justify-center">
          <Tuner onDone={onNext} bar />
        </div>
      </div>
      <ActionBar back={back} primary={{ label: 'It is in tune', onClick: onNext, quiet: true }} />
    </div>
  );
}

function ListenStep({ step, onNext }: { step: StepOf<'listen'>; onNext: () => void }) {
  const back = useBack();
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
      <StageMessage text={step.text} />
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
      {/* Once it has played, the lesson goes on by itself. Hands can stay on the guitar. */}
      <ActionBar back={back} extras={[{ label: 'Hear it', onClick: again, icon: <Icon.Ear size={20} /> }]} skip={done ? null : { label: 'Skip', onClick: onNext }} primary={done ? { label: 'My turn', onClick: onNext, auto: 3 } : null} />
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
    if (result.totalSteps === 1) return result.accuracy > 0 ? 'You found it on a later try.' : 'Not quite yet.';
    return `${waitSummary(result)}.`;
  }
  return `${tempoSummary(result)}.`;
}

function PlayStep({ step, onNext, onPass }: { step: StepOf<'play'>; onNext: () => void; onPass: () => void }) {
  const back = useBack();
  const score = useMemo(() => resolveMusic(step.music), [step.music]);
  const song = 'song' in step.music ? getSong(step.music.song) : null;
  const mode = step.mode ?? 'wait';
  const need = step.passes ?? 1;
  const [run, setRun] = useState(0);
  const [have, setHave] = useState(0);
  const [fails, setFails] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string; more: boolean } | null>(null);
  const [gate, setGate] = useState<(() => void) | null>(null);
  const onGate = useCallback((start: (() => void) | null) => setGate(() => start), []);
  const again = useCallback(() => {
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
        setFails(0);
        instrument.chime();
        if (total >= need) onPass();
        setVerdict(total >= need ? { ok: true, text, more: false } : { ok: true, text: `${text} Once more to make it stick.`, more: true });
      } else {
        setHave(0);
        setFails((n) => n + 1);
        const found = diagnose(result);
        setVerdict({ ok: false, more: false, text: `${text} ${found ?? (mode === 'wait' ? 'Go slowly, and look at each shape before you play it.' : 'Try again, and keep the strumming hand going through any slip.')}` });
      }
    },
    [again, have, mode, need, onPass, score.kind],
  );
  // Whatever happens next can happen without a touch: a pass moves on, and a miss sets up another try.
  const stuck = verdict !== null && !verdict.ok && fails >= 2;
  const primary: PrimaryAction | null = verdict
    ? verdict.ok
      ? verdict.more
        ? { label: 'Once more', onClick: again, auto: readSeconds(verdict.text) }
        : { label: 'Continue', onClick: onNext, auto: Math.min(4, readSeconds(verdict.text)) }
      : stuck
        ? { label: 'Move on', onClick: onNext }
        : { label: 'Try again', onClick: again, auto: readSeconds(verdict.text) }
    : gate
      ? { label: 'Start', onClick: gate, icon: <Icon.Play size={22} />, hint: 'or strum once' }
      : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StageMessage
        text={verdict ? verdict.text : step.text}
        sub={stuck ? 'It will come. Move on for now, and open this lesson again another day to try it fresh.' : null}
        tone={verdict ? (verdict.ok ? 'ok' : 'hint') : undefined}
        right={
          need > 1 ? (
            <Pill tone={have > 0 ? 'ok' : 'muted'}>
              <span className="px-1 text-base">
                {have} of {need}
              </span>
            </Pill>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1">
        <PlaySurface
          score={score}
          mode={mode}
          tempoPct={step.tempoPct ?? 100}
          display={step.display ?? 'chart'}
          hints={step.hints ?? 'delay'}
          anyStrike={step.anyStrike}
          changesOnly={step.changesOnly}
          confusers={chordsUsed(score)}
          pattern={song?.strum ?? ('strum' in step.music ? step.music.strum : undefined)}
          runId={run}
          onDone={onDone}
          onGate={onGate}
          held={verdict !== null}
        />
      </div>
      <ActionBar
        back={back}
        again={stuck ? { label: 'Try again', onClick: again } : verdict && !verdict.ok ? null : { label: 'Again', onClick: again }}
        skip={verdict?.ok || stuck ? null : { label: verdict ? 'Move on' : 'Skip', onClick: onNext }}
        primary={primary}
        retry={verdict && !verdict.ok ? again : null}
      />
    </div>
  );
}

/** A chord checked one string at a time: the app says which strings rang. */
function StringsStep({ step, onNext, onPass }: { step: StepOf<'strings'>; onNext: () => void; onPass: () => void }) {
  const passed = useRef(onPass);
  passed.current = onPass;
  const back = useBack();
  const shape = useMemo(() => shapeFor(step.chord, step.variant), [step.chord, step.variant]);
  const strings = useMemo(() => playedStrings(shape), [shape]);
  const score = useMemo(() => parseScore({ line: strings.map((s) => `${noteName(shapeNoteOn(shape, s) as number)}q@${s}`).join(' '), time: [strings.length, 4] as [number, number], tempo: 60 }), [shape, strings]);
  const { status, start, ask } = useListening(true);
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
    triesRef.current = {};
    // A string that will not ring is left after three tries, marked for another day, so the check always finishes.
    const f = new Follower(score, { mode: 'wait', hintDelayMs: Infinity, hintAfterWrong: 99, giveAfter: 3 });
    let missed = 0;
    const off = f.events.subscribe((ev: FollowEvent) => {
      if (ev.type !== 'step' && ev.type !== 'mark' && ev.type !== 'unclear' && ev.type !== 'wrong' && ev.type !== 'done') return;
      const s = strings[ev.type === 'done' ? 0 : ev.index] as StringNo;
      if (ev.type === 'step') {
        setIndex(ev.index);
        setMarks((m) => ({ ...m, [strings[ev.index]]: m[strings[ev.index]] === 'bad' ? 'bad' : 'now' }));
      } else if (ev.type === 'mark') {
        const bad = (triesRef.current[ev.index] ?? 0) > 0;
        if (bad) missed++;
        setMarks((m) => ({ ...m, [s]: bad ? 'bad' : 'ok' }));
        setNote(null);
      } else if (ev.type === 'unclear' || ev.type === 'wrong') {
        triesRef.current = { ...triesRef.current, [ev.index]: (triesRef.current[ev.index] ?? 0) + 1 };
        setTries(triesRef.current);
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
        passed.current();
        if (missed === 0) instrument.chime();
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [run, score, shape, status.state, strings]);

  const message = result === 'all' ? `Every string rang. That is a clean ${sayChord(step.chord)}.` : result === 'some' ? 'Done. The red strings needed another try. They will ring more easily each day.' : (note ?? step.text);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StageMessage text={message} tone={result === 'all' ? 'ok' : note || result === 'some' ? 'hint' : undefined} />
      <div className="os-scroll min-h-0 flex-1 px-7 pb-2">
        {ask ? (
          <MicStart start={start} />
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center gap-2">
            <div className="grid items-center gap-x-10 gap-y-2 landscape:grid-cols-[auto_minmax(0,22rem)]">
              <ChordDiagram shape={shape} width={320} strings={marks} />
              <div className="text-center landscape:text-left">
                {!result && (
                  <>
                    <div className="text-[1.2rem] font-semibold uppercase tracking-widest text-os-muted">Now pick</div>
                    <div className="font-os-serif text-[3.2rem] font-semibold leading-tight">The {STRING_NAME[strings[index]]} string</div>
                    <div className="text-[1.5rem] text-os-muted">
                      string {strings[index]}
                      {shape.frets[6 - strings[index]] === 0 ? ', open' : ''}
                    </div>
                  </>
                )}
                {step.why && !result && <Why text={step.why} />}
              </div>
            </div>
          </div>
        )}
      </div>
      <ActionBar
        back={back}
        again={result ? { label: 'Again', onClick: () => setRun((r) => r + 1) } : null}
        skip={result ? null : { label: 'Skip', onClick: onNext }}
        primary={result ? { label: 'Continue', onClick: onNext, auto: result === 'all' ? 3 : readSeconds(message) } : null}
      />
    </div>
  );
}

/** Strings asked for by name. */
function FindStep({ step, onNext, onPass }: { step: StepOf<'find'>; onNext: () => void; onPass: () => void }) {
  const passed = useRef(onPass);
  passed.current = onPass;
  const back = useBack();
  const score = useMemo(() => parseScore({ line: step.strings.map((s) => `${noteName(OPEN_MIDI[s])}q@${s}`).join(' '), time: [step.strings.length, 4] as [number, number], tempo: 60 }), [step.strings]);
  const [run, setRun] = useState(0);
  const [at, setAt] = useState(0);
  const [done, setDone] = useState(false);
  const { status, start, ask } = useListening(true);
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
        passed.current();
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
      <StageMessage text={done ? 'Every string, found by name.' : (note ?? step.text)} tone={done ? 'ok' : note ? 'hint' : undefined} />
      <div className="os-scroll min-h-0 flex-1 px-7 pb-2">
        {ask ? (
          <MicStart start={start} />
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center gap-3">
            {!done && (
              <div className="text-center">
                <div className="font-os-serif text-[4.2rem] font-semibold leading-none">The {STRING_NAME[s]} string</div>
                <div className="mt-2 text-[1.5rem] text-os-muted">string {s}</div>
              </div>
            )}
            <StringsFigure highlight={hinted || done ? (done ? undefined : [s]) : undefined} />
            {step.why && !done && <Why text={step.why} />}
          </div>
        )}
      </div>
      <ActionBar back={back} again={done ? { label: 'Again', onClick: () => setRun((r) => r + 1) } : null} skip={done ? null : { label: 'Skip', onClick: onNext }} primary={done ? { label: 'Continue', onClick: onNext, auto: 3 } : null} />
    </div>
  );
}

/** Hear a short pattern, then play it back. */
function EchoStep({ step, onNext, onPass }: { step: StepOf<'echo'>; onNext: () => void; onPass: () => void }) {
  const back = useBack();
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
      onPass();
      onNext();
      return;
    }
    setIndex((i) => i + 1);
    setTries(0);
    setNote(null);
    setPhase('listen');
    setRun((r) => r + 1);
  }, [index, onNext, onPass, scores.length]);
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
  const listening = phase === 'listen' && !note;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StageMessage text={step.text} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-7">
        {/* Whose turn it is, large enough to know without reading. */}
        <div key={`${phase}-${note?.text ?? ''}`} className="os-fade-up flex flex-col items-center gap-3 text-center">
          <span className={`flex h-36 w-36 items-center justify-center rounded-full ${note ? (note.ok ? 'bg-os-ok text-white' : 'bg-os-hint text-white') : listening ? 'bg-os-raised text-os-ink' : 'os-pulse bg-os-accent text-white'}`}>
            {note ? note.ok ? <Icon.Check size={76} /> : <Icon.Repeat size={68} /> : listening ? <Icon.Ear size={72} /> : <Icon.Guitar size={76} />}
          </span>
          <div className="font-os-serif text-[3.4rem] font-semibold leading-tight">{note ? note.text : listening ? 'Listen' : 'Your turn'}</div>
        </div>
        <div className="flex items-center gap-3" aria-label={`${index + 1} of ${scores.length}`}>
          {scores.map((_, i) => (
            <span key={i} className={`h-5 rounded-full ${i < index ? 'w-5 bg-os-ok' : i === index ? 'w-12 bg-os-ink' : 'w-5 bg-os-line'}`} />
          ))}
        </div>
        <div className="h-16 w-full">
          <PlaySurface score={scores[index]} mode={phase === 'listen' ? 'listen' : 'wait'} display="hidden" hints="delay" hintMs={7000} runId={`${index}-${run}-${phase}`} onDone={onDone} leadIn={phase === 'listen' ? 500 : 0} />
        </div>
        {step.why && <Why text={step.why} />}
      </div>
      <ActionBar back={back} extras={[{ label: 'Hear it', onClick: hear, icon: <Icon.Ear size={20} /> }]} skip={{ label: 'Skip', onClick: onNext }} retry={hear} />
    </div>
  );
}

/** Back and forth between two chords, one strum each, with how quick the changes were. */
function ChangesStep({ step, onNext, onPass }: { step: StepOf<'changes'>; onNext: () => void; onPass: () => void }) {
  const passed = useRef(onPass);
  passed.current = onPass;
  const back = useBack();
  const score = useMemo(() => changeScore(step.from, step.to, step.times), [step.from, step.to, step.times]);
  const [run, setRun] = useState(0);
  const [current, setCurrent] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const { status, start, ask } = useListening(true);
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (status.state !== 'listening') return;
    setCurrent(0);
    setVerdict(null);
    setNote(null);
    // Back and forth between two chords: the chord just left is the slip to listen for, and the follower knows it.
    const f = new Follower(score, { mode: 'wait', hintDelayMs: Infinity, hintAfterWrong: 99, giveAfter: 3 });
    const off = f.events.subscribe((ev) => {
      if (ev.type === 'step') setCurrent(ev.index);
      else if (ev.type === 'mark') {
        setNote(null);
        setFlash((n) => n + 1);
      } else if (ev.type === 'wrong' && ev.heard) setNote(`That sounded like ${sayChord(ev.heard)}.`);
      else if (ev.type === 'unclear') setNote('Not every string rang. Settle the fingers, then strum again.');
      else if (ev.type === 'done') {
        const times = ev.result.changes.map((c) => c.seconds ?? 0).filter((x) => x > 0);
        const avg = times.length ? times.reduce((a, x) => a + x, 0) / times.length : 0;
        const best = times.length ? Math.min(...times) : 0;
        passed.current();
        instrument.chime();
        setVerdict(avg > 0 ? `Your changes took about ${avg.toFixed(1)} seconds each, the quickest ${best.toFixed(1)}. With practice they shrink toward a single beat.` : 'Done.');
      }
    });
    f.start();
    return () => {
      off();
      f.stop();
    };
  }, [run, score, status.state]);
  const now = current % 2 === 0 ? step.from : step.to;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StageMessage
        text={verdict ?? note ?? step.text}
        tone={verdict ? 'ok' : note ? 'hint' : undefined}
        right={
          !verdict ? (
            <span className="whitespace-nowrap rounded-full bg-os-raised px-4 py-2 text-[1.3rem] font-semibold tabular-nums">
              {Math.max(0, current)} of {step.times}
            </span>
          ) : undefined
        }
      />
      <div className="os-scroll min-h-0 flex-1 px-7 pb-2">
        {ask ? (
          <MicStart start={start} />
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center">
            <div className="flex items-end justify-center gap-10">
              {[step.from, step.to].map((c) => {
                const live = c === now && !verdict;
                return (
                  <div key={live ? `${c}-${flash}` : c} className={`flex flex-col items-center rounded-[2rem] px-4 pb-2 pt-1 transition-opacity ${live ? 'os-flash-ok bg-os-accent/10 ring-4 ring-os-accent' : 'opacity-45'}`}>
                    <div className={`font-os-serif font-semibold leading-none ${live ? 'text-[5.5rem]' : 'text-[3.5rem]'}`}>{c}</div>
                    <ChordDiagram chord={c} width={live ? 280 : 190} name={false} />
                  </div>
                );
              })}
            </div>
            {step.why && <Why text={step.why} />}
          </div>
        )}
      </div>
      <ActionBar
        back={back}
        again={verdict ? { label: 'Again', onClick: () => setRun((r) => r + 1) } : null}
        skip={verdict ? null : { label: 'Skip', onClick: onNext }}
        primary={verdict ? { label: 'Continue', onClick: onNext, auto: readSeconds(verdict) } : null}
      />
    </div>
  );
}

function QuizStep({ step, onNext }: { step: StepOf<'quiz'>; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const hear = useMemo(() => (step.hear ? resolveMusic(step.hear) : null), [step.hear]);
  const stopHear = useRef<(() => void) | null>(null);
  const play = useCallback(() => {
    if (!hear) return;
    stopHear.current?.();
    let cancelled = false;
    stopHear.current = () => {
      cancelled = true;
    };
    void guitar.unlock().then(() => {
      if (cancelled) return;
      stopHear.current = playScore(hear, {});
    });
  }, [hear]);
  useEffect(() => {
    if (!hear) return;
    const t = setTimeout(play, 500);
    return () => {
      clearTimeout(t);
      // The example stops when the lesson moves on.
      stopHear.current?.();
      stopHear.current = null;
    };
  }, [hear, play]);
  const right = picked === step.answer;
  return (
    <TextStep
      title={step.question}
      skip={picked === null ? { label: 'Skip', onClick: onNext } : null}
      primary={picked === null ? null : { label: 'Continue', onClick: onNext, auto: right ? 4 : undefined }}
      extras={hear ? [{ label: 'Hear it', onClick: play, icon: <Icon.Ear size={20} /> }] : undefined}
      figure={step.figure ? <FigureView figure={step.figure} large /> : undefined}
      say={step.question}
    >
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
              className={`flex min-h-[5rem] w-full items-center justify-between rounded-2xl border-2 px-6 py-4 text-left text-[1.6rem] font-medium transition-colors ${
                show ? (i === step.answer ? 'border-os-ok bg-os-ok/15' : 'border-os-bad bg-os-bad/10') : 'border-os-line bg-os-surface'
              }`}
            >
              {c}
              {show && i === step.answer && <Icon.Check size={30} />}
            </button>
          );
        })}
      </div>
      {picked !== null && step.explain && <p className={`mt-5 text-[1.5rem] leading-relaxed ${right ? 'text-os-ok-ink' : 'text-os-ink'}`}>{right ? `Right. ${step.explain}` : step.explain}</p>}
    </TextStep>
  );
}

export default function LessonPlayer({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const lesson = getLesson(lessonId);
  const progress = useGuitar((s) => s.lessons[lessonId]);
  const setLessonStep = useGuitar((s) => s.setLessonStep);
  const completeLesson = useGuitar((s) => s.completeLesson);
  const passLessonStep = useGuitar((s) => s.passLessonStep);
  const addCards = useGuitar((s) => s.addCards);
  const logPractice = useGuitar((s) => s.logPractice);
  const [index, setIndex] = useState(() => Math.min(progress?.done ? 0 : (progress?.step ?? 0), lesson.steps.length - 1));
  const [finished, setFinished] = useState(false);
  const away = useFocus();
  useWakeLock(true);
  // The microphone is held for the whole lesson, not opened and closed at each step. It still steps aside for every example.
  useListening(true);
  usePracticeTimer((seconds, first) => logPractice(seconds, 0, first ? 1 : 0));
  const step = lesson.steps[index];
  const goTo = useCallback(
    (i: number) => {
      setFinished(false);
      setIndex(i);
      setLessonStep(lessonId, i);
    },
    [lessonId, setLessonStep],
  );
  const onPass = useCallback(() => passLessonStep(lessonId, index), [index, lessonId, passLessonStep]);
  const next = useCallback(() => {
    if (index + 1 >= lesson.steps.length) {
      // A lesson is taken by playing it. One whose playing was all skipped, or jumped past, is kept as known:
      // done, but with no date, no chords put into review, and nothing said to have been learned today.
      const playing = lesson.steps.map((st, i) => (PLAYING.has(st.kind) ? i : -1)).filter((i) => i >= 0);
      const passed = useGuitar.getState().lessons[lessonId]?.passed ?? [];
      const taken = playing.length === 0 || playing.some((i) => passed.includes(i));
      completeLesson(lessonId, taken);
      if (taken) {
        if (lesson.chords) addCards(lesson.chords.map((c) => `chord:${c}`));
        instrument.chime();
      }
      setFinished(true);
      return;
    }
    goTo(index + 1);
  }, [addCards, completeLesson, goTo, index, lesson, lessonId]);
  const known = progress?.skipped === true;
  const back = useMemo(() => (index > 0 && !finished ? () => goTo(index - 1) : null), [finished, goTo, index]);

  let body: JSX.Element;
  if (finished) {
    const songs = (lesson.songs ?? []).map((id) => getSong(id).title);
    body = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="os-pop flex h-24 w-24 items-center justify-center rounded-full bg-os-ok text-white">
            <Icon.Check size={54} />
          </div>
          <div className="os-fade-up">
            <div className="text-[1.15rem] font-semibold uppercase tracking-widest text-os-muted">{known ? 'Kept as known' : 'Lesson done'}</div>
            <h2 className="mt-2 font-os-serif text-[3.4rem] leading-tight">{lesson.title}</h2>
            {known && <p className="os-say mx-auto mt-4 max-w-2xl">The playing in this lesson was passed over, so it is kept as one you already know. Open it again any time to play it through.</p>}
            {!known && (lesson.chords?.length || songs.length > 0) && (
              <p className="os-say mx-auto mt-4 max-w-2xl">
                {lesson.chords?.length ? `New ${lesson.chords.length === 1 ? 'chord' : 'chords'}: ${lesson.chords.join(', ')}. ` : ''}
                {songs.length ? `${songs.join(' and ')} ${songs.length === 1 ? 'has' : 'have'} joined your songs.` : ''}
              </p>
            )}
          </div>
        </div>
        <ActionBar primary={{ label: 'Finish', onClick: onClose, auto: 8 }} />
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
        body = <PlayStep key={index} step={step} onNext={next} onPass={onPass} />;
        break;
      case 'strings':
        body = <StringsStep key={index} step={step} onNext={next} onPass={onPass} />;
        break;
      case 'find':
        body = <FindStep key={index} step={step} onNext={next} onPass={onPass} />;
        break;
      case 'echo':
        body = <EchoStep key={index} step={step} onNext={next} onPass={onPass} />;
        break;
      case 'changes':
        body = <ChangesStep key={index} step={step} onNext={next} onPass={onPass} />;
        break;
      case 'quiz':
        body = <QuizStep key={index} step={step} onNext={next} />;
        break;
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        <IconButton label="Close" onClick={onClose} className="h-14 w-14">
          <Icon.Close size={26} />
        </IconButton>
        <div className={`flex min-w-0 flex-1 items-center gap-5 transition-opacity duration-300 ${away ? 'pointer-events-none opacity-0' : ''}`}>
          <div className="min-w-0 shrink truncate font-os-serif text-[1.5rem]">{lesson.title}</div>
          {/* Every step of the lesson. Any of them can be gone to with a tap, forward or back. */}
          <nav className="flex shrink-0 items-center" aria-label="Steps of this lesson">
            {lesson.steps.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} aria-label={`Step ${i + 1} of ${lesson.steps.length}`} aria-current={i === index && !finished ? 'step' : undefined} className="flex h-12 items-center px-[3px]">
                <span className={`block h-3 rounded-full transition-all ${finished || i < index ? 'w-6 bg-os-ok' : i === index ? 'w-11 bg-os-ink' : 'w-6 bg-os-line'}`} />
              </button>
            ))}
          </nav>
        </div>
      </header>
      <BackContext.Provider value={back}>
        <div className="min-h-0 flex-1">{body}</div>
      </BackContext.Provider>
    </div>
  );
}
