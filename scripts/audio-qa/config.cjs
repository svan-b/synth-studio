'use strict';
// ============================================================================
// Audio QA - default thresholds, excitation and category targets.
// Override any of it with --config <file.json> (deep-merged; `categories`
// replaces the list). See docs/AUDIO_QA.md.
// ============================================================================

module.exports = {
  thresholds: {
    /** silent: the whole render (instrument tap) peaks below this */
    silentDbfs: -70,
    /** true-peak: instrument output above this */
    truePeakDbtp: -1,
    /** dc: |mean| over the excitation window or the last 0.5 s */
    dc: 0.005,
    /** stuck-tail: tail peak this long after stop ... */
    tailAfterSec: 2,
    /** ... above this */
    tailDbfs: -60,
    /** a loud tail falling faster than this (dB/s) is a long-tail (release, FX), otherwise a stuck-tail */
    ringingDbPerSec: -6,
    /** loudness: allowed distance from the category target (LU), unless a rule sets its own */
    loudnessLu: 4,
    /** clicks: number of detected discontinuities that raises the flag */
    clicksMin: 1,
  },

  /** Click detector (scripts/audio-qa/metrics.cjs detectClicks) */
  clicks: {
    contextMs: 50, guardSamples: 3, isolation: 2.5, rmsRatio: 10, straightness: 4, floorDb: -50, relative: 0.02, quietDb: -60,
    /** abrupt ends: the last cutRecentMs within cutDropDb of the cutEarlierMs before, then cutPostMs below cutSilentDb */
    cutRecentMs: 0.5, cutEarlierMs: 5, cutDropDb: 12, cutPostMs: 10, cutSilentDb: -80,
  },

  excitation: {
    /** Seconds of playing before stop (transport: 2 bars at 120 BPM) */
    seconds: 4,
    /** Seconds captured after stop */
    tail: 2.5,
    /** Silence captured before the excitation (idle level) */
    preroll: 0.25,
    /** Wait after applying a preset before capturing (engines take messages, rebuild reverbs) */
    settleMs: 400,
    bpm: 120,
    /** On-screen keys and the computer keyboard play at full velocity */
    velocity: 1,
    /** Standard phrase: C2 C3 G3 C4 (MIDI 36 48 55 60) as 8ths at 120 BPM (375 ms gate), then C3 held to the stop */
    phrase: { notes: [36, 48, 55, 60], step: 0.5, gate: 0.375, hold: { note: 48, at: 2 } },
    /**
     * Registry categories (devices/index.ts) whose presets are patterns or decks: with a
     * transport control they are played with it even if they also map the computer keyboard.
     */
    transportFirstCategories: ['Groovebox', 'DJ Mixer'],
  },

  /** Between presets: wait until the instrument output is below floorDb for holdMs */
  quiet: { floorDb: -80, holdMs: 250, timeoutMs: 5000 },

  /**
   * Category targets. A preset's category is the part of its name before " / "
   * (DeviceHost groups the preset menu the same way); uncategorised presets are
   * matched by name. The first matching rule applies:
   *   offset    target = device median + offset (LU)
   *   tolerance allowed distance from the target (LU), default thresholds.loudnessLu
   *   sustain   true: the preset may keep sounding after stop (a drone); a loud tail is
   *             reported as a note instead of the stuck-tail flag
   * The device median is taken over presets without a rule offset (when there are 3+).
   */
  categories: [
    { name: 'FX', match: '\\b(fx|sfx|effects?|noise hits?|textures?|glitch(es)?|risers?|zaps?|lasers?|bleeps?)\\b', offset: -4 },
    { name: 'Drone / ambient', match: '\\b(drones?|ambient|ambience|atmos(phere)?|soundscape|wind)\\b', offset: -3, sustain: true },
  ],

  /** Per-device overrides, e.g. { "xone96": { "excite": "transport", "thresholds": { "loudnessLu": 6 } } } */
  devices: {
    // NOISE / VCF MOD makes the resonant filter crackle at a hit's onset (the lo-fi sound the
    // DFAM manual describes, p.12 and p.20). One such crackle in a render is character, not a
    // defect; real click bugs repeat. See devices/dfam/REVIEW.md.
    dfam: { thresholds: { clicksMin: 2 } },
    // Its presets set up a live input (level, monitoring); with no microphone or interface in a
    // headless browser it can only be silent
    'audio-in': { skip: 'plays a live audio input only' },
  },
};
