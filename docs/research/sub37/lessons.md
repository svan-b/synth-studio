# Sub 37 / Subsequent 37 lesson outlines (20 lessons)

These outlines follow `docs/PEDAGOGY.md` (anatomy, writing rules, feedback model) and the `Lesson`/`LessonStep` types in `types/index.ts`. Facts come from `sources.md` and `signal-flow.md`; any fact used here that is only **likely** is marked (likely).

## Conventions

**Values.** Every target is written as the **panel value** first and the **twin value** in backticks: `RESONANCE 6 → resonance = 60`.
- Mixer, RESONANCE, MULTIDRIVE, SUSTAIN, VEL AMT and env KB: ×10 → %
- EG AMT and mod amounts (±5): ×20 → ±%
- KB TRACK (0–2): ×100 → %
- times: ms
- GLIDE TIME panel 0–10 → `glide_time` ms, t = 10·1000^(x/10), so 2 → 40 ms
- switch targets: option index

**Labels.** Instructions use the panel labels as the manual prints them (pp.15–34). The p.28 drawing confirms the filter's KB TRACK. Where today's twin `spec.ts` differs:

| Panel label used here | Twin id | Current twin label / status |
|---|---|---|
| KB TRACK (filter) | `filter_kb_amt` (0–200 %) | "KB AMT", max 100 → widen |
| KB TRACK (env, shifted RELEASE) | `feg_kb_amt` / `aeg_kb_amt` | "KB AMT" |
| MOD 1/2 DEST (7 positions) | **NEW** `mod1_dest` / `mod2_dest` (0 LFO rate · 1 VCA · 2 OSC 1 WAVE · 3 OSC 1+2 WAVE · 4 OSC 2 WAVE · 5 NOISE · 6 EG TIME/PGM) | replaces "PGM DEST" (4 options) |
| MOD 1/2 MOD AMT | `mod1_pgm_amt` / `mod2_pgm_amt`, bipolar ±100 | "PGM AMT", unipolar → make bipolar |
| MOD 1/2 PITCH AMT and FILTER AMT | `modN_pitch_amt` / `modN_filter_amt`, bipolar | unipolar → make bipolar |
| MOD 1/2 OSC (pitch target) | `modN_pitch_dest` (0 1+2 · 1 OSC 1 · 2 OSC 2) | "PITCH" |
| MOD 1/2 SYNC, KB RESET | **NEW** `modN_sync`, `modN_clock_div`, `modN_kb_reset` | missing |
| KB CTRL (HI / LO / off) | **NEW** `osc2_kb_mode` ('HI' / 'LO' / 'OFF') | bool `osc2_kb_ctrl` |
| ARPEGGIATOR ON / REST, LATCH / TIE | `arp_on`, `arp_latch` | "ON/OFF", "LATCH" |
| PATTERN (UP, DWN, ORDR, RND, SEQ, REC) | **NEW** `arp_pattern` 0–5 | `arp_mode` (4 options) |
| RANGE (7 states) | **NEW** `arp_range_state` 0–6 (3 = 0, 4 = +1) | `arp_range` (5) |
| BACK / FORTH | `arp_back_fwd` | "BACK/FWD" |
| SYNC / TAP (arp) | **NEW** `arp_sync`, `arp_clock_div` (16 = 1/16, 15 = 1/8 T, 13 = 1/8) | missing |
| FDBK / EXT IN | `mix_feedback` | "FDBK/EXT" |
| LATCH ON (each envelope) | `feg_latch` / `aeg_latch` | "LATCH" |
| ENV SYNC (each envelope) + menu CLOCK DIV | **NEW** `feg_sync` / `aeg_sync`, `*_clock_div` | missing |
| KB PRIORITY (PRESET EDIT 2.1) | **NEW** `kb_priority` ('LOW' / 'HIGH' / 'LAST', default LAST) | missing (twin is fixed at LAST) |
| SUB OSC (Subsequent: "SUB 1") | `mix_sub` | "SUB OSC" |

**Default start.** Every lesson uses `start: { reset: true, values }`. Lessons list only what differs from the twin reset in `signal-flow.md` §12:
- OSC 1 8' SAW; mixer OSC 1 at 5, everything else 0
- CUTOFF 20 kHz, RESONANCE 0, MULTIDRIVE 0, SLOPE 24, EG AMT 0, KB TRACK 1.0
- both EGs: A 1 ms, D 300 ms, SUSTAIN 10, R 100 ms
- MOD amounts 0; glide, arp and DUO off

**Steps.** Each step gives its `kind`, the control and target (twin id, value), the instruction (≤ 25 words), the principle (≤ 20 words), the explanation, and any `predict`/`quiz` (options listed with their index; ✓ marks the answer), hints, setup and focus. A `do` step with no new idea omits the principle.

**Checks** for studio and sequencer steps are written as TypeScript expressions against `LessonCheckState`:
- `dv(s, dev)` = the values of the first instance of `dev`.
- `seq(s)` = the Sub 37's recorded sequence in the twin's data model: an array of `{ note?: number, rest?: boolean, tie?: boolean }`. The current twin has no sequencer, so adapt this.

## Curriculum

| # | id | path · order | Name | Prerequisites |
|---|---|---|---|---|
| 1 | `sub37-f1-oscillators` | foundations 1 | Footage and wave | — |
| 2 | `sub37-f2-osc2-tuning` | foundations 2 | OSC 2: intervals, detune and beating | f1 |
| 3 | `sub37-f3-mixer` | foundations 3 | The mixer and its overdrive point | f1 |
| 4 | `sub37-f4-filter` | foundations 4 | The ladder filter | f3 |
| 5 | `sub37-f5-envelopes` | foundations 5 | Two envelopes: brightness and loudness | f4 |
| 6 | `sub37-f6-env-modes` | foundations 6 | DAHDSR, MULTI TRIG and LOOP | f5 |
| 7 | `sub37-f7-modulation` | foundations 7 | Mod busses: vibrato, wobble and DEST | f5 |
| 8 | `sub37-f8-duo` | foundations 8 | DUO MODE: two notes, one filter | f2 |
| 9 | `sub37-sd1-moog-bass` | sound-design 1 | The Moog bass | f5 |
| 10 | `sub37-sd2-sync-lead` | sound-design 2 | The hard-sync lead | f2, f7 |
| 11 | `sub37-sd3-grit` | sound-design 3 | Grit: where distortion happens | f3, f4 |
| 12 | `sub37-e1-cutoff` | ear-training 1 | Ear: cutoff, wide | f4 |
| 13 | `sub37-e2-decay-fine` | ear-training 2 | Ear: filter decay, fine | e1, f5 |
| 14 | `sub37-e3-filter-pair` | ear-training 3 | Ear: cutoff and resonance together | e1 |
| 15 | `sub37-e4-three-sections` | ear-training 4 | Ear: oscillator, drive or envelope? | e2, e3 |
| 16 | `sub37-sq1-arpeggiator` | sequencing 1 | The arpeggiator | f5 |
| 17 | `sub37-sq2-step-sequencer` | sequencing 2 | The step sequencer: an acid line | sq1, sd1 |
| 18 | `sub37-p1-wheels-glide-latch` | performance 1 | Wheels, glide and latch | f7 |
| 19 | `sub37-st1-arp-sync` | studio 1 | Sync the arpeggiator to the studio | sq1 |
| 20 | `sub37-st2-rytm-bassline` | studio 2 | A bassline under the Analog Rytm | st1, sq2 |

---

## 1. `sub37-f1-oscillators`: Footage and wave

foundations · order 1 · beginner · 6 min · concepts `oscillator-waveform`, `oscillator-pitch` · source "Synth Studio · Subsequent 37 manual p.25"

**Objective:** By the end you can pick an oscillator's footage and wave shape and say which harmonics each shape contains.

**Start:** the reset patch, which is OSC 1 at 8' SAW alone with the filter fully open (`osc1_octave = 1, osc1_wave = 33, mix_osc1 = 50, cutoff = 20000`).

**Steps**
1. **info** (hook, `autoplay`). Instruction: "Play a few keys. This is OSC 1 alone: a sawtooth, with the filter wide open." Principle: "Every pitched sound is a fundamental plus harmonics at whole-number multiples of it." Explanation: "Harmonics are the quieter higher pitches that give a sound its colour. The Sub 37 has two oscillators; we start with one."
2. **do** `osc1_wave` → 0 (TRI). "Turn OSC 1 WAVE fully left, to the triangle, and hold a key." Principle: "A triangle has only odd harmonics that fade fast, so it sounds soft." Explanation: "The 3rd harmonic is 1/9 as strong and the 5th 1/25, so it's almost a sine: flute-like."
3. **predict** `osc1_wave` → 67 (SQR). "Turn WAVE two-thirds of the way round, to the square."
   - Q: "A square also has only odd harmonics. Compared with the triangle, it will sound…" [0] brighter and hollow ✓ · [1] darker and softer · [2] an octave higher · [3] exactly the same.
   - Why: "Its odd harmonics fall slowly (1/n), not 1/n², so it is far brighter. Missing the even harmonics makes it hollow, like a clarinet. Pitch comes from OCTAVE and the key, so it does not move."
   - Principle: "How fast harmonics fall decides brightness; which harmonics exist decides colour."
4. **do** `osc1_wave` → 33 (SAW). "Turn WAVE back to one-third, the sawtooth." Principle: "A sawtooth contains every harmonic, which makes it the brightest classic shape." Explanation: "It is the usual raw material for basses, brass and leads: the filter has the most to sculpt."
5. **listen.** A `{osc1_wave: 33}` / B `{osc1_wave: 100}`, labels Saw / Narrow pulse.
   - Q: "The narrow pulse sounds…" [0] thinner and more nasal ✓ · [1] lower in pitch · [2] rounder.
   - Why: "Narrowing the pulse changes the balance of the harmonics, and the tone turns thin and reedy, like an oboe. The pitch stays the same, because only the wave's shape changed."
6. **do** `osc1_octave` → 0 (16'). "Set OSC 1 OCTAVE to 16'." Principle: "Halving a pipe's length doubles its frequency, so 16' is an octave below 8'." Explanation: "Footage comes from organ pipes. 16', 8', 4' and 2' give four octaves before you touch the keyboard."
7. **quiz.** "OSC 1 at 8' plays an A at 220 Hz. You switch to 4'. It now plays…" [0] 440 Hz ✓ · [1] 110 Hz · [2] 220 Hz · [3] 880 Hz.
   - Why: "4' is one octave above 8', and an octave doubles the frequency. 110 Hz would be 16'; 880 Hz would be 2'."
8. **match.** target `{osc1_wave: 100, osc1_octave: 2}`, controls `['osc1_wave','osc1_octave']` (from SAW 16': 67 % travel and two detents).
   - Hints: "It is thin and nasal, and higher than now." → "WAVE is fully right; OCTAVE is two steps up from 16'." → "Narrow PULSE at 4'."
9. **reflect.** Prompt: "In one sentence: why does a square sound hollow but a saw sound full?" Model: "The square has only odd harmonics, while the saw has every harmonic, so the square is missing the even ones that fill out the sound."

**Review**
- "Which wave contains every harmonic?" [0] Sawtooth ✓ · [1] Square · [2] Triangle. *All harmonics at 1/n; the others are odd-only.*
- "8' to 16' changes the pitch by…" [0] one octave down ✓ · [1] one octave up · [2] a fifth down. *Doubling the footage halves the frequency.*
- "Saw to narrow pulse makes the sound…" [0] thinner and more nasal ✓ · [1] lower · [2] rounder. *The shape changes the harmonic balance; the pitch stays.*
- "A triangle sounds soft because its harmonics…" [0] fall away fast, 1/n² ✓ · [1] are all even · [2] are louder than the fundamental. *Odd only, steeply falling.*

---

## 2. `sub37-f2-osc2-tuning`: OSC 2, intervals, detune and beating

foundations · 2 · beginner · 7 min · prereq f1 · concepts `oscillator-pitch`, `mixing` · source "manual p.26"

**Objective:** By the end you can tune OSC 2 against OSC 1 for an even beat, a fat detune or a fifth, and explain why BEAT FREQ beats evenly on every key.

**Start:** reset, plus OSC 2 8' SAW with mixer OSC 2 at 5 and CUTOFF 6 kHz (`osc2_octave = 1, osc2_wave = 33, mix_osc2 = 50, osc2_frequency = 0, beat_freq = 0, cutoff = 6000`).

**Steps**
1. **info** (hook, `autoplay`). "Two sawtooths in perfect unison sound like one louder saw. Hold a key." Principle: "Two identical frequencies add into one tone with the same colour."
2. **do** `beat_freq` → +1. "Turn BEAT FREQ to +1 Hz and hold a key." Principle: "Two tones beat, swelling and fading, at the difference of their frequencies." Explanation: "1 Hz apart, the waves drift in and out of step once a second, reinforcing and then cancelling."
3. **predict** `beat_freq` → +3. "Turn BEAT FREQ to +3 Hz, then play a low key and a high key."
   - Q: "BEAT FREQ adds a fixed number of hertz to OSC 2. How will the beating compare on low and high keys?" [0] the same speed on every key ✓ · [1] faster on high keys · [2] faster on low keys.
   - Why: "A fixed 3 Hz offset makes the difference, and so the beat, 3 per second everywhere. The tempting 'faster on high keys' is what a cents detune (FREQUENCY) does."
   - Principle: "A fixed-hertz offset gives a constant beat rate; a fixed ratio does not."
4. **do** `beat_freq` → 0. "Return BEAT FREQ to 0."
5. **do** `osc2_frequency` → +0.15. "Turn FREQUENCY slightly clockwise, to about +0.15 semitones, and compare low and high keys." Principle: "A ratio detune beats faster on higher notes, because the hertz gap grows." Explanation: "Low notes shimmer slowly and high notes buzz. This is the classic fat analog detune."
6. **listen.** A `{osc2_frequency: 0}` / B `{osc2_frequency: 0.15}`, labels Unison / Detuned.
7. **do** `osc2_frequency` → +7. "Turn FREQUENCY fully clockwise, to +7 semitones." Principle: "Seven semitones is a perfect fifth, a 3:2 ratio whose harmonics coincide." Explanation: "Full clockwise is a perfect fifth, so one finger plays a power chord: the two notes fuse into one strong tone."
8. **quiz.** "OSC 1 plays 200 Hz and OSC 2 FREQUENCY is +7. OSC 2 plays about…" [0] 300 Hz ✓ · [1] 207 Hz · [2] 400 Hz · [3] 214 Hz.
   - Why: "A fifth is 3:2, and 200 × 1.5 = 300 (equal temperament gives 299.7). 400 Hz would be an octave."
9. **match.** target `{osc2_frequency: 0, beat_freq: 2}`, controls `['osc2_frequency','beat_freq']` (FREQUENCY moves 50 % of travel; BEAT 29 %).
   - Hints: "It beats evenly on every key." → "FREQUENCY is back at centre; only BEAT FREQ is moved." → "BEAT FREQ about +2 Hz."
10. **reflect.** "Why does BEAT FREQ beat at the same speed everywhere while FREQUENCY doesn't?" Model: "BEAT FREQ adds a fixed number of hertz, so the difference never changes; FREQUENCY changes the ratio, so the hertz gap grows with pitch."

**Review**
- "Tones at 220 Hz and 223 Hz beat…" [0] 3 times per second ✓ · [1] 223 times per second · [2] not at all. *Beat rate is the difference.*
- "FREQUENCY fully clockwise gives…" [0] a perfect fifth ✓ · [1] an octave · [2] a semitone. *The ±7-semitone range ends on a fifth.*
- "For an even beat across the keyboard, use…" [0] BEAT FREQ ✓ · [1] FREQUENCY · [2] OCTAVE. *A fixed-Hz offset.*
- "A fifth sounds smooth because…" [0] many harmonics coincide ✓ · [1] it is quieter · [2] the filter removes beating. *3:2 lines the harmonics up.*

---

## 3. `sub37-f3-mixer`: The mixer, its sub, pink noise and the overdrive point

foundations · 3 · beginner · 7 min · prereq f1 · concepts `mixing`, `subharmonics`, `noise`, `gain-staging` · source "manual p.27"

**Objective:** By the end you can balance the five mixer channels and hear the point, above 5, where they start to overdrive the filter.

**Start:** reset, with OSC 1 at 16' and CUTOFF 1.2 kHz (`osc1_octave = 0, cutoff = 1200`).

**Steps**
1. **info** (hook, `autoplay`). "Five channels feed the filter: OSC 1, SUB OSC, OSC 2, NOISE and FDBK/EXT IN. Play a low key." Principle: "A mixer adds signals, and each knob sets how much of one source reaches the filter."
2. **do** `mix_sub` → 7 (`70`). "Turn SUB OSC up to 7 and play a low key." Principle: "A sub-oscillator adds a fundamental an octave lower, which we hear as weight." Explanation: "The Sub 37's sub is always a square, one octave below OSC 1 and locked to it, so it never beats against it."
3. **quiz.** "OSC 1 plays 110 Hz. The SUB OSC plays…" [0] 55 Hz ✓ · [1] 220 Hz · [2] 110 Hz.
   - Why: "One octave below halves the frequency. 220 Hz would be an octave above."
4. **do** `mix_noise` → 4 (`40`). "Turn NOISE up to 4." Principle: "Noise has energy at all frequencies and no pitch: it adds breath and air." Explanation: "The Sub 37 makes pink noise, which has equal energy per octave and so sounds softer and darker than white noise's hiss."
5. **do** `mix_noise` → 0. "Turn NOISE back to 0."
6. **predict** `mix_osc1` → 9 (`90`). "Turn the mixer OSC 1 knob from 5 up to 9 while holding a low key."
   - Q: "The manual says mixer settings above 5 overdrive the filter's input. What will you hear?" [0] louder, thicker and slightly gritty ✓ · [1] exactly twice as loud and otherwise identical · [2] quieter · [3] higher in pitch.
   - Why: "Past 5 the ladder's input saturates. Its peaks round off, which adds harmonics and squeezes the dynamics. It gets louder, but not cleanly twice as loud."
   - Principle: "Pushing a stage past its clean range adds harmonics and compresses peaks."
7. **listen.** A `{mix_osc1: 50}` / B `{mix_osc1: 90}`, labels Clean (5) / Driven (9).
   - Q: "Which has more upper harmonics?" [0] Driven (9) ✓ · [1] Clean (5) · [2] they match.
   - Why: "Saturation creates new harmonics."
8. **do** `mix_feedback` → 5 (`50`). "Turn FDBK/EXT IN up to 5." Principle: "Feeding an output back into a saturating input thickens and roughens the sound." Explanation: "With nothing plugged into EXT IN, this channel feeds the mixer's own output back into the mixer. It is the old Minimoog trick of patching the output into the external input."
9. **match.** target `{mix_osc1: 90, mix_sub: 20, mix_feedback: 0}`, controls `['mix_sub','mix_feedback']` (each moves 50 % of travel).
   - Hints: "Less weight underneath and no growl." → "SUB OSC is low; FDBK/EXT IN is off." → "SUB OSC about 2, FDBK/EXT IN 0."
10. **reflect.** "Why can turning a mixer channel up change the tone, not just the level?" Model: "Above 5 the channels overdrive the filter's input, and that saturation adds harmonics and compresses the sound, so it gets thicker and grittier as well as louder."

**Review**
- "On the Sub 37, mixer levels above 5…" [0] overdrive the filter input ✓ · [1] mute the channel · [2] change the pitch. *Manual p.27.*
- "The sub-oscillator is…" [0] a square one octave below OSC 1 ✓ · [1] a sine two octaves below · [2] a copy of OSC 2. *Locked to OSC 1.*
- "FDBK/EXT IN with nothing in EXT IN…" [0] feeds the mixer output back into the mixer ✓ · [1] is silent · [2] adds reverb. *Internal feedback.*
- "Pink noise compared with white noise sounds…" [0] darker and softer ✓ · [1] brighter · [2] pitched. *It falls 3 dB per octave.*

---

## 4. `sub37-f4-filter`: The ladder filter (cutoff, slope, resonance)

foundations · 4 · beginner · 9 min · prereq f3 · concepts `filter-cutoff`, `filter-type`, `filter-resonance` · source "manual pp.28–29"

**Objective:** By the end you can use CUTOFF, SLOPE and RESONANCE to darken or brighten the sound or make it ring, and play the self-oscillating filter in tune.

**Start:** reset, with CUTOFF at 8 kHz (`cutoff = 8000`).

**Steps**
1. **do** `cutoff` → 500. "Hold a key and turn CUTOFF down to about 500 Hz." Principle: "A low-pass filter removes harmonics above its cutoff, so the sound darkens." Explanation: "The Moog ladder runs from 20 Hz to 20 kHz. The oscillator sets pitch; the filter sets brightness."
2. **predict** `filter_slope` → 0 (−6 dB). "Press SLOPE until −6 dB is lit."
   - Q: "−6 dB/oct removes far less above the cutoff than −24 dB/oct. At the same CUTOFF the sound will be…" [0] brighter ✓ · [1] darker · [2] lower in pitch.
   - Why: "Each pole adds 6 dB per octave. With one pole, an octave above the cutoff is only halved instead of cut to 1/16, so far more brightness passes. Pitch does not change."
   - Principle: "Each filter pole adds 6 dB per octave of cut above the cutoff."
3. **listen.** A `{filter_slope: 0}` / B `{filter_slope: 3}`, labels 6 dB (1 pole) / 24 dB (4 poles).
4. **do** `filter_slope` → 3. "Press SLOPE until −24 dB is lit again." Explanation: "Four poles is the classic Moog ladder, four transistor stages in a row."
5. **do** `resonance` → 5 (`50`). "Turn RESONANCE up to 5." Principle: "Resonance feeds the output back to the input, boosting a narrow peak at the cutoff." Explanation: "You now hear a whistle at the cutoff. A ladder also loses a little bass as resonance rises."
6. **do** `cutoff` → 2000. "Sweep CUTOFF slowly up to about 2 kHz while holding a note." Principle: "A resonant peak moving through the harmonics sounds like a vowel: wah."
7. **quiz.** "RESONANCE above 7 makes the Sub 37's filter self-oscillate. That means it…" [0] produces its own sine tone at the cutoff ✓ · [1] turns the oscillators off · [2] stops passing sound · [3] distorts the oscillators.
   - Why: "With enough feedback the filter rings by itself, a sine at the cutoff frequency. The oscillators still play unless you turn them down."
8. **do** `mix_osc1` → 0. "Turn the mixer OSC 1 knob down to 0."
9. **do** `resonance` → 8.5 (`85`). "Turn RESONANCE up to 8.5 and play up and down the keyboard." Principle: "Keyboard tracking at 1:1 lets a self-oscillating filter play in tune." Explanation: "KB TRACK 1.0 moves the cutoff an octave for each octave you play, pivoting on the key the Sub 37 calls middle C (MIDI 48)."
10. **match.** target `{mix_osc1: 50, cutoff: 300, resonance: 60}`, controls `['cutoff','resonance']` (from 2 kHz and 8.5: 27 % and 25 % of travel).
    - Hints: "It's dark, and it rings." → "CUTOFF is in the low hundreds; RESONANCE is high but below self-oscillation." → "CUTOFF about 300 Hz, RESONANCE about 6."
11. **reflect.** "In one sentence: what do CUTOFF and RESONANCE each do?" Model: "CUTOFF sets where the filter starts removing harmonics, and RESONANCE boosts the frequencies right at that point until, above 7, the filter rings on its own."

**Review**
- "Turning CUTOFF down…" [0] removes high harmonics ✓ · [1] lowers the pitch · [2] adds distortion.
- "At the same CUTOFF, −24 dB/oct compared with −12 dB/oct is…" [0] darker ✓ · [1] brighter · [2] the same. *More poles, more cut.*
- "RESONANCE above 7 on the Sub 37…" [0] self-oscillates ✓ · [1] mutes the filter · [2] adds sub bass.
- "KB TRACK 1.0 makes the cutoff…" [0] move one octave per octave played ✓ · [1] stay fixed · [2] move two octaves per octave. *2.0 would be 2:1.*

---

## 5. `sub37-f5-envelopes`: Two envelopes, brightness and loudness

foundations · 5 · beginner · 9 min · prereq f4 · concepts `envelope-attack`, `envelope-decay`, `envelope-sustain`, `envelope-release`, `modulation-depth` · source "manual pp.28, 30–32"

**Objective:** By the end you can shape brightness with the FILTER EG and EG AMT, and loudness with the AMP EG, to make a pluck and a swell.

**Start:** reset, with CUTOFF 300 Hz and RESONANCE 2 (`cutoff = 300, resonance = 20`).

**Steps**
1. **do** `filter_eg_amt` → +3 (`60`). "Set EG AMT to +3 and play a note." Principle: "An envelope's amount sets how far it pushes its destination." Explanation: "The FILTER EG now lifts the cutoff above 300 Hz while you hold the key. EG AMT is bipolar: below centre it pulls the cutoff down."
2. **do** `feg_sustain` → 0. "Set the FILTER EG SUSTAIN to 0." Principle: "Sustain is a level, not a time: where the envelope rests while the key is held."
3. **do** `feg_decay` → 250. "Set the FILTER EG DECAY to about 250 ms." Principle: "Decay is the time to fall from the peak to the sustain level." Explanation: "It starts bright and darkens: a pluck in brightness while the loudness stays."
4. **predict** `aeg_sustain` → 0. "Set the AMP EG SUSTAIN to 0 and hold a key."
   - Q: "What happens while you keep holding the key?" [0] it fades to silence ✓ · [1] it keeps sounding at full level · [2] it gets brighter · [3] it rises in pitch.
   - Why: "AMP SUSTAIN sets the loudness held after the decay (manual p.32). At 0 the note dies away even while held, like a plucked string. It doesn't brighten: the FILTER EG is already falling."
   - Principle: "The amplifier envelope shapes loudness; at sustain 0 every note dies away."
5. **do** `aeg_decay` → 600. "Set the AMP EG DECAY to about 600 ms." Principle: "Different decay times for brightness and loudness make natural plucks."
6. **quiz.** "The filter closes in 250 ms and the volume fades in 600 ms. The note…" [0] starts bright, goes dark, then fades ✓ · [1] starts dark and gets brighter · [2] stays bright until it stops.
   - Why: "The FILTER EG falls first, so the brightness drops while the note is still loud. Then the AMP EG fades it."
7. **do** `aeg_sustain` → 9 (`90`). "Set the AMP EG SUSTAIN back to 9."
8. **do** `aeg_attack` → 600. "Set the AMP EG ATTACK to about 600 ms." Principle: "Attack is the time from key-down to the peak; a slow attack swells in."
9. **listen.** A `{aeg_attack: 1}` / B `{aeg_attack: 600}`, labels Fast attack / Slow attack.
10. **challenge.** "Make a pluck: bright on the attack, dark quickly, and gone within about a second even if you hold the key."
    - Checklist: EG AMT at least +2 (`filter_eg_amt ≥ 40`) · FILTER EG SUSTAIN ≤ 1 (`≤ 10`) · FILTER EG DECAY ≤ 400 ms · AMP EG ATTACK ≤ 10 ms · AMP EG SUSTAIN ≤ 1 (`≤ 10`) · AMP EG DECAY ≤ 1000 ms.
    - Hints: "Both envelopes need a quick fall and a low sustain." → "FILTER EG: SUSTAIN 0 and a short DECAY. AMP EG: fast ATTACK, SUSTAIN 0." → "EG AMT +3.5, FILTER DECAY 220 ms, AMP ATTACK 1 ms, AMP DECAY 500 ms, both SUSTAIN 0."
    - Solution: `{filter_eg_amt: 70, feg_sustain: 0, feg_decay: 220, aeg_attack: 1, aeg_decay: 500, aeg_sustain: 0}`.
11. **reflect.** "Why does the Sub 37 have two envelopes instead of one?" Model: "One shapes brightness through the filter and one shapes loudness through the VCA, so a sound can darken while it is still loud, as real instruments do."

**Review**
- "SUSTAIN is…" [0] a level held while the key is down ✓ · [1] a time · [2] a pitch.
- "EG AMT below centre makes the FILTER EG…" [0] pull the cutoff down ✓ · [1] do nothing · [2] change the pitch. *It is bipolar.*
- "AMP EG SUSTAIN at 0 means a held note…" [0] fades out ✓ · [1] sustains forever · [2] gets louder.
- "A slow AMP EG ATTACK makes notes…" [0] swell in ✓ · [1] click · [2] higher.

---

## 6. `sub37-f6-env-modes`: DAHDSR, MULTI TRIG and LOOP

foundations · 6 · intermediate · 9 min · prereq f5 · concepts `envelope-shape`, `lfo` · source "manual pp.30–33"

**Objective:** By the end you can use KNOB SHIFT to set DELAY and HOLD, and choose MULTI TRIG and LOOP to change how the envelopes fire.

**Start:**
- reset, plus OSC 2 8' SAW at 4 with BEAT +0.5
- CUTOFF 250 Hz, RESONANCE 3, EG AMT +3
- FILTER EG: A 1 ms, D 200 ms, S 0, R 200 ms
- AMP EG: SUSTAIN 9, R 150 ms

`mix_osc2 = 40, beat_freq = 0.5, cutoff = 250, resonance = 30, filter_eg_amt = 60, feg_decay = 200, feg_sustain = 0, feg_release = 200, aeg_sustain = 90, aeg_release = 150`

**Steps**
1. **info.** "The Sub 37's envelopes have two extra stages: DELAY before the attack and HOLD at the peak. KNOB SHIFT reaches them." Principle: "DAHDSR adds delay and hold to the usual attack, decay, sustain and release."
2. **do** `knob_shift` → true. "Press KNOB SHIFT. The envelope knobs now read DELAY, HOLD, VEL AMT and KB TRACK." Principle: "A shift button gives every knob a second job; the display names the hidden one." Explanation: "The silkscreen doesn't change, so trust the LCD while shift is lit."
3. **predict** `feg_hold` → 150. "With KNOB SHIFT lit, turn the FILTER EG HOLD (the DECAY knob) to about 150 ms."
   - Q: "HOLD keeps the envelope at its peak before it decays. What changes?" [0] the bright part of each note lasts longer ✓ · [1] notes start later · [2] notes get louder · [3] the pitch rises.
   - Why: "HOLD keeps the cutoff fully open for 150 ms before the decay, so the bite lasts longer. Notes starting later is what DELAY does, which is the tempting answer."
   - Principle: "Hold stretches the peak; delay postpones the whole envelope."
4. **do** `feg_delay` → 300. "Now turn the FILTER EG DELAY (the ATTACK knob) to about 300 ms. Play short and long notes." Principle: "Delayed modulation appears only on notes held long enough." Explanation: "Short notes stay dark; long ones bloom. VEL AMT (the SUSTAIN knob) would make harder playing open the filter further, but the on-screen keys play at full velocity."
5. **do** `knob_shift` → false. "Press KNOB SHIFT again to get ATTACK, DECAY, SUSTAIN and RELEASE back." Setup at the next step: `feg_delay = 0`.
6. **info.** "Play overlapping (legato) notes. With MULTI TRIG off, the filter doesn't re-open for the second note." Principle: "Single-trigger envelopes restart only when every key has been released."
7. **predict** `feg_multi_trig` → true. "Press the FILTER EG MULTI TRIG so it lights, then play legato again."
   - Q: "With MULTI TRIG lit, overlapping notes will…" [0] re-open the filter on every new note ✓ · [1] stop sounding · [2] glide into each other.
   - Why: "MULTI TRIG restarts the envelope on every key. Off, it is single-trigger, the classic Moog legato feel. Gliding is GLIDE's job."
   - Principle: "Multi-trigger restarts an envelope on every new note, even when you play legato."
8. **do** `feg_loop` → true. "Press the FILTER EG LOOP so it lights, and hold one key." Principle: "A looping envelope repeats while a key is held, becoming an LFO with your shape." Explanation: "The Sub 37 loops delay, attack, hold, decay and release, skipping sustain (manual p.31)."
9. **quiz.** "LOOP is on with DELAY 0, ATTACK 1 ms, HOLD 150 ms, DECAY 200 ms and RELEASE 200 ms. One cycle lasts about…" [0] 550 ms ✓ · [1] 200 ms · [2] 1 s · [3] 150 ms.
   - Why: "Add the looping stages: 0 + 1 + 150 + 200 + 200 ≈ 550 ms. Sustain is skipped, so it adds nothing."
10. **match.** target `{feg_loop: true, feg_hold: 150, feg_decay: 1300, feg_release: 1300}`, controls `['feg_decay','feg_release']` (each 200 → 1300 ms is about 20 % of log travel).
    - Hints: "The pulse is much slower." → "DECAY and RELEASE are both longer." → "Both about 1.3 s."
11. **reflect.** "How is a looping envelope like an LFO, and how is it different?" Model: "Both repeat while you hold a note, but the looping envelope restarts from its beginning on each key, and its shape comes from five stage times rather than a fixed wave."

**Review**
- "KNOB SHIFT turns the DECAY knob into…" [0] HOLD ✓ · [1] DELAY · [2] VEL AMT · [3] KB TRACK. *A→DELAY, D→HOLD, S→VEL AMT, R→KB TRACK.*
- "With MULTI TRIG off, legato notes…" [0] don't restart the envelope ✓ · [1] restart it · [2] are silent.
- "In LOOP the Sub 37 skips…" [0] the sustain stage ✓ · [1] the attack · [2] the release.
- "DELAY makes the envelope…" [0] wait before its attack ✓ · [1] hold its peak · [2] release more slowly.

---

## 7. `sub37-f7-modulation`: Mod busses (vibrato, wobble and DEST)

foundations · 7 · intermediate · 10 min · prereq f5 · concepts `lfo`, `modulation-source`, `modulation-depth`, `signal-routing` · source "manual pp.22–24"

**Objective:** By the end you can route an LFO to PITCH, FILTER and a DEST target, and use the MOD wheel to fade MOD 1 in.

**Start:**
- reset, plus OSC 2 8' SQR at 4
- CUTOFF 900 Hz, RESONANCE 3
- MOD 1: TRI at 5 Hz; MOD 2: TRI at 2 Hz; all amounts 0
- MOD wheel 0

`mix_osc2 = 40, osc2_wave = 67, cutoff = 900, resonance = 30, mod1_source = 0, mod1_rate = 5, mod2_source = 0, mod2_rate = 2, mod_wheel = 0`

**Steps**
1. **info.** "Each MOD bus has one source and three destinations: PITCH, FILTER and a DEST you choose. MOD 1's depth follows the MOD wheel." Principle: "Modulation is source, amount and destination: what moves, how far, and what it moves." Explanation: "By default the MOD wheel sets MOD 1's overall depth (manual p.22). The CONTROLLERS menu can add velocity or aftertouch."
2. **do** `mod1_rate` → 5.5. "In MOD 1, set LFO RATE to about 5.5 Hz." Principle: "An LFO is an oscillator too slow to hear as a pitch, used to move other controls."
3. **do** `mod1_pitch_amt` → +0.5 (`10`). "Set MOD 1 PITCH AMT to +0.5. You won't hear it yet." Principle: "Small, quick pitch modulation of about 5 to 7 Hz is vibrato."
4. **predict** `mod_wheel` → 60. "Push the MOD wheel up to about 60 while holding a note."
   - Q: "What will the MOD wheel do here?" [0] fade the vibrato in ✓ · [1] bend the pitch up · [2] open the filter · [3] nothing.
   - Why: "The wheel scales MOD 1's depth, so it fades the 5.5 Hz wobble in. Bending is the PITCH wheel's job."
   - Principle: "A depth controller adds modulation only when the music needs it."
5. **do** `mod_wheel` → 0. "Return the MOD wheel to 0."
6. **do** `mod2_filter_amt` → +2.5 (`50`). "In MOD 2, turn FILTER AMT to +2.5." Principle: "An LFO on the cutoff moves brightness up and down: a wah or a wobble." Explanation: "MOD 2 is at full depth, so you hear it at once."
7. **do** `mod2_source` → 1 (SQR). "Set MOD 2 SOURCE to SQR." Principle: "A square LFO jumps between two values, so the filter switches instead of sweeping."
8. **do** `mod2_source` → 4 (S&H). "Set MOD 2 SOURCE to S&H." Principle: "Sample and hold takes a new random value each cycle: random steps." Explanation: "Random filter steps on a resonant filter make the classic computer bleeps."
9. **quiz.** "MOD 2 runs at 2 Hz in S&H. How many new random values per second?" [0] 2 ✓ · [1] 1 · [2] 4 · [3] endless.
   - Why: "S&H grabs one value per LFO cycle."
10. **do** `mod2_filter_amt` → 0. "Set MOD 2 FILTER AMT back to 0 and SOURCE to TRI." (Setup applies `mod2_source = 0`; the step checks only FILTER AMT.)
11. **do** `mod2_dest` → 3 (BOTH, i.e. OSC 1 + 2 WAVE, **NEW id**). "Press the MOD 2 DEST button until BOTH (both oscillators' WAVE) is lit." Principle: "The same signal can move a different parameter just by re-routing it."
12. **do** `mod2_pgm_amt` → +2 (`40`). "Turn MOD 2 MOD AMT up to +2." Principle: "Moving the wave shape keeps changing the harmonics, like pulse-width modulation." Explanation: "Both oscillators now morph slowly around the square: a moving, chorus-like tone."
13. **match.** target `{mod2_source: 0, mod2_dest: 3, mod2_rate: 0.5, mod2_pgm_amt: 90}`, controls `['mod2_rate','mod2_pgm_amt']` (2 → 0.5 Hz is 20 % of log travel; MOD AMT moves 25 %).
    - Hints: "Slower and deeper." → "LFO RATE is down near half a hertz; MOD AMT is near the top." → "RATE 0.5 Hz, MOD AMT +4.5."
14. **reflect.** "Why did MOD 1 need the MOD wheel while MOD 2 didn't?" Model: "On this patch the MOD wheel scales MOD 1's depth, so MOD 1 stays silent until the wheel moves, while MOD 2 always runs at full depth."

**Review**
- "Vibrato is…" [0] periodic pitch modulation ✓ · [1] a filter sweep · [2] a loudness envelope.
- "An S&H LFO produces…" [0] random steps ✓ · [1] a smooth sine · [2] silence.
- "MOD 1 PITCH AMT is up but you hear nothing. Most likely…" [0] the MOD wheel is down ✓ · [1] the filter is closed · [2] SUSTAIN is 0.
- "DEST OSC 1+2 WAVE with a slow triangle gives…" [0] a shimmering wave-shape movement ✓ · [1] vibrato · [2] tremolo. *Tremolo would be DEST VCA.*

---

## 8. `sub37-f8-duo`: DUO MODE, two notes and one filter

foundations · 8 · intermediate · 8 min · prereq f2 · concepts `oscillator-pitch`, `signal-routing` · source "manual pp.9, 26"

**Objective:** By the end you can play two-note intervals with DUO MODE and KB CTRL, and explain what paraphonic means.

**Start:** reset, plus OSC 2 8' SAW at 5, CUTOFF 2 kHz, RESONANCE 1, AMP EG A 5 ms / S 9 / R 300 ms, and KB CTRL HI (`mix_osc2 = 50, cutoff = 2000, resonance = 10, aeg_attack = 5, aeg_sustain = 90, aeg_release = 300, duo_mode = false, osc2_kb_mode = 'HI'`).

**Steps**
1. **info** (hook, `autoplay` a two-note phrase). "Hold two keys at once. With DUO MODE off, the Sub 37 plays one note: both oscillators follow one key." Principle: "A monophonic synth plays one pitch at a time, however many keys you hold." Explanation: "Which key wins is the KB PRIORITY setting. By default the last key you pressed wins."
2. **predict** `duo_mode` → true. "Press DUO MODE, then hold C and the G above it."
   - Q: "With DUO MODE on and KB CTRL on HI, which oscillator plays the G?" [0] OSC 2 ✓ · [1] OSC 1 · [2] both · [3] neither.
   - Why: "KB CTRL HI gives OSC 2 the highest held key and OSC 1 the lowest. With a single key, both play it."
   - Principle: "Paraphonic oscillators take separate notes but share one filter and amplifier."
3. **do** `mix_osc1` → 0. "Turn the mixer OSC 1 knob to 0 and hold the two keys: you hear only the upper note." Principle: "Muting one source reveals which note it plays."
4. **do** `mix_osc1` → 5 (`50`). "Turn the mixer OSC 1 knob back to 5."
5. **quiz.** "Both notes share one FILTER EG and one AMP EG. Holding a low key and then adding a higher one will…" [0] not re-attack the envelopes while MULTI TRIG is off ✓ · [1] start a new filter sweep for the new note only · [2] play the new note louder.
   - Why: "There is one pair of envelopes for both notes. The new key only changes OSC 2's pitch. A polyphonic synth gives every note its own envelopes."
6. **do** `osc2_kb_mode` → 'LO' (**NEW id**). "Press KB CTRL so LO is lit, and hold two keys." Principle: "Swapping which oscillator takes the top note changes the voicing's colour." Explanation: "Now OSC 1 takes the top key and OSC 2 the bottom. That matters when the two oscillators have different waves or octaves."
7. **do** `osc2_kb_mode` → 'OFF'. "Press KB CTRL until neither light is lit, then play a melody." Principle: "A drone is a fixed pitch that ignores the keys." Explanation: "OSC 2 now holds one pitch while OSC 1 plays, and OSC 2's FREQUENCY widens to ±3 octaves for tuning the drone (manual p.26)."
8. **listen.** A `{duo_mode: false}` / B `{duo_mode: true, osc2_kb_mode: 'HI'}`, labels Mono / Duo (the demo phrase plays two-note intervals).
9. **challenge.** "Set it up so two held keys give a square on top and a saw underneath."
   - Checklist: DUO MODE lit · KB CTRL on HI · OSC 2 WAVE near SQR (`55–80`) · OSC 1 WAVE near SAW (`20–45`) · both OSC levels ≥ 3 (`≥ 30`).
   - Hints: "With KB CTRL on HI, which oscillator plays the top key?" → "OSC 2 plays the top key, so give OSC 2 the square." → "KB CTRL HI, OSC 2 WAVE 67, OSC 1 WAVE 33."
   - Solution: `{duo_mode: true, osc2_kb_mode: 'HI', osc2_wave: 67, osc1_wave: 33, mix_osc1: 50, mix_osc2: 50}`.
10. **reflect.** "What's the difference between paraphonic and polyphonic?" Model: "A paraphonic synth's oscillators play separate notes but share one filter and one pair of envelopes, while a polyphonic synth gives every note its own filter and envelopes."

**Review**
- "DUO MODE on, KB CTRL on HI: OSC 1 plays…" [0] the lowest held key ✓ · [1] the highest · [2] the last pressed.
- "Paraphonic means…" [0] separate pitches through one shared filter and VCA ✓ · [1] one voice per key with its own envelopes · [2] two synths layered.
- "KB CTRL off in DUO MODE makes OSC 2…" [0] drone at a fixed pitch ✓ · [1] go silent · [2] follow the low key.
- "How many notes can the Sub 37 sound at once?" [0] two ✓ · [1] one · [2] four · [3] 37.

---

## 9. `sub37-sd1-moog-bass`: The Moog bass

sound-design · 1 · intermediate · 8 min · prereq f5 · concepts `filter-cutoff`, `envelope-decay`, `gain-staging` · source "manual pp.27–31"

**Objective:** By the end you can build a punchy Moog bass from two 16' saws, the sub and a short filter envelope, and name the three controls that define it.

**Start:** reset, with OSC 1 at 16' and OSC 2 at 16' SAW (level 0) (`osc1_octave = 0, osc2_octave = 0, osc2_wave = 33`).

**Steps**
1. **listen** (hook). A = the start patch / B = the target ("Three-Osc Mono Bass", presets.md), labels Raw / Target. "Here's where we're going: a punchy Moog bass. Then the raw starting point."
2. **do** `mix_osc2` → 7 (`70`). "Turn the mixer OSC 2 knob up to 7." Setup: `osc2_frequency = -0.08`. Principle: "Two slightly detuned oscillators sound wider and fuller than one." Explanation: "OSC 2 sits a hair flat, so the pair slowly drifts against each other."
3. **do** `mix_sub` → 4 (`40`). "Turn SUB OSC up to 4." Principle: "Weight lives in the fundamental; a sub adds a fundamental an octave lower."
4. **do** `mix_osc1` → 8 (`80`). "Turn the mixer OSC 1 knob up to 8." Principle: "Driving a filter's input past its clean range adds warmth and compression." Explanation: "Above 5 the Sub 37's mixer overdrives the ladder's input. That is part of the fat Moog sound."
5. **predict** `cutoff` → 260. "Turn CUTOFF down to about 260 Hz."
   - Q: "With CUTOFF at 260 Hz and EG AMT at 0, the bass will sound…" [0] dark and dull, with no punch ✓ · [1] bright and punchy · [2] silent.
   - Why: "Only the lowest harmonics pass, and nothing moves the cutoff, so it is static and dull. The punch comes next from the FILTER EG. It isn't silent: the fundamentals are below 260 Hz."
   - Principle: "A static filter gives a static tone; moving the filter gives each note an articulation."
6. **do** `filter_eg_amt` → +3 (`60`). "Set EG AMT to +3." Principle: "A filter envelope adds a bright pluck to the start of each note."
7. **do** `feg_decay` → 350. "Set the FILTER EG DECAY to about 350 ms."
8. **do** `feg_sustain` → 3 (`30`). "Set the FILTER EG SUSTAIN to 3." Principle: "A low sustain lets the filter settle darker after the pluck."
9. **quiz.** "The bass sounds too clicky and thin on its attack. Which change helps most?" [0] lower EG AMT a little ✓ · [1] raise RESONANCE to 9 · [2] turn SUB OSC off · [3] raise CUTOFF to 5 kHz.
   - Why: "A smaller envelope amount softens the bright peak. RESONANCE 9 would self-oscillate, and losing the sub or opening the filter makes the bass thinner, not fuller."
10. **match.** target `{cutoff: 1100, feg_decay: 2200}`, controls `['cutoff','feg_decay']` (each about 20 % of travel from 260 Hz and 350 ms).
    - Hints: "Brighter overall, and the 'wow' lasts much longer." → "CUTOFF is higher; FILTER EG DECAY is far longer." → "CUTOFF about 1.1 kHz, DECAY about 2.2 s."
11. **challenge.** "Make it a funk bass: tighter and snappier, with every note re-attacking even when you play legato."
    - Checklist: FILTER EG DECAY ≤ 250 ms · FILTER EG MULTI TRIG lit · AMP EG MULTI TRIG lit.
    - Hints: "Shorter filter movement makes a bass snappier." → "Bring the FILTER EG DECAY down and light both MULTI TRIG buttons." → "DECAY about 160 ms, with MULTI TRIG on in both envelopes."
    - Solution: `{feg_decay: 160, feg_multi_trig: true, aeg_multi_trig: true, resonance: 40}`.
12. **reflect.** "Which three controls make this a Moog bass, and what does each add?" Model: "The mixer pushed past 5 adds warmth, the low CUTOFF keeps it deep, and EG AMT with a short FILTER EG DECAY puts a punchy pluck on every note."

**Review**
- "The punch of a classic Moog bass mostly comes from…" [0] a short FILTER EG with positive EG AMT ✓ · [1] high resonance · [2] a slow attack.
- "Mixer OSC 1 at 8 instead of 5 makes the bass…" [0] warmer and more compressed ✓ · [1] thinner · [2] out of tune. *Overdriving the filter input.*
- "To make legato bass notes re-attack, light…" [0] MULTI TRIG ✓ · [1] LOOP · [2] HARD SYNC. *Single triggering is the default.*

---

## 10. `sub37-sd2-sync-lead`: The hard-sync lead

sound-design · 2 · advanced · 8 min · prereq f2, f7 · concepts `oscillator-sync`, `modulation-source` · source "manual pp.22–26"

**Objective:** By the end you can make a tearing sync lead by syncing OSC 2 to OSC 1 and sweeping OSC 2's pitch with the FILTER EG.

**Start:**
- reset; mixer OSC 1 at 0 and OSC 2 at 8 (SAW at 8'); CUTOFF 3 kHz; RESONANCE 1
- FILTER EG: A 1 ms, D 700 ms, S 3, R 400 ms; EG AMT 0
- AMP EG: SUSTAIN 9, R 300 ms

`mix_osc1 = 0, mix_osc2 = 80, cutoff = 3000, resonance = 10, feg_decay = 700, feg_sustain = 30, feg_release = 400, aeg_sustain = 90, aeg_release = 300`

**Steps**
1. **info** (hook). "We hear only OSC 2. OSC 1 is silent in the mixer but still runs as the master." Principle: "In sync, the master sets the pitch and the slave sets the tone."
2. **do** `hard_sync` → true. "Press HARD SYNC." Principle: "Hard sync restarts the slave's cycle each time the master starts a new one."
3. **predict** `osc2_frequency` → +5. "Turn OSC 2 FREQUENCY up to about +5 while holding a note."
   - Q: "OSC 2 is synced to OSC 1. Raising its FREQUENCY will…" [0] change the tone but keep the pitch ✓ · [1] raise the pitch five semitones · [2] only make it quieter.
   - Why: "The slave restarts at the master's rate, so you still hear OSC 1's pitch. More of OSC 2's faster cycle fits in before each restart, which changes the harmonics. A pitch rise is what happens *without* sync."
   - Principle: "Sweeping a synced slave moves a bright, vocal peak through the harmonics."
4. **quiz.** "If OSC 1 is higher than OSC 2 with sync on, OSC 2 gives little or no output. Why?" [0] it is restarted before it can complete a cycle ✓ · [1] the filter closes · [2] the mixer mutes it.
   - Why: "When the master's cycle is shorter than the slave's, the slave never gets far into its wave. Keep OSC 2 at or above OSC 1."
5. **do** `mod2_source` → 5 (F.EG/PGM). "In MOD 2, turn SOURCE to F. EG/PGM." Principle: "An envelope can be a modulation source; it moves once per note."
6. **do** `mod2_pitch_dest` → 2 (OSC 2). "Press MOD 2's OSC button until only OSC 2 is selected." Principle: "Modulating only the slave changes the timbre and leaves the note alone."
7. **do** `mod2_pitch_amt` → +4 (`80`). "Turn MOD 2 PITCH AMT up to +4 and play detached notes." Principle: "An envelope sweeping a synced slave makes the classic tearing lead." Explanation: "Each note starts bright and screaming and settles as the FILTER EG decays."
8. **listen.** A `{mod2_pitch_amt: 0}` / B `{mod2_pitch_amt: 80}`, labels Static sync / Swept sync.
9. **match.** target `{feg_decay: 120, osc2_frequency: 0}`, controls `['feg_decay','osc2_frequency']` (DECAY 19 % of travel; FREQUENCY 36 %).
   - Hints: "The scream is shorter, and it settles to a plain tone." → "FILTER EG DECAY is short; OSC 2 FREQUENCY is back at centre." → "DECAY about 120 ms, FREQUENCY 0."
10. **challenge.** "Make it playable: add vibrato on the MOD wheel and a short glide between overlapping notes."
    - Checklist: MOD 1 PITCH AMT between +0.2 and +1 (`4–20`) · GLIDE ON lit · LEGATO lit.
    - Hints: "Vibrato belongs on the bus the MOD wheel controls." → "MOD 1 PITCH AMT small and positive; GLIDE ON with LEGATO." → "MOD 1 PITCH AMT about +0.35 at LFO RATE 5.5 Hz; GLIDE ON, LEGATO, TIME about 2."
    - Solution: `{mod1_pitch_amt: 7, mod1_rate: 5.5, glide_on: true, glide_legato: true, glide_time_panel: 2}`.
11. **reflect.** "Why does the pitch stay put when you detune a synced OSC 2?" Model: "Hard sync restarts OSC 2 every time OSC 1 starts a cycle, so the sound repeats at OSC 1's rate. Detuning OSC 2 only changes the shape of each repeat, which we hear as tone."

**Review**
- "In hard sync, the pitch you hear follows…" [0] the master, OSC 1 ✓ · [1] the slave, OSC 2 · [2] the filter.
- "To sweep only the timbre of a sync sound, send modulation to…" [0] OSC 2's pitch ✓ · [1] OSC 1's pitch · [2] both oscillators' pitch.
- "Sync with OSC 2 tuned below OSC 1 gives…" [0] little or no OSC 2 output ✓ · [1] a louder OSC 2 · [2] an octave jump.

---

## 11. `sub37-sd3-grit`: Grit and where distortion happens

sound-design · 3 · advanced · 8 min · prereq f3, f4 · concepts `gain-staging`, `filter-resonance`, `effects` · source "manual pp.11, 27–28"

**Objective:** By the end you can choose mixer overdrive, FDBK or MULTIDRIVE for grit, and explain where each sits relative to the filter.

**Start:** reset, with OSC 1 at 16', SUB OSC 4, CUTOFF 500 Hz and RESONANCE 2 (`osc1_octave = 0, mix_sub = 40, cutoff = 500, resonance = 20`).

**Steps**
1. **info.** "The Sub 37 has three places for dirt: mixer levels above 5, the FDBK/EXT IN channel, and MULTIDRIVE after the filter." Principle: "Where distortion happens in a chain changes its sound as much as how much."
2. **do** `multidrive` → 3 (`30`). "Turn MULTIDRIVE up to 3." Principle: "Gentle saturation rounds the peaks, adding warmth before it sounds distorted." Explanation: "At low settings MULTIDRIVE is asymmetric and tube-like."
3. **predict** `multidrive` → 9 (`90`). "Turn MULTIDRIVE up to 9."
   - Q: "MULTIDRIVE sits after the filter, and CUTOFF is at 500 Hz. Will the result have strong high frequencies?" [0] yes, because distortion after the filter creates new highs ✓ · [1] no, the filter removes them · [2] no, MULTIDRIVE only adds bass.
   - Why: "The OTA and FET drive stages sit between the filter and the amplifier, so the harmonics they create are never filtered and a dark patch turns buzzy. The tempting 'no' would be true if the drive came before the filter."
   - Principle: "Distortion after a filter adds highs that the filter can no longer remove."
4. **do** `multidrive` → 0. "Turn MULTIDRIVE back to 0."
5. **do** `mix_osc1` → 9 (`90`). "Turn the mixer OSC 1 knob up to 9." Principle: "Overdrive before the filter is smoothed by the filter, so it sounds warmer."
6. **listen.** A `{mix_osc1: 90, multidrive: 0}` / B `{mix_osc1: 50, multidrive: 90}`, labels Drive before (mixer 9) / Drive after (MULTIDRIVE 9).
   - Q: "Which is brighter and buzzier?" [0] drive after, MULTIDRIVE 9 ✓ · [1] drive before, mixer 9 · [2] neither.
   - Why: "The filter smooths the overdrive that happens before it. Drive after the filter keeps all its new highs."
7. **do** `mix_feedback` → 6 (`60`). "Turn FDBK/EXT IN up to 6, and turn MASTER VOLUME down if it jumps." Principle: "Feeding an output back into its own input thickens it and can make it unstable." Explanation: "Feedback can raise the level a lot. Its character runs from mellow to chaotic."
8. **quiz.** "With nothing plugged into EXT IN, FDBK/EXT IN feeds…" [0] the mixer's output back into the mixer ✓ · [1] the headphone output into the filter · [2] pink noise into the filter.
   - Why: "The block diagram routes the mixer's output into the FDBK/EXT channel whenever the jack is empty. Patching the output back into the external input was the old Minimoog trick this replaces."
9. **challenge.** "Make an aggressive bass that stays dark: plenty of grit, but nothing hissy or fizzy on top."
   - Checklist: mixer OSC 1 ≥ 7 **or** FDBK/EXT IN ≥ 3 (grit before the filter) · MULTIDRIVE ≤ 4 · CUTOFF ≤ 600 Hz.
   - Hints: "Fizz comes from distortion the filter can't reach." → "Put the grit before the filter and keep MULTIDRIVE low." → "Mixer OSC 1 about 9, FDBK/EXT IN about 6, MULTIDRIVE 2, CUTOFF about 400 Hz."
   - Solution: `{mix_osc1: 90, mix_feedback: 60, multidrive: 20, cutoff: 400}`.
10. **reflect.** "Why does distortion before the filter sound warmer than distortion after it?" Model: "The filter removes the high harmonics that distortion before it creates, but anything distorted after the filter keeps all of its new highs."

**Review**
- "MULTIDRIVE sits…" [0] between the filter and the amplifier ✓ · [1] before the oscillators · [2] in the mixer. *OTA and FET stages after the ladder.*
- "To add grit but keep a bass dark, distort…" [0] before the filter, with the mixer or FDBK ✓ · [1] after it, with MULTIDRIVE · [2] with noise.
- "Before judging a distorted sound, you should…" [0] match its loudness to the clean one ✓ · [1] raise the cutoff · [2] add resonance. *Louder fools the ear.*

---

## 12. `sub37-e1-cutoff`: Ear, cutoff (wide)

ear-training · 1 · beginner · 5 min · prereq f4 · concepts `filter-cutoff` · source "Synth Studio"

**Objective:** By the end you can hear where CUTOFF is set, to within about an octave, on a saw bass.

**Start:** reset, with OSC 1 at 16', SUB OSC 3, RESONANCE 1 and CUTOFF 4 kHz (`osc1_octave = 0, mix_osc1 = 60, mix_sub = 30, resonance = 10, cutoff = 4000`).

**Steps**
1. **listen** (first win). A `{cutoff: 200}` / B `{cutoff: 4000}`, labels Dark (200 Hz) / Bright (4 kHz).
   - Q: "Which has more buzz at the top?" [0] Bright, 4 kHz ✓ · [1] Dark, 200 Hz · [2] they match.
2. **predict** `cutoff` → 900. "Turn CUTOFF to about 900 Hz."
   - Q: "Heard in octaves, the halfway point between 200 Hz and 4 kHz is about…" [0] 900 Hz ✓ · [1] 2.1 kHz · [2] 400 Hz.
   - Why: "We hear frequency as ratios. The geometric middle is √(200 × 4000) ≈ 894 Hz. The plain average, 2.1 kHz, is tempting, but it sounds much closer to the bright end."
   - Principle: "Pitch and brightness are heard in ratios, so equal octaves feel like equal steps."
3. **match.** setup `{cutoff: 4000}` · target `{cutoff: 300}` · controls `['cutoff']` (3.7 octaves, 37 % of travel).
   - Hints: "It's dark." → "Below 500 Hz." → "About 300 Hz."
4. **match.** setup `{cutoff: 300}` · target `{cutoff: 2500}` (3 octaves).
   - Hints: "Bright but not fizzy." → "Between 1.5 and 4 kHz." → "About 2.5 kHz."
5. **match.** setup `{cutoff: 5000}` · target `{cutoff: 1000}` (2.3 octaves).
   - Hints: "A rounder middle." → "Around 1 kHz." → "About 1 kHz."
6. **quiz.** "Moving CUTOFF from 300 Hz to 600 Hz is a change of…" [0] one octave ✓ · [1] 300 octaves · [2] half an octave.
   - Why: "Doubling any frequency raises it one octave."
7. **reflect.** "How did you judge the cutoff by ear?" Model: "By how much buzz is left at the top: a low cutoff leaves only the deep fundamentals, while a high one leaves the bright harmonics."

**Review**
- "Doubling the cutoff frequency raises it by…" [0] one octave ✓ · [1] two octaves · [2] a fifth.
- "A saw with CUTOFF at 200 Hz sounds…" [0] dark and muffled ✓ · [1] bright and buzzy · [2] silent.
- "In octaves, the middle of 100 Hz and 1.6 kHz is…" [0] 400 Hz ✓ · [1] 850 Hz · [2] 800 Hz. *√(100 × 1600) = 400.*

---

## 13. `sub37-e2-decay-fine`: Ear, filter decay (fine)

ear-training · 2 · intermediate · 6 min · prereq e1, f5 · concepts `envelope-decay` · source "Synth Studio"

**Objective:** By the end you can match a FILTER EG DECAY by ear to within about a factor of two.

**Start:**
- reset; CUTOFF 300 Hz, RESONANCE 3, EG AMT +3.5
- FILTER EG: A 1 ms, D 300 ms, S 0, R 200 ms
- AMP EG: D 800 ms, S 6, R 200 ms

`mix_osc1 = 60, cutoff = 300, resonance = 30, filter_eg_amt = 70, feg_decay = 300, feg_sustain = 0, feg_release = 200, aeg_decay = 800, aeg_sustain = 60, aeg_release = 200`

**Steps**
1. **listen** (first win). A `{feg_decay: 80}` / B `{feg_decay: 800}`, labels Short / Long.
2. **predict** `feg_decay` → 160. "Set the FILTER EG DECAY to about 160 ms and play short notes."
   - Q: "Compared with 300 ms, 160 ms will sound…" [0] snappier, because the brightness closes sooner ✓ · [1] louder · [2] lower in pitch.
   - Why: "DECAY sets how fast the cutoff falls back. Halving it tightens the pluck. Loudness belongs to the AMP EG, and pitch to the oscillator."
   - Principle: "Shorter envelope stages make sounds tighter; longer ones make them lazier."
3. **match.** setup `{feg_decay: 150}` · target `{feg_decay: 600}` · tolerance 0.06 (15 % of travel apart).
   - Hints: "The pluck is long and lazy." → "Longer than half a second." → "About 600 ms."
4. **match.** setup `{feg_decay: 450}` · target `{feg_decay: 220}` · tolerance 0.06 (about 8 % apart).
   - Hints: "Slightly shorter than where you are." → "Between 150 and 300 ms." → "About 220 ms."
5. **match.** setup `{feg_decay: 180}` · target `{feg_decay: 90}` · tolerance 0.05.
   - Hints: "A tight blip." → "Under 120 ms." → "About 90 ms."
6. **quiz.** "You double DECAY from 100 to 200 ms. On a logarithmic time knob, that is…" [0] the same turn as 1 s to 2 s ✓ · [1] ten times the turn of 1 s to 2 s · [2] no movement at all.
   - Why: "A log knob spaces ratios evenly, so every doubling is the same turn."
7. **reflect.** "What did you listen for to judge the decay?" Model: "How long the bright 'wow' at the start of each note lasts before the tone settles."

**Review**
- "FILTER EG DECAY controls…" [0] how fast the brightness falls after the attack ✓ · [1] the loudness · [2] the pitch.
- "A shorter FILTER EG DECAY makes a bass…" [0] snappier ✓ · [1] longer · [2] higher.
- "On a log time knob, 50 → 100 ms and 2 → 4 s are…" [0] the same distance ✓ · [1] very different distances · [2] impossible.

---

## 14. `sub37-e3-filter-pair`: Ear, cutoff and resonance together

ear-training · 3 · intermediate · 7 min · prereq e1 · concepts `filter-cutoff`, `filter-resonance` · source "Synth Studio"

**Objective:** By the end you can recreate a filter setting by ear when both CUTOFF and RESONANCE have moved.

**Start:** reset, with OSC 2 8' SAW at 4, BEAT +0.5, CUTOFF 1.5 kHz and RESONANCE 2 (`mix_osc1 = 60, mix_osc2 = 40, beat_freq = 0.5, cutoff = 1500, resonance = 20`).

**Steps**
1. **listen** (first win). A `{resonance: 0}` / B `{resonance: 65}`, labels No resonance / RESONANCE 6.5.
2. **predict** `resonance` → 6.5 (`65`). "Turn RESONANCE to 6.5."
   - Q: "With more resonance at the same CUTOFF, the sound will…" [0] ring at the cutoff and lose a little bass ✓ · [1] get darker everywhere · [2] rise in pitch.
   - Why: "Resonance boosts a narrow band at the cutoff, so it rings, and a ladder thins its bass as resonance rises. Overall brightness doesn't drop, and the pitch is unchanged."
   - Principle: "Resonance adds a peak at one frequency; cutoff sets where that peak sits."
3. **match.** setup `{cutoff: 2500, resonance: 10}` · target `{cutoff: 500, resonance: 70}` · controls `['cutoff','resonance']` (23 % and 60 % of travel).
   - Hints: "It rings, and it's darker than now." → "CUTOFF is low-mid; RESONANCE is high but not self-oscillating." → "CUTOFF about 500 Hz, RESONANCE about 7."
4. **match.** setup `{cutoff: 700, resonance: 60}` · target `{cutoff: 3000, resonance: 20}` (21 % and 40 %).
   - Hints: "Brighter and calmer." → "CUTOFF up a couple of octaves; RESONANCE low." → "CUTOFF about 3 kHz, RESONANCE about 2."
5. **quiz.** "A sound is bright overall but whistles at one frequency. Its filter is probably set to…" [0] high CUTOFF and high RESONANCE ✓ · [1] low CUTOFF and no RESONANCE · [2] low CUTOFF and high RESONANCE.
   - Why: "Brightness means a high cutoff, and the whistle is the resonant peak. A low cutoff would sound dark."
6. **match.** setup `{cutoff: 400, resonance: 80}` · target `{cutoff: 1200, resonance: 45}` (16 % and 35 %).
   - Hints: "Less ringing, a little brighter." → "RESONANCE is mid-range; CUTOFF is near 1 kHz." → "CUTOFF about 1.2 kHz, RESONANCE about 4.5."
7. **reflect.** "How do you tell CUTOFF and RESONANCE apart by ear?" Model: "CUTOFF changes how much brightness is left overall, while RESONANCE adds a ringing, whistling peak at a single frequency."

**Review**
- "Raising RESONANCE at a fixed CUTOFF mainly…" [0] adds a peak at the cutoff ✓ · [1] lowers the cutoff · [2] adds sub bass.
- "On the Sub 37, RESONANCE above 7…" [0] makes the filter self-oscillate ✓ · [1] mutes it · [2] changes the slope.
- "A dark sound with a strong whistle has…" [0] low CUTOFF and high RESONANCE ✓ · [1] high CUTOFF and no resonance · [2] high MULTIDRIVE only.

---

## 15. `sub37-e4-three-sections`: Ear, oscillator, drive or envelope?

ear-training · 4 · advanced · 8 min · prereq e2, e3, f1 · concepts `oscillator-waveform`, `gain-staging`, `envelope-decay` (interleaved) · source "Synth Studio"

**Objective:** By the end you can tell apart and recreate changes in three sections at once: OSC 1 WAVE, MULTIDRIVE and AMP EG DECAY.

**Start:**
- reset; CUTOFF 1.2 kHz, RESONANCE 1, MULTIDRIVE 0
- AMP EG: A 1 ms, D 600 ms, S 0, R 300 ms (plucky, so the decay is audible)

`mix_osc1 = 60, cutoff = 1200, resonance = 10, multidrive = 0, aeg_decay = 600, aeg_sustain = 0, aeg_release = 300`

**Steps**
1. **listen** (first win). A `{osc1_wave: 0}` / B `{osc1_wave: 67}`, labels Triangle / Square.
2. **quiz.** "A sound gets buzzier and a bit louder, with new highs, though CUTOFF didn't move. Most likely…" [0] MULTIDRIVE went up ✓ · [1] AMP EG DECAY got longer · [2] OSC 1 OCTAVE went down.
   - Why: "Drive after the filter adds new harmonics and level. DECAY changes how long a note lasts, and OCTAVE changes the pitch."
3. **predict** `aeg_decay` → 200. "Set the AMP EG DECAY to about 200 ms."
   - Q: "Which word best describes the change?" [0] shorter ✓ · [1] darker · [2] thinner.
   - Why: "The AMP EG shapes loudness over time, so a shorter decay shortens the note. Darker would be the filter, and thinner the wave shape."
   - Principle: "Envelopes change time; filters and waves change tone."
4. **match.** setup `{osc1_wave: 33, multidrive: 0, aeg_decay: 600}` · target `{osc1_wave: 67, multidrive: 50, aeg_decay: 200}` · controls `['osc1_wave','multidrive','aeg_decay']` · tolerance 0.1.
   - Hints: "Two things changed the tone and one changed the length." → "The wave is hollower, there's some grit, and notes are shorter." → "WAVE at the square, MULTIDRIVE about 5, DECAY about 200 ms."
5. **match.** setup `{osc1_wave: 100, multidrive: 70, aeg_decay: 400}` · target `{osc1_wave: 0, multidrive: 20, aeg_decay: 1500}` · tolerance 0.1.
   - Hints: "Softer, cleaner and longer." → "A triangle, a little drive, long notes." → "WAVE fully left, MULTIDRIVE about 2, DECAY about 1.5 s."
6. **match.** setup `{osc1_wave: 50, multidrive: 30, aeg_decay: 300}` · target `{osc1_wave: 100, multidrive: 80, aeg_decay: 900}` · tolerance 0.1.
   - Hints: "Thin, nasal and dirty, with longer notes." → "WAVE fully right, MULTIDRIVE high, DECAY near a second." → "Narrow PULSE, MULTIDRIVE about 8, DECAY about 900 ms."
7. **reflect.** "Which of the three was hardest to hear, and why?" Model: "Usually MULTIDRIVE at low settings, because gentle saturation sounds like a small brightness and loudness change rather than obvious distortion."

**Review**
- "Notes got shorter but the tone didn't change. You moved…" [0] AMP EG DECAY ✓ · [1] OSC 1 WAVE · [2] MULTIDRIVE.
- "A hollow tone with only odd harmonics is the…" [0] square ✓ · [1] sawtooth · [2] narrow pulse.
- "New highs appeared although CUTOFF stayed low. Likely cause…" [0] MULTIDRIVE after the filter ✓ · [1] more RESONANCE · [2] a slower attack.

---

## 16. `sub37-sq1-arpeggiator`: The arpeggiator

sequencing · 1 · intermediate · 8 min · prereq f5 · concepts `sequencer-pattern`, `timing-tempo` · source "manual pp.15–16, 40"

**Objective:** By the end you can turn a held chord into a pattern with PATTERN, RANGE, BACK / FORTH, INVERT and LATCH.

**Start:**
- reset; CUTOFF 700 Hz, RESONANCE 2, EG AMT +3
- FILTER EG: D 250 ms, S 0; AMP EG: D 600 ms, S 2, R 300 ms
- arp off, RATE 160 BPM, PATTERN UP, RANGE 0, SYNC off

`cutoff = 700, resonance = 20, filter_eg_amt = 60, feg_decay = 250, feg_sustain = 0, aeg_decay = 600, aeg_sustain = 20, aeg_release = 300, arp_on = false, arp_rate = 160, arp_pattern = 0, arp_range_state = 3, arp_sync = false`

**Steps**
1. **do** `arp_on` → true. "Press the arpeggiator's ON / REST button and hold three keys, a chord." Principle: "An arpeggio plays a chord's notes one at a time instead of together." Explanation: "This is the Sub 37's way to play chords: one voice, many notes in turn."
2. **predict** `arp_pattern` → 1 (DWN). "Turn PATTERN to DWN."
   - Q: "Holding C, E and G with PATTERN on DWN plays…" [0] G, E, C, repeating ✓ · [1] C, E, G, repeating · [2] the notes in random order.
   - Why: "DWN plays held notes from highest to lowest. UP is lowest to highest, and RND is random."
   - Principle: "The order of a chord's notes turns one harmony into different melodies."
3. **do** `arp_pattern` → 2 (ORDR). "Turn PATTERN to ORDR, then press the same three keys in a new order." Principle: "Playing notes in the order you pressed them turns key order into melody."
4. **do** `arp_range_state` → 4 (+1). "Press the RANGE ► button once so +1 is lit." Principle: "Adding an octave repeats the pattern twelve semitones higher, doubling its length."
5. **quiz.** "Three held notes with RANGE +1. How many steps before the pattern repeats?" [0] 6 ✓ · [1] 3 · [2] 4 · [3] 12.
   - Why: "Three notes in the original octave plus the same three an octave up."
6. **predict** `arp_invert` → true (**NEW id**). "Press INVERT."
   - Q: "With RANGE +1 and C-E-G held, INVERT plays…" [0] C, C an octave up, E, E up, G, G up ✓ · [1] the same order reversed · [2] only the top octave.
   - Why: "INVERT plays each note in each octave before moving to the next note (manual p.16). It does nothing at RANGE 0."
   - Principle: "Reordering octaves changes a pattern's contour without changing its notes."
7. **do** `arp_back_fwd` → true. "Press BACK / FORTH." Principle: "Playing a pattern up and then back down gives a smooth rising and falling contour." Explanation: "With END NOTES on ONCE (the default), the top and bottom notes aren't repeated at the turn."
8. **listen.** A `{arp_back_fwd: false}` / B `{arp_back_fwd: true}` (the demo holds C-E-G), labels One way / Back and forth.
9. **do** `arp_latch` → true. "Press LATCH / TIE, play a chord and let go." Principle: "Latch holds the notes, freeing both hands to shape the sound." Explanation: "A chord played after you let go replaces the latched one. Notes added while you still hold keys join the pattern."
10. **challenge.** "While it plays, make the arpeggio tighter and brighter: short notes that still sparkle."
    - Checklist: FILTER EG DECAY ≤ 200 ms · CUTOFF ≥ 600 Hz **or** EG AMT ≥ +3 · AMP EG SUSTAIN ≤ 2 (`≤ 20`).
    - Hints: "Short notes need short envelopes." → "Lower the FILTER EG DECAY and the AMP EG SUSTAIN; keep some brightness." → "FILTER DECAY about 150 ms, CUTOFF about 900 Hz, AMP SUSTAIN 0."
    - Solution: `{feg_decay: 150, cutoff: 900, aeg_sustain: 0, aeg_decay: 250}`.
11. **reflect.** "How is an arpeggiator like a sequencer, and how is it different?" Model: "Both play notes one at a time from a clock, but an arpeggiator takes its notes from the keys you hold, while a sequencer plays notes you stored."

**Review**
- "PATTERN on UP plays held notes…" [0] lowest to highest ✓ · [1] in the order pressed · [2] at random.
- "LATCH keeps the arpeggio playing…" [0] after you let go of the keys ✓ · [1] only while you hold them · [2] one octave higher.
- "INVERT has no effect when RANGE is…" [0] 0 ✓ · [1] +1 · [2] −2. *It works on octave copies.*
- "BACK / FORTH on PATTERN RND…" [0] has no effect ✓ · [1] reverses it · [2] doubles it.

---

## 17. `sub37-sq2-step-sequencer`: The step sequencer, an acid line

sequencing · 2 · advanced · 12 min · prereq sq1, sd1 · concepts `sequencer-pattern`, `glide` · source "manual pp.15–21, 46–47; Moog Quickstart (acid tip)"

**Objective:** By the end you can record a 16-step sequence with rests and ties, then use LEGATO glide so the tied notes slide, which is the classic acid recipe.

**Start:**
- the "Acid Line" sound (presets.md) with **no** sequence: OSC 1 8' SAW at 7, CUTOFF 450 Hz, RESONANCE 7, MULTIDRIVE 4, SLOPE 18 dB, EG AMT +3.5
- FILTER EG: D 180 ms, S 0; AMP EG: D 250 ms, S 8
- arp off; PATTERN UP; GLIDE off; studio tempo 125 BPM; arp SYNC on at 1/16

`mix_osc1 = 70, cutoff = 450, resonance = 70, multidrive = 40, filter_slope = 2, filter_eg_amt = 70, feg_decay = 180, feg_sustain = 0, aeg_decay = 250, aeg_sustain = 80, arp_on = false, arp_pattern = 0, arp_sync = true, arp_clock_div = 16, glide_on = false`

**Steps**
1. **info** (hook, `autoplay` the finished Acid Line). "Here's the goal: a squelchy acid line. The Sub 37 sequencer holds up to 64 steps, and we'll record 16." Principle: "A step sequencer stores notes one step at a time and plays them back from a clock."
2. **do** `arp_pattern` → 5 (REC). "With the arpeggiator off, turn PATTERN to REC." Principle: "In step recording, timing comes from the steps, not from when you press keys." Explanation: "The next key you press erases the old sequence and becomes step 1."
3. **challenge.** "Record 16 steps: keys enter notes, ON / REST adds a rest, and LATCH / TIE ties a note into the next."
   - Checklist: (check against the twin's sequence data) `seq(s).length === 16` · at least one rest `seq(s).some(x => x.rest)` · at least one tie into a *different* note `seq(s).some((x, i) => x.tie && seq(s)[i+1] && seq(s)[i+1].note !== x.note)`.
   - Hints: "Every key press, rest and tie counts as a step." → "ON / REST adds a silent step; LATCH / TIE joins the previous note to the next one." → "Try: C2 · rest · C3 tie C2 · E♭2 · C2 · B♭1 tie C2 · rest · G2 tie G1 · C3 · B♭1 · C2 tie E♭2 · F2."
   - Solution: `data: { seq: 'C2 . C3~ C2 | Eb2 C2 Bb1~ C2 | . G2~ G1 C3 | Bb1 C2~ Eb2 F2' }`.
4. **do** `arp_pattern` → 4 (SEQ). "Turn PATTERN to SEQ." Principle: "Playback mode reads the stored steps instead of the held notes."
5. **do** `arp_on` → true. "Press ON / REST, press ▶ in the top bar, and hold C2." Check: `s.transport.playing && values.arp_on`. Principle: "A synced sequencer needs a running clock; the key you hold sets the key." Explanation: "With REF NOTE on FIRST (the default), the key you press becomes the sequence's first note."
6. **predict** `glide_on` → true. "Press GLIDE ON. LEGATO is lit, TYPE is EXP and TIME is 2." Setup: `glide_legato = true, glide_type = 2, glide_time_panel = 2`.
   - Q: "With LEGATO glide on, which steps will slide?" [0] only steps tied into a different note ✓ · [1] every step · [2] only the rests.
   - Why: "A tie keeps the gate on into the next note, so those two notes overlap. LEGATO glide slides only between overlapping notes, and the manual adds that the tied note doesn't retrigger the envelopes. The other steps jump and re-attack."
   - Principle: "Overlapping notes plus legato glide give slides only where you want them."
7. **quiz.** "A tie into the *same* note as the previous step…" [0] doubles that note's length ✓ · [1] slides it up an octave · [2] mutes the step.
   - Why: "A tie into the same pitch just holds the note through the next step."
8. **listen.** A `{glide_on: false}` / B `{glide_on: true}`, labels No glide / Legato glide.
9. **challenge.** "Make the squelch more extreme while it plays, without letting the filter whistle on its own."
   - Checklist: RESONANCE between 6.5 and 7 (`65–70`, just under self-oscillation) · EG AMT ≥ +3.5 (`≥ 70`) · FILTER EG DECAY ≤ 250 ms.
   - Hints: "The squelch is resonance plus a strong, short filter envelope." → "Push EG AMT and keep RESONANCE just under 7." → "RESONANCE about 6.8, EG AMT +4.5, DECAY about 170 ms."
   - Solution: `{resonance: 68, filter_eg_amt: 90, feg_decay: 170}`.
10. **reflect.** "Why do ties plus LEGATO glide create acid slides?" Model: "A tie keeps the gate on into the next note, so the notes overlap, and legato glide only slides between overlapping notes. So exactly the tied steps slide, without re-triggering the envelopes."

**Review**
- "To record a step sequence, set PATTERN to…" [0] REC, with the arp off ✓ · [1] SEQ · [2] ORDR.
- "In step recording, the ON / REST button…" [0] adds a silent step ✓ · [1] stops recording · [2] deletes a step.
- "Tying into a different note…" [0] changes pitch without retriggering the envelopes ✓ · [1] restarts the envelopes · [2] mutes it.
- "How many steps can a Sub 37 sequence hold?" [0] 64 ✓ · [1] 16 · [2] 32.

---

## 18. `sub37-p1-wheels-glide-latch`: Performance with wheels, glide and latch

performance · 1 · intermediate · 9 min · prereq f7 · concepts `glide`, `modulation-depth`, `velocity-dynamics` · source "manual pp.21–23, 31–33, 42"

**Objective:** By the end you can play expressively with the PITCH and MOD wheels, choose a glide type for a phrase, and hold a drone with LATCH ON.

**Start:** the "Vintage Saw Lead" sound (presets.md) with glide off and bend ±2: OSC 1 and OSC 2 8' SAW, MOD 1 TRI 5.5 Hz with PITCH AMT +0.35, MOD wheel 0.

`osc1_wave = 33, osc2_wave = 33, osc2_frequency = -0.1, mix_osc1 = 65, mix_osc2 = 65, cutoff = 1400, resonance = 30, filter_eg_amt = 40, mod1_rate = 5.5, mod1_pitch_amt = 7, mod_wheel = 0, glide_on = false, bend_up = 2, bend_down = 2`

**Steps**
1. **do** `pitch_bend` → +100. "Push the PITCH wheel fully up while holding a note, then let it spring back." Principle: "Pitch bend slides the note smoothly; the bend range sets how far it goes." Explanation: "On the Sub 37, BEND UP and BEND DOWN are set separately in the preset menu, 0–24 semitones each, and default to 2. BEND DEST chooses which oscillators bend."
2. **quiz.** "With a ±2 semitone range, bending fully up from C reaches…" [0] D ✓ · [1] C♯ · [2] E · [3] the C an octave up.
   - Why: "Two semitones above C is D. C♯ would be one semitone."
3. **do** `mod_wheel` → 50. "Push the MOD wheel up to about halfway on a long note." Principle: "Vibrato added only to long notes sounds human; constant vibrato sounds mechanical." Explanation: "The wheel scales MOD 1, which carries a 5.5 Hz triangle into both oscillators' pitch."
4. **do** `glide_on` → true. "Press GLIDE ON and play two notes far apart." Principle: "Glide limits how fast the pitch can change, so notes slide into each other."
5. **predict** `glide_type` → 0 (LCR). "Set glide TYPE to LCR. Play a semitone, then a two-octave leap."
   - Q: "LCR is linear constant rate. Compared with the semitone, the two-octave glide takes…" [0] much longer ✓ · [1] the same time · [2] less time.
   - Why: "A constant rate means a fixed speed, so a bigger interval takes longer. LCT (constant time) would give both leaps the same time."
   - Principle: "Constant-rate glides take longer for bigger leaps; constant-time glides don't."
6. **do** `glide_type` → 2 (EXP). "Set TYPE to EXP." Principle: "Exponential glide moves fast at first, then eases into the note, like a singer."
7. **do** `glide_legato` → true. "Press LEGATO, then play detached notes, then overlapping ones." Principle: "Legato glide lets you choose per note: overlap to slide, lift to jump."
8. **do** `glide_on` → false. "Press GLIDE ON again to turn glide off."
9. **do** `aeg_latch` → true. "Press the AMP EG LATCH ON button, then play one low note and let go." Principle: "Holding an amplifier gate open turns any note into a drone." Explanation: "LATCH ON keeps the AMP EG at its SUSTAIN level as if the key were still held. It is also how you pass EXT IN audio without holding a key."
10. **challenge.** "Perform a four-bar phrase over the drone: one note bent up into pitch, one long note with vibrato, and one slide."
    - Checklist: GLIDE ON and LEGATO lit (to slide) · AMP EG LATCH ON lit · MOD 1 PITCH AMT > 0.
    - Hints: "The drone holds; your right hand plays on top." → "Turn glide back on with LEGATO; use the MOD wheel on the long note; bend into one note." → "Start a semitone below a note and bend up into it."
    - Solution: `{glide_on: true, glide_legato: true, glide_type: 2, aeg_latch: true}`.
11. **do** `aeg_latch` → false. "Press LATCH ON again to release the drone."
12. **reflect.** "Which glide type would you choose for a singing lead, and why?" Model: "EXP, because it moves quickly and then eases into the note the way a voice does, and with LEGATO I decide which notes slide."

**Review**
- "The Sub 37's default bend range is…" [0] ±2 semitones ✓ · [1] ±12 · [2] ±7. *Adjustable 0–24 each way.*
- "LCR glide on a big leap compared with a small one…" [0] takes longer ✓ · [1] takes the same time · [2] doesn't glide.
- "LATCH ON on the AMP EG makes notes…" [0] hold at SUSTAIN after release ✓ · [1] stop instantly · [2] glide.
- "LEGATO glide slides only when…" [0] the next key goes down while the previous one is still held ✓ · [1] you play staccato · [2] the arpeggiator runs.

---

## 19. `sub37-st1-arp-sync`: Sync the arpeggiator to the studio

studio · 1 · intermediate · 7 min · prereq sq1 · requires — (the studio transport is the MIDI clock) · concepts `timing-tempo`, `sequencer-pattern` · source "manual pp.15, 37, 52"

**Objective:** By the end you can lock the Sub 37's arpeggiator to the studio tempo with SYNC, choose clock divisions, and start it with the studio's Play.

**Start:** the "Robot Arp" pluck (presets.md) with arp **ON** and **LATCH** lit; PATTERN UP; RANGE +1; SYNC off; RATE 160 BPM; studio stopped at 120 BPM. (`arp_on = true, arp_latch = true, arp_pattern = 0, arp_range_state = 4, arp_sync = false, arp_rate = 160`)

**Steps**
1. **info.** "Free-running, the arpeggiator follows its own RATE knob. In a track it must follow the studio clock, which reaches the Sub 37 as MIDI clock." Principle: "Two clocks drift apart; one shared clock keeps every part on the beat." Explanation: "MIDI clock sends 24 ticks per quarter note, plus start and stop."
2. **do** (check). "In the Studio tab, make sure 'Sync to studio clock' is ticked for the Sub 37." Check: `s => s.sync[instanceOf(s, 'sub37')] !== false`. Principle: "A synced instrument takes its tempo from the leader."
3. **predict** `arp_sync` → true (**NEW id**). "Press the arpeggiator's SYNC / TAP button so SYNC is lit, then hold a chord."
   - Q: "SYNC is lit but the studio isn't playing. What does the arpeggiator do?" [0] waits silently for clock ✓ · [1] plays at its own RATE · [2] plays one note and stops.
   - Why: "With SYNC on, and outside tap-tempo mode, the arpeggiator won't play without incoming MIDI clock. The RATE knob now picks a clock division instead of a tempo."
   - Principle: "A follower waits for the leader's clock before it moves."
4. **do** `arp_clock_div` → 16 (1/16) (**NEW id**). "Turn the arpeggiator's RATE knob until the display shows 1/16." Principle: "With sync on, a rate knob chooses a note value rather than a speed."
5. **challenge.** "Press ▶ in the top bar, play a chord, and set the studio to 120 BPM."
   - Checklist: `s.transport.playing` · `Math.abs(s.transport.bpm - 120) < 1` · `values.arp_on === true`.
   - Hints: "The play button and tempo are in the top bar." → "Latch is lit, so one chord keeps playing."
6. **quiz.** "At 120 BPM with the arpeggiator on 1/16, how many notes play per second?" [0] 8 ✓ · [1] 2 · [2] 4 · [3] 16.
   - Why: "120 BPM is 2 beats a second, and 1/16 is 4 notes per beat: 2 × 4 = 8."
7. **do** `arp_clock_div` → 15 (1/8 T). "Turn RATE to 1/8 T." Principle: "Triplets fit three notes into the time of two, rolling across the beat." Explanation: "Against a four-on-the-floor beat, three against two adds a rolling swing."
8. **listen.** A `{arp_clock_div: 16}` / B `{arp_clock_div: 15}`, labels 1/16 / 1/8 triplet (the studio is playing).
9. **reflect.** "Why does the arpeggiator wait silently with SYNC on until the studio plays?" Model: "With SYNC on, it takes its timing from incoming MIDI clock and the RATE knob only picks a note value, so without clock there is nothing to step it."

**Review**
- "With arp SYNC lit, the RATE knob…" [0] selects a clock division ✓ · [1] sets BPM · [2] sets the gate length.
- "MIDI clock runs at…" [0] 24 ticks per quarter note ✓ · [1] 4 per beat · [2] 1 per bar.
- "1/16 at 120 BPM gives…" [0] 8 notes per second ✓ · [1] 4 · [2] 16.
- "On the Sub 37, which sections have their own SYNC switch?" [0] the arpeggiator, both LFOs and both envelopes ✓ · [1] only the arpeggiator · [2] only the LFOs.

---

## 20. `sub37-st2-rytm-bassline`: A bassline under the Analog Rytm

studio · 2 · advanced · 12 min · prereq st1, sq2 · requires `['analog-rytm']` · concepts `sequencer-pattern`, `mixing`, `timing-tempo` · source "Synth Studio; manual pp.17, 27, 33"

**Objective:** By the end you can program a Sub 37 bassline that locks to the Analog Rytm's kick and sits under it in the mix.

**Start:**
- the "Three-Osc Mono Bass" sound (presets.md) with an empty sequence; arp SYNC on at 1/16
- the Rytm loaded with its Techno kit at 125 BPM, but with **no** kick trigs (`bd_pattern` empty)

**Steps**
1. **info.** "A kick and a bassline share the low end. They need to agree in time (one clock) and in space (pitch and length)." Principle: "Two sounds in the same frequency range mask each other unless they take turns."
2. **challenge** (instance `analog-rytm`). "On the Analog Rytm, put kick trigs on steps 1, 5, 9 and 13: four on the floor."
   - Checklist: `['1','1','1','1'].every((c, k) => dv(s, 'analog-rytm').bd_pattern[k * 4] === c)`.
   - Hints: "The kick is the BD track." → "Turn on BD steps 1, 5, 9 and 13." → "The pattern reads 1000100010001000."
3. **do** (check). "In the Studio tab, tick 'Sync to studio clock' for both the Sub 37 and the Rytm." Check: `['sub37','analog-rytm'].every(d => s.sync[instanceOf(s, d)] !== false)`. Principle: "Instruments on one clock stay locked, even when the tempo changes."
4. **challenge.** "Record a 16-step off-beat bassline (PATTERN REC), with rests on steps 1, 5, 9 and 13 and notes elsewhere."
   - Checklist: `[0, 4, 8, 12].every(i => seq(s)[i]?.rest)` · `seq(s).filter(x => !x.rest).length >= 4` · `seq(s).length === 16`.
   - Hints: "House basslines often sit between the kicks." → "Put rests on the kick's steps." → "Try notes on steps 3, 7, 11 and 15, with a pickup on 16."
   - Solution: `data: { seq: '. . C2 . | . . C2 . | . . C2 . | . . C2 Eb2' }`.
5. **predict** (check `s.transport.playing`). "Turn PATTERN to SEQ, press ON / REST and hold C2 (or latch it), then press ▶."
   - Q: "Both instruments follow the studio clock. If you change the tempo while they play, the bassline will…" [0] stay locked to the kick ✓ · [1] drift away from the kick · [2] stop.
   - Why: "Both read the same clock, so every tempo change reaches both together."
   - Principle: "Shared timing keeps parts together at any tempo."
6. **quiz.** "The kick's weight sits around 50 Hz. The best first move to stop the bass masking it is…" [0] keep bass notes short and off the kick's steps ✓ · [1] raise the bass RESONANCE to 9 · [2] turn the bass VOLUME up · [3] add NOISE.
   - Why: "Taking turns in time is the cleanest way to share the low end. More resonance or level makes the clash worse."
7. **do** `aeg_sustain` → 3 (`30`). "Set the AMP EG SUSTAIN to 3." Principle: "Shorter bass notes leave room for the kick to hit cleanly."
8. **do** `aeg_decay` → 250. "Set the AMP EG DECAY to about 250 ms."
9. **do** `mix_sub` → 2 (`20`). "Turn SUB OSC down to 2: the kick already owns the deepest octave." Principle: "Leaving the lowest octave mostly to one instrument keeps the low end clear."
10. **listen.** A `{mix_sub: 40, aeg_sustain: 90}` / B `{mix_sub: 20, aeg_sustain: 30}`, labels Clashing / Making room (with the Rytm playing).
11. **challenge** (open). "Balance the two so the kick is the loudest thing in the low end and the bass sits just under it."
    - Checklist: transport playing · (generous) the Sub 37 VOLUME isn't maxed (`values.master_volume <= 85`).
    - Hints: "Listen at a low volume; the loudest low sound wins." → "Turn the Sub 37 down until the kick punches through."
12. **reflect.** "How did you make room for both the kick and the bass?" Model: "I put both on one clock, placed the bass notes between the kicks, kept them short, and left the deepest octave mostly to the kick."

**Review**
- "A bassline between the kicks is called…" [0] an off-beat bass ✓ · [1] a sidechain · [2] a drone.
- "Two instruments that follow one clock…" [0] stay in time when the tempo changes ✓ · [1] drift · [2] must be muted.
- "Shorter AMP EG DECAY on the bass helps the kick because…" [0] the bass stops before the next kick ✓ · [1] it gets louder · [2] it raises the pitch.

---

## Implementation notes for these lessons

**Controls the lessons need beyond today's `spec.ts`:**
- `osc2_kb_mode` (HI/LO/OFF)
- `mod2_dest` (7 positions)
- bipolar `modN_*_amt`
- `arp_pattern` (6 positions incl. SEQ/REC), `arp_range_state` (7), `arp_invert`, `arp_sync`, `arp_clock_div`
- `feg_hold` / `feg_delay` with KNOB SHIFT (already present)
- `kb_priority`, `bend_up` / `bend_down`
- `filter_kb_amt` widened to 0–200 %
- `aeg_latch` relabelled LATCH ON
- a **sequencer data model** that `seq(s)` can read: steps of `{note, note2?, rest, tie, velocity, ratchet, skip}`

**Checks:**
- `instanceOf` and `dv` follow `lib/studio/lessons.ts` and `devices/dfam/lessons.ts`.
- The Rytm kick is `bd_pattern` (16-character string) in `devices/analog-rytm/spec.ts`.

**Velocity:** on-screen keys play at full velocity, so no step relies on hearing VEL AMT. Lesson 6 says so.

**Match tolerance:** the defaults follow PEDAGOGY:
- easy matches move ≥ 20 % of knob travel per control on the twin's own curves: CUTOFF 10 octaves over the knob, time knobs 4 decades, LFO RATE 3 decades.
- the fine ear lessons (13, 15) use tolerances of 0.05–0.1 as written.

**Manual references:** page numbers apply to both the Sub 37 v1.1 and Subsequent 37 manuals, which share text and pagination. Lesson prose is original, and the manuals inform only the facts (scratchpad `manuals/COPYRIGHT-RULES.md`).
