# Moog Subharmonicon: sources (v2)

This is the evidence file for `signal-flow.md`, `presets.md` and `lessons.md`. **v2** replaces v1. Moog's
own documents are now the primary sources, so v1's web-snippet quotes have been removed and the facts
are restated in our own words with page cites (per `manuals/COPYRIGHT-RULES.md`).

## Primary sources (Moog documents, local, read in full)

All three are in `scratchpad/manuals/subharmonicon/<doc>/`, with `text.txt` (page markers), `toc.txt`
and page renders. The raw PDFs are in `scratchpad/manuals-raw/moog-subharmonicon/05_Moog_Subharmonicon/`.
**Cite as "MAN p.N"** etc., where N is the PDF page (the `===== page N =====` marker). In the
manual the printed page number is N+1.

| Id | Document | Pages | What it provides |
|---|---|---|---|
| **MAN** | *Subharmonicon Owner's Manual* | 58 | every control and jack with ranges and levels (p.17–36). DFAM/Mother-32 sync recipes (p.37–38), Eurorack power (p.39), Fine Tune (p.40), the MIDI CC table and SysEx settings (p.41–43), **10 preset sheets** (p.44–48), the **signal-flow diagram** (p.55) and specifications (p.56). The tour and tutorial are on p.11–16 |
| **PWI** | *Subharmonicon: Patching with Intention* | 16 | the initialized patch (p.3, image); five exercises (p.4–10); every jack's **row/column position** with patch ideas (p.12–15) |
| **XPB** | *Subharmonicon Exploration Patchbook* | 14 | the "10 patches" book released with PWI: one patch per page on PDF p.3–12, each with a title and notes. Image only (no text layer) |

### Key facts and where they are

| Fact | Page |
|---|---|
| Six sources (2 VCOs, 4 subs), mixer → ladder LP → VCA; patch bay of 32 (17 in / 15 out); MIDI via a Type A TRS adapter | MAN p.6, p.8, p.30 |
| Undertone concept: f/2 … f/16 mirrors overtones f·2 … f·16; rhythm generators divide the clock the same way and re-sync on a common downbeat | MAN p.9–10 |
| VCO FREQ: four octaves, 262 Hz (CCW) to 4186 Hz (CW); with QUANTIZE on, the knob steps through the scale | MAN p.11, p.17, p.18, p.20 |
| SUB FREQ: VCO ÷ an integer 1–16 (CW = 1) | MAN p.17–19 |
| WAVE: UP all square · MIDDLE VCO pulse + subs saw, SUB 1 saw normalled to PWM · DOWN all saw. The middle position can add a second pitch even with SUB 1 LEVEL at zero | MAN p.18–19 |
| QUANTIZE: 12-ET / 8-ET (diatonic) / 12-JI / 8-JI, shared; all LEDs dark = off; hold the button to make the SEQ jacks unquantized | MAN p.20 |
| The just C-major ratios: 1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2/1; JI removes beating in minor chords | MAN p.16 |
| Mixer: warm distortion when sources are near maximum | MAN p.20 |
| Filter: Moog ladder LP, 4-pole, 24 dB/oct, CUTOFF 20 Hz–20 kHz; self-oscillates at high resonance with a low cutoff | MAN p.22, p.56 |
| VOLUME sets the output level; the VCA EG rises to the VOLUME level | MAN p.22–23 |
| EGs: Attack 1 ms–10 s, Decay 5 ms–10 s (both EGs); triggers are ignored during Attack; a gate holds at maximum; VCF EG AMT is bipolar | MAN p.23–24 |
| TEMPO 0.333–50 Hz = 20–3000 BPM (1 PPQ); CLOCK IN overrides it; MIDI clock overrides both; MIDI clock gives PPQ 4 (16ths) | MAN p.24 |
| Sequencers: 2 × 4 steps; each needs at least one rhythm generator; OSC/SUB 1/SUB 2 assign; SEQ OUT → VCO IN example | MAN p.25–26 |
| SEQ OCT ±5/±2/±1 relative to VCO FREQ; ±5 needs VCO FREQ fully CCW; about 10 kHz ceiling for sequencer-driven pitch and subs; hold the button for ±5 at the SEQ jacks | MAN p.27 |
| PLAY / TRIGGER / RESET / NEXT / EG behaviour (NEXT does not retrigger the EGs; RESET hold; EG OFF/ON/HELD) | MAN p.27–29 |
| Polyrhythm section: four identical generators, RHYTHM 1 (CW) … 16 (CCW), SEQ 1/SEQ 2 buttons | MAN p.29 |
| Every jack: function, normal and voltage range | MAN p.30–36 |
| Clocking DFAM; syncing to Mother-32 | MAN p.37, p.38 |
| Eurorack: 360 mA at +12 V, no −12 V | MAN p.39, p.56 |
| Fine Tune ±50 cents (hold OSC 1 + OSC 2; adjust with TEMPO; exit with QUANTIZE) | MAN p.40 |
| MIDI notes offset from C4; CC table (4/36, 12/44, 103–106, 23/55, 24/56, 28/60, 29/61, 113); Play (MIDI transport) SysEx default ON; MIDI channel SysEx default 1 | MAN p.41–43 |
| 10 presets: Aquatic Chords, Mellow Harmonies (p.44); Slip & Fall, Point Zero (p.45); Three Hands on the Wheel, Bateria (p.46); Spiral Ways, Star-Gate (p.47); Poly Rock, Cloud Path (p.48) | MAN p.44–48 |
| Signal-flow diagram: CUTOFF IN and VCA CV IN are **summed** (⊕) with their EGs; VCO 1 CV IN normal → VCO 2 CV IN; PWM IN feeds the VCO and both subs; the PWM normal comes from SUB 1 via a WAVE-controlled switch; the sequencer clocks are OR'd → TRIGGER OUT and → EG mode → OR with TRIG button/IN → both EGs; VCA → VOLUME → line/headphone out and VCA OUT | MAN p.55 |
| Specs: rear ¼" (TRS headphones or TS instrument); 12.57 × 4.21 × 5.24 in; 3.5 lb; supply 12 V DC 1.2 A; 4.8 W | MAN p.56 |
| PWI initialized patch: all steps 0 V; all RHYTHM ÷1 and unassigned; SUB FREQ ÷1; VCO FREQ noon; WAVE UP; SEQ OCT ±5; QUANTIZE off; VCO 1 LEVEL 50 %; CUTOFF ≈ 3 o'clock; EG AMT ≈ 3 o'clock; both DECAYs ≈ 9:30; TEMPO noon; EG ON; PLAY lit | PWI p.3 |
| PWI exercises: SEQ → VCO by cable or by assign; SEQ 2 → VCO 1 transposes SEQ 1 (RHYTHM 2 ÷16); SEQ 2 → CUTOFF for drums; subs → RHYTHM inputs; VCO 2 SUB 1 → CLOCK IN; VCF EG → VCO 2 SUB; VCO 2 SUB 2 → PLAY | PWI p.4–10 |
| Jack positions (R, C) and patch ideas for every jack | PWI p.12–15 |
| Ten patches with titles and notes | XPB p.3–12 |

### Short quotes (only where the wording matters; each 25 words or fewer)

| # | Quote | Page |
|---|---|---|
| S1 | "Engaging the QUANTIZE settings will limit the available values for the VCO 1 FREQ knob to the specific scale steps" | MAN p.17 |
| S2 | "Pressing the NEXT button will not cause the VCF EG or the VCA EG to re-trigger" | MAN p.28 |
| S3 | "Rising edge = PLAY begins; Falling edge = PLAY stops" (PLAY input) | MAN p.33 |
| S4 | "The control signal connected here is summed with the output control signal of the VCA EG." (VCA input) | MAN p.32 |
| S5 | "(1% Duty Cycle/Narrow Pulse to 99% Duty Cycle/Wide Pulse)" (PWM inputs) | MAN p.31 |
| S6 | "Internal clock is 1 PPQ until a MIDI clock is detected. When MIDI clock is present, the PPQ is 4 (16th notes)." | MAN p.24 |
| S7 | "The sequencers cannot internally modulate the frequency of the VCOs any higher than 10k Hz (approximately)." | MAN p.27 |

## Secondary sources (still used for facts not in Moog's documents)

| Id | Source | Used for | Conf. |
|---|---|---|---|
| **FW** | Firmware v1.1.0 coverage, 8 Mar 2022, which postdates the manual: synthtopia.com (2022/03/08), musictech.com, sonicstate.com (2022/03/09), rubadub.co.uk, bonedo.de | SEQ 1/2 CLK now in phase with the clock (previously one pulse late); MIDI notes transpose a running sequence; note priority low/high/last via CC 91; MIDI pitch bend; settings stored at power-off | verified (two or more outlets) |
| **PR** | Pencil Research MIDI database `Moog/Subharmonicon.csv` (CC BY-SA 4.0), local clone `repos/pencilresearch-midi/` | cross-checks MAN p.41–43. Note the CSV's "0-17" typo (should be 0-7) | verified (matches MAN) |
| **SOS** | *Sound On Sound* review, soundonsound.com/reviews/moog-subharmonicon | filter oscillation onset about 2 o'clock of RESONANCE; output voltage classes; slow-PWM caveat | likely |
| **F** | Moog forum "Subharmonicon transposition" (forum.moogmusic.com/t/subharmonicon-transposition/21055) | users treat 8-ET as C major; transposing needs a CV offset (now MIDI transpose, fw 1.1) | likely |
| **SQ** | Squinky Labs *Substitute* VCV module (GPL-3.0), local `repos/squinkyvcv/` (`dsp/generators/SubVCO.h`, `docs/substitute.md`) | the phase-locked, minBLEP sub DSP recipe; independent confirmation that the quantizer is anchored at C | likely (third party) |
| **CM** | Count Modula VCV plugin (GPL-3.0), local `repos/countmodula/src/modules/PolyrhythmicGeneratorMkII.cpp` line 231 | precedent for CV → divisor scaling (10 V spans 16 values) | precedent only |
| **VN** | Venom VCV plugin (GPL-3.0-or-later), local `repos/venom/doc/Quantizers.md` | background for harmonic/subharmonic partial quantizing | background |
| **VL** | VCV Library manifests, local `repos/vcv-library/` | discovering the above | — |
| **REPO** | This repository at commit 89801d8 (worktree checked out read-only; files identical to the main checkout): `devices/subharmonicon/*`, `devices/dfam/*`, `devices/studio-clock/index.ts`, `docs/PEDAGOGY.md`, `types/index.ts`, `scripts/validate-devices.ts` | current twin ids and models; DFAM and Studio Clock jack ids; lesson schema and validator rules | — |

## Repositories cloned (`research/subharmonicon/repos/`, 6.7 MB in total)

| Path | Upstream | Licence | Used for |
|---|---|---|---|
| `repos/pencilresearch-midi/` (sparse `Moog/`) | github.com/pencilresearch/midi | CC BY-SA 4.0 | MIDI CC cross-check |
| `repos/squinkyvcv/` (sparse) | github.com/kockie69/SquinkyVCV-main | GPL-3.0 | sub DSP reference |
| `repos/countmodula/` (sparse) | github.com/countmodula/VCVRackPlugins | GPL-3.0 | CV scaling precedent |
| `repos/venom/` (sparse docs) | github.com/DaveBenham/VenomModules | GPL-3.0-or-later | background |
| `repos/vcv-library/` (sparse manifests) | github.com/VCVRack/library | no licence file (metadata) | discovery |

Checked and removed: `ogabrielluiz/voltpages` (MIT), which has no Subharmonicon sheet. Not cloned:
SlimeChild *Substation* (its source is on GitLab, outside the allowed hosts; proprietary licence).

## How the patch sheets were read

| Doc | Method | Accuracy |
|---|---|---|
| XPB | rendered at 250 dpi. A script found each sheet's accent colour, measured pointer angles with knob centres calibrated across all ten sheets, and read lit buttons, LEDs and wave positions from fill colour. Cables were traced by eye on zoomed crops | continuous knobs ±2 % of travel; stepped knobs to the nearest detent (the artist placed pointers freely; borderline cases are flagged in presets.md) |
| MAN p.44–48 | rendered at 300 dpi and read by eye, one third of the panel at a time | ±3–5 % of travel; borderline detents flagged |
| PWI p.3, MAN p.11 | read by eye at 200–300 dpi | exact enough for an init state |

Temporary renders were made in `research/subharmonicon/.tmp-renders/` and **deleted** after use. No
manufacturer text, renders or artwork are kept in the research files.

## Conflicts and resolutions

| Topic | Conflict | Resolution |
|---|---|---|
| VCA input | PWI p.12 says the VCA EG "is normalled here"; MAN p.32 says the input is summed | **summed**: MAN p.32 and the diagram's ⊕ node (MAN p.55) |
| CUTOFF input | PWI p.15 says the VCF EG "is normalled to the CUTOFF input" | **summed** with the knob and EG×AMT (⊕ on MAN p.55); ±5 oct with the knob centred (MAN p.33) |
| VCO 2 PWM normal | MAN p.32 names "subharmonic oscillator sawtooth 2"; MAN p.19 names SUB 1 | follow p.19 (SUB 1 of VCO 2), which the diagram's structure matches |
| VCA DECAY text | MAN p.24 calls the knob "VCF DECAY" in the VCA section | a typo; the VCA DECAY knob is meant |
| TRIGGER OUT in EG OFF | MAN p.28 text lists button and external triggers; the diagram (p.55) takes TRIGGER OUT before the EG mode gate | sequencer moves always reach TRIGGER OUT (diagram, PWI p.15), plus button and external triggers |
| Spiral Ways, Star-Gate, Cloud Path sheets | EG and PLAY drawn unlit with no trigger source, which would be silent | recreated with EG ON and PLAY on; the notes on those sheets imply playing (flagged in presets.md) |
| TEMPO taper | not stated | **linear in Hz** (likely): a log taper puts nearly all 20 Moog sheets at 5–30 BPM per step |
| v1 claims | NEXT fires the EGs; PLAY IN toggles; PWM depth ±40 %; EG decay min 1 ms (twin); CUTOFF/VCA normalled (twin) | all corrected in signal-flow.md v2 §15 |

## Remaining gaps (not in any document reached)

1. CV → integer scaling for the SUB and RHYTHM inputs and for SEQ ASSIGN SUB.
2. Moog's 12-JI ratio table: only the 8-note just C major is printed (MAN p.16). The minor 7th and tritone are guesses.
3. VCF EG AMT full-scale depth, the exact self-oscillation onset, and the EG curve shapes.
4. CLOCK OUT and SEQ CLK pulse widths (TRIGGER OUT is 1 ms).
5. The order in which QUANTIZE cycles, and whether NEXT moves sequencers that have no rhythm assigned.
6. Pitch-bend range and the note-priority CC value split (fw 1.1).
