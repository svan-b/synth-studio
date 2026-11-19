# Moog Mother-32: sources (v2)

These are the research sources for the Mother-32 digital twin. The other files are
`signal-flow.md` (spec and signal flow), `presets.md` (patches) and `lessons.md` (lesson
outlines).

## Primary source (v2): the Owner's Manual

**Mother-32 Owner's Manual, "User Manual Version 2", ©2020 Moog Music** (73 PDF pages). The
coordinator supplied a local copy at
`scratchpad/manuals/mother32/Mother_32_Owners_Manual/`, with `text.txt`, `toc.txt`, `hires/`
and `pages/`.

- **Page convention**: "M32 p.N" means the *PDF page* (the `===== page N =====` marker). The
  printed page number is N − 1. For example, the patch bay overview is M32 p.47, printed 46.
- It covers firmware 2.0: swing, clock divisions, directions, TEMPO-input modes 3–4 and
  Setup page 8. So the FW 2.0 addendum, which the search reached only in excerpts, is no longer
  needed.
- Read in full for this research: every page of `text.txt`, the default-panel drawing (p.10,
  hires), the patch-bay page (p.47, hires), and the nine patch sheets (pp.65–67). The sheets
  were cropped and upscaled with ImageMagick (`scratchpad/m32tools/`) to read knob angles.
- **Copyright rules followed** (`scratchpad/manuals/COPYRIGHT-RULES.md`):
  - Facts are restated in our own words.
  - Any quote is one sentence of 25 words or fewer, with a page cite.
  - No artwork is copied.
  - Patches are recreated as settings under descriptive names, with the manual's title in the
    description only.
  - Lessons are original writing.
  - **Nothing from the manual folder may be copied into the repository.**

### Related Moog documents (same local folder tree)

| Id | Document | Pages used | Used for |
|---|---|---|---|
| DFAMM | DFAM Owner's Manual with Patch Sheets (`manuals/dfam/DFAM_Owners_Manual_with_Patch_Sheets/`) | p.31 "Syncing DFAM with a Mother-32" | the official M32 → DFAM clock procedure |
| SUBM | Subharmonicon Owner's Manual (`manuals/subharmonicon/Subharmonicon_Owners_Manual/`) | p.38 "Syncing Subharmonicon to your Mother-32" | the official M32 → Subharmonicon clock procedure |
| ELEC | Moog House of Electronicus Patch Book (`manuals/dfam/DFAM_Electronicus_Patchbook/`), 7 DFAM + Mother-32 patches | pp.3–10 (text and drawings) | M32 + DFAM pairing; studio presets E1–E7 |

## Short quotations from the manual (each ≤ 25 words)

These are only where the exact wording matters. Everything else is paraphrased in
`signal-flow.md`, with page cites.

- 1V/OCT summing: the input "is summed internally with the VCO FREQUENCY knob, the Keyboard CV
  and any VCO frequency modulation" (M32 p.49).
- Tuning reference: "Set the Keyboard Octave to '5' and press low C (Step 1) on the keyboard
  (KB CV outputs 0V)" (M32 p.63). The next step checks for C4, 261.6 Hz.
- Default octave: "The default octave setting is 4 and the default reference note is low C."
  (M32 p.30)
- SUSTAIN OFF: the attack moves to decay "when complete, or when a note is released depending
  on which occurs first" (M32 p.17).
- Resonance: "Settings above 3 o'clock will cause the Filter to self-oscillate" (M32 p.15).
- HI PASS: "The Hi Pass Filter is a classic Moog 24dB/Octave non-resonant Ladder Filter." (M32
  p.15)
- Accent: "Accent signals are routed internally to the VCF and VCA at a fixed level." (M32 p.19)
- Gate inputs: "Patch points with circles around them are Gate inputs." (M32 p.47)
- MULT: "It is designed to be used ONLY as a CV signal splitter." (M32 p.52)
- VCA CV: "0 to +8V in EG mode and +/-5V in ON mode, summed with signals from ON/EG switch"
  (M32 p.48).
- RUN/STOP input: the sequencer plays from its current location "for the duration that the
  voltage is applied" (M32 p.57).
- Clock priority: "A connected Analog Clock will override a connected MIDI clock, and / or the
  internal clock." (M32 p.56)
- Swing range: "The range is from -100% to 100%." (M32 p.29)
- MIDI Start: "A MIDI Start message runs the pattern from Step 1." (M32 p.58)

## What the manual verified, corrected or added (compared with v1, which was search-based)

| Topic | v1 belief | v2 (manual) |
|---|---|---|
| VCO 1V/OCT and KB | "likely sums" (VP) | **sums** (p.49) |
| KB voltage map | derived guess (C4 = 0 V) | **verified**: octave 5 low C = 0 V = C4 = 261.6 Hz; default octave 4 (pp.30, 63) |
| SUSTAIN OFF | AD regardless of the gate | the attack is cut short at gate-off (p.17) |
| SUSTAIN and legato | spec-sheet wording | ON: overlapping notes don't retrigger; OFF: every note retriggers (p.17) |
| Swing | 50 % = straight | the knob's centre is straight. The range is −100 %…+100 % (p.29); p.20 also describes it as an on-beat share |
| Clock division | addendum excerpts | 24 values and the button combinations (p.55) |
| TEMPO input | VP's mode list | all 4 modes fully described; Single Clock Advance is the default and needs edges faster than 1 V/ms (p.56) |
| Gate-input rings | GATE, TEMPO, RUN/STOP, RESET, HOLD (twin) | **GATE, RUN / STOP, RESET, HOLD only** (p.47) |
| Step Random | assumed 0–5 V | **−5…+5 V** (p.53) |
| ASSIGN levels | likely | every source's level documented (p.53) |
| VC MIX CTRL / MIX CV / VCF RES CV | guessed +5 V = full | **±5 V around a centred knob = full travel** (pp.48–51) |
| Switch orientations | VP "likely" | **verified** from the panel drawings (pp.10, 65–67) |
| Panel layout | unknown | the full layout from the drawings (`signal-flow.md` §1.1) |
| Patch sheets | not reached | **nine patches** read and recreated (pp.65–67) |
| MIDI | VP and forum | complete implementation: Program Change 1–64 = pattern, 71–86 = ASSIGN mode; Start / Stop / Continue (pp.57–58) |
| Setup | addendum excerpts | all 8 pages and their global defaults (pp.59–62) |
| Pre-arm | forum paraphrase | KB + STEP + RUN/STOP; RESET after arming starts from step 1 (p.41) |
| Pattern banks | Moog support | the full PATTERN (BANK) workflow, Delay Pattern Change, Load Saved Timing, Auto Save and Write Protect (pp.38–40) |
| GATE in normal | twin replaces | not documented. The manual documents overrides for EXT. AUDIO and VCO MOD only, so likely OR (signal-flow note 2) |
| EG times | Moog via SOS | **not in the manual**: kept from SOS (Moog-sourced, "nominal") |

## Secondary sources (from the v1 search phase; now supporting only)

| Id | Source | Where | Still used for |
|---|---|---|---|
| SPEC | Moog's spec list as reproduced by retailers (Long & McQuade, zZounds, Parkway, Stars Music, Gear4music PDF) | search excerpts | cross-checks only. The manual (p.71) has the specifications |
| SOS | Sound On Sound review, `https://www.soundonsound.com/reviews/moog-mother-32` | search excerpts | **EG time ranges** from Moog: attack 1.25–3000 ms, decay 1.25–7000 ms, nominal. Also the HP mid-range character |
| MT / MR / MX | MusicTech, MusicRadar and Mixdown reviews | search excerpts | the low-end drop as resonance rises |
| FW2 | Firmware 2.0 addendum (api.moogmusic.com …/Mother-32_Firmware_Update_V2.0.pdf; mirror manualshive) | search excerpts | the swing on-beat caveat with an external clock; everything else is in M32 v2 |
| MS | Moog support articles (saving patterns, playback direction) | search excerpts | superseded by M32 pp.38–41 |
| LM / DJ / AF | Learning Modular, the djjondent blog, Audiofanzine cheat sheet | search excerpts | superseded by M32 pp.24–46 |
| F | Moog forum threads (tempo floor, DIN sync → Analog Clock, pitch bend) | search excerpts | historical notes only |
| WP | Wikipedia "Moog Mother-32" | search excerpt | overview |

## Repositories (cloned into `research/mother32/repos/`, 17 MB in total)

| Path | Upstream | Licence | What it gave |
|---|---|---|---|
| `voltpages/` | github.com/ogabrielluiz/voltpages | MIT | the Mother-32 sheet `src/data/modules/moog-music--mother-32.json`. It agreed with the manual on almost everything; its patch ideas are credited in `presets.md` |
| `mothersdicegame/` | github.com/cemolcay/mothersdicegame | MIT | patch-bay grid and labels (`MotherDiceGame/Mother32.swift`, `pb-m32.png`); matches M32 p.47 |
| `aiotone/` | github.com/ambv/aiotone | MIT | MIDI practice with two Mother-32s (CC1 via ASSIGN, CC5/65, clock, start/stop) |
| `pencilresearch-midi/` | github.com/pencilresearch/midi (sparse `Moog/`) | CC BY-SA 4.0 | the CC list (1, 2, 4, 7, 5, 65, 64), as in M32 p.58 |
| `patchbook/` | github.com/spektroaudio/patchbook | MIT | patch notation |
| `vcv-library/` | github.com/VCVRack/library (sparse) | none stated | negative result: there is no Mother-32 clone in VCV Rack |

**Sequencer file format**: none exists. The Mother-32 has no pattern export; MIDI is used for
notes, clock and firmware (M32 p.22). The data model in `signal-flow.md` §11.8 is ours, built
from the documented step parameters.

## Repository files read (read-only; current code)

The worktree was checked out at **89801d8**. All of these are byte-identical to the main
checkout read earlier: `devices/mother32/*`, `devices/dfam/REFERENCE.md`,
`devices/dfam/lessons.ts`, `devices/dfam/spec.ts`, `devices/studio-clock/index.ts`,
`devices/types.ts`, `types/index.ts`, `docs/PEDAGOGY.md`, `docs/ADDING_A_DEVICE.md`,
`public/midi-guide/devices/moog-mother-32.json`, plus `scripts/validate-devices.ts`.
The validator rules matter for the lessons:
- ids must start with `mother32-`;
- every challenge needs a `solution` and `hints`;
- every predict step needs an action (`control`, `patchFrom` or `check`);
- instructions should be at most about 32 words;
- every do, patch and predict step needs a `principle`;
- every lesson needs at least 3 review questions.

## Remaining gaps (mark as model choices in the twin)

1. **GATE in normal**: not documented. Recommend OR (signal-flow §10 note 2).
2. **Depths and amounts**: VCO MOD AMOUNT and VCF MOD AMOUNT full scale, LIN FM depth,
   the accent amount ("fixed level" only), the GLIDE time range, and the exact knob tapers
   (except CUTOFF, whose decade legends are drawn).
3. **ASSIGN Clock vs Clock Output PPQN** (Setup p.5) when the division is not 1/16. The sheet
   text says "one pulse per step".
4. **The default clock division**: presumably 1/16, given the "4 PPQN = sixteenth note" defaults.
5. **Pendulum end steps** (repeated or not), and **key priority** (presumably last-note).
6. **Moog's online patch charts** named in the brief (Synthesized Kick Drum, Modulated Bass,
   Sequenced Filter, Analog Kick and Snare, Chugging Along, Accented Filter, Gallop,
   Randomnation): not in the manual and not reachable. `presets.md` has our own designs for the
   same goals, described honestly as ours.
7. **The Electronicus patch book** (7 DFAM + Mother-32 patches, pp.4–10): **done**, see
   `presets.md` E1–E7. The Mother-32 side is read to ±½ hour; the DFAM's small step and mixer
   knobs are approximate. Its garbled notes were decoded (a +7 character shift in the font).
