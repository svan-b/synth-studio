# Audio QA: DFAM (`dfam`)

Moog DFAM, 40 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-11-12T08:49:44.571Z against http://localhost:3100, app code at `a6675b9+local changes` (tool at `a6675b9`), Chromium 153.0.8010.12.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -19.0 LUFS | 11.8 LU (-27.8 to -16.1) | 1.6 LU | -1.2 dBTP | 0.0 LU | 0 of 40 |

Flags: none. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hats / Hat lengths per step · 1 cable | Hats | -16.1 | +1.9 | -15.3 | -1.6 | -5.6 | 0 | 0.0000 | 16.3 | 0 | -inf | 1.00 | -16.1 | ok |
| 2 | Metal / FM chime melody · 1 cable | Metal | -17.3 | +0.8 | -16.9 | -2.8 | -2.8 | 0 | 0.0000 | 16.2 | 0 | -inf | 1.00 | -17.3 | ok |
| 3 | Kick / 808 boom | Kick | -17.8 | +0.2 | -18.5 | -5.5 | -5.5 | 0 | 0.0001 | 12.0 | 0 | -80.9 | 1.00 | -17.8 | ok |
| 4 | Metal / Clanky FM sequence · 1 cable | Metal | -17.8 | +0.2 | -17.5 | -4.3 | -4.7 | 0 | 0.0000 | 17.3 | 0 | -inf | 1.00 | -17.8 | ok |
| 5 | Loop / Kick, snare and FM · 1 cable | Loop | -18.0 | -0.0 | -17.3 | -4.1 | -4.2 | 0 | 0.0001 | 13.1 | 1 | -inf | 1.00 | -18.0 | ok |
| 6 | Loop / Shuffle · 1 cable | Loop | -18.0 | -0.0 | -17.5 | -8.8 | -8.8 | 0 | 0.0000 | 8.6 | 0 | -193.7 | 1.00 | -18.0 | ok |
| 7 | Toms / Rolling toms · 2 cables | Toms | -18.0 | -0.0 | -17.6 | -11.2 | -11.2 | 0 | 0.0014 | 6.9 | 0 | -11.2 | 1.00 | -18.0 | ok |
| 8 | Metal / Cowbell | Metal | -18.5 | -0.5 | -18.4 | -2.8 | -2.8 | 0 | 0.0000 | 18.9 | 0 | -inf | 1.00 | -18.5 | ok |
| 9 | Bass / Soft unison bass | Bass | -18.5 | -0.5 | -18.1 | -8.6 | -8.6 | 0 | 0.0001 | 9.7 | 0 | -inf | 1.00 | -18.5 | ok |
| 10 | Metal / Sync bell | Metal | -18.5 | -0.5 | -18.3 | -13.9 | -14.0 | 0 | 0.0000 | 8.2 | 0 | -inf | 1.00 | -18.5 | ok |
| 11 | Bass / Acid line | Bass | -18.6 | -0.6 | -18.2 | -3.0 | -3.1 | 0 | 0.0000 | 16.9 | 0 | -inf | 1.00 | -18.6 | ok |
| 12 | Loop / Deep bounce · 1 cable | Loop | -18.7 | -0.7 | -18.4 | -6.0 | -6.0 | 0 | 0.0000 | 13.0 | 0 | -inf | 1.00 | -18.7 | ok |
| 13 | Kick / Techno rumble | Kick | -18.8 | -0.8 | -18.4 | -4.9 | -4.9 | 0 | 0.0001 | 12.1 | 0 | -inf | 1.00 | -18.8 | ok |
| 14 | Toms / Tom fill | Toms | -18.8 | -0.8 | -18.6 | -7.2 | -7.2 | 0 | 0.0000 | 13.1 | 0 | -inf | 1.00 | -18.8 | ok |
| 15 | Metal / FM clang · 1 cable | Metal | -18.9 | -0.9 | -18.6 | -8.6 | -8.6 | 0 | 0.0001 | 12.2 | 0 | -inf | 1.00 | -18.9 | ok |
| 16 | Hats / Shaker | Hats | -18.9 | -0.9 | -18.6 | -9.0 | -9.9 | 0 | 0.0000 | 15.1 | 0 | -inf | 1.00 | -18.9 | ok |
| 17 | Snare / Bright noise snare | Snare | -18.9 | -0.9 | -20.5 | -3.8 | -5.1 | 0 | 0.0000 | 21.7 | 0 | -inf | 1.00 | -18.9 | ok |
| 18 | Toms / Congas | Toms | -19.1 | -1.1 | -18.9 | -5.7 | -5.8 | 0 | 0.0001 | 15.4 | 0 | -inf | 1.00 | -19.1 | ok |
| 19 | Hats / Open hat | Hats | -19.1 | -1.1 | -19.1 | -6.0 | -7.9 | 0 | 0.0000 | 17.6 | 0 | -inf | 1.00 | -19.1 | ok |
| 20 | Toms / Vowel drum · 1 cable | Toms | -19.3 | -1.3 | -18.9 | -1.2 | -1.3 | 0 | 0.0007 | 15.7 | 0 | -inf | 1.00 | -19.3 | ok |
| 21 | Snare / Rimshot | Snare | -19.4 | -1.4 | -19.3 | -2.3 | -2.3 | 0 | 0.0000 | 20.6 | 0 | -inf | 1.00 | -19.4 | ok |
| 22 | Loop / Techno percussion | Loop | -19.8 | -1.8 | -19.3 | -3.8 | -3.8 | 0 | 0.0000 | 18.1 | 0 | -inf | 1.00 | -19.8 | ok |
| 23 | Kick / Punch kick | Kick | -19.8 | -1.8 | -19.6 | -2.4 | -2.4 | 0 | 0.0000 | 17.4 | 0 | -inf | 1.00 | -19.8 | ok |
| 24 | Kick / Analog kick | Kick | -19.9 | -1.9 | -19.9 | -3.2 | -3.2 | 0 | 0.0001 | 16.1 | 0 | -inf | 1.00 | -19.9 | ok |
| 25 | Toms / Bongos | Toms | -20.0 | -2.0 | -19.8 | -5.5 | -5.5 | 0 | 0.0000 | 16.6 | 0 | -inf | 1.00 | -20.0 | ok |
| 26 | Hats / Metallic hat | Hats | -20.0 | -2.0 | -19.7 | -3.8 | -4.5 | 0 | 0.0000 | 21.6 | 0 | -inf | 1.00 | -20.0 | ok |
| 27 | Loop / Pop percussion | Loop | -20.1 | -2.1 | -19.7 | -2.5 | -2.5 | 0 | 0.0000 | 19.3 | 0 | -inf | 1.00 | -20.1 | ok |
| 28 | Hats / Closed hat | Hats | -20.1 | -2.1 | -19.9 | -3.5 | -3.7 | 0 | 0.0000 | 22.5 | 0 | -inf | 1.00 | -20.1 | ok |
| 29 | Toms / Ringing filter toms · 1 cable | Toms | -20.1 | -2.1 | -19.1 | -9.0 | -9.0 | 0 | 0.0001 | 11.9 | 0 | -22.8 | 1.00 | -20.1 | ok |
| 30 | Bass / Accent bassline · 1 cable | Bass | -20.1 | -2.1 | -19.6 | -3.3 | -3.4 | 0 | 0.0001 | 16.1 | 0 | -inf | 1.00 | -20.1 | ok |
| 31 | Snare / Snappy snare | Snare | -20.3 | -2.3 | -20.7 | -3.4 | -3.4 | 0 | 0.0000 | 20.6 | 0 | -inf | 1.00 | -20.3 | ok |
| 32 | Bass / Rolling sub | Bass | -20.4 | -2.4 | -19.8 | -3.2 | -3.2 | 0 | 0.0000 | 15.4 | 0 | -inf | 1.00 | -20.4 | ok |
| 33 | Loop / Noise hits · 1 cable | Loop | -20.5 | -2.5 | -20.1 | -3.3 | -3.3 | 0 | 0.0000 | 22.7 | 0 | -inf | 1.00 | -20.5 | ok |
| 34 | Snare / Hand clap · 1 cable | Snare | -20.7 | -2.7 | -23.5 | -2.4 | -2.9 | 0 | 0.0000 | 26.1 | 0 | -inf | 1.00 | -20.7 | ok |
| 35 | FX / Audio-rate sequencer · 2 cables | FX | -22.2 | -0.2 | -21.9 | -14.1 | -14.2 | 0 | 0.0000 | 5.5 | 0 | -inf | 1.00 | -22.2 | ok |
| 36 | FX / Lo-fi crunch | FX | -22.6 | -0.6 | -22.5 | -6.8 | -6.9 | 0 | 0.0001 | 17.0 | 0 | -inf | 1.00 | -22.6 | ok |
| 37 | FX / Laser zap | FX | -22.7 | -0.7 | -22.6 | -12.8 | -12.9 | 0 | 0.0000 | 14.5 | 0 | -inf | 1.00 | -22.7 | ok |
| 38 | FX / Computer bleeps | FX | -22.7 | -0.7 | -22.3 | -4.9 | -5.0 | 0 | 0.0000 | 21.5 | 0 | -inf | 1.00 | -22.7 | ok |
| 39 | FX / Sync zap · 1 cable | FX | -23.0 | -1.0 | -22.7 | -16.0 | -16.3 | 0 | 0.0000 | 11.1 | 0 | -inf | 1.00 | -23.0 | ok |
| 40 | Init / Default settings | Init | -27.8 | +0.2 | -27.5 | -14.7 | -14.7 | 0 | 0.0000 | 14.4 | 0 | -inf | 1.00 | -27.8 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | Manual default settings | 1 | -28.0 | -27.8 | -27.8 | -27.8 | 0.0 | -8.8 | 0 |
| Kick | - | 4 | -18.0 | -19.3 | -19.9 | -17.8 | 2.0 | -0.3 | 0 |
| Snare | - | 4 | -18.0 | -19.8 | -20.7 | -18.9 | 1.8 | -0.8 | 0 |
| Hats | - | 5 | -18.0 | -19.1 | -20.1 | -16.1 | 4.1 | -0.1 | 0 |
| Toms | - | 6 | -18.0 | -19.2 | -20.1 | -18.0 | 2.1 | -0.2 | 0 |
| Metal | - | 5 | -18.0 | -18.5 | -18.9 | -17.3 | 1.6 | +0.6 | 0 |
| Bass | - | 4 | -18.0 | -19.3 | -20.4 | -18.5 | 1.9 | -0.3 | 0 |
| FX | FX | 5 | -22.0 | -22.7 | -23.0 | -22.2 | 0.8 | -3.7 | 0 |
| Loop | Triangle corners (manual patch sheet) | 6 | -18.0 | -19.3 | -20.5 | -18.0 | 2.5 | -0.3 | 0 |

## Flag details

- **Toms / Ringing filter toms** (`toms_filter_osc`)
  - note: keeps sounding after stop (-22.8 dBFS 2 s later), allowed for the Rings on (manual patch sheets) category
- **Toms / Rolling toms** (`toms_rolling`)
  - note: the previous preset was still at -51.8 dBFS when this one was applied
  - note: already sounding before the excitation (idle peak -11.3 dBFS)
  - note: keeps sounding after stop (-11.2 dBFS 2 s later), allowed for the Rings on (manual patch sheets) category

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (40 of 40 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

