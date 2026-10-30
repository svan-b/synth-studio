# Audio QA: Xone:96 (`xone96`)

Allen & Heath Xone:96, 21 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T17:28:52.026Z against http://localhost:3100, app code at `04019ab` (tool at `aa0a41a`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -18.6 LUFS | 5.7 LU (-21.5 to -15.8) | 0.8 LU | -1.7 dBTP | 0.0 LU | 0 of 21 |

Flags: none. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DJ / Filter build (HPF) | DJ | -15.8 | +2.2 | -15.2 | -1.7 | -1.8 | 0 | 0.0000 | 16.5 | 0 | -inf | 0.93 | -15.8 | ok |
| 2 | Cue / Split-cue headphones | Cue | -16.6 | +1.4 | -16.3 | -2.9 | -2.9 | 0 | 0.0013 | 14.6 | 0 | -inf | 0.49 | -16.6 | ok |
| 3 | DJ / Low-pass breakdown | DJ | -17.4 | +0.6 | -17.1 | -5.8 | -5.8 | 0 | 0.0012 | 12.1 | 0 | -inf | 1.00 | -17.4 | ok |
| 4 | Cue / Back to back: two cue systems | Cue | -17.9 | +0.1 | -17.6 | -3.8 | -3.8 | 0 | 0.0004 | 15.4 | 0 | -inf | 0.98 | -17.9 | ok |
| 5 | Stems / Stem jam with FX returns | Stems | -18.1 | -0.1 | -17.8 | -3.1 | -3.2 | 0 | 0.0004 | 16.6 | 0 | -86.2 | 0.99 | -18.1 | ok |
| 6 | Gain / Overdriven channel (what not to do) | Gain | -18.2 | -0.2 | -17.9 | -7.8 | -7.8 | 0 | 0.0005 | 10.9 | 0 | -inf | 1.00 | -18.2 | ok |
| 7 | Studio / Route the Elektrons in | Studio | -18.5 | -0.5 | -18.2 | -5.0 | -5.3 | 0 | 0.0004 | 14.3 | 0 | -103.1 | 1.00 | -18.5 | ok |
| 8 | DJ / Blend-ready: two decks | DJ | -18.5 | -0.5 | -18.2 | -4.3 | -4.3 | 0 | 0.0004 | 15.4 | 0 | -inf | 1.00 | -18.5 | ok |
| 9 | Studio / Full-track mix-down | Studio | -18.6 | -0.6 | -18.2 | -5.3 | -5.4 | 0 | 0.0003 | 14.7 | 0 | -69.2 | 0.99 | -18.6 | ok |
| 10 | Init / Clean slate | Init | -18.6 | -0.6 | -18.3 | -5.5 | -5.5 | 0 | 0.0004 | 14.2 | 0 | -inf | 1.00 | -18.6 | ok |
| 11 | Stems / Kick vs bass: carved low end | Stems | -18.7 | -0.7 | -18.4 | -3.8 | -4.1 | 0 | 0.0003 | 15.8 | 0 | -inf | 1.00 | -18.7 | ok |
| 12 | DJ / Cross-filter swap | DJ | -18.8 | -0.8 | -18.5 | -5.9 | -6.1 | 0 | 0.0000 | 13.8 | 0 | -inf | 1.00 | -18.8 | ok |
| 13 | DJ / Bass swap | DJ | -18.8 | -0.8 | -18.6 | -5.1 | -5.1 | 0 | 0.0003 | 15.0 | 0 | -inf | 1.00 | -18.8 | ok |
| 14 | DJ / Fast-cut chops | DJ | -18.8 | -0.8 | -18.7 | -7.4 | -7.5 | 0 | 0.0002 | 12.5 | 0 | -inf | 1.00 | -18.8 | ok |
| 15 | Cue / Booth monitor tuning | Cue | -18.9 | -0.9 | -18.6 | -4.9 | -5.0 | 0 | 0.0003 | 15.6 | 0 | -inf | 1.00 | -18.9 | ok |
| 16 | Filter / Notch sweep (HPF + LPF together) | Filter | -18.9 | -0.9 | -18.6 | -3.0 | -3.1 | 0 | 0.0003 | 17.2 | 0 | -inf | 0.99 | -18.9 | ok |
| 17 | Cue / MC on the mic (clean feed) | Cue | -19.1 | -1.1 | -18.7 | -6.5 | -6.7 | 0 | 0.0003 | 13.8 | 0 | -inf | 1.00 | -19.1 | ok |
| 18 | FX / Dub delay throw | FX | -20.6 | +1.4 | -20.4 | -7.3 | -7.5 | 0 | 0.0001 | 14.4 | 0 | -85.3 | 1.00 | -20.6 | ok |
| 19 | FX / Pre-fade echo ghost | FX | -20.7 | +1.3 | -20.5 | -9.6 | -9.6 | 0 | 0.0002 | 12.2 | 0 | -64.5 | 1.00 | -20.7 | ok |
| 20 | Filter / Telephone breakdown (BPF + CRUNCH) | Filter | -21.0 | -3.0 | -20.5 | -7.5 | -7.5 | 0 | 0.0000 | 16.6 | 0 | -inf | 0.93 | -21.0 | ok |
| 21 | FX / Reverb wash | FX | -21.5 | +0.5 | -21.1 | -10.3 | -10.3 | 0 | 0.0001 | 12.5 | 0 | -91.2 | 0.96 | -21.5 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | - | 1 | -18.0 | -18.6 | -18.6 | -18.6 | 0.0 | -0.0 | 0 |
| DJ | - | 6 | -18.0 | -18.7 | -18.8 | -15.8 | 3.0 | -0.1 | 0 |
| Filter | - | 2 | -18.0 | -19.9 | -21.0 | -18.9 | 2.1 | -1.4 | 0 |
| FX | FX | 3 | -22.0 | -20.7 | -21.5 | -20.6 | 0.9 | -2.2 | 0 |
| Stems | - | 2 | -18.0 | -18.4 | -18.7 | -18.1 | 0.6 | +0.2 | 0 |
| Gain | - | 1 | -18.0 | -18.2 | -18.2 | -18.2 | 0.0 | +0.4 | 0 |
| Cue | - | 4 | -18.0 | -18.4 | -19.1 | -16.6 | 2.5 | +0.1 | 0 |
| Studio | - | 2 | -18.0 | -18.5 | -18.6 | -18.5 | 0.0 | +0.0 | 0 |

## Flag details

No flags.

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (21 of 21 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

