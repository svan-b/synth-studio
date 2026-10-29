# Moog Sub 37 / Subsequent 37: hardware reference for the digital twin

Ground truth for `devices/sub37`. The twin is the Sub 37 panel with the Subsequent 37 engine. Both
instruments share one panel, one parameter set and one manual text, so the twin treats them as one
control set (see Sources).

**Citations.** "(Subsequent 37 manual, p.N)" is the *Subsequent 37 Owner's Manual* (Moog, 2017),
printed page N. The *Sub 37 Owner's Manual v1.1* (2015) has the same text on the same pages: a
word-level comparison found only the product name, the copyright year, one extra CC row and a few
typos (docs/research/sub37/sources.md). So every page number here is valid for both.

**Confidence.**
- **verified**: stated in the manual, with the page given.
- **likely**: follows directly from the manual or the MIDI tables, or from one good secondary source.
- **guess**: not documented. The value was chosen to match the documented behaviour. Each guess is
  listed again under "Model choices", so it can be checked against a unit.

## Sources

| Id | Source | Used for |
|---|---|---|
| M | Moog *Subsequent 37 Owner's Manual* (63 pp.), and the *Sub 37 Owner's Manual v1.1* (62 pp., same pages) | **primary**: every label, range, list and behaviour below |
| F1 | Moog *Sub 37 Factory Presets* lists (by bank, by name, by category) | the factory bank's names and categories: 134 presets in banks 1-9 |
| S1 | midi.guide dataset *Moog Subsequent 37* (CC BY-SA 4.0), in the app as `public/midi-guide/devices/moog-subsequent-37.json` | CC and NRPN numbers; it matches the manual's MIDI tables (pp.53-59) |
| S2 | `patchscore` Subsequent 37 manifest (facts only): 20 factory presets read off a unit at firmware 1.2.0, and the Quickstart poster's panel legend measured to scale | panel positions; the Subsequent 37 factory bank's slots |
| S3 | Cubase device files listing the Subsequent 37's 144 program names | the Subsequent 37 factory bank |
| S6 | Retail and press copy on the Subsequent 37 (doubled mixer headroom, re-voiced MultiDrive, new keybed) | how the two models sound different (**likely**; the manuals do not discuss it) |

The manuals themselves are not in the repository (docs/research/COPYRIGHT-RULES.md). The research
notes in `docs/research/sub37/` (sources, signal flow, presets, lessons) carry the full parameter
tables in our own words.

## Instrument

- A 2-note paraphonic analog synthesizer: 37 keys with velocity and aftertouch, 40 knobs and 74
  switches, every control on MIDI. **verified** (Subsequent 37 manual, p.9).
- Two mod busses, two looping DAHDSR envelopes, an arpeggiator with a paraphonic 64-note step
  sequencer; each of those sections has its own SYNC switch. **verified** (Subsequent 37 manual, p.9).
- 256 presets, 16 banks of 16. **verified** (Subsequent 37 manual, pp.12, 61).
- Size 6.75" H × 26.375" W × 14.75" D (17 × 68 × 37.5 cm), 22 lb. **verified** (Subsequent 37
  manual, p.61); the inch width is a misprint for 26.75". The twin's `spec.dimensions` use 670 × 375 ×
  171 mm.

### Signal flow (block diagram, Subsequent 37 manual, p.11)

```
OSC 1 (+ SUB, one octave below) ─┐
OSC 2 (HARD SYNC to OSC 1) ──────┤
PINK NOISE ──────────────────────┼─► MIXER ─► LADDER FILTER ─► MULTIDRIVE ─► VCA ─┬─► AUDIO OUT (MUTE)
FDBK / EXT IN ◄── mixer output ──┘     (6/12/18/24 dB)  (OTA + FET)         ▲     └─► HEADPHONES
   (EXT IN audio replaces the feedback while a cable is in)                AMP EG
FILTER EG × EG AMT, KB TRACK, MOD 1/2 FILTER AMT, FILTER CV ──► cutoff
MOD 1 / MOD 2: LFO or F.EG/PGM ──► PITCH AMT (OSC 1, 2 or both), FILTER AMT, MOD AMT ──► MOD DEST
```

- Sources into the mixer: VCO 1 with its sub, VCO 2, noise, and the EXT IN / feedback channel; then
  the ladder with slope select, MultiDrive, the VCA, and the audio and headphone outputs. VCO 1
  hard-syncs VCO 2. **verified** (Subsequent 37 manual, p.11).
- The twin builds it the same way: two band-limited VCOs (`Vco`, OSC 1 with its sub tap), a mixer
  worklet with a one-sample FDBK loop, the 2× oversampled ladder, a 2× oversampled MULTIDRIVE shaper,
  then the VCA, PRESET VOL, VOLUME, MUTE and HEADPHONES. A control worklet (`sub37-ctl`) runs both
  envelopes, both LFOs, glide, the mod busses and the waveshape morph at audio rate. See `engine.ts`.

## Panel

One row of ten sections, three knob rows, and a strip with KB OCTAVE, BANK and PRESET 1-16:
PROGRAMMING · ARPEGGIATOR · GLIDE · MOD 1 · MOD 2 · OSCILLATORS · MIXER · FILTER · ENVELOPE
GENERATORS · OUTPUT. **verified** for the sections and their contents (Subsequent 37 manual,
pp.12-34); positions are from the Quickstart legend (S2, **likely**). The twin draws a 660 mm face
at 2 px/mm. PROGRAMMING is widened from 41 to 50 mm so the LCD can be read on an iPad, and the top
knob row sits 4 mm lower than on the hardware, so the legible-size legends above the stepped knobs
have room. The jacks of the left cheek sit beside the wheels.

### PROGRAMMING (Subsequent 37 manual, pp.12-14)

| Label | Kind | Twin | Notes | Confidence |
|---|---|---|---|---|
| LCD | 128 × 64 display | `Lcd` | Shows the bank, the preset number, the name (one or two lines) and the category. The twin also shows the control just moved for 2.5 s, the menus and the sequencer status | **verified** contents (Subsequent 37 manual, p.12); the edit display is the twin's |
| ▼ (DEC), ▲ (INC), CURSOR | 3 buttons under the LCD | `ProgButtons` | Step through presets; in a menu, move or (with CURSOR) edit the value | **verified** (Subsequent 37 manual, p.13) |
| COMPARE / SAVE, MIDI / GLOBAL, PRESET (EDIT) / PANEL ▶ (INIT) | 2 columns × 3 | `ProgButtons` | Hold PRESET: PRESET EDIT menu. Hold PANEL: initialise the panel. COMPARE, SAVE and MIDI show a note (the studio project saves) | **verified** layout and holds (Subsequent 37 manual, pp.13-14) |
| FINE TUNE | knob | `fine_tune` ±100 cents | Both oscillators, up to a semitone either way | **verified** (Subsequent 37 manual, p.14) |

### ARPEGGIATOR (Subsequent 37 manual, pp.15-16, 40)

| Label | Twin | Range / behaviour | Confidence |
|---|---|---|---|
| RATE | `arp_rate` 2-280 BPM; with SYNC lit `arp_div` (21 divisions) | Internal clock 2-280 BPM; with SYNC it picks divisions of the clock, 4 whole notes to a 1/64 triplet | **verified** (Subsequent 37 manual, pp.15, 52) |
| SYNC [TAP] | `arp_sync` | Lit: follow MIDI clock (the studio transport). With SYNC lit and no clock, nothing plays. Hold 1 s: TAP mode; the third tap sets the tempo, a running average follows, 5 s without taps starts over | **verified** (Subsequent 37 manual, p.15) |
| RANGE ◀ ▶, LEDs -2 -1 0 +1 +2 | `arp_oct_range` 0-6 (3 = 0) | 7 states: one press past either end lights 0 and ±2 and plays the original, 2nd, 3rd and 2nd octaves | **verified** (Subsequent 37 manual, p.15) |
| BACK / FORTH | `arp_back_fwd` | UP plays up then down, DWN down then up, ORDR forwards then back; no effect on RND | **verified** (Subsequent 37 manual, p.16) |
| INVERT | `arp_invert` | Each note in every octave of the range before the next note; no effect at RANGE 0 | **verified** (Subsequent 37 manual, p.16) |
| PATTERN | `arp_pattern` | UP · DWN · ORDR · RND · SEQ · REC | **verified** (Subsequent 37 manual, p.16) |
| ON [REST] | `arp_on` | Arpeggiator on; in step record it enters a rest | **verified** (Subsequent 37 manual, p.16) |
| LATCH [TIE] | `arp_latch` | Keeps playing after release; keys added while others are held join; after all are released the next key starts a new list. In step record it is TIE | **verified** (Subsequent 37 manual, pp.15-16) |
| GATE LENGTH (menu) | `arp_gate` | OFF-100 %, default 50 %; 100 % is legato | **verified** (Subsequent 37 manual, p.40) |
| CLOCK DIV (menu) | `arp_div` | 21 divisions, 384 clocks to 1 clock | **verified** (Subsequent 37 manual, pp.40, 52) |
| SWING (menu) | `arp_swing` | 50 % straight; below moves the off-beats earlier, above later; 0 % only off-beats, 100 % only on-beats | **verified** (Subsequent 37 manual, p.40) |
| STEP 1 RESET (menu) | `arp_step1_reset` | ON: the KB RESETs act only on the pattern's first note | **verified** (Subsequent 37 manual, p.40) |
| END NOTES (menu) | `arp_end_notes` | ONCE: C-E-G-E-C; TWICE: C-E-G-G-E-C-C | **verified** (Subsequent 37 manual, pp.16, 40) |

### Step sequencer and STEP EDIT (Subsequent 37 manual, pp.16-20, 46-47)

- **Recording.** With the arpeggiator off, PATTERN to REC: the next key erases the sequence and
  becomes step 1, and the LCD counts the steps. Each key or REST advances, up to 64 steps. TIE then
  a different note changes pitch without retriggering the envelopes; TIE then the same note doubles
  its length. Overlapping keys also tie, except in DUO MODE. **verified** (Subsequent 37 manual,
  pp.16-17). Twin: the LCD writes keys into `arp_seq` / `arp_seq2` / `arp_seq_flags` (`seq.ts`),
  and `combos.ts` turns ON into REST and LATCH into TIE while PATTERN is at REC.
- **Playback.** PATTERN to SEQ, then ON; the key pressed transposes. GLOBAL REF NOTE FIRST (default):
  that key becomes the first note; MID C: MIDI 48 plays as recorded. **verified** (Subsequent 37
  manual, pp.17, 46). With GLIDE ON and LEGATO, only tied notes glide. **verified** (Subsequent 37
  manual, p.17).
- **DUO steps.** In DUO MODE a step can hold two notes; single-note steps play both oscillators,
  and follow two held keys during playback. **verified** (Subsequent 37 manual, p.17).
- **STEP EDIT** (PATTERN at SEQ or REC, hold BANK + press LATCH; leave the same way, or turn PATTERN
  away). PRESET 1-16 show the steps, four pages (BANK + KB OCTAVE); LEDs dim for active steps, dark
  for rests and after the last step, bright for the playing step. **verified** (Subsequent 37 manual,
  p.18). Per step **verified** (Subsequent 37 manual, pp.19-20), each in the twin:
  - BANK + a step: select it. ON / LATCH toggle its REST / TIE; a key sets pitch 1 (clearing rest,
    tie and ratchet), a legato key pitch 2.
  - A step held + another step: tie the group (again: untie). A single tap: toggle rest.
  - A step held + KB OCTAVE ▼ / ▲: FIRST / LAST step. BANK + RANGE ◀ / ▶: rotate.
  - A step held + ON: SKIP. A step held + LATCH: RATCHET; RATCHET CNT 1-8 (default 2), one count for
    the sequence, BANK + BACK / FORTH (down) or INVERT (up).
  - Quick erase: BANK held while turning PATTERN to REC; stopped, the whole sequence goes; running,
    the steps go blank and the length stays.
- **GLOBAL: LATCH RSTRT** (default OFF): ON makes a new press with nothing held restart from the first
  step. **verified** (Subsequent 37 manual, p.47). Twin: `latch_restart`.
- **Holds with a mouse.** On a touch screen the combinations work with two fingers. With a mouse,
  a long press (half a second) and release keeps BANK, a step or MOD DEST held, blinking, for the next
  press (`combos.ts`). This is a twin convenience, not a hardware feature.

### GLIDE (Subsequent 37 manual, p.21)

| Label | Twin | Range / behaviour | Confidence |
|---|---|---|---|
| TIME | `glide_time` (ms, shown 0-10) | No unit is printed | **verified** scale (Subsequent 37 manual, p.21); the time map is a **guess** |
| OSC (LEDs 1, 2) | `glide_osc` | Both, OSC 1 or OSC 2 | **verified** (Subsequent 37 manual, p.21) |
| TYPE (LCR, LCT, EXP) | `glide_type` | LCR: bigger intervals take longer; LCT: the same time for any interval; EXP: fast, then slowing | **verified** (Subsequent 37 manual, p.21) |
| GATED | `glide_gated` | Glides only while a key is held | **verified** (Subsequent 37 manual, p.21) |
| LEGATO | `glide_legato` | Glides only when a key goes down while another is held (needs ON) | **verified** (Subsequent 37 manual, p.21) |
| ON | `glide_on` | Glide on or off | **verified** (Subsequent 37 manual, p.21) |

### MOD 1 and MOD 2 (Subsequent 37 manual, pp.22-24, 50-52)

| Label | Twin (n = 1, 2) | Range / behaviour | Confidence |
|---|---|---|---|
| RATE | `modN_rate` 0.1-100 Hz; with SYNC `modN_div` | ×10 with HI RANGE (1-1000 Hz); with SYNC, clock divisions | **verified** (Subsequent 37 manual, pp.22-23) |
| SOURCE | `modN_source` | TRI (fully left) · SQR · SAW · RAMP (reverse saw) · S&H · F.EG/PGM (the LFO bypassed: the filter EG, or the PGM SRC) | **verified** (Subsequent 37 manual, p.22) |
| HI RANGE, SYNC, KB RESET | `modN_hi_range`, `modN_sync`, `modN_kb_reset` | ×10 rate; lock to the clock; restart at zero on each new note | **verified** (Subsequent 37 manual, p.23) |
| PITCH AMT, OSC (LEDs 1, 2) | `modN_pitch_amt` (bipolar), `modN_pitch_dest` | Pitch of OSC 1, OSC 2 or both | **verified** (Subsequent 37 manual, p.23) |
| FILTER AMT | `modN_filter_amt` (bipolar) | Cutoff | **verified** (Subsequent 37 manual, p.23) |
| MOD AMT, DEST (6 LEDs) | `modN_mod_amt` (bipolar), `modN_dest` | 7 destinations: the other LFO's rate, VCA LEVEL, OSC 1 WAVE, OSC 1+2 WAVE (both LEDs), OSC 2 WAVE, NOISE LEVEL, EG TIME/PGM. Hold DEST and move a control to make it the destination | **verified** (Subsequent 37 manual, pp.23-24) |
| CONTROLLERS | `ControllersButton` → menu | MOD WHEEL, VELOCITY (`modN_wheel`, `modN_vel`, -100..+100 %), PGM SRC, PGM DST, LFO KBTRACK (0-200 %) | **verified** (Subsequent 37 manual, pp.50-52) |

- By default the MOD wheel sets MOD 1's overall depth. **verified** (Subsequent 37 manual, p.22).
  MOD 2 runs at full depth by default (all CONTROLLERS amounts OFF): **likely**.
- LFO RATE as a destination: MOD 1 moves LFO 2, MOD 2 moves LFO 1. WAVE destinations never touch the
  sub. NOISE LEVEL adds to the mixer setting. EG TIME scales every envelope time (negative shorter,
  positive longer). **verified** (Subsequent 37 manual, p.24).
- PGM SRC: FILTER EG (default), AMP EG, CONST ON, SINE LFO, NOISE LFO, OSC1 PCH, OSC2 PCH, SEQ NOTE,
  SEQ VEL, SEQ MOD, PRESSURE, KB TRACK (bipolar around MIDI 48), VELOCITY. **verified** (Subsequent 37
  manual, p.50). PGM DST has about 90 targets (p.51); the twin implements the 22 continuous ones that
  live in its engine (`PGM_DESTS` in `model.ts`).

### OSCILLATORS (Subsequent 37 manual, pp.25-26)

| Label | Twin | Range / behaviour | Confidence |
|---|---|---|---|
| OCTAVE (×2) | `osc1_octave`, `osc2_octave` | 16' · 8' · 4' · 2' | **verified** (Subsequent 37 manual, p.25) |
| WAVE (×2) | `osc1_wave`, `osc2_wave` | Continuous: triangle → sawtooth → square → narrow pulse | **verified** (Subsequent 37 manual, p.25) |
| HARD SYNC | `hard_sync` | OSC 2 restarts with OSC 1; with OSC 1 higher, little or no OSC 2 | **verified** (Subsequent 37 manual, p.26) |
| KB RESET | `kb_reset` | Both oscillators restart on a new note (may click; a short AMP release helps) | **verified** (Subsequent 37 manual, p.26) |
| DUO MODE | `duo_mode` | OSC 1 and OSC 2 play separate keys | **verified** (Subsequent 37 manual, p.26) |
| KB CTRL (LEDs LO, HI) | `kb_ctrl` (0 OFF, 1 LO, 2 HI) | In DUO MODE. HI: OSC 2 the highest key, OSC 1 the lowest; LO: swapped; OFF: OSC 2 drones and FREQUENCY spans ±3 octaves | **verified** (Subsequent 37 manual, p.26) |
| FREQUENCY | `osc2_frequency` | ±7 semitones; fully clockwise is a fifth | **verified** (Subsequent 37 manual, p.26) |
| BEAT FREQ | `beat_freq` | ±3.5 Hz: the same beat rate on every note | **verified** (Subsequent 37 manual, p.26) |

### MIXER (Subsequent 37 manual, p.27)

Five channels, each a 0-10 level knob and an ON button: OSC 1, SUB OSC, OSC 2, NOISE, FDBK / EXT IN
(`mix_*`, `mix_*_on`). Above 5 a channel goes past unity and overdrives the filter input; 5 or below
is clean. The sub is always a square, one octave below OSC 1. The noise is pink. With EXT IN empty,
FDBK / EXT IN feeds the mixer's output back into itself, from mellow to chaotic, and can raise the
level a lot. **verified** (Subsequent 37 manual, p.27).

### FILTER (Subsequent 37 manual, pp.28-29)

| Label | Twin | Range / behaviour | Confidence |
|---|---|---|---|
| CUTOFF | `cutoff` 20 Hz-20 kHz | 20 Hz closes it, 20 kHz opens it; the legend reads 20, 80, 320, 500 (top), 1.2k, 5k, 20k Hz | **verified** (Subsequent 37 manual, p.28) |
| RESONANCE | `resonance` 0-10 | Above 7 the filter self-oscillates | **verified** (Subsequent 37 manual, p.28) |
| MULTIDRIVE | `multidrive` 0-10 | Drives OTA and FET stages between the filter and the VCA: tube-like warmth to hard clipping | **verified** (Subsequent 37 manual, p.28) |
| SLOPE (LEDs 6 12 18 24) | `filter_slope` | 1-4 poles, -6 / -12 / -18 / -24 dB per octave, changeable while playing | **verified** (Subsequent 37 manual, p.29) |
| EG AMT | `filter_eg_amt` (bipolar) | Clockwise from centre raises the cutoff, counter-clockwise lowers it | **verified** (Subsequent 37 manual, p.29) |
| KB TRACK | `filter_kb_amt` 0-200 % | 0, 1:1 at halfway (centred on C3, MIDI 48), 2:1 fully right | **verified** (Subsequent 37 manual, p.29) |

### ENVELOPE GENERATORS (Subsequent 37 manual, pp.30-33, 41)

| Label (KNOB SHIFT) | Twin (`feg_`, `aeg_`) | Range | Confidence |
|---|---|---|---|
| ATTACK (DELAY) | `*_attack` 1 ms-10 s (`*_delay` 0-10 s) | The AMP EG's DELAY works only with LOOP on | **verified** (Subsequent 37 manual, pp.30-33) |
| DECAY (HOLD) | `*_decay` 1 ms-10 s (`*_hold` 0-10 s) | | **verified** (Subsequent 37 manual, pp.30-33) |
| SUSTAIN (VEL AMT) | `*_sustain` 0-100 % (`*_vel_amt` 0-100 %) | Full velocity always gives the full amount; higher settings lower soft notes | **verified** (Subsequent 37 manual, pp.31-32) |
| RELEASE (KB TRACK) | `*_release` 1 ms-10 s (`*_kb_amt` 0-200 %) | KB TRACK shortens DECAY and RELEASE up the keyboard, 1:1 at noon | **verified** (Subsequent 37 manual, pp.31-33) |
| MULTI TRIG | `*_multi_trig` | Lit: every key gates, even legato; unlit: single trigger | **verified** (Subsequent 37 manual, p.31) |
| RESET | `*_reset` | Lit: the attack starts from zero; unlit: from the current level | **verified** (Subsequent 37 manual, p.31) |
| SYNC | `*_sync`, `*_sync_div` (menu CLOCK DIV) | Retriggers every clock division | **verified** (Subsequent 37 manual, p.31) |
| LOOP | `*_loop` | Delay, attack, hold, decay and release repeat while the gate is on | **verified** (Subsequent 37 manual, p.31) |
| LATCH ON | `*_latch` | Stays at SUSTAIN as if the gate were on | **verified** (Subsequent 37 manual, p.31) |
| KNOB SHIFT | `knob_shift` | Blinks while the knobs are shifted | **verified** (Subsequent 37 manual, p.30) |
| GATE SRC, EXP. ATTACK (menu) | `*_gate_src`, `*_attack_exp` | BOTH / NOTES / EXT; linear (default) or exponential attack | **verified** (Subsequent 37 manual, p.41) |

### OUTPUT (Subsequent 37 manual, p.34)

VOLUME (`master_volume`) sets AUDIO OUT; PRESET VOL (`preset_volume`, PRESET EDIT) scales each preset
independently of it. MUTE (`output_mute`) silences AUDIO OUT only, not the headphones. HEADPHONES
(`phones_volume`) balances against VOLUME, so moving VOLUME moves the phones too; the jack is TRS,
mono on both sides. **verified** (Subsequent 37 manual, p.34).

### Bottom strip, wheels, keyboard and jacks

| Control | Twin | Behaviour | Confidence |
|---|---|---|---|
| KB OCTAVE ▼ ▲ | `kb_octave` -2..+2 | Dim LED one octave, bright two; both together: back to 0; both held 1 s: MIDI panic; both held + a key in the lower two octaves: KB TRANSPOSE (middle C = 0) | **verified** (Subsequent 37 manual, p.14) |
| BANK, PRESET 1-16 | `preset_bank`, `preset_number` | BANK then a PRESET button picks the bank, then a PRESET button the preset | **verified** (Subsequent 37 manual, p.12) |
| PITCH wheel | `pitch_bend`; `bend_up`, `bend_down`, `bend_dest` | Springs back; BEND UP / DOWN 0-24 semitones, default 2; BEND DEST NONE / OSC1 / OSC2 / BOTH | **verified** (Subsequent 37 manual, p.42) |
| MOD wheel | `mod_wheel` | MOD 1 depth by default | **verified** (Subsequent 37 manual, p.22) |
| KB PRIORITY (menu) | `key_priority` | LOW / HIGH / LAST (default) | **verified** (Subsequent 37 manual, p.42) |
| KB TRANSPOSE (menu) | `kb_transpose` | -12..+12, stored with the preset | **verified** (Subsequent 37 manual, pp.14, 39) |
| Keyboard | on-screen keys MIDI 36-72 | 37 keys, velocity and aftertouch; MIDI 48 is the instrument's C3 | **verified** (Subsequent 37 manual, pp.9, 29) |
| EXT IN | `in_ext` | Line level into FDBK / EXT IN; a key (or AMP EG LATCH ON) must open the VCA | **verified** (Subsequent 37 manual, pp.7-8) |
| PITCH, FILTER, VOL CV | `in_pitch`, `in_filter`, `in_volume` | 0 to +5 V or an expression pedal; PITCH 1 V/oct | **verified** (Subsequent 37 manual, p.8) |
| KB GATE | `in_gate` | +5 V gate: triggers the envelopes (per GATE SRC) | **verified** (Subsequent 37 manual, pp.8, 41) |
| AUDIO OUT, HEADPHONES | `out_audio`, `out_phones` | Mono out; TRS phones | **verified** (Subsequent 37 manual, pp.8, 34) |

## Studio integration

- The studio transport is the Sub 37's MIDI clock (`studio.midiSync`). With ARP SYNC lit, the
  arpeggiator, the sequencer, LFO SYNC and envelope SYNC follow the studio tempo, start with ▶ and
  stop with ■. Without a running clock a synced arpeggio stays silent and the LCD says it waits, as
  the manual warns. **verified** behaviour (Subsequent 37 manual, p.15). With SYNC off the arpeggiator
  runs on its own RATE.
- A latched, synced sequence with no key held plays as recorded when ▶ starts (a studio convenience).
- Lesson auditions with the studio stopped run a synced pattern at the studio tempo so it can be
  heard; a pattern the player already has running keeps running.

## Model choices (guesses to check against a unit)

| Quantity | Twin value |
|---|---|
| WAVE morph | Crossfades tri → saw (0-33 %), saw → square (33-67 %), then the pulse narrows from 50 % to 10 % (67-100 %); the square, pulse and sub sit at 0.85 of the saw's peak |
| Mixer law | (level / 5)^1.5: unity at 5, +9 dB at 10. The mixer amp is clean to 1.5× unity, then soft-limits towards 4.5× (it holds the FDBK loop); the overdrive happens at the ladder's input (input scale 0.36): one source at 5 measures about 1 % THD at the output, at 7 about 3 %, at 10 about 8 %, two hot sources about 20 % |
| FDBK | The mixer output fed back through an AC-coupled (25 Hz), 5 kHz band-limited path; loop gain 1.25 × (level / 10)^1.3, so the top of the knob turns unstable |
| RESONANCE | The ladder self-oscillates from 7.1 on the dial ("above 7"; 7.0 still only rings), feedback 0.985 of the core's threshold there, up to 1.16 at 10 |
| CUTOFF taper | 20 Hz × 1000^travel: the knob's centre is 632 Hz. The legend is the hardware's (20, 80, 320, 500, 1.2k, 5k, 20k Hz at 45° steps), which implies a taper compressed around noon that the shared knob mapping (linear / log / exponential only) cannot draw, so the printed marks read 0.3-0.7 octave off the value (the LCD and readout always show the true value) |
| FILTER EG AMT | ±6 octaves at ±5 |
| MULTIDRIVE | Drive 0.5 at 0 (clean) to 40 at 10 (square law) into an asymmetric soft clipper, 2× oversampled. Low settings add even and odd harmonics about equally (1.8 % THD at 1, 5 % at 2), 10 is hard clipping (42 %, odd). Its make-up rides on the VCA gain (2× at 0, falling to 0.39×), so a unity tone gains about 2 dB at 3 and 5 dB at 10: grit more than level |
| MOD amounts | PITCH AMT ±2 octaves at ±5 (squared taper, for fine vibrato); FILTER AMT ±5 octaves; MOD AMT: the other LFO's rate ±4 octaves, VCA gain 0-2, WAVE ±100 % of travel, NOISE ±10 on the dial, EG TIME ±3 octaves. A modulated parameter stays inside its own control's range: mixer levels 0-10, WAVE triangle to the narrowest pulse, EG AMT ±5, FREQUENCY ±7 (±36 as a drone), BEAT FREQ ±3.5 Hz |
| CONTROLLERS | Depth = wheel × MOD WHEEL + velocity × VELOCITY, clamped to ±1; with both OFF, full depth |
| LFO | SAW falls, RAMP rises; S&H takes a new value each cycle; the SINE and NOISE LFO sources follow the bus's LFO clock; LFO KBTRACK doubles the rate per octave at 100 % around MIDI 48 |
| Envelopes | Linear attack (EXP. ATTACK: exponential); decay and release fall 60 dB in the stage time; VEL AMT: peak = 1 − amount + amount × velocity; KB TRACK: decay and release × 2^(−amount × (note − 48) / 12) |
| GLIDE TIME | 15 ms at 0 to 6 s at 10, logarithmic: 2 ≈ 50 ms (the acid setting), 5 ≈ 300 ms; LCR is that time per octave |
| ARP without SYNC | Steps at CLOCK DIV (default 1/16) of RATE |
| Oscillators | 1.5 cents of slow drift (about 0.2 Hz); OSC 2 tolerance ±2 cents |
| Output | −6 dB output trim after the VCA (`OUTPUT_TRIM_DB`); VOLUME law (dial / 10)^2 × 0.9; HEADPHONES unity at 7 against VOLUME. A fresh panel plays about −15 LUFS at VOLUME 7; the presets are levelled to −18 LUFS with PRESET VOL |
| Sound of the two models | The twin has one voicing: the Subsequent 37's cleaner mixer headroom is the 5-is-unity law above |

## Where the twin differed from the hardware, and how it was resolved

The fix list from `docs/research/sub37/sources.md` §6, checked against the rebuilt twin.

| # | Difference found | Resolution |
|---|---|---|
| 1 | Labels: KB AMT, PGM DEST, PGM AMT, MODE, BACK/FWD, LATCH, MASTER VOL | Now KB TRACK, MOD DEST (printed DEST), MOD AMT, PATTERN, BACK / FORTH, LATCH ON and VOLUME (Subsequent 37 manual, pp.16, 23, 28, 31, 34) |
| 2 | Noise was white | Pink noise (a Kellet pink filter, peak-normalised) (Subsequent 37 manual, p.27) |
| 3 | MOD DEST had 4 made-up targets | The 7 panel destinations, with RES and others reachable through PGM DST (Subsequent 37 manual, pp.23-24, 51) |
| 4 | PITCH, FILTER and MOD AMT were unipolar | All three are bipolar, -5..+5 (Subsequent 37 manual, p.23) |
| 5 | BEAT FREQ was ±3 Hz | ±3.5 Hz (Subsequent 37 manual, p.26) |
| 6 | KB CTRL was on / off | HI / LO / OFF; OFF makes OSC 2 drone with FREQUENCY at ±3 octaves, in DUO MODE (Subsequent 37 manual, p.26) |
| 7 | Filter KB AMT 0-100 % around MIDI 60 | KB TRACK 0-2:1, 1:1 at halfway, pivoting at MIDI 48 (Subsequent 37 manual, p.29) |
| 8 | No mixer overdrive, no mixer mutes | Unity at 5 and overdrive above it; an ON button per channel (Subsequent 37 manual, p.27) |
| 9 | Note priority was fixed at LAST | KB PRIORITY LAST (default), LOW, HIGH (Subsequent 37 manual, p.42) |
| 10 | Bend was fixed at ±2 | BEND UP / DOWN 0-24 (default 2) and BEND DEST (Subsequent 37 manual, p.42) |
| 11 | Envelope gaps | SYNC retriggers on its CLOCK DIV; the AMP DELAY needs LOOP; KB TRACK shortens decay and release only, 0-2:1; VEL AMT keeps full strikes at full; EXP. ATTACK off by default; LOOP skips sustain (Subsequent 37 manual, pp.31-33, 41) |
| 12 | Arpeggiator gaps | SYNC / TAP, INVERT, the SEQ and REC positions, the 7-state RANGE, GATE LENGTH (50 %), SWING, END NOTES, STEP 1 RESET; synced, it waits for the clock (Subsequent 37 manual, pp.15-16, 40) |
| 13 | No sequencer | 64 steps with REST, TIE, DUO steps, STEP EDIT, ratchet, rotate, skip, first / last step and quick erase. SEQ MOD (the per-step mod-wheel value) is not modelled (Subsequent 37 manual, pp.16-20) |
| 14 | Keys were mapped from MIDI 48 | The 37 keys are MIDI 36-72 and the computer keys start at 36; MIDI 48 is the reference for KB TRACK and REF NOTE MID C (Subsequent 37 manual, pp.29, 46) |
| 15 | CV inputs were not specified | PITCH, FILTER and VOL CV take 0 to +5 V (1.0 = 5 V); KB GATE gates the envelopes. Mapping KB GATE to STEP ADV (CV MAPPING) is not modelled (Subsequent 37 manual, pp.8, 45-46) |
| 16 | GLIDE TIME showed milliseconds | The panel's 0-10 scale; the time map is a guess (Subsequent 37 manual, p.21) |
| 17 | Page references ran about one page early | Every `manualReference` in `spec.ts` and every citation here uses the manual's printed pages |

## Not modelled

- Aftertouch and CTRL4 as modulation sources (PRESSURE reads zero), and on-screen velocity: the
  on-screen keys play at full velocity; a MIDI keyboard sends velocity.
- SEQ MOD recording and its MOD DST / SEQ MOD AMT; per-step velocity (steps play at the key's
  velocity).
- COMPARE, SAVE and naming (the studio project stores presets and edits), the MIDI menu, CV MAPPING,
  POT MODE, GLOBAL VARIANCE and the global KB PRIORITY override, PHASE RESET, DLAY PGM CHG and MIDI
  OUT, LFO SWING, the MIDI-only middle LFO range.
- Holding DUO MODE to enter pitch 2 in STEP EDIT (play a legato key instead).

## Presets

The hardware holds 16 banks of 16 (Subsequent 37 manual, p.12). The twin fills banks 1-4 with 64
presets (`presets.ts`):
- recreations of Sub 37 factory presets (F1 gives names and categories, not settings, so every
  recreation is our own programming of the character its name and category describe, and says so in
  its description);
- Synth Studio originals of classic Moog techniques;
- two built from the manual itself (One-Finger Fifths, p.26; the acid tip of the Quickstart).

Names are "Category / Name" in the factory categories. Every preset is levelled to −18 LUFS (FX
−22, drones −21) with PRESET VOL, measured by `scripts/audio-qa.cjs --target -18`, with true peaks
at or below −1 dBTP and nothing still sounding 2 s after release (except the drones).
