# Audio QA: Subharmonicon (`subharmonicon`)

Moog Subharmonicon, 36 presets. Excitation **audition** (the module's own audition()), 4 s + 2.5 s tail, 44100 Hz. Instrument output: stereo.

Run 2026-10-29T17:08:56.897Z against http://localhost:3100, app code at `04019ab` (tool at `aa0a41a`), Chromium 141.0.7390.37.

| Median | Spread | IQR | Max true peak | Master vs instrument | Flagged |
|---|---|---|---|---|---|
| -18.4 LUFS | 5.6 LU (-22.2 to -16.6) | 2.2 LU | -1.5 dBTP | 0.0 LU | 0 of 36 |

Flags: none. Loudness reference: -18.0 LUFS (fixed target).

## Presets by loudness

| # | Preset | Category | LUFS | vs target | ST max | TP dBTP | Peak dBFS | Clip | DC | Crest dB | Clicks | Tail dBFS | Corr | Master LUFS | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rhythm / Marching sub clicks · 2 cables | Rhythm | -16.6 | +1.4 | -16.0 | -1.6 | -1.7 | 0 | 0.0000 | 19.3 | 0 | -187.8 | 1.00 | -16.6 | ok |
| 2 | Rhythm / Self-tripping cross-sequence · 5 cables | Rhythm | -17.2 | +0.8 | -16.6 | -9.0 | -9.4 | 0 | 0.0000 | 11.1 | 0 | -inf | 1.00 | -17.2 | ok |
| 3 | Tutorial / Sequenced filter drums · 1 cable | Tutorial | -17.4 | +0.6 | -17.5 | -2.2 | -2.2 | 0 | 0.0000 | 17.9 | 0 | -195.4 | 1.00 | -17.4 | ok |
| 4 | Tutorial / First sequence | Tutorial | -17.5 | +0.5 | -17.2 | -6.1 | -6.2 | 0 | 0.0000 | 15.1 | 0 | -inf | 1.00 | -17.5 | ok |
| 5 | Tutorial / Sequencer transposes sequencer · 1 cable | Tutorial | -17.6 | +0.4 | -17.3 | -6.0 | -6.0 | 0 | 0.0000 | 15.1 | 0 | -inf | 1.00 | -17.6 | ok |
| 6 | Drums / Filter-ping kit · 4 cables | Drums | -17.9 | +0.1 | -17.7 | -2.4 | -2.5 | 0 | 0.0000 | 17.7 | 0 | -183.9 | 1.00 | -17.9 | ok |
| 7 | Pad / Slow-bloom duet · 2 cables | Pad | -17.9 | +0.1 | -18.5 | -10.1 | -10.1 | 0 | 0.0000 | 13.3 | 0 | -166.2 | 1.00 | -17.9 | ok |
| 8 | Tutorial / Envelope-accelerated clock · 3 cables | Tutorial | -17.9 | +0.1 | -17.6 | -7.8 | -7.9 | 0 | 0.0000 | 14.3 | 0 | -inf | 1.00 | -17.9 | ok |
| 9 | Lead / Envelope PWM · 1 cable | Lead | -18.0 | +0.0 | -17.7 | -4.8 | -4.8 | 0 | 0.0002 | 14.5 | 0 | -134.8 | 1.00 | -18.0 | ok |
| 10 | Melody / Undertone step dance · 3 cables | Melody | -18.1 | -0.1 | -18.8 | -1.6 | -1.6 | 0 | 0.0000 | 20.0 | 0 | -176.1 | 1.00 | -18.1 | ok |
| 11 | Init / Default patch | Init | -18.3 | -0.3 | -18.1 | -3.2 | -3.3 | 0 | 0.0000 | 17.5 | 0 | -179.1 | 1.00 | -18.3 | ok |
| 12 | Ambient / Accelerating spiral · 1 cable | Ambient | -18.4 | +2.6 | -18.1 | -9.3 | -9.3 | 0 | 0.0000 | 10.9 | 0 | -67.4 | 1.00 | -18.4 | ok |
| 13 | Groove / Polyrhythm chord stabs · 1 cable | Groove | -18.6 | -0.6 | -19.9 | -1.5 | -1.5 | 0 | 0.0001 | 21.0 | 0 | -182.8 | 1.00 | -18.6 | ok |
| 14 | Polyrhythm / 3 against 4 | Polyrhythm | -18.7 | -0.7 | -18.5 | -1.8 | -1.8 | 0 | 0.0001 | 18.9 | 0 | -175.4 | 1.00 | -18.7 | ok |
| 15 | Tutorial / Sub-modulated drum machine · 3 cables | Tutorial | -18.8 | -0.8 | -18.3 | -2.1 | -2.1 | 0 | 0.0000 | 19.3 | 0 | -192.0 | 1.00 | -18.8 | ok |
| 16 | FX / Buzzing cross-mod swarm · 3 cables | FX | -18.9 | +3.1 | -18.3 | -1.8 | -1.8 | 0 | 0.0000 | 20.5 | 0 | -187.6 | 1.00 | -18.9 | ok |
| 17 | Bass / Shuffled sub bassline · 2 cables | Bass | -19.0 | -1.0 | -19.1 | -1.7 | -1.7 | 0 | 0.0000 | 19.4 | 0 | -184.1 | 1.00 | -19.0 | ok |
| 18 | Drone / Octave-shifting fuzz bass · 2 cables | Drone | -19.1 | +1.9 | -18.8 | -1.9 | -1.9 | 0 | 0.0001 | 18.1 | 0 | -26.2 | 1.00 | -19.1 | ok |
| 19 | Tutorial / First polyrhythm | Tutorial | -19.4 | -1.4 | -18.8 | -2.6 | -2.8 | 0 | 0.0000 | 20.4 | 0 | -inf | 1.00 | -19.4 | ok |
| 20 | FX / Folded high chimes · 3 cables | FX | -19.8 | +2.2 | -19.4 | -8.6 | -8.6 | 0 | 0.0000 | 17.1 | 0 | -179.6 | 1.00 | -19.8 | ok |
| 21 | Bass / Square sub bass | Bass | -19.9 | -1.9 | -19.8 | -1.6 | -1.7 | 0 | 0.0000 | 18.3 | 0 | -185.8 | 1.00 | -19.9 | ok |
| 22 | Texture / Winding two-sequencer line · 2 cables | Texture | -19.9 | +2.1 | -19.6 | -1.6 | -1.6 | 0 | 0.0000 | 20.2 | 0 | -183.6 | 1.00 | -19.9 | ok |
| 23 | Polyrhythm / Missing downbeat (XOR) | Polyrhythm | -20.0 | -2.0 | -19.8 | -2.0 | -2.1 | 0 | 0.0000 | 18.8 | 0 | -181.8 | 1.00 | -20.0 | ok |
| 24 | Polyrhythm / Hemiola 2+3 (OR) | Polyrhythm | -20.0 | -2.0 | -19.8 | -2.1 | -2.1 | 0 | 0.0002 | 18.7 | 0 | -174.5 | 1.00 | -20.0 | ok |
| 25 | Arp / Hand-faded harmony arp · 2 cables | Arp | -20.0 | -2.0 | -19.5 | -1.7 | -1.7 | 0 | 0.0001 | 19.4 | 0 | -173.6 | 1.00 | -20.0 | ok |
| 26 | Ambient / Driven pulse swell · 2 cables | Ambient | -20.2 | +0.8 | -19.7 | -9.9 | -9.9 | 0 | 0.0001 | 11.9 | 0 | -73.8 | 1.00 | -20.2 | ok |
| 27 | Ambient / Percolating high clusters · 2 cables | Ambient | -20.2 | +0.8 | -19.6 | -11.8 | -11.9 | 0 | 0.0000 | 10.0 | 0 | -40.6 | 1.00 | -20.2 | ok |
| 28 | Chords / Bubbling sub chords · 2 cables | Chords | -20.4 | -2.4 | -19.9 | -3.8 | -3.8 | 0 | 0.0000 | 18.2 | 0 | -196.1 | 1.00 | -20.4 | ok |
| 29 | FX / Clinking sub clatter · 1 cable | FX | -20.8 | +1.2 | -20.1 | -1.7 | -1.7 | 0 | 0.0001 | 19.4 | 0 | -165.2 | 1.00 | -20.8 | ok |
| 30 | Rhythm / Sub-gated dial tones · 4 cables | Rhythm | -21.0 | -3.0 | -21.4 | -2.5 | -2.7 | 0 | 0.0000 | 23.7 | 0 | -199.4 | 1.00 | -21.0 | ok |
| 31 | Drone / Initialized patch (EG held) | Drone | -21.0 | 0.0 | -21.0 | -23.0 | -23.1 | 0 | 0.0000 | 1.6 | 0 | -23.1 | 1.00 | -21.0 | ok |
| 32 | Drone / Undertone minor | Drone | -21.0 | -0.0 | -21.0 | -14.6 | -14.6 | 0 | 0.0000 | 8.6 | 0 | -14.6 | 1.00 | -21.0 | ok |
| 33 | Drone / Same chord in 12-ET | Drone | -21.0 | -0.0 | -21.0 | -13.0 | -13.1 | 0 | 0.0001 | 9.8 | 0 | -14.3 | 1.00 | -21.0 | ok |
| 34 | Ambient / Eerie fourths in pulse · 3 cables | Ambient | -21.4 | -0.4 | -23.8 | -7.8 | -7.8 | 0 | 0.0000 | 17.3 | 0 | -62.2 | 1.00 | -21.4 | ok |
| 35 | Drone / Just major lattice | Drone | -21.9 | -0.9 | -21.8 | -14.9 | -14.9 | 0 | 0.0001 | 8.8 | 0 | -16.8 | 1.00 | -21.9 | ok |
| 36 | FX / Tone and breath duet · 2 cables | FX | -22.2 | -0.2 | -21.9 | -9.2 | -9.2 | 0 | 0.0000 | 15.3 | 0 | -171.4 | 1.00 | -22.2 | ok |

## Categories

| Category | Rule | Presets | Target LUFS | Median | Min | Max | Spread LU | vs device | Flagged |
|---|---|---|---|---|---|---|---|---|---|
| Init | - | 1 | -18.0 | -18.3 | -18.3 | -18.3 | 0.0 | +0.1 | 0 |
| Drone | Drone / ambient | 5 | -21.0 | -21.0 | -21.9 | -19.1 | 2.7 | -2.6 | 0 |
| Tutorial | - | 6 | -18.0 | -17.7 | -19.4 | -17.4 | 1.9 | +0.7 | 0 |
| Chords | - | 1 | -18.0 | -20.4 | -20.4 | -20.4 | 0.0 | -2.0 | 0 |
| Arp | - | 1 | -18.0 | -20.0 | -20.0 | -20.0 | 0.0 | -1.5 | 0 |
| Rhythm | - | 3 | -18.0 | -17.2 | -21.0 | -16.6 | 4.4 | +1.3 | 0 |
| Ambient | Drone / ambient | 4 | -21.0 | -20.2 | -21.4 | -18.4 | 3.1 | -1.8 | 0 |
| Texture | FX | 1 | -22.0 | -19.9 | -19.9 | -19.9 | 0.0 | -1.5 | 0 |
| Drums | - | 1 | -18.0 | -17.9 | -17.9 | -17.9 | 0.0 | +0.6 | 0 |
| Groove | - | 1 | -18.0 | -18.6 | -18.6 | -18.6 | 0.0 | -0.1 | 0 |
| Pad | - | 1 | -18.0 | -17.9 | -17.9 | -17.9 | 0.0 | +0.6 | 0 |
| FX | FX | 4 | -22.0 | -20.3 | -22.2 | -18.9 | 3.3 | -1.8 | 0 |
| Bass | - | 2 | -18.0 | -19.5 | -19.9 | -19.0 | 0.9 | -1.0 | 0 |
| Melody | - | 1 | -18.0 | -18.1 | -18.1 | -18.1 | 0.0 | +0.3 | 0 |
| Polyrhythm | - | 3 | -18.0 | -20.0 | -20.0 | -18.7 | 1.2 | -1.5 | 0 |
| Lead | - | 1 | -18.0 | -18.0 | -18.0 | -18.0 | 0.0 | +0.5 | 0 |

## Flag details

- **Drone / Initialized patch (EG held)** (`pwi_init`)
  - note: already sounding before the excitation (idle peak -23.1 dBFS)
  - note: keeps sounding after stop (-23.1 dBFS 2 s later), allowed for the Drone / ambient category
- **Tutorial / First sequence** (`pwi_first`)
  - note: the previous preset was still at -23.1 dBFS when this one was applied
- **Tutorial / Envelope-accelerated clock** (`pwi_envclock`)
  - note: already sounding before the excitation (idle peak -8.1 dBFS)
- **Ambient / Percolating high clusters** (`man_stargate`)
  - note: keeps sounding after stop (-40.6 dBFS 2 s later), allowed for the Drone / ambient category
- **Groove / Polyrhythm chord stabs** (`man_polyrock`)
  - note: the previous preset was still at -79.9 dBFS when this one was applied
- **Drone / Octave-shifting fuzz bass** (`xpb_octave`)
  - note: already sounding before the excitation (idle peak -26.2 dBFS)
  - note: keeps sounding after stop (-26.2 dBFS 2 s later), allowed for the Drone / ambient category
- **Drone / Just major lattice** (`ji_major`)
  - note: already sounding before the excitation (idle peak -15.7 dBFS)
  - note: keeps sounding after stop (-16.8 dBFS 2 s later), allowed for the Drone / ambient category
- **Drone / Same chord in 12-ET** (`ji_major_et`)
  - note: the previous preset was still at -16.3 dBFS when this one was applied
  - note: already sounding before the excitation (idle peak -13.1 dBFS)
  - note: keeps sounding after stop (-14.3 dBFS 2 s later), allowed for the Drone / ambient category
- **Drone / Undertone minor** (`drone_minor`)
  - note: the previous preset was still at -15.9 dBFS when this one was applied
  - note: already sounding before the excitation (idle peak -14.6 dBFS)
  - note: keeps sounding after stop (-14.6 dBFS 2 s later), allowed for the Drone / ambient category
- **Polyrhythm / Hemiola 2+3 (OR)** (`poly_or`)
  - note: the previous preset was still at -14.6 dBFS when this one was applied

## Suggested gain changes

No loudness outliers.

## Method

- Each preset is applied through the instrument's preset menu, exactly as a user picks it (36 of 36 via the menu), with the device as the only rack instrument. Between presets: stop all, all notes off, cables cleared, wait for silence.
- Taps: the hub slot's `outGain` (the instrument's own output, before the master) and every node feeding the AudioDestination (the master, after its limiter), both through one AudioWorklet capture node.
- Excitation: hub.audition() for 4 s, then hub.stopAudition().
- Loudness: ITU-R BS.1770-4 integrated (gated), max short-term (3 s). True peak: BS.1770-4 Annex 2, 4x oversampled. DC over the excitation window and the last 0.5 s. Crest factor over the excitation window. Clicks: isolated sample-difference spikes (see docs/AUDIO_QA.md). Tail: peak from 2 s after stop to the end of the capture.
- Thresholds: silent < -70 dBFS, true peak > -1 dBTP, |DC| > 0.005, tail > -60 dBFS, loudness > 4 LU from the category target.

