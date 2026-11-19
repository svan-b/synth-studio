// ============================================================================
// Gain staging.
//
// Instruments arrive at the studio at a nominal level: every instrument's presets
// are normalised at the source to a -18 LUFS median at the instrument output
// (scripts/audio-qa.cjs --target -18, docs/AUDIO_QA.md), the way hardware puts
// out a nominal line level whatever it is. So a channel fader at 0 dB plays an
// instrument at about -18 LUFS, a full studio of five or six instruments sums to
// about -10 LUFS, and the master limiter (-1 dBTP) only catches the odd peak.
// The studio sets start some faders lower to balance their mixes.
//
// The trim below sits before each channel fader. It is unity for every device:
// levels are fixed in the instrument, not compensated in the studio. It stays as
// a hook for exceptions (say, a device that cannot be normalised at its source).
// ============================================================================

/** Nominal loudness of one instrument with its fader at 0 dB */
export const TARGET_LUFS = -18;

/** Per-device input trim, dB. Empty on purpose: instruments are normalised at the source. */
export const TRIM_DB: Record<string, number> = {};

/** Calibration trim for a device, dB (0 unless listed above) */
export function levelTrimDb(device: string): number {
  const t = TRIM_DB[device] ?? 0;
  return Math.max(-12, Math.min(12, t));
}
