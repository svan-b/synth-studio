'use client';

import { memo, useRef } from 'react';
import type { SwitchSpec } from '@/types';
import type { LabelPosition } from '@/types/panel';
import { fitTransform, type TextFit } from '@/lib/controls/textFit';
import styles from './controls.module.css';

export interface SwitchProps {
  id: string;
  spec: SwitchSpec;
  value: number;
  onChange: (value: number) => void;
  highlighted?: boolean;
  targetValue?: number;
  orientation?: 'vertical' | 'horizontal';
  style?: 'toggle' | 'buttons' | 'rotary';
  label?: LabelPosition;
  labelText?: string;
  labelColor?: string;
  scale?: number;
  // ---- optional, set by the panel ----
  /** Header (legend above the switch) size/condense/truncation */
  labelFit?: TextFit;
  /** Position legends' size and condense */
  legendFit?: TextFit;
  spot?: 'target' | 'focus' | null;
}

/** Native sizes the switch draws at (shared with the panel's legibility pass) */
export function switchFonts(scale = 1) {
  return { label: Math.round(6 * scale), legend: Math.max(5, Math.round(5 * scale)) };
}

/**
 * Multi-position switch.
 *  toggle  - bat lever (2 or 3 positions): tap cycles, swipe it up/down (or sideways), or tap a position legend
 *  buttons - row/column of small radio buttons (Elektron/Xone style selectors)
 *  rotary  - stepped selector knob with position legends
 * Keyboard: it is a radio group - arrow keys move between positions.
 */
function Switch({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
  orientation = 'vertical',
  style = 'toggle',
  label = 'above',
  labelText,
  labelColor = '#9ca3af',
  scale = 1,
  labelFit,
  legendFit,
  spot,
}: SwitchProps) {
  const { options } = spec;
  const current = Math.max(0, Math.min(options.length - 1, Math.round(value)));
  const isCorrect = targetValue !== undefined && current === targetValue;
  const ringState = spot === 'focus' ? 'focus' : spot === 'target' || highlighted ? (isCorrect ? 'done' : 'target') : null;
  const ringClass = ringState === 'done' ? styles.spotDone : ringState === 'target' ? styles.spotTarget : ringState === 'focus' ? styles.spotFocus : '';
  const shownLabel = labelText ?? spec.label;
  const title = `${labelFit?.title ?? spec.label}: ${options[current]}${spec.description ? `\n${spec.description}` : ''}`;
  const fonts = switchFonts(scale);
  const labelFont = labelFit?.size ?? fonts.label;
  const legendFont = legendFit?.size ?? fonts.legend;
  const legendTransform = fitTransform(legendFit);
  const swipe = useRef<{ x: number; y: number; id: number; done: boolean } | null>(null);

  const select = (i: number) => {
    const n = Math.max(0, Math.min(options.length - 1, i));
    if (n !== current) onChange(n);
  };

  // Radio-group keyboard: arrows move, Home/End jump to the ends
  const onKey = (e: React.KeyboardEvent) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? current + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? current - 1
      : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    select(next);
  };

  const header = label !== 'none' && shownLabel && (
    <div
      className="font-bold whitespace-pre leading-none mb-0.5 text-center"
      style={{ fontSize: labelFont, color: labelFit?.color ?? labelColor, transform: fitTransform(labelFit) }}
    >
      {labelFit?.text ?? shownLabel}
    </div>
  );

  const hint = highlighted && targetValue !== undefined && !isCorrect && (
    <div className="font-mono text-orange-400 font-bold mt-0.5 whitespace-nowrap bg-black/80 px-1 rounded" style={{ fontSize: Math.max(9, legendFont + 2) }}>
      → {options[targetValue]}
    </div>
  );

  const group = {
    role: 'radiogroup',
    'aria-label': labelFit?.title ?? shownLabel,
    onKeyDown: onKey,
    'data-control': id,
    title,
  } as const;

  const radio = (i: number) => ({
    role: 'radio' as const,
    'aria-checked': i === current,
    'aria-label': options[i],
    tabIndex: i === current ? 0 : -1,
  });

  if (style === 'buttons') {
    const vertical = orientation === 'vertical';
    return (
      <div className="flex flex-col items-center select-none" {...group}>
        {header}
        <div className={`relative flex ${vertical ? 'flex-col' : 'flex-row'} gap-0.5 rounded p-0.5`}>
          {ringClass && <div className={`${styles.spot} ${ringClass}`} style={{ inset: -1, borderRadius: 5 }} />}
          {options.map((opt, i) => (
            <button
              key={opt + i}
              {...radio(i)}
              onClick={() => select(i)}
              className={`rounded-sm font-bold leading-none transition-colors whitespace-nowrap ${styles.focusable}`}
              style={{
                fontSize: legendFont + 1,
                padding: `${2 * scale}px ${4 * scale}px`,
                minWidth: 16 * scale,
                background: i === current ? '#e5e5e5' : '#222',
                color: i === current ? '#111' : '#b4b4b4',
                border: '1px solid #444',
                boxShadow: i === current ? '0 0 6px rgba(255,255,255,0.35)' : 'inset 0 1px 2px #000',
                touchAction: 'manipulation',
              }}
            >
              <span style={{ display: 'inline-block', transform: legendTransform }}>{opt}</span>
            </button>
          ))}
        </div>
        {hint}
      </div>
    );
  }

  if (style === 'rotary') {
    const d = 22 * scale;
    const sweep = options.length > 1 ? 270 / (options.length - 1) : 0;
    const angle = -135 + current * sweep;
    return (
      <div className="flex flex-col items-center select-none" {...group}>
        {header}
        <div className="relative" style={{ width: d * 2.2, height: d * 2.0 }}>
          {options.map((opt, i) => {
            const a = ((-135 + i * sweep) * Math.PI) / 180;
            const r = d * 0.95;
            return (
              <button
                key={opt + i}
                {...radio(i)}
                onClick={() => select(i)}
                className={`absolute font-bold leading-none whitespace-nowrap ${styles.focusable}`}
                style={{
                  left: d * 1.1 + Math.sin(a) * r,
                  top: d * 1.05 - Math.cos(a) * r,
                  transform: `translate(-50%, -50%)${legendTransform ? ` ${legendTransform}` : ''}`,
                  fontSize: legendFont,
                  color: i === current ? '#fff' : '#9a9a9a',
                  padding: 3,
                  touchAction: 'manipulation',
                }}
              >
                {opt}
              </button>
            );
          })}
          <button
            onClick={() => select((current + 1) % options.length)}
            className={`absolute rounded-full ${styles.focusable}`}
            tabIndex={-1}
            aria-hidden="true"
            style={{
              width: d,
              height: d,
              left: d * 0.6,
              top: d * 0.55,
              background: 'radial-gradient(circle at 45% 35%, #3a3a3a 0%, #0e0e0e 80%)',
              border: '1px solid #444',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
              transform: `rotate(${angle}deg)`,
              touchAction: 'manipulation',
            }}
          >
            <span className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full" style={{ top: 2, width: 2, height: d * 0.35 }} />
          </button>
          {ringClass && <div className={`${styles.spot} ${ringClass}`} style={{ width: d + 6, height: d + 6, left: d * 0.6 - 3, top: d * 0.55 - 3 }} />}
        </div>
        {hint}
      </div>
    );
  }

  // Bat-lever toggle
  const positions = options.length;
  const vertical = orientation === 'vertical';
  const trackLong = (positions === 3 ? 20 : 16) * scale;
  const trackShort = 12 * scale;
  const lever = 8 * scale;
  const frac = positions > 1 ? current / (positions - 1) : 0;
  const leverPos = 1 + frac * (trackLong - lever - 2);
  // Bigger legends than the lever is long: give them room and centre the lever on them
  const legendSpan = vertical ? Math.max(trackLong, positions * legendFont * 1.08) : undefined;

  // Swipe the lever towards a position (like flicking a real toggle)
  const onLeverDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
  };
  const onLeverMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || s.done) return;
    const d = vertical ? e.clientY - s.y : e.clientX - s.x;
    if (Math.abs(d) < 10) return;
    s.done = true;
    select(current + (d > 0 ? 1 : -1));
  };
  const onLeverClick = () => {
    const s = swipe.current;
    swipe.current = null;
    if (s?.done) return; // the swipe already moved it
    select((current + 1) % positions);
  };

  return (
    <div className="flex flex-col items-center select-none" {...group}>
      {header}
      <div className={`flex ${vertical ? 'flex-row' : 'flex-col'} items-center gap-0.5`}>
        <button
          onPointerDown={onLeverDown}
          onPointerMove={onLeverMove}
          onClick={onLeverClick}
          tabIndex={-1}
          className={`relative rounded-sm bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border border-[#3a3a3a]`}
          style={{
            width: vertical ? trackShort : trackLong,
            height: vertical ? trackLong : trackShort,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
            touchAction: 'none',
          }}
          aria-label={`${labelFit?.title ?? shownLabel}: ${options[current]}`}
          aria-hidden="true"
        >
          {/* Bigger invisible target for fingers */}
          <span className={styles.hit} style={{ inset: -6 }} />
          {ringClass && <span className={`${styles.spot} ${ringClass}`} style={{ inset: -3, borderRadius: 4 }} />}
          <span
            className="absolute rounded-sm transition-all duration-150 motion-reduce:transition-none"
            style={{
              ...(vertical
                ? { left: (trackShort - lever) / 2 - 1, top: leverPos, width: lever, height: lever }
                : { top: (trackShort - lever) / 2 - 1, left: leverPos, width: lever, height: lever }),
              background: 'linear-gradient(180deg, #999 0%, #555 50%, #999 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
        </button>
        <div
          className={`flex ${vertical ? 'flex-col' : 'flex-row gap-1'} justify-between font-bold leading-none`}
          style={vertical ? { height: legendSpan, fontSize: legendFont } : { fontSize: legendFont }}
        >
          {options.map((opt, i) => (
            <span
              key={opt + i}
              {...radio(i)}
              onClick={() => select(i)}
              className={`relative cursor-pointer whitespace-nowrap ${styles.focusable}`}
              style={{ color: i === current ? '#fff' : '#8f8f8f', transform: legendTransform, transformOrigin: 'left center' }}
            >
              {/* Bigger invisible target than the tiny legend */}
              <span className={styles.hit} style={{ inset: '-3px -4px' }} />
              {opt}
            </span>
          ))}
        </div>
      </div>
      {hint}
    </div>
  );
}

export default memo(Switch);
