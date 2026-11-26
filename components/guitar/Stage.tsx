'use client';

/**
 * The frame every playing screen shares, built for a learner whose hands are
 * on a guitar and whose iPad stands an arm's length away.
 *
 * - One line at the top says what to do, or how it went, in large type.
 * - One bar along the bottom holds every control, always in the same places:
 *   going back and hearing it on one side, the next thing to do on the other,
 *   as the largest button on the screen.
 * - The next thing can happen without a touch: by itself after a moment,
 *   on a strum where a strum can mean nothing else, or from a foot pedal.
 *
 * Bluetooth page turning pedals are small keyboards that send the arrow
 * keys, space, return or page up and down, which is how sheet music apps
 * such as forScore work with them. The same keys work here: forward for the
 * next thing, back for again.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { speak, speaking, stopSpeaking, whenQuiet } from '@/lib/guitar/audio/speech';
import { strikeBus } from '@/lib/guitar/input/bus';
import { useGuitar } from '@/lib/guitar/learn/store';
import { Emitter } from '@/lib/guitar/util/emitter';
import { Button, Icon, Prose } from './ui';

// ------------------------------------------------------- pedal and keyboard

type Direction = 'forward' | 'back';
interface Handler {
  dir: Direction;
  priority: number;
  fn: () => void;
}
const handlers = new Set<Handler>();
let listening = false;

function onKey(e: KeyboardEvent): void {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement as HTMLElement | null;
  const tag = el?.tagName ?? '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
  // A sheet over the screen takes the keys for itself.
  if (document.querySelector('[data-os-sheet]')) return;
  const forward = ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', ' '].includes(e.key);
  const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
  if (!forward && !back) return;
  // A focused button already answers return and space itself.
  if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
  const dir: Direction = forward ? 'forward' : 'back';
  let best: Handler | null = null;
  handlers.forEach((h) => {
    if (h.dir === dir && (!best || h.priority >= best.priority)) best = h;
  });
  if (!best) return;
  e.preventDefault();
  (best as Handler).fn();
}

/**
 * Answer the pedal or the keyboard: forward for the next thing, back for
 * again. Where two parts of a screen both answer, the higher priority wins.
 */
export function useRemoteKey(dir: Direction, fn: (() => void) | null | undefined, priority = 0): void {
  const ref = useRef(fn);
  ref.current = fn;
  const has = Boolean(fn);
  useEffect(() => {
    if (!has) return;
    const h: Handler = { dir, priority, fn: () => ref.current?.() };
    handlers.add(h);
    if (!listening) {
      window.addEventListener('keydown', onKey);
      listening = true;
    }
    return () => {
      handlers.delete(h);
    };
  }, [dir, has, priority]);
}

// --------------------------------------------------------- eyes on the music

/** A run with the beat is under way: everything but the music and the bar steps back. */
export const focusBus = new Emitter<boolean>();
let focused = false;
export function setFocus(on: boolean): void {
  if (focused === on) return;
  focused = on;
  focusBus.emit(on);
}
export function useFocus(): boolean {
  const [on, setOn] = useState(focused);
  useEffect(() => {
    setOn(focused);
    return focusBus.subscribe(setOn);
  }, []);
  return on;
}

// ------------------------------------------------------------- the message

/** Say a line aloud when it changes, where the learner has asked for a voice. */
export function useSpoken(text: string | null | undefined): void {
  const on = useGuitar((s) => s.settings.speak === true);
  useEffect(() => {
    if (!on || !text) return;
    // A breath, so quick changes of wording are not each begun and cut off.
    const t = setTimeout(() => speak(text), 250);
    return () => clearTimeout(t);
  }, [on, text]);
  useEffect(() => () => stopSpeaking(), []);
}

/**
 * The one line at the top of a playing screen: what to do, or how it went.
 * Large enough to read from a chair with a guitar on the lap.
 */
export function StageMessage({ text, sub, tone, right, spoken = true }: { text: string; sub?: string | null; tone?: 'ok' | 'hint'; right?: ReactNode; spoken?: boolean }) {
  useSpoken(spoken ? (sub ? `${text} ${sub}` : text) : null);
  const away = useFocus();
  return (
    <div className={`flex shrink-0 items-start gap-4 px-7 pb-2 pt-1 transition-opacity duration-300 ${away ? 'opacity-0' : ''}`} aria-live="polite">
      {tone && (
        <span className={`os-pop mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${tone === 'ok' ? 'bg-os-ok' : 'bg-os-hint'}`}>
          {tone === 'ok' ? <Icon.Check size={26} /> : <Icon.Repeat size={24} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={`os-brief ${tone === 'ok' ? 'text-os-ok-ink' : tone === 'hint' ? 'text-os-hint-ink' : 'text-os-ink'}`}>
          <Prose text={text} />
        </div>
        {sub && <div className="mt-1 text-[1.25rem] leading-snug text-os-muted">{sub}</div>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 pt-1">{right}</div>}
    </div>
  );
}

// ----------------------------------------------------------- the action bar

export interface BarAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface PrimaryAction extends BarAction {
  /** Seconds after which it happens by itself. A touch anywhere else holds it. */
  auto?: number;
  /** A strum does it too. Only for moments when a strum can mean nothing else. */
  strum?: boolean;
  /** Drawn quietly, as when it is one choice of several and not the plain next step. */
  quiet?: boolean;
  /** A few words under the label. */
  hint?: string;
}

function Primary({ action }: { action: PrimaryAction }) {
  const ref = useRef<HTMLButtonElement>(null);
  const fire = useRef(action.onClick);
  fire.current = action.onClick;
  const [held, setHeld] = useState(false);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(action.auto ?? 0);
  const auto = action.auto && !held && !action.disabled ? action.auto : 0;

  // By itself after a moment, once any spoken words are finished.
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    void whenQuiet().then(() => {
      if (cancelled) return;
      setRunning(true);
      const ends = Date.now() + auto * 1000;
      setLeft(auto);
      timer = setInterval(() => {
        const s = Math.max(0, (ends - Date.now()) / 1000);
        setLeft(s);
        if (s <= 0) {
          if (timer) clearInterval(timer);
          fire.current();
        }
      }, 100);
    });
    // A touch anywhere but the button means: wait, I am still reading.
    const hold = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      setHeld(true);
    };
    window.addEventListener('pointerdown', hold, true);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      setRunning(false);
      window.removeEventListener('pointerdown', hold, true);
    };
  }, [auto]);

  // On a strum, after a moment for the last one to die away.
  useEffect(() => {
    if (!action.strum || action.disabled) return;
    let off: (() => void) | null = null;
    const t = setTimeout(() => {
      off = strikeBus.subscribe(() => {
        if (speaking()) return;
        off?.();
        off = null;
        fire.current();
      });
    }, 900);
    return () => {
      clearTimeout(t);
      off?.();
    };
  }, [action.strum, action.disabled]);

  const hint = auto && running ? `in ${Math.ceil(left)}` : action.strum ? 'or strum once' : action.hint;
  return (
    <button
      ref={ref}
      onClick={action.onClick}
      disabled={action.disabled}
      className={`relative inline-flex h-[4.5rem] min-w-[15rem] shrink-0 select-none items-center justify-center gap-3 overflow-hidden rounded-full px-9 text-[1.45rem] font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 ${
        action.quiet ? 'bg-os-raised text-os-ink' : 'bg-os-ink text-os-bg'
      }`}
    >
      {auto > 0 && running && <span className="os-auto-fill absolute inset-0 bg-os-ok/45" style={{ animationDuration: `${auto}s` }} aria-hidden />}
      <span className="relative flex items-center gap-3">
        {action.icon}
        <span className="flex flex-col items-center leading-tight">
          <span>{action.label}</span>
          {hint && <span className="text-[13px] font-semibold uppercase tracking-wider opacity-80">{hint}</span>}
        </span>
      </span>
    </button>
  );
}

/**
 * Every control of a playing screen, along the bottom, in the same places on
 * every screen. Back and again sit on one side. The next thing to do sits on
 * the other, by the strumming hand, and is the largest button there is.
 */
export function ActionBar({
  back,
  again,
  extras = [],
  skip,
  primary,
  children,
}: {
  /** To the step before. */
  back?: (() => void) | null;
  /** Do this one again. The pedal's back key does it too. */
  again?: BarAction | null;
  /** Other things to do here, such as hearing it. */
  extras?: Array<BarAction | null | false | undefined>;
  /** Leave this one and go on. Always offered while playing, so a learner is never stuck. */
  skip?: BarAction | null;
  primary?: PrimaryAction | null;
  children?: ReactNode;
}) {
  const leftHanded = useGuitar((s) => s.settings.leftHanded);
  const forward = primary && !primary.disabled ? primary.onClick : skip && !skip.disabled ? skip.onClick : null;
  useRemoteKey('forward', forward);
  useRemoteKey('back', again && !again.disabled ? again.onClick : (back ?? null));
  const more = extras.filter((x): x is BarAction => Boolean(x));
  // Two groups, so that where the screen is narrow the next thing to do keeps its own side on a row of its own.
  return (
    <div className={`flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 pb-5 pt-3 ${leftHanded ? 'flex-row-reverse' : ''}`}>
      <div className={`flex flex-wrap items-center gap-2.5 ${leftHanded ? 'flex-row-reverse' : ''}`}>
        {back && (
          <Button variant="soft" size="lg" onClick={back} icon={<Icon.Left size={20} />} className="px-5">
            Back
          </Button>
        )}
        {again && (
          <Button variant="soft" size="lg" onClick={again.onClick} disabled={again.disabled} icon={again.icon ?? <Icon.Repeat size={20} />} className="px-5">
            {again.label}
          </Button>
        )}
        {more.map((a) => (
          <Button key={a.label} variant="soft" size="lg" onClick={a.onClick} disabled={a.disabled} icon={a.icon} className="px-5">
            {a.label}
          </Button>
        ))}
        {children}
      </div>
      <div className={`flex items-center gap-2.5 ${leftHanded ? 'mr-auto flex-row-reverse' : 'ml-auto'}`}>
        {skip && (
          <Button variant="ghost" size="lg" onClick={skip.onClick} disabled={skip.disabled} icon={skip.icon} className="border border-os-line px-6 text-os-ink">
            {skip.label}
          </Button>
        )}
        {primary && <Primary key={`${primary.label}|${primary.auto ?? 0}|${primary.strum ? 1 : 0}`} action={primary} />}
      </div>
    </div>
  );
}
