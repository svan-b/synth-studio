# Sub 37 / Subsequent 37: independent review

Reviewed 2026-10-29 against the *Subsequent 37 Owner's Manual* (the *Sub 37 v1.1* manual has the same
text on the same pages), the factory preset lists (`S37presets`) and `docs/research/sub37/`. Page
numbers below are the manual's. Every number comes from the real engine: offline renders in the app
(48 kHz) read on the instrument output and on the control processor's channels, the audio QA tool,
the lesson runner, and Playwright on desktop (1440×900) and iPad landscape (1180×820, touch).

Severity: **P1** wrong against the manual or hard to use; **P2** noticeable; **P3** minor or a
documented model choice.

## Findings and fixes

### P1. iPad: most of the panel's own buttons were 14 × 8 CSS px touch targets

The panel's built-in buttons reach out to a 24-44 px touch area, but the twin's custom caps (MOD DEST,
OSC, CONTROLLERS, SYNC [TAP], RANGE ◀ ▶, glide OSC and TYPE, KB CTRL, SLOPE, KNOB SHIFT, BANK, PRESET
1-16, KB OCTAVE and the nine PROGRAMMING buttons) took touches only on their drawn 8.5 × 5 mm cap:
12-22 × 10 CSS px at the iPad's 82 % fit. MOD DEST lost another 2-3 px to the MOD AMT knob's touch
circle, which overlapped it.

**Fix** (`panel.tsx` `Cap`, `layout.tsx`): every cap carries an invisible touch area that reaches into
the free panel around it, sized per site so it never enters a neighbour's own touch area; the boxes
around the caps no longer take pointer events. MOD DEST and MOD AMT sit 3 mm further apart. Measured
on the iPad by hit-testing (`elementFromPoint`): SLOPE 67 × 30 px, KNOB SHIFT 60 × 33, MOD OSC and
CONTROLLERS 52 × 27, PRESET 1-16 52 × 32, glide OSC / TYPE 48 × 31 / 39, KB CTRL 44 × 34, BANK
33 × 33, MOD DEST 30 × 25, the PROGRAMMING buttons 22-38 × 19-32 (▼ ▲ CURSOR are 14 mm apart), RANGE
39 × 17 (boxed in by BACK / FORTH). No built-in control lost touch area (checked before / after). Two-finger
BANK + LATCH, three-finger KB OCTAVE + key and hold-DEST-and-turn work by touch.

### P1. "5 or below delivers a clean signal to the filter" (p.27) was not true

A sine at full oscillator level with the mixer at 5 came out with 2.8 % THD (3rd harmonic −31 dB),
0.65 % at 3: three stages each saturated at unity: the mixer amp (1.5 %, with a −38 dB 2nd harmonic
from its asymmetry), the ladder input (2.4 %) and MULTIDRIVE at 0 (still compressing).

**Fix**: the mixer amp is clean to 1.5× unity (the Subsequent 37's mixer headroom) and only then
soft-limits (it still holds the FDBK loop); the ladder input scale is 0.36 (was 0.45, make-up 2.625);
MULTIDRIVE idles in its linear range at 0. Now 0.35 / 1.2 / 2.9 / 7.6 % THD at 3 / 5 / 7 / 10, about
20 % for two sources at 10, so the overdrive starts above 5 and happens at the filter input, as the
manual says.

### P1. MULTIDRIVE did not behave as described (p.28)

"Asymmetrical, tube-like warmth to aggressive hard clipping": with a normal signal the drive was odd-
harmonic from the first notch (even/odd −11 dB at 1, −7 dB at 3), because of the distortion ahead of
it, and it was mostly a volume knob: a saw gained 6 dB at 2 and 11 dB at 4.

**Fix**: drive 0.5 at 0 (clean) to 40 at 10 into the same asymmetric curve; its make-up now rides on
the VCA gain (so a PGM DST FILT DRV modulation keeps its level too) and falls as the stages saturate.
Measured at the mixer's 5: 1.8 % THD at 1 and 5 % at 2 with even ≈ odd harmonics (the warmth), 12 %
at 3, 27 % at 5, 42 % odd hard clipping at 10. A full-scale tone gains about 5 dB by 2 and never more
than 6 dB (was 9); quiet signals still gain as before at low settings, so presets keep their balance.

### P2. Four "clock-synced" presets ignored the studio tempo

LFO and envelope SYNC follow the MIDI clock only while the arpeggiator's SYNC is lit (p.46); with it
off they follow the internal clock (RATE, 120 BPM here). Wobble Bass, Rhythmic Fifth Filter, Melting
Drive Bass and Clock-Synced Chirps had ARP SYNC off, so their wobbles and repeats stayed at 120 BPM
whatever the studio tempo, although their descriptions promise the studio tempo. **Fix**: ARP SYNC
lit (the arpeggiator stays off); descriptions say so.

### P2. Inaudible vibrato, wow and tremolo in four presets

PITCH AMT has a squared taper, so small settings are very small: the "constant gentle vibrato" of
Theremin Lead was 2 cents, West-Coast Whistle's 1.4 cents, Duo Tape Tones' "slow pitch wow" 1.4 cents,
and Gritty Organ's "rotary-style tremolo" ±12 %. **Fix**: 15, 12 and 6 cents, ±30 %.

### P2. The filter self-oscillated at exactly 7.0

The manual: settings *above* 7 self-oscillate (p.28). At 7.0 the twin produced a steady sine at
−33 dB with no input, so Acid Line and Acid Wiggle Sequence ("RESONANCE 7 just below
self-oscillation") carried a faint whistle. **Fix**: the onset is 7.1; 7.0 rings and dies away.

### P2. Modulation could push a parameter past its control's range

NOISE LEVEL "is added to or subtracted from the NOISE level" (p.24), but MOD AMT +5 on NOISE at 5
reached 15 on the dial (5.2× gain, 5 dB past the knob's maximum); the PGM destinations did the same to
the mixer levels, EG AMT, FREQUENCY and BEAT FREQ, and WAVE modulation ran past the narrowest pulse to
a 2 % sliver. **Fix**: each modulated value stays inside its own control's range (mixer 0-10, WAVE
triangle to the narrowest pulse, EG AMT ±5, FREQUENCY ±7 or ±36 as a drone, BEAT FREQ ±3.5 Hz).

### P2. KB TRANSPOSE shortcut promised but missing

KB TRANSPOSE's help text tells you to hold both KB OCTAVE buttons and press a key (p.14), and
REFERENCE.md listed it as not modelled. **Implemented**: with both held, a key in the lower two octaves
sets KB TRANSPOSE (middle C = 0); the LCD prompts and confirms.

### P2. iPad legibility of the small legends

At the 82 % fit many legends rendered at 5.5-8 CSS px, and sets of them at mixed sizes (the ten
envelope button names from 5.7 to 9.6 px, OCTAVE footages 5.5-9.6, SLOPE 6.7-9.6). **Fixes**: the
shifted envelope names and the ten envelope button names are authored at 9 and now all fit at about
9.5 px; OCTAVE footages, the RANGE octaves and the SLOPE poles are one size each (7.0, 7.4, 7.8 px);
section titles moved 1 mm so they reach 9.5 px; glide LCR / LCT / EXP are spaced 10 mm apart (8.1 px);
the LCD and PROGRAMMING names use the iPadOS condensed faces when Arial Narrow is missing, and the
PRESET / step labels are larger. What is left is structural (below).

## Left as they are (P3)

- **CUTOFF legend vs taper.** The printed legend (500 Hz at 12 o'clock, 1.2 kHz and 320 Hz at ±45°)
  implies a taper compressed around noon; the shared knob mapping offers only linear, log and
  exponential, so with the twin's 20 Hz × 1000^travel the marks read 0.3-0.7 octave off. The LCD and
  readout show the true value and no lesson relies on the marks. Fixing it needs a custom taper in
  `lib/controls/mapping.ts` (outside this device).
- **Dense legends on iPad.** The MOD DEST LED names (6.9 px), the MOD SOURCE and WAVE positions
  (6-8 px) and the jack names stay small: the iPad fit (0.82) is below the 0.85 the panel's text
  floors assume, and the panel is as dense as the hardware's. The LCD shows any control you touch.
- **Envelope times** reach −60 dB at the knob's time (the audible decay is about a third of it); the
  manual gives no definition (model choice, REFERENCE.md).
- **VCA LEVEL** as a MOD DEST swings the VCA from 0 to 2× at MOD AMT 5 (+6 dB peaks); real VCAs have a
  ceiling, but the amount is unpublished.
- **Drone pitch**: KB CTRL OFF parks OSC 2 on C4 at 8' (the research note guessed MIDI 48); not
  published.
- **KB PRIORITY** steps LAST, LOW, HIGH in the menu (stored LAST first); the hardware menu lists LOW,
  HIGH, LAST. Changing it would change saved values.
- **Arpeggiator DWN with RANGE** reverses the whole up cycle (a falling run over the range); the manual
  does not say how DWN orders octaves.
- One Boom-Bah Arp capture in the baseline audio QA showed a single −2.7 dBFS step (a capture dropout
  under the shared CPU load, not reproducible in five later runs).

## The 17 differences in `docs/research/sub37/sources.md` §6

All resolved; two keep a documented sub-item that is not modelled.

| # | Status |
|---|---|
| 1 Labels | resolved: KB TRACK, MOD DEST (DEST), MOD AMT, PATTERN, BACK / FORTH, LATCH ON, VOLUME |
| 2 Pink noise | resolved: octave bands flat within ±1 dB from 62.5 Hz to 4 kHz |
| 3 MOD DEST 7 positions | resolved |
| 4 Bipolar amounts | resolved |
| 5 BEAT FREQ ±3.5 Hz | resolved, constant-Hz offset measured |
| 6 KB CTRL HI / LO / OFF | resolved, drone ±3 octaves measured |
| 7 Filter KB TRACK 0-2:1 around MIDI 48 | resolved, measured exact |
| 8 Mixer overdrive above 5, mutes | resolved; the "clean at 5" half was not, now fixed (P1 above) |
| 9 KB PRIORITY | resolved |
| 10 Bend ±2, 0-24, BEND DEST | resolved |
| 11 Envelopes | resolved, every behaviour measured |
| 12 Arpeggiator | resolved; note orders checked against the manual's examples (pp.15-16, 40) |
| 13 Sequencer | resolved; SEQ MOD recording not modelled (documented) |
| 14 Keys MIDI 36-72 | resolved |
| 15 CV inputs 0-5 V | resolved; KB GATE as STEP ADV not modelled (documented) |
| 16 GLIDE TIME 0-10 | resolved |
| 17 Page references | resolved: every `manualReference` checked against the manual's pages |

## Measurements against the manual

Offline renders of the real engine (48 kHz, the app's worklets), read on the instrument output and on the
control processor's channels. "Manual" is the Subsequent 37 Owner's Manual (same pages as the Sub 37 v1.1).

| What | Manual | Twin (measured) |
|---|---|---|
| Pitch at 8', MIDI 36 / 48 / 60 / 69 / 72 | MIDI note pitch, 8' = concert | 65.37 / 130.99 / 261.63 / 440.13 / 523.51 Hz (within ±2.4 cents; the 1.5-cent drift) |
| OCTAVE 16' / 8' / 4' / 2' (p.25) | four octaves | 65.39 / 130.71 / 261.57 / 523.05 Hz at MIDI 48 |
| FREQUENCY ±7 st, fully clockwise a fifth (p.26) | ±7 semitones | +7: 196.00 Hz on C3 (0 cents); −7: 87.21 Hz (−1.9 cents) |
| BEAT FREQ ±3.5 Hz, the same beat on every note (p.26) | constant Hz | +3.5: C3 134.32 Hz (+3.51), C5 527.20 Hz (+3.95 incl. drift) |
| DUO + KB CTRL OFF: OSC 2 drones, FREQUENCY ±3 octaves (p.26) | ±3 octaves | C4 drone; +7 → 2091 Hz (+3 oct), −7 → 32.7 Hz (−3 oct) |
| FINE TUNE ±1 semitone (p.14), bend ±2 default, 0-24 (p.42) | | ±100 cents exact; bend +2/−2 st; BEND UP 12 → +12 st |
| KB OCTAVE ±2, KB TRANSPOSE ±12 (p.14) | | exact (±2 cents) |
| SUB: square one octave below OSC 1 (p.27) | | 65.42 Hz at C3; even harmonics −87 dB |
| Waves (p.25) | tri → saw → square → narrow pulse | tri h3 −18.9 dB (ideal −19.1), saw h2..h4 −6.4/−9.1/−12.0, square even harmonics −38 dB, pulse narrows to 10 % |
| Aliasing | | saw at 2093 Hz: −59 dB below the harmonics; narrow pulse −53 dB |
| Pink noise (p.27) | equal energy per octave | octave bands 62.5 Hz–4 kHz within ±0.6 dB, 8 kHz −1.8 dB |
| CUTOFF 20 Hz–20 kHz (p.28) | | self-oscillation tracks the knob 20 Hz–20 kHz within ±3 cents |
| RESONANCE self-oscillates above 7 (p.28) | above 7 | 7.0 rings and dies away; 7.1 self-oscillates (−31 dB), 10: −19 dB |
| SLOPE 6/12/18/24 dB (p.29) | | sines at 250 Hz cutoff: 1 pole −3.0 dB at fc, −6 dB/oct; 4 poles −12 dB at fc, −23 dB/oct; saws 2-4× fc: −5.9 / −11.4 / −17.4 / −22.4 dB/oct |
| KB TRACK 0 / 1:1 at halfway (MIDI 48) / 2:1 (p.29) | | keys 36/48/60/72 at 1:1: 249.6 / 499.1 / 998.3 / 1997 Hz; 2:1: 125 / 499 / 1997 / 7995 Hz |
| EG AMT ±5 | not published | ±6 octaves (the model's choice) |
| Bass loss with resonance | not published | fundamental −4.8 dB at 3, −7.1 at 7, −7.8 at 10 |
| ATTACK / DECAY / RELEASE 1 ms-10 s (pp.30-33) | | attack 10 / 100 / 1000 / 3000 ms within 1 ms (linear; EXP. ATTACK reaches 50 % at 40 % of the time); decay and release reach −60 dB at the set time (−20 dB at a third of it) |
| DELAY, HOLD 0-10 s; AMP DELAY only with LOOP (p.33) | | 300 ms exact; AMP DELAY ignored without LOOP, 300 ms with it |
| VEL AMT: hardest strike full (p.32) | | velocity 0.5: peak 1.0 / 0.75 / 0.5 at VEL AMT 0 / 50 / 100 % |
| Envelope KB TRACK shortens decay and release up the keyboard (p.32) | 1:1 at noon | decay to −20 dB 267 / 134 / 67 / 34 ms at MIDI 36 / 48 / 60 / 72 |
| LOOP repeats D-A-H-D-R (p.31) | | A 50 / D 100 / S 50 % / R 100 ms: a 297 ms cycle |
| LATCH ON, MULTI TRIG, RESET (p.31) | | sustain held with no key; legato retrigger only with MULTI TRIG; RESET restarts from zero |
| LFO 0.1-100 Hz, ×10 HI RANGE (pp.22-23) | | 5 / 50 Hz exact; HI RANGE 5 → 50 Hz, 100 → 1000 Hz |
| MOD 1 on the wheel, MOD 2 full (p.22) | | MOD 1 PITCH AMT +1: 0 / 48 / 96 cents at wheel 0 / 50 / 100 %; MOD 2 96 cents with the wheel down |
| LFO waves, KB RESET from zero (p.23) | TRI SQR SAW RAMP S&H | triangle rises from 0; SAW falls, RAMP rises; S&H holds one value per cycle |
| Mixer: ≤ 5 clean, above 5 overdrives the filter (p.27) | | one source (a sine) at 3 / 5 / 7 / 10: 0.35 / 1.2 / 2.9 / 7.6 % THD at the output (was 0.65 / 2.8 / 6.6 / 13.7 %) |
| MULTIDRIVE: asymmetric tube-like warmth to hard clipping (p.28) | | at 1 / 2 / 3 / 5 / 10: 1.8 / 5.0 / 11.8 / 27 / 42 % THD; even ≈ odd harmonics at 1-2, odd hard clipping at 10 (was odd-led from the start) |
| FDBK can raise the volume considerably (p.27) | | default panel +3 / +7 / +10 dB at FDBK 4 / 7 / 10 |
| DUO MODE (p.26) | HI: OSC 2 the top key | C3 + G3 held: OSC 2 alone gives G3 60 dB over C3 with HI, the reverse with LO; mono plays the last key |
| DC | | below 0.001 everywhere (mixer and output DC blockers) |

## Presets

All 52 factory citations match `S37presets` (name, bank, slot, category), the names are "Category /
Name" in the factory categories, and the settings carry what their names promise: the bass family on
16' saws, square and sub; pads with slow envelopes and wave or filter LFOs; DUO presets that play
two-note voicings; sync leads that sweep the slave; the arpeggio presets' patterns (INVERT, RANGE,
RND) match their descriptions. Fixed: the four tempo-sync presets and four inaudible modulations (P2).
After the gain-staging change every preset was re-levelled with PRESET VOL from the audio QA; Ticking
Boom Bass, Synth Kick, Clock-Synced Chirps and Boom-Bah Arp, already at PRESET VOL 100, got a little
more mixer level or MULTIDRIVE instead.

## Lessons

The 20 lessons follow docs/PEDAGOGY.md: signal-flow order, one idea each, a first win, a prediction
with one defensible answer, recall, an ear match, a challenge and a reflection. Their facts were
checked against the manual and against the engine after the voicing change (mixer above 5 adds
harmonics at the filter input; MULTIDRIVE warm then clipping; self-oscillation above 7; the 6.5-6.9
"just under self-oscillation" range of the acid challenge). Ear targets differ by 20 % or more of knob
travel (the fine ones by 7.5-8 %). Lesson runner: 20 lessons, 0 failed, 0 manual steps.

QA

## Upgrade notes

No control id, range or default changed, so saved settings need no conversion. Saved patches will
sound slightly different: cleaner at mixer levels up to 6, and with MULTIDRIVE above 3 up to about
3 dB quieter than before (the old drive was mostly level).
