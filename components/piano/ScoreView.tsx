'use client';

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Accidental,
  Annotation,
  Barline,
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
} from 'vexflow/bravura';
import type { Score, StaffEvent, Step } from '@/lib/piano/music/score';
import { LETTERS, diatonicIndex, keyInfo, pitchLabel, signatureAccidentals, type Hand, type Pitch } from '@/lib/piano/music/theory';

export type NoteMark = 'ok' | 'warn' | 'bad';

export interface ScoreViewHandle {
  /** Move the cursor to a step, or hide it with null. */
  setCursor(stepIndex: number | null): void;
  mark(noteId: string, state: NoteMark | null): void;
  clearMarks(): void;
}

export interface ScoreViewProps {
  score: Score;
  /** Steps the cursor follows. Defaults to every step in the score. */
  steps?: Step[];
  showFingering?: boolean;
  showNames?: boolean;
  /** Dim the other hand so one hand stands out. */
  focusHand?: Hand | null;
  /** Fixed zoom. When omitted the view picks the largest size that fits. */
  zoom?: number;
  maxZoom?: number;
  minZoom?: number;
  showMeasureNumbers?: boolean;
  /** Draw the time signature. Off for single notes shown as flash cards. */
  showTime?: boolean;
  /** Draw chord letters above the staff. Off until the course has explained them. */
  showChords?: boolean;
  /** Told the height the music needs once it is drawn, so a small frame can grow to hold it. */
  onHeight?: (height: number) => void;
  className?: string;
}

interface NotePos {
  x: number;
  w: number;
  system: number;
  head: SVGElement | null;
  group: SVGElement | null;
}

interface SystemBox {
  top: number;
  bottom: number;
  /** Top of the room kept for this line, with its chord symbols and finger numbers. */
  page: number;
}

interface SystemPlan {
  measures: number[];
  widths: number[];
  lead: number;
  offsetX: number;
}

interface Plan {
  systems: SystemPlan[];
  systemHeight: number;
  staffTop: number;
  staffGap: number;
  height: number;
  /** Extra room above the top staff taken by finger numbers stacked on chords. */
  fingerRise: number;
}

const LEFT_PAD = 16;
const RIGHT_PAD = 8;
const NOTE_SPACE = 36;
const DUR_MAP: Record<string, string> = { w: 'w', h: 'h', q: 'q', e: '8', s: '16' };

function vexKey(p: Pitch): string {
  const acc = p.acc === 0 ? '' : p.acc > 0 ? '#'.repeat(p.acc) : 'b'.repeat(-p.acc);
  return `${LETTERS[p.letter].toLowerCase()}${acc}/${p.octave}`;
}

function restKey(sym: string, clef: 'treble' | 'bass'): string {
  if (clef === 'treble') return sym === 'w' ? 'd/5' : 'b/4';
  return sym === 'w' ? 'f/3' : 'd/3';
}

/** Rough natural width of each measure, from how many separate moments it holds. */
function measureWidths(score: Score): number[] {
  const sigAcc = signatureAccidentals(score.key);
  const out: number[] = [];
  for (let m = 0; m < score.measureCount; m++) {
    const positions = new Set<number>();
    let accidentals = 0;
    let shortest = 4;
    for (const hand of score.hands) {
      for (const ev of score.staff[hand]) {
        if (ev.measure !== m) continue;
        positions.add(Math.round(ev.start * 960));
        if (ev.beats < shortest) shortest = ev.beats;
        for (const p of ev.pitches) if (p.acc !== sigAcc[p.letter]) accidentals++;
      }
    }
    const n = Math.max(positions.size, 1);
    const space = shortest <= 0.25 ? NOTE_SPACE * 0.82 : NOTE_SPACE;
    out.push(Math.max(92, 30 + n * space + Math.min(accidentals, 6) * 9));
  }
  return out;
}

function planLayout(score: Score, width: number, opts: { fingering: boolean; names: boolean; chords: boolean; time: boolean }): Plan {
  const natural = measureWidths(score);
  const sig = Math.abs(keyInfo(score.key).signature);
  const clefLead = 40 + (sig > 0 ? sig * 11 + 8 : 0);
  const timeLead = opts.time ? 30 : 0;
  const available = Math.max(200, width - LEFT_PAD - RIGHT_PAD);

  const systems: SystemPlan[] = [];
  let i = 0;
  while (i < score.measureCount) {
    const lead = clefLead + (systems.length === 0 ? timeLead : 0);
    let sum = 0;
    let count = 0;
    while (i + count < score.measureCount && (count === 0 || sum + natural[i + count] + lead <= available)) {
      sum += natural[i + count];
      count++;
    }
    const remaining = score.measureCount - i;
    if (count < remaining) {
      // Break on phrase friendly counts so lines end where phrases tend to.
      const skip = systems.length === 0 && score.pickup > 0 ? 1 : 0;
      const body = count - skip;
      const nice = body >= 8 ? 8 : body >= 4 ? 4 : body >= 2 ? 2 : body;
      count = nice + skip;
    }
    const measures: number[] = [];
    for (let k = 0; k < count; k++) measures.push(i + k);
    const raw = measures.map((m) => natural[m]);
    const rawSum = raw.reduce((a, b) => a + b, 0);
    const isLast = i + count >= score.measureCount;
    let stretch = (available - lead) / rawSum;
    const cap = systems.length === 0 && isLast ? 1.5 : 1.4;
    let offsetX = 0;
    if (isLast && stretch > cap) {
      stretch = cap;
      // A short single line looks best centred.
      if (systems.length === 0) offsetX = (available - lead - rawSum * stretch) / 2;
    }
    systems.push({ measures, widths: raw.map((w) => w * stretch), lead, offsetX });
    i += count;
  }

  // Vertical room, from how far the notes travel beyond the staves.
  const two = score.hands.length === 2;
  let above = 0;
  let below = 0;
  let middleExtra = 0;
  const topHand = score.hands[0];
  const bottomHand = score.hands[score.hands.length - 1];
  const topLine = (clef: 'treble' | 'bass') => (clef === 'treble' ? 38 : 26); // F5 or A3
  const bottomLine = (clef: 'treble' | 'bass') => (clef === 'treble' ? 30 : 18); // E4 or G2
  for (const n of score.notes) {
    const d = diatonicIndex(n.pitch);
    const clef = score.clefs[n.hand];
    if (n.hand === topHand) above = Math.max(above, d - topLine(clef));
    if (n.hand === bottomHand) below = Math.max(below, bottomLine(clef) - d);
    if (two) {
      if (n.hand === topHand) middleExtra = Math.max(middleExtra, bottomLine(clef) - d - 3);
      else middleExtra = Math.max(middleExtra, d - topLine(clef) - 3);
    }
  }
  // A stem that points up carries its finger number above its tip, which stands
  // higher than the note itself. Notes below the middle line have such stems.
  for (const ev of score.staff[topHand]) {
    if (ev.kind !== 'note' || ev.sym === 'w') continue;
    const ds = ev.pitches.map(diatonicIndex);
    const top = topLine(score.clefs[topHand]);
    if ((Math.min(...ds) + Math.max(...ds)) / 2 < top - 4) above = Math.max(above, Math.max(...ds) + 7 - top);
  }
  const labelRoom = (opts.fingering ? 16 : 0) + (opts.names ? 14 : 0);
  // A chord carries one finger number for each of its notes, stacked. Each one past the first needs its own line.
  const stack = (hand: Hand) => (opts.fingering ? Math.max(0, ...score.staff[hand].map((e) => e.fingers?.length ?? 0)) : 0);
  const fingerRise = topHand === 'R' ? Math.max(0, stack('R') - 1) * 15 : 0;
  const fingerDrop = bottomHand === 'L' ? Math.max(0, stack('L') - 1) * 15 : 0;
  const padTop = 18 + above * 5 + labelRoom + fingerRise + (opts.chords ? 20 : 0);
  const padBottom = 16 + below * 5 + labelRoom + fingerDrop;
  const staffGap = two ? 92 + Math.max(0, middleExtra) * 5 + (opts.fingering ? 12 : 0) : 0;
  const systemHeight = padTop + 40 + staffGap + padBottom + 14;
  return { systems, systemHeight, staffTop: padTop, staffGap, height: systems.length * systemHeight + 6, fingerRise };
}

function cssColor(el: HTMLElement, name: string, alpha = 1): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  if (!v) return alpha === 1 ? '#1e1c19' : `rgba(30,28,25,${alpha})`;
  const [r, g, b] = v.split(/\s+/);
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ScoreView = forwardRef<ScoreViewHandle, ScoreViewProps>(function ScoreView(
  {
    score,
    steps,
    showFingering = true,
    showNames = false,
    focusHand = null,
    zoom,
    maxZoom = 1.9,
    minZoom = 1.05,
    showMeasureNumbers = true,
    showTime = true,
    showChords = true,
    onHeight,
    className,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, NotePos>());
  const systemBoxes = useRef<SystemBox[]>([]);
  const zoomRef = useRef(1);
  const cursorStep = useRef<number | null>(null);
  const marks = useRef(new Map<string, NoteMark>());
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [themeKey, setThemeKey] = useState(0);
  const activeSteps = useMemo(() => steps ?? score.steps, [steps, score]);
  const stepsRef = useRef(activeSteps);
  stepsRef.current = activeSteps;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (Math.abs(prev.w - r.width) > 1 || Math.abs(prev.h - r.height) > 1 ? { w: r.width, h: r.height } : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw when the theme attribute on the app root changes.
  useEffect(() => {
    const root = wrapRef.current?.closest('.mc-root');
    if (!root) return;
    const mo = new MutationObserver(() => setThemeKey((k) => k + 1));
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  const applyCursor = (index: number | null, smooth = true) => {
    const cur = cursorRef.current;
    const wrap = wrapRef.current;
    if (!cur || !wrap) return;
    if (index === null || index < 0 || index >= stepsRef.current.length) {
      cur.style.opacity = '0';
      return;
    }
    const step = stepsRef.current[index];
    let x0 = Infinity;
    let x1 = -Infinity;
    let system = 0;
    for (const n of step.notes) {
      const p = positions.current.get(n.id);
      if (!p) continue;
      if (p.x < x0) x0 = p.x;
      if (p.x + p.w > x1) x1 = p.x + p.w;
      system = p.system;
    }
    if (!Number.isFinite(x0)) {
      cur.style.opacity = '0';
      return;
    }
    const z = zoomRef.current;
    const box = systemBoxes.current[system];
    const left = (x0 - 6) * z;
    const top = box.top * z;
    cur.style.opacity = '1';
    cur.style.width = `${(x1 - x0 + 12) * z}px`;
    cur.style.height = `${(box.bottom - box.top) * z}px`;
    cur.style.transform = `translate(${left}px, ${top}px)`;
    // Keep the line being played in view, and the line after it too, so the
    // eye can read ahead. The page moves as the playing moves to a new line,
    // never in the middle of one.
    const viewTop = wrap.scrollTop;
    const viewBottom = viewTop + wrap.clientHeight;
    // The top of the line is the top of everything that belongs to it: chord
    // symbols, finger numbers and notes above the staff, not only the staff.
    const lift = innerRef.current ? parseFloat(innerRef.current.style.marginTop || '0') : 0;
    const sysTop = box.page * z + lift;
    const next = systemBoxes.current[system + 1];
    const wantBottom = (next ? next.bottom : box.bottom) * z + lift + 16;
    if (sysTop < viewTop || wantBottom > viewBottom) {
      wrap.scrollTo({ top: Math.max(0, sysTop - 4), behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const applyMark = (id: string, state: NoteMark | null) => {
    const p = positions.current.get(id);
    const el = p?.head ?? p?.group;
    if (!el) return;
    el.classList.remove('mc-note-ok', 'mc-note-warn', 'mc-note-bad');
    if (state) el.classList.add(`mc-note-${state}`);
  };

  useImperativeHandle(ref, () => ({
    setCursor(stepIndex) {
      cursorStep.current = stepIndex;
      applyCursor(stepIndex);
    },
    mark(noteId, state) {
      if (state) marks.current.set(noteId, state);
      else marks.current.delete(noteId);
      applyMark(noteId, state);
    },
    clearMarks() {
      marks.current.forEach((_, id) => applyMark(id, null));
      marks.current.clear();
    },
  }));

  useLayoutEffect(() => {
    const host = hostRef.current;
    const wrap = wrapRef.current;
    if (!host || !wrap || size.w < 40) return;
    host.innerHTML = '';
    positions.current.clear();
    systemBoxes.current = [];

    const hasFingering = showFingering && score.notes.some((n) => n.finger !== undefined);
    const withChords = showChords && score.chords.length > 0;
    const planOpts = { fingering: hasFingering, names: showNames, chords: withChords, time: showTime };

    // Pick the largest zoom whose layout fits the available height.
    let z = zoom ?? minZoom;
    let plan = planLayout(score, size.w / z, planOpts);
    if (zoom === undefined) {
      const candidates = [maxZoom, 1.75, 1.6, 1.45, 1.3, 1.18, 1.05, 0.95, minZoom].filter(
        (c, i, all) => c <= maxZoom && c >= minZoom && all.indexOf(c) === i,
      );
      for (const c of candidates) {
        const p = planLayout(score, size.w / c, planOpts);
        z = c;
        plan = p;
        if (p.height * c <= size.h - 4 || size.h < 60) break;
      }
    }
    zoomRef.current = z;
    const logicalW = size.w / z;

    const ink = cssColor(host, '--mc-ink');
    const lineColor = cssColor(host, '--mc-ink', 0.5);
    const mutedColor = cssColor(host, '--mc-muted');

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(size.w, Math.ceil(plan.height * z));
    const ctx = renderer.getContext();
    ctx.scale(z, z);
    ctx.setFillStyle(ink);
    ctx.setStrokeStyle(ink);

    const timeSpec = `${score.time[0]}/${score.time[1]}`;
    const beamGroups = Beam.getDefaultBeamGroups(timeSpec);
    const eventNotes = new Map<StaffEvent, StaveNote>();
    const noteSystem = new Map<StaffEvent, number>();
    const byMeasure: Record<Hand, StaffEvent[][]> = { R: [], L: [] };
    for (const hand of score.hands) {
      const groups: StaffEvent[][] = Array.from({ length: score.measureCount }, () => []);
      for (const ev of score.staff[hand]) groups[ev.measure].push(ev);
      byMeasure[hand] = groups;
    }

    plan.systems.forEach((sys, si) => {
      const sysY = si * plan.systemHeight;
      const yTop = sysY + plan.staffTop - 40;
      const staveY: Record<Hand, number> = { R: yTop, L: yTop };
      if (score.hands.length === 2) staveY.L = yTop + plan.staffGap;
      let x = LEFT_PAD + sys.offsetX;
      let firstStaves: Stave[] = [];
      let lastStaves: Stave[] = [];

      sys.measures.forEach((m, mi) => {
        const first = mi === 0;
        const width = sys.widths[mi] + (first ? sys.lead : 0);
        const staves: Partial<Record<Hand, Stave>> = {};
        for (const hand of score.hands) {
          const stave = new Stave(x, staveY[hand], width);
          if (first) {
            stave.addClef(score.clefs[hand]);
            stave.addKeySignature(score.key);
            if (si === 0 && showTime) stave.addTimeSignature(timeSpec);
          } else {
            stave.setBegBarType(Barline.type.NONE);
          }
          if (m === score.measureCount - 1) stave.setEndBarType(Barline.type.END);
          stave.setStyle({ strokeStyle: lineColor, fillStyle: lineColor });
          stave.setContext(ctx).draw();
          staves[hand] = stave;
        }
        const list = score.hands.map((h) => staves[h]!);
        if (first) firstStaves = list;
        lastStaves = list;

        const startX = Math.max(...list.map((s) => s.getNoteStartX()));
        list.forEach((s) => s.setNoteStartX(startX));

        const voices: Voice[] = [];
        const beams: Beam[] = [];
        const tuplets: Tuplet[] = [];
        const drawn: Array<{ voice: Voice; stave: Stave }> = [];

        for (const hand of score.hands) {
          const events = byMeasure[hand][m];
          const clef = score.clefs[hand];
          const notes: StaveNote[] = [];
          const onlyRest = events.length === 1 && events[0].kind === 'rest';
          let tripletRun: StaveNote[] = [];
          for (const ev of events) {
            const duration = DUR_MAP[ev.sym] + (ev.kind === 'rest' ? 'r' : '');
            const note = new StaveNote({
              keys: ev.kind === 'rest' ? [restKey(ev.sym, clef)] : ev.pitches.map(vexKey),
              duration,
              dots: ev.dots,
              clef,
              auto_stem: true,
              align_center: onlyRest,
            });
            // The short lines above and below the staff are part of reading the note, so they are drawn in full ink.
            note.setLedgerLineStyle({ strokeStyle: ink, lineWidth: 1.4 });
            if (ev.dots > 0) Dot.buildAndAttach([note], { all: true });
            if (ev.kind === 'note') {
              const above = hand === 'R';
              const justify = above ? Annotation.VerticalJustify.TOP : Annotation.VerticalJustify.BOTTOM;
              if (hasFingering && ev.fingers) {
                // Stack so the number nearest the staff belongs to the nearest note.
                const order = above ? ev.fingers.slice() : ev.fingers.slice().reverse();
                for (const f of order) {
                  const a = new Annotation(String(f)).setVerticalJustification(justify);
                  a.setFont('Arial', 11, 'bold');
                  note.addModifier(a, 0);
                }
              }
              if (showNames) {
                const text = ev.pitches.map((p) => pitchLabel(p)).join(' ');
                const a = new Annotation(text).setVerticalJustification(
                  above ? Annotation.VerticalJustify.BOTTOM : Annotation.VerticalJustify.TOP,
                );
                a.setFont('Arial', 10, 'normal');
                note.addModifier(a, 0);
              }
            }
            if (ev.triplet) {
              tripletRun.push(note);
              if (tripletRun.length === 3) {
                tuplets.push(new Tuplet(tripletRun, { num_notes: 3, notes_occupied: 2 }));
                tripletRun = [];
              }
            } else {
              tripletRun = [];
            }
            notes.push(note);
            eventNotes.set(ev, note);
            noteSystem.set(ev, si);
          }
          if (notes.length === 0) continue;
          const voice = new Voice({ num_beats: score.time[0], beat_value: score.time[1] });
          voice.setMode(Voice.Mode.SOFT);
          voice.addTickables(notes);
          Accidental.applyAccidentals([voice], score.key);
          beams.push(...Beam.generateBeams(notes, { groups: beamGroups }));
          voices.push(voice);
          drawn.push({ voice, stave: staves[hand]! });
        }

        if (voices.length > 0) {
          const formatter = new Formatter();
          voices.forEach((v) => formatter.joinVoices([v]));
          const room = list[0].getNoteEndX() - startX - 12;
          formatter.format(voices, Math.max(40, room));
          drawn.forEach(({ voice, stave }) => voice.draw(ctx, stave));
          beams.forEach((b) => b.setContext(ctx).draw());
          tuplets.forEach((t) => t.setContext(ctx).draw());
        }

        if (score.hands.length === 2) {
          new StaveConnector(list[0], list[1]).setType(StaveConnector.type.SINGLE_RIGHT).setContext(ctx).draw();
        }
        if (showMeasureNumbers && first && si > 0) {
          ctx.save();
          ctx.setFont('Arial', 9, 'normal');
          ctx.setFillStyle(mutedColor);
          ctx.fillText(String(m + 1 + score.measureOffset), x + 2, list[0].getYForLine(0) - 8);
          ctx.restore();
        }
        x += width;
      });

      if (score.hands.length === 2 && firstStaves.length === 2) {
        new StaveConnector(firstStaves[0], firstStaves[1]).setType(StaveConnector.type.BRACE).setContext(ctx).draw();
        new StaveConnector(firstStaves[0], firstStaves[1]).setType(StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
      }
      const topStave = lastStaves[0];
      const bottomStave = lastStaves[lastStaves.length - 1];
      systemBoxes.current.push({ top: topStave.getYForLine(0) - 16, bottom: bottomStave.getYForLine(4) + 16, page: sysY });
    });

    // Ties, including ties that cross from one system to the next.
    for (const hand of score.hands) {
      const events = score.staff[hand];
      for (let i = 0; i < events.length - 1; i++) {
        const a = events[i];
        if (!a.tieToNext || a.kind !== 'note') continue;
        const b = events[i + 1];
        if (b.kind !== 'note') continue;
        const na = eventNotes.get(a);
        const nb = eventNotes.get(b);
        if (!na || !nb) continue;
        const firstIdx: number[] = [];
        const lastIdx: number[] = [];
        a.pitches.forEach((p, pi) => {
          const j = b.pitches.findIndex((q) => q.letter === p.letter && q.octave === p.octave && q.acc === p.acc);
          if (j >= 0) {
            firstIdx.push(pi);
            lastIdx.push(j);
          }
        });
        if (firstIdx.length === 0) continue;
        if (noteSystem.get(a) === noteSystem.get(b)) {
          new StaveTie({ first_note: na, last_note: nb, first_indices: firstIdx, last_indices: lastIdx }).setContext(ctx).draw();
        } else {
          new StaveTie({ first_note: na, first_indices: firstIdx }).setContext(ctx).draw();
          new StaveTie({ last_note: nb, last_indices: lastIdx }).setContext(ctx).draw();
        }
      }
    }

    // Chord symbols above the top staff.
    if (withChords) {
      const topHand = score.hands[0];
      ctx.save();
      ctx.setFont('Arial', 13, 'bold');
      ctx.setFillStyle(ink);
      for (const mark of score.chords) {
        const ev =
          score.staff[topHand].find((e) => e.start >= mark.start - 1e-6 && e.measure === mark.measure) ??
          score.staff[topHand].filter((e) => e.measure === mark.measure).pop();
        const note = ev ? eventNotes.get(ev) : undefined;
        if (!ev || !note) continue;
        const si = noteSystem.get(ev) ?? 0;
        // At the top of the room kept for this line: above the finger numbers, however many are
        // stacked, and above the highest note. One height for every line, so they read as a row.
        const y = systemBoxes.current[si].page + 20;
        ctx.fillText(mark.symbol.replace(/b/g, '♭').replace(/#/g, '♯'), note.getAbsoluteX(), y);
      }
      ctx.restore();
    }

    // Remember where every note landed, for the cursor and for colouring.
    eventNotes.forEach((note, ev) => {
      if (ev.kind !== 'note') return;
      const group = note.getSVGElement() ?? null;
      const x = note.getNoteHeadBeginX();
      const w = Math.max(8, note.getNoteHeadEndX() - x);
      const system = noteSystem.get(ev) ?? 0;
      ev.noteIds.forEach((id, idx) => {
        const head = (note.noteHeads[idx]?.getSVGElement() as SVGElement | undefined) ?? null;
        positions.current.set(id, { x, w, system, head, group });
      });
      if (group && focusHand && ev.hand !== focusHand) group.classList.add('mc-note-dim');
    });
    if (focusHand) {
      // Rests of the other hand fade too.
      eventNotes.forEach((note, ev) => {
        if (ev.kind === 'rest' && ev.hand !== focusHand) note.getSVGElement()?.classList.add('mc-note-dim');
      });
    }

    const svg = host.querySelector('svg');
    if (svg) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Sheet music');
    }
    void logicalW;
    // A short score sits a little above the middle of the stand, not pressed against the top.
    if (innerRef.current) innerRef.current.style.marginTop = `${Math.max(0, Math.round((size.h - plan.height * z) * 0.3))}px`;

    marks.current.forEach((state, id) => applyMark(id, state));
    applyCursor(cursorStep.current, false);
    onHeight?.(Math.ceil(plan.height * z));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, size.w, size.h, showFingering, showNames, focusHand, zoom, maxZoom, minZoom, showMeasureNumbers, showTime, showChords, themeKey]);

  // The cursor follows a different step list when the active hands change.
  useEffect(() => {
    applyCursor(cursorStep.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSteps]);

  return (
    <div ref={wrapRef} className={`mc-score mc-scroll h-full w-full ${className ?? ''}`}>
      <div ref={innerRef} className="relative">
        <div ref={hostRef} />
        <div ref={cursorRef} className="mc-cursor" style={{ opacity: 0 }} />
      </div>
    </div>
  );
});

export default ScoreView;
