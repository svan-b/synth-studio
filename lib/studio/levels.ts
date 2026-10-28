// ============================================================================
// Gain staging: each instrument's calibrated level in the studio.
//
// Hardware puts out roughly the same nominal line level whatever it is, so a
// mixer's faders start in the same place for everything. The twins' raw outputs
// differ by 20 dB and more, so the hub inserts this trim before each channel
// fader: with the fader at 0 dB, a typical patch of any instrument plays at about
// -18 LUFS on its own, and a full studio sums to about -10 LUFS without riding
// the master limiter.
//
// Measured: `node scripts/levels.cjs <url>` plays every instrument's default
// demo (its sequencer, or a riff on keyboards) alone through the studio for 10 s
// and prints the integrated loudness and the trim that lands it on TARGET_LUFS.
// Re-run it whenever an instrument's output level changes and paste the table.
// External gear (your synth, audio input, plugins) stays at unity: its level is
// set at the source (audio input GAIN, the plugin, your synth's volume).
// ============================================================================

/** Target loudness of one instrument with its fader at 0 dB */
export const TARGET_LUFS = -18;

/** Largest trim applied either way; anything beyond it means the device itself should be fixed */
export const MAX_TRIM_DB = 12;

/**
 * Integrated loudness (LUFS) of each device's default demo through a unity
 * channel, measured with scripts/levels.cjs. null = not measured (unity trim).
 */
export const MEASURED_LUFS: Record<string, number | null> = {
  dfam: -18.0,
  mother32: -15.8,
  subharmonicon: -32.1,
  sub37: -15.8,
  'analog-four': -32.5,
  'analog-rytm': -24.4,
  xone96: null,
  'studio-clock': null,
  'midi-synth': null,
  'audio-in': null,
  'wam-plugin': null,
};

/** Calibration trim for a device, dB (0 for anything unmeasured) */
export function levelTrimDb(device: string): number {
  const m = MEASURED_LUFS[device];
  if (m === null || m === undefined || !Number.isFinite(m)) return 0;
  const t = TARGET_LUFS - m;
  return Math.max(-MAX_TRIM_DB, Math.min(MAX_TRIM_DB, Math.round(t * 2) / 2));
}
