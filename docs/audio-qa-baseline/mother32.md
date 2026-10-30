# Audio QA: Mother-32 (`mother32`)

Moog Mother-32, 43 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T17:03:49.729Z against http://localhost:3100, app code at `04019ab` (tool at `aa0a41a`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -18.1 LUFS | 8.9 LU (-24.2 to -15.2) | 1.5 LU | -1.8 dBTP | 0.0 LU | 0 of 43 |

Flags: none. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Drums / Ping filter · 3 cables | Drums | -15.2 | +2.8 | -14.9 | -2.4 | -2.5 | 0 | 0.0000 | 14.3 | 0 | -inf | 1.00 | -15.2 | ok |
| 2 | Drums / Drums and bass · 6 cables | Drums | -16.2 | +1.8 | -15.9 | -2.2 | -2.2 | 0 | 0.0000 | 16.1 | 0 | -inf | 1.00 | -16.2 | ok |
| 3 | Pad / Slow PWM pad · 1 cable | Pad | -16.8 | +1.3 | -16.2 | -11.7 | -11.7 | 0 | 0.0001 | 7.0 | 0 | -86.0 | 1.00 | -16.8 | ok |
| 4 | Bass / Rubber bass | Bass | -16.8 | +1.2 | -16.4 | -2.5 | -2.5 | 0 | 0.0000 | 15.5 | 0 | -inf | 1.00 | -16.8 | ok |
| 5 | Sequence / Pendulum arpeggio | Sequence | -16.8 | +1.2 | -16.3 | -5.1 | -5.1 | 0 | 0.0000 | 14.2 | 0 | -inf | 1.00 | -16.8 | ok |
| 6 | Drums / LFO kick · 2 cables | Drums | -16.9 | +1.1 | -16.4 | -3.6 | -3.6 | 0 | 0.0000 | 15.5 | 0 | -inf | 1.00 | -16.9 | ok |
| 7 | Sequence / Accented filter · 1 cable | Sequence | -17.2 | +0.8 | -16.7 | -2.3 | -2.4 | 0 | 0.0000 | 16.1 | 0 | -inf | 1.00 | -17.2 | ok |
| 8 | Bass / Sub bass | Bass | -17.2 | +0.8 | -16.9 | -6.8 | -6.8 | 0 | 0.0005 | 7.0 | 0 | -inf | 1.00 | -17.2 | ok |
| 9 | Bell / Envelope FM bell · 4 cables | Bell | -17.4 | +0.6 | -17.0 | -11.1 | -11.2 | 0 | 0.0000 | 8.5 | 0 | -67.1 | 1.00 | -17.4 | ok |
| 10 | Lead / PWM lead | Lead | -17.5 | +0.5 | -17.2 | -13.9 | -13.9 | 0 | 0.0000 | 6.0 | 0 | -104.2 | 1.00 | -17.5 | ok |
| 11 | Drums / Feedback filter kick · 2 cables | Drums | -17.6 | +0.4 | -17.4 | -3.4 | -3.4 | 0 | 0.0000 | 14.1 | 0 | -inf | 1.00 | -17.6 | ok |
| 12 | Lead / Vibrato lead · 1 cable | Lead | -17.7 | +0.3 | -17.3 | -7.7 | -7.7 | 0 | 0.0000 | 12.5 | 0 | -160.9 | 1.00 | -17.7 | ok |
| 13 | Lead / Play the filter · 2 cables | Lead | -17.7 | +0.3 | -17.3 | -15.7 | -15.7 | 0 | 0.0000 | 3.6 | 0 | -inf | 1.00 | -17.7 | ok |
| 14 | Sequence / Randomnation · 4 cables | Sequence | -17.7 | +0.3 | -17.1 | -3.1 | -3.1 | 0 | 0.0000 | 16.2 | 0 | -inf | 1.00 | -17.7 | ok |
| 15 | Lead / Two oscillators · 3 cables | Lead | -17.8 | +0.2 | -17.5 | -10.7 | -10.8 | 0 | 0.0000 | 8.5 | 0 | -inf | 1.00 | -17.8 | ok |
| 16 | Bell / Ring bell · 3 cables | Bell | -18.0 | 0.0 | -17.6 | -2.4 | -2.4 | 0 | 0.0000 | 18.2 | 0 | -173.0 | 1.00 | -18.0 | ok |
| 17 | Sequence / Random filter · 1 cable | Sequence | -18.0 | 0.0 | -17.6 | -2.6 | -2.7 | 0 | 0.0001 | 16.5 | 0 | -inf | 1.00 | -18.0 | ok |
| 18 | Drums / Electronic toms · 1 cable | Drums | -18.1 | -0.1 | -17.7 | -8.6 | -8.7 | 0 | 0.0000 | 11.5 | 0 | -inf | 1.00 | -18.1 | ok |
| 19 | Sequence / Random melody · 4 cables | Sequence | -18.1 | -0.1 | -17.7 | -2.1 | -2.1 | 0 | 0.0000 | 17.5 | 0 | -inf | 1.00 | -18.1 | ok |
| 20 | Bass / Pulse sequencer bass · 1 cable | Bass | -18.1 | -0.1 | -17.7 | -5.0 | -5.0 | 0 | 0.0000 | 11.0 | 0 | -inf | 1.00 | -18.1 | ok |
| 21 | Drums / Analog kick and snare · 5 cables | Drums | -18.1 | -0.1 | -17.6 | -2.0 | -2.0 | 0 | 0.0001 | 15.8 | 0 | -inf | 1.00 | -18.1 | ok |
| 22 | Sequence / Octave bounce | Sequence | -18.1 | -0.1 | -17.8 | -9.5 | -9.5 | 0 | 0.0000 | 10.5 | 0 | -inf | 1.00 | -18.1 | ok |
| 23 | Lead / Gate pitch jump · 2 cables | Lead | -18.1 | -0.1 | -17.8 | -10.6 | -10.6 | 0 | 0.0000 | 9.5 | 0 | -95.9 | 1.00 | -18.1 | ok |
| 24 | Sequence / Step scanner · 1 cable | Sequence | -18.2 | -0.2 | -17.7 | -6.4 | -6.4 | 0 | 0.0000 | 13.9 | 0 | -inf | 1.00 | -18.2 | ok |
| 25 | Brass / Saw and pulse stabs · 2 cables | Brass | -18.3 | -0.3 | -18.1 | -3.0 | -3.0 | 0 | 0.0001 | 16.4 | 0 | -inf | 1.00 | -18.3 | ok |
| 26 | Sequence / Gallop · 2 cables | Sequence | -18.4 | -0.4 | -18.1 | -8.7 | -8.7 | 0 | 0.0000 | 11.3 | 0 | -inf | 1.00 | -18.4 | ok |
| 27 | Init / Basic patch | Init | -18.7 | -0.7 | -18.3 | -8.4 | -8.5 | 0 | 0.0001 | 10.9 | 0 | -inf | 1.00 | -18.7 | ok |
| 28 | Sequence / Triplet swing interval | Sequence | -18.8 | -0.8 | -18.3 | -2.5 | -2.5 | 0 | 0.0000 | 17.6 | 0 | -inf | 1.00 | -18.8 | ok |
| 29 | Bass / Acid line | Bass | -18.8 | -0.8 | -18.3 | -9.4 | -9.5 | 0 | 0.0000 | 12.4 | 0 | -inf | 1.00 | -18.8 | ok |
| 30 | Bass / Ratchet acid | Bass | -18.9 | -0.9 | -18.6 | -6.7 | -6.7 | 0 | 0.0000 | 15.0 | 0 | -inf | 1.00 | -18.9 | ok |
| 31 | Drums / Kick and snare · 3 cables | Drums | -19.0 | -1.0 | -18.4 | -1.8 | -1.8 | 0 | 0.0000 | 18.2 | 0 | -inf | 1.00 | -19.0 | ok |
| 32 | Sequence / Clocked filter · 1 cable | Sequence | -19.1 | -1.1 | -18.8 | -9.4 | -9.6 | 0 | 0.0000 | 10.6 | 0 | -inf | 1.00 | -19.1 | ok |
| 33 | Bass / Tracked FM · 1 cable | Bass | -19.2 | -1.2 | -18.8 | -9.1 | -9.1 | 0 | 0.0000 | 11.4 | 0 | -inf | 1.00 | -19.2 | ok |
| 34 | Lead / Noise-attack pluck · 2 cables | Lead | -19.2 | -1.2 | -18.8 | -2.9 | -2.9 | 0 | 0.0000 | 18.3 | 0 | -inf | 1.00 | -19.2 | ok |
| 35 | FX / Laser zap | FX | -19.3 | +2.7 | -18.7 | -6.0 | -6.0 | 0 | 0.0000 | 16.9 | 0 | -inf | 1.00 | -19.3 | ok |
| 36 | Drone / 8-bit percussion · 2 cables | Drone | -19.6 | +1.4 | -19.3 | -11.0 | -11.7 | 0 | 0.0001 | 11.2 | 0 | -30.8 | 1.00 | -19.6 | ok |
| 37 | Bass / Modulated bass · 2 cables | Bass | -19.7 | -1.7 | -19.4 | -9.8 | -9.9 | 0 | 0.0000 | 11.0 | 0 | -inf | 1.00 | -19.7 | ok |
| 38 | Sequence / Chugging along · 1 cable | Sequence | -20.1 | -2.1 | -19.4 | -10.7 | -10.7 | 0 | 0.0001 | 11.0 | 0 | -inf | 1.00 | -20.1 | ok |
| 39 | Drone / Filter and VCO | Drone | -20.4 | +0.6 | -20.0 | -16.1 | -16.2 | 0 | 0.0003 | 6.6 | 0 | -16.6 | 1.00 | -20.4 | ok |
| 40 | Drums / Noise snare · 2 cables | Drums | -20.6 | -2.6 | -20.9 | -1.9 | -2.0 | 0 | 0.0000 | 22.7 | 0 | -inf | 1.00 | -20.6 | ok |
| 41 | Sequence / Swing house | Sequence | -20.8 | -2.8 | -20.5 | -9.4 | -9.4 | 0 | 0.0001 | 12.2 | 0 | -inf | 1.00 | -20.8 | ok |
| 42 | Drone / Wind | Drone | -21.5 | -0.5 | -20.6 | -14.3 | -14.4 | 0 | 0.0000 | 9.8 | 0 | -15.0 | 1.00 | -21.5 | ok |
| 43 | FX / High-pass feedback · 1 cable | FX | -24.2 | -2.2 | -23.7 | -16.3 | -16.4 | 0 | 0.0000 | 8.9 | 0 | -inf | 1.00 | -24.2 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | - | 1 | -18.0 | -18.7 | -18.7 | -18.7 | 0.0 | -0.6 | 0 |
| Bass | - | 7 | -18.0 | -18.8 | -19.7 | -16.8 | 2.9 | -0.7 | 0 |
| Lead | - | 6 | -18.0 | -17.8 | -19.2 | -17.5 | 1.7 | +0.3 | 0 |
| Brass | - | 1 | -18.0 | -18.3 | -18.3 | -18.3 | 0.0 | -0.2 | 0 |
| Bell | - | 2 | -18.0 | -17.7 | -18.0 | -17.4 | 0.6 | +0.4 | 0 |
| Drums | - | 8 | -18.0 | -17.8 | -20.6 | -15.2 | 5.4 | +0.3 | 0 |
| Drone | Drone / ambient | 3 | -21.0 | -20.4 | -21.5 | -19.6 | 1.9 | -2.3 | 0 |
| Sequence | - | 12 | -18.0 | -18.2 | -20.8 | -16.8 | 4.1 | -0.1 | 0 |
| Pad | - | 1 | -18.0 | -16.8 | -16.8 | -16.8 | 0.0 | +1.4 | 0 |
| FX | FX | 2 | -22.0 | -21.7 | -24.2 | -19.3 | 4.9 | -3.6 | 0 |

## Flag details

- **Drone / 8-bit percussion** (`drum_bit_crunch`)
  - note: already sounding before the excitation (idle peak -32.1 dBFS)
  - note: keeps sounding after stop (-30.8 dBFS 2 s later), allowed for the Drone / ambient category
- **Drums / Ping filter** (`drum_ping`)
  - note: the previous preset was still at -46.6 dBFS when this one was applied
- **Drone / Wind** (`drone_wind`)
  - note: already sounding before the excitation (idle peak -14.4 dBFS)
  - note: keeps sounding after stop (-15.0 dBFS 2 s later), allowed for the Drone / ambient category
- **Drone / Filter and VCO** (`drone_beating`)
  - note: the previous preset was still at -23.5 dBFS when this one was applied
  - note: already sounding before the excitation (idle peak -16.6 dBFS)
  - note: keeps sounding after stop (-16.6 dBFS 2 s later), allowed for the Drone / ambient category
- **FX / High-pass feedback** (`hp_resonant`)
  - note: the previous preset was still at -16.6 dBFS when this one was applied

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (43 of 43 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

