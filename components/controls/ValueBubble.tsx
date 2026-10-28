'use client';

import { createPortal } from 'react-dom';
import styles from './controls.module.css';

export interface BubbleState {
  /** Screen point the bubble sits above (CSS px, viewport coordinates) */
  x: number;
  y: number;
  label?: string;
  value: string;
  /** Fine-adjust mode in use ("Fine", "Half speed") */
  mode?: string;
  /** One-line usage hint (first touch drags only) */
  hint?: string;
}

/**
 * The value readout that follows a drag, with units - drawn in screen pixels in a
 * portal so it stays readable at any panel zoom, and lifted above the finger on touch.
 */
export default function ValueBubble({ state }: { state: BubbleState | null }) {
  if (!state || typeof document === 'undefined') return null;
  const vw = window.innerWidth;
  const x = Math.min(vw - 70, Math.max(70, state.x));
  // Not enough room above (top of the screen): show it below the point instead
  const below = state.y < 76;
  const y = below ? state.y + 28 : state.y;
  return createPortal(
    <div className={`${styles.bubble} ${below ? styles.bubbleBelow : ''}`} style={{ left: x, top: y }} aria-hidden="true" data-value-bubble="">
      {state.label && <span className={styles.bubbleLabel}>{state.label}</span>}
      <span className={styles.bubbleValue}>{state.value}</span>
      {state.mode && <span className={styles.bubbleMode}>{state.mode}</span>}
      {state.hint && !state.mode && <span className={styles.bubbleHint}>{state.hint}</span>}
    </div>,
    document.body,
  );
}
