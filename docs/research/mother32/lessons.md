# Moog Mother-32: lesson outlines (v2, 20 lessons)

These outlines follow `docs/PEDAGOGY.md` and use the `Lesson` and `LessonStep` types
(`types/index.ts`). They are modelled on the DFAM lessons and on `lib/studio/lessons.ts`, and they
pass the warnings of `scripts/validate-devices.ts` at commit 89801d8:
- ids start with `mother32-`;
- every challenge has `hints` and a `solution`;
- every predict has an action;
- every do, patch and predict step has a principle;
- there are at least 3 review questions.

The writing is our own. The facts come from the Owner's Manual (cited M32 p.N, PDF page) via
`signal-flow.md`.

## Conventions

- **INIT** is preset 00: the manual's default panel (M32 p.10). That is a saw, MIX at VCO,
  CUTOFF 11:00, RESONANCE 0, VCF MOD +50 % from the EG, ATTACK minimum, DECAY 11:30,
  SUSTAIN ON, VCA MODE EG, VOLUME 12:00, octave 4, no cables, and the sequencer stopped.
  "Start" lists only the changes from INIT and always uses `reset: true`.
- **Positions** are given as clock positions and real units, as in `presets.md`.
- **Control ids** are those in `signal-flow.md` §15. Switch values are written as printed
  legends, so map them to option indices:
  - `vco_wave` PULSE/SAW · `vco_mod_source` EG/LFO · `vco_mod_dest` PULSE WIDTH/FREQUENCY
  - `vcf_mode` HP/LP · `vcf_mod_source` EG/LFO · `vcf_mod_polarity` +/− (new)
  - `lfo_wave` SQUARE/TRIANGLE · `sustain` ON/OFF · `vca_mode` ON/EG · `assign_source` 1–16
- **Step data** follows `signal-flow.md` §11.8 (`steps[i].note/gate/glide/ratchet/accent/rest`,
  `length`, `division`, `swing`, `swingInterval`, `direction`). Checks on it are written in
  words. Until the data model exists, use `info` for those steps.
- **Studio steps** follow `lib/studio/lessons.ts`: a cable is a `do` or `predict` with `check: s
  => cable(s, …)` and `instance`; sync is `check: s.sync[id] !== false`; play is `check:
  s.transport.playing`.
- **MC format**: `Q`, options `0) … 1) …`, `A` is the correct index, `Why` is the explain text.

| # | Id | Path · order | Level | Prerequisites |
|---|---|---|---|---|
| 1 | mother32-f1-vco | foundations · 0.01 | beginner | – |
| 2 | mother32-f2-mixer | foundations · 0.02 | beginner | f1 |
| 3 | mother32-f3-vcf | foundations · 0.03 | beginner | f2 |
| 4 | mother32-f4-eg-vca | foundations · 0.04 | beginner | f3 |
| 5 | mother32-f5-modulation | foundations · 0.05 | intermediate | f4 |
| 6 | mother32-f6-lfo-glide | foundations · 0.06 | intermediate | f5 |
| 7 | mother32-f7-patchbay | foundations · 0.07 | intermediate | f6 |
| 8 | mother32-sd1-bass | sound-design · 0.08 | beginner | f4 |
| 9 | mother32-sd2-acid | sound-design · 0.09 | intermediate | sd1, sq1 |
| 10 | mother32-sd3-drums | sound-design · 0.10 | intermediate | f5 |
| 11 | mother32-sd4-filter-voice | sound-design · 0.11 | advanced | f7 |
| 12 | mother32-e1-cutoff | ear-training · 0.12 | beginner | f3 |
| 13 | mother32-e2-decay | ear-training · 0.13 | intermediate | f4 |
| 14 | mother32-e3-filter-env | ear-training · 0.14 | intermediate | f5, e1 |
| 15 | mother32-e4-mixed | ear-training · 0.15 | advanced | e3 |
| 16 | mother32-sq1-step-mode | sequencing · 0.16 | intermediate | f4 |
| 17 | mother32-sq2-timing | sequencing · 0.17 | advanced | sq1 |
| 18 | mother32-p1-live | performance · 0.18 | intermediate | sq1 |
| 19 | mother32-st1-studio-clock | studio · 8 | intermediate | sq1 · requires `studio-clock` |
| 20 | mother32-st2-dfam | studio · 9 | advanced | st1 · requires `dfam` |

The studio orders 8 and 9 follow the shared studio lessons (1–5) and the DFAM's (6–7). Check
for collisions.

---

## FOUNDATIONS

### 1 · mother32-f1-vco: The VCO, pitch and waveform
- **Description**: Where every Mother-32 sound starts: one oscillator, its pitch and its two waves.
- **Concepts**: oscillator-pitch, oscillator-waveform · ~6 min · source "Synth Studio · Mother-32 manual, VCO (M32 p.12)"
- **Objective**: Set the VCO's pitch with FREQUENCY and its tone colour with VCO WAVE and PULSE WIDTH.
- **Start**: INIT + VCA MODE **ON** (a drone, so the VCO sounds with no key) · CUTOFF 5:00 (20 kHz) · VCF MOD AMOUNT 0.

**Steps**
1. **info** (autoplay): "Listen: this is the VCO droning through an open filter. Every sound starts here."
   *Principle*: An oscillator repeats a wave; how many times per second is the pitch.
   *Explanation*: VCA MODE is on ON, so the sound plays without a key. Lesson 4 explains VCA MODE.
2. **do** `frequency → +1 oct` (5:00): "Turn FREQUENCY fully clockwise." *(first win)*
   *Principle*: Raising an oscillator's frequency raises its pitch; doubling it is one octave.
   *Explanation*: FREQUENCY tunes about one octave either side of noon. Bigger jumps come from the
   keyboard's octave buttons, the sequencer or the 1V/OCT jack.
3. **predict** `vco_wave → PULSE`: "Flip VCO WAVE up to PULSE."
   Q: What will switching VCO WAVE from SAW to PULSE change? 0) The pitch · 1) The tone colour: which harmonics are present · 2) Only the loudness. **A = 1**.
   Why: Both waves repeat at the same rate, so the pitch stays put. A saw has every harmonic and a square only the odd ones, so it sounds hollower. The level changes a little, but that is a side effect.
   *Principle*: Different wave shapes at the same pitch contain different harmonics.
4. **do** `pulse_width → 10 %` (just before 8:00; tolerance 6 %): "Turn PULSE WIDTH down to about 8 o'clock."
   *Principle*: A narrower pulse has more strong high harmonics, so it sounds thinner and more nasal.
5. **listen**: A `{pulse_width: 50}` / B `{pulse_width: 10}`, labels "50 %" / "10 %".
   Q: Which one is the hollow, clarinet-like square? 0) A, at 50 % · 1) B, at 10 % · 2) They sound the same. **A = 0**.
   Why: A square is a pulse that is high for exactly half its cycle. At 10 % the wave is a thin spike full of high harmonics, so it buzzes.
6. **quiz**: Q: With the keyboard and 1V/OCT, the VCO covers about… 0) 8 Hz to 8 kHz · 1) 20 Hz to 20 kHz · 2) 0.1 Hz to 350 Hz. **A = 0**.
   Why: The VCO spans 8 Hz–8 kHz, ten octaves. 20 Hz–20 kHz is the filter's cutoff range and 0.1–350 Hz is the LFO's.
7. **match**: target `{vco_wave: PULSE, pulse_width: 25}` (PULSE WIDTH 9:30), controls `[vco_wave, pulse_width]`, tolerance 0.10. "Ear challenge: recreate the target tone."
   Hints: "Buzzy like the saw, or hollow and reedy?" → "The pulse, narrower than a square." → "VCO WAVE on PULSE, PULSE WIDTH near 9:30 (25 %)."
8. **challenge**: "Make a hollow, clarinet-like tone as low as FREQUENCY goes."
   Checklist: VCO WAVE = PULSE · PULSE WIDTH 40–60 % · FREQUENCY ≤ −0.8 oct.
   Hints: "Which wave is hollow?" → "A square is a pulse at half width." → "PULSE, PULSE WIDTH at noon, FREQUENCY fully left."
   Solution: `{values: {vco_wave: PULSE, pulse_width: 50, frequency: -1}}`.
9. **reflect**: "In one sentence: what does FREQUENCY change, and what do VCO WAVE and PULSE WIDTH change?"
   Model: FREQUENCY changes the pitch. VCO WAVE and PULSE WIDTH change the tone colour, which harmonics are present, without changing the pitch.

**Review**
1. A saw and a square at the same pitch: the saw… 0) contains every harmonic, the square only odd ones · 1) is an octave higher · 2) has no harmonics. **A = 0**. Why: Same fundamental, different recipe of harmonics.
2. PULSE WIDTH at noon gives… 0) a square wave · 1) a sawtooth · 2) silence. **A = 0**. Why: About 2 % to 98 % across the travel, and square at mid position.
3. Where can you get the saw and the pulse at the same time? 0) at the VCO SAW and VCO PULSE jacks · 1) only through MIX · 2) nowhere. **A = 0**. Why: VCO WAVE only chooses what feeds the mixer.
4. FREQUENCY on the Mother-32 spans… 0) about ±1 octave around noon · 1) ±5 octaves · 2) one semitone. **A = 0**. Why: It is a tuning and performance control. ±5 octaves is the DFAM's.

---

### 2 · mother32-f2-mixer: The mixer: VCO, noise and EXT. AUDIO
- **Description**: Blend the oscillator with noise, then swap the noise for anything you patch in.
- **Concepts**: mixing, noise, signal-routing · ~6 min · source "M32 pp.11, 14, 48"
- **Objective**: Blend the VCO with noise using MIX, and replace the noise by patching into EXT. AUDIO.
- **Start**: INIT + VCA MODE ON · CUTOFF 5:00 · VCF MOD AMOUNT 0.

**Steps**
1. **info** (autoplay): "MIX is a crossfader: fully left you hear only the VCO, fully right only NOISE."
   *Principle*: A crossfader trades one source for another; as one rises, the other falls.
2. **do** `mix → 50` (12:00): "Turn MIX to noon." *(first win)*
   *Principle*: Mixing a pitched tone with noise adds breath and grit.
3. **predict** `mix → 100` (5:00): "Turn MIX fully clockwise."
   Q: What will you hear with MIX fully clockwise? 0) Only hiss: noise with no pitch · 1) The VCO an octave higher · 2) Silence. **A = 0**.
   Why: The right end passes only the noise. White noise has energy at every frequency, so there is no pitch to hear. The VCO keeps running, just out of the mix, so it isn't silent.
   *Principle*: White noise contains all frequencies equally, so it has no pitch.
4. **do** `cutoff → 317 Hz` (11:00): "Turn CUTOFF down to about 11 o'clock."
   *Principle*: Filtering noise leaves only a band of it, so hiss becomes rumble or wind.
5. **patch** `out_vco_pulse → in_ext_audio` (setup `cutoff 20000`): "Patch VCO PULSE into EXT. AUDIO."
   *Principle*: A cable into an input breaks its normal; the cable's signal replaces the hidden connection.
   *Explanation*: NOISE is normalled to EXT. AUDIO. Now MIX blends the saw (VCO WAVE) with the pulse from the same VCO. The manual suggests exactly this trick.
6. **listen**: A `{mix: 0}` / B `{mix: 100}`, labels "MIX left" / "MIX right".
   Q: With the cable in EXT. AUDIO, what is MIX blending now? 0) The saw and the pulse of the same VCO · 1) The VCO and the noise · 2) Two different pitches. **A = 0**.
   Why: The cable replaced the noise. VCO WAVE sends the saw to the left and the cable brings the pulse to the right, both at the same pitch.
7. **quiz**: Q: Why did the noise disappear when you patched EXT. AUDIO? 0) The cable overrode the noise normal · 1) The noise generator switched off · 2) MIX turned itself down. **A = 0**.
   Why: EXT. AUDIO is normalled to NOISE, and a plug overrides that. The NOISE output jack still works.
8. **match** (setupPatches: none): target `{mix: 30, cutoff: 2500}`, controls `[mix]`, tolerance 0.12. "Ear challenge: how much noise is in the target?"
   Hints: "Is there any hiss at all?" → "A little; it is still clearly pitched." → "MIX at about 10 o'clock (30 %)."
9. **challenge**: "Make a breathy flute: mostly tone, a touch of noise, softened by the filter."
   Checklist: MIX 10–40 % · CUTOFF 500 Hz–2.5 kHz · VCO WAVE PULSE with PULSE WIDTH 40–60 %.
   Hints: "Flutes are round, not buzzy: which wave?" → "Keep the noise low and the filter near 1 kHz." → "PULSE at 50 %, MIX 10 o'clock, CUTOFF 1 o'clock."
   Solution: `{values: {vco_wave: PULSE, pulse_width: 50, mix: 25, cutoff: 1200}}`.
10. **reflect**: "What is a normal, and how do you break one?"
    Model: A normal is a hidden default connection behind an input. Plugging a cable into that input breaks it, and the cable's signal takes over.

**Review**
1. With nothing in EXT. AUDIO, MIX fully clockwise gives… 0) white noise · 1) the VCO · 2) silence. **A = 0**. Why: NOISE is normalled there.
2. Plugging a cable into EXT. AUDIO… 0) replaces the noise in the mixer · 1) adds to the noise · 2) turns the VCO off. **A = 0**. Why: A normal is replaced, not added to.
3. A phone's line-level output into EXT. AUDIO will sound… 0) much quieter than the VCO · 1) much louder · 2) the same. **A = 0**. Why: The input expects Eurorack levels (about 10 V peak to peak).
4. The MIX CV input… 0) adds a control voltage to the MIX setting · 1) is an audio input · 2) replaces the VCO. **A = 0**. Why: With MIX at noon, ±5 V sweeps the whole crossfade.

---

### 3 · mother32-f3-vcf: The ladder filter: CUTOFF, RESONANCE, LOW PASS and HI PASS
- **Description**: The Moog ladder: darken, brighten, make it ring, then flip it to high-pass.
- **Concepts**: filter-cutoff, filter-resonance, filter-type · ~8 min · source "M32 p.15"
- **Objective**: Use CUTOFF and RESONANCE to make a sound darker, brighter or ringing, and hear the difference between LOW PASS and HI PASS.
- **Start**: INIT + VCA MODE ON · CUTOFF 5:00 · VCF MOD AMOUNT 0.

**Steps**
1. **info** (autoplay): "The VCF removes harmonics. The Mother-32's is a Moog ladder: 24 dB per octave, low-pass or high-pass."
   *Principle*: A filter changes tone colour by removing some harmonics and keeping others.
2. **do** `cutoff → 159 Hz` (10:00): "Turn CUTOFF down to about 10 o'clock." *(first win)*
   *Principle*: Lowering a low-pass cutoff removes upper harmonics, so the tone gets darker.
3. **predict** `resonance → 70` (2:00): "Turn RESONANCE to about 2 o'clock."
   Q: What will raising RESONANCE do? 0) Add a ringing peak at the cutoff frequency · 1) Raise the pitch an octave · 2) Make each note longer. **A = 0**.
   Why: RESONANCE feeds the filter's output back to its input, boosting a narrow band at the cutoff, so you hear a ring there. The note's pitch comes from the VCO and doesn't move.
   *Principle*: Resonance boosts frequencies right at the cutoff, so the filter rings there.
4. **do** `cutoff → 1260 Hz` (1:00): "Sweep CUTOFF slowly up to about 1 o'clock. Listen to the peak move."
   *Principle*: With resonance up, sweeping cutoff makes the peak sing through each harmonic in turn.
5. **predict** `resonance → 100` (5:00): "Turn RESONANCE fully clockwise."
   Q: What happens at full resonance in LOW PASS? 0) The filter whistles a pitch of its own: it self-oscillates · 1) The sound stops · 2) The filter switches to high-pass. **A = 0**.
   Why: Above about 3 o'clock the feedback is strong enough to oscillate by itself, giving a near-sine at the cutoff. The bass also thins as resonance rises, a ladder trait, but the sound never stops.
   *Principle*: Enough feedback turns a filter into an oscillator.
6. **do** `vcf_mode → HP` (setup `resonance 0, cutoff 632`): "Flip VCF MODE up to HI PASS."
   *Principle*: A high-pass filter removes lows below the cutoff, so the sound gets thinner.
7. **listen**: A `{vcf_mode: LP, cutoff: 632}` / B `{vcf_mode: HP, cutoff: 632}`, labels "LOW PASS" / "HI PASS".
   Q: Which one kept the bass? 0) LOW PASS · 1) HI PASS · 2) Both. **A = 0**.
   Why: Low-pass keeps everything below the cutoff, bass included, and high-pass removes it. Same cutoff, opposite halves of the spectrum.
8. **quiz**: Q: On the Mother-32, turning RESONANCE up in HI PASS mode… 0) brings bass back, so the high-pass no longer works fully · 1) self-oscillates, just like LOW PASS · 2) changes the VCO wave. **A = 0**.
   Why: The HI PASS mode is non-resonant. Any RESONANCE puts low end back in. For a resonant high-pass, patch VCF into EXT. AUDIO with RESONANCE fully left, and MIX then sets the resonance.
9. **match** (setup `vcf_mode LP`): target `{cutoff: 632, resonance: 70}` (12:00 / 2:00), controls `[cutoff, resonance]`, tolerance 0.10.
   Hints: "It rings: which knob adds ringing?" → "Resonance is high but not whistling on its own." → "RESONANCE about 2 o'clock, CUTOFF about noon."
10. **challenge**: "Make a dark, round bass tone that still has a little bite."
    Checklist: VCF MODE LOW PASS · CUTOFF 80–400 Hz · RESONANCE 25–65 %.
    Hints: "Dark means a low cutoff." → "Bite comes from a little resonance." → "CUTOFF 10 o'clock, RESONANCE 11 o'clock."
    Solution: `{values: {vcf_mode: LP, cutoff: 200, resonance: 45}}`.
11. **reflect**: "In one sentence each: what do CUTOFF and RESONANCE do?"
    Model: CUTOFF sets where the filter starts removing harmonics. RESONANCE boosts a narrow peak right there, and at maximum the low-pass rings on its own as a sine.

**Review**
1. Turning CUTOFF down on the low-pass… 0) removes upper harmonics, so it is darker · 1) lowers the pitch · 2) adds distortion. **A = 0**. Why: Pitch comes from the VCO.
2. The ladder self-oscillates when… 0) RESONANCE is past about 3 o'clock in LOW PASS · 1) CUTOFF is at minimum · 2) VCF MODE is HI PASS. **A = 0**. Why: HI PASS is the non-resonant mode.
3. The cutoff range is… 0) 20 Hz to 20 kHz · 1) 8 Hz to 8 kHz · 2) 0.1 to 350 Hz. **A = 0**. Why: 8 Hz–8 kHz is the VCO and 0.1–350 Hz the LFO.
4. CUTOFF fully left in HI PASS mode… 0) passes almost everything: the raw VCO · 1) silences the sound · 2) self-oscillates. **A = 0**. Why: A high-pass at 20 Hz removes almost nothing.

---

### 4 · mother32-f4-eg-vca: Envelope and VCA: the shape of a note
- **Description**: One envelope, a SUSTAIN switch and a VCA shape every note.
- **Concepts**: envelope-attack, envelope-decay, envelope-sustain, envelope-shape · ~8 min · source "M32 pp.16–17"
- **Objective**: Shape each note's loudness over time with ATTACK, DECAY, SUSTAIN and VCA MODE.
- **Start**: INIT + VCA MODE **ON** · CUTOFF 1:00 · VCF MOD AMOUNT 0 · DECAY 1:30 (341 ms). The learner plays the keys.

**Steps**
1. **info** (autoplay; the drone plays): "The Mother-32 has one envelope generator (EG): ATTACK, DECAY and a SUSTAIN switch."
   *Principle*: An envelope is a voltage that rises and falls once per note, shaping what it controls.
2. **predict** `vca_mode → EG`: "Flip VCA MODE down to EG."
   Q: The drone is playing. What happens when VCA MODE goes to EG? 0) It stops: sound now passes only while the EG opens the VCA · 1) It jumps up an octave · 2) Nothing changes. **A = 0**.
   Why: In ON the VCA is held open, so the VCO drones. In EG the VCA follows the envelope, which rises only when a key or step sends a gate. The pitch isn't involved.
   *Principle*: A VCA sets loudness from a control voltage: no voltage, no sound.
3. **do** (check: a key is held, `engine.litKey ≥ 0`): "Press and hold any key, then let go." *(first win)*
   *Principle*: A gate (key down) starts the envelope; letting go ends the gate.
4. **do** `attack → 290 ms` (2:00): "Turn ATTACK to about 2 o'clock, then hold a key."
   *Principle*: A longer attack makes each note swell in instead of starting instantly.
5. **predict** `sustain → OFF` (setup `attack 1.25`): "Flip SUSTAIN down to OFF, then hold a key."
   Q: With SUSTAIN OFF, what happens while you keep holding the key? 0) The note rises, then fades even though you're holding · 1) It stays at full level until you let go · 2) It repeats. **A = 0**.
   Why: With SUSTAIN OFF the EG starts decaying as soon as the attack finishes, or earlier if you let go. Holding at full level until release is what SUSTAIN ON does.
   *Principle*: Without sustain, an envelope's length is set by its times, not by how long you hold.
6. **do** `decay → 40 ms` (11:00): "Turn DECAY to about 11 o'clock for a short pluck."
   *Principle*: A short decay makes a short, percussive note.
7. **listen** (demo phrase): A `{sustain: ON, decay: 1250}` / B `{sustain: OFF, decay: 1250}`, labels "SUSTAIN ON" / "SUSTAIN OFF".
   Q: In which one does each note stay loud while held? 0) A, SUSTAIN ON · 1) B, SUSTAIN OFF · 2) Neither. **A = 0**.
   Why: ON holds the peak while the gate is high and then decays as the release. OFF decays straight after the attack.
8. **quiz**: Q: You play two overlapping keys with SUSTAIN ON. The second note… 0) glides in without restarting the envelope (legato) · 1) restarts the envelope · 2) is ignored. **A = 0**.
   Why: With SUSTAIN ON, overlapping notes don't retrigger the EG, which allows legato phrasing. With SUSTAIN OFF every new note retriggers it.
9. **match**: target `{attack: 290, decay: 525, sustain: OFF}` (2:00 / 2:00), controls `[attack, decay]`, tolerance 0.10. "Ear challenge: match the note's shape."
   Hints: "Does it start instantly or swell?" → "It swells a little, then fades over about half a second." → "ATTACK and DECAY both near 2 o'clock."
10. **challenge**: "Make an organ-like note: instant start, full level while held, quick stop on release."
    Checklist: ATTACK ≤ 10 ms · SUSTAIN ON · DECAY ≤ 60 ms · VCA MODE EG.
    Hints: "Organs don't fade while a key is held: which switch?" → "The release should be quick." → "SUSTAIN ON, ATTACK fully left, DECAY about 11 o'clock."
    Solution: `{values: {attack: 1.25, decay: 40, sustain: ON, vca_mode: EG}}`.
11. **reflect**: "What's the difference between SUSTAIN ON and SUSTAIN OFF?"
    Model: ON holds the note at full level while the key is held and then fades at the DECAY rate. OFF fades straight after the attack (or at release, if that comes first), and every note retriggers.

**Review**
1. VCA MODE ON… 0) holds the VCA open so the VCO drones · 1) turns the sound off · 2) doubles the attack. **A = 0**. Why: ON needs no gate; VCA CV still adds to it.
2. ATTACK and DECAY reach about… 0) 3 s and 7 s · 1) 350 Hz · 2) 20 kHz. **A = 0**. Why: These are Moog's nominal ranges of 1.25 ms–3 s and 1.25 ms–7 s.
3. With SUSTAIN OFF, releasing a key during a slow attack… 0) starts the decay early · 1) is ignored · 2) holds the level. **A = 0**. Why: The attack ends at completion or release, whichever comes first.
4. The EG output jack swings… 0) 0 to +7.5 V · 1) ±5 V · 2) 0 to +1 V. **A = 0**. Why: The manual lists the EG output as 0 to +7.5 V.

---

### 5 · mother32-f5-modulation: Modulation: VCO MOD and VCF MOD
- **Description**: Send the envelope or the LFO to pitch, pulse width or cutoff, and flip the polarity.
- **Concepts**: modulation-source, modulation-depth, lfo, filter-cutoff · ~10 min · source "M32 pp.13, 16"
- **Objective**: Route the EG or the LFO to pitch, pulse width or cutoff, and set the amount and polarity.
- **Start**: INIT + SUSTAIN OFF · DECAY 1:00 (222 ms) · CUTOFF 10:00 (159 Hz) · VCF MOD AMOUNT 0 · TEMPO 12:55 (100 BPM) · the demo pattern of preset 00.

**Steps**
1. **do** `run_stop → on` (autoplay): "Press RUN/STOP to start the sequence." *(first win)*
   *Principle*: A sequencer replays notes so you can hear each change on the next one.
2. **predict** `vcf_mod_amount → 60` (1:00; SOURCE EG, POLARITY +): "Turn VCF MOD AMOUNT to about 1 o'clock."
   Q: VCF MOD SOURCE is on EG. How will each note sound? 0) Bright at the start, darker as it fades · 1) Dark at the start, brighter later · 2) No change. **A = 0**.
   Why: With POLARITY + the envelope adds to CUTOFF, so the filter opens at each note's start and closes as the EG decays: a pluck. The reverse needs POLARITY −.
   *Principle*: Modulation adds a moving voltage to a setting; an envelope moves the cutoff once per note.
3. **do** `vcf_mod_polarity → −` (setup `cutoff 1260`): "Flip VCF MOD POLARITY down to −."
   *Principle*: Inverting a modulation flips its direction: the envelope now pulls the cutoff down.
   *Explanation*: With − the attack lowers the cutoff, so set CUTOFF to the brightest point you want. With + set it to the darkest.
4. **listen**: A `{vcf_mod_polarity: '+', cutoff: 159}` / B `{vcf_mod_polarity: '−', cutoff: 2500}`.
   Q: Which one starts each note bright? 0) A (+) · 1) B (−) · 2) Both. **A = 0**.
   Why: + adds the envelope, so each note starts bright. − subtracts it, so each starts dark and opens as it fades.
5. **do** `vcf_mod_source → LFO` (setup `vcf_mod_polarity +, vcf_mod_amount 40, lfo_rate 1.2, cutoff 632`): "Flip VCF MOD SOURCE down to LFO."
   *Principle*: An LFO repeats a slow wave, so it sweeps its destination in a steady cycle.
6. **do** `vco_mod_amount → 20` (9:00; SOURCE LFO, DEST FREQUENCY; setup `vcf_mod_amount 0, lfo_rate 5.9`): "Turn VCO MOD AMOUNT to about 9 o'clock."
   *Principle*: A small, fast pitch wobble is vibrato.
7. **predict** `vco_mod_dest → PULSE WIDTH` (setup `vco_wave PULSE, vco_mod_amount 40`): "Flip VCO MOD DEST up to PULSE WIDTH."
   Q: What will the LFO change now? 0) The pulse width: a shimmering, chorus-like tone · 1) The pitch · 2) The cutoff. **A = 0**.
   Why: DEST picks pitch or pulse width, and on PULSE WIDTH the LFO sweeps the pulse's width (PWM). That only changes the PULSE wave; on SAW you'd hear nothing.
   *Principle*: Sweeping pulse width changes the harmonics continuously, which sounds like chorus.
8. **quiz**: Q: VCO MOD SOURCE is up on EG / VCO MOD and a cable is in the VCO MOD jack. What reaches VCO MOD AMOUNT? 0) Only the cable's signal, which overrides the EG · 1) The EG plus the cable · 2) The LFO. **A = 0**.
   Why: The EG is normalled to that switch position, and a cable overrides it. AMOUNT then works as an attenuator for whatever you patched in.
9. **match** (setup `vco_wave SAW, vco_mod_dest FREQUENCY, vco_mod_source LFO, lfo_wave TRIANGLE`): target `{vco_mod_amount: 30, lfo_rate: 5.9}` (10:00 / 12:00), controls `[vco_mod_amount, lfo_rate]`, tolerance 0.10.
   Hints: "How far does the pitch swing, and how fast?" → "A clear vibrato: medium depth, about six wobbles a second." → "VCO MOD AMOUNT about 10 o'clock, LFO RATE about noon."
10. **challenge**: "Make a laser zap: every note's pitch starts high and swoops down fast."
    Checklist: VCO MOD SOURCE EG · VCO MOD DEST FREQUENCY · VCO MOD AMOUNT ≥ 50 % · DECAY ≤ 525 ms.
    Hints: "Which source rises and falls once per note?" → "Send it to pitch with plenty of amount." → "SOURCE EG, DEST FREQUENCY, AMOUNT 3 o'clock, DECAY 1 o'clock."
    Solution: `{values: {vco_mod_source: EG, vco_mod_dest: FREQUENCY, vco_mod_amount: 80, decay: 222, sustain: OFF}}`.
11. **reflect**: "What can each modulation section reach, and from which sources?"
    Model: VCO MOD sends the EG (or the VCO MOD jack) or the LFO to pitch or pulse width. VCF MOD sends the EG or the LFO to the cutoff, up or down via POLARITY.

**Review**
1. VCF MOD POLARITY − makes the envelope… 0) pull the cutoff down · 1) raise the pitch · 2) switch to HI PASS. **A = 0**. Why: It inverts the modulation.
2. LFO WAVE chooses the wave for… 0) both VCO MOD and VCF MOD · 1) only the LFO SQ jack · 2) only VCF MOD. **A = 0**. Why: Both jacks always carry their waves; the switch feeds both mod sections.
3. Modulating PULSE WIDTH while VCO WAVE is on SAW… 0) has no audible effect · 1) gives vibrato · 2) opens the filter. **A = 0**. Why: Only the pulse wave has a width.
4. The VCO MOD jack is normalled to… 0) the EG · 1) the LFO · 2) KB. **A = 0**. Why: A cable there overrides the EG.

---

### 6 · mother32-f6-lfo-glide: LFO speed and shape, and glide
- **Description**: Trills, vibrato and audio-rate FM from one LFO, then slides between notes.
- **Concepts**: lfo, frequency-modulation, glide · ~8 min · source "M32 pp.14, 18, 27"
- **Objective**: Use LFO RATE and LFO WAVE for vibrato, trills and audio-rate tones, and GLIDE to slide between notes.
- **Start**: INIT + VCA MODE ON · CUTOFF 2:00 · VCF MOD 0 · VCO MOD SOURCE LFO, DEST FREQUENCY, AMOUNT 10:00 (30 %) · LFO RATE 12:00.

**Steps**
1. **info** (autoplay; vibrato plays): "The LFO is a slow oscillator for modulation: about 0.1 Hz to 350 Hz on its knob, up to 600 Hz with CV."
   *Principle*: Below about 20 Hz we hear modulation as movement; above it, as tone.
2. **do** `lfo_wave → SQUARE`: "Flip LFO WAVE up to the square." *(first win)*
   *Principle*: A square LFO jumps between two values, so pitch modulation becomes a two-note trill.
3. **do** `lfo_rate → 0.51 Hz` (9:00): "Turn LFO RATE down to about 9 o'clock."
   *Principle*: A slower LFO gives slower movement; the trill becomes a slow alternation.
4. **predict** `lfo_rate → 350 Hz` (5:00; setup `lfo_wave TRIANGLE`): "Turn LFO RATE fully clockwise."
   Q: What happens when the LFO runs at audio rate? 0) The wobble becomes a new buzzy, metallic tone (sidebands) · 1) The sound stops · 2) It is still a clearly heard wobble, just faster. **A = 0**.
   Why: At hundreds of hertz the ear can't follow the swings and hears extra frequencies around the note instead, called sidebands. That is FM. A wobble you can follow only happens below about 20 Hz.
   *Principle*: Modulating at audio rate creates new frequencies instead of audible movement.
5. **do** `glide → 320 ms` (11:00; setup `vco_mod_amount 0, lfo_rate 5.9, vca_mode EG`): "Turn GLIDE to about 11 o'clock, then play two keys in turn."
   *Principle*: Glide slews the pitch voltage, so the pitch slides instead of jumping.
6. **listen** (demo phrase): A `{glide: 0}` / B `{glide: 320}`.
   Q: Which one slides between notes? 0) A · 1) B · 2) Neither. **A = 1**.
   Why: In B each new pitch takes about a third of a second to arrive; in A it jumps at once.
7. **quiz**: Q: In the sequencer, the Mother-32's glide is… 0) on or off per step, at the panel GLIDE rate · 1) a separate glide time for every step · 2) unavailable. **A = 0**.
   Why: Each step stores only glide on or off, and the rate always comes from the GLIDE knob. For a slide, the step before needs a full-length (tied) gate.
8. **match** (setup `vco_mod_amount 30, vco_mod_dest FREQUENCY, vca_mode ON, glide 0`): target `{lfo_rate: 2.6, lfo_wave: TRIANGLE}` (11:00), controls `[lfo_rate, lfo_wave]`, tolerance 0.12.
   Hints: "Smooth or jumping?" → "Smooth (triangle), about two or three wobbles a second." → "LFO WAVE on the triangle, LFO RATE about 11 o'clock."
9. **challenge**: "Make a siren: slow, wide, smooth pitch sweeps that never stop."
   Checklist: VCA MODE ON · VCO MOD SOURCE LFO and DEST FREQUENCY · LFO WAVE TRIANGLE · LFO RATE ≤ 1.2 Hz · VCO MOD AMOUNT ≥ 55 %.
   Hints: "Which LFO wave is smooth?" → "Slow it down and turn the depth way up." → "Triangle, LFO RATE 9 o'clock, VCO MOD AMOUNT 2 o'clock, VCA MODE ON."
   Solution: `{values: {vca_mode: ON, vco_mod_source: LFO, vco_mod_dest: FREQUENCY, lfo_wave: TRIANGLE, lfo_rate: 0.5, vco_mod_amount: 70}}` (preset C30).
10. **reflect**: "When does an LFO sound like movement, and when like a tone?"
    Model: Below roughly 20 Hz we hear it as movement: vibrato, trill, wobble. At audio rates it creates sidebands, so we hear a new timbre.

**Review**
1. LFO RATE's panel range is about… 0) 0.1 to 350 Hz · 1) 8 Hz to 8 kHz · 2) 1 to 10 Hz. **A = 0**. Why: It reaches 600 Hz with CV.
2. A square LFO on pitch gives… 0) a trill between two notes · 1) smooth vibrato · 2) a filter sweep. **A = 0**. Why: Two values, two notes.
3. Modulating pitch at audio rate creates… 0) sidebands, a new timbre · 1) slower vibrato · 2) silence. **A = 0**. Why: That is FM.
4. GLIDE changes… 0) how long the pitch takes to slide to a new note · 1) loudness · 2) LFO speed. **A = 0**. Why: It is a slew on the pitch voltage, and the KB output includes it.

---

### 7 · mother32-f7-patchbay: The patch bay: voltages, VC MIX, MULT and ASSIGN
- **Description**: Cables carry voltages. Make your own, scale them, and use them as a VCA.
- **Concepts**: signal-routing, modulation-depth · ~10 min · source "M32 pp.22–23, 47, 51–53"
- **Objective**: Use VC MIX as a voltage source, an attenuator and a VCA, and know what MULT and ASSIGN do.
- **Start**: INIT + VCA MODE ON · CUTOFF 2:00 · VCF MOD 0 · VC MIX 7:00 (0 V).

**Steps**
1. **info** (autoplay): "32 jacks: 18 inputs, and 14 outputs with reversed labels. Ringed jacks are gate inputs. Some inputs hide normals."
   *Principle*: Every jack carries a voltage; a cable routes it from an output to an input.
2. **patch** `out_vc_mix → in_vco_1voct`: "Patch VC MIX into VCO 1V/OCT." *(first win)*
   *Principle*: An input marked 1V/OCT moves the pitch one octave for every volt.
   *Explanation*: With nothing in MIX 1 or MIX 2, VC MIX is a manual voltage source: 0 V fully left to +5 V fully right. At 0 V nothing changes yet. The jack adds to the keyboard's pitch, it doesn't replace it.
3. **predict** `vc_mix → 20` (9:00, ≈ +1 V): "Turn VC MIX to about 9 o'clock."
   Q: VC MIX now sends about +1 V into 1V/OCT. What happens to the pitch? 0) It rises one octave · 1) It rises one semitone · 2) It doesn't change. **A = 0**.
   Why: At one volt per octave, +1 V doubles the frequency. A semitone would be about 0.083 V.
   *Principle*: Each added volt at a 1 V/oct input doubles the frequency.
4. **patch** `out_lfo_tri → in_mix2` (setup `vc_mix 10`): "Patch LFO TRI into MIX 2."
   *Principle*: Crossfading between a signal and 0 V scales the signal: that is an attenuator.
   *Explanation*: MIX 1 sits at 0 V, so VC MIX turns the LFO up from nothing (left) to full (right). Here it sets the vibrato depth.
5. **quiz**: Q: LFO TRI is in MIX 2 and nothing is in MIX 1. VC MIX fully clockwise outputs… 0) the full LFO, ±5 V · 1) a steady +5 V · 2) 0 V. **A = 0**.
   Why: The cable replaced MIX 2's +5 V normal, and MIX 1 is still 0 V. Fully right you get all of MIX 2.
6. **patch** `out_eg → in_vc_mix_ctrl` (setup `vc_mix 0, vca_mode EG, attack 290, sustain ON`): "Patch EG into VC MIX CTRL, then play a key."
   *Principle*: A crossfader with one side at 0 V is a VCA: the control voltage sets the level.
   *Explanation*: Now the vibrato depth follows the envelope and swells in with each note. ±5 V on VC MIX CTRL covers the whole crossfade.
7. **info** (focus `in_mult, out_mult1, out_mult2, out_assign`): "MULT copies one signal to two outputs. ASSIGN is programmable; out of the box it sends the sequencer clock."
   *Principle*: Splitting one voltage to two places keeps both destinations in step.
   *Explanation*: MULT is a buffered splitter and must never be used to mix. ASSIGN has 16 sources in Setup mode page 1, including accent, clock divisions, stepped ramps and random, and MIDI values.
8. **challenge**: "Make the filter follow the keyboard: higher notes, brighter filter."
   Checklist: cable KB → VCF CUTOFF.
   Hints: "Which output carries the keyboard's pitch voltage?" → "The filter has its own CV input." → "Patch KB into VCF CUTOFF."
   Solution: `{patches: [{from: 'out_kb', to: 'in_vcf_cutoff'}]}`.
9. **reflect**: "Name three jobs VC MIX can do."
   Model: With nothing patched it is a 0–5 V source. With a signal in MIX 2 it is an attenuator. With a CV into VC MIX CTRL it becomes a VCA or a crossfader.

**Review**
1. MIX 1 and MIX 2 are normalled to… 0) 0 V and +5 V · 1) NOISE and EG · 2) KB and GATE. **A = 0**. Why: That is why VC MIX alone outputs 0–5 V.
2. The MULT is… 0) a buffered splitter, never a mixer · 1) a mixer · 2) an attenuator. **A = 0**. Why: To mix, use VC MIX.
3. ASSIGN's default source is… 0) the sequencer clock · 1) the EG · 2) MIDI velocity. **A = 0**. Why: So ASSIGN into a DFAM's ADV / CLOCK just works.
4. Why patch KB into VCF CUTOFF but never into VCO 1V/OCT? 0) 1V/OCT already adds the keyboard's CV, so the pitch would track twice · 1) It would damage the VCO · 2) KB is an audio signal. **A = 0**. Why: The 1V/OCT input sums with the keyboard CV.

---

## SOUND DESIGN

### 8 · mother32-sd1-bass: The classic Moog bass
- **Description**: A punchy saw bass from three controls.
- **Concepts**: filter-cutoff, modulation-depth, envelope-decay · ~7 min · tags bass
- **Objective**: Build a punchy saw bass from CUTOFF, VCF MOD AMOUNT and DECAY.
- **Start**: INIT + CUTOFF 5:00 · VCF MOD AMOUNT 0 · DECAY 3:00 (1.25 s) · TEMPO 1:20 (110 BPM) · the pattern of preset C02.

**Steps**
1. **do** `run_stop → on` (autoplay): "Press RUN/STOP." *(first win)*
   *Principle*: Bass lines repeat, so a loop is the best way to shape a bass sound.
2. **do** `cutoff → 112 Hz` (9:30): "Turn CUTOFF down to about half past 9."
   *Principle*: Bass weight lives below a few hundred hertz; a low cutoff keeps it and removes fizz.
3. **predict** `vcf_mod_amount → 60` (1:00, +): "Turn VCF MOD AMOUNT to about 1 o'clock."
   Q: What will the envelope add to this dark bass? 0) A bright pluck at the start of each note · 1) More low end only · 2) A pitch drop. **A = 0**.
   Why: The envelope opens the filter at each note's start and lets it close, which is the pluck. A pitch drop would need VCO MOD.
   *Principle*: An envelope on the cutoff makes notes start bright and get darker.
4. **do** `sustain → OFF`: "Flip SUSTAIN down to OFF."
   *Principle*: An attack–decay envelope gives every note the same punchy shape.
5. **do** `decay → 222 ms` (1:00): "Turn DECAY to about 1 o'clock."
   *Principle*: Short decays stop bass notes smearing into each other.
6. **do** `resonance → 40` (11:00): "Turn RESONANCE to about 11 o'clock."
   *Principle*: A little resonance adds a vocal bump at the cutoff.
7. **listen**: A `{resonance: 0}` / B `{resonance: 40}`.
   Q: Which pluck has more "quack"? 0) A · 1) B · 2) Same. **A = 1**.
   Why: Resonance emphasises the cutoff as it sweeps, which gives the quack. Much more and the bass thins out.
8. **quiz**: Q: Why does a Moog bass get thinner as resonance rises? 0) The ladder's feedback lowers its passband, especially the lows · 1) The VCO changes octave · 2) The envelope gets shorter. **A = 0**.
   Why: Feedback in a ladder subtracts from the input, so the bass drops. Neither the VCO nor the EG changes.
9. **match**: target `{cutoff: 159, vcf_mod_amount: 50}` (10:00 / 12:00), controls `[cutoff, vcf_mod_amount]`, tolerance 0.10.
   Hints: "Darkness between notes first, then the pluck." → "Slightly brighter, with a slightly smaller pluck than yours." → "CUTOFF 10 o'clock, VCF MOD AMOUNT noon."
10. **challenge**: "Make it a deep, round dub bass: no click, no fizz, long enough to hum."
    Checklist: CUTOFF ≤ 250 Hz · VCF MOD AMOUNT ≤ 40 % · RESONANCE ≤ 30 % · DECAY ≥ 300 ms · ATTACK 2–30 ms.
    Hints: "Round means less pluck and less resonance." → "A tiny attack removes the click." → "CUTOFF 9:30, VCF MOD 10 o'clock, RESONANCE 8:30, DECAY 1:30, ATTACK 9 o'clock."
    Solution: `{values: {cutoff: 112, vcf_mod_amount: 30, resonance: 15, decay: 341, attack: 6}}`.
11. **reflect**: "Which three controls make this bass, and what does each do?"
    Model: CUTOFF sets how dark it is between notes, VCF MOD AMOUNT sets how bright the pluck is, and DECAY sets how long each note lasts.

**Review**
1. A low cutoff on a saw bass… 0) keeps the weight and removes fizz · 1) raises the pitch · 2) makes notes longer. **A = 0**. Why: It removes harmonics, not low notes.
2. A synth bass's pluck usually comes from… 0) an envelope on the filter cutoff · 1) the LFO · 2) glide. **A = 0**. Why: The filter opens at each note's start.
3. Too much resonance on a ladder bass… 0) thins out the low end · 1) adds sub-bass · 2) changes the tempo. **A = 0**. Why: Feedback reduces the passband.

---

### 9 · mother32-sd2-acid: Acid line: resonance, accent and slides
- **Description**: The 303 squelch on a Moog: resonance, accents and legato slides.
- **Concepts**: filter-resonance, sequencer-pattern, glide · ~10 min · tags acid, bass · source "M32 pp.26–27, 46"
- **Objective**: Make a squelchy acid line with high resonance, a filter envelope, step accents and legato slides.
- **Start**: INIT + CUTOFF 10:00 · RESONANCE 1:00 (60 %) · VCF MOD 12:00 (+) · DECAY 12:00 (94 ms) · GLIDE 9:30 (125 ms) · TEMPO 1:45 (124 BPM) · the notes of preset C27 with **no** accents or glides and all gates 4/8.

**Steps**
1. **do** `run_stop → on` (autoplay): "Press RUN/STOP." *(first win)*
   *Principle*: Acid is a short bass loop transformed by filter, accent and slide.
2. **info**: "Accented steps get a fixed boost of volume and brightness inside the Mother-32. Press SHIFT + STEP to enter Step mode."
   *Principle*: Accents make chosen notes louder and brighter, which gives a line its groove.
3. **do** (check: step 3 accent on): "Press SHIFT + step key 3 to edit step 3, then press RESET/ACCENT."
   *Principle*: Contrast creates groove: accented steps jump out of the line.
   *Explanation*: OCTAVE / LOCATION LED 7 shows the accent. Press SHIFT + the same step key to stop editing.
4. **predict** (check: step 4 glide on): "Edit step 4 (SHIFT + step key 4) and turn GLIDE clockwise a little."
   Q: What does turning on glide for step 4 do? 0) Slides the pitch into step 4's note · 1) Makes step 4 louder · 2) Repeats step 4 twice. **A = 0**.
   Why: A glide step slews the pitch into its note at the GLIDE knob's rate. Louder is the accent's job, and repeats are ratchets (SHIFT + GLIDE).
   *Principle*: Glide connects notes by sliding the pitch between them.
5. **do** (check: step 3 gate = 8/8): "Edit step 3 again and turn TEMPO/GATE LENGTH fully clockwise."
   *Principle*: Holding the gate through a pitch change gives a legato slide with no new attack.
   *Explanation*: On the Mother-32 a slide needs a tied (8/8) gate on the step *before* the glide step. With SUSTAIN ON the envelope doesn't restart.
6. **listen**: A `{resonance: 30}` / B `{resonance: 75}`.
   Q: Which one squelches? 0) A · 1) B · 2) Same. **A = 1**.
   Why: Higher resonance makes the envelope's sweep sing through the harmonics. Much higher and it starts whistling by itself.
7. **quiz**: Q: While editing a step, what does SHIFT + GLIDE set? 0) The step's ratchet count (1–4) · 1) The tempo · 2) A glide time for every step. **A = 0**.
   Why: GLIDE alone switches the step's glide on or off, and SHIFT + GLIDE sets ratchets. The glide rate always comes from the GLIDE knob.
8. **match**: target `{resonance: 70, vcf_mod_amount: 60}` (2:00 / 1:00), controls `[resonance, vcf_mod_amount]`, tolerance 0.10.
   Hints: "How much does each note 'wow'?" → "More envelope and more resonance than yours." → "RESONANCE 2 o'clock, VCF MOD AMOUNT 1 o'clock."
9. **challenge**: "Make it scream: at least three accents, two slides, and enough resonance to bite."
   Checklist: ≥ 3 accented steps · ≥ 2 glide steps, each after an 8/8 step · RESONANCE ≥ 55 %.
   Hints: "Accents: RESET/ACCENT while editing a step." → "A slide is an 8/8 gate, then glide on the next step." → "Try accents on 1, 7, 10, and slides into 4 and 10."
   Solution: `{data: <preset C27 step data: accents 1, 7, 10; glides 4, 10, 16; 8/8 gates on 3, 9, 14>, values: {resonance: 70}}`.
10. **reflect**: "What do accent, glide and resonance each add to an acid line?"
    Model: Accent makes chosen notes louder and brighter, slides connect notes without a new attack, and resonance makes the filter envelope squelch.

**Review**
1. On the Mother-32, an accented step… 0) gets a fixed boost of VCF and VCA · 1) plays an octave up · 2) is skipped. **A = 0**. Why: The accent is routed internally at a fixed level.
2. To slide into step 5… 0) tie step 4 (8/8 gate) and turn glide on for step 5 · 1) turn glide on for step 4 only · 2) set SUSTAIN OFF. **A = 0**. Why: The slide's target holds the glide flag, and the step before must be tied.
3. Gate lengths only sound right when… 0) SUSTAIN is ON · 1) SUSTAIN is OFF · 2) VCA MODE is ON. **A = 0**. Why: With SUSTAIN ON the envelope holds for the gate's length.

---

### 10 · mother32-sd3-drums: Drums from one voice
- **Description**: A kick and a snare from one oscillator, one envelope and the accent.
- **Concepts**: modulation-source, envelope-decay, noise, signal-routing · ~9 min · tags kick, snare
- **Objective**: Make a kick and a snare from one voice using EG pitch modulation, a short decay, and noise added on accents through ASSIGN.
- **Start**: INIT + VCO WAVE PULSE · SUSTAIN OFF · DECAY 12:30 · CUTOFF 10:00 · RESONANCE 9:00 · VCF MOD AMOUNT 1:00 · VCO MOD SOURCE EG / VCO MOD, DEST FREQUENCY, AMOUNT 0 · TEMPO 12:55 · the pattern of preset C04.

**Steps**
1. **do** `run_stop → on` (autoplay): "Press RUN/STOP." *(first win)*
   *Principle*: A drum is a very short sound whose pitch and brightness fall fast.
2. **predict** `vco_mod_amount → 60` (1:00): "Turn VCO MOD AMOUNT to about 1 o'clock."
   Q: VCO MOD sends the EG to FREQUENCY. What will this do to each hit? 0) The pitch starts high and drops fast: a kick's thump · 1) The pitch rises slowly · 2) It adds noise. **A = 0**.
   Why: The EG jumps up and decays, so each hit gets a fast pitch drop, the boom of an analog kick. Noise would come from MIX.
   *Principle*: A fast-falling pitch is what makes a synthesized kick thump.
3. **do** `decay → 222 ms` (1:00): "Turn DECAY to about 1 o'clock."
   *Principle*: A kick's length is its envelope's decay: longer booms, shorter knocks.
   *Explanation*: One EG sets the pitch fall and the fade together.
4. **patch** `out_assign → in_mix_cv` (setup `assign_source 1`, Accent): "ASSIGN now outputs the accent. Patch ASSIGN into MIX CV."
   *Principle*: Routing the accent to the mixer lets chosen steps change timbre.
   *Explanation*: ASSIGN sends a +5 V pulse on accented steps, which moves MIX halfway toward noise, so those steps become snares. On the hardware this is Setup page 1, value 1.
5. **listen**: A `{mix: 0}` / B `{mix: 50}`.
   Q: Which sounds more like a snare? 0) A · 1) B · 2) Same. **A = 1**.
   Why: A snare is a drum tone plus a burst of noise, as the accent adds on its steps.
6. **quiz**: Q: Why do the click, the pitch drop and the fade happen together? 0) One EG drives the VCA, VCF MOD and VCO MOD · 1) Three envelopes are linked · 2) The LFO does it. **A = 0**.
   Why: The Mother-32 has a single envelope. The DFAM has three separate decays.
7. **match**: target `{vco_mod_amount: 75, decay: 341}` (2:30 / 1:30), controls `[vco_mod_amount, decay]`, tolerance 0.10.
   Hints: "How far does the pitch fall, and how long does it ring?" → "A deeper drop and a longer tail than yours." → "VCO MOD AMOUNT about 2:30, DECAY about 1:30."
8. **challenge**: "Make the kick boom for a hip-hop beat: lower, longer, still punchy."
   Checklist: DECAY 300–900 ms · VCO MOD AMOUNT ≥ 50 % · CUTOFF ≤ 300 Hz.
   Hints: "Boom means a longer decay." → "Keep enough pitch drop for the punch." → "DECAY about 2 o'clock, VCO MOD 1–2 o'clock, CUTOFF 10 o'clock."
   Solution: `{values: {decay: 525, vco_mod_amount: 65, cutoff: 159}}`.
9. **reflect**: "How does one voice play both a kick and a snare here?"
   Model: Unaccented steps are low thumps with a fast EG pitch drop. Accented steps send ASSIGN's pulse into MIX CV, adding noise, so they become snares.

**Review**
1. A kick's thump comes mainly from… 0) a fast-falling pitch · 1) a slow attack · 2) high resonance. **A = 0**. Why: The pitch sweep gives the punch.
2. ASSIGN set to Accent outputs… 0) a 0–5 V pulse on accented steps · 1) the EG · 2) noise. **A = 0**. Why: Setup page 1, value 1.
3. A snare adds what to a drum tone? 0) a burst of noise · 1) glide · 2) a second octave. **A = 0**. Why: The snare wires rattle like noise.

---

### 11 · mother32-sd4-filter-voice: The filter as an oscillator
- **Description**: Make the ladder sing on its own, play it, and stack it with the VCO.
- **Concepts**: filter-resonance, signal-routing, oscillator-pitch · ~9 min · tags lead · source "M32 p.15"
- **Objective**: Make the ladder self-oscillate, play it from the keyboard, and blend it with the VCO.
- **Start**: INIT + DECAY 2:00 (525 ms) · CUTOFF 12:00 · VCF MOD AMOUNT 0.

**Steps**
1. **info**: "At maximum resonance the Mother-32's low-pass rings by itself: a pure sine you can play."
   *Principle*: A filter with enough feedback becomes a sine-wave oscillator.
2. **do** `resonance → 100` (5:00): "Turn RESONANCE fully clockwise and hold a key." *(first win: the whistle)*
   *Principle*: A self-oscillating filter sings at its cutoff frequency.
3. **patch** `out_vc_mix → in_ext_audio`: "Patch VC MIX into EXT. AUDIO."
   *Principle*: A silent cable in an input replaces its normal with silence.
   *Explanation*: VC MIX is fully left, so it outputs 0 V and silences the noise normal. The manual does the same with a "dead" cable that isn't connected at the other end.
4. **do** `mix → 100` (5:00): "Turn MIX fully clockwise."
   *Principle*: With no input signal, you hear only the filter's own sine.
5. **predict** `cutoff → 1260 Hz` (1:00): "Turn CUTOFF slowly up to about 1 o'clock."
   Q: What will turning CUTOFF do to the whistle? 0) Raise its pitch: the sine sits at the cutoff · 1) Make it louder only · 2) Nothing; only the keys change pitch. **A = 0**.
   Why: A self-oscillating filter rings at its cutoff, so CUTOFF is now a pitch knob. The keys move the VCO, which is out of the mix right now.
   *Principle*: When a filter oscillates, its cutoff control becomes a pitch control.
6. **patch** `out_kb → in_vcf_cutoff`: "Patch KB into VCF CUTOFF, then play some keys."
   *Principle*: Sending pitch CV to the cutoff makes the filter follow the keyboard.
   *Explanation*: VCF CUTOFF responds at about 1 V/oct, so the sine follows the keys, roughly in tune. Five of the manual's nine patches use this cable.
7. **do** `mix → 50` (12:00): "Turn MIX back to noon."
   *Principle*: Two sources at a musical interval blend into one richer tone.
   *Explanation*: Now the VCO plays through the singing filter. Fine-tune CUTOFF until the whistle sits an octave or two above it.
8. **listen**: A `{resonance: 60}` / B `{resonance: 100}`.
   Q: In which one does the filter add a pitch of its own? 0) A · 1) B · 2) Both. **A = 1**.
   Why: Below about 3 o'clock the filter only colours the VCO. At full it oscillates.
9. **quiz**: Q: Why put a silent cable in EXT. AUDIO for this sound? 0) To replace the noise normal with silence · 1) To add noise · 2) To clock the sequencer. **A = 0**.
   Why: Any plug in EXT. AUDIO overrides the noise. A silent one leaves nothing on MIX's right side but silence.
10. **challenge**: "Make a two-voice lead: the VCO plus a filter whistle above it, both following the keyboard."
    Checklist: RESONANCE ≥ 85 % · cable KB → VCF CUTOFF · MIX 25–75 %.
    Hints: "The whistle needs near-maximum resonance." → "Both voices must follow the keys: which cable?" → "RESONANCE full, KB → VCF CUTOFF, MIX at noon."
    Solution: `{values: {resonance: 100, mix: 50, cutoff: 1050}, patches: [{from: 'out_kb', to: 'in_vcf_cutoff'}, {from: 'out_vc_mix', to: 'in_ext_audio'}]}` (preset C14).
11. **reflect**: "How did you turn the filter into a playable oscillator?"
    Model: I raised RESONANCE until it self-oscillated, silenced its input, and patched KB into VCF CUTOFF so its pitch followed the keyboard.

**Review**
1. A self-oscillating filter's pitch is set by… 0) CUTOFF plus any cutoff CV · 1) PULSE WIDTH · 2) DECAY. **A = 0**. Why: It rings at the cutoff frequency.
2. KB into VCF CUTOFF makes the filter… 0) track the keyboard · 1) stop · 2) switch to HI PASS. **A = 0**. Why: KB is a 1 V/oct pitch voltage.
3. A self-oscillating ladder sounds like… 0) a near-pure sine · 1) a sawtooth · 2) white noise. **A = 0**. Why: Only the resonant frequency survives four poles of filtering.

---

## EAR TRAINING

### 12 · mother32-e1-cutoff: Ear: brightness (CUTOFF, wide)
- **Concepts**: filter-cutoff · ~6 min
- **Objective**: Match the filter's brightness by ear to within about 20 % of CUTOFF's travel.
- **Start**: INIT + RESONANCE 8:30 (15 %) · VCF MOD AMOUNT 0 · DECAY 1:30 · TEMPO 12:55 · 8 steps `C2 · C3 · G2 · C3 · D#2 · C3 · A#2 · G2`, gates 4/8.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)* *Principle*: Ears learn by comparing: listen for the change, not the sound alone.
2. **listen**: A `{cutoff: 159}` / B `{cutoff: 5000}`. Q: Which has the lower cutoff? 0) A: darker, muffled · 1) B: brighter, fizzy · 2) Same. **A = 0**. Why: A low cutoff removes upper harmonics. It also gets a little quieter, but brightness is the main change.
3. **quiz**: Q: When you match brightness, listen to… 0) the fizz and edge at the top of the sound · 1) the pitch · 2) the tempo. **A = 0**. Why: Cutoff changes harmonics, not pitch or timing.
4. **match** `{cutoff: 159}` (10:00), controls `[cutoff]`, tolerance 0.20. Hints: "Darker or brighter than yours?" → "Quite dark: muffled, no fizz." → "About 10 o'clock."
5. **match** `{cutoff: 5000}` (3:00), tolerance 0.20. Hints: "Darker or brighter?" → "Very bright, almost the raw saw." → "About 3 o'clock."
6. **match** `{cutoff: 632}` (12:00), tolerance 0.15. Hints: "In between?" → "Warm, not muffled, not fizzy." → "About noon."
7. **match** `{cutoff: 1780}` (1:30), tolerance 0.12. Hints: "Brighter than noon?" → "Clear but not harsh." → "About half past 1."
8. **reflect**: "What did you listen for to judge brightness?" Model: How much fizz and edge sits above the notes: a darker sound has fewer upper harmonics.

**Review**
1. Raising CUTOFF on the low-pass makes the sound… 0) brighter · 1) lower · 2) shorter. **A = 0**. Why: More harmonics get through.
2. Ear matching works best when you… 0) compare A and B back and forth · 1) listen once and guess · 2) look at the knob. **A = 0**. Why: Hearing is comparative.
3. A muffled sound has… 0) few upper harmonics · 1) many upper harmonics · 2) no fundamental. **A = 0**. Why: The filter removed the top.

---

### 13 · mother32-e2-decay: Ear: note length (DECAY, fine)
- **Concepts**: envelope-decay · ~7 min
- **Objective**: Match note length by ear to within about 8 % of DECAY's travel.
- **Start**: INIT + SUSTAIN OFF · CUTOFF 1:00 · VCF MOD 9:00 (20 %) · TEMPO 12:05 (80 BPM) · 16 steps with notes only on 1 `C2`, 5 `G2`, 9 `C3`, 13 `G2`.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)* *Principle*: With SUSTAIN OFF and a fast attack, DECAY alone sets how long each note rings.
2. **listen**: A `{decay: 94}` / B `{decay: 525}`. Q: Which rings for about half a second? 0) A · 1) B · 2) Both. **A = 1**. Why: B rings about half a second; A is under a tenth, a blip.
3. **quiz**: Q: With SUSTAIN OFF and the fastest attack, holding a key longer… 0) changes nothing: DECAY sets the length · 1) makes it ring longer · 2) retriggers it. **A = 0**. Why: The attack is over almost at once and the decay runs on its own. Only a slow attack could be cut short by releasing early.
4. **match** `{decay: 222}` (1:00), tolerance 0.10. Hints: "Longer or shorter than yours?" → "A short pluck, about a fifth of a second." → "About 1 o'clock."
5. **match** `{decay: 341}` (1:30), tolerance 0.08. Hints: "Close to the last one?" → "A little longer: about a third of a second." → "About half past 1."
6. **match** `{decay: 809}` (2:30), tolerance 0.08. Hints: "Does it nearly reach the next note?" → "Nearly a second." → "About half past 2."
7. **match** `{decay: 144}` (12:30), tolerance 0.08. Hints: "Very short?" → "Under a quarter of a second." → "About half past 12."
8. **reflect**: "How did you tell two similar decay times apart?" Model: By the tail: when the note disappears compared with the beat, and whether it reaches the next note.

**Review**
1. DECAY reaches about… 0) 7 s · 1) 100 ms · 2) 350 Hz. **A = 0**. Why: Moog's nominal range is 1.25 ms–7 s.
2. Fine matching needs… 0) small moves and repeated A/B listening · 1) big sweeps · 2) more volume. **A = 0**. Why: Small differences need careful comparison.
3. With a long DECAY, each new note on this one-voice synth… 0) restarts the envelope before the last finishes · 1) waits for it to end · 2) plays an octave up. **A = 0**. Why: One voice and one EG: a new gate retriggers it.

---

### 14 · mother32-e3-filter-env: Ear: filter and envelope (two controls)
- **Concepts**: filter-cutoff, modulation-depth · ~8 min
- **Objective**: Tell CUTOFF from VCF MOD AMOUNT by ear and match both together.
- **Start**: INIT + SUSTAIN OFF · DECAY 1:00 · RESONANCE 10:00 · TEMPO 1:20 · the INIT demo pattern.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)* *Principle*: Steady settings and moving modulation sound different: listen for change inside each note.
2. **listen**: A `{cutoff: 159, vcf_mod_amount: 0}` / B `{cutoff: 159, vcf_mod_amount: 60}`. Q: What's different in B? 0) Each note starts bright and closes: a moving pluck · 1) Every note is brighter all the time · 2) The pitch changes. **A = 0**. Why: VCF MOD AMOUNT adds movement within each note, and CUTOFF sets the resting brightness. B is only brighter at the start of each note.
3. **quiz**: Q: Which control sets the brightness between the plucks? 0) CUTOFF · 1) VCF MOD AMOUNT · 2) DECAY. **A = 0**. Why: The modulation rides on top of the CUTOFF setting.
4. **match** `{cutoff: 317, vcf_mod_amount: 50}` (11:00 / 12:00), controls `[cutoff, vcf_mod_amount]`, tolerance 0.10. Hints: "Resting darkness first, then the pluck size." → "Medium-dark base, a clear pluck." → "CUTOFF 11 o'clock, VCF MOD AMOUNT noon."
5. **match** `{cutoff: 1260, vcf_mod_amount: 0}`, tolerance 0.10. Hints: "Any movement inside each note?" → "None: a steady, fairly bright tone." → "CUTOFF 1 o'clock, VCF MOD AMOUNT fully left."
6. **match** `{cutoff: 112, vcf_mod_amount: 70}`, tolerance 0.10. Hints: "Very dark between notes?" → "Very dark, with a big pluck." → "CUTOFF 9:30, VCF MOD AMOUNT 2 o'clock."
7. **match** `{cutoff: 448, vcf_mod_amount: 30}` (11:30 / 10:00), tolerance 0.08. Hints: "Close to the first target?" → "A bit brighter at rest, with a smaller pluck." → "CUTOFF 11:30, VCF MOD AMOUNT 10 o'clock."
8. **reflect**: "How do you hear the difference between CUTOFF and VCF MOD AMOUNT?" Model: CUTOFF sets the steady brightness the notes settle to; VCF MOD AMOUNT sets how much brighter each note starts.

**Review**
1. A bigger pluck at each note's start means more… 0) VCF MOD AMOUNT · 1) CUTOFF · 2) GLIDE. **A = 0**. Why: More envelope means a bigger sweep.
2. With VCF MOD AMOUNT at zero, the filter… 0) stays at the CUTOFF setting · 1) closes completely · 2) self-oscillates. **A = 0**. Why: No modulation means no movement.
3. A good order for matching two controls is… 0) the steady part first, then the movement · 1) both at once · 2) VOLUME first. **A = 0**. Why: Fix one variable, then the other.

---

### 15 · mother32-e4-mixed: Ear: which section? (three controls, interleaved)
- **Concepts**: oscillator-waveform, filter-cutoff, envelope-decay, mixing · ~10 min
- **Objective**: Decide whether a difference comes from the VCO, the filter or the envelope, and match three controls.
- **Start**: INIT + SUSTAIN OFF · DECAY 1:00 · VCO WAVE PULSE · CUTOFF 12:00 · RESONANCE 9:00 · VCF MOD 11:00 · TEMPO 1:20 · the INIT demo pattern.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)* *Principle*: Each section leaves its own fingerprint: colour (VCO), brightness (filter), shape over time (envelope).
2. **listen**: A `{pulse_width: 50}` / B `{pulse_width: 15}`. Q: What changed? 0) The waveform: hollow versus nasal at every moment · 1) The filter cutoff · 2) The decay. **A = 0**. Why: A narrow pulse sounds thinner and nasal throughout, while the length and the pluck stay the same. A cutoff change would make it duller or brighter overall instead.
3. **quiz**: Q: A sound got shorter but no darker. Which section changed? 0) The envelope (DECAY) · 1) The filter (CUTOFF) · 2) The VCO (FREQUENCY). **A = 0**. Why: Length belongs to the envelope, brightness to the filter, pitch to the VCO.
4. **match** `{pulse_width: 20, cutoff: 1260, decay: 144}`, controls `[pulse_width, cutoff, decay]`, tolerance 0.10. Hints: "Three things differ: colour, brightness and length." → "A narrower pulse, a brighter filter and shorter notes than yours." → "PULSE WIDTH 9 o'clock, CUTOFF 1 o'clock, DECAY 12:30."
5. **match** `{vco_wave: SAW, resonance: 65, attack: 133}`, controls `[vco_wave, resonance, attack]`, tolerance 0.10. Hints: "Buzzier? Ringing? Softer start?" → "A saw, a ringing filter and a gentle attack." → "VCO WAVE SAW, RESONANCE 1:30, ATTACK 1 o'clock."
6. **match** `{mix: 35, vcf_mod_amount: 60, decay: 525}`, controls `[mix, vcf_mod_amount, decay]`, tolerance 0.08. Hints: "Hiss? A big pluck? Long notes?" → "Some noise, a strong pluck, half-second notes." → "MIX 10:30, VCF MOD AMOUNT 1 o'clock, DECAY 2 o'clock."
7. **reflect**: "What clue tells you which section changed: VCO, filter or envelope?" Model: The VCO changes the pitch or the basic tone colour, the filter changes brightness or ringing, and the envelope changes how a note starts, moves and how long it lasts.

**Review**
1. A note starts softer but sounds the same afterwards. What changed? 0) ATTACK · 1) CUTOFF · 2) PULSE WIDTH. **A = 0**. Why: Only the start changed, and that is the envelope.
2. A sound rings at one pitch over every note. What is high? 0) RESONANCE · 1) DECAY · 2) MIX. **A = 0**. Why: Resonance rings at the cutoff.
3. Added hiss points to… 0) MIX · 1) GLIDE · 2) VCA MODE. **A = 0**. Why: Noise enters through the mixer.
4. Mixing sections in ear training helps you… 0) tell similar-sounding changes apart · 1) play faster · 2) tune the VCO. **A = 0**. Why: This is interleaving.

---

## SEQUENCING

### 16 · mother32-sq1-step-mode: Step mode: rests, gate length, ties and ratchets
- **Concepts**: sequencer-pattern, envelope-sustain, timing-tempo · ~10 min · source "M32 pp.33–37, 45–46"
- **Objective**: Edit a pattern step by step: rest, gate length, tie, accent and ratchet.
- **Start**: INIT + DECAY 12:00 (94 ms) · TEMPO 12:55 (100 BPM) · an 8-step pattern, all `C2`, gates 4/8, no flags (SUSTAIN is ON in INIT).

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)*
   *Principle*: A pattern is a list of steps; each stores a note and how it is played.
2. **info** (focus the step keys and the OCTAVE / LOCATION LEDs): "Press SHIFT + STEP for Step mode. The eight lower keys are now step buttons."
   *Principle*: Step editing changes one step at a time while the loop keeps playing.
   *Explanation*: In Step mode a step key turns that step on or off. SHIFT + a step key opens it for editing.
3. **do** (check: step 2 rest = true): "Press step key 2 to turn step 2 off."
   *Principle*: Silence is part of rhythm: rests shape the groove.
4. **predict** (check: step 4 gate = 1/8): "Press SHIFT + step key 4, then turn TEMPO/GATE LENGTH fully left."
   Q: With SUSTAIN ON, what will a 1/8 gate do to step 4? 0) Make it a short, staccato blip · 1) Make it louder · 2) Nothing: gate length is ignored. **A = 0**.
   Why: With SUSTAIN ON the envelope holds only while the gate is high, so a short gate makes a short note. "Ignored" is roughly what happens with SUSTAIN OFF, which is why the manual says to use SUSTAIN ON with gate lengths.
   *Principle*: Gate length is how long a note is held; shorter gates give staccato.
5. **do** (check: step 5 gate = 8/8 and step 6 has the same note): "Edit step 5 and turn TEMPO/GATE LENGTH fully clockwise."
   *Principle*: A full-length gate into the same pitch ties two steps into one long note.
6. **do** (check: step 8 ratchet = 3): "Edit step 8, hold SHIFT and turn GLIDE until three yellow LEDs light."
   *Principle*: Ratchets repeat a step's note inside the step: a quick roll.
7. **listen**: A `{sustain: ON}` / B `{sustain: OFF}`.
   Q: In which one do the gate lengths change the sound? 0) A · 1) B · 2) Both. **A = 0**.
   Why: With SUSTAIN OFF the short gate and the tie sound much like every other step.
8. **quiz**: Q: How long can one step's gate be? 0) 1/8 to 8/8 of the step, and 8/8 ties into the next step · 1) only on or off · 2) up to four steps. **A = 0**.
   Why: The OCTAVE / LOCATION LEDs show the gate in eighths. Longer notes come from ties.
9. **challenge**: "Program an 8-step groove with at least one rest, one tie, one accent and one ratchet."
   Checklist: ≥ 1 rest · ≥ 1 tie (8/8 followed by the same note) · ≥ 1 accent · a step with ratchet ≥ 2.
   Hints: "Rest: a step key in Step mode. Accent: RESET/ACCENT while editing." → "Tie: 8/8, then the same note next." → "Ratchet: SHIFT + GLIDE while editing."
   Solution: `{data: steps 1 C2/4 A · 2 rest · 3 C2/4 · 4 C2/1 · 5 C2/8 · 6 C2/4 · 7 D#2/4 · 8 C2/4 R3; length 8}`.
10. **reflect**: "Which step settings change the rhythm, and which change the sound?"
    Model: Rest, gate length, tie and ratchet change the rhythm. Accent and glide change how the notes sound.

**Review**
1. In Step mode, pressing a step key… 0) turns that step on or off · 1) stops the sequencer · 2) saves. **A = 0**. Why: SHIFT + the key opens it for editing.
2. SHIFT + GLIDE while editing a step sets… 0) ratchets (1–4) · 1) glide time · 2) tempo. **A = 0**. Why: GLIDE alone turns glide on or off.
3. To tie two steps… 0) set the first to 8/8 and give the next the same note · 1) use two rests · 2) turn GLIDE fully up. **A = 0**. Why: The gate stays high across both.
4. How many pattern locations are there? 0) 64 (8 banks of 8) · 1) 8 · 2) 32. **A = 0**. Why: Each holds up to 32 steps.

---

### 17 · mother32-sq2-timing: Timing: clock division, swing and direction
- **Concepts**: timing-tempo, sequencer-pattern, polyrhythm · ~10 min · source "M32 pp.20–22, 29, 41, 53–55"
- **Objective**: Change how a pattern moves through time with clock division, swing and playback direction.
- **Start**: INIT + SUSTAIN OFF · DECAY 12:30 · VCO WAVE PULSE (40 %) · CUTOFF 11:00 · VCF MOD 1:00 · TEMPO 12:55 (100) · the pattern of preset C20 · division 1/16 · swing 0 · Forward.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)*
   *Principle*: Rhythm is when notes happen; the same notes at new times feel like a new line.
2. **predict** (check: division = 1/8 straight): "Hold KB and STEP and turn TEMPO until the eighth-note LED lights."
   Q: Changing the division from 1/16 to 1/8 will… 0) make each step twice as long: the pattern at half speed · 1) play it twice as fast · 2) change the pitch. **A = 0**.
   Why: The division sets each step's note value. Eighths last twice as long as sixteenths, so at the same tempo the pattern takes twice as long. Pitch is untouched.
   *Principle*: Clock division sets how long a step lasts relative to the beat.
3. **do** (check: division 1/16 and swing ≥ +20 %): "Set the division back to 1/16, then hold SHIFT and turn TEMPO to about 1 o'clock."
   *Principle*: Swing makes every other note late, turning straight notes into a shuffle.
   *Explanation*: The centre (12:00) is no swing. Turning clockwise delays the on-beat side, and counterclockwise pushes the off-beats earlier. The swing is stored with the pattern.
4. **listen**: A `{swing: 0}` / B `{swing: 33}`, labels "Straight" / "Swung".
   Q: Which one shuffles? 0) A · 1) B · 2) Neither. **A = 1**.
   Why: In B the steps alternate long and short, the shuffle feel.
5. **do** (check: direction = pendulum): "Hold KB and STEP and press step key 3: Pendulum."
   *Principle*: Changing the playback order turns the same notes into a new phrase.
6. **quiz**: Q: With SHIFT held, TEMPO at exactly 12:00 means… 0) no swing: evenly spaced steps · 1) maximum swing · 2) half tempo. **A = 0**.
   Why: The centre is neutral. The manual's scale runs from −100 % to +100 %, and at the extremes only the on-beats or only the off-beats play.
7. **patch** `out_assign → in_vcf_cutoff` (setup `assign_source 8`, Step Random): "ASSIGN now outputs Step Random. Patch ASSIGN into VCF CUTOFF."
   *Principle*: A sequencer is also a voltage source: each step can move any parameter.
   *Explanation*: Step Random gives a new random voltage (−5…+5 V) every step, so the filter jumps on every note.
8. **challenge**: "Make the line a lazy triplet shuffle: straight 16th steps, triplet swing."
   Checklist: division 1/16 straight · swing interval 1/8 triplet · swing ≥ +20 %.
   Hints: "The swing interval can differ from the step length." → "Hold STEP and turn GLIDE for triplet swing intervals." → "1/16 straight, swing interval 1/8 triplet, SHIFT + TEMPO near 1 o'clock."
   Solution: `{data: {division: {value: 6, kind: 'straight'}, swingInterval: {value: 5, kind: 'triplet'}, swing: 33}}` (preset C20).
9. **reflect**: "What do clock division, swing and direction each change?"
   Model: Division sets how long each step lasts, swing makes alternate steps long and short, and direction changes the order the steps play in.

**Review**
1. The internal TEMPO range is… 0) 20–300 BPM · 1) 60–180 BPM · 2) 0.1–350 Hz. **A = 0**. Why: Set by the TEMPO knob on the internal clock.
2. Holding KB while turning TEMPO selects… 0) dotted divisions · 1) triplets · 2) swing. **A = 0**. Why: STEP + TEMPO gives triplets, and KB + STEP + TEMPO straight values.
3. Pendulum plays… 0) forward, then backward · 1) at random · 2) only odd steps. **A = 0**. Why: KB + STEP + step key 3; step key 4 is Random.
4. ASSIGN set to Step Random outputs… 0) a new random voltage each step, ±5 V · 1) white noise · 2) the LFO. **A = 0**. Why: It is stepped: each value holds for the whole step.

---

## PERFORMANCE

### 18 · mother32-p1-live: Play it live
- **Concepts**: sequencer-pattern, filter-cutoff · ~8 min · tags performance · source "M32 pp.29–30, 42–43"
- **Objective**: Perform with a running pattern: transpose from the keys, hold a step, use live accent, mute and ratchet, and ride the filter.
- **Start**: preset C27 (Acid Slide), stopped, octave 4.

**Steps**
1. **do** `run_stop → on`: "Press RUN/STOP." *(first win)*
   *Principle*: Live performance means changing a loop while it plays.
2. **do** (check: `engine.transpose == 5`): "While it plays, press the F key."
   *Principle*: Transposing moves every note by the same interval, so the line keeps its shape.
   *Explanation*: Low C means no change. F lifts the pattern five semitones, from the next note on.
3. **predict** (check: HOLD was pressed and released): "Press and hold HOLD/REST for a moment, then let go."
   Q: What will holding HOLD/REST do while the pattern runs? 0) Repeat the current step until you let go · 1) Stop the sequencer · 2) Store a rest. **A = 0**.
   Why: During playback HOLD repeats the current step at the tempo, like the HOLD jack. Storing a rest is its job while editing, and stopping is RUN/STOP's.
   *Principle*: Repeating one step builds tension; releasing it is the drop.
4. **do** (check: live accent used): "Hold SHIFT and press RESET/ACCENT."
   *Principle*: Accenting every step makes the whole line louder and brighter: a quick lift.
5. **do** (check: live ratchet used): "Hold SHIFT and turn GLIDE to add ratchets to every step."
   *Principle*: Ratcheting every step doubles or triples the note rate: an instant fill.
6. **do** (check: live mute used): "Hold SHIFT and press HOLD/REST."
   *Principle*: Muting and unmuting a part is the simplest arrangement move.
7. **quiz**: Q: Live accent, mute, ratchet and transpose are… 0) temporary, not saved to the pattern · 1) saved into the steps · 2) only available in Step mode. **A = 0**.
   Why: They act only while you hold the buttons (or until the next transpose). The stored pattern is unchanged.
8. **challenge**: "Perform a build: end with the filter more open and more resonant than where you started."
   Checklist: CUTOFF ≥ 1 kHz · RESONANCE ≥ 60 % · sequencer running.
   Hints: "Ride CUTOFF up slowly over several bars." → "Add resonance near the top." → "CUTOFF past 1 o'clock, RESONANCE about 2 o'clock."
   Solution: `{values: {cutoff: 1260, resonance: 70}}`.
9. **reflect**: "Which live moves change the notes, and which change the sound?"
   Model: Transpose and HOLD change which notes play. Live accent, ratchet, mute and filter rides change how they sound.

**Review**
1. While a pattern runs in KB mode, pressing a key… 0) transposes it · 1) records a note · 2) stops it. **A = 0**. Why: Recording needs SHIFT + RUN/STOP (REC).
2. RESET/ACCENT during playback… 0) jumps back to step 1 · 1) mutes · 2) saves. **A = 0**. Why: It is ACCENT only while editing a step.
3. SHIFT + HOLD/REST during playback… 0) mutes the output while held · 1) saves · 2) changes the tempo. **A = 0**. Why: The sequence keeps advancing silently.

---

## STUDIO

### 19 · mother32-st1-studio-clock: Sync to the studio clock
- **Concepts**: timing-tempo, signal-routing, sequencer-pattern · ~9 min · requires `['studio-clock']` · prerequisite `mother32-sq1-step-mode` · source "M32 pp.55–58"
- **Objective**: Lock the Mother-32's sequencer to the studio tempo, first as MIDI clock, then with clock, reset and run cables.
- **Start**: preset 00 with its demo pattern; Mother-32 stopped; studio stopped at 120 BPM.

**Steps**
1. **info**: "The Mother-32 follows MIDI clock and MIDI Start/Stop at its MIDI IN. In the Studio that is 'Sync to studio clock'."
   *Principle*: Sync means one clock leads and every instrument follows it.
2. **do** (check: `s.sync[<mother32>] !== false`): "In the Studio tab, make sure 'Sync to studio clock' is ticked for the Mother-32."
   *Principle*: A synced instrument ignores its own tempo and follows the leader.
3. **predict** (check: `s.transport.playing`): "Press ▶ in the top bar." *(first win: it plays in time)*
   Q: The studio sends a MIDI-style Start. Where does the Mother-32's pattern begin? 0) At step 1 · 1) Wherever it last stopped · 2) At a random step. **A = 0**.
   Why: A MIDI Start runs the pattern from step 1. Continue, by contrast, picks up at the next step.
   *Principle*: Start resets the followers, so everyone begins together.
4. **quiz**: Q: While MIDI clock is arriving, the Mother-32's TEMPO knob… 0) becomes a clock divider · 1) sets the studio BPM · 2) does nothing at all. **A = 0**.
   Why: The tempo now comes from the clock, and TEMPO chooses how the steps divide it. *(If the twin's hub doesn't model the divider, make this an info step.)*
5. **info** (focus `in_tempo, in_run_stop, in_reset`): "The hardware way needs no MIDI: clock pulses on a cable. By default each pulse at TEMPO advances one step."
   *Principle*: A clock pulse is a short voltage that says "next step, now".
   *Explanation*: The default TEMPO-input mode is Single Clock Advance. An analog clock at TEMPO overrides MIDI clock.
6. **do** (instance `studio-clock`; check: cable `studio-clock.out_clock → mother32.in_tempo` and sync off): "Untick sync, then patch Studio Clock CLOCK into the Mother-32's TEMPO jack."
   *Principle*: An external clock replaces the internal one; the tempo knob stops mattering.
7. **do** (instance `studio-clock`; check: cables `out_run → in_run_stop` and `out_reset → in_reset`): "Patch Studio Clock RUN into RUN / STOP, and RESET into RESET."
   *Principle*: A run gate starts and stops a follower; a reset pulse lines up its first step.
   *Explanation*: RUN / STOP plays while its input is high, and RESET sends the pattern to step 1.
8. **predict** (check: `s.transport.playing`): "Press ▶."
   Q: CLOCK DIV is 1/16. How long does each Mother-32 step last? 0) One 16th note · 1) One beat · 2) One bar. **A = 0**.
   Why: One pulse per 16th note, and one step per pulse.
   *Principle*: In single-advance mode the clock's division becomes the step length.
9. **challenge** (instance `studio-clock`, focus `division`): "Set Studio Clock CLOCK DIV to 1/8T: the Mother-32 plays triplets against the beat."
   Checklist: Studio Clock `division == 4` (1/8T).
   Hints: "CLOCK DIV is the selector on the Studio Clock." → "1/8T is three pulses per beat."
   Solution: `{values: {division: 4}}` on the `studio-clock` instance.
10. **reflect**: "Why patch RESET as well as CLOCK?"
    Model: CLOCK keeps the steps in time, and RESET makes the pattern start on step 1 just as the studio starts, so it lines up with the bar.

**Review**
1. In Single Clock Advance mode, each pulse at TEMPO… 0) advances one step · 1) sets the BPM · 2) resets to step 1. **A = 0**. Why: That is the default TEMPO-input mode.
2. A gate held high at RUN / STOP… 0) plays the sequencer while it stays high · 1) toggles it once · 2) mutes it. **A = 0**. Why: It plays from where it is, for as long as the voltage stays high.
3. RESET held high… 0) repeats step 1 until it drops · 1) stops the clock · 2) advances one step. **A = 0**. Why: When it drops, the pattern advances from step 1.
4. RUN / STOP, RESET and HOLD count a gate as high from about… 0) +3.2 V · 1) +10 V · 2) +0.5 V. **A = 0**. Why: Logic levels up to +15 V are safe.

---

### 20 · mother32-st2-dfam: The Mother-32 sequences the DFAM
- **Concepts**: signal-routing, timing-tempo, polyrhythm · ~10 min · requires `['dfam']` · prerequisite `mother32-st1-studio-clock` · source "DFAM manual p.31; M32 p.53"
- **Objective**: Clock the DFAM from the Mother-32's ASSIGN output and send KB pitch to the DFAM so its drums follow the bassline.
- **Start**: Mother-32 = preset S1's Mother-32 settings, no cables, stopped. DFAM = preset S1's DFAM kick, stopped. Studio sync off for the Mother-32.

**Steps**
1. **info**: "Moog's own recipe: patch the Mother-32's ASSIGN, which sends a clock by default, into the DFAM's ADV / CLOCK."
   *Principle*: An instrument without MIDI can follow a clock pulse on a cable.
2. **do** (check: studio cable `mother32.out_assign → dfam.in_adv_clock`): "In the Studio tab, patch the Mother-32's ASSIGN into the DFAM's ADV / CLOCK."
   *Principle*: Whatever pulses reach a clock input decide when that sequencer steps.
3. **do** (instance `dfam`; check: DFAM `run_stop` on): "On the DFAM, press ADVANCE until step 8 lights, then press RUN / STOP."
   *Principle*: Arm the follower before starting the leader, so no pulse is missed.
   *Explanation*: Moog's DFAM manual has you press RUN / STOP on the DFAM first. Parking it on step 8 makes the first pulse land on step 1.
4. **predict** `run_stop → on` (Mother-32): "Now press the Mother-32's RUN/STOP." *(first win of the pairing)*
   Q: Both are armed. How will the DFAM move? 0) One step for each Mother-32 step, in lockstep · 1) At its own TEMPO, drifting · 2) Once per bar. **A = 0**.
   Why: ASSIGN's default Clock source sends one pulse per Mother-32 step. ADV / CLOCK advances the DFAM once per pulse and ignores the DFAM's TEMPO knob.
   *Principle*: A follower clocked by the leader can't drift out of time.
5. **quiz**: Q: Why park the DFAM on step 8 first? 0) Its first pulse advances it to step 1, in time with the Mother-32 · 1) Step 8 is louder · 2) To mute it. **A = 0**.
   Why: ADV / CLOCK advances before it plays, and the DFAM has no reset input.
6. **do** (check: studio cable `mother32.out_kb → dfam.in_vco1_cv` and DFAM `seq_pitch_mod` = OFF): "Patch the Mother-32's KB into the DFAM's VCO 1 CV, and set the DFAM's SEQ PITCH MOD to OFF."
   *Principle*: One pitch voltage can drive two instruments, keeping them in key.
   *Explanation*: Both use 1 V per octave. SEQ PITCH MOD OFF stops the DFAM's own pitch knobs fighting the bassline.
7. **challenge**: "Make a polyrhythm: set the Mother-32's pattern length to 12 steps against the DFAM's 8."
   Checklist: Mother-32 pattern length = 12.
   Hints: "SET END sets the last step." → "In Step mode press SET END, then pick step 12: it's on the 9–16 page." → "SET END, page key 9-16, step key 4."
   Solution: `{data: {length: 12}}` on the Mother-32 (the extra steps hold the default C3 notes unless edited).
8. **reflect**: "How does one Mother-32 sequence drive both its own bass and the DFAM?"
   Model: ASSIGN sends a clock pulse every step into the DFAM's ADV / CLOCK, and KB sends the bassline's pitch into VCO 1 CV, so the drums step and tune with the bass.

**Review**
1. Moog's DFAM sync uses which Mother-32 output? 0) ASSIGN, set to Clock · 1) GATE · 2) EG. **A = 0**. Why: Clock is ASSIGN's default source.
2. ASSIGN set to Clock / 2 would make the DFAM… 0) advance every second Mother-32 step (half time) · 1) run twice as fast · 2) stop. **A = 0**. Why: Half as many pulses.
3. A 12-step pattern against an 8-step DFAM lines up again every… 0) 24 steps · 1) 20 steps · 2) 96 steps. **A = 0**. Why: 24 is the least common multiple of 12 and 8.
4. KB into the DFAM's VCO 1 CV works because… 0) both use 1 V per octave · 1) both are made by Moog · 2) it is MIDI. **A = 0**. Why: It is the same pitch standard.

---

## Implementation notes

- **Step-data checks** (lessons 9, 16, 17, 20) need the model in `signal-flow.md` §11.8.
- **Key mapping**: the keyboard's lowest key in the default octave 4 is C3 (−1 V); octave n's low
  C is (n − 5) V. Lesson 18 checks `engine.transpose` relative to low C.
- **Match tolerances** follow PEDAGOGY: 0.20 for the wide steps, down to 0.08 for the fine ones.
  Every target differs from the start by at least 20 % of travel at the easy levels and 8 % at
  the hard ones, under the §14 tapers. Re-check if the tapers change.
- **Validator**: all challenges have hints and solutions; all predict steps have an action; ids
  start with `mother32-`; and instructions are 25 words or fewer.
