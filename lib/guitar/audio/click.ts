/**
 * The pitch of the metronome click.
 *
 * Both clicks sit a quarter tone above a note of the scale, halfway between
 * two frets. No string in tune sounds there, so when the click reaches the
 * microphone the note detector can tell a click from a string by its pitch.
 */

const QUARTER_TONE = Math.pow(2, 1 / 24);

export const CLICK_HZ = {
  /** An ordinary beat. */
  beat: 1174.66 * QUARTER_TONE,
  /** The first beat of a measure. */
  accent: 1760 * QUARTER_TONE,
} as const;

export const CLICK_FREQS: number[] = [CLICK_HZ.beat, CLICK_HZ.accent];
