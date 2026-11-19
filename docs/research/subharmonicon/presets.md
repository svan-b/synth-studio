# Moog Subharmonicon: presets (v2, recreated from Moog’s own patch sheets)

**v2** replaces v1. The coordinator supplied Moog’s documents, so these presets are rebuilt from the real patch sheets:

- **MAN**: *Owner’s Manual*. Its 10 presets are on MAN p.44–48; the four-patch list in v1 was incomplete.
- **XPB**: *Exploration Patchbook*, the “book of 10 patches” released alongside PWI.
- **PWI**: *Patching with Intention*, with its initialized patch and five exercises.

Page numbers are PDF pages (the `text.txt` markers); XPB patch n is on PDF page n+2. Hardware behaviour is in `signal-flow.md` (v2).

## How these were read, and how accurate they are

| Source | Method | Accuracy |
|---|---|---|
| XPB (10 patches) | Pointer angles measured automatically from 250 dpi renders, using each sheet’s accent-coloured pointer lines, with knob centres calibrated across all ten sheets. Buttons, LEDs and wave switches read from fill colour. Cables traced by eye on zoomed patch-bay crops (pass-overs excluded) | continuous knobs ±2 % of travel. Stepped knobs = nearest detent; where a pointer sits between detents (the artist did not snap them), the preset says so |
| MAN (10 presets) | Read by eye from 300 dpi renders of the black-and-white sheets, one third of the panel at a time | ±3–5 % of travel; stepped knobs ±1 detent where flagged |
| PWI init + exercises | Init read by eye at 300 dpi; exercises applied as the guide’s text describes | the init is exact; step values Moog does not give are ours (marked) |

**Sheet conventions:**

- A lit button is filled (black on MAN sheets, coloured on XPB).
- The wave switch shows its position by circling the chosen symbol.
- An **arc with arrowheads** around a knob marks a performance control: sweep it while playing.

The sheets give knob positions only. The real units below use the tapers in `signal-flow.md` §14, plus one new finding:

> **TEMPO taper (new, likely).** Read through a log 20–3000 BPM taper, almost every Moog sheet would step its sequencers at 5–30 BPM (Bateria’s ÷4 kick would land at 11 BPM). Read **linearly** (0.333 Hz + p × 49.67 Hz, i.e. BPM = 20 + 2980·p), every sheet lands at a musical rate: Bateria’s ÷4 at about 129 BPM, and Shuffled Subs’ ÷8 at about 140 BPM. These presets use the linear model, and the twin’s TEMPO knob should be linear in Hz. EG times and CUTOFF, by contrast, only make sense on log tapers (Bateria needs a 20 ms decay and an 80 Hz cutoff), so those stay log.

**Copyright.** Preset names are descriptive and our own; Moog’s titles appear only in the *Source* line (`manuals/COPYRIGHT-RULES.md` rule 5). Descriptions are original.

## Conventions for the settings

- Knob position is given in **% of travel** (0 = fully CCW, 50 = noon, 100 = fully CW), followed by the real unit.
- VCO FREQ is snapped to the active scale grid, anchored at C (signal-flow §3.1).
- STEP values are % of the SEQ OCT range, the twin’s storage unit. For OSC-assigned sequencers the resulting notes are listed.
- TS `settings` use the current twin ids:
  - `D(n)` = divide by n.
  - `vcoN_wave`: 0/1/2 = UP/MIDDLE/DOWN.
  - `seq_oct`: 0/1/2 = ±1/±2/±5. `quantize`: 0–4 = OFF/12-ET/8-ET/12-JI/8-JI.
  - `eg_mode`: 0/1/2 = OFF/ON/HELD. `rhythm_logic`: 0/1 = OR/XOR.
  - `tempo` in BPM (linear model); times in ms (log model); `cutoff` in Hz (log model).
- Every preset lists **all** values, with no reliance on defaults. PLAY is not stored: press it, unless the preset says PLAY IN runs the transport.
- VOLUME: the MAN sheets show it near maximum (a Eurorack-level output), so calibrate the twin so that 99 % does not clip the studio bus. The XPB sheets show noon with an arc, meaning “to taste”.

## Index

| # | Category / Name | Source | Cables |
|---|---|---|---|
| 1 | Tutorial / Initialized Patch | PWI p.3 (the same as the MAN p.11 start settings, which show EG and PLAY off and VOLUME at minimum) | — |
| 2 | Tutorial / First Sequence | PWI p.4 | — |
| 3 | Tutorial / Sequencer Transposes Sequencer | PWI p.5 | out_seq2 → in_vco1 |
| 4 | Tutorial / Sequenced Filter Drums | PWI p.6 | out_seq2 → in_cutoff |
| 5 | Tutorial / Sub-Modulated Drum Machine | PWI p.7 | out_seq2 → in_cutoff, out_vco1_sub1 → in_rhythm2, out_vco1_sub2 → in_rhythm1 |
| 6 | Tutorial / Envelope-Accelerated Clock | PWI p.8–10 | out_vco2_sub1 → in_clock, out_vcf_eg → in_vco2_sub, out_vco2_sub2 → in_play |
| 7 | Tutorial / First Polyrhythm | MAN p.11–15 (Exploring, Creating A Sequence, Creating A Polyrhythm) | — |
| 8 | Chords / Bubbling Sub Chords | MAN p.44, ‘Aquatic Chords’ | out_seq1 → in_cutoff, out_clock → in_trigger |
| 9 | Arp / Hand-Faded Harmony Arp | MAN p.44, ‘Mellow Harmonies’ | out_seq1 → in_cutoff, out_seq1_clk → in_trigger |
| 10 | Rhythm / Self-Tripping Cross-Sequence | MAN p.45, ‘Slip & Fall’ | out_seq2 → in_vco1, out_seq1 → in_vco2, out_vca_eg → in_rhythm2, out_vcf_eg → in_rhythm1, out_seq1_clk → in_trigger |
| 11 | Pad / Driven Pulse Swell | MAN p.45, ‘Point Zero’ | out_seq1 → in_vco1_pwm, out_seq2 → in_cutoff |
| 12 | Lead / Two-Sequencer Line | MAN p.46, ‘Three Hands on the Wheel’ | out_seq1 → in_vco2, out_seq2 → in_cutoff |
| 13 | Drums / Filter-Ping Kit | MAN p.46, ‘Bateria’ | out_seq1 → in_rhythm1, out_seq2 → in_rhythm2, out_seq1_clk → in_cutoff, out_seq2_clk → in_vca |
| 14 | Texture / Accelerating Spiral | MAN p.47, ‘Spiral Ways’ | out_vcf_eg → in_rhythm1 |
| 15 | Texture / Percolating High Clusters | MAN p.47, ‘Star-Gate’ | out_seq1 → in_cutoff, out_seq2 → in_vco1_pwm |
| 16 | Groove / Polyrhythm Chord Stabs | MAN p.48, ‘Poly Rock’ | out_vca_eg → in_cutoff |
| 17 | Pad / Slow-Bloom Duet | MAN p.48, ‘Cloud Path’ | out_vca_eg → in_cutoff, out_vcf_eg → in_rhythm3 |
| 18 | Percussion / Clinking Sub Clatter | XPB p.3 (patch 1), ‘Music for Washing Dishes’ | out_seq2 → in_cutoff |
| 19 | Bass / Shuffled Sub Bassline | XPB p.4 (patch 2), ‘Shuffled Subs’ | out_seq1 → in_vco2, out_seq2 → in_cutoff |
| 20 | Texture / Eerie Fourths in Pulse | XPB p.5 (patch 3), ‘Nosferatu’s Flotation Tank’ | out_seq1 → in_vca, out_vcf_eg → in_rhythm1, out_seq2 → in_rhythm3 |
| 21 | FX / Buzzing Cross-Mod Swarm | XPB p.6 (patch 4), ‘Transistor Insects’ | out_vco2_sub2 → in_vco1, out_vco1_sub2 → in_vco2, out_vco1 → in_rhythm4 |
| 22 | Melody / Undertone Step Dance | XPB p.7 (patch 5), ‘Neon Cactus Tips Their Cap’ | out_seq1 → in_rhythm1, out_seq2 → in_vco2_pwm, out_seq2_clk → in_trigger |
| 23 | FX / Tone and Breath Duet | XPB p.8 (patch 6), ‘Duet for Tone and Wind’ | out_seq1 → in_vco2_pwm, out_vco2 → in_clock |
| 24 | Rhythm / Sub-Gated Dial Tones | XPB p.9 (patch 7), ‘Touchtone Wiretap’ | out_vco1_sub1 → in_play, out_vca_eg → in_vco2, out_vco1_sub2 → in_cutoff, out_seq2 → in_vco1_pwm |
| 25 | Rhythm / Marching Sub Clicks | XPB p.10 (patch 8), ‘Ant Parade’ | out_clock → in_vco1, out_seq2 → in_vco1_sub |
| 26 | Bass / Octave-Shifting Fuzz | XPB p.11 (patch 9), ‘Octave Fuzz’ | out_seq2 → in_vco1, out_vco1_sub1 → in_vca |
| 27 | FX / Folded High Chimes | XPB p.12 (patch 10), ‘Aliased Wind Chimes’ | out_vca_eg → in_rhythm3, out_vco2_sub1 → in_rhythm4, out_seq1_clk → in_cutoff |
| 28 | Just Intonation / Major Lattice | our design, using the manual’s just C-major ratios (MAN p.16) and the quantized VCO FREQ knob (MAN p.17) | — |
| 29 | Just Intonation / Same Chord in 12-ET | our design (the A/B partner of Major Lattice) | — |
| 30 | Drone / Undertone Minor | our design (the MAN p.10 undertone table) | — |
| 31 | Polyrhythm / Hemiola 2+3 (OR) | our design (the MAN p.43 rhythm logic) | — |
| 32 | Polyrhythm / Missing Downbeat (XOR) | our design (the MAN p.43 rhythm logic) | — |
| 33 | Polyrhythm / 3 Against 4 | our design (MAN p.14 and p.29) | — |
| 34 | Bass / Square Sub Bass | our design (a common community technique) | — |

## Presets

### 1. Tutorial / Initialized Patch

*Source:* PWI p.3 (the same as the MAN p.11 start settings, which show EG and PLAY off and VOLUME at minimum) · *Type:* Moog sheet, exact

Moog’s reset state. All four RHYTHM knobs are at ÷1 and none is assigned, so nothing triggers: the patch stays silent until a rhythm generator is assigned to a sequencer. Every PWI exercise starts here.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 80 % → 5.02 kHz · RESONANCE 0 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±5 · QUANTIZE OFF · SEQ 1 ASSIGN none · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷1 (unassigned) · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
init: {
  name: 'Tutorial / Initialized Patch',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 5024, resonance: 0, vcf_eg_amt: 60, vcf_attack: 1.0, vcf_decay: 31.0, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 2, quantize: 0, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 0, seq1_step3: 0, seq1_step4: 0,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(1), rhythm1_seq1: false, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 1,
  },
},
```

### 2. Tutorial / First Sequence

*Source:* PWI p.4 · *Type:* Moog exercise (text); step values ours

The guide’s first exercise. RHYTHM 1 drives Sequencer 1 and RHYTHM 2 drives Sequencer 2; TEMPO goes down to about 9 o’clock; SEQ OCT moves from ±5 to ±1; QUANTIZE is 12-ET. The guide first patches SEQ 1 → VCO 1, then removes the cable and lights OSC 1, which does the same internally.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 80 % → 5.02 kHz · RESONANCE 0 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C6 E♭6 G6 F6 |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷1 → SEQ 1 · RHYTHM 2 ÷1 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
pwi_first: {
  name: 'Tutorial / First Sequence',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 5024, resonance: 0, vcf_eg_amt: 60, vcf_attack: 1.0, vcf_decay: 31.0, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(1), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
},
```

### 3. Tutorial / Sequencer Transposes Sequencer

*Source:* PWI p.5 · *Type:* Moog exercise (text); step values ours

SEQ 2 OUT goes into VCO 1 IN while OSC 1 stays lit, so VCO 1 hears both sequencers added together. With RHYTHM 1 fully CW (÷1) and RHYTHM 2 fully CCW (÷16), Sequencer 1 plays its phrase four times before Sequencer 2 steps and transposes it. Two 4-step sequencers make a 16-step line.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 80 % → 5.02 kHz · RESONANCE 0 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C6 E♭6 G6 F6 |
| SEQ 2 steps | +0 % (+0.00 V) · -42 % (-0.42 V) · -17 % (-0.17 V) · +17 % (+0.17 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷1 → SEQ 1 · RHYTHM 2 ÷16 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_vco1` |

```ts
pwi_intertwine: {
  name: 'Tutorial / Sequencer Transposes Sequencer',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 5024, resonance: 0, vcf_eg_amt: 60, vcf_attack: 1.0, vcf_decay: 31.0, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 0, seq2_step2: -42, seq2_step3: -17, seq2_step4: 17,
    rhythm1: D(1), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(16), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_vco1' }],
},
```

### 4. Tutorial / Sequenced Filter Drums

*Source:* PWI p.6 · *Type:* Moog exercise (text); resonance, decay and step values ours

SEQ 2 moves from VCO 1 to CUTOFF IN. With CUTOFF down at about 9 o’clock, more RESONANCE and a shorter VCF DECAY, each step becomes a tuned, percussive hit, closer to a drum machine than a melody.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 20 % → 80 Hz · RESONANCE 75 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 5 % → 7 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C6 E♭6 G6 F6 |
| SEQ 2 steps | +100 % (+1.00 V) · -50 % (-0.50 V) · +60 % (+0.60 V) · -100 % (-1.00 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷1 → SEQ 1 · RHYTHM 2 ÷16 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_cutoff` |

```ts
pwi_rhythm: {
  name: 'Tutorial / Sequenced Filter Drums',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 80, resonance: 75, vcf_eg_amt: 60, vcf_attack: 1.0, vcf_decay: 7.3, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 100, seq2_step2: -50, seq2_step3: 60, seq2_step4: -100,
    rhythm1: D(1), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(16), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_cutoff' }],
},
```

### 5. Tutorial / Sub-Modulated Drum Machine

*Source:* PWI p.7 · *Type:* Moog exercise (text); sub divisors ours

The previous patch plus VCO 1 SUB 1 → RHYTHM 2 IN (with RHYTHM 2 near the middle) and VCO 1 SUB 2 → RHYTHM 1 IN. The subs act as LFO-like modulators of the clock divisions; the SUB FREQ knobs now reshape the groove instead of the pitch.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷12 (F2 -2c) · SUB 2 ÷16 (C2) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 20 % → 80 Hz · RESONANCE 75 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 5 % → 7 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C6 E♭6 G6 F6 |
| SEQ 2 steps | +100 % (+1.00 V) · -50 % (-0.50 V) · +60 % (+0.60 V) · -100 % (-1.00 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷1 → SEQ 1 · RHYTHM 2 ÷8 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_cutoff`, `out_vco1_sub1` → `in_rhythm2`, `out_vco1_sub2` → `in_rhythm1` |

```ts
pwi_drums: {
  name: 'Tutorial / Sub-Modulated Drum Machine',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(12), vco1_sub2_freq: D(16), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 80, resonance: 75, vcf_eg_amt: 60, vcf_attack: 1.0, vcf_decay: 7.3, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 100, seq2_step2: -50, seq2_step3: 60, seq2_step4: -100,
    rhythm1: D(1), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_cutoff' }, { from: 'out_vco1_sub1', to: 'in_rhythm2' }, { from: 'out_vco1_sub2', to: 'in_rhythm1' }],
},
```

### 6. Tutorial / Envelope-Accelerated Clock

*Source:* PWI p.8–10 · *Type:* Moog exercise (text); step values ours

VCO 2’s SUB 1 becomes the master clock (VCO 2 FREQ and SUB 1 FREQ fully CCW gives 16 Hz). The VCF EG patched into VCO 2 SUB makes every envelope speed the clock up. VCO 2 SUB 2 → PLAY IN stops and starts the sequencer, and 8-ET keeps the result diatonic.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷16 (C0) · SUB 2 ÷8 (C1) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 80 % → 5.02 kHz · RESONANCE 0 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 50 % → 100 ms · VCF DECAY 0 % → 5 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±5 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +12 % (+0.60 V) · +17 % (+0.85 V) · +5 % (+0.25 V) → C6 G6 B6 D6 |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷8 → SEQ 1 · RHYTHM 2 ÷1 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vco2_sub1` → `in_clock`, `out_vcf_eg` → `in_vco2_sub`, `out_vco2_sub2` → `in_play` |
| Reading notes | How strongly the envelope accelerates the clock depends on the SUB-CV scaling (a twin guess, signal-flow §14). |

```ts
pwi_envclock: {
  name: 'Tutorial / Envelope-Accelerated Clock',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 261.63, vco2_sub1_freq: D(16), vco2_sub2_freq: D(8), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 5024, resonance: 0, vcf_eg_amt: 60, vcf_attack: 100.0, vcf_decay: 5.0, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 2, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 12, seq1_step3: 17, seq1_step4: 5,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(8), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vco2_sub1', to: 'in_clock' }, { from: 'out_vcf_eg', to: 'in_vco2_sub' }, { from: 'out_vco2_sub2', to: 'in_play' }],
},
```

### 7. Tutorial / First Polyrhythm

*Source:* MAN p.11–15 (Exploring, Creating A Sequence, Creating A Polyrhythm) · *Type:* Moog tutorial (text); step and divisor values ours

The owner’s-manual tour, from its start settings:

1. VCO 1 LEVEL to half; QUANTIZE 12-ET; mix in SUB 1.
2. Assign OSC 1 and RHYTHM 1 → SEQ 1; SEQ OCT ±2; RESET.
3. Tune the four steps with NEXT while EG is held.
4. EG ON, then PLAY.
5. Add RHYTHM 2 to Sequencer 1: it is now a polyrhythm.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷2 (C5) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 40 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 80 % → 5.02 kHz · RESONANCE 0 % · VCF EG AMT 65 % → +30 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 24 % → 31 ms · VOLUME 50 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +12.5 % (+0.25 V) · +29 % (+0.58 V) · +42 % (+0.84 V) → C6 E♭6 G6 B♭6 |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 20 % → 616 BPM (10.3 Hz master pulse) · RHYTHM 1 ÷4 → SEQ 1 · RHYTHM 2 ÷3 → SEQ 1 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
man_tutorial: {
  name: 'Tutorial / First Polyrhythm',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(2), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 40, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 5024, resonance: 0, vcf_eg_amt: 30, vcf_attack: 1.0, vcf_decay: 31.0, vca_attack: 1.0, vca_decay: 31.0, volume: 50,
    seq_oct: 1, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 12.5, seq1_step3: 29, seq1_step4: 42,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(4), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(3), rhythm2_seq1: true, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 616, rhythm_logic: 0, eg_mode: 1,
  },
},
```

### 8. Chords / Bubbling Sub Chords

*Source:* MAN p.44, ‘Aquatic Chords’ · *Type:* Moog patch sheet (knobs read from the drawing)

EG is OFF and CLOCK OUT is patched to TRIGGER IN, so every master pulse plucks both envelopes. Meanwhile the two sequencers, on ÷4 and ÷5, change the sub-rich chords underneath, and SEQ 1 also moves the cutoff. The result is a dark, bubbling chord texture.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 66.5 % → 1.57 kHz (G6) · SUB 1 ÷5 (E♭4 +14c) · SUB 2 ÷4 (G4) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷9 (B♭2 -4c) · SUB 2 ÷3 (F4 -2c) · WAVE UP (all square) |
| Mixer | VCO 1 44 % · SUB 1 53 % · SUB 2 54 % ‖ VCO 2 55 % · SUB 1 47 % · SUB 2 50 % |
| VCF | CUTOFF 30 % → 159 Hz · RESONANCE 25 % · VCF EG AMT 74.5 % → +49 % |
| EGs | VCF ATTACK 33 % → 21 ms · VCF DECAY 18 % → 20 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 34 % → 66 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -34 % (-0.34 V) · +19 % (+0.19 V) · -53 % (-0.53 V) · +0 % (+0.00 V) → E6 B6 D6 G6 |
| SEQ 2 steps | -40 % (-0.40 V) · -100 % (-1.00 V) · -74 % (-0.74 V) · -41 % (-0.41 V) → G5 C5 E5 G5 |
| Rhythm | TEMPO 13 % → 407 BPM (6.8 Hz master pulse) · RHYTHM 1 ÷4 → SEQ 1 · RHYTHM 2 ÷5 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG OFF · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_cutoff`, `out_clock` → `in_trigger` |
| Reading notes | The sheet notes that the sequencer pitches are suggestions. |

```ts
man_aquatic: {
  name: 'Chords / Bubbling Sub Chords',
  settings: {
    vco1_freq: 1567.98, vco1_sub1_freq: D(5), vco1_sub2_freq: D(4), vco1_wave: 2,
    vco2_freq: 1046.50, vco2_sub1_freq: D(9), vco2_sub2_freq: D(3), vco2_wave: 0,
    vco1_level: 44, vco1_sub1_level: 53, vco1_sub2_level: 54, vco2_level: 55, vco2_sub1_level: 47, vco2_sub2_level: 50,
    cutoff: 159, resonance: 25, vcf_eg_amt: 49, vcf_attack: 20.9, vcf_decay: 19.6, vca_attack: 1.0, vca_decay: 66.3, volume: 99,
    seq_oct: 0, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -34, seq1_step2: 19, seq1_step3: -53, seq1_step4: 0,
    seq2_step1: -40, seq2_step2: -100, seq2_step3: -74, seq2_step4: -41,
    rhythm1: D(4), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(5), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 407, rhythm_logic: 0, eg_mode: 0,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_cutoff' }, { from: 'out_clock', to: 'in_trigger' }],
},
```

### 9. Arp / Hand-Faded Harmony Arp

*Source:* MAN p.44, ‘Mellow Harmonies’ · *Type:* Moog patch sheet

SEQ 1 CLK → TRIGGER IN with EG OFF, so only Sequencer 1’s moves pluck the envelopes. RHYTHM 1 at ÷1 gives a steady arpeggio, and Sequencer 2 (÷8) shifts VCO 2 slowly. The sheet marks all four SUB LEVEL knobs as performance controls: fade the undertones in and out by hand to change the harmony.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 66.5 % → 1.57 kHz (G6) · SUB 1 ÷5 (E♭4 +14c) · SUB 2 ÷4 (G4) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷3 (F4 -2c) · SUB 2 ÷6 (F3 -2c) · WAVE UP (all square) |
| Mixer | VCO 1 50 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 50 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 20 % → 80 Hz · RESONANCE 0 % · VCF EG AMT 74 % → +48 % |
| EGs | VCF ATTACK 22 % → 8 ms · VCF DECAY 15 % → 16 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 29 % → 45 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -53 % (-0.53 V) · +7 % (+0.07 V) · +35 % (+0.35 V) · -42 % (-0.42 V) → D6 A6 C7 D6 |
| SEQ 2 steps | -55 % (-0.55 V) · -32 % (-0.32 V) · -77 % (-0.77 V) · -39 % (-0.39 V) → F5 A5 D5 G5 |
| Rhythm | TEMPO 13 % → 407 BPM (6.8 Hz master pulse) · RHYTHM 1 ÷1 → SEQ 1 · RHYTHM 2 ÷8 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG OFF · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_cutoff`, `out_seq1_clk` → `in_trigger` |
| Perform | all four SUB LEVEL knobs (full-range arcs on the sheet): start at 0 and fade in |

```ts
man_mellow: {
  name: 'Arp / Hand-Faded Harmony Arp',
  settings: {
    vco1_freq: 1567.98, vco1_sub1_freq: D(5), vco1_sub2_freq: D(4), vco1_wave: 2,
    vco2_freq: 1046.50, vco2_sub1_freq: D(3), vco2_sub2_freq: D(6), vco2_wave: 0,
    vco1_level: 50, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 50, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 80, resonance: 0, vcf_eg_amt: 48, vcf_attack: 7.6, vcf_decay: 15.6, vca_attack: 1.0, vca_decay: 45.3, volume: 99,
    seq_oct: 0, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -53, seq1_step2: 7, seq1_step3: 35, seq1_step4: -42,
    seq2_step1: -55, seq2_step2: -32, seq2_step3: -77, seq2_step4: -39,
    rhythm1: D(1), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 407, rhythm_logic: 0, eg_mode: 0,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_cutoff' }, { from: 'out_seq1_clk', to: 'in_trigger' }],
},
```

### 10. Rhythm / Self-Tripping Cross-Sequence

*Source:* MAN p.45, ‘Slip & Fall’ · *Type:* Moog patch sheet

Each VCO is played by both sequencers (its internal assign plus a crossed cable). Both envelopes feed back into the rhythm generators, so every note’s envelope speeds up RHYTHM 1 and 2, and the groove stumbles and recovers. EG is OFF; SEQ 1 CLK triggers the envelopes.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷6 (F5 -2c) · SUB 2 ÷7 (D5 +31c) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷3 (F4 -2c) · SUB 2 ÷3 (F4 -2c) · WAVE UP (all square) |
| Mixer | VCO 1 71 % · SUB 1 0 % · SUB 2 55.5 % ‖ VCO 2 71 % · SUB 1 0 % · SUB 2 90 % |
| VCF | CUTOFF 69 % → 2.35 kHz · RESONANCE 17.5 % · VCF EG AMT 76 % → +52 % |
| EGs | VCF ATTACK 73 % → 832 ms · VCF DECAY 0 % → 5 ms · VCA ATTACK 48 % → 83 ms · VCA DECAY 0 % → 5 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-JI · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +35 % (+0.35 V) · -40 % (-0.40 V) · -11 % (-0.11 V) · -17 % (-0.17 V) → E8 -14c G7 +2c B7 -12c B7 -12c |
| SEQ 2 steps | -53 % (-0.53 V) · -18 % (-0.18 V) · -60 % (-0.60 V) · +34 % (+0.34 V) → F5 -2c A5 -16c F5 -2c E6 -14c |
| Rhythm | TEMPO 40.7 % → 1233 BPM (20.5 Hz master pulse) · RHYTHM 1 ÷8 → SEQ 1 · RHYTHM 2 ÷9 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG OFF · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_vco1`, `out_seq1` → `in_vco2`, `out_vca_eg` → `in_rhythm2`, `out_vcf_eg` → `in_rhythm1`, `out_seq1_clk` → `in_trigger` |
| Reading notes | VCO 2 SUB 2 reads between ÷3 and ÷4 on the sheet; ÷3 is used here. |

```ts
man_slip: {
  name: 'Rhythm / Self-Tripping Cross-Sequence',
  settings: {
    vco1_freq: 4186.01, vco1_sub1_freq: D(6), vco1_sub2_freq: D(7), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(3), vco2_sub2_freq: D(3), vco2_wave: 0,
    vco1_level: 71, vco1_sub1_level: 0, vco1_sub2_level: 55.5, vco2_level: 71, vco2_sub1_level: 0, vco2_sub2_level: 90,
    cutoff: 2350, resonance: 17.5, vcf_eg_amt: 52, vcf_attack: 831.8, vcf_decay: 5.0, vca_attack: 83.2, vca_decay: 5.0, volume: 99,
    seq_oct: 0, quantize: 4, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 35, seq1_step2: -40, seq1_step3: -11, seq1_step4: -17,
    seq2_step1: -53, seq2_step2: -18, seq2_step3: -60, seq2_step4: 34,
    rhythm1: D(8), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(9), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1233, rhythm_logic: 0, eg_mode: 0,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_vco1' }, { from: 'out_seq1', to: 'in_vco2' }, { from: 'out_vca_eg', to: 'in_rhythm2' }, { from: 'out_vcf_eg', to: 'in_rhythm1' }, { from: 'out_seq1_clk', to: 'in_trigger' }],
},
```

### 11. Pad / Driven Pulse Swell

*Source:* MAN p.45, ‘Point Zero’ · *Type:* Moog patch sheet

Five of the six sources at full drive the mixer into its warm overdrive. SEQ 1 sweeps VCO 1’s pulse width and SEQ 2 moves the cutoff. A slow VCF ATTACK opens the filter over each note, and a near-maximum VCA DECAY lets the notes ring. The sheet says VCF ATTACK sets the length of the sweep.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 71.0 % → 1.98 kHz (B6) · SUB 1 ÷5 (G4 +14c) · SUB 2 ÷3 (E5 -2c) · WAVE UP (all square) |
| VCO 2 | FREQ 67.0 % → 1.76 kHz (A6) · SUB 1 ÷1 (A6) · SUB 2 ÷5 (F4 +14c) · WAVE DOWN (all saw) |
| Mixer | VCO 1 100 % · SUB 1 100 % · SUB 2 42 % ‖ VCO 2 100 % · SUB 1 100 % · SUB 2 100 % |
| VCF | CUTOFF 20 % → 80 Hz · RESONANCE 41 % · VCF EG AMT 80 % → +60 % |
| EGs | VCF ATTACK 67 % → 479 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 94 % → 6.34 s · VOLUME 99 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -41 % (-0.82 V) · -42 % (-0.84 V) · -97 % (-1.94 V) · -97 % (-1.94 V) → C6 C6 B4 B4 |
| SEQ 2 steps | -43 % (-0.86 V) · -17 % (-0.34 V) · -95 % (-1.90 V) · -82 % (-1.64 V) → A5 E6 A4 C5 |
| Rhythm | TEMPO 24 % → 735 BPM (12.3 Hz master pulse) · RHYTHM 1 ÷3 → SEQ 1 · RHYTHM 2 ÷8 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_vco1_pwm`, `out_seq2` → `in_cutoff` |
| Reading notes | The sheet suggests tuning SEQ 1, SEQ 2 and all the subs to taste. |

```ts
man_pointzero: {
  name: 'Pad / Driven Pulse Swell',
  settings: {
    vco1_freq: 1975.53, vco1_sub1_freq: D(5), vco1_sub2_freq: D(3), vco1_wave: 0,
    vco2_freq: 1760.00, vco2_sub1_freq: D(1), vco2_sub2_freq: D(5), vco2_wave: 2,
    vco1_level: 100, vco1_sub1_level: 100, vco1_sub2_level: 42, vco2_level: 100, vco2_sub1_level: 100, vco2_sub2_level: 100,
    cutoff: 80, resonance: 41, vcf_eg_amt: 60, vcf_attack: 478.6, vcf_decay: 31.0, vca_attack: 1.0, vca_decay: 6337.8, volume: 99,
    seq_oct: 1, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -41, seq1_step2: -42, seq1_step3: -97, seq1_step4: -97,
    seq2_step1: -43, seq2_step2: -17, seq2_step3: -95, seq2_step4: -82,
    rhythm1: D(3), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 735, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_vco1_pwm' }, { from: 'out_seq2', to: 'in_cutoff' }],
},
```

### 12. Lead / Two-Sequencer Line

*Source:* MAN p.46, ‘Three Hands on the Wheel’ · *Type:* Moog patch sheet

VCO 1 is silent. VCO 2 is played by both sequencers at once (OSC 2 assign plus SEQ 1 by cable), and SEQ 2 also drives the cutoff. ÷13 against ÷6 makes a long, winding line. The sheet marks VCO 2 SUB 2 LEVEL and the positive half of VCF EG AMT as performance controls.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷3 (F4 -2c) · SUB 2 ÷4 (C4) · WAVE DOWN (all saw) |
| Mixer | VCO 1 0 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 90 % · SUB 1 71 % · SUB 2 0 % |
| VCF | CUTOFF 18 % → 69 Hz · RESONANCE 45 % · VCF EG AMT 71 % → +42 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 34 % → 66 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 25.5 % → 35 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 8-ET · SEQ 1 ASSIGN none · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -52 % (-1.04 V) · +11 % (+0.22 V) · +33 % (+0.66 V) · -16 % (-0.32 V) |
| SEQ 2 steps | -51 % (-1.02 V) · +33 % (+0.66 V) · -32 % (-0.64 V) · -73 % (-1.46 V) → C5 G6 E5 G4 |
| Rhythm | TEMPO 63.8 % → 1921 BPM (32.0 Hz master pulse) · RHYTHM 1 ÷13 → SEQ 1 · RHYTHM 2 ÷6 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_vco2`, `out_seq2` → `in_cutoff` |
| Perform | VCO 2 SUB 2 LEVEL (arc): fade in; VCF EG AMT (arc over about 2–4 o’clock): ride it for brightness |

```ts
man_threehands: {
  name: 'Lead / Two-Sequencer Line',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(3), vco2_sub2_freq: D(4), vco2_wave: 2,
    vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 90, vco2_sub1_level: 71, vco2_sub2_level: 0,
    cutoff: 69, resonance: 45, vcf_eg_amt: 42, vcf_attack: 1.0, vcf_decay: 66.3, vca_attack: 1.0, vca_decay: 34.7, volume: 99,
    seq_oct: 1, quantize: 2, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -52, seq1_step2: 11, seq1_step3: 33, seq1_step4: -16,
    seq2_step1: -51, seq2_step2: 33, seq2_step3: -32, seq2_step4: -73,
    rhythm1: D(13), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(6), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1921, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_vco2' }, { from: 'out_seq2', to: 'in_cutoff' }],
},
```

### 13. Drums / Filter-Ping Kit

*Source:* MAN p.46, ‘Bateria’ · *Type:* Moog patch sheet

All six levels are at zero, so the only sound is the ladder at maximum resonance, pinged by its envelope. Each sequencer’s CV changes the division of its own rhythm generator. SEQ 1 CLK into CUTOFF adds a click; SEQ 2 CLK into VCA IN adds accents. The sheet says CUTOFF tunes the kick, and VCF DECAY and EG AMT change its character.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 69.7 % → 1.76 kHz (A6) · SUB 1 ÷1 (A6) · SUB 2 ÷1 (A6) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| Mixer | VCO 1 0 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 20 % → 80 Hz · RESONANCE 99 % · VCF EG AMT 61 % → +22 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 18 % → 20 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 46 % → 165 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN none · SEQ 2 ASSIGN none |
| SEQ 1 steps | -100 % (-1.00 V) · -17 % (-0.17 V) · +100 % (+1.00 V) · +9 % (+0.09 V) |
| SEQ 2 steps | +100 % (+1.00 V) · +32 % (+0.32 V) · -47 % (-0.47 V) · +23 % (+0.23 V) |
| Rhythm | TEMPO 16.6 % → 515 BPM (8.6 Hz master pulse) · RHYTHM 1 ÷8 → SEQ 1 · RHYTHM 2 ÷4 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷16 → SEQ 1 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_rhythm1`, `out_seq2` → `in_rhythm2`, `out_seq1_clk` → `in_cutoff`, `out_seq2_clk` → `in_vca` |

```ts
man_bateria: {
  name: 'Drums / Filter-Ping Kit',
  settings: {
    vco1_freq: 1760.00, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 1,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 1,
    vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 80, resonance: 99, vcf_eg_amt: 22, vcf_attack: 1.0, vcf_decay: 19.6, vca_attack: 1.0, vca_decay: 165.0, volume: 99,
    seq_oct: 0, quantize: 1, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -100, seq1_step2: -17, seq1_step3: 100, seq1_step4: 9,
    seq2_step1: 100, seq2_step2: 32, seq2_step3: -47, seq2_step4: 23,
    rhythm1: D(8), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(4), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(16), rhythm4_seq1: true, rhythm4_seq2: false,
    tempo: 515, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_rhythm1' }, { from: 'out_seq2', to: 'in_rhythm2' }, { from: 'out_seq1_clk', to: 'in_cutoff' }, { from: 'out_seq2_clk', to: 'in_vca' }],
},
```

### 14. Texture / Accelerating Spiral

*Source:* MAN p.47, ‘Spiral Ways’ · *Type:* Moog patch sheet (buttons interpreted)

The VCF EG patched into RHYTHM 1 IN makes Sequencer 1 rush forward on each envelope and relax as the envelope decays: a spiralling accelerando. VCF ATTACK sets how far it builds (the sheet’s “crescendo depth”). The sheet tunes VCO 1 SUB 1 to a fifth and VCO 2 SUB 2 to a major third.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷6 (F5 -2c) · SUB 2 ÷7 (D5 +31c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷2 (C5) · SUB 2 ÷5 (A♭3 +14c) · WAVE DOWN (all saw) |
| Mixer | VCO 1 60 % · SUB 1 59 % · SUB 2 59 % ‖ VCO 2 65 % · SUB 1 100 % · SUB 2 100 % |
| VCF | CUTOFF 9 % → 37 Hz · RESONANCE 34 % · VCF EG AMT 85 % → +70 % |
| EGs | VCF ATTACK 50 % → 100 ms · VCF DECAY 10 % → 11 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 95 % → 6.84 s · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +20 % (+0.20 V) · +20 % (+0.20 V) · -17 % (-0.17 V) · -17 % (-0.17 V) → D8 D8 A7 A7 |
| SEQ 2 steps | -97 % (-0.97 V) · -45 % (-0.45 V) · -97 % (-0.97 V) · -42 % (-0.42 V) → C5 G5 C5 G5 |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷5 → SEQ 1 · RHYTHM 2 ÷12 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vcf_eg` → `in_rhythm1` |
| Perform | VCO 2 SUB 2 FREQ (double-arrow arc, about 2–4 o’clock): explore ÷5 … ÷3 |
| Reading notes | As printed, PLAY and EG are both unlit and nothing reaches TRIGGER, so the patch would be silent. It is recreated here with EG ON and PLAY on. The VCO 1 SUB 1 pointer lies between ÷7 and ÷6; ÷6 matches the sheet’s “fifth”. RHYTHM 2 reads ÷12 or ÷11. |

```ts
man_spiral: {
  name: 'Texture / Accelerating Spiral',
  settings: {
    vco1_freq: 4186.01, vco1_sub1_freq: D(6), vco1_sub2_freq: D(7), vco1_wave: 1,
    vco2_freq: 1046.50, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_wave: 2,
    vco1_level: 60, vco1_sub1_level: 59, vco1_sub2_level: 59, vco2_level: 65, vco2_sub1_level: 100, vco2_sub2_level: 100,
    cutoff: 37, resonance: 34, vcf_eg_amt: 70, vcf_attack: 100.0, vcf_decay: 10.7, vca_attack: 1.0, vca_decay: 6838.3, volume: 99,
    seq_oct: 0, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 20, seq1_step2: 20, seq1_step3: -17, seq1_step4: -17,
    seq2_step1: -97, seq2_step2: -45, seq2_step3: -97, seq2_step4: -42,
    rhythm1: D(5), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(12), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vcf_eg', to: 'in_rhythm1' }],
},
```

### 15. Texture / Percolating High Clusters

*Source:* MAN p.47, ‘Star-Gate’ · *Type:* Moog patch sheet (buttons interpreted)

At a fast TEMPO, three rhythm generators (÷8, ÷7, ÷10) all clock Sequencer 2 while ÷3 clocks Sequencer 1, giving clusters of very high notes. Sequencer 1 also re-divides both of VCO 1’s subs. All five remaining mixer knobs and VCA DECAY are performance controls: bring pitches in and out by hand.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷4 (C6) · SUB 2 ÷3 (F6 -2c) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 93.0 % → 3.49 kHz (A7 -16c) · SUB 1 ÷7 (B4 +16c) · SUB 2 ÷16 (A3 -16c) · WAVE UP (all square) |
| Mixer | VCO 1 100 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 30 % → 159 Hz · RESONANCE 0 % · VCF EG AMT 71 % → +42 % |
| EGs | VCF ATTACK 0.7 % → 1 ms · VCF DECAY 92 % → 5.44 s · VCA ATTACK 0 % → 1 ms · VCA DECAY 100 % → 10.00 s · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-JI · SEQ 1 ASSIGN OSC 1/SUB 1/SUB 2 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +21 % (+0.21 V) · -42 % (-0.42 V) · -52 % (-0.52 V) · -12 % (-0.12 V) → D8 +4c G7 +2c F7 -2c B7 -12c |
| SEQ 2 steps | +9 % (+0.09 V) · +9 % (+0.09 V) · -21 % (-0.21 V) · -53 % (-0.53 V) → A7 -16c A7 -16c G7 +2c D7 +4c |
| Rhythm | TEMPO 73.7 % → 2216 BPM (36.9 Hz master pulse) · RHYTHM 1 ÷3 → SEQ 1 · RHYTHM 2 ÷8 → SEQ 2 · RHYTHM 3 ÷7 → SEQ 2 · RHYTHM 4 ÷10 → SEQ 2 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_cutoff`, `out_seq2` → `in_vco1_pwm` |
| Perform | VCO 2 LEVEL and all four SUB LEVELs (arcs): start at 0 and bring them in; VCA DECAY (arc): from full down to taste |
| Reading notes | As printed, PLAY and EG are unlit. The notes say to reset and play the sequence, and VCA DECAY shapes the clusters, so this recreation uses EG ON. |

```ts
man_stargate: {
  name: 'Texture / Percolating High Clusters',
  settings: {
    vco1_freq: 4186.01, vco1_sub1_freq: D(4), vco1_sub2_freq: D(3), vco1_wave: 2,
    vco2_freq: 3488.34, vco2_sub1_freq: D(7), vco2_sub2_freq: D(16), vco2_wave: 0,
    vco1_level: 100, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 159, resonance: 0, vcf_eg_amt: 42, vcf_attack: 1.1, vcf_decay: 5444.0, vca_attack: 1.0, vca_decay: 10000.0, volume: 99,
    seq_oct: 0, quantize: 4, seq1_osc: true, seq1_sub1: true, seq1_sub2: true, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 21, seq1_step2: -42, seq1_step3: -52, seq1_step4: -12,
    seq2_step1: 9, seq2_step2: 9, seq2_step3: -21, seq2_step4: -53,
    rhythm1: D(3), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(7), rhythm3_seq1: false, rhythm3_seq2: true, rhythm4: D(10), rhythm4_seq1: false, rhythm4_seq2: true,
    tempo: 2216, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_cutoff' }, { from: 'out_seq2', to: 'in_vco1_pwm' }],
},
```

### 16. Groove / Polyrhythm Chord Stabs

*Source:* MAN p.48, ‘Poly Rock’ · *Type:* Moog patch sheet

÷10 and ÷5 on Sequencer 1 against ÷12 on Sequencer 2, with a negative VCF EG AMT and the VCA EG patched into CUTOFF, so each stab’s brightness follows its loudness contour. The sheet suggests tuning all four subs into chord shapes, and patching CLOCK OUT → VCA IN for a drum pulse.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 71.0 % → 1.98 kHz (B6) · SUB 1 ÷8 (B3) · SUB 2 ÷3 (E5 -2c) · WAVE UP (all square) |
| VCO 2 | FREQ 83.7 % → 2.64 kHz (E7) · SUB 1 ÷7 (F♯4 +31c) · SUB 2 ÷10 (C4 +14c) · WAVE UP (all square) |
| Mixer | VCO 1 60 % · SUB 1 59 % · SUB 2 100 % ‖ VCO 2 0 % · SUB 1 100 % · SUB 2 55 % |
| VCF | CUTOFF 9 % → 37 Hz · RESONANCE 50 % · VCF EG AMT 29.7 % → -41 % |
| EGs | VCF ATTACK 46.7 % → 74 ms · VCF DECAY 12 % → 12 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 35 % → 72 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -98 % (-0.98 V) · -79 % (-0.79 V) · -78 % (-0.78 V) · -98 % (-0.98 V) → B5 C6 C6 B5 |
| SEQ 2 steps | +23 % (+0.23 V) · -94 % (-0.94 V) · -9 % (-0.09 V) · -86 % (-0.86 V) → G7 F6 E7 F6 |
| Rhythm | TEMPO 12 % → 378 BPM (6.3 Hz master pulse) · RHYTHM 1 ÷10 → SEQ 1 · RHYTHM 2 ÷12 → SEQ 2 · RHYTHM 3 ÷5 → SEQ 1 · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vca_eg` → `in_cutoff` |
| Optional cable | `out_clock` → `in_vca` (the “drums” option in the sheet’s notes) |
| Reading notes | VCO 1 SUB 1 reads ÷8 or ÷7; RHYTHM 2 reads ÷12 or ÷11. |

```ts
man_polyrock: {
  name: 'Groove / Polyrhythm Chord Stabs',
  settings: {
    vco1_freq: 1975.53, vco1_sub1_freq: D(8), vco1_sub2_freq: D(3), vco1_wave: 0,
    vco2_freq: 2637.02, vco2_sub1_freq: D(7), vco2_sub2_freq: D(10), vco2_wave: 0,
    vco1_level: 60, vco1_sub1_level: 59, vco1_sub2_level: 100, vco2_level: 0, vco2_sub1_level: 100, vco2_sub2_level: 55,
    cutoff: 37, resonance: 50, vcf_eg_amt: -41, vcf_attack: 73.8, vcf_decay: 12.4, vca_attack: 1.0, vca_decay: 71.5, volume: 99,
    seq_oct: 0, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -98, seq1_step2: -79, seq1_step3: -78, seq1_step4: -98,
    seq2_step1: 23, seq2_step2: -94, seq2_step3: -9, seq2_step4: -86,
    rhythm1: D(10), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(12), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(5), rhythm3_seq1: true, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 378, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vca_eg', to: 'in_cutoff' }],
},
```

### 17. Pad / Slow-Bloom Duet

*Source:* MAN p.48, ‘Cloud Path’ · *Type:* Moog patch sheet (buttons interpreted)

One rhythm generator (÷11) drives both sequencers. The VCA EG patched into CUTOFF opens a fully closed filter with every slow swell, and the VCF EG modulates RHYTHM 3. The sheet’s routine: tune each VCO and sub with its level up, return the levels to zero, play, then slowly raise VCO 2 and the subs. Add RHYTHM 3 → SEQ 1 for a double-time feel.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 75.7 % → 2.09 kHz (C7) · SUB 1 ÷4 (C5) · SUB 2 ÷2 (C6) · WAVE UP (all square) |
| VCO 2 | FREQ 61.7 % → 1.48 kHz (F♯6) · SUB 1 ÷2 (F♯5) · SUB 2 ÷7 (A♭3 +31c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| Mixer | VCO 1 78 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 0 % → 20 Hz · RESONANCE 41 % · VCF EG AMT 41.7 % → -17 % |
| EGs | VCF ATTACK 82 % → 1.91 s · VCF DECAY 13.6 % → 14 ms · VCA ATTACK 71 % → 692 ms · VCA DECAY 55.4 % → 337 ms · VOLUME 99 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -95 % (-0.95 V) · -60 % (-0.60 V) · -60 % (-0.60 V) · -79 % (-0.79 V) → C♯6 F6 F6 E♭6 |
| SEQ 2 steps | -43 % (-0.43 V) · -79 % (-0.79 V) · -69 % (-0.69 V) · -41 % (-0.41 V) → C6 A♭5 A5 C♯6 |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷11 → SEQ 1 + SEQ 2 · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷9 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vca_eg` → `in_cutoff`, `out_vcf_eg` → `in_rhythm3` |
| Perform | VCO 2 LEVEL, then all SUB LEVELs (arcs): raise slowly; optional: RHYTHM 3 → SEQ 1 (dashed on the sheet) for double time |
| Reading notes | As printed, EG and PLAY are unlit (the tuning stage); it is played with EG ON. VCO 1 SUB 2 reads ÷2 or ÷3. |

```ts
man_cloudpath: {
  name: 'Pad / Slow-Bloom Duet',
  settings: {
    vco1_freq: 2093.00, vco1_sub1_freq: D(4), vco1_sub2_freq: D(2), vco1_wave: 0,
    vco2_freq: 1479.98, vco2_sub1_freq: D(2), vco2_sub2_freq: D(7), vco2_wave: 1,
    vco1_level: 78, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 20, resonance: 41, vcf_eg_amt: -17, vcf_attack: 1905.5, vcf_decay: 14.1, vca_attack: 691.8, vca_decay: 337.1, volume: 99,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -95, seq1_step2: -60, seq1_step3: -60, seq1_step4: -79,
    seq2_step1: -43, seq2_step2: -79, seq2_step3: -69, seq2_step4: -41,
    rhythm1: D(11), rhythm1_seq1: true, rhythm1_seq2: true, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(9), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vca_eg', to: 'in_cutoff' }, { from: 'out_vcf_eg', to: 'in_rhythm3' }],
},
```

### 18. Percussion / Clinking Sub Clatter

*Source:* XPB p.3 (patch 1), ‘Music for Washing Dishes’ · *Type:* Moog patch sheet (knobs measured from the drawing)

Three very low subs (÷16, ÷13, ÷16) at full level go through a self-oscillating ladder tuned near 54 Hz, with millisecond envelopes and SEQ 2 jolting the cutoff. Four rhythm generators clatter across both sequencers; Sequencer 1 only re-divides VCO 1’s SUB 2. The sheet suggests playing with VCF ATTACK.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷4 (C2) · SUB 2 ÷16 (C0) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷13 (E0 -41c) · SUB 2 ÷16 (C0) · WAVE DOWN (all saw) |
| Mixer | VCO 1 0 % · SUB 1 0 % · SUB 2 81 % ‖ VCO 2 0 % · SUB 1 81 % · SUB 2 81 % |
| VCF | CUTOFF 14 % → 53 Hz · RESONANCE 100 % · VCF EG AMT 70 % → +40 % |
| EGs | VCF ATTACK 7 % → 2 ms · VCF DECAY 6 % → 8 ms · VCA ATTACK 12 % → 3 ms · VCA DECAY 25 % → 33 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±5 · QUANTIZE 8-JI · SEQ 1 ASSIGN SUB 2 · SEQ 2 ASSIGN OSC 2/SUB 2 |
| SEQ 1 steps | -99 % (-4.95 V) · -39 % (-1.95 V) · -20 % (-1.00 V) · +20 % (+1.00 V) (moves the sub divisors) |
| SEQ 2 steps | +20 % (+1.00 V) · -73 % (-3.65 V) · +11 % (+0.55 V) · +61 % (+3.05 V) → C5 E0 -14c G4 +2c C7 |
| Rhythm | TEMPO 62 % → 1868 BPM (31.1 Hz master pulse) · RHYTHM 1 ÷14 → SEQ 1 + SEQ 2 · RHYTHM 2 ÷11 → SEQ 1 · RHYTHM 3 ÷13 → SEQ 1 + SEQ 2 · RHYTHM 4 ÷15 → SEQ 2 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_cutoff` |
| Reading notes | RHYTHM 2 and 4 sit between detents (÷11/÷12 and ÷15/÷14). |

```ts
xpb_dishes: {
  name: 'Percussion / Clinking Sub Clatter',
  settings: {
    vco1_freq: 261.63, vco1_sub1_freq: D(4), vco1_sub2_freq: D(16), vco1_wave: 2,
    vco2_freq: 261.63, vco2_sub1_freq: D(13), vco2_sub2_freq: D(16), vco2_wave: 2,
    vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 81, vco2_level: 0, vco2_sub1_level: 81, vco2_sub2_level: 81,
    cutoff: 53, resonance: 100, vcf_eg_amt: 40, vcf_attack: 1.9, vcf_decay: 7.9, vca_attack: 3.0, vca_decay: 33.4, volume: 51,
    seq_oct: 2, quantize: 4, seq1_osc: false, seq1_sub1: false, seq1_sub2: true, seq2_osc: true, seq2_sub1: false, seq2_sub2: true,
    seq1_step1: -99, seq1_step2: -39, seq1_step3: -20, seq1_step4: 20,
    seq2_step1: 20, seq2_step2: -73, seq2_step3: 11, seq2_step4: 61,
    rhythm1: D(14), rhythm1_seq1: true, rhythm1_seq2: true, rhythm2: D(11), rhythm2_seq1: true, rhythm2_seq2: false,
    rhythm3: D(13), rhythm3_seq1: true, rhythm3_seq2: true, rhythm4: D(15), rhythm4_seq1: false, rhythm4_seq2: true,
    tempo: 1868, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_cutoff' }],
},
```

### 19. Bass / Shuffled Sub Bassline

*Source:* XPB p.4 (patch 2), ‘Shuffled Subs’ · *Type:* Moog patch sheet

Both VCOs are tuned together on C5 with ÷4 subs, making a square/saw bass pair. VCO 2 follows Sequencer 2 internally and Sequencer 1 by cable; SEQ 2 also moves the cutoff, against a negative EG AMT, for a ducking tone. The sheet’s trick is to reshape the bassline live with VCO 1’s SUB 1 FREQ.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 24.0 % → 523 Hz (C5) · SUB 1 ÷4 (C3) · SUB 2 ÷16 (C1) · WAVE UP (all square) |
| VCO 2 | FREQ 24.0 % → 523 Hz (C5) · SUB 1 ÷4 (C3) · SUB 2 ÷16 (C1) · WAVE DOWN (all saw) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 0 % ‖ VCO 2 81 % · SUB 1 81 % · SUB 2 0 % |
| VCF | CUTOFF 76 % → 3.81 kHz · RESONANCE 0 % · VCF EG AMT 34 % → -32 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 24 % → 31 ms · VCA ATTACK 15 % → 4 ms · VCA DECAY 35 % → 72 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 8-JI · SEQ 1 ASSIGN none · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | -29 % (-0.29 V) · +30 % (+0.30 V) · -48 % (-0.48 V) · +20 % (+0.20 V) |
| SEQ 2 steps | +20 % (+0.20 V) · -19 % (-0.19 V) · +6 % (+0.06 V) · +41 % (+0.41 V) → D5 +4c A4 -16c C5 F5 -2c |
| Rhythm | TEMPO 37 % → 1123 BPM (18.7 Hz master pulse) · RHYTHM 1 ÷8 → SEQ 1 · RHYTHM 2 ÷8 → SEQ 2 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_vco2`, `out_seq2` → `in_cutoff` |
| Perform | VCO 1 SUB 1 FREQ (arc): reshape the bassline while it plays |
| Reading notes | RHYTHM 2 sits between ÷8 and ÷7. |

```ts
xpb_shuffled: {
  name: 'Bass / Shuffled Sub Bassline',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(4), vco1_sub2_freq: D(16), vco1_wave: 0,
    vco2_freq: 523.25, vco2_sub1_freq: D(4), vco2_sub2_freq: D(16), vco2_wave: 2,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 0, vco2_level: 81, vco2_sub1_level: 81, vco2_sub2_level: 0,
    cutoff: 3811, resonance: 0, vcf_eg_amt: -32, vcf_attack: 1.0, vcf_decay: 31.0, vca_attack: 4.0, vca_decay: 71.5, volume: 51,
    seq_oct: 0, quantize: 4, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -29, seq1_step2: 30, seq1_step3: -48, seq1_step4: 20,
    seq2_step1: 20, seq2_step2: -19, seq2_step3: 6, seq2_step4: 41,
    rhythm1: D(8), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1123, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_vco2' }, { from: 'out_seq2', to: 'in_cutoff' }],
},
```

### 20. Texture / Eerie Fourths in Pulse

*Source:* XPB p.5 (patch 3), ‘Nosferatu’s Flotation Tank’ · *Type:* Moog patch sheet

Two pulse/saw voices a perfect fourth apart (C5 and F5 in 8-ET), all six sources at high level, and slow 90 ms / 0.5 s envelopes. SEQ 1 adds per-step loudness through VCA IN, the VCF EG bends RHYTHM 1, and SEQ 2 re-divides RHYTHM 3: a slow, wobbling dirge. The sheet suggests toggling the POLYRHYTHM SEQ buttons for new patterns.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷3 (F3 -2c) · SUB 2 ÷6 (F2 -2c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| VCO 2 | FREQ 37.0 % → 698 Hz (F5) · SUB 1 ÷3 (B♭3 -2c) · SUB 2 ÷7 (G2 +31c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 81 % ‖ VCO 2 81 % · SUB 1 81 % · SUB 2 81 % |
| VCF | CUTOFF 9 % → 37 Hz · RESONANCE 30 % · VCF EG AMT 82.5 % → +65 % |
| EGs | VCF ATTACK 49 % → 91 ms · VCF DECAY 60 % → 478 ms · VCA ATTACK 49 % → 91 ms · VCA DECAY 60 % → 478 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 8-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +29 % (+0.58 V) · +60 % (+1.20 V) · -40 % (-0.80 V) · -80 % (-1.60 V) → G5 D6 D4 F3 |
| SEQ 2 steps | -19 % (-0.38 V) · +20 % (+0.40 V) · -19 % (-0.38 V) · +21 % (+0.42 V) → D5 B5 D5 B5 |
| Rhythm | TEMPO 33 % → 1003 BPM (16.7 Hz master pulse) · RHYTHM 1 ÷13 → SEQ 1 · RHYTHM 2 ÷8 (unassigned) · RHYTHM 3 ÷13 → SEQ 2 · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_vca`, `out_vcf_eg` → `in_rhythm1`, `out_seq2` → `in_rhythm3` |
| Reading notes | VCO 1 SUB 1 and VCO 2 SUB 2 sit between detents (÷3/÷4 and ÷7/÷6). |

```ts
xpb_nosferatu: {
  name: 'Texture / Eerie Fourths in Pulse',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(3), vco1_sub2_freq: D(6), vco1_wave: 1,
    vco2_freq: 698.46, vco2_sub1_freq: D(3), vco2_sub2_freq: D(7), vco2_wave: 1,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 81, vco2_level: 81, vco2_sub1_level: 81, vco2_sub2_level: 81,
    cutoff: 37, resonance: 30, vcf_eg_amt: 65, vcf_attack: 91.2, vcf_decay: 478.2, vca_attack: 91.2, vca_decay: 478.2, volume: 51,
    seq_oct: 1, quantize: 2, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 29, seq1_step2: 60, seq1_step3: -40, seq1_step4: -80,
    seq2_step1: -19, seq2_step2: 20, seq2_step3: -19, seq2_step4: 21,
    rhythm1: D(13), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(8), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(13), rhythm3_seq1: false, rhythm3_seq2: true, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1003, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_vca' }, { from: 'out_vcf_eg', to: 'in_rhythm1' }, { from: 'out_seq2', to: 'in_rhythm3' }],
},
```

### 21. FX / Buzzing Cross-Mod Swarm

*Source:* XPB p.6 (patch 4), ‘Transistor Insects’ · *Type:* Moog patch sheet

Both VCOs sit at the top (C8) and cross-modulate through their subs: VCO 2 SUB 2 → VCO 1 IN and VCO 1 SUB 2 → VCO 2 IN. VCO 1 itself modulates RHYTHM 4 at audio rate. All four generators clock both sequencers at a near-maximum TEMPO, through a fully resonant filter with tiny envelopes. The result chirps like insects.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷7 (D5 +31c) · SUB 2 ÷16 (C4) · WAVE UP (all square) |
| VCO 2 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷7 (D5 +31c) · SUB 2 ÷16 (C4) · WAVE UP (all square) |
| Mixer | VCO 1 66 % · SUB 1 66 % · SUB 2 0 % ‖ VCO 2 66 % · SUB 1 64 % · SUB 2 0 % |
| VCF | CUTOFF 34 % → 209 Hz · RESONANCE 100 % · VCF EG AMT 91.5 % → +83 % |
| EGs | VCF ATTACK 12 % → 3 ms · VCF DECAY 21 % → 25 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 12 % → 12 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±5 · QUANTIZE OFF · SEQ 1 ASSIGN OSC 1/SUB 2 · SEQ 2 ASSIGN OSC 2/SUB 2 |
| SEQ 1 steps | -9 % (-0.45 V) · +40 % (+2.00 V) · -60 % (-3.00 V) · +80 % (+4.00 V) → G7 -40c C10 C5 C12 |
| SEQ 2 steps | +20 % (+1.00 V) · +60 % (+3.00 V) · +0 % (+0.00 V) · -69 % (-3.45 V) → C9 C11 C8 G4 -40c |
| Rhythm | TEMPO 98 % → 2940 BPM (49.0 Hz master pulse) · RHYTHM 1 ÷13 → SEQ 1 + SEQ 2 · RHYTHM 2 ÷12 → SEQ 1 + SEQ 2 · RHYTHM 3 ÷15 → SEQ 1 + SEQ 2 · RHYTHM 4 ÷13 → SEQ 1 + SEQ 2 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vco2_sub2` → `in_vco1`, `out_vco1_sub2` → `in_vco2`, `out_vco1` → `in_rhythm4` |

```ts
xpb_insects: {
  name: 'FX / Buzzing Cross-Mod Swarm',
  settings: {
    vco1_freq: 4186.01, vco1_sub1_freq: D(7), vco1_sub2_freq: D(16), vco1_wave: 0,
    vco2_freq: 4186.01, vco2_sub1_freq: D(7), vco2_sub2_freq: D(16), vco2_wave: 0,
    vco1_level: 66, vco1_sub1_level: 66, vco1_sub2_level: 0, vco2_level: 66, vco2_sub1_level: 64, vco2_sub2_level: 0,
    cutoff: 209, resonance: 100, vcf_eg_amt: 83, vcf_attack: 3.0, vcf_decay: 24.7, vca_attack: 1.0, vca_decay: 12.4, volume: 51,
    seq_oct: 2, quantize: 0, seq1_osc: true, seq1_sub1: false, seq1_sub2: true, seq2_osc: true, seq2_sub1: false, seq2_sub2: true,
    seq1_step1: -9, seq1_step2: 40, seq1_step3: -60, seq1_step4: 80,
    seq2_step1: 20, seq2_step2: 60, seq2_step3: 0, seq2_step4: -69,
    rhythm1: D(13), rhythm1_seq1: true, rhythm1_seq2: true, rhythm2: D(12), rhythm2_seq1: true, rhythm2_seq2: true,
    rhythm3: D(15), rhythm3_seq1: true, rhythm3_seq2: true, rhythm4: D(13), rhythm4_seq1: true, rhythm4_seq2: true,
    tempo: 2940, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vco2_sub2', to: 'in_vco1' }, { from: 'out_vco1_sub2', to: 'in_vco2' }, { from: 'out_vco1', to: 'in_rhythm4' }],
},
```

### 22. Melody / Undertone Step Dance

*Source:* XPB p.7 (patch 5), ‘Neon Cactus Tips Their Cap’ · *Type:* Moog patch sheet

The sequencers move only the sub divisors, not the VCOs: SUB 1 and SUB 2 are lit on both sides. The melody walks the undertone series of two fixed oscillators an octave apart (F6 and F5, 8-JI). SEQ 1 also re-divides RHYTHM 1, SEQ 2 sweeps VCO 2’s pulse width, and SEQ 2 CLK adds extra envelope triggers.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 62.0 % → 1.40 kHz (F6 -2c) · SUB 1 ÷7 (G3 +29c) · SUB 2 ÷4 (F4 -2c) · WAVE UP (all square) |
| VCO 2 | FREQ 37.0 % → 698 Hz (F5 -2c) · SUB 1 ÷10 (C♯2 +12c) · SUB 2 ÷4 (F3 -2c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| Mixer | VCO 1 40 % · SUB 1 60 % · SUB 2 67 % ‖ VCO 2 60 % · SUB 1 60 % · SUB 2 70 % |
| VCF | CUTOFF 100 % → 20.00 kHz · RESONANCE 37 % · VCF EG AMT 30.5 % → -39 % |
| EGs | VCF ATTACK 32 % → 19 ms · VCF DECAY 40 % → 105 ms · VCA ATTACK 18 % → 5 ms · VCA DECAY 43 % → 131 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 8-JI · SEQ 1 ASSIGN SUB 1/SUB 2 · SEQ 2 ASSIGN SUB 1/SUB 2 |
| SEQ 1 steps | -91 % (-1.82 V) · -40 % (-0.80 V) · +29 % (+0.58 V) · -33 % (-0.66 V) (moves the sub divisors) |
| SEQ 2 steps | -35 % (-0.70 V) · -55 % (-1.10 V) · -80 % (-1.60 V) · +0 % (+0.00 V) (moves the sub divisors) |
| Rhythm | TEMPO 25 % → 765 BPM (12.8 Hz master pulse) · RHYTHM 1 ÷7 → SEQ 1 · RHYTHM 2 ÷10 → SEQ 2 · RHYTHM 3 ÷8 (unassigned) · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_rhythm1`, `out_seq2` → `in_vco2_pwm`, `out_seq2_clk` → `in_trigger` |
| Reading notes | How far each step moves a divisor depends on the SEQ→SUB scaling (a twin guess). |

```ts
xpb_cactus: {
  name: 'Melody / Undertone Step Dance',
  settings: {
    vco1_freq: 1395.34, vco1_sub1_freq: D(7), vco1_sub2_freq: D(4), vco1_wave: 0,
    vco2_freq: 697.67, vco2_sub1_freq: D(10), vco2_sub2_freq: D(4), vco2_wave: 1,
    vco1_level: 40, vco1_sub1_level: 60, vco1_sub2_level: 67, vco2_level: 60, vco2_sub1_level: 60, vco2_sub2_level: 70,
    cutoff: 20000, resonance: 37, vcf_eg_amt: -39, vcf_attack: 19.1, vcf_decay: 104.6, vca_attack: 5.2, vca_decay: 131.3, volume: 51,
    seq_oct: 1, quantize: 4, seq1_osc: false, seq1_sub1: true, seq1_sub2: true, seq2_osc: false, seq2_sub1: true, seq2_sub2: true,
    seq1_step1: -91, seq1_step2: -40, seq1_step3: 29, seq1_step4: -33,
    seq2_step1: -35, seq2_step2: -55, seq2_step3: -80, seq2_step4: 0,
    rhythm1: D(7), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(10), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(8), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 765, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_rhythm1' }, { from: 'out_seq2', to: 'in_vco2_pwm' }, { from: 'out_seq2_clk', to: 'in_trigger' }],
},
```

### 23. FX / Tone and Breath Duet

*Source:* XPB p.8 (patch 6), ‘Duet for Tone and Wind’ · *Type:* Moog patch sheet

VCO 2 OUT drives CLOCK IN, so the clock runs at audio rate (262 Hz), and ÷16 on both generators gives about 16 steps a second. Nothing is assigned to pitch; SEQ 1 only moves VCO 2’s pulse width. With RESONANCE at 90 % and envelopes firing that fast, you get a breathy, wind-like hiss against a tone. The sheet suggests playing with VCF ATTACK, RHYTHM 1 and RHYTHM 2.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 68.0 % → 1.76 kHz (A6) · SUB 1 ÷10 (F3 +14c) · SUB 2 ÷10 (F3 +14c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷12 (F0 -2c) · SUB 2 ÷10 (A♭0 +14c) · WAVE MIDDLE (VCO pulse, PWM from SUB 1 saw; subs saw) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 81 % ‖ VCO 2 96 % · SUB 1 81 % · SUB 2 0 % |
| VCF | CUTOFF 67 % → 2.05 kHz · RESONANCE 90 % · VCF EG AMT 39 % → -22 % |
| EGs | VCF ATTACK 10 % → 3 ms · VCF DECAY 32 % → 57 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 39 % → 97 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±5 · QUANTIZE 8-ET · SEQ 1 ASSIGN none · SEQ 2 ASSIGN none |
| SEQ 1 steps | -30 % (-1.50 V) · -10 % (-0.50 V) · +19 % (+0.95 V) · -39 % (-1.95 V) |
| SEQ 2 steps | -48 % (-2.40 V) · -19 % (-0.95 V) · +9 % (+0.45 V) · +40 % (+2.00 V) |
| Rhythm | TEMPO 38 % → 1152 BPM (19.2 Hz master pulse) · RHYTHM 1 ÷16 → SEQ 1 · RHYTHM 2 ÷16 → SEQ 2 · RHYTHM 3 ÷8 (unassigned) · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq1` → `in_vco2_pwm`, `out_vco2` → `in_clock` |

```ts
xpb_wind: {
  name: 'FX / Tone and Breath Duet',
  settings: {
    vco1_freq: 1760.00, vco1_sub1_freq: D(10), vco1_sub2_freq: D(10), vco1_wave: 1,
    vco2_freq: 261.63, vco2_sub1_freq: D(12), vco2_sub2_freq: D(10), vco2_wave: 1,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 81, vco2_level: 96, vco2_sub1_level: 81, vco2_sub2_level: 0,
    cutoff: 2047, resonance: 90, vcf_eg_amt: -22, vcf_attack: 2.5, vcf_decay: 56.9, vca_attack: 1.0, vca_decay: 96.9, volume: 51,
    seq_oct: 2, quantize: 2, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -30, seq1_step2: -10, seq1_step3: 19, seq1_step4: -39,
    seq2_step1: -48, seq2_step2: -19, seq2_step3: 9, seq2_step4: 40,
    rhythm1: D(16), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(16), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(8), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1152, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq1', to: 'in_vco2_pwm' }, { from: 'out_vco2', to: 'in_clock' }],
},
```

### 24. Rhythm / Sub-Gated Dial Tones

*Source:* XPB p.9 (patch 7), ‘Touchtone Wiretap’ · *Type:* Moog patch sheet

VCO 1 is not in the mix. Its SUB 1 (about 36 Hz) gates PLAY IN, its SUB 2 frequency-modulates the cutoff, and SEQ 2 sweeps its pulse width. VCO 2 and its subs make the beeping tones, bent by the VCA EG patched into VCO 2 IN. The sheet says to change VCO 1’s SUB 1 FREQ to change the rhythm.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 21.0 % → 466 Hz (B♭4) · SUB 1 ÷13 (D1 -41c) · SUB 2 ÷14 (C1 +31c) · WAVE UP (all square) |
| VCO 2 | FREQ 53.0 % → 1.11 kHz (C♯6) · SUB 1 ÷7 (E♭3 +31c) · SUB 2 ÷7 (E♭3 +31c) · WAVE UP (all square) |
| Mixer | VCO 1 0 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 82 % · SUB 1 81 % · SUB 2 70 % |
| VCF | CUTOFF 60 % → 1.26 kHz · RESONANCE 100 % · VCF EG AMT 79.5 % → +59 % |
| EGs | VCF ATTACK 41 % → 44 ms · VCF DECAY 32 % → 57 ms · VCA ATTACK 12 % → 3 ms · VCA DECAY 47 % → 178 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | -39 % (-0.78 V) · +60 % (+1.20 V) · -74 % (-1.48 V) · +30 % (+0.60 V) → C♯4 C6 E3 F5 |
| SEQ 2 steps | -5 % (-0.10 V) · -30 % (-0.60 V) · +60 % (+1.20 V) · +11 % (+0.22 V) |
| Rhythm | TEMPO 42 % → 1272 BPM (21.2 Hz master pulse) · RHYTHM 1 ÷11 → SEQ 1 · RHYTHM 2 ÷11 → SEQ 2 · RHYTHM 3 ÷8 (unassigned) · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY off / unlit (see notes) |
| Cables | `out_vco1_sub1` → `in_play`, `out_vca_eg` → `in_vco2`, `out_vco1_sub2` → `in_cutoff`, `out_seq2` → `in_vco1_pwm` |
| Perform | VCO 1 SUB 1 FREQ: changes the stop/start rate |
| Reading notes | PLAY is unlit on the sheet because PLAY IN runs the transport. |

```ts
xpb_touchtone: {
  name: 'Rhythm / Sub-Gated Dial Tones',
  settings: {
    vco1_freq: 466.16, vco1_sub1_freq: D(13), vco1_sub2_freq: D(14), vco1_wave: 0,
    vco2_freq: 1108.73, vco2_sub1_freq: D(7), vco2_sub2_freq: D(7), vco2_wave: 0,
    vco1_level: 0, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 82, vco2_sub1_level: 81, vco2_sub2_level: 70,
    cutoff: 1262, resonance: 100, vcf_eg_amt: 59, vcf_attack: 43.7, vcf_decay: 56.9, vca_attack: 3.0, vca_decay: 178.0, volume: 51,
    seq_oct: 1, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -39, seq1_step2: 60, seq1_step3: -74, seq1_step4: 30,
    seq2_step1: -5, seq2_step2: -30, seq2_step3: 60, seq2_step4: 11,
    rhythm1: D(11), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(11), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(8), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1272, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vco1_sub1', to: 'in_play' }, { from: 'out_vca_eg', to: 'in_vco2' }, { from: 'out_vco1_sub2', to: 'in_cutoff' }, { from: 'out_seq2', to: 'in_vco1_pwm' }],
},
```

### 25. Rhythm / Marching Sub Clicks

*Source:* XPB p.10 (patch 8), ‘Ant Parade’ · *Type:* Moog patch sheet

CLOCK OUT patched into VCO 1 IN kicks VCO 1’s pitch up on every master pulse, making clicky footsteps. SEQ 2 re-divides VCO 1’s subs through VCO 1 SUB IN, while Sequencer 1 moves VCO 1 and both its subs. Millisecond envelopes and a negative EG AMT keep it tight. The sheet suggests fading in VCO 2’s SUB 1 and SUB 2 for low end.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 57.0 % → 1.26 kHz (E♭6 +16c) · SUB 1 ÷8 (E♭3 +16c) · SUB 2 ÷1 (E♭6 +16c) · WAVE UP (all square) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷16 (C0) · SUB 2 ÷16 (C0) · WAVE UP (all square) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 81 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 100 % → 20.00 kHz · RESONANCE 40 % · VCF EG AMT 30.5 % → -39 % |
| EGs | VCF ATTACK 24 % → 9 ms · VCF DECAY 12 % → 12 ms · VCA ATTACK 13 % → 3 ms · VCA DECAY 25 % → 33 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE 12-JI · SEQ 1 ASSIGN OSC 1/SUB 1/SUB 2 · SEQ 2 ASSIGN none |
| SEQ 1 steps | -20 % (-0.40 V) · -24 % (-0.48 V) · +34 % (+0.68 V) · -53 % (-1.06 V) → B5 -12c B♭5 +18c C7 E♭5 +16c |
| SEQ 2 steps | +60 % (+1.20 V) · -19 % (-0.38 V) · -4 % (-0.08 V) · -9 % (-0.18 V) |
| Rhythm | TEMPO 62 % → 1868 BPM (31.1 Hz master pulse) · RHYTHM 1 ÷9 → SEQ 1 · RHYTHM 2 ÷10 → SEQ 2 · RHYTHM 3 ÷8 (unassigned) · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_clock` → `in_vco1`, `out_seq2` → `in_vco1_sub` |
| Perform | VCO 2 SUB 1 + SUB 2 LEVEL: fade in for low end |
| Reading notes | RHYTHM 1 and 2 and VCO 1 SUB 1 sit between detents (÷9/÷8, ÷10/÷9, ÷8/÷9). |

```ts
xpb_ants: {
  name: 'Rhythm / Marching Sub Clicks',
  settings: {
    vco1_freq: 1255.80, vco1_sub1_freq: D(8), vco1_sub2_freq: D(1), vco1_wave: 0,
    vco2_freq: 261.63, vco2_sub1_freq: D(16), vco2_sub2_freq: D(16), vco2_wave: 0,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 81, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 20000, resonance: 40, vcf_eg_amt: -39, vcf_attack: 9.1, vcf_decay: 12.4, vca_attack: 3.3, vca_decay: 33.4, volume: 51,
    seq_oct: 1, quantize: 3, seq1_osc: true, seq1_sub1: true, seq1_sub2: true, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -20, seq1_step2: -24, seq1_step3: 34, seq1_step4: -53,
    seq2_step1: 60, seq2_step2: -19, seq2_step3: -4, seq2_step4: -9,
    rhythm1: D(9), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(10), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(8), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1868, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_clock', to: 'in_vco1' }, { from: 'out_seq2', to: 'in_vco1_sub' }],
},
```

### 26. Bass / Octave-Shifting Fuzz

*Source:* XPB p.11 (patch 9), ‘Octave Fuzz’ · *Type:* Moog patch sheet

SEQ 2 into VCO 1 IN, with steps of −1, 0, +1 and 0 V, shifts Sequencer 1’s riff by an octave on each slow step (÷16), as the sheet’s note says. VCO 1 SUB 1 into VCA IN adds audio-rate amplitude modulation: the fuzz. The filter is nearly closed and EG AMT is at maximum, so every note barks.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷4 (C3) · SUB 2 ÷7 (D2 +31c) · WAVE UP (all square) |
| VCO 2 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷16 (C1) · SUB 2 ÷16 (C1) · WAVE UP (all square) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 81 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 12 % → 46 Hz · RESONANCE 40 % · VCF EG AMT 99.5 % → +99 % |
| EGs | VCF ATTACK 37 % → 30 ms · VCF DECAY 25 % → 33 ms · VCA ATTACK 24 % → 9 ms · VCA DECAY 24 % → 31 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-JI · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | -20 % (-0.20 V) · +20 % (+0.20 V) · -40 % (-0.40 V) · -20 % (-0.20 V) → B♭4 +18c D5 +4c G4 +2c B♭4 +18c |
| SEQ 2 steps | -99 % (-0.99 V) · +0 % (+0.00 V) · +100 % (+1.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 32 % → 974 BPM (16.2 Hz master pulse) · RHYTHM 1 ÷3 → SEQ 1 · RHYTHM 2 ÷16 → SEQ 2 · RHYTHM 3 ÷8 (unassigned) · RHYTHM 4 ÷8 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_seq2` → `in_vco1`, `out_vco1_sub1` → `in_vca` |
| Reading notes | VCO 1 SUB 1 and SUB 2 and RHYTHM 2 sit near detent boundaries (÷4/÷5, ÷7/÷6, ÷16/÷15). |

```ts
xpb_octave: {
  name: 'Bass / Octave-Shifting Fuzz',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(4), vco1_sub2_freq: D(7), vco1_wave: 0,
    vco2_freq: 523.25, vco2_sub1_freq: D(16), vco2_sub2_freq: D(16), vco2_wave: 0,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 81, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 46, resonance: 40, vcf_eg_amt: 99, vcf_attack: 30.2, vcf_decay: 33.4, vca_attack: 9.1, vca_decay: 31.0, volume: 51,
    seq_oct: 0, quantize: 3, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -20, seq1_step2: 20, seq1_step3: -40, seq1_step4: -20,
    seq2_step1: -99, seq2_step2: 0, seq2_step3: 100, seq2_step4: 0,
    rhythm1: D(3), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(16), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(8), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(8), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 974, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_seq2', to: 'in_vco1' }, { from: 'out_vco1_sub1', to: 'in_vca' }],
},
```

### 27. FX / Folded High Chimes

*Source:* XPB p.12 (patch 10), ‘Aliased Wind Chimes’ · *Type:* Moog patch sheet

VCO 1 sits at the top of its range with both subs in unison, and the sequencer pushes it toward the 10 kHz ceiling, where the subs can no longer be generated accurately (MAN p.27). That aliasing is the point. The VCA EG and VCO 2 SUB 1 modulate RHYTHM 3 and 4, and SEQ 1 CLK flicks the cutoff for chime-like strikes.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 100.0 % → 4.19 kHz (C8) · SUB 1 ÷1 (C8) · SUB 2 ÷1 (C8) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷16 (C0) · SUB 2 ÷16 (C0) · WAVE UP (all square) |
| Mixer | VCO 1 81 % · SUB 1 81 % · SUB 2 81 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 100 % → 20.00 kHz · RESONANCE 70 % · VCF EG AMT 30.5 % → -39 % |
| EGs | VCF ATTACK 24 % → 9 ms · VCF DECAY 25 % → 33 ms · VCA ATTACK 24 % → 9 ms · VCA DECAY 25 % → 33 ms · VOLUME 51 % |
| Sequencer | SEQ OCT ±2 · QUANTIZE OFF · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | -29 % (-0.58 V) · -19 % (-0.38 V) · +20 % (+0.40 V) · +8 % (+0.16 V) → F7 +4c G7 +44c F8 -20c D8 -8c |
| SEQ 2 steps | -33 % (-0.66 V) · +34 % (+0.68 V) · -66 % (-1.32 V) · +66 % (+1.32 V) |
| Rhythm | TEMPO 34 % → 1033 BPM (17.2 Hz master pulse) · RHYTHM 1 ÷3 → SEQ 1 · RHYTHM 2 ÷13 → SEQ 2 · RHYTHM 3 ÷13 → SEQ 2 · RHYTHM 4 ÷8 → SEQ 1 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | `out_vca_eg` → `in_rhythm3`, `out_vco2_sub1` → `in_rhythm4`, `out_seq1_clk` → `in_cutoff` |
| Reading notes | For this patch to sound right, the twin must model the sub inaccuracy above 10 kHz, or at least allow the aliasing. |

```ts
xpb_chimes: {
  name: 'FX / Folded High Chimes',
  settings: {
    vco1_freq: 4186.01, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 2,
    vco2_freq: 261.63, vco2_sub1_freq: D(16), vco2_sub2_freq: D(16), vco2_wave: 0,
    vco1_level: 81, vco1_sub1_level: 81, vco1_sub2_level: 81, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 20000, resonance: 70, vcf_eg_amt: -39, vcf_attack: 9.1, vcf_decay: 33.4, vca_attack: 9.1, vca_decay: 33.4, volume: 51,
    seq_oct: 1, quantize: 0, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: -29, seq1_step2: -19, seq1_step3: 20, seq1_step4: 8,
    seq2_step1: -33, seq2_step2: 34, seq2_step3: -66, seq2_step4: 66,
    rhythm1: D(3), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(13), rhythm2_seq1: false, rhythm2_seq2: true,
    rhythm3: D(13), rhythm3_seq1: false, rhythm3_seq2: true, rhythm4: D(8), rhythm4_seq1: true, rhythm4_seq2: false,
    tempo: 1033, rhythm_logic: 0, eg_mode: 1,
  },
  patchConnections: [{ from: 'out_vca_eg', to: 'in_rhythm3' }, { from: 'out_vco2_sub1', to: 'in_rhythm4' }, { from: 'out_seq1_clk', to: 'in_cutoff' }],
},
```

### 28. Just Intonation / Major Lattice

*Source:* our design, using the manual’s just C-major ratios (MAN p.16) and the quantized VCO FREQ knob (MAN p.17) · *Type:* Our design

With 12-JI on, VCO 1 FREQ snaps to G4 (3/2) and VCO 2 FREQ to E4 (5/4). VCO 1 ÷3 = C3 and ÷6 = C2; VCO 2 ÷2 = E3, and its ÷5 lands exactly on C2 again. EG HELD sustains the result: a wide, beat-free C-major chord.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 14.6 % → 392 Hz (G4 +2c) · SUB 1 ÷3 (C3) · SUB 2 ÷6 (C2) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 8.0 % → 327 Hz (E4 -14c) · SUB 1 ÷2 (E3 -14c) · SUB 2 ÷5 (C2) · WAVE DOWN (all saw) |
| Mixer | VCO 1 25 % · SUB 1 55 % · SUB 2 45 % ‖ VCO 2 25 % · SUB 1 45 % · SUB 2 30 % |
| VCF | CUTOFF 66.7 % → 2.00 kHz · RESONANCE 10 % · VCF EG AMT 50 % → +0 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 50 % → 224 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 50 % → 224 ms · VOLUME 55 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-JI · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) → G4 +2c G4 +2c G4 +2c G4 +2c |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) → E4 -14c E4 -14c E4 -14c E4 -14c |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷1 (unassigned) · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG HELD · PLAY off / unlit (see notes) |
| Cables | none |

```ts
ji_major: {
  name: 'Just Intonation / Major Lattice',
  settings: {
    vco1_freq: 392.44, vco1_sub1_freq: D(3), vco1_sub2_freq: D(6), vco1_wave: 2,
    vco2_freq: 327.03, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_wave: 2,
    vco1_level: 25, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 25, vco2_sub1_level: 45, vco2_sub2_level: 30,
    cutoff: 2005, resonance: 10, vcf_eg_amt: 0, vcf_attack: 1.0, vcf_decay: 223.6, vca_attack: 1.0, vca_decay: 223.6, volume: 55,
    seq_oct: 0, quantize: 3, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 0, seq1_step3: 0, seq1_step4: 0,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(1), rhythm1_seq1: false, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 2,
  },
},
```

### 29. Just Intonation / Same Chord in 12-ET

*Source:* our design (the A/B partner of Major Lattice) · *Type:* Our design

The same knob positions with QUANTIZE on 12-ET. VCO 2’s ÷5 sub (65.93 Hz) now beats at about 0.6 Hz against VCO 1’s ÷6 (65.33 Hz), and the third is 13.7 cents wider than 5/4. This pair is the ear-training A/B.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 14.6 % → 392 Hz (G4) · SUB 1 ÷3 (C3 -2c) · SUB 2 ÷6 (C2 -2c) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 8.0 % → 330 Hz (E4) · SUB 1 ÷2 (E3) · SUB 2 ÷5 (C2 +14c) · WAVE DOWN (all saw) |
| Mixer | VCO 1 25 % · SUB 1 55 % · SUB 2 45 % ‖ VCO 2 25 % · SUB 1 45 % · SUB 2 30 % |
| VCF | CUTOFF 66.7 % → 2.00 kHz · RESONANCE 10 % · VCF EG AMT 50 % → +0 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 50 % → 224 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 50 % → 224 ms · VOLUME 55 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) → G4 G4 G4 G4 |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) → E4 E4 E4 E4 |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷1 (unassigned) · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG HELD · PLAY off / unlit (see notes) |
| Cables | none |

```ts
ji_major_et: {
  name: 'Just Intonation / Same Chord in 12-ET',
  settings: {
    vco1_freq: 392.00, vco1_sub1_freq: D(3), vco1_sub2_freq: D(6), vco1_wave: 2,
    vco2_freq: 329.63, vco2_sub1_freq: D(2), vco2_sub2_freq: D(5), vco2_wave: 2,
    vco1_level: 25, vco1_sub1_level: 55, vco1_sub2_level: 45, vco2_level: 25, vco2_sub1_level: 45, vco2_sub2_level: 30,
    cutoff: 2005, resonance: 10, vcf_eg_amt: 0, vcf_attack: 1.0, vcf_decay: 223.6, vca_attack: 1.0, vca_decay: 223.6, volume: 55,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 0, seq1_step3: 0, seq1_step4: 0,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(1), rhythm1_seq1: false, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 2,
  },
},
```

### 30. Drone / Undertone Minor

*Source:* our design (the MAN p.10 undertone table) · *Type:* Our design

One VCO at C6 with SUB 1 ÷5 (A♭3) and SUB 2 ÷6 (F3). f/6 : f/5 : f makes a just F-minor chord, and because all three tones come from one oscillator they are phase-locked and never beat.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷5 (A♭3 +14c) · SUB 2 ÷6 (F3 -2c) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 25 % · SUB 1 60 % · SUB 2 60 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 59 % → 1.18 kHz · RESONANCE 15 % · VCF EG AMT 50 % → +0 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 50 % → 224 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 50 % → 224 ms · VOLUME 55 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE OFF · SEQ 1 ASSIGN none · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 50 % → 1510 BPM (25.2 Hz master pulse) · RHYTHM 1 ÷1 (unassigned) · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG HELD · PLAY off / unlit (see notes) |
| Cables | none |

```ts
drone_minor: {
  name: 'Drone / Undertone Minor',
  settings: {
    vco1_freq: 1046.50, vco1_sub1_freq: D(5), vco1_sub2_freq: D(6), vco1_wave: 2,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 25, vco1_sub1_level: 60, vco1_sub2_level: 60, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 1178, resonance: 15, vcf_eg_amt: 0, vcf_attack: 1.0, vcf_decay: 223.6, vca_attack: 1.0, vca_decay: 223.6, volume: 55,
    seq_oct: 0, quantize: 0, seq1_osc: false, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 0, seq1_step3: 0, seq1_step4: 0,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(1), rhythm1_seq1: false, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 1510, rhythm_logic: 0, eg_mode: 2,
  },
},
```

### 31. Polyrhythm / Hemiola 2+3 (OR)

*Source:* our design (the MAN p.43 rhythm logic) · *Type:* Our design

RHYTHM 1 ÷2 and RHYTHM 2 ÷3 both clock Sequencer 1. The composite is x.xxx. (4 hits per 6 pulses), so the 4-step riff locks to the 6-pulse cycle. RHYTHM 4 ÷6 moves the bass on Sequencer 2.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷1 (C5) · SUB 2 ÷1 (C5) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷4 (C2) · SUB 2 ÷1 (C4) · WAVE UP (all square) |
| Mixer | VCO 1 60 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 60 % · SUB 2 0 % |
| VCF | CUTOFF 50 % → 632 Hz · RESONANCE 25 % · VCF EG AMT 70 % → +40 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 35 % → 72 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 38 % → 90 ms · VOLUME 60 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C5 E♭5 G5 F5 |
| SEQ 2 steps | +0 % (+0.00 V) · -17 % (-0.17 V) · -33 % (-0.33 V) · -42 % (-0.42 V) → C4 B♭3 A♭3 G3 |
| Rhythm | TEMPO 15.4 % → 479 BPM (8.0 Hz master pulse) · RHYTHM 1 ÷2 → SEQ 1 · RHYTHM 2 ÷3 → SEQ 1 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷6 → SEQ 2 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
poly_or: {
  name: 'Polyrhythm / Hemiola 2+3 (OR)',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 2,
    vco2_freq: 261.63, vco2_sub1_freq: D(4), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 60, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 60, vco2_sub2_level: 0,
    cutoff: 632, resonance: 25, vcf_eg_amt: 40, vcf_attack: 1.0, vcf_decay: 71.5, vca_attack: 1.0, vca_decay: 89.8, volume: 60,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 0, seq2_step2: -17, seq2_step3: -33, seq2_step4: -42,
    rhythm1: D(2), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(3), rhythm2_seq1: true, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(6), rhythm4_seq1: false, rhythm4_seq2: true,
    tempo: 479, rhythm_logic: 0, eg_mode: 1,
  },
},
```

### 32. Polyrhythm / Missing Downbeat (XOR)

*Source:* our design (the MAN p.43 rhythm logic) · *Type:* Our design

Identical to Hemiola 2+3 except for XOR logic. Pulse 0, where both generators fire, is cancelled (..xxx.), so the riff needs 24 pulses to come round and the downbeat disappears. Sequencer 2 has a single generator, so XOR leaves it unchanged.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷1 (C5) · SUB 2 ÷1 (C5) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷4 (C2) · SUB 2 ÷1 (C4) · WAVE UP (all square) |
| Mixer | VCO 1 60 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 60 % · SUB 2 0 % |
| VCF | CUTOFF 50 % → 632 Hz · RESONANCE 25 % · VCF EG AMT 70 % → +40 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 35 % → 72 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 38 % → 90 ms · VOLUME 60 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +0 % (+0.00 V) · +25 % (+0.25 V) · +58 % (+0.58 V) · +42 % (+0.42 V) → C5 E♭5 G5 F5 |
| SEQ 2 steps | +0 % (+0.00 V) · -17 % (-0.17 V) · -33 % (-0.33 V) · -42 % (-0.42 V) → C4 B♭3 A♭3 G3 |
| Rhythm | TEMPO 15.4 % → 479 BPM (8.0 Hz master pulse) · RHYTHM 1 ÷2 → SEQ 1 · RHYTHM 2 ÷3 → SEQ 1 · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷6 → SEQ 2 · LOGIC XOR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
poly_xor: {
  name: 'Polyrhythm / Missing Downbeat (XOR)',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 2,
    vco2_freq: 261.63, vco2_sub1_freq: D(4), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 60, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 60, vco2_sub2_level: 0,
    cutoff: 632, resonance: 25, vcf_eg_amt: 40, vcf_attack: 1.0, vcf_decay: 71.5, vca_attack: 1.0, vca_decay: 89.8, volume: 60,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 25, seq1_step3: 58, seq1_step4: 42,
    seq2_step1: 0, seq2_step2: -17, seq2_step3: -33, seq2_step4: -42,
    rhythm1: D(2), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(3), rhythm2_seq1: true, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(6), rhythm4_seq1: false, rhythm4_seq2: true,
    tempo: 479, rhythm_logic: 1, eg_mode: 1,
  },
},
```

### 33. Polyrhythm / 3 Against 4

*Source:* our design (MAN p.14 and p.29) · *Type:* Our design

RHYTHM 3 ÷3 → Sequencer 1 and RHYTHM 4 ÷4 → Sequencer 2. Onsets meet every 12 pulses, and both 4-step loops realign every 48. At 480 BPM that is four bars of 16ths at 120 BPM.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 25.0 % → 523 Hz (C5) · SUB 1 ÷1 (C5) · SUB 2 ÷1 (C5) · WAVE DOWN (all saw) |
| VCO 2 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷2 (C3) · SUB 2 ÷1 (C4) · WAVE UP (all square) |
| Mixer | VCO 1 55 % · SUB 1 0 % · SUB 2 0 % ‖ VCO 2 0 % · SUB 1 55 % · SUB 2 0 % |
| VCF | CUTOFF 50 % → 632 Hz · RESONANCE 20 % · VCF EG AMT 70 % → +40 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 32 % → 57 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 36 % → 77 ms · VOLUME 60 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN OSC 2 |
| SEQ 1 steps | +0 % (+0.00 V) · +58 % (+0.58 V) · +25 % (+0.25 V) · +83 % (+0.83 V) → C5 G5 E♭5 B♭5 |
| SEQ 2 steps | +0 % (+0.00 V) · -42 % (-0.42 V) · -17 % (-0.17 V) · +42 % (+0.42 V) → C4 G3 B♭3 F4 |
| Rhythm | TEMPO 15.4 % → 479 BPM (8.0 Hz master pulse) · RHYTHM 1 ÷1 (unassigned) · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷3 → SEQ 1 · RHYTHM 4 ÷4 → SEQ 2 · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
poly_34: {
  name: 'Polyrhythm / 3 Against 4',
  settings: {
    vco1_freq: 523.25, vco1_sub1_freq: D(1), vco1_sub2_freq: D(1), vco1_wave: 2,
    vco2_freq: 261.63, vco2_sub1_freq: D(2), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 55, vco1_sub1_level: 0, vco1_sub2_level: 0, vco2_level: 0, vco2_sub1_level: 55, vco2_sub2_level: 0,
    cutoff: 632, resonance: 20, vcf_eg_amt: 40, vcf_attack: 1.0, vcf_decay: 56.9, vca_attack: 1.0, vca_decay: 77.2, volume: 60,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: true, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 58, seq1_step3: 25, seq1_step4: 83,
    seq2_step1: 0, seq2_step2: -42, seq2_step3: -17, seq2_step4: 42,
    rhythm1: D(1), rhythm1_seq1: false, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(3), rhythm3_seq1: true, rhythm3_seq2: false, rhythm4: D(4), rhythm4_seq1: false, rhythm4_seq2: true,
    tempo: 479, rhythm_logic: 0, eg_mode: 1,
  },
},
```

### 34. Bass / Square Sub Bass

*Source:* our design (a common community technique) · *Type:* Our design

VCO 1 is muted and WAVE UP makes the subs square. ÷4 and ÷8 put the energy at C2 and C1, under a low, short filter envelope. This is the standard way to get deep bass from an instrument whose VCOs start at middle C.

| Section | Settings (knob % of travel → real value) |
|---|---|
| VCO 1 | FREQ 0.0 % → 262 Hz (C4) · SUB 1 ÷4 (C2) · SUB 2 ÷8 (C1) · WAVE UP (all square) |
| VCO 2 | FREQ 50.0 % → 1.05 kHz (C6) · SUB 1 ÷1 (C6) · SUB 2 ÷1 (C6) · WAVE UP (all square) |
| Mixer | VCO 1 0 % · SUB 1 75 % · SUB 2 40 % ‖ VCO 2 0 % · SUB 1 0 % · SUB 2 0 % |
| VCF | CUTOFF 40 % → 317 Hz · RESONANCE 25 % · VCF EG AMT 70 % → +40 % |
| EGs | VCF ATTACK 0 % → 1 ms · VCF DECAY 30 % → 49 ms · VCA ATTACK 0 % → 1 ms · VCA DECAY 36 % → 77 ms · VOLUME 65 % |
| Sequencer | SEQ OCT ±1 · QUANTIZE 12-ET · SEQ 1 ASSIGN OSC 1 · SEQ 2 ASSIGN none |
| SEQ 1 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +25 % (+0.25 V) · -17 % (-0.17 V) → C4 C4 E♭4 B♭3 |
| SEQ 2 steps | +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) · +0 % (+0.00 V) |
| Rhythm | TEMPO 15.4 % → 479 BPM (8.0 Hz master pulse) · RHYTHM 1 ÷2 → SEQ 1 · RHYTHM 2 ÷1 (unassigned) · RHYTHM 3 ÷1 (unassigned) · RHYTHM 4 ÷1 (unassigned) · LOGIC OR |
| Transport | EG ON · PLAY on (press PLAY) |
| Cables | none |

```ts
bass_sub: {
  name: 'Bass / Square Sub Bass',
  settings: {
    vco1_freq: 261.63, vco1_sub1_freq: D(4), vco1_sub2_freq: D(8), vco1_wave: 0,
    vco2_freq: 1046.50, vco2_sub1_freq: D(1), vco2_sub2_freq: D(1), vco2_wave: 0,
    vco1_level: 0, vco1_sub1_level: 75, vco1_sub2_level: 40, vco2_level: 0, vco2_sub1_level: 0, vco2_sub2_level: 0,
    cutoff: 317, resonance: 25, vcf_eg_amt: 40, vcf_attack: 1.0, vcf_decay: 48.9, vca_attack: 1.0, vca_decay: 77.2, volume: 65,
    seq_oct: 0, quantize: 1, seq1_osc: true, seq1_sub1: false, seq1_sub2: false, seq2_osc: false, seq2_sub1: false, seq2_sub2: false,
    seq1_step1: 0, seq1_step2: 0, seq1_step3: 25, seq1_step4: -17,
    seq2_step1: 0, seq2_step2: 0, seq2_step3: 0, seq2_step4: 0,
    rhythm1: D(2), rhythm1_seq1: true, rhythm1_seq2: false, rhythm2: D(1), rhythm2_seq1: false, rhythm2_seq2: false,
    rhythm3: D(1), rhythm3_seq1: false, rhythm3_seq2: false, rhythm4: D(1), rhythm4_seq1: false, rhythm4_seq2: false,
    tempo: 479, rhythm_logic: 0, eg_mode: 1,
  },
},
```

## Studio setups (multi-device; for the studio lessons)

| Setup | How | Source |
|---|---|---|
| Subharmonicon clocks DFAM | Subharmonicon `out_clock` → DFAM `in_adv_clock`. Press DFAM RUN/STOP first, then Subharmonicon PLAY. For a polyrhythmic DFAM, use `out_trigger`, `out_seq1_clk` or `out_seq2_clk` instead | MAN p.37 (verified) |
| Mother-32 clocks Subharmonicon | Mother-32 ASSIGN output set to clock → `in_clock`. Press Subharmonicon PLAY first, then Mother-32 RUN/STOP | MAN p.38 (verified) |
| Studio Clock → Subharmonicon (analog) | Turn studio sync **off** for the Subharmonicon. Patch Studio Clock `out_clock` → `in_clock`, `out_reset` → `in_reset` and `out_run` → `in_play` (PLAY IN is gate-level) | MAN p.33, p.36; twin ids from `devices/studio-clock` |
| Studio (MIDI) sync | Sync on: the master pulse is a 16th note, TEMPO is ignored, and the transport starts and stops PLAY (Play transport defaults to ON) | MAN p.24, p.43 |

