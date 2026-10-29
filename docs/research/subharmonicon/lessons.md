# Moog Subharmonicon: lesson outlines (20 lessons)

These outlines follow `docs/PEDAGOGY.md` and pass the rules in `scripts/validate-devices.ts`:
- every do, patch and predict step has a principle; every predict and quiz has an explain;
- every predict step has an action (control, patch or check); every challenge has hints and a solution;
- match steps use 1–3 controls; instructions run 25 words or fewer and principles 20 or fewer;
- every lesson has 3–5 reviews.

All lesson text is original. Hardware facts cite `signal-flow.md` (which cites MAN/PWI/XPB pages).
Presets named in **Start** are defined in `presets.md`.

## Conventions

- **Ids**: `subharmonicon-<path code><n>-<slug>`; `device: 'subharmonicon'`.
- **Values** are given in hardware units, then in twin storage `(…)` using the current
  `devices/subharmonicon/spec.ts` ids:
  - `D(n)` = ÷n.
  - `vcoN_wave` 0/1/2 = UP/MIDDLE/DOWN.
  - `quantize` 0–4 = OFF/12-ET/8-ET/12-JI/8-JI.
  - `seq_oct` 0/1/2 = ±1/±2/±5.
  - `eg_mode` 0/1/2 = OFF/ON/HELD.
  - steps in % of the SEQ OCT range.
  - TEMPO in BPM on the linear model (signal-flow §10).
- **Stepped knobs need tight match tolerances.** One SUB FREQ or RHYTHM detent is 1/15 = 6.7 % of
  travel, so the default 0.08 would accept a neighbouring divisor. Use `tolerance: 0.03` on every
  match step that grades a divisor. Switches (QUANTIZE, EG, WAVE) compare indexes exactly.
- **Momentary buttons** (RESET, NEXT, TRIGGER) cannot be `do` targets. Use `info` with `focus`, or a
  `check` on engine state (for example `s.engine.steps`).
- **Start = "Init"** means the PWI initialized patch (presets.md #1): VCO FREQ at noon (C6), WAVE UP,
  all ÷1, VCO 1 LEVEL 50 %, CUTOFF 80 % (5 kHz), VCF EG AMT +60 %, decays about 30 ms, SEQ OCT ±5,
  QUANTIZE OFF, no rhythm assigned, EG ON.
- Paths and order: foundations 1–6, sound-design 1–3, ear-training 1–5, sequencing 1–3, performance 1,
  studio 1–2.

| # | Id | Path | Name | Level |
|---|---|---|---|---|
| 1 | subharmonicon-f1-undertones | foundations | One oscillator, many undertones | beginner |
| 2 | subharmonicon-f2-waves-mixer | foundations | Waves, the hidden PWM and a hot mixer | beginner |
| 3 | subharmonicon-f3-filter | foundations | The ladder filter and its envelope | beginner |
| 4 | subharmonicon-f4-envelopes | foundations | Envelopes and the EG button | beginner |
| 5 | subharmonicon-f5-sequencer | foundations | Two four-step sequencers | beginner |
| 6 | subharmonicon-f6-rhythm | foundations | Rhythm generators: dividing time | beginner |
| 7 | subharmonicon-sd1-sub-bass | sound-design | Deep bass from undertones | intermediate |
| 8 | subharmonicon-sd2-just-chords | sound-design | Beat-free chords in just intonation | intermediate |
| 9 | subharmonicon-sd3-filter-drums | sound-design | Drums from a ringing filter | intermediate |
| 10 | subharmonicon-et1-octave-or-not | ear-training | Octave, twelfth or double octave? | beginner |
| 11 | subharmonicon-et2-undertone-colours | ear-training | Name the undertone: ÷5, ÷6 or ÷7 | intermediate |
| 12 | subharmonicon-et3-polyrhythm-ears | ear-training | Count the polyrhythm | intermediate |
| 13 | subharmonicon-et4-just-vs-equal | ear-training | Just or equal? Listen for beats | intermediate |
| 14 | subharmonicon-et5-mixed | ear-training | Mixed ears: sub, filter or envelope? | advanced |
| 15 | subharmonicon-sq1-or-xor | sequencing | Combining rhythms: OR and XOR | intermediate |
| 16 | subharmonicon-sq2-intertwined | sequencing | Two sequencers, one melody | intermediate |
| 17 | subharmonicon-sq3-undertone-melodies | sequencing | Sequencing the undertones | advanced |
| 18 | subharmonicon-pf1-live | performance | Live moves: RESET, hold and assignments | intermediate |
| 19 | subharmonicon-st1-studio-clock | studio | Lock to the studio clock | intermediate |
| 20 | subharmonicon-st2-clock-dfam | studio | The Subharmonicon clocks the DFAM | advanced |

---

## 1. `subharmonicon-f1-undertones`: One oscillator, many undertones

**Meta:**
- foundations · order 1 · beginner · 6 min · prerequisites: none
- concepts `subharmonics`, `oscillator-pitch`
- source "Synth Studio · Subharmonicon manual (subharmonics, SUB FREQ)"

**Objective:** Set SUB 1 FREQ to a chosen divisor and name the interval it makes under VCO 1.

**Start:** Init, plus EG HELD (`eg_mode: 2`), VCO 1 FREQ noon = C6 1046.5 Hz (`vco1_freq: 1046.5`),
VCO 1 LEVEL 50 % and SUB 1 LEVEL 0 % at ÷1 (`vco1_sub1_freq: D(1)`), VOLUME 55 %. The drone sounds
straight away (first win).

**Steps**
1. **listen** (hook)
   - Instruction: "Here's the goal: one oscillator, then the same oscillator with a note growing underneath it."
   - A `{vco1_sub1_level: 0}` · B `{vco1_sub1_level: 70, vco1_sub1_freq: D(3)}`
   - Labels: "VCO alone", "VCO + undertone"
2. **do** `vco1_sub1_level` → 70 %
   - Instruction: "Raise SUB 1 LEVEL to about 70 %."
   - Principle: "A divider set to ÷1 copies the oscillator in unison, so it only thickens the sound."
3. **predict** `vco1_sub1_freq` → ÷2 `D(2)`
   - Instruction: "Turn SUB 1 FREQ one click counter-clockwise, to ÷2."
   - Question: "SUB 1 goes from ÷1 to ÷2. What happens to its pitch?"
   - Options: [0] "It drops exactly one octave" · [1] "It rises one octave" · [2] "It drops a semitone" · [3] "Only its volume changes". Answer **0**.
   - Explain: "Halving a frequency drops it one octave. Undertones can only go below the oscillator, never above, and the first steps are much bigger than a semitone."
   - Principle: "Dividing a frequency by 2 lowers it by exactly one octave."
4. **do** `vco1_sub1_freq` → ÷3 `D(3)`
   - Instruction: "One more click, to ÷3."
   - Principle: "Dividing by 3 lands an octave and a fifth below: a new note, not a copy."
   - Explanation: "1046.5 ÷ 3 ≈ 349 Hz, an F. Undertones bring in new note names under the oscillator's C."
5. **listen**
   - Instruction: "Compare ÷2 and ÷3."
   - A `{vco1_sub1_freq: D(2)}` · B `{vco1_sub1_freq: D(3)}`
   - Question: "Which one sounds like the same note, only lower?" Options [0] "÷2" · [1] "÷3" · [2] "Both equally". Answer **0**.
   - Explain: "÷2 is an octave, so it blends into the C. ÷3 adds an F underneath it."
6. **do** `vco1_sub1_freq` → ÷4 `D(4)`
   - Instruction: "Step on to ÷4."
   - Principle: "Divisors that are powers of two (2, 4, 8, 16) always give octaves."
7. **quiz**
   - Question: "VCO 1 plays C6 (1046 Hz). Which SUB 1 FREQ gives C4 (262 Hz)?"
   - Options: [0] "÷2" · [1] "÷4" · [2] "÷6" · [3] "÷8". Answer **1**.
   - Explain: "1046 ÷ 4 ≈ 262 Hz, two octaves down. ÷2 is only one octave (523 Hz), and ÷8 would reach C3."
8. **match**
   - Instruction: "Find the target by ear: a new note an octave and a fifth below the C."
   - Setup `{vco1_sub1_freq: D(8)}`
   - Target `{vco1_sub1_freq: D(3), vco1_sub1_level: 70, vco1_level: 30}` · controls `[vco1_sub1_freq]` · `tolerance: 0.03`
   - Hints: "It isn't an octave: listen for a different note name." → "Count clicks from fully clockwise: ÷1 is the first." → "Try ÷3."
9. **reflect**
   - Prompt: "In one sentence: how is a subharmonic different from an overtone?"
   - Model: "An overtone multiplies the frequency and sits above the note, while a subharmonic divides it and sits below, so the Subharmonicon builds notes underneath its oscillators."

**Review**
1. "SUB FREQ fully clockwise is…" — [0] "÷1, in unison with the VCO" · [1] "÷16, the lowest undertone" · [2] "the sub switched off". **0**. *Clockwise is ÷1; counter-clockwise steps down to ÷16.*
2. "Which divisors always give octaves?" — [0] "2, 4, 8, 16" · [1] "3, 6, 9, 12" · [2] "5, 10, 15". **0**. *Repeated halving gives octaves; 3, 6 and 12 give fifths.*
3. "VCO at 600 Hz, SUB at ÷3. The sub plays…" — [0] "200 Hz" · [1] "1800 Hz" · [2] "300 Hz". **0**. *Divide, don't multiply: 1800 Hz would be the third overtone.*
4. "Why can a sub never beat against its own VCO?" — [0] "It is an exact integer division of that VCO" · [1] "The filter removes beats" · [2] "It is always quieter". **0**. *Its cycles are counted from the VCO's cycles, so the ratio is locked.*

---

## 2. `subharmonicon-f2-waves-mixer`: Waves, the hidden PWM and a hot mixer

**Meta:**
- foundations · order 2 · beginner · 7 min · prerequisites `subharmonicon-f1-undertones`
- concepts `oscillator-waveform`, `mixing`, `gain-staging`

**Objective:** Choose a WAVE position for a timbre, and use the mixer either clean or deliberately warm.

**Start:** Init, plus EG HELD, VCO 1 FREQ 25 % = C5 (`vco1_freq: 523.25`), SUB 1 ÷2 at 0 %, WAVE UP,
VOLUME 55 %.

**Steps**
1. **listen** (hook)
   - Instruction: "Square and saw: same pitch, different colour."
   - A `{vco1_wave: 0}` · B `{vco1_wave: 2}` · labels "Square (UP)", "Saw (DOWN)"
   - Question: "Which one sounds hollower?" [0] "Square" · [1] "Saw" · [2] "Neither". **0**.
   - Explain: "A square contains only odd harmonics, which sounds hollow; a saw contains every harmonic, which sounds brighter and buzzier."
2. **do** `vco1_wave` → DOWN `2`
   - Instruction: "Flip VCO 1 WAVE down to saw."
   - Principle: "A sawtooth contains every harmonic, so it sounds brighter than a square."
3. **do** `vco1_sub1_level` → 50 %
   - Instruction: "Raise SUB 1 LEVEL to about 50 %: the octave-down sub joins in, also as a saw."
   - Principle: "One switch sets the waveform for an oscillator and both of its subharmonics."
4. **predict** `vco1_wave` → MIDDLE `1`, with setup `{vco1_sub1_level: 0}`
   - Instruction: "Mute SUB 1, then set VCO 1 WAVE to the middle position."
   - Question: "In MIDDLE, SUB 1's saw sweeps VCO 1's pulse width. With SUB 1 LEVEL at zero, what do you hear?"
   - Options: [0] "A plain square" · [1] "A pulse whose shape repeats every second cycle, hinting at a lower pitch" · [2] "Silence". Answer **1**.
   - Explain: "The internal PWM link works even when SUB 1 is muted, so VCO 1's waveform only repeats every n cycles and a lower pitch appears. It is not a plain square, because the pulse width keeps moving."
   - Principle: "Modulating a wave at a fraction of its own frequency adds lower pitches to it."
5. **do** `vco1_sub1_freq` → ÷4 `D(4)`
   - Instruction: "Turn SUB 1 FREQ to ÷4 and listen to VCO 1 alone."
   - Principle: "A slower modulator makes the waveform repeat less often, so the implied pitch drops."
6. **quiz**
   - Question: "Which move replaces the built-in PWM source?"
   - Options: [0] "Patching a signal into VCO 1 PWM" · [1] "Raising SUB 1 LEVEL" · [2] "Turning VCF EG AMT". Answer **0**.
   - Explain: "A cable in VCO 1 PWM overrides the SUB 1 saw. SUB 1 LEVEL only sets how loud SUB 1 is in the mixer."
7. **listen**
   - Instruction: "Compare moderate levels with everything pushed up."
   - A `{vco1_level: 40, vco1_sub1_level: 40, vco1_sub2_level: 0}` · B `{vco1_level: 100, vco1_sub1_level: 100, vco1_sub2_level: 100, vco1_sub2_freq: D(3)}`
   - Question: "Besides loudness, what changes?" [0] "It thickens and distorts warmly" · [1] "The pitch drops" · [2] "Nothing". **0**.
   - Explain: "Several sources near maximum overdrive the mixer before the filter (MAN p.20). Moderate levels stay clean."
8. **challenge**
   - Instruction: "Make a reedy, hollow lead with a hint of the octave below, and no audible overdrive."
   - Checklist:
     - "WAVE UP or MIDDLE" `num('vco1_wave') <= 1`
     - "SUB 1 at ÷2" `num('vco1_sub1_freq') === -2`
     - "Mixer kept moderate" `num('vco1_level') + num('vco1_sub1_level') + num('vco1_sub2_level') <= 150`
   - Hints: "Hollow means square or pulse." → "The octave below is SUB 1 at ÷2." → "Keep the three levels together under about 150 %."
   - Solution `{vco1_wave: 1, vco1_sub1_freq: D(2), vco1_level: 60, vco1_sub1_level: 25, vco1_sub2_level: 0}`
9. **reflect**
   - Prompt: "Why can the MIDDLE position add a lower pitch even with SUB 1 muted?"
   - Model: "SUB 1's sawtooth keeps modulating VCO 1's pulse width at the sub's frequency, so the VCO waveform only repeats every n cycles."

**Review**
1. "WAVE UP gives…" — [0] "square on the VCO and both subs" · [1] "saw on the VCO only" · [2] "noise". **0**. *One switch per VCO sets all three waveforms.*
2. "In MIDDLE, the subs output…" — [0] "saw" · [1] "square" · [2] "nothing". **0**. *MIDDLE means VCO pulse plus saw subs.*
3. "To get a cleaner sound, set the mixer…" — [0] "at moderate levels" · [1] "with everything at maximum" · [2] "with only subs at maximum". **0**. *Hot levels drive the mixer into distortion.*
4. "A cable into VCO 1 PWM…" — [0] "replaces the SUB 1 saw as the PWM source" · [1] "changes VCO 1's pitch" · [2] "mutes SUB 1". **0**. *It overrides the normal (MAN p.31).*

---

## 3. `subharmonicon-f3-filter`: The ladder filter and its envelope

**Meta:**
- foundations · order 3 · beginner · 7 min · prerequisites `subharmonicon-f2-waves-mixer`
- concepts `filter-cutoff`, `filter-resonance`, `modulation-depth`

**Objective:** Use CUTOFF, RESONANCE and VCF EG AMT (both signs) to set brightness, ring and movement.

**Start:** Init, plus:
- `rhythm1_seq1: true`, RHYTHM 1 ÷4, TEMPO 20 % = 616 BPM (`tempo: 616`)
- VCO 1 FREQ 25 % (C5), WAVE DOWN, SUB 1 ÷2 at 40 %
- CUTOFF 2 kHz, RESONANCE 0, VCF EG AMT 0 (noon)
- VCF DECAY 300 ms, VCA DECAY 400 ms, EG ON

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: a steady pulse of bright saw notes."
   - Principle: "A low-pass filter passes frequencies below its cutoff and removes those above."
2. **predict** `cutoff` → 250 Hz
   - Instruction: "Turn CUTOFF down to about 250 Hz."
   - Question: "What will lowering CUTOFF do?"
   - Options: [0] "Make it darker and duller" · [1] "Lower the pitch" · [2] "Slow the rhythm". Answer **0**.
   - Explain: "The filter removes the upper harmonics, so the tone darkens. The pitch comes from the VCO, not the filter; it can seem lower only because brightness is gone."
   - Principle: "Lowering cutoff removes upper harmonics, so the same note sounds darker."
3. **do** `resonance` → 70 %
   - Instruction: "Raise RESONANCE to about 70 %, then sweep CUTOFF slowly."
   - Principle: "Resonance boosts frequencies at the cutoff, so the filter rings at that pitch."
   - Explanation: "This ladder self-oscillates near maximum resonance with a low cutoff (MAN p.22). Ladders also lose some bass as resonance rises."
4. **listen**
   - Instruction: "Compare no resonance with high resonance."
   - A `{resonance: 0, cutoff: 400}` · B `{resonance: 85, cutoff: 400}`
   - Question: "Which one whistles or rings?" [0] "A" · [1] "B". **1**.
   - Explain: "High resonance makes a narrow peak that rings at the cutoff."
5. **do** `vcf_eg_amt` → +60 %
   - Instruction: "Set RESONANCE back to 20 %, then VCF EG AMT to about +60 % (2 o'clock)."
   - Setup `{resonance: 20}`
   - Principle: "A positive envelope amount opens the filter at each note, then lets it close."
6. **quiz**
   - Question: "VCF EG AMT is turned to about −60 %. Each note now…"
   - Options: [0] "starts dark and brightens as the envelope decays" · [1] "starts bright and closes" · [2] "has no filter movement". Answer **0**.
   - Explain: "Negative amounts invert the envelope: the filter closes on the attack and reopens on the decay (MAN p.23). 'Starts bright' is what a positive amount does."
7. **match**
   - Instruction: "Recreate the target tone by ear."
   - Setup `{vcf_eg_amt: 40}`
   - Target `{cutoff: 500, resonance: 60, vcf_eg_amt: 40}` · controls `[cutoff, resonance]`
   - Hints: "It rings: which knob adds ringing?" → "RESONANCE is fairly high; CUTOFF sits in the low mids."
8. **reflect**
   - Prompt: "In one sentence: what does VCF EG AMT do, and what does the sign change?"
   - Model: "It sets how far the envelope moves the cutoff: clockwise opens the filter on each note, counter-clockwise closes it."

**Review**
1. "Lowering CUTOFF on this low-pass filter…" — [0] "removes high harmonics" · [1] "lowers the pitch" · [2] "adds distortion". **0**. *Pitch is set by the VCO.*
2. "The filter is a…" — [0] "4-pole ladder low-pass" · [1] "switchable LP/HP" · [2] "2-pole band-pass". **0**. *LP only, 24 dB/oct (MAN p.22).*
3. "Centre on VCF EG AMT means…" — [0] "no envelope effect" · [1] "full positive" · [2] "full negative". **0**. *Bipolar: centre = none.*
4. "To make the filter ring at its cutoff, raise…" — [0] "RESONANCE" · [1] "VOLUME" · [2] "TEMPO". **0**. *Resonance feeds back around the cutoff.*

---

## 4. `subharmonicon-f4-envelopes`: Envelopes and the EG button

**Meta:**
- foundations · order 4 · beginner · 8 min · prerequisites `subharmonicon-f3-filter`
- concepts `envelope-attack`, `envelope-decay`, `envelope-shape`

**Objective:** Shape notes with ATTACK and DECAY, and choose OFF, ON or HELD on the EG button.

**Start:** As lesson 3, plus CUTOFF 3 kHz, VCF EG AMT +40, VCA ATTACK 1 ms, VCA DECAY 200 ms.

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: short plucks, one every 0.4 s."
   - Principle: "An envelope shapes a note over time: rising during the attack, falling during the decay."
2. **predict** `vca_decay` → 1500 ms
   - Instruction: "Turn VCA DECAY up to about 1.5 s."
   - Question: "Notes still come every 0.4 s. What happens?"
   - Options: [0] "Notes ring into each other, smoother and longer" · [1] "Notes get shorter" · [2] "The pitch rises". Answer **0**.
   - Explain: "A longer decay lets each note fade slowly, so it overlaps the next. Decay changes length, not pitch."
   - Principle: "A longer decay makes each note fade out more slowly."
3. **do** `vca_attack` → 300 ms
   - Instruction: "Set VCA ATTACK to about 0.3 s."
   - Principle: "A slow attack fades each note in, softening its start."
4. **quiz**
   - Question: "VCA ATTACK is 1 s but notes arrive every 0.4 s. What happens to triggers that land during the attack?"
   - Options: [0] "They are ignored until the attack finishes" · [1] "Each one restarts the attack" · [2] "They double the volume". Answer **0**.
   - Explain: "On this synth both envelopes ignore new triggers during their attack (MAN p.23). Many other synths restart, so the second option is tempting."
5. **do** `eg_mode` → OFF `0`
   - Instruction: "Set VCA ATTACK back to 1 ms, then tap EG so it goes dark."
   - Setup `{vca_attack: 1, vca_decay: 400}`
   - Principle: "If nothing triggers the envelope, the amplifier stays closed and you hear silence."
   - Explanation: "The sequence keeps stepping, but in OFF the steps no longer trigger the envelopes."
6. **info** focus `[trigger]`
   - Instruction: "Hold TRIGGER, then let go. In OFF it acts like a key: the sound holds while pressed."
   - Explanation: "With EG OFF the TRIGGER button is a gate: Attack, hold at maximum, then Decay on release (MAN p.28)."
7. **do** `eg_mode` → HELD `2`
   - Instruction: "Press and hold EG until it blinks: a continuous drone."
   - Principle: "Holding an envelope at its peak turns repeating notes into a drone."
8. **listen**
   - Instruction: "Compare ON and HELD."
   - A `{eg_mode: 1}` · B `{eg_mode: 2}`
   - Question: "Which setting would you use to tune a chord by ear?" [0] "ON" · [1] "HELD". **1**.
   - Explain: "HELD keeps the sound steady, so you can tune pitches without notes stopping."
9. **challenge**
   - Instruction: "Make a soft pad: notes that swell in and overlap, with no clicks."
   - Checklist:
     - "EG ON" `num('eg_mode') === 1`
     - "VCA ATTACK 150 ms or more" `num('vca_attack') >= 150`
     - "VCA DECAY 0.8 s or more" `num('vca_decay') >= 800`
   - Hints: "Swell in means attack." → "Overlap means a long decay." → "Try ATTACK about 0.3 s and DECAY about 1.5 s with EG lit."
   - Solution `{eg_mode: 1, vca_attack: 300, vca_decay: 1500, vcf_attack: 200, vcf_decay: 1200}`
10. **reflect**
    - Prompt: "When would you choose EG OFF instead of ON?"
    - Model: "When I want something other than the sequencer steps to fire the notes, such as the TRIGGER button, the TRIGGER input or a clock cable, while the sequencers still change the pitches."

**Review**
1. "ATTACK and DECAY range…" — [0] "1 ms–10 s and 5 ms–10 s" · [1] "both 1 ms–1 s" · [2] "10 ms–100 s". **0**. *MAN p.23–24.*
2. "EG blinking means…" — [0] "HELD: both envelopes at maximum" · [1] "OFF" · [2] "an error". **0**. *Hold the EG button to enter HELD.*
3. "With EG OFF, the TRIGGER button…" — [0] "acts as a gate" · [1] "does nothing" · [2] "resets the sequence". **0**. *It holds the envelopes while pressed.*
4. "A trigger arriving during the attack…" — [0] "is ignored" · [1] "restarts it" · [2] "inverts it". **0**. *The attack can't be retriggered on this unit.*

---

## 5. `subharmonicon-f5-sequencer`: Two four-step sequencers

**Meta:**
- foundations · order 5 · beginner · 8 min · prerequisites `subharmonicon-f4-envelopes`
- concepts `sequencer-pattern`, `oscillator-pitch`

**Objective:** Program a 4-step melody, set its range with SEQ OCT and lock it to a scale with QUANTIZE.

**Start:** Init, plus EG HELD, VCO 1 FREQ 25 % (C5), VCO 1 LEVEL 50 %. SEQ OCT and QUANTIZE stay at
the Init values (±5, OFF).

**Steps**
1. **do** `seq1_osc` → true
   - Instruction: "Light OSC 1 in SEQ 1 ASSIGN so Sequencer 1 can change VCO 1's pitch."
   - Principle: "A sequencer outputs one voltage per step; routing it to an oscillator turns voltages into notes."
2. **do** `rhythm1_seq1` → true
   - Instruction: "Light SEQ 1 under RHYTHM 1 so Sequencer 1 has a clock."
   - Principle: "A step sequencer only moves when a clock tells it to."
3. **predict** `seq_oct` → ±1 `0`
   - Instruction: "Press SEQ OCT until ±1 lights."
   - Question: "Each STEP knob can span ±5 octaves right now. What does ±1 change?"
   - Options: [0] "Each knob covers one octave up or down, so tuning is easier" · [1] "The sequence plays an octave higher" · [2] "Only step 1 changes". Answer **0**.
   - Explain: "SEQ OCT sets the range of every STEP knob for both sequencers. It doesn't transpose anything; centre is still 0 V."
   - Principle: "A smaller voltage range per knob gives finer control over pitch."
4. **do** `quantize` → 12-ET `1`
   - Instruction: "Press QUANTIZE until 12-ET lights."
   - Principle: "Quantizing snaps a continuous voltage to the nearest note of a scale."
5. **challenge**
   - Instruction: "Tune a four-note phrase. Press NEXT to move between steps; every step should be a different note."
   - Checklist:
     - "Four different steps" `new Set([1,2,3,4].map(i => Math.round(num('seq1_step'+i)/8.33))).size === 4`
   - Hints: "NEXT moves one step and doesn't retrigger the envelopes, so HELD keeps the sound on." → "Each semitone is about 8 % of the knob at ±1." → "Try 0, +3, +7 and +5 semitones."
   - Solution `{seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42}`
6. **do** `eg_mode` → ON `1`
   - Instruction: "Tap EG so it stays lit."
   - Principle: "With the envelope ON, every sequencer step plays as its own note."
7. **do** `play` → true
   - Instruction: "Press PLAY."
   - Principle: "A transport start makes the clock run, so the sequence loops."
8. **quiz**
   - Question: "QUANTIZE is on and you turn VCO 1 FREQ. What happens?"
   - Options: [0] "The pitch steps from note to note of the scale" · [1] "The pitch sweeps smoothly" · [2] "Nothing, because FREQ is never quantized". Answer **0**.
   - Explain: "On the Subharmonicon the VCO FREQ knobs snap to the selected scale too (MAN p.17). Many other synths only quantize the sequencer, which makes the third option tempting."
9. **listen**
   - Instruction: "Same knobs, unquantized and then in the 8-ET major scale."
   - Setup `{seq1_step2: 21, seq1_step3: 50}`
   - A `{quantize: 0}` · B `{quantize: 2}`
   - Question: "Which version sounds in key?" [0] "A" · [1] "B". **1**.
   - Explain: "8-ET pulls every step onto a C-major note."
10. **reflect**
    - Prompt: "What do SEQ OCT and QUANTIZE each do to the STEP knobs?"
    - Model: "SEQ OCT sets how many octaves each knob can reach, and QUANTIZE snaps the result onto the notes of a scale."

**Review**
1. "SEQ OCT is…" — [0] "shared by both sequencers" · [1] "set per sequencer" · [2] "only for SEQ 2". **0**. *One setting for both (MAN p.27).*
2. "A STEP knob at 12 o'clock adds…" — [0] "0 V (no change)" · [1] "+1 octave" · [2] "−5 V". **0**. *Centre means no offset.*
3. "NEXT…" — [0] "advances a step without retriggering the envelopes" · [1] "triggers a note" · [2] "resets to step 1". **0**. *MAN p.28.*
4. "8-ET is…" — [0] "a diatonic (major) scale in equal temperament" · [1] "8 equal steps per octave" · [2] "just intonation". **0**. *8 steps = 7 notes + octave.*

---

## 6. `subharmonicon-f6-rhythm`: Rhythm generators: dividing time

**Meta:**
- foundations · order 6 · beginner · 8 min · prerequisites `subharmonicon-f5-sequencer`
- concepts `timing-tempo`, `polyrhythm`

**Objective:** Set TEMPO and RHYTHM divisions, assign them to a sequencer, and build a first polyrhythm.

**Start:** Preset "Tutorial / First Polyrhythm", but with only RHYTHM 1 (÷4) assigned (`rhythm2_seq1: false`)
and TEMPO 616 BPM.

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY."
   - Principle: "Every rhythm here is a whole-number division of one master clock."
2. **do** `rhythm1` → ÷2 `D(2)`
   - Instruction: "Turn RHYTHM 1 clockwise to ÷2."
   - Principle: "Dividing a clock by a smaller number gives more pulses per second."
3. **predict** `rhythm2_seq1` → true, with setup `{rhythm2: D(3)}`
   - Instruction: "Light SEQ 1 under RHYTHM 2 (set to ÷3)."
   - Question: "Two generators now drive Sequencer 1: ÷2 and ÷3. What happens?"
   - Options: [0] "It steps whenever either fires: a lopsided, busier rhythm" · [1] "It slows to ÷6" · [2] "Nothing until RESET". Answer **0**.
   - Explain: "With OR logic the sequencer steps on any hit. ÷2 and ÷3 merge into x.xxx. (four hits every six pulses). Only coincident hits merge, so it doesn't become ÷6."
   - Principle: "Merging two pulse streams creates a new, uneven rhythm."
4. **info** focus `[reset]`
   - Instruction: "Tap RESET a few times. Everything restarts together on step 1."
   - Explanation: "RESET returns both sequencers to step 1 and every rhythm generator to its starting phase (MAN p.27)."
5. **quiz**
   - Question: "RHYTHM ÷3 drives Sequencer 1 and ÷4 drives Sequencer 2. After how many master pulses do they land together again?"
   - Options: [0] "12" · [1] "7" · [2] "4". Answer **0**.
   - Explain: "They coincide at the least common multiple of 3 and 4. 7 is their sum, which isn't when they meet."
6. **do** `tempo` → 1200 BPM
   - Instruction: "Raise TEMPO to about 1200 BPM."
   - Principle: "Speeding up the master clock speeds every division by the same factor."
7. **challenge**
   - Instruction: "Make Sequencer 2 step once for every four notes of Sequencer 1."
   - Checklist:
     - "RHYTHM 2 drives SEQ 2 only" `bool('rhythm2_seq2') && !bool('rhythm2_seq1')`
     - "RHYTHM 1 drives SEQ 1" `bool('rhythm1_seq1')`
     - "Ratio 4:1" `-num('rhythm2') === 4 * -num('rhythm1')`
   - Hints: "A slower division means a bigger number." → "If RHYTHM 1 is ÷2, RHYTHM 2 needs ÷8."
   - Solution `{rhythm1: D(2), rhythm2: D(8), rhythm1_seq1: true, rhythm2_seq1: false, rhythm2_seq2: true}`
8. **reflect**
   - Prompt: "Why do the rhythm generators always come back into line?"
   - Model: "They all divide the same clock by whole numbers, so after the least common multiple of their divisions they hit together on the downbeat."

**Review**
1. "RHYTHM fully clockwise divides by…" — [0] "1" · [1] "16" · [2] "8". **0**. *CW = ÷1 (MAN p.29).*
2. "The internal clock runs at…" — [0] "20–3000 BPM, one pulse per beat" · [1] "only 60–180 BPM" · [2] "a fixed 120 BPM". **0**. *MAN p.24.*
3. "÷2 and ÷3 on one sequencer (OR) give how many hits per 6 pulses?" — [0] "4" · [1] "5" · [2] "6". **0**. *The shared downbeat counts once.*
4. "One generator can drive…" — [0] "SEQ 1, SEQ 2, both or neither" · [1] "only SEQ 1" · [2] "only one at a time". **0**. *Two buttons per generator.*

---

## 7. `subharmonicon-sd1-sub-bass`: Deep bass from undertones

**Meta:**
- sound-design · order 1 · intermediate · 7 min · prerequisites `subharmonicon-f6-rhythm`
- concepts `subharmonics`, `filter-cutoff`, `envelope-decay`

**Objective:** Build a punchy bass from the SUB oscillators, a low filter and a short envelope.

**Start:**
- VCO 1 FREQ 0 % (C4, `vco1_freq: 261.63`), WAVE UP; VCO 1 LEVEL 60 %, subs 0 % (SUB 1 ÷4, SUB 2 ÷8)
- SEQ 1 → OSC 1, steps 0/0/+25/−17 (±1, 12-ET); RHYTHM 1 ÷2 → SEQ 1; TEMPO 480 BPM
- CUTOFF 2 kHz, EG AMT +30 %, VCF DECAY 200 ms, VCA DECAY 220 ms; EG ON

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: a middle-C riff, too high for a bass."
   - Principle: "A bass lives roughly between 40 and 160 Hz; middle C is 262 Hz."
2. **predict** `vco1_sub1_level` → 75 % (SUB 1 is at ÷4)
   - Instruction: "Raise SUB 1 LEVEL to about 75 %."
   - Question: "VCO FREQ can't go below middle C. How does this synth play two octaves lower?"
   - Options: [0] "With SUB 1 at ÷4" · [1] "By turning VCO 1 FREQ further down" · [2] "By lowering CUTOFF". Answer **0**.
   - Explain: "÷4 is two octaves down (65 Hz). VCO FREQ bottoms out at C4, and CUTOFF changes brightness, not pitch."
   - Principle: "Dividing the oscillator by 4 gives the same riff two octaves lower."
3. **do** `vco1_level` → 0
   - Instruction: "Turn VCO 1 LEVEL down to zero."
   - Principle: "Removing the high fundamental leaves only the low voice."
4. **do** `vco1_sub2_level` → 40 %
   - Instruction: "Add SUB 2 (÷8) at about 40 % for sub-bass weight."
   - Principle: "An octave below the bass adds weight you feel more than hear."
5. **do** `cutoff` → 400 Hz
   - Instruction: "Bring CUTOFF down to about 400 Hz."
   - Principle: "A lower cutoff keeps a bass round and leaves room for other parts."
6. **listen**
   - Instruction: "Long tail or short tail?"
   - A `{vca_decay: 600}` · B `{vca_decay: 150}`
   - Question: "Which one leaves space between notes?" [0] "A" · [1] "B". **1**.
   - Explain: "A short decay stops each note before the next, so the groove breathes."
7. **quiz**
   - Question: "Why does WAVE UP suit a sub bass?"
   - Options: [0] "Square subs are strong in odd harmonics and keep definition when filtered" · [1] "It raises the pitch" · [2] "It disables the filter". Answer **0**.
   - Explain: "Odd harmonics give a square bass its hollow punch. Pitch is set by the divisors."
8. **challenge**
   - Instruction: "Make a bass that thumps but doesn't boom between notes."
   - Checklist:
     - "Sub at ÷4 or lower audible" `num('vco1_sub1_level') >= 40 && num('vco1_sub1_freq') <= -4`
     - "VCO 1 mostly out" `num('vco1_level') <= 20`
     - "Cutoff under 700 Hz" `num('cutoff') <= 700`
     - "VCA DECAY under 0.3 s" `num('vca_decay') <= 300`
   - Hints: "The body comes from a sub, not the VCO." → "Short tails stop the boom." → "Try SUB 1 ÷4 at 75 %, CUTOFF 400 Hz, VCA DECAY 200 ms."
   - Solution `{vco1_level: 0, vco1_sub1_level: 75, vco1_sub1_freq: D(4), cutoff: 400, vca_decay: 200}`
9. **reflect**
   - Prompt: "Why is a subharmonic synth good at bass even though its VCOs start at middle C?"
   - Model: "Dividers drop the oscillator by whole octaves or more, so ÷4 and ÷8 reach 65 and 33 Hz while staying locked to the riff."

**Review**
1. "Lowest VCO FREQ setting is…" — [0] "C4 (262 Hz)" · [1] "C0" · [2] "20 Hz". **0**. *MAN p.17.*
2. "C4 ÷8 =" — [0] "C1 (about 33 Hz)" · [1] "C2" · [2] "G1". **0**. *Three octaves down.*
3. "A shorter VCA DECAY gives…" — [0] "tighter notes" · [1] "lower pitch" · [2] "more resonance". **0**. *It's the loudness tail.*

---

## 8. `subharmonicon-sd2-just-chords`: Beat-free chords in just intonation

**Meta:**
- sound-design · order 2 · intermediate · 9 min · prerequisites `subharmonicon-sd1-sub-bass`
- concepts `subharmonics`, `mixing`

**Objective:** Build a chord from two VCOs and their subs that doesn't beat, using 12-JI.

**Start:** EG HELD; both VCO FREQ 0 % (C4); all levels 0 except VCO 1 LEVEL 25 %; WAVE DOWN both;
CUTOFF 2 kHz; QUANTIZE OFF.

**Steps**
1. **do** `quantize` → 12-JI `3`
   - Instruction: "Press QUANTIZE until 12-JI lights. VCO FREQ now snaps to just steps."
   - Principle: "Just intonation tunes intervals to small whole-number ratios, so they don't beat."
2. **do** `vco1_freq` → 392.44 Hz (G4), `tolerance: 3`
   - Instruction: "Turn VCO 1 FREQ until it settles on G4, about 15 % of the knob."
   - Principle: "A just fifth vibrates exactly 3 times for every 2 of the root."
3. **predict** `vco1_sub1_freq` → ÷3, with setup `{vco1_sub1_level: 55}`
   - Instruction: "Set VCO 1 SUB 1 FREQ to ÷3."
   - Question: "VCO 1 is G4, a just fifth above C4. Which note is ÷3?"
   - Options: [0] "C3" · [1] "D3" · [2] "G3". Answer **0**.
   - Explain: "G4 is C4 × 3/2, and dividing by 3 gives C4/2 = C3: the fifth's undertone lands on the root. G3 would be ÷2."
   - Principle: "Dividing a just fifth by 3 lands exactly on its root, an octave lower."
4. **do** `vco2_freq` → 327.03 Hz (E4), `tolerance: 3`
   - Instruction: "Raise VCO 2 LEVEL to 25 % and turn VCO 2 FREQ to E4, about 8 %."
   - Setup `{vco2_level: 25}`
   - Principle: "A just major third vibrates 5 times for every 4 of the root."
5. **do** `vco2_sub2_freq` → ÷5, with setup `{vco2_sub2_level: 30}`
   - Instruction: "Set VCO 2 SUB 2 FREQ to ÷5 and listen to the low C."
   - Principle: "E4 ÷ 5 = C2, the same note VCO 1 ÷6 would give: the lattice locks."
6. **listen**
   - Instruction: "Same knobs, two tunings. Listen to the lowest C."
   - Setup `{vco1_sub2_freq: D(6), vco1_sub2_level: 45}`
   - A `{quantize: 3}` · B `{quantize: 1}`
   - Question: "In which one does the low C throb slowly?" [0] "A (12-JI)" · [1] "B (12-ET)". **1**.
   - Explain: "In 12-ET, VCO 2's ÷5 is 65.93 Hz against 65.33 Hz from VCO 1 ÷6: a 0.6 Hz beat. In 12-JI they're identical."
7. **quiz**
   - Question: "Why does the ET major third beat here?"
   - Options: [0] "It is 13.7 cents wider than 5/4, so subs that should coincide land slightly apart" · [1] "Equal temperament is out of tune with itself" · [2] "The filter adds beating". Answer **0**.
   - Explain: "ET thirds are a compromise for playing in every key. The subs reveal the mismatch as slow beating. ET is self-consistent; it just isn't whole-number ratios."
8. **challenge**
   - Instruction: "Turn it into C minor: use the undertones of the fifth to make the minor third."
   - Checklist:
     - "12-JI on" `num('quantize') === 3`
     - "VCO 2 on G4" `Math.abs(num('vco2_freq') - 392.44) < 4`
     - "A ÷5 sub of VCO 2 audible" `(num('vco2_sub2_freq') === -5 && num('vco2_sub2_level') >= 25) || (num('vco2_sub1_freq') === -5 && num('vco2_sub1_level') >= 25)`
     - "VCO 1 on C4" `Math.abs(num('vco1_freq') - 261.63) < 3`
   - Hints: "Swap roles: VCO 1 becomes the root and VCO 2 the fifth." → "(3/2) ÷ 5 = 3/10, a minor third above the low C." → "VCO 1 C4 with ÷2 and ÷4; VCO 2 G4 with ÷2 and ÷5."
   - Solution `{vco1_freq: 261.63, vco1_sub1_freq: D(2), vco1_sub2_freq: D(4), vco2_freq: 392.44, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_sub2_level: 45}`
9. **reflect**
   - Prompt: "Why does just intonation suit the Subharmonicon in particular?"
   - Model: "Its subs are exact whole-number divisions, so VCOs tuned to whole-number ratios make every sub line up. In equal temperament they land slightly apart and beat."

**Review**
1. "The just major third is…" — [0] "5/4" · [1] "4/3" · [2] "6/5". **0**. *6/5 is the minor third.*
2. "With QUANTIZE on, VCO FREQ…" — [0] "snaps to scale steps" · [1] "sweeps smoothly" · [2] "is disabled". **0**. *MAN p.17.*
3. "Just intonation removes…" — [0] "beating between notes that should coincide" · [1] "all harmonics" · [2] "the need for a filter". **0**. *MAN p.16 calls out minor chords.*
4. "E4 (5/4) ÷ 5 equals…" — [0] "C2" · [1] "E2" · [2] "A1". **0**. *5/4 ÷ 5 = 1/4 of C4.*

---

## 9. `subharmonicon-sd3-filter-drums`: Drums from a ringing filter

**Meta:**
- sound-design · order 3 · intermediate · 9 min · prerequisites `subharmonicon-f4-envelopes`
- concepts `filter-resonance`, `envelope-decay`, `signal-routing`
- source "Synth Studio · after the manual's Bateria preset (MAN p.46)"

**Objective:** Turn the self-oscillating ladder into a tuned kick, then add clock-driven accents.

**Start:** Init, plus:
- RHYTHM 1 ÷4 → SEQ 1, RHYTHM 2 ÷4 → SEQ 2, TEMPO 516 BPM (Bateria's tempo position)
- VCF DECAY 20 ms, VCA DECAY 165 ms, CUTOFF 2 kHz, EG AMT 0

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: plain blips at a steady beat."
   - Principle: "Any sound with a fast pitch drop and a short tail can work as a drum."
2. **do** `vco1_level` → 0
   - Instruction: "Turn VCO 1 LEVEL to zero. Silence, for now."
   - Principle: "With nothing in the mixer, any sound must come from the filter itself."
3. **predict** `resonance` → 99 %
   - Instruction: "Turn RESONANCE to maximum."
   - Question: "Nothing is feeding the filter. What will you hear?"
   - Options: [0] "A pitched note on each beat: the filter rings by itself" · [1] "Nothing at all" · [2] "White noise". Answer **0**.
   - Explain: "At maximum resonance the ladder self-oscillates (MAN p.22), and the VCA envelope gates that sine-like tone. No input is needed."
   - Principle: "Enough resonance makes a filter oscillate on its own, like a sine oscillator."
4. **do** `cutoff` → 80 Hz
   - Instruction: "Set CUTOFF to about 80 Hz: that's the kick's pitch."
   - Principle: "A self-oscillating filter sings at its cutoff, so CUTOFF tunes the drum."
5. **do** `vcf_eg_amt` → +22 %
   - Instruction: "Set VCF EG AMT to about +20 % (1 o'clock)."
   - Principle: "A fast downward pitch sweep at the start is what turns a tone into a kick."
6. **listen**
   - Instruction: "Tight or boomy?"
   - A `{vcf_decay: 20}` · B `{vcf_decay: 150}`
   - Question: "Which has the longer pitch drop?" [0] "A" · [1] "B". **1**.
   - Explain: "VCF DECAY sets how slowly the pitch falls. VCA DECAY sets how long it rings."
7. **quiz**
   - Question: "Which knob mainly sets how long the kick booms?"
   - Options: [0] "VCA DECAY" · [1] "CUTOFF" · [2] "TEMPO". Answer **0**.
   - Explain: "The VCA envelope ends the sound. CUTOFF sets the pitch, and TEMPO sets how often it hits."
8. **patch** `out_seq2_clk` → `in_vca`
   - Instruction: "Patch SEQ 2 CLK into VCA for an accent click on Sequencer 2's beats."
   - Principle: "A short pulse added to an amplifier's control makes a click or accent."
   - Explanation: "VCA IN is added to the VCA envelope; it does not replace it (MAN p.32)."
9. **challenge**
   - Instruction: "Make a tight four-on-the-floor kick that doesn't smear into the next beat."
   - Checklist:
     - "Mixer silent" `['vco1_level','vco1_sub1_level','vco1_sub2_level','vco2_level','vco2_sub1_level','vco2_sub2_level'].every(k => num(k) <= 5)`
     - "Resonance 85 %+" `num('resonance') >= 85`
     - "CUTOFF 40–150 Hz" `num('cutoff') >= 40 && num('cutoff') <= 150`
     - "VCA DECAY ≤ 0.3 s" `num('vca_decay') <= 300`
   - Hints: "The tone is the filter, so keep it ringing." → "CUTOFF is the drum's tuning." → "Shorten VCA DECAY if it booms."
   - Solution `{resonance: 99, cutoff: 80, vcf_eg_amt: 22, vcf_decay: 20, vca_decay: 200}`
10. **reflect**
    - Prompt: "Explain how this kick works, from silence to thump."
    - Model: "The resonant filter oscillates at its cutoff. Each trigger opens the VCA and briefly sweeps the cutoff upward, so the tone falls in pitch quickly and the VCA decay ends it."

**Review**
1. "With all mixer levels at 0, sound can still come from…" — [0] "a self-oscillating filter" · [1] "the VCA" · [2] "the sequencer". **0**. *Max resonance rings.*
2. "To tune the filter-kick, turn…" — [0] "CUTOFF" · [1] "VCO 1 FREQ" · [2] "TEMPO". **0**. *The cutoff is the pitch.*
3. "SEQ CLK into VCA IN gives…" — [0] "short accents on that sequencer's steps" · [1] "silence" · [2] "a pitch change". **0**. *It's summed with the EG.*

---

## 10. `subharmonicon-et1-octave-or-not`: Octave, twelfth or double octave?

**Meta:**
- ear-training · order 1 · beginner · 6 min · prerequisites `subharmonicon-f1-undertones`
- concepts `subharmonics`

**Objective:** Tell ÷2, ÷3 and ÷4 apart by ear.

**Start:** EG HELD; VCO 1 FREQ 25 % (C5); VCO 1 LEVEL 30 %, SUB 1 LEVEL 70 %, SUB 1 ÷1; WAVE DOWN;
CUTOFF 3 kHz.

**Steps**
1. **listen** (hook)
   - Instruction: "Two octave subs. Hear how B is the same note, deeper."
   - A `{vco1_sub1_freq: D(2)}` · B `{vco1_sub1_freq: D(4)}`
2. **listen**
   - Instruction: "Now ÷2 against ÷3."
   - A `{vco1_sub1_freq: D(2)}` · B `{vco1_sub1_freq: D(3)}`
   - Question: "Which one adds a new note name?" [0] "A" · [1] "B". **1**.
   - Explain: "÷3 adds a fifth below the next C. ÷2 stays on C."
3. **quiz**
   - Question: "÷3 below C5 sounds as…"
   - Options: [0] "an F, an octave and a fifth below" · [1] "a C two octaves below" · [2] "an E". Answer **0**.
   - Explain: "523 ÷ 3 ≈ 174 Hz, an F3. Two octaves down would be ÷4."
4. **match** (easy)
   - Instruction: "Set SUB 1 by ear."
   - Setup `{vco1_sub1_freq: D(8)}` · target `{vco1_sub1_freq: D(2)}` · controls `[vco1_sub1_freq]` · `tolerance: 0.03`
   - Hints: "Same note, only lower." → "It is the first octave down."
5. **match**
   - Setup `{vco1_sub1_freq: D(6)}` · target `{vco1_sub1_freq: D(3)}` · `tolerance: 0.03`
   - Hints: "A different note: listen for a fifth." → "Fewer clicks from clockwise than ÷4."
6. **match**
   - Setup `{vco1_sub1_freq: D(1)}` · target `{vco1_sub1_freq: D(4)}` · `tolerance: 0.03`
   - Hints: "Same note, two octaves down."
7. **reflect**
   - Prompt: "How do you tell an octave sub from a twelfth sub by ear?"
   - Model: "An octave blends into the note like a deeper copy; a twelfth adds a different, open fifth under it."

**Review**
1. "÷4 below a VCO is…" — [0] "two octaves down" · [1] "a fourth down" · [2] "four semitones". **0**. *Halve twice.*
2. "Which sounds like a new note?" — [0] "÷3" · [1] "÷2" · [2] "÷8". **0**. *3 is not a power of 2.*
3. "÷6 is…" — [0] "÷3 dropped one more octave" · [1] "a sixth below" · [2] "unison". **0**. *6 = 3 × 2.*

---

## 11. `subharmonicon-et2-undertone-colours`: Name the undertone: ÷5, ÷6 or ÷7

**Meta:**
- ear-training · order 2 · intermediate · 8 min · prerequisites `subharmonicon-et1-octave-or-not`
- concepts `subharmonics`

**Objective:** Recognise ÷5 (a major third below), ÷6 (a fifth below) and ÷7 (a septimal, "between the keys") by ear.

**Start:** EG HELD; VCO 1 FREQ 50 % (C6); VCO 1 LEVEL 20 %; SUB 1 ÷4 (C4 reference) at 55 %; SUB 2 ÷5 at
0 %; WAVE DOWN; CUTOFF 3 kHz.

**Steps**
1. **listen**
   - Instruction: "Add ÷5 under the C reference."
   - A `{vco1_sub2_level: 0}` · B `{vco1_sub2_level: 60, vco1_sub2_freq: D(5)}`
   - Question: "What did ÷5 add?" [0] "A note a major third below the C" · [1] "A higher octave" · [2] "Nothing". **0**.
   - Explain: "1046.5 ÷ 5 ≈ 209 Hz, a slightly sharp A♭: a major third below C."
2. **listen**
   - Instruction: "Compare ÷5 and ÷6 on SUB 2."
   - A `{vco1_sub2_freq: D(5), vco1_sub2_level: 60}` · B `{vco1_sub2_freq: D(6), vco1_sub2_level: 60}`
   - Question: "Which sounds like the stable fifth (F under C)?" [0] "A" · [1] "B". **1**.
   - Explain: "÷6 = ÷3 an octave lower: a pure fifth relationship."
3. **listen**
   - Instruction: "Now ÷6 and ÷7."
   - A `{vco1_sub2_freq: D(6), vco1_sub2_level: 60}` · B `{vco1_sub2_freq: D(7), vco1_sub2_level: 60}`
   - Question: "Which one sits between piano keys?" [0] "A" · [1] "B". **1**.
   - Explain: "÷7 is about 31 cents sharp of D: the bluesy, septimal colour."
4. **quiz**
   - Question: "Under a C oscillator, ÷5 is closest to…"
   - Options: [0] "A♭" · [1] "E" · [2] "G". Answer **0**.
   - Explain: "Undertones mirror overtones: the 5th harmonic is E above, the 5th undertone is A♭ below."
5. **match** (fine)
   - Setup `{vco1_sub2_freq: D(7), vco1_sub2_level: 60}` · target `{vco1_sub2_freq: D(5)}` · controls `[vco1_sub2_freq]` · `tolerance: 0.03`
   - Hints: "Sweet and major-ish." → "Two clicks clockwise from ÷7."
6. **match**
   - Setup `{vco1_sub2_freq: D(5)}` · target `{vco1_sub2_freq: D(7)}` · `tolerance: 0.03`
   - Hints: "Out of the piano's tuning." → "Two clicks counter-clockwise from ÷5."
7. **match**
   - Setup `{vco1_sub2_freq: D(8)}` · target `{vco1_sub2_freq: D(6)}` · `tolerance: 0.03`
   - Hints: "A stable fifth."
8. **reflect**
   - Prompt: "Describe the ÷7 undertone so someone else could find it."
   - Model: "It's the first undertone that doesn't fit the piano: a slightly sharp, bluesy note about a whole tone from the C."

**Review**
1. "The ÷5 undertone of C is near…" — [0] "A♭" · [1] "E" · [2] "B". **0**. *Mirror of the 5th harmonic.*
2. "÷6 relates to ÷3 as…" — [0] "an octave lower" · [1] "a fifth higher" · [2] "unrelated". **0**. *6 = 3 × 2.*
3. "÷7 differs from 12-ET by about…" — [0] "31 cents" · [1] "0 cents" · [2] "50 cents". **0**. *A septimal interval.*
4. "Which undertone is a perfect fifth relation to the VCO's pitch class?" — [0] "÷3 (and ÷6, ÷12)" · [1] "÷5" · [2] "÷7". **0**. *Factor 3 means fifths.*

---

## 12. `subharmonicon-et3-polyrhythm-ears`: Count the polyrhythm

**Meta:**
- ear-training · order 3 · intermediate · 8 min · prerequisites `subharmonicon-f6-rhythm`
- concepts `polyrhythm`, `timing-tempo`

**Objective:** Hear and set two rhythm divisions that play against each other.

**Start:** Preset "Polyrhythm / 3 Against 4".

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: one line on ÷3, one on ÷4."
   - Principle: "Two pulse streams with different periods form a polyrhythm."
2. **listen**
   - Instruction: "Compare two pairs."
   - A `{rhythm3: D(3), rhythm4: D(4)}` · B `{rhythm3: D(2), rhythm4: D(3)}`
   - Question: "Which pair lines up again sooner?" [0] "A (3 vs 4)" · [1] "B (2 vs 3)". **1**.
   - Explain: "2 and 3 meet every 6 pulses; 3 and 4 every 12."
3. **quiz**
   - Question: "÷3 against ÷4: in one shared cycle, how many notes does each line play?"
   - Options: [0] "4 on ÷3 and 3 on ÷4" · [1] "3 and 4" · [2] "12 each". Answer **0**.
   - Explain: "In 12 pulses, ÷3 fires 4 times and ÷4 fires 3 times. The bigger divisor plays fewer notes."
4. **match** (two controls)
   - Instruction: "Restore 3 against 4 by ear."
   - Setup `{rhythm3: D(2), rhythm4: D(8)}` · target `{rhythm3: D(3), rhythm4: D(4)}` · controls `[rhythm3, rhythm4]` · `tolerance: 0.03`
   - Hints: "One line is slightly faster than the other." → "Count: three hits of one against four of the other."
5. **match**
   - Setup `{rhythm3: D(4), rhythm4: D(3)}` · target `{rhythm3: D(2), rhythm4: D(5)}` · `tolerance: 0.03`
   - Hints: "One line is quick and even; the other is slow." → "The fast line is twice the clock period."
6. **reflect**
   - Prompt: "How can you find the length of a polyrhythm's cycle without listening?"
   - Model: "Take the least common multiple of the two divisions: that many master pulses pass before they line up again."

**Review**
1. "÷2 and ÷5 realign every…" — [0] "10 pulses" · [1] "7" · [2] "5". **0**. *lcm(2, 5) = 10.*
2. "Which plays more notes per cycle: ÷3 or ÷4?" — [0] "÷3" · [1] "÷4". **0**. *A smaller divisor fires more often.*
3. "Changing TEMPO changes a polyrhythm's…" — [0] "speed but not its ratio" · [1] "ratio" · [2] "pitch". **0**. *Both lines scale together.*

---

## 13. `subharmonicon-et4-just-vs-equal`: Just or equal? Listen for beats

**Meta:**
- ear-training · order 4 · intermediate · 8 min · prerequisites `subharmonicon-sd2-just-chords`
- concepts `subharmonics`, `oscillator-pitch`

**Objective:** Tell 12-JI from 12-ET by listening for beats, and set QUANTIZE by ear.

**Start:** Preset "Just Intonation / Same Chord in 12-ET" (EG HELD).

**Steps**
1. **listen** (hook)
   - Instruction: "Listen to the lowest note in each."
   - A `{quantize: 1}` · B `{quantize: 3}`
   - Question: "Which one is perfectly still?" [0] "A (12-ET)" · [1] "B (12-JI)". **1**.
   - Explain: "In 12-JI the two low C subs are exactly equal. In ET they're 0.6 Hz apart, and that throbs."
2. **predict** `quantize` → 8-JI `4`
   - Instruction: "Press QUANTIZE once more, to 8-JI."
   - Question: "The chord uses G and E over C. What changes in 8-JI?"
   - Options: [0] "Nothing: both notes exist in the just major scale" · [1] "It starts beating" · [2] "It falls silent". Answer **0**.
   - Explain: "8-JI is just C major, which contains 5/4 and 3/2 (MAN p.16). It only removes the chromatic notes."
   - Principle: "A diatonic scale is a subset of the chromatic one with the same ratios."
3. **quiz**
   - Question: "Beats come from…"
   - Options: [0] "two nearly equal frequencies interfering" · [1] "the filter's resonance" · [2] "a fast envelope". Answer **0**.
   - Explain: "The beat rate is the difference between the frequencies: 65.93 − 65.33 ≈ 0.6 Hz."
4. **match**
   - Instruction: "Set the tuning that makes this chord beat-free."
   - Setup `{quantize: 1}` · target `{quantize: 3}` · controls `[quantize]`
   - Hints: "Listen to the bass: does it throb?" → "Just intonation removes the throb."
5. **match** (interleaved)
   - Instruction: "Now a minor chord. Find the tuning where it *does* beat."
   - Setup: preset "Just Intonation / Minor Lattice" values (VCO 1 C4 with ÷2/÷4, VCO 2 G4 with ÷2/÷5, QUANTIZE 12-JI) · target `{quantize: 1}` · controls `[quantize]`
   - Hints: "Equal temperament beats." → "12-ET."
6. **reflect**
   - Prompt: "Why are beats a useful clue for telling tuning systems apart?"
   - Model: "Just ratios make the shared undertones land on exactly the same frequency, so they don't beat. Equal temperament shifts them slightly, so you hear a slow throb."

**Review**
1. "A slow throb between two low notes means…" — [0] "they are slightly mistuned" · [1] "they are an octave apart" · [2] "the VCA is closing". **0**. *A beat is the frequency difference.*
2. "8-JI includes the ratios…" — [0] "9/8, 5/4, 4/3, 3/2, 5/3, 15/8" · [1] "every semitone" · [2] "only octaves". **0**. *MAN p.16.*
3. "The ET major third is ___ than 5/4." — [0] "about 14 cents wider" · [1] "exactly equal" · [2] "an octave lower". **0**. *400 vs 386.3 cents.*

---

## 14. `subharmonicon-et5-mixed`: Mixed ears: sub, filter or envelope?

**Meta:**
- ear-training · order 5 · advanced · 9 min · prerequisites `subharmonicon-et2-undertone-colours`, `subharmonicon-f3-filter`
- concepts `subharmonics`, `filter-cutoff`, `envelope-decay`

**Objective:** Identify and recreate a change made to SUB 1 FREQ, CUTOFF or VCA DECAY.

**Start:** Preset "Bass / Square Sub Bass".

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY."
   - Principle: "Pitch, brightness and length are three separate things a listener can hear."
2. **listen**
   - Instruction: "What changed?"
   - A `{vco1_sub1_freq: D(4)}` · B `{vco1_sub1_freq: D(3)}`
   - Question: [0] "Pitch" · [1] "Brightness" · [2] "Length". **0**.
   - Explain: "A new divisor is a new note."
3. **listen**
   - A `{cutoff: 400}` · B `{cutoff: 1500}`
   - Question: [0] "Pitch" · [1] "Brightness" · [2] "Length". **1**.
   - Explain: "The note stays the same and only the harmonics change."
4. **listen**
   - A `{vca_decay: 150}` · B `{vca_decay: 600}`
   - Question: [0] "Pitch" · [1] "Brightness" · [2] "Length". **2**.
   - Explain: "The tail gets longer; pitch and colour don't change."
5. **quiz**
   - Question: "A bass sounds the same note but duller. Which control most likely moved?"
   - Options: [0] "CUTOFF" · [1] "SUB 1 FREQ" · [2] "VCA DECAY". Answer **0**.
   - Explain: "Dull at the same pitch means a lower cutoff. SUB FREQ would change the note."
6. **match** (three controls)
   - Instruction: "Recreate the target: it changed in three ways."
   - Target `{vco1_sub1_freq: D(3), cutoff: 900, vca_decay: 500}` · controls `[vco1_sub1_freq, cutoff, vca_decay]` · `tolerance: 0.05`
   - Hints: "Check the note first, then the brightness, then the tail." → "The note is a fifth-type undertone." → "It's brighter and longer than the start."
7. **reflect**
   - Prompt: "What order do you check things in when matching a sound, and why?"
   - Model: "Pitch first, because it's the most obvious; then brightness; then envelope length, which is easiest to hear once the note and tone are right."

**Review**
1. "Same note, longer tail →" — [0] "VCA DECAY" · [1] "CUTOFF" · [2] "SUB FREQ". **0**.
2. "Different note, same tone →" — [0] "SUB FREQ" · [1] "RESONANCE" · [2] "VOLUME". **0**.
3. "Brighter, same note →" — [0] "CUTOFF up" · [1] "VCA ATTACK up" · [2] "TEMPO up". **0**.

---

## 15. `subharmonicon-sq1-or-xor`: Combining rhythms: OR and XOR

**Meta:**
- sequencing · order 1 · intermediate · 8 min · prerequisites `subharmonicon-f6-rhythm`
- concepts `polyrhythm`, `sequencer-pattern`

**Objective:** Predict and hear how OR and XOR logic combine two rhythm generators on one sequencer.

**Start:** Preset "Polyrhythm / Hemiola 2+3 (OR)".

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: ÷2 and ÷3 share Sequencer 1."
   - Principle: "OR logic steps the sequencer whenever any assigned generator fires."
2. **info**
   - Instruction: "The merged pattern is x.xxx.: four steps every six pulses, so the 4-note riff locks to the cycle."
   - Explanation: "On the downbeat both fire together; OR counts that as one step."
3. **predict** `rhythm_logic` → XOR `1`
   - Instruction: "Switch RHYTHM LOGIC to XOR."
   - Question: "XOR steps only when exactly one generator fires. Which hit disappears?"
   - Options: [0] "The downbeat, where ÷2 and ÷3 coincide" · [1] "Every ÷3 hit" · [2] "None". Answer **0**.
   - Explain: "XOR rejects pulses where both fire (MAN p.43), so the shared downbeat vanishes and the riff now takes 24 pulses to come round."
   - Principle: "XOR keeps a hit only when exactly one source fires."
4. **listen**
   - A `{rhythm_logic: 0}` · B `{rhythm_logic: 1}`
   - Question: "Which version loses the strong first beat?" [0] "A" · [1] "B". **1**.
   - Explain: "The XOR version sounds syncopated: it starts off the beat."
5. **quiz**
   - Question: "÷2 and ÷4 on one sequencer with XOR give…"
   - Options: [0] "only the off-beat 8ths" · [1] "every 8th" · [2] "nothing". Answer **0**.
   - Explain: "Every ÷4 hit coincides with a ÷2 hit and cancels, so only the ÷2 hits between them remain: ..x.."
6. **challenge**
   - Instruction: "Use XOR to make an off-beat, hi-hat-like pulse on Sequencer 1."
   - Checklist:
     - "XOR" `num('rhythm_logic') === 1`
     - "Two generators on SEQ 1, one twice the other" `(bool('rhythm1_seq1') && bool('rhythm2_seq1') && (-num('rhythm2') === 2 * -num('rhythm1') || -num('rhythm1') === 2 * -num('rhythm2')))`
   - Hints: "You need a division and its double." → "÷2 with ÷4."
   - Solution `{rhythm_logic: 1, rhythm1: D(2), rhythm2: D(4), rhythm1_seq1: true, rhythm2_seq1: true}`
7. **reflect**
   - Prompt: "When would you pick XOR over OR?"
   - Model: "When I want syncopation: XOR removes the coincident, strong beats and leaves the in-between hits."

**Review**
1. "OR logic steps when…" — [0] "one or more generators fire" · [1] "exactly one fires" · [2] "all fire". **0**. *MAN p.43.*
2. "XOR removes…" — [0] "coincident hits" · [1] "the off-beats" · [2] "every hit". **0**.
3. "On the hardware, RHYTHM LOGIC is set by…" — [0] "MIDI CC 113 (a global setting)" · [1] "a front-panel switch" · [2] "the TEMPO knob". **0**. *The twin shows it as a switch for convenience.*

---

## 16. `subharmonicon-sq2-intertwined`: Two sequencers, one melody

**Meta:**
- sequencing · order 2 · intermediate · 8 min · prerequisites `subharmonicon-f5-sequencer`
- concepts `sequencer-pattern`, `signal-routing`
- source "Synth Studio · after Moog's Patching with Intention exercise (PWI p.5)"

**Objective:** Patch SEQ 2 into VCO 1 so a slow sequencer transposes a fast one into a 16-step phrase.

**Start:** Preset "Tutorial / First Sequence", plus RHYTHM 2 ÷16 → SEQ 2, SEQ 2 steps 0/−42/−17/+17 %
(0/−5/−2/+2 semitones).

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY: a four-note loop."
   - Principle: "A four-step loop repeats quickly, so changing it over time keeps it interesting."
2. **predict** patch `out_seq2` → `in_vco1`
   - Instruction: "Patch SEQ 2 into VCO 1's input."
   - Question: "What happens when SEQ 2 also feeds VCO 1?"
   - Options: [0] "SEQ 1's loop is transposed each time SEQ 2 steps" · [1] "The two sequences alternate" · [2] "Only SEQ 2 is heard". Answer **0**.
   - Explain: "Voltages at an oscillator input add to the assigned sequencer (MAN p.30), so SEQ 2 shifts the whole loop."
   - Principle: "Control voltages patched to the same input add together."
3. **quiz**
   - Question: "RHYTHM 1 is ÷1 and RHYTHM 2 is ÷16. How many times does SEQ 1's loop play before SEQ 2 steps?"
   - Options: [0] "4" · [1] "16" · [2] "1". Answer **0**.
   - Explain: "SEQ 1 needs 4 pulses per loop, and SEQ 2 steps every 16 pulses. The full phrase is 64 pulses."
4. **info**
   - Instruction: "VCO 1's input is normalled to VCO 2, so the cable reaches VCO 2 too unless something is patched into VCO 2."
   - Explanation: "This is useful for a bass that follows the roots. If OSC 2 is also lit, VCO 2 receives SEQ 2 twice."
5. **challenge**
   - Instruction: "Make a 16-step bassline: a 4-note riff walked through four roots."
   - Checklist:
     - "SEQ 2 → VCO 1 cable" `s.patches.some(p => p.from === 'out_seq2' && p.to === 'in_vco1')`
     - "RHYTHM 2 four times slower than RHYTHM 1" `-num('rhythm2') === 4 * -num('rhythm1')`
     - "SEQ 2 steps not all equal" `new Set([1,2,3,4].map(i => num('seq2_step'+i))).size > 1`
   - Hints: "SEQ 2 needs a division four times RHYTHM 1's." → "Set the four roots on SEQ 2's knobs."
   - Solution
     - values `{rhythm1: D(2), rhythm2: D(8), seq2_step1: 0, seq2_step2: -42, seq2_step3: -17, seq2_step4: 17}`
     - patches `[{from:'out_seq2', to:'in_vco1'}]`
6. **reflect**
   - Prompt: "How can two 4-step sequencers make a 16-step phrase?"
   - Model: "One runs fast and plays the riff; the other steps four times slower and transposes it, so the combination only repeats after 16 notes."

**Review**
1. "Two CVs into one VCO input…" — [0] "add together" · [1] "take turns" · [2] "cancel". **0**.
2. "VCO 1 IN is normalled to…" — [0] "VCO 2's pitch input" · [1] "the filter" · [2] "nothing". **0**. *MAN p.30.*
3. "To transpose a loop once per cycle, the transposing sequencer runs…" — [0] "4× slower" · [1] "4× faster" · [2] "at the same rate". **0**.

---

## 17. `subharmonicon-sq3-undertone-melodies`: Sequencing the undertones

**Meta:**
- sequencing · order 3 · advanced · 9 min · prerequisites `subharmonicon-et2-undertone-colours`, `subharmonicon-f5-sequencer`
- concepts `subharmonics`, `sequencer-pattern`
- source "Synth Studio · after the Exploration Patchbook's undertone-sequencing patch (XPB p.7)"

**Objective:** Use SEQ ASSIGN SUB so the sequencer walks the undertone series instead of moving the VCO.

**Start:**
- EG ON; RHYTHM 1 ÷2 → SEQ 1; TEMPO 616 BPM
- VCO 1 FREQ 50 % (C6), VCO 1 LEVEL 10 %; SUB 1 ÷8 at 70 %
- SEQ 1 OSC off, SUB 1 off; SEQ OCT ±5; QUANTIZE OFF; SEQ 1 steps 0/+25/+50/−25 %

**Steps**
1. **do** `seq1_sub1` → true
   - Instruction: "Light SUB 1 in SEQ 1 ASSIGN, leaving OSC 1 dark."
   - Principle: "Sequencing a divider's whole number moves along the undertone series, not the keyboard."
2. **do** `play` → true
   - Instruction: "Press PLAY."
   - Principle: "Integer steps make every note of the melody a whole-number ratio of one pitch."
3. **predict** `seq1_step2` → +60 %
   - Instruction: "Turn STEP 2 further clockwise."
   - Question: "Turning a STEP clockwise makes SUB 1's divisor…"
   - Options: [0] "smaller, so that note moves up the undertone series" · [1] "larger, so it drops" · [2] "unchanged, because only OSC moves pitch". Answer **0**.
   - Explain: "Positive CV raises the pitch, and for a divider that means a smaller divisor (MAN p.25). SUB assign changes the integer even with OSC off."
   - Principle: "Raising a divider's control lowers its divisor, so the sub's pitch rises."
4. **listen**
   - Instruction: "Same knobs, two destinations."
   - A `{seq1_osc: true, seq1_sub1: false}` · B `{seq1_osc: false, seq1_sub1: true}`
   - Question: "Which melody stays on one harmonic grid?" [0] "A (OSC)" · [1] "B (SUB 1)". **1**.
   - Explain: "With SUB assign every note is VCO ÷ n, so all notes share the VCO as their common 'harmonic' source."
5. **quiz**
   - Question: "With only SUB 1 assigned, which part stays fixed?"
   - Options: [0] "VCO 1 and SUB 2" · [1] "SUB 1" · [2] "Nothing". Answer **0**.
   - Explain: "Only SUB 1's divisor moves. The VCO and the other sub keep their settings."
6. **challenge**
   - Instruction: "Write a 4-step undertone melody where VCO 1 never changes pitch."
   - Checklist:
     - "OSC 1 off" `!bool('seq1_osc')`
     - "SUB 1 or SUB 2 assigned" `bool('seq1_sub1') || bool('seq1_sub2')`
     - "Steps differ" `new Set([1,2,3,4].map(i => Math.round(num('seq1_step'+i)/10))).size >= 3`
   - Hints: "Keep OSC 1 dark." → "Spread the step knobs widely: at ±5 small moves barely change the divisor."
   - Solution `{seq1_osc: false, seq1_sub1: true, seq1_step1: 0, seq1_step2: 40, seq1_step3: 60, seq1_step4: -30}`
7. **reflect**
   - Prompt: "How does an undertone melody differ from a normal keyboard melody?"
   - Model: "Its notes are whole-number divisions of one fixed pitch, so they come from the undertone series rather than the 12-note scale, and they stay locked together."

**Review**
1. "SEQ ASSIGN SUB 1 changes…" — [0] "SUB 1's integer" · [1] "VCO 1's pitch" · [2] "the filter". **0**. *MAN p.25.*
2. "A smaller divisor means…" — [0] "a higher sub pitch" · [1] "a lower sub pitch" · [2] "a quieter sub". **0**.
3. "SEQ ASSIGN buttons can be combined…" — [0] "in any combination" · [1] "only one at a time" · [2] "only OSC with SUB 2". **0**. *MAN p.25.*

---

## 18. `subharmonicon-pf1-live`: Live moves: RESET, hold and assignments

**Meta:**
- performance · order 1 · intermediate · 10 min · prerequisites `subharmonicon-sq1-or-xor`
- concepts `polyrhythm`, `sequencer-pattern`

**Objective:** Perform a short arrangement using assign buttons, RESET (tap and hold) and mixer rides.

**Start:** Preset "Polyrhythm / Hemiola 2+3 (OR)".

**Steps**
1. **do** `play` → true
   - Instruction: "Press PLAY."
   - Principle: "Live variation comes from changing routings, not only knob positions."
2. **predict** `rhythm2_seq1` → false
   - Instruction: "Turn off RHYTHM 2's SEQ 1 button mid-phrase."
   - Question: "What happens?"
   - Options: [0] "The extra hits drop out, leaving the plain ÷2 pulse" · [1] "The sequencer stops" · [2] "It resets to step 1". Answer **0**.
   - Explain: "Assignments take effect on the next pulse. Only RESET returns the sequence to step 1."
   - Principle: "Removing a pulse source thins a rhythm instantly without stopping it."
3. **info** focus `[reset]`
   - Instruction: "Tap RESET on a strong beat to restart everything together, like a new section."
   - Explanation: "If PLAY is lit, the restart begins on the next clock pulse (MAN p.27)."
4. **info** focus `[reset, next]`
   - Instruction: "Hold RESET: the sequence freezes on step 1 while notes keep firing. Tap NEXT while holding."
   - Explanation: "Holding RESET freezes on step 1, but the envelopes still fire from the assigned rhythms. NEXT steps forward during the hold (MAN p.28)."
5. **quiz**
   - Question: "While RESET is held, the envelopes…"
   - Options: [0] "keep firing from the assigned rhythms" · [1] "stop" · [2] "hold at maximum". Answer **0**.
   - Explain: "Hold only stops the step position; the rhythm generators keep triggering notes, which is how you get the stutter."
6. **do** `vco2_sub1_level` → 0
   - Instruction: "Ride VCO 2 SUB 1 LEVEL down to zero for a breakdown."
   - Principle: "Removing the low end makes a breakdown; bringing it back makes the drop."
7. **challenge**
   - Instruction: "Bring the groove back: re-add RHYTHM 2 to SEQ 1 and the bass level, then tap RESET on the downbeat."
   - Checklist:
     - "RHYTHM 2 back on SEQ 1" `bool('rhythm2_seq1')`
     - "Bass back" `num('vco2_sub1_level') >= 40`
     - "Still playing" `s.transport.playing || !!s.engine.playing`
   - Hints: "Undo the two moves you made." → "Tap RESET right on the beat."
   - Solution `{rhythm2_seq1: true, vco2_sub1_level: 60}`
8. **reflect**
   - Prompt: "Which three live moves on the Subharmonicon change the music most, and how?"
   - Model: "Toggling rhythm assignments changes the groove, RESET (tapped or held) restarts or stutters the phrase, and mixer rides bring parts in and out."

**Review**
1. "Holding RESET…" — [0] "freezes on step 1; notes keep firing" · [1] "stops everything" · [2] "mutes the VCA". **0**. *MAN p.28.*
2. "Tapping RESET while playing restarts…" — [0] "on the next clock pulse" · [1] "after one bar" · [2] "only when stopped". **0**. *MAN p.27.*
3. "An assignment change takes effect…" — [0] "on the next pulse" · [1] "after RESET" · [2] "at power-up". **0**.

---

## 19. `subharmonicon-st1-studio-clock`: Lock to the studio clock

**Meta:**
- studio · order 1 · intermediate · 9 min · prerequisites `subharmonicon-f6-rhythm`
- `requires: ['studio-clock']`; concepts `timing-tempo`, `signal-routing`
- source "Synth Studio · Subharmonicon manual, TEMPO and clock inputs (MAN p.24, p.36)"

**Objective:** Sync the Subharmonicon to the studio, first by MIDI-style sync and then by an analog clock cable, and explain the 16th-note pulse.

**Start:** Preset "Polyrhythm / 3 Against 4"; studio tempo 120 BPM; sync on (default).

**Steps**
1. **info**
   - Instruction: "Synced, the Subharmonicon follows the studio like MIDI clock: one master pulse per 16th note."
   - Explanation: "Moog: the internal clock is one pulse per beat, but MIDI clock runs the pulse at 16ths (MAN p.24)."
2. **predict** check `s.transport.playing`
   - Instruction: "Press ▶ in the top bar."
   - Question: "Synced at 120 BPM, RHYTHM 4 is ÷4. How often does Sequencer 2 step?"
   - Options: [0] "Every quarter note, twice a second" · [1] "Every 16th" · [2] "Once a bar". Answer **0**.
   - Explain: "A 16th-note pulse ÷4 is a quarter note. On the internal clock the same ÷4 would be four times slower, because TEMPO counts beats."
   - Principle: "A follower divides the leader's clock, so divisions convert straight into note values."
3. **quiz**
   - Question: "Why does TEMPO do nothing now?"
   - Options: [0] "MIDI clock overrides the internal clock" · [1] "PLAY is off" · [2] "TEMPO only works with CLOCK IN". Answer **0**.
   - Explain: "MIDI clock outranks both the CLOCK input and TEMPO (MAN p.24). The third option is backwards: CLOCK IN also overrides TEMPO."
4. **challenge** (instance studio)
   - Instruction: "Turn the Subharmonicon's sync off, then patch Studio Clock CLOCK into its CLOCK input."
   - Checklist:
     - "Sync off" `s.sync[instanceOf(s,'subharmonicon')] === false`
     - "Cable" `studioCable(s,'out_clock','in_clock','studio-clock','subharmonicon')`
   - Hints: "MIDI-style sync would override the cable, so switch it off first." → "Tap CLOCK on the Studio Clock, then CLOCK on the Subharmonicon's bottom row."
   - Solution: patches `[{studio-clock out_clock → subharmonicon in_clock}]`, plus `sync: {subharmonicon: false}`
5. **challenge** (instance `studio-clock`)
   - Instruction: "Set CLOCK DIV to 1/16 so each pulse is a 16th again."
   - Checklist: "CLOCK DIV 1/16" `Number(deviceValues(s,'studio-clock').division) === 2`
   - Hints: "Four pulses per beat." → "Choose 1/16."
   - Solution `{division: 2}` on `studio-clock`
6. **challenge**
   - Instruction: "Patch Studio Clock RUN into PLAY so the studio's ▶ and ■ start and stop it."
   - Checklist: "RUN → PLAY" `studioCable(s,'out_run','in_play','studio-clock','subharmonicon')`
   - Hints: "PLAY IN is gate-level: high plays, low stops (MAN p.33)."
   - Solution: patches `[{studio-clock out_run → subharmonicon in_play}]`
7. **reflect**
   - Prompt: "Why do RHYTHM divisions feel four times faster under MIDI sync than on TEMPO?"
   - Model: "TEMPO pulses once per beat, but MIDI clock drives the master pulse at 16th notes, so every division now counts 16ths."

**Review**
1. "Under MIDI clock the master pulse is…" — [0] "a 16th note" · [1] "a beat" · [2] "a bar". **0**. *MAN p.24.*
2. "Clock priority is…" — [0] "MIDI > CLOCK IN > TEMPO" · [1] "TEMPO > MIDI" · [2] "CLOCK IN > MIDI". **0**.
3. "A gate into PLAY…" — [0] "plays while high, stops when low" · [1] "toggles on each edge" · [2] "resets". **0**. *MAN p.33.*
4. "CLOCK OUT sends pulses…" — [0] "only while playing" · [1] "always" · [2] "only when stopped". **0**. *MAN p.36.*

---

## 20. `subharmonicon-st2-clock-dfam`: The Subharmonicon clocks the DFAM

**Meta:**
- studio · order 2 · advanced · 10 min · prerequisites `subharmonicon-st1-studio-clock`, `subharmonicon-sq1-or-xor`
- `requires: ['dfam']`; concepts `timing-tempo`, `signal-routing`, `polyrhythm`
- source "Synth Studio · Subharmonicon manual, 'Using Subharmonicon to clock DFAM' (MAN p.37)"

**Objective:** Clock the DFAM from the Subharmonicon, then make the DFAM follow a polyrhythm.

**Start:** Subharmonicon preset "Polyrhythm / Hemiola 2+3 (OR)" with studio sync **off**, TEMPO 480 BPM,
stopped. DFAM loaded with a simple drum pattern and stopped.

**Steps**
1. **info**
   - Instruction: "The DFAM has no MIDI. The Subharmonicon can be its clock: one pulse per DFAM step."
   - Explanation: "Moog's recipe: Subharmonicon CLOCK into DFAM ADV/CLOCK, and press DFAM RUN/STOP before Subharmonicon PLAY (MAN p.37)."
2. **challenge** (instance `subharmonicon`)
   - Instruction: "Patch Subharmonicon CLOCK (output) into the DFAM's ADV/CLOCK."
   - Checklist: "CLOCK → ADV/CLOCK" `studioCable(s,'out_clock','in_adv_clock','subharmonicon','dfam')`
   - Hints: "Use the Subharmonicon's CLOCK *output*: inverted label, bottom row." → "It goes into ADV/CLOCK on the DFAM."
   - Solution: patches `[{subharmonicon out_clock → dfam in_adv_clock}]`
3. **predict** `run_stop` → true (instance `dfam`)
   - Instruction: "Press RUN / STOP on the DFAM."
   - Question: "The Subharmonicon is stopped. What does the DFAM do?"
   - Options: [0] "Waits: no pulses arrive yet" · [1] "Plays at its own TEMPO" · [2] "Plays one step". Answer **0**.
   - Explain: "CLOCK OUT only sends pulses while the Subharmonicon plays (MAN p.36), and a cable in ADV/CLOCK replaces the DFAM's own tempo."
   - Principle: "The follower is armed first; it then moves only when the leader sends pulses."
4. **do** `play` → true
   - Instruction: "Now press the Subharmonicon's PLAY."
   - Principle: "One leader clock keeps every instrument in time."
5. **quiz**
   - Question: "TEMPO is 480 BPM. How fast does the DFAM step?"
   - Options: [0] "8 steps per second: 16ths at 120 BPM" · [1] "2 per second" · [2] "480 per second". Answer **0**.
   - Explain: "CLOCK OUT carries the master pulse, 480 per minute = 8 per second. Each pulse is one DFAM step."
6. **challenge** (instance `subharmonicon`)
   - Instruction: "Move the cable to SEQ 1 CLK so the DFAM follows Sequencer 1's lopsided ÷2+÷3 rhythm."
   - Checklist:
     - "SEQ 1 CLK → ADV/CLOCK" `studioCable(s,'out_seq1_clk','in_adv_clock','subharmonicon','dfam')`
     - "No CLOCK cable left" `!studioCable(s,'out_clock','in_adv_clock','subharmonicon','dfam')`
   - Hints: "SEQ 1 CLK pulses each time Sequencer 1 moves (MAN p.35)." → "The DFAM now steps on the x.xxx. pattern."
   - Solution: patches `[{subharmonicon out_seq1_clk → dfam in_adv_clock}]`
7. **reflect**
   - Prompt: "What's the difference between clocking the DFAM from CLOCK and from SEQ 1 CLK?"
   - Model: "CLOCK sends every master pulse, so the DFAM runs straight 16ths. SEQ 1 CLK only pulses when Sequencer 1 moves, so the DFAM inherits the Subharmonicon's polyrhythm."

**Review**
1. "Moog's order for syncing the DFAM is…" — [0] "DFAM RUN/STOP first, then Subharmonicon PLAY" · [1] "PLAY first, then RUN/STOP" · [2] "any order". **0**. *MAN p.37.*
2. "For a polyrhythmic DFAM, clock it from…" — [0] "SEQ 1 CLK, SEQ 2 CLK or TRIGGER" · [1] "VCA" · [2] "MIDI IN". **0**. *MAN p.37 tip.*
3. "SEQ 1 CLK pulses…" — [0] "each time Sequencer 1 moves" · [1] "on every master pulse" · [2] "once per bar". **0**.
4. "With a cable in DFAM ADV/CLOCK, the DFAM's TEMPO…" — [0] "is ignored" · [1] "sets the speed" · [2] "sets the volume". **0**. *External clock replaces it.*

---

## Coverage check (PEDAGOGY "must have")

| Lesson | Objective | First win | Predict/listen | Quiz | Match/challenge | Reflect | Reviews |
|---|---|---|---|---|---|---|---|
| 1–20 | ✓ | step 1–2 sounds (drone or PLAY) | ✓ each | ✓ each | ✓ each (ear-training lessons use match) | ✓ each | 3–4 each |

Ear-training: 5 lessons (10–14). They cover subharmonic intervals (10, 11), polyrhythms (12), just vs
equal temperament (13) and an interleaved mix (14), with difficulty rising from 1 to 3 controls and
from wide to fine differences. Studio: 2 lessons (19, 20), covering studio-clock sync both ways and
clocking the DFAM.
