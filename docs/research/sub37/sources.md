# Moog Sub 37 / Subsequent 37: sources and complete parameter reference

Research for the Synth Studio digital twin (`devices/sub37/`). Revised 2026-10-29 with the **official manuals** as the primary source.

**Citations.** "**manual p.N**" means the *Sub 37 Owner's Manual v1.1* (©2015) and the *Subsequent 37 Owner's Manual* (©2017). The two texts are **word-for-word identical, page for page**: a word-level diff found only the product name, the copyright year, an "ALL NOTES OFF 123" CC row and a few typos. So one page number is valid for both. Files: `scratchpad/manuals/sub37/Sub_37_Owners_Manual_v1.1/text.txt` and `…/Subsequent_37_Owners_Manual/text.txt`.

**Confidence tags**
- **verified**: stated in the manual, with the page given.
- **likely**: a strong inference from the manual or the MIDI tables, or one good secondary source.
- **guess**: engineering inference; keep it as a tunable constant.

**Copyright** (scratchpad `manuals/COPYRIGHT-RULES.md`): facts are in our own words, with very few short quotes (≤ 25 words, cited). Twin presets must get descriptive names and mention the factory source only in the description.

---

## 1. Sources

| id | What | Where | Licence / status | Used for |
|---|---|---|---|---|
| **M1** | Sub 37 Owner's Manual v1.1 (62 pp) | `scratchpad/manuals/sub37/Sub_37_Owners_Manual_v1.1/` (text.txt, renders of pp.1–14, 28, 39, 42, 48, 49) | Moog copyright, reference only | **primary**: every range, list and behaviour |
| **M2** | Subsequent 37 Owner's Manual (63 pp) | `…/Subsequent_37_Owners_Manual/` | Moog copyright | same text as M1 (pages identical) |
| **F1** | Moog "Sub 37 Factory Presets": by bank and number (`S37presets`), by name (`S37name`) and by category (`S37categ`), US Letter and A4 | `scratchpad/manuals/sub37/S37presets/text.txt` etc. | Moog copyright | **the Sub 37 factory bank: 134 presets (1.1–9.6) with categories** |
| **S1** | midi.guide dataset, Subsequent 37 (157 rows) | https://github.com/pencilresearch/midi/blob/main/Moog/Subsequent%2037.csv · clone `research/sub37/repos/pencilresearch-midi/` · in-app copy `public/midi-guide/devices/moog-subsequent-37.json` | **CC BY-SA 4.0** | CC/NRPN numbers (it matches manual pp.53–59, including two misprints S1 itself flags) |
| **S2** | patchscore, Subsequent 37 manifest. 20 factory presets were read off a **Subsequent 37 screen at firmware 1.2.0**, and the panel is measured from the Quickstart poster | https://github.com/miclip/patchscore (`lib/devices/moog-subsequent-37/`) · clone `research/sub37/repos/patchscore/` | **no licence** (private package), so facts only | Subsequent 37 factory slot check; panel layout |
| **S3** | Cubase device files with 16 × 16 program names from an owner of the official Subsequent 37 Editor | https://gist.github.com/redconfetti/3c8999732d459c853df27fa4f0dd515d · https://gist.github.com/redconfetti/62f7240d489fcb68be91a00fe800d343 · clones `research/sub37/repos/gist-*` | no licence; names only | **the Subsequent 37 factory bank** (144 names) |
| **S4** | Ardour MIDNAM `Moog_Subsequent_37.midnam` | https://github.com/Ardour/ardour/blob/master/share/patchfiles/Moog_Subsequent_37.midnam · clone `research/sub37/repos/ardour-tree/` | GPL-2.0 | CC cross-check |
| **S5** | Moog forum, from search snippets (the forum host is blocked) | URLs inline | n/a | Background only; superseded by M1 wherever they overlap |
| **S6** | Retail and press copy on the Subsequent 37 changes (twice the mixer headroom, re-voiced Multidrive, filter gain staging, keybed, headphone amp) | https://www.scan.co.uk/products/moog-subsequent-37-paraphonic-analogue-synthesizer-37-note-multidirve · https://rekkerd.org/?p=115772 · https://www.guitarguitar.co.uk/product/170831314026008--moog-subsequent-37 | n/a | How the two instruments sound different (**likely**; the manuals do not discuss it) |
| **S7** | Existing twin `devices/sub37/spec.ts`. Its page numbers run about one page early (it has osc p.24, mixer p.26, filter p.27; the manual has 25, 27, 28) | repo | project | — |

**Repos cloned** (about 7.5 MB, `research/sub37/repos/`):
- `pencilresearch-midi` (CC BY-SA 4.0)
- `patchscore` (no licence)
- `gist-sub37-cubase` and `gist-subsequent37-cubase` (no licence)
- `ardour-tree` (GPL-2.0)

No open-source Sub 37 editor, librarian or sysex parser turned up. The sysex format is undocumented, though the manual's MIDI menu lists the dump types (p.37–38).

**Two instruments, one manual.** The Subsequent 37 (2017) keeps the Sub 37's panel, parameters, MIDI map and manual text. The differences are analog voicing (S6, **likely**) and the factory bank. The manual says nothing about circuit changes. For the twin, treat the two as one control set, and treat "Subsequent voicing" as a cleaner mixer: more headroom before the >5 overdrive bites.

---

## 2. Key facts with manual pages (paraphrased; quotes only where wording matters)

**Architecture**
- A **2-note paraphonic** analog synth (p.9).
  - The keyboard has 37 keys with **velocity and aftertouch** (p.9, p.61).
  - The panel has **40 knobs and 74 switches**, and every control sends and receives MIDI (p.9).
  - There are 2 mod busses, 2 looping DAHDSR envelopes, and an arpeggiator with a **paraphonic 64-note step sequencer**. Each of those sections has its own **SYNC** switch (p.9).
- The block diagram (p.11) shows the audio path:
  - VCO 1, its SUB, VCO 2, NOISE and EXT AUD (switched to **FEEDBACK** from the mixer output when the jack is empty) feed the **MIXER**.
  - The mixer feeds the **LADDER FILTER** (slope select), then **MULTIDRIVE**, then the **VCA**, which splits to AUDIO OUT and headphones.
  - VCO 1 hard-syncs VCO 2 ("OSC 1-2 SYNC"), and VCO 1 also has a NOTE SYNC (KB reset) input.

**Programming**
- **FINE TUNE** moves both oscillators up to ±1 semitone (p.14).
- **KB OCTAVE** gives ±2 octaves, so the 3-octave keyboard reaches 7 octaves; the buttons light dim for one octave and bright for two (p.14).
- **Quick transpose** spans −12 to +12 semitones and is stored per preset (p.14, p.42).
- **PANEL** mode plays the live knob positions and **PRESET** mode plays the stored preset (p.14). Holding PANEL/INIT initialises the panel (p.14).

**Oscillators** (pp.25–26)
- **OCTAVE** has four ranges: 16', 8', 4', 2'.
- **WAVE** is continuous, from triangle through sawtooth and square to narrow pulse.
- **HARD SYNC** locks OSC 2's phase to OSC 1. If OSC 1 is higher, OSC 2 gives little or no output (p.26).
- **KB RESET** starts both oscillators' cycles together on each new note. It can click, and a short Amp release reduces the click (p.26).
- **DUO MODE** plus **KB CTRL**:
  - HI: OSC 2 plays the highest note and OSC 1 the lowest.
  - LO: the reverse.
  - OFF: OSC 2 drones and FREQUENCY widens to **±3 octaves** (p.26).
- **FREQUENCY** covers **±7 semitones**; the centre is unison and full clockwise is a fifth (p.26).
- **BEAT FREQ** covers **±3.5 Hz**, a constant-Hz detune, so the beat rate is the same on every note. FREQUENCY detunes in cents, so its beat halves or doubles per octave (p.26).
- Quote: "For this reason, if you want a constant beat frequency at all pitches, make sure that the OSCILLATOR 2 FREQUENCY control is centered." (manual p.26)

**Mixer** (p.27)
- There are five channels: OSC 1, **SUB OSC**, OSC 2, **NOISE (pink)** and **FDBK/EXT IN**. Each has a 0–10 knob and a **mute button**.
- Above 5 a channel goes past unity and gently overdrives the filter input; at 5 or below it is clean.
- The sub is **always a square, exactly one octave below OSC 1**.
- With EXT IN empty, the FDBK/EXT IN channel feeds the **mixer's own output** back into itself. The result ranges from distorted and chaotic to mellow, and it can raise the volume considerably.

**Filter** (pp.28–29)
- A Moog low-pass ladder with four slopes: 1, 2, 3 or 4 poles (−6, −12, −18, −24 dB/oct), switchable while playing.
- **CUTOFF** runs from 20 Hz, which effectively closes the filter, to 20 kHz. The p.28 drawing shows a log legend: 20 Hz · 80 · 320 · **500 Hz at 12 o'clock** · 1.2 k · 5 k · 20 kHz.
- **RESONANCE** runs 0–10 and **self-oscillates above 7**.
- **MULTIDRIVE** runs 0–10, from asymmetrical tube-like warmth to hard clipping. It drives **OTA and FET stages placed between the filter and the amplifier**.
- **EG AMT** is bipolar, −5 to +5. Its effect depends on CUTOFF: there is little room to push up when CUTOFF is high, or down when it is low.
- **KB TRACK**: 0 at the bottom, **1:1 at halfway, centred on C3 = MIDI 48**, and **2:1 at full**. The p.28 panel drawing labels it **"KB TRACK"** on the Sub 37 too.

**Envelopes** (pp.29–33): two DAHDSR envelopes, filter and amp.
- **ATTACK, DECAY and RELEASE** each run 1 ms–10 s. **SUSTAIN** runs 0–100 %, marked 1–10.
- **KNOB SHIFT**, which blinks while active, turns the knobs into **DELAY** (0–10 s), **HOLD** (0–10 s), **VEL AMT** (0–100 %) and **KB TRACK** (0 to 2:1, 1:1 at noon).
  - **VEL AMT**: the hardest strike always gives the full amount, and higher settings lower the softer strikes (p.32).
  - Envelope **KB TRACK** shortens only the **decay and release** times as you play higher (p.32, p.33).
  - The manual's filter-section text says VEL AMT is on the "FILTER DECAY knob". That is a typo; the strip and the amp text put it on the SUSTAIN knob.
- **MULTI TRIG** off (the default) is single triggering: legato notes don't retrigger. Lit, every key sends a new gate (p.31).
- **RESET** off (the default): the attack starts from the current level. Lit: it starts from zero (p.31).
- **SYNC**: the envelope **retriggers every unit of the beat**, at the CLOCK DIV set in PRESET EDIT (p.31, p.33).
- **LOOP**: **delay, attack, hold, decay and release** repeat while the note is held, making a multistage LFO (p.31, p.33).
- **LATCH ON**: the envelope stays at SUSTAIN as if the gate were on (p.31, p.33).
- The **Amp EG DELAY only works when LOOP is on** (p.33).
- Menu (pp.41–42), per envelope:
  - **GATE SRC**: BOTH / NOTES / EXT (KB GATE).
  - **EXP. ATTACK**: OFF (default, linear) or ON.
  - **CLOCK DIV**: 21 values.

**Modulation** (pp.22–24, 50–52)
- MOD 1 and MOD 2 are nearly identical, **except that by default the MOD wheel sets MOD 1's overall depth** (p.22).
- **LFO RATE** runs **0.1–100 Hz**; **HI RANGE** multiplies it by 10, to **1–1,000 Hz**. Vibrato rates of 5–10 Hz are possible in either range (p.22–23).
- **SYNC** locks the LFO to the internal or MIDI clock, and RATE then picks a division (p.23).
- **KB RESET** restarts the LFO at zero on each new note (p.23).
- **SOURCE** (a knob, counter-clockwise first) has six positions (p.22):
  - TRIANGLE, SQUARE, SAWTOOTH, RAMP ("reverse sawtooth"), S&H.
  - **F. EG/PGM**: this bypasses the LFO and uses the filter envelope by default, or the PGM SRC chosen in the menu.
- **PITCH AMT** is bipolar, with an **OSC** button for 1, 2 or both. **FILTER AMT** is bipolar. **MOD AMT** is bipolar (p.23).
- The **MOD DEST** button has seven destinations (pp.23–24):
  - **LFO RATE**, which is the *other* LFO's rate: MOD 1 drives LFO 2, and MOD 2 drives LFO 1.
  - **VCA LEVEL**, for tremolo, or ring-mod-like tones at high rates.
  - **OSC 1 WAVE / OSC 2 WAVE / BOTH**. These don't affect the sub.
  - **NOISE LEVEL**, added to or subtracted from the mixer setting.
  - **EG TIME/PGM**. By default this scales the envelope times without changing their shape: negative is shorter, positive longer. Otherwise it is the PGM destination.
- **Assigning PGM DEST**: hold the MOD DEST button and move the target control (p.24).
- **CONTROLLERS** opens the per-bus menu (pp.50–52):
  - **MOD WHEEL**, **VELOCITY**, **AFTERTOUCH** and **CTRL4 AMT**, each −100…+100 %, give the depth at full controller.
  - **CTRL4 SRC** is BREATH (CC 2), FLT EG, AMP EG, LFO 1 or LFO 2.
  - **PGM SRC** (replacing the Filter EG) can be AMP EG, CONST ON, SINE LFO (an extra LFO), NOISE LFO, OSC1 PCH, OSC2 PCH, SEQ NOTE, SEQ VEL, SEQ MOD, PRESSURE, KB TRACK (bipolar, centred on MIDI 48) or VELOCITY.
  - **PGM DST** is a long list of nearly every panel and menu parameter (p.51).
  - **LFO KBTRACK** runs **0–200 %**, so the LFO speeds up as you play higher.
  - **SWING LFO** defaults to ON, so a synced LFO follows the arp swing.

**Glide** (p.21)
- **TIME** has no unit given in the manual.
- **OSC** selects 1, 2 or both (two LEDs).
- **TYPE**:
  - **LCR** (the "most commonly used" type): bigger intervals take longer.
  - **LCT**: constant time.
  - **EXP**: fast, then slowing.
- **GATED**: the pitch only glides while a key is held. When GATED is off, the glide continues after release.
- **LEGATO** glides only when a key is pressed while another is held; it needs ON lit too.
- **ON** enables glide.

**Arpeggiator** (pp.15–16, 40)
- **ON/REST**: on/off for the arp; a REST in the sequencer.
- **LATCH/TIE**: latch for the arp; a TIE in the sequencer.
  - LATCH keeps looping hands-free. Notes added while others are held join the list; the first new note after all are released starts a new list.
- **RATE** runs **2–280 BPM**. With **SYNC** lit, RATE picks a clock division of the tap/internal or MIDI clock.
  - With SYNC lit and not in TAP mode, the arp/sequencer **won't play without MIDI clock**.
  - **TAP**: hold SYNC for 1 s, then tap quarter notes; it locks on the 3rd tap.
- **RANGE**: −2…+2 octaves, plus combined 0&±2 modes that run through three octaves and then back via the 2nd.
- **BACK/FORTH**: UP becomes up-then-down, DWN becomes down-then-up, ORDR becomes forwards-then-reverse. It does nothing to RND.
- **INVERT**: each note plays in two or three successive octaves before moving on. It does nothing at RANGE 0.
- **PATTERN** knob positions: UP, DWN, ORDR, RND, SEQ, REC.
- Menu (PRESET EDIT 1.1):
  - **GATE LENGTH**: OFF–100 %, default 50 %.
  - **CLOCK DIV**: 4 whole notes to a 1/64 triplet.
  - **SWING**: 0–100 %, default 50 % (straight); below 50 the off-beats move earlier.
  - **STEP 1 RESET**: KB RESETs fire only on the pattern's first note.
  - **END NOTES**: ONCE (default) / TWICE.

**Step sequencer** (pp.17–20, 40–41, 46–47)
- **Recording.** Turn PATTERN to REC with the arp off; the next key erases the old sequence. A sequence holds up to **64 steps**.
  - **REST** adds a silent step.
  - **TIE** into a *different* note changes pitch **without retriggering the envelopes**. With LEGATO glide on, only tied notes glide. A tie into the *same* note doubles its length.
  - In **DUO MODE** a step can hold **two notes**.
- **Playback.** PATTERN to SEQ, then ON; the key you press transposes.
  - GLOBAL **REF NOTE** sets the reference: FIRST (default) or MID C = MIDI 48.
- **STEP EDIT** (hold BANK and press LATCH): four pages of 16 steps on the PRESET buttons. Per step you can edit:
  - one or two pitches, velocity, rest or tie, and SEQ MOD
  - first and last step
  - **ROTATE**, **SKIP** and **RATCHET**. The ratchet count is 1–8×, default 2×, and is one value per sequence.
- **SEQ MOD.** The mod-wheel position is stored per step as a bipolar value. It is routable through MOD DST or used as a mod source.
- **SEQ OPTIONS:**
  - PHASE RESET (off by default: a new note waits for the next beat)
  - LATCH RSTRT
  - DLAY PGM CHG
  - MIDI OUT (SEQ by default)

**Performance and keys**
- PRESET EDIT 2 (p.42):
  - **KB PRIORITY**: LOW / HIGH / **LAST (default)**. There is a global override (p.44).
  - **BEND UP**: +0…+24 semitones, **default +2**.
  - **BEND DOWN**: −0…−24, **default −2**.
  - **BEND DEST**: NONE / OSC1 / OSC2 / BOTH.
  - **PRESET VOL**: OFF–100 %, default 100 %.
- PRESET MWHL (p.47): ON (default) recalls the mod-wheel position stored with the preset. Global VARIANCE adds random detune of 0–40 cents per note (p.44).

**I/O** (pp.7–8, 34, 61)
- Audio:
  - **AUDIO OUT**: ¼" TS, mono.
  - **HEADPHONES**: ¼" TRS, mono on both sides, with its own level that tracks the main VOLUME.
  - **MUTE** silences AUDIO OUT only.
  - **EXT IN**: ¼" TS, unbalanced, line level. A key, an FS-1 pedal, or AMP EG LATCH ON is needed to pass audio.
- CV/gate:
  - **PITCH CV**, **FILTER CV** and **VOL CV**: **0 to +5 V** or an expression pedal. PITCH is 1 V/oct.
  - **KB GATE**: +5 V.
  - **CV MAPPING** (pp.45–46):
    - PITCH and VOL CV can be mapped to almost any parameter, or to SQMODAMT, RTCHT CT or ST1 RESET (a trigger above 2.5 V restarts the arp/sequencer).
    - KB GATE can be mapped to on/off parameters, to **STEP ADV** (each trigger advances the arp/sequencer step, overriding internal or MIDI clock) or to SUST PED.
- MIDI: DIN IN, DIN OUT and class-compliant USB-MIDI; **no USB audio** (p.8). The default channel is 1 (p.36).
  - SEND CLOCK: OFF / ARP / ON.
  - SEND ST/STP: ON by default.
  - FOLLOW SPP is available.
  - ECHO DIN/USB IN gives THRU or merge.
  - KNB NRPN/CC defaults to **CC**; CC FORMAT is 7-bit (default) or 14-bit (pp.36–37).

**Specs** (p.61)
- Engine and voices: **100 % analog**; mono or duophonic.
- Sources: 2 variable-shape VCOs, a square sub, analog noise, ext/feedback.
- Pitch range: oscillator calibration range **22 Hz–6.8 kHz**; guaranteed note range at 8' of **MIDI 18–116**. Note calibration covers MIDI 15–116 (p.48).
- LFO: **0.01 Hz–1000 Hz**.
- Presets: 256 (16 banks × 16).
- Size: **22 lb / 10 kg**; 6.75" H × 26.375" W × 14.75" D, or 17 × 68 × 37.5 cm. The inch width is a misprint: 68 cm is about 26.75".

---

## 3. Complete parameter list (manual pp.53–59 = S1)

Panel ranges are as printed on the panel or in the text. CC is MSB/LSB (LSB = MSB + 32 for 14-bit). NRPN is the number (MSB:LSB) and its value count. "Twin id" is today's `spec.ts`; **NEW** marks a proposed id.

### 3.1 Oscillators (pp.25–26)

| Panel | Twin id | Range | Values | CC | NRPN | Conf |
|---|---|---|---|---|---|---|
| OSC 1 OCTAVE | `osc1_octave` | 16' 8' 4' 2' | CC 0 / 32 / 64 / 96 | 74 | 479 (3:95) ×4 | verified |
| OSC 1 WAVE | `osc1_wave` | TRI → SAW → SQR → narrow PULSE, continuous | **guess:** evenly spaced (0, ⅓, ⅔, 1) | 9/41 | 480 (3:96) 14-bit | verified (range) |
| OSC 2 OCTAVE, WAVE | `osc2_octave`, `osc2_wave` | as OSC 1 | | 75 · 14/46 | 483 · 484 | verified |
| FREQUENCY (OSC 2) | `osc2_frequency` | **±7 st**; **±3 oct** in DUO + KB CTRL OFF | centred | 12/44 | p.58 prints "OSC 2 FREQUENCY 487" with 3 values; S1 reads it as a 3-state "frequency mode". The value column around 485–490 is visibly shifted (DUO MODE shows 16384, OSC 1 ON shows 21), so treat 487 as **uncertain**. The 14-bit knob value may be CC-only | verified (CC, range) |
| BEAT FREQ | `beat_freq` | **±3.5 Hz** | centred | 13/45 | p.58 prints "OSC 2 BEAT 488" with 2 values (S1: beat on/off); **uncertain** for the same reason | verified (CC, range) |
| HARD SYNC | `hard_sync` | on/off | CC 0 / 64 | 77 | 481 (3:97) | verified |
| KB RESET | `kb_reset` | on/off | CC 0 / 64 | 81 | 482 | verified |
| DUO MODE | `duo_mode` | on/off | CC 0 / 64 | 110 | 486 | verified |
| KB CTRL | **NEW** `osc2_kb_mode` (3-state) | HI / LO / OFF ("neither") | CC 64 HI · 32 LO · 0 NEITHER | 111 | 485 ×3 | verified |
| FINE TUNE | **NEW** `fine_tune` | ±1 semitone, both oscillators | | — | — | verified (p.14) |

### 3.2 Mixer (p.27)

Each channel is a 0–10 knob plus a **mute** button. S1 and the NRPN chart call the button "ON". Above 5 each channel overdrives the filter input.

| Panel | Twin id | CC | NRPN level / on | Notes |
|---|---|---|---|---|
| OSC 1 | `mix_osc1` (+ **NEW** `mix_osc1_on`) | 114 ("OSC 1 LEVEL") | 489 / 490 | |
| SUB OSC | `mix_sub` (+ `mix_sub_on`) | 115 ("OSC 1 SUB LEVEL") | 492 / 491 | square, one octave below OSC 1 |
| OSC 2 | `mix_osc2` (+ `mix_osc2_on`) | 116 | 493 / 494 | |
| NOISE | `mix_noise` (+ `mix_noise_on`) | 117 | 496 / 495 | **pink** |
| FDBK / EXT IN | `mix_feedback` (+ `mix_feedback_on`) | 118 | 497 / 498 | mixer output back into itself when EXT IN is empty |

### 3.3 Filter (pp.28–29)

| Panel | Twin id | Range | CC | NRPN | Conf |
|---|---|---|---|---|---|
| CUTOFF | `cutoff` | 20 Hz–20 kHz, log legend (500 Hz at noon) | 19/51 | 499 | verified |
| RESONANCE | `resonance` | 0–10, self-oscillates above 7 | 21/53 | 500 | verified |
| MULTIDRIVE | `multidrive` | 0–10 (OTA + FET, post-filter) | 18/50 | 501 | verified |
| SLOPE | `filter_slope` | −6/−12/−18/−24 dB (button + 4 LEDs); CC 0/32/64/96 | 109 | 502 ×4 | verified |
| EG AMT | `filter_eg_amt` | −5…0…+5 | 27/59 | 503 | verified |
| **KB TRACK** | `filter_kb_amt` → **0–200 %** | 0 · 1:1 at noon · 2:1 | 22/54 | 504 | verified (relabel from "KB AMT") |

### 3.4 Envelopes (pp.29–33, 41–42)

| Panel (shifted) | Twin id | Range | CC Filter / Amp | NRPN Filter EG | Conf |
|---|---|---|---|---|---|
| ATTACK (DELAY) | `*_attack` (`*_delay`) | 1 ms–10 s (delay 0–10 s) | 23/55 · 28/60 (delay 103 · 104) | 505 (509) | verified |
| DECAY (HOLD) | `*_decay` (`*_hold`) | 1 ms–10 s (hold 0–10 s) | 24/56 · 29/61 (hold 105 · 106) | 506 (510) | verified |
| SUSTAIN (VEL AMT) | `*_sustain` (`*_vel_amt`) | 0–100 %, marked 1–10 (vel 0–100 %) | 25/57 · 30/62 (vel 86 · 87) | 507 (511) | verified |
| RELEASE (KB TRACK) | `*_release` (`*_kb_amt`) | 1 ms–10 s (KB 0–2:1; decay and release only) | 26/58 · 31/63 (kb 79 · 80) | 508 (512) | verified |
| MULTI TRIG | `*_multi_trig` | on/off | 112 · 113 | 513 | verified |
| RESET | `*_reset` | on/off | 82 · 83 | 514 | verified |
| SYNC | **NEW** `*_sync` | retrigger every CLOCK DIV | — | 515 | verified |
| LOOP | `*_loop` | D-A-H-D-R repeat | — | 516 | verified |
| LATCH ON | `*_latch` | hold at sustain | — | 517 | verified |
| (menu) CLOCK DIV | **NEW** `*_clock_div` | 21 divisions | — | 518 (the chart misprints ×2) | verified |
| (menu) EXP. ATTACK | **NEW** `*_exp_attack` | OFF (linear, default) / ON | — | 520 | verified |
| (menu) GATE SRC | **NEW** `*_gate_src` | BOTH / NOTES / EXT | — | not charted | verified |

The manual's NRPN chart (p.59) ends at 524, so it has **no Amp EG NRPNs**. A forum post says the Amp A/D/S/R sit at MSB 4, LSB 15–18 (NRPN 527–530) (https://forum.moogmusic.com/t/sub-37-complete-nrpn-documentation/16554) (**likely**). The rest of that block is unknown.

### 3.5 MOD 1 / MOD 2 (pp.22–24, 50–52)

| Panel / menu | Twin id (N = 1, 2) | Range / values | CC (MOD 1 · MOD 2) | NRPN (MOD 1 · MOD 2) | Conf |
|---|---|---|---|---|---|
| LFO RATE | `modN_rate` | 0.1–100 Hz; ×10 HI RANGE; a division when synced | 3/35 · 8/40 | 423 · 448 | verified |
| HI RANGE | `modN_hi_range` | on/off. The MIDI parameter is 3-state LOW/MED/HI (CC 0/43/85); LOW is undocumented. **guess:** 0.01–10 Hz, the p.61 floor | 76 · 78 | 424 · 449 ×3 | verified (2 states on the panel) |
| SYNC | **NEW** `modN_sync` | on/off | — | 425 · 450 | verified |
| (division) | **NEW** `modN_clock_div` | 21 divisions (§3.7) | CC 3 · 8 when synced | 427 · 452 | verified |
| KB RESET | **NEW** `modN_kb_reset` | on/off | 93 · 95 | 426 · 451 | verified |
| SOURCE | `modN_source` | TRI, SQR, SAW, RAMP (reverse saw), S&H, F.EG/PGM; CC 0/21/43/64/85/107 | 71 · 72 | 440 · 465 ×6 | verified |
| PITCH AMT + OSC | `modN_pitch_amt` (**bipolar**), `modN_pitch_dest` | bipolar; OSC 1+2 / 1 / 2 (CC 0/43/85) | 4/36 · 15/47; OSC 70 · 88 | 445 · 470; 447 · 472 | verified |
| FILTER AMT | `modN_filter_amt` (**bipolar**) | bipolar | 11/43 · 16/48 | 446 · 471 | verified |
| MOD DEST | **NEW** `modN_dest` (replaces `modN_pgm_dest`) | 0 other-LFO rate · 1 VCA · 2 OSC1 wave · 3 OSC1+2 wave · 4 OSC2 wave · 5 noise · 6 EG time/PGM (CC 0/18/37/55/73/91/110) | 91 · 92 | 442 · 467 ×7 | verified |
| MOD AMT | `modN_pgm_amt` (**bipolar**) | bipolar | 20/52 · 17/49 ("PGM DEST AMT") | 444 · 469 | verified |
| CONTROLLERS: MOD WHEEL / VELOCITY / AFTERTOUCH / CTRL4 AMT | **NEW** `modN_wheel_amt` etc. | −100…+100 % each. **Init (verified, p.22): the wheel sets MOD 1's depth.** **guess:** MOD 2 runs at full depth with all four at OFF | — | 435–438 · 460–463 | verified |
| CTRL4 SRC | **NEW** | BREATH (CC 2), FLT EG, AMP EG, LFO 1, LFO 2 | — | not charted | verified |
| PGM SRC | **NEW** `modN_pgm_src` | FILTER EG (default), AMP EG, CONST ON, SINE LFO, NOISE LFO, OSC1 PCH, OSC2 PCH, SEQ NOTE, SEQ VEL, SEQ MOD, PRESSURE, KB TRACK, VELOCITY | — | 441 · 466 (the chart says ×8; firmware 1.1+ lists 13) | verified (list) |
| PGM DST | **NEW** | p.51 list (filter, mixer, arp, glide, LFO, osc, both EGs, bend, volume, swing, seq mod, ratchet) | — | 443 · 468 ×89 | verified |
| LFO KBTRACK | **NEW** | 0–200 % | — | 430 · 455 | verified |
| SWING LFO | **NEW** | ON (default) / OFF | — | — | verified |

### 3.6 Glide (p.21)

| Panel | Twin id | Range | CC | NRPN | Conf |
|---|---|---|---|---|---|
| ON | `glide_on` | on/off | 65 | 422 | verified |
| TIME | `glide_time` | no unit published. **Show the panel's 0–10**; the time map is a **guess** (§5) | 5/37 | 417 | verified (no unit) |
| TYPE | `glide_type` | LCR / LCT / EXP (CC 0/43/85) | 85 | 419 | verified |
| OSC | `glide_osc` | 1+2 / 1 / 2 (CC 0/43/85) | 102 | 418 | verified |
| GATED | `glide_gated` | on/off | — | 420 | verified |
| LEGATO | `glide_legato` | on/off | 94 | 421 | verified |

### 3.7 Arpeggiator and sequencer (pp.15–20, 40–41)

| Panel / menu | Twin id | Range / values | CC | NRPN | Conf |
|---|---|---|---|---|---|
| ON / REST | `arp_on` | on/off; a rest in REC | 73 | 410 | verified |
| LATCH / TIE | `arp_latch` | on/off; a tie in REC | 69 | 411 | verified |
| RATE | `arp_rate` | 2–280 BPM; a division when synced | — | 403 | verified |
| SYNC / TAP | **NEW** `arp_sync` (+ tap mode) | on/off; hold 1 s for tap tempo | — | 404 | verified |
| RANGE | `arp_range` → **7 states** | `0&-2`, −2, −1, 0, +1, +2, `0&+2` | — | 405 ×7 | verified |
| BACK / FORTH | `arp_back_fwd` | on/off | — | 406 | verified |
| INVERT | **NEW** `arp_invert` | on/off | — | 408 | verified |
| PATTERN | `arp_mode` → **NEW** `arp_pattern` | UP · DWN · ORDR · RND · SEQ · REC | — | 409 ×6 | verified |
| GATE LENGTH (menu) | **NEW** `arp_gate` | OFF–100 %, default 50 % | — | 412 | verified |
| CLOCK DIV (menu) | **NEW** `arp_clock_div` | 21 divisions. **likely:** this is the step length in both modes, and SYNC lets RATE choose it. Default not stated | — | 413 | verified (list) |
| SWING (menu) | **NEW** `arp_swing` | 0–100 %, 50 = straight | — | not charted | verified |
| STEP 1 RESET (menu) | **NEW** | on/off | — | 416 | verified |
| END NOTES (menu) | **NEW** `arp_end_notes` | ONCE / TWICE (S1 calls it "back/forth mode") | — | 407 | verified |
| Sequence data | **NEW** | ≤ 64 steps: pitch 1 and 2, velocity, rest, tie, SEQ MOD, skip, ratchet flag; first and last step; ratchet count 1–8 (default 2) | — | (sysex) | verified |

**Clock divisions** (p.52): index, name, CC window for LFO CC 3/8.

| # | name | CC | # | name | CC | # | name | CC |
|---|---|---|---|---|---|---|---|---|
| 0 | 4 whole | 0–6 | 7 | 1/2 | 43–48 | 14 | 1/16 dot | 86–91 |
| 1 | 3 whole | 7–12 | 8 | 1/4 dot | 49–54 | 15 | 1/8 T | 92–97 |
| 2 | 2 whole | 13–18 | 9 | 1/2 T | 55–60 | 16 | **1/16** | 98–103 |
| 3 | whole + 1/2 | 19–24 | 10 | **1/4** | 61–67 | 17 | 1/16 T | 104–109 |
| 4 | whole | 25–30 | 11 | 1/8 dot | 68–73 | 18 | 1/32 | 110–115 |
| 5 | 1/2 dot | 31–36 | 12 | 1/4 T | 74–79 | 19 | 1/32 T | 116–121 |
| 6 | whole T | 37–42 | 13 | 1/8 | 80–85 | 20 | 1/64 T | 122–127 |

Four whole notes is 384 MIDI clocks and a 1/64 triplet is 1 clock (p.40). The manual table has two typos: "WHOLE NOTE 25–40" and "dotted 1/4 note triplet".

### 3.8 Performance, keyboard, global

| Control | Twin id | Range / values | MIDI | Conf |
|---|---|---|---|---|
| MOD wheel | `mod_wheel` | 14-bit | CC 1/33, NRPN 402 | verified |
| PITCH wheel | `pitch_bend` | BEND UP +0…+24 (default **+2**), BEND DOWN −0…−24 (default **−2**), BEND DEST NONE/OSC1/OSC2/BOTH | PB; CC 107/108 take 0–24 semitones | verified (p.42, p.55) |
| KB PRIORITY | **NEW** `kb_priority` | LOW / HIGH / **LAST (default)**; global override LOW/HIGH/LAST/PRST | — | verified (p.42, p.44) |
| KB OCTAVE | **NEW** `kb_octave` | −2…+2 | CC 89 (0/26/51/77/102) | verified |
| KB TRANSPOSE | **NEW** `transpose` | −12…+12 (CC 119 receive only) | 119 | verified |
| VOLUME / MUTE / HEADPHONES | `master_volume` | main level; MUTE silences AUDIO OUT only | CC 7/39 | verified |
| PRESET VOL (menu) | **NEW** | OFF–100 %, default 100 % | — | verified |
| Hold pedal | — | sustain | CC 64 | verified |
| Bank / program | `preset_number` | CC 0 always 0; **CC 32 = 0 → banks 1–8, 1 → banks 9–16**; then PC 0–127 | | verified (p.53) |
| Local control, all notes off | — | | CC 122 (0/127), CC 123 | verified |

## 4. MIDI implementation notes

- **14-bit CC pairs** are MSB n and LSB n+32 (pp.53–55). Panel output defaults to **CC, 7-bit** (p.37).
- **NRPN:** CC 99 is the parameter MSB and CC 98 the LSB; then CC 6/38 carry the data. The manual notes that full panel output needs NRPN mode (p.56).
- **Recall:** bank b (1–16) and preset p (1–16) map to CC32 = (b > 8 ? 1 : 0) and PC = ((b − 1) mod 8)·16 + (p − 1).
- **Sysex** (pp.37–38) has five dump types:
  - **BUFFER SEND**: goes to the edit buffer.
  - **SEQUENCE SEND**: goes to the edit buffer.
  - **CUR PRESET**: overwrites the current slot.
  - **ALL PRESETS**: restores all 256 to their original slots.
  - **BULK DUMP**: includes MIDI and global settings.
  - The byte format is unpublished.
- **Clock:** 24 PPQN (p.15). SEND CLOCK OFF / ARP / ON (ARP sends only while the arp or sequencer runs). SEND ST/STP. FOLLOW SPP (p.37). **No analog clock jack.** Mapping KB GATE to **STEP ADV** lets a pulse cable step the arp/sequencer (p.46).

## 5. Unit models for the twin (knob travel v = 0…1)

| Control | Model | Basis |
|---|---|---|
| CUTOFF | f = 20 Hz · 1000^v | the p.28 legend is log and symmetric about about 600 Hz (**likely**) |
| EG times | t = 1 ms · 10^(4v) (1 ms–10 s) | the range is verified; the curve is a **guess** |
| DELAY, HOLD | 0 at v = 0, then about 1 ms · 10^(4v) | the range 0–10 s is verified; the curve is a **guess** |
| LFO RATE | f = 0.1 Hz · 1000^v; ×10 with HI RANGE | range verified, curve **guess** |
| ARP RATE | BPM = 2 · 140^v | range verified, curve **guess** |
| GLIDE TIME (0–10) | t = 10 ms · 1000^(x/10); x = 2 gives about 40 ms | **guess**. Moog's Quickstart acid tip uses TIME 2 (S2) |
| Mixer, RES, DRIVE, SUSTAIN, VEL | linear 0–10; twin % = 10 × panel; mixer unity at 5 | verified scale |
| ±5 amounts | linear; twin % = 20 × panel | verified scale |
| KB TRACK, filter and envelope | 0–2, 1:1 at noon; filter pivot at MIDI 48 | verified |
| LFO KBTRACK | 0–200 % | verified |

## 6. Where the current twin differs from the hardware (fix list)

1. **Labels.** Filter "KB AMT" should read **KB TRACK** (p.28 drawing). "PGM DEST" should be **MOD DEST** and "PGM AMT" **MOD AMT** (p.23). The arp's MODE should be **PATTERN**. BACK/FWD should be **BACK / FORTH**. The envelope LATCH should be **LATCH ON**. MASTER VOL should be **VOLUME**.
2. **NOISE is pink** (p.27).
3. **MOD DEST has 7 positions** (p.23–24). The twin's 4-way list (WAVE, RES, EG TIME, AMP) is not the panel; RES is reachable only as a PGM DST.
4. **PITCH AMT, FILTER AMT and MOD AMT are bipolar** (p.23).
5. **BEAT FREQ is ±3.5 Hz** (p.26).
6. **KB CTRL is HI / LO / OFF.** OFF gives FREQUENCY ±3 oct (p.26).
7. **Filter KB TRACK runs 0–2:1, pivoting at MIDI 48** (p.29).
8. **Mixer above 5 overdrives the filter input** (p.27); model it. The channel mute buttons are missing.
9. **Note priority defaults to LAST** (p.42). The current twin's LAST is right; LOW and HIGH should be added.
10. **Pitch bend defaults to ±2, adjustable 0–24, with BEND DEST** (p.42).
11. **Envelopes:**
    - SYNC retriggers each clock division.
    - Amp DELAY works only with LOOP on.
    - Env KB TRACK scales decay and release only, 0–2:1.
    - VEL AMT: the hardest strike gives the full amount.
    - EXP ATTACK is off by default (linear).
    - LOOP skips sustain.
12. **Arp:** SYNC/TAP, INVERT, the SEQ/REC pattern positions, 7-state RANGE, GATE LENGTH 50 %, SWING, END NOTES and STEP 1 RESET are missing. Synced, it **won't run without clock**.
13. **Sequencer** (64 steps, duo steps, ties, ratchet, rotate, skip, SEQ MOD) is missing.
14. **The keyboard sends MIDI 36–72** at KB OCTAVE 0, and the box calls **MIDI 48 Middle C** (p.19, p.29). `lowNote: 48` is an octave high.
15. **CV inputs take 0 to +5 V** (p.8). KB GATE can be a clock (STEP ADV) (p.46).
16. **GLIDE TIME is a 0–10 panel scale** (no unit).
17. **The page references in spec.ts run about one page early.** Use the pages in this document.

## 7. Remaining uncertainties

- **Absolute depths:** EG AMT and MOD PITCH/FILTER amounts at ±5, in octaves. These are not published (§5 of signal-flow.md gives guesses).
- **The LOW LFO range's endpoints:** MIDI-only, with a 0.01 Hz floor per p.61.
- **How the CONTROLLERS amounts combine** (wheel × base). The init behaviour is verified; the formula is a **guess**.
- **Arp unsynced step length**: whether it comes from CLOCK DIV relative to RATE. **likely**.
- **Waveshape waypoint positions on the WAVE knob:** the evenly spaced positions are a **guess**.
- **The Amp EG NRPN block:** not in the manual.
- **The sound differences between the Sub 37 and the Subsequent 37** (headroom, Multidrive voicing): S6 only.
