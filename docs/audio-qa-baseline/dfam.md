# Audio QA: DFAM (`dfam`)

Moog DFAM, 40 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T16:58:02.412Z against http://localhost:3100, app code at `04019ab` (tool at `aa0a41a`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -19.1 LUFS | 5.2 LU (-23.0 to -17.8) | 1.5 LU | -2.2 dBTP | 0.0 LU | 0 of 40 |

Flags: none. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kick / 808 boom | Kick | -17.8 | +0.2 | -18.5 | -5.6 | -5.6 | 0 | 0.0001 | 11.9 | 0 | -80.7 | 1.00 | -17.8 | ok |
| 2 | Metal / Clanky FM sequence · 1 cable | Metal | -18.4 | -0.4 | -18.0 | -4.3 | -4.3 | 0 | 0.0002 | 15.7 | 0 | -inf | 1.00 | -18.4 | ok |
| 3 | Metal / Cowbell | Metal | -18.5 | -0.5 | -18.4 | -2.9 | -2.9 | 0 | 0.0000 | 18.8 | 0 | -inf | 1.00 | -18.5 | ok |
| 4 | Metal / Sync bell | Metal | -18.6 | -0.6 | -18.3 | -14.1 | -14.1 | 0 | 0.0001 | 8.0 | 0 | -inf | 1.00 | -18.6 | ok |
| 5 | Toms / Ringing filter toms · 1 cable | Toms | -18.6 | -0.6 | -18.4 | -8.9 | -9.0 | 0 | 0.0000 | 12.7 | 0 | -inf | 1.00 | -18.6 | ok |
| 6 | Toms / Tom fill | Toms | -18.6 | -0.6 | -18.4 | -7.3 | -7.3 | 0 | 0.0000 | 12.8 | 0 | -inf | 1.00 | -18.6 | ok |
| 7 | Bass / Acid line | Bass | -18.6 | -0.6 | -18.3 | -4.0 | -4.0 | 0 | 0.0000 | 16.0 | 0 | -inf | 1.00 | -18.6 | ok |
| 8 | Loop / Deep bounce · 1 cable | Loop | -18.8 | -0.8 | -18.5 | -6.0 | -6.0 | 0 | 0.0000 | 12.9 | 0 | -inf | 1.00 | -18.8 | ok |
| 9 | Kick / Techno rumble | Kick | -18.8 | -0.8 | -18.4 | -4.8 | -4.8 | 0 | 0.0000 | 12.2 | 0 | -inf | 1.00 | -18.8 | ok |
| 10 | Metal / FM clang · 1 cable | Metal | -18.8 | -0.8 | -18.5 | -8.7 | -8.7 | 0 | 0.0001 | 12.0 | 0 | -inf | 1.00 | -18.8 | ok |
| 11 | Toms / Rolling toms · 2 cables | Toms | -18.8 | -0.8 | -18.4 | -5.6 | -5.6 | 0 | 0.0000 | 14.6 | 0 | -inf | 1.00 | -18.8 | ok |
| 12 | Hats / Hat lengths per step · 1 cable | Hats | -18.9 | -0.9 | -18.5 | -4.9 | -6.8 | 0 | 0.0000 | 17.9 | 0 | -inf | 1.00 | -18.9 | ok |
| 13 | Snare / Bright noise snare | Snare | -18.9 | -0.9 | -20.5 | -4.1 | -5.1 | 0 | 0.0000 | 21.7 | 0 | -inf | 1.00 | -18.9 | ok |
| 14 | Hats / Shaker | Hats | -18.9 | -0.9 | -18.6 | -8.3 | -9.4 | 0 | 0.0000 | 15.6 | 0 | -inf | 1.00 | -18.9 | ok |
| 15 | Bass / Soft unison bass | Bass | -19.0 | -1.0 | -17.9 | -8.6 | -8.6 | 0 | 0.0000 | 10.7 | 0 | -inf | 1.00 | -19.0 | ok |
| 16 | Loop / Kick, snare and FM · 1 cable | Loop | -19.0 | -1.0 | -18.7 | -2.4 | -2.4 | 0 | 0.0001 | 17.6 | 0 | -inf | 1.00 | -19.0 | ok |
| 17 | Toms / Congas | Toms | -19.1 | -1.1 | -18.9 | -5.8 | -5.8 | 0 | 0.0000 | 15.4 | 0 | -inf | 1.00 | -19.1 | ok |
| 18 | Hats / Open hat | Hats | -19.1 | -1.1 | -19.1 | -6.6 | -7.9 | 0 | 0.0000 | 17.6 | 0 | -inf | 1.00 | -19.1 | ok |
| 19 | Loop / Shuffle · 1 cable | Loop | -19.2 | -1.2 | -18.8 | -2.3 | -2.8 | 0 | 0.0000 | 22.4 | 0 | -inf | 1.00 | -19.2 | ok |
| 20 | Metal / FM chime melody · 1 cable | Metal | -19.2 | -1.2 | -18.9 | -5.3 | -5.4 | 0 | 0.0000 | 16.6 | 0 | -inf | 1.00 | -19.2 | ok |
| 21 | Snare / Rimshot | Snare | -19.4 | -1.4 | -19.3 | -2.4 | -2.4 | 0 | 0.0000 | 20.5 | 0 | -inf | 1.00 | -19.4 | ok |
| 22 | Hats / Metallic hat | Hats | -19.7 | -1.7 | -19.4 | -3.1 | -3.9 | 0 | 0.0000 | 21.8 | 0 | -inf | 1.00 | -19.7 | ok |
| 23 | Loop / Techno percussion | Loop | -19.8 | -1.8 | -19.4 | -3.8 | -3.9 | 0 | 0.0000 | 18.1 | 0 | -inf | 1.00 | -19.8 | ok |
| 24 | Kick / Punch kick | Kick | -19.8 | -1.8 | -19.6 | -2.4 | -2.4 | 0 | 0.0000 | 17.4 | 0 | -inf | 1.00 | -19.8 | ok |
| 25 | Kick / Analog kick | Kick | -19.9 | -1.9 | -19.9 | -3.2 | -3.2 | 0 | 0.0003 | 16.0 | 0 | -inf | 1.00 | -19.8 | ok |
| 26 | Bass / Accent bassline · 1 cable | Bass | -19.9 | -1.9 | -19.6 | -2.2 | -2.2 | 0 | 0.0008 | 17.3 | 0 | -inf | 1.00 | -19.9 | ok |
| 27 | Toms / Bongos | Toms | -20.0 | -2.0 | -19.8 | -5.5 | -5.5 | 0 | 0.0000 | 16.6 | 0 | -inf | 1.00 | -20.0 | ok |
| 28 | Loop / Pop percussion | Loop | -20.1 | -2.1 | -19.7 | -2.4 | -2.7 | 0 | 0.0000 | 19.1 | 0 | -inf | 1.00 | -20.1 | ok |
| 29 | Hats / Closed hat | Hats | -20.1 | -2.1 | -20.0 | -3.2 | -3.8 | 0 | 0.0000 | 22.6 | 0 | -inf | 1.00 | -20.1 | ok |
| 30 | Init / Default patch | Init | -20.3 | -2.3 | -20.1 | -10.1 | -10.2 | 0 | 0.0001 | 11.5 | 0 | -inf | 1.00 | -20.3 | ok |
| 31 | Bass / Rolling sub | Bass | -20.4 | -2.4 | -19.8 | -2.5 | -2.6 | 0 | 0.0000 | 16.0 | 0 | -inf | 1.00 | -20.4 | ok |
| 32 | Toms / Vowel drum · 1 cable | Toms | -20.5 | -2.5 | -20.3 | -3.7 | -3.7 | 0 | 0.0002 | 17.1 | 0 | -inf | 1.00 | -20.5 | ok |
| 33 | Loop / Noise hits · 1 cable | Loop | -20.6 | -2.6 | -20.3 | -2.9 | -3.8 | 0 | 0.0000 | 22.3 | 0 | -inf | 1.00 | -20.6 | ok |
| 34 | Snare / Snappy snare | Snare | -20.7 | -2.7 | -20.9 | -2.9 | -3.0 | 0 | 0.0000 | 21.1 | 0 | -inf | 1.00 | -20.7 | ok |
| 35 | Snare / Hand clap · 1 cable | Snare | -20.8 | -2.8 | -23.8 | -2.4 | -2.8 | 0 | 0.0000 | 26.3 | 0 | -inf | 1.00 | -20.8 | ok |
| 36 | FX / Lo-fi crunch | FX | -22.7 | -0.7 | -22.6 | -7.1 | -7.1 | 0 | 0.0001 | 16.8 | 0 | -inf | 1.00 | -22.7 | ok |
| 37 | FX / Laser zap | FX | -22.7 | -0.7 | -22.6 | -12.8 | -12.9 | 0 | 0.0000 | 14.6 | 0 | -inf | 1.00 | -22.7 | ok |
| 38 | FX / Computer bleeps | FX | -22.7 | -0.7 | -22.3 | -4.9 | -5.0 | 0 | 0.0000 | 21.5 | 0 | -inf | 1.00 | -22.7 | ok |
| 39 | FX / Audio-rate sequencer · 2 cables | FX | -22.8 | -0.8 | -22.4 | -17.6 | -17.6 | 0 | 0.0000 | 4.9 | 0 | -inf | 1.00 | -22.8 | ok |
| 40 | FX / Sync zap · 1 cable | FX | -23.0 | -1.0 | -22.7 | -16.1 | -16.2 | 0 | 0.0000 | 11.2 | 0 | -inf | 1.00 | -23.0 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | - | 1 | -18.0 | -20.3 | -20.3 | -20.3 | 0.0 | -1.2 | 0 |
| Kick | - | 4 | -18.0 | -19.3 | -19.9 | -17.8 | 2.0 | -0.2 | 0 |
| Snare | - | 4 | -18.0 | -20.0 | -20.8 | -18.9 | 1.9 | -0.9 | 0 |
| Hats | - | 5 | -18.0 | -19.1 | -20.1 | -18.9 | 1.3 | 0.0 | 0 |
| Toms | - | 6 | -18.0 | -18.9 | -20.5 | -18.6 | 1.9 | +0.2 | 0 |
| Metal | - | 5 | -18.0 | -18.6 | -19.2 | -18.4 | 0.8 | +0.6 | 0 |
| Bass | - | 4 | -18.0 | -19.4 | -20.4 | -18.6 | 1.7 | -0.3 | 0 |
| FX | FX | 5 | -22.0 | -22.7 | -23.0 | -22.7 | 0.3 | -3.6 | 0 |
| Loop | - | 6 | -18.0 | -19.5 | -20.6 | -18.8 | 1.9 | -0.4 | 0 |

## Flag details

No flags.

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (40 of 40 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

