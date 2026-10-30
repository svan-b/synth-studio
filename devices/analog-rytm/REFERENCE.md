# Analog Rytm MKII: reference for the twin

This file lists what the twin is built from, element by element. The primary
source is the **Elektron Analog Rytm MKII User Manual for OS 1.72** (last
updated 30 January 2025), cited as "(Rytm MKII manual, p.N)". Every row with
such a cite was checked against that page. The longer notes behind this file
are in `docs/research/analog-rytm/` (`sources.md`, `signal-flow.md`,
`presets.md`, `lessons.md`).

Where the manual is silent, the twin makes a choice. Those rows say **twin** or
**not in the manual** and describe what the twin does. Facts are in our own
words. No manual text, page renders or diagrams are in the repository.

Secondary sources are used only where the manual is silent:
- libanalogrytm and rytm-rs: machine numbers, sysex slot order and init values.
- rytm-mods measurements: the master section (distortion and compressor curves).

## Chassis and connectors

| Item | Fact | Twin | Source |
|---|---|---|---|
| Size, weight | 385 × 225 × 82 mm including knobs, jacks and feet; about 2.4 kg; aluminium enclosure | `spec.dimensions` 385 × 225 × 82 | (Rytm MKII manual, p.76) |
| Screen | 128 × 64 pixel OLED | Drawn larger for the iPad with the same layout: header, eight parameters, footer | (Rytm MKII manual, p.76) |
| Converters | 48 kHz, 24-bit D/A and A/D | Runs at the browser's rate (44.1 or 48 kHz) | (Rytm MKII manual, p.76) |
| Outputs | MAIN OUT L/R, HEADPHONES and eight individual voice outputs (TRACK OUT) | One stereo output into the studio. The rear legends are drawn | (Rytm MKII manual, pp.12, 76) |
| Inputs | AUDIO IN L/R (sampling or sound card), EXT IN L/R (into the mixer ahead of DIST and COMP), two CV/expression inputs (-5 to +5 V on the tip) | Not modelled (see "Simplified") | (Rytm MKII manual, pp.12-13, 76) |
| MIDI | IN, OUT/SYNC A, THRU/SYNC B. OUT and THRU can send DIN sync | The studio clock stands in for MIDI clock (see "MIDI and the studio") | (Rytm MKII manual, pp.12, 62) |

## Front panel: the 36 numbered elements

The numbering is the manual's (Rytm MKII manual, pp.10-11). "FUNC" means the
key's secondary function, reached with [FUNC] held. Positions are in
`layout.tsx`, in mm from the faceplate's top-left corner, measured from a
front-on photo of a black unit.

| # | Element | Hardware (manual) | Twin | Source |
|---:|---|---|---|---|
| 1 | MAIN VOLUME | Level of the main and headphone outputs; an absolute knob | The same | (Rytm MKII manual, pp.10, 22) |
| 2 | [SAMPLING] | Opens SAMPLING; FUNC starts direct sampling | Sampling is not modelled; the key points to FUNC + [SMPL], where a WAV or AIFF of the learner's can replace a sample slot (see "User samples") | (Rytm MKII manual, pp.10, 56) |
| 3 | [QPER] | With the pads, picks the performance macros the QUICK PERF AMOUNT knob drives; FUNC mutes the macros | The same. A tap latches the selection | (Rytm MKII manual, pp.10, 30-31) |
| 4 | QUICK PERF AMOUNT | Amount of the picked macros; an absolute knob | The same | (Rytm MKII manual, pp.10, 22) |
| 5 | [FIX] | Fixed pad velocity on or off; FUNC opens FIXED VELOCITY (AUTO uses the track's TRIG VEL) | The same | (Rytm MKII manual, pp.10, 43, 45) |
| 6 | TRACK LEVEL | Level of the active track (with the FX track selected, the master return of delay and reverb); also scrolls menus; FUNC opens the SOUND BROWSER. With a note trig held it scrolls the Sound pool for a sound lock | Level and menu values; sets the accent amount in the ACCENT menu. With a note trig held it opens the sound lock list and scrolls it. No sound browser | (Rytm MKII manual, pp.10, 36, 48, 50) |
| 7 | [TEMPO] | TEMPO menu; FUNC taps the tempo | The same | (Rytm MKII manual, pp.10, 38) |
| 8 | [NO] | Exits and steps back. With keys 32-36 it reloads the kit, Sound, track, pattern or song. In LIVE RECORDING, held with pads it erases their trigs, with an encoder that parameter's locks, and FUNC + [NO] the track's locks, on every step reached while held. In STEP RECORDING it places a rest | [NO] + [PLAY MODE] / [MUTE] / [SCNE] reload the kit / the active track's sound / the pattern. Tracks and songs are saved automatically, so there is nothing to reload. [FX] + [NO] reloads the FX track. The LIVE and STEP RECORDING uses are as on the hardware; **twin**: "[NO] + an encoder" is [NO] held while turning it (the twin's encoders can't be pressed). FUNC + [NO] outside LIVE RECORDING reloads the kit, for mouse use | (Rytm MKII manual, pp.10, 40, 47, 51-52, 81) |
| 9 | [YES] | Enters and confirms. With keys 32-36 it saves the kit, Sound, track, pattern or song. Held while placing trigs in STEP RECORDING, it sets their length to the press | [YES] + [PLAY MODE] saves the kit; [YES] + [MUTE] stores the active track's Sound in the Sound pool; [YES] + [SCNE] saves the pattern's restore point; [YES] + pads in STEP RECORDING as on the hardware. **Twin**: FUNC + [YES] opens the KIT menu | (Rytm MKII manual, pp.10, 33, 35, 41, 43, 51) |
| 10 | Screen | Page, values and state | Page title (the machine's name on SRC), BPM and play state, eight parameters, track level, song row, pattern, kit or mode | (Rytm MKII manual, p.10) |
| 11 | [ARROW] keys | Navigation and some values. With a trig held in GRID RECORDING: LEFT / RIGHT micro-time it, UP / DOWN set its retrig. FUNC + LEFT / RIGHT shift the track's trigs. LEFT / RIGHT nudge the tempo by 10 % while held. In STEP RECORDING, LEFT / RIGHT move the active step | The same. In CHRO mode UP / DOWN change the octave; in the SWING menu they change the swing | (Rytm MKII manual, pp.10, 23, 38, 39, 40, 50) |
| 12 | [TRIG] | The TRIG menu, in two pages: the trig settings, and the Euclidean sequencer; FUNC opens TRIGS SETUP | [TRIG] pressed on the TRIG page shows page 2 (and again page 1). FUNC switches live-recording quantize (the TRIGS SETUP setting) | (Rytm MKII manual, pp.10, 40, 43-44) |
| 13 | DATA ENTRY A-H | Relative encoders; pressing while turning moves in bigger steps | Endless encoders bound to the page on screen | (Rytm MKII manual, pp.10, 22) |
| 14 | [PARAMETER] SRC SMPL FLTR AMP LFO | The track's pages; on the FX track: DELAY, REVERB, DISTORTION, COMPRESSOR, LFO. FUNC + SRC opens MACHINE (so does SRC twice); FUNC + SMPL opens the sample list; FUNC + FLTR opens SOUND SETTINGS | The same (MACHINE and SOUND SETTINGS share the twin's SOUND menu) | (Rytm MKII manual, pp.10-11, 21, 74) |
| 15 | [FX] | Selects the FX track; FUNC opens MIDI CONFIG | Selects the FX track. MIDI CONFIG is not modelled | (Rytm MKII manual, p.11) |
| 16 | [SONG MODE] | SONG mode on or off; FUNC edits the song | The same | (Rytm MKII manual, pp.11, 53) |
| 17 | [CHAIN MODE] | CHAIN mode on or off; FUNC starts a new chain | The same | (Rytm MKII manual, pp.11, 53) |
| 18 | [FILL] | FILL while held (outside GRID RECORDING); FUNC cues it; FUNC + a double press latches it | The same | (Rytm MKII manual, pp.11, 49) |
| 19 | PATTERN PAGE LEDs | How many pages the pattern has, which one is shown, and which one is playing | The same. A tap on an LED shows that page | (Rytm MKII manual, pp.11, 38) |
| 20 | [PAGE] | Next pattern page; FUNC opens SCALE | The same | (Rytm MKII manual, pp.11, 46) |
| 21 | [STOP] | Stops and cuts the drum sounds while the delay rings on. Pressed twice while stopped, it also fades the send effects. FUNC pastes | The same | (Rytm MKII manual, pp.11, 37) |
| 22 | [PLAY] | Plays; pressed while playing it pauses and pressed again it resumes. FUNC clears | The same. Synced to the studio, it starts and stops the studio | (Rytm MKII manual, pp.11, 37) |
| 23 | [RECORD] | GRID RECORDING on or off; + [PLAY] gives LIVE RECORDING (+ [PLAY] twice switches its quantize); + [STOP] gives STEP RECORDING (+ [STOP] again: STANDARD or JUMP). It turns purple while the active track is in Euclidean mode. FUNC copies | The same. It blinks in LIVE RECORDING and double-blinks in STEP RECORDING | (Rytm MKII manual, pp.11, 39-40, 44) |
| 24 | [BANK A-H] | Pattern banks. FUNC + A-D set the pattern mode; FUNC + E / F / G / H open TRIG MUTE / ACCENT / SWING / PARAMETER SLIDE. A held trig + E / F / H gives it a trig mute / accent / slide | The same | (Rytm MKII manual, pp.11, 38, 49-51) |
| 25 | PATTERN MODE LEDs | Sequential, Direct Start, Direct Jump, Temp Jump | The same | (Rytm MKII manual, pp.11, 38-39) |
| 26 | [PADS] | Velocity and pressure sensitive; what they do depends on the mode (see "Pads and modes") | The position of a tap stands in for force: higher is harder | (Rytm MKII manual, pp.11, 21) |
| 27 | [TRIG] keys 1-16 | Trigs, lock trigs, pattern choice with [BANK]; they also play tracks 1-12 | The same | (Rytm MKII manual, pp.11, 21, 39) |
| 28 | [RTRG] | Hold it with a pad for a roll; its menu shows while held. In MUTE mode, + a pad solos. FUNC opens CLICK TRACK | Roll and solo as on the hardware; a tap latches the roll. There is no click track | (Rytm MKII manual, pp.11, 23, 41) |
| 29 | [TRK] | [TRK] + a pad selects the track; a double press opens the SOUND BROWSER; FUNC saves the kit | Select and save as on the hardware. A tap latches the selection for the next pad or trig key 1-13. A double press opens the twin's SOUND menu | (Rytm MKII manual, pp.11, 31) |
| 30 | [FUNC] | Hold for secondary functions | The same. **Twin**: a single tap latches it for the next key | (Rytm MKII manual, p.11) |
| 31 | [GLOBAL SETTINGS] | Opens GLOBAL SETTINGS; FUNC saves the project | Not modelled. The project saves automatically | (Rytm MKII manual, p.11) |
| 32 | [PLAY MODE] | PLAY mode; FUNC opens the KIT menu | The same | (Rytm MKII manual, pp.11, 23, 26) |
| 33 | [MUTE] | MUTE mode; FUNC opens the SOUND menu | The same | (Rytm MKII manual, pp.11, 23) |
| 34 | [CHRO] | CHROMATIC mode; FUNC opens the TRACK menu (pad scale, track save and reload) | CHROMATIC as on the hardware. FUNC opens the pattern's SCALE page | (Rytm MKII manual, pp.11, 23, 42) |
| 35 | [SCNE] | SCENE mode; FUNC opens the PATTERN menu (save and reload) | The same: the twin's pattern picker has SAVE and RELOAD. Hold [SCNE] to edit a scene | (Rytm MKII manual, pp.11, 23, 28, 42) |
| 36 | [PERF] | PERFORMANCE mode; FUNC opens the SONG menu | The same: the song editor. Hold [PERF] to edit a macro | (Rytm MKII manual, pp.11, 23, 29) |

Key groups (Rytm MKII manual, p.22):
- The track keys ([TRK] + pad, and [FX]) work as one radio group.
- The [TRIG] key and the five [PARAMETER] keys are another.
- The five mode keys can all be off, but only one can be on at a time.

The twin follows all three.

## Sound architecture

| Item | Fact | Twin | Source |
|---|---|---|---|
| Voices and effects | Eight drum voices; two send effects (delay, reverb); two master effects (distortion, compressor) | One worklet node for the voices and the delay, one for the master section | (Rytm MKII manual, p.13) |
| Voice chain | Sound generator, noise and sample playback, then overdrive, the multimode filter with its envelope, the amp with its envelope, pan, and the delay and reverb sends | The same order (`renderVoice` in `analog-rytm-processors.js`) | (Rytm MKII manual, pp.13, 79) |
| Master | Voices and EXT IN meet in the mixer, then DISTORTION, then COMPRESSOR. DIST page DEL and REV set whether each return enters before or after them | The same, per kit. Delay defaults to PRE, reverb to POST | (Rytm MKII manual, pp.13, 82) |
| FX track level | TRACK LEVEL on the FX track sets the master return level of the delay and the reverb | `fx_trk_lev` scales both returns | (Rytm MKII manual, p.36) |

## Tracks, voices and machines

| Item | Fact | Twin | Source |
|---|---|---|---|
| Tracks | 12 drum tracks (BD SD RS CP BT LT MT HT CH OH CY CB) plus the FX track | 13 sequencer tracks | (Rytm MKII manual, pp.21, 37) |
| Shared voices | RS/CP, MT/HT, CH/OH and CY/CB share a voice. When both tracks of a pair play, the right-hand track (CP, HT, OH, CB) has priority and mutes the other | Both on the same step: the right-hand track plays. Otherwise the later trig takes the voice, and the old sound's output fades over about 1.3 ms. The pads mark the pairs with "\|\|" | (Rytm MKII manual, p.21) |
| Machine menus | BD: the BD, SY and SD machines. SD: SD, SY, BD. RS: RS, SY, BD, SD, CP. CP: CP, SY, BD, SD, RS. BT: BT CLASSIC. LT, MT, HT: XT CLASSIC. CH, OH: the CH, OH, HH BASIC and HH LAB machines. CY, CB: the CY and CB machines. UT NOISE and UT IMPULSE on every track | `TRACKS[].machines` in `model.ts`; DISABLE (no synth part, sample only) is also in every menu | (Rytm MKII manual, pp.21, 96) |
| Choosing a machine | [SRC] twice or FUNC + [SRC] opens MACHINE. A machine engages the voice's sound generator in its own way | The SOUND menu sets the machine, which loads its default parameter values | (Rytm MKII manual, pp.21-22, 34) |
| SRC layouts | Each machine's eight parameters on encoders A-H, with LEV on H | `MACHINES[].knobs`; the storage (MIDI) order is kept separately in `slots` | (Rytm MKII manual, pp.96-109) |
| BD HARD | One tunable oscillator with three waveforms; SWT sets the sweep time, SNP an instant pitch sweep at the attack, HLD the hold, TIC the transient tick | The same. BD HARD has no SWD | (Rytm MKII manual, pp.22, 77, 97) |
| Hat COL | CH and OH CLASSIC COL is "Noise Color", the hardness of the metal | Moves the metal path's band-pass and high-pass corners | (Rytm MKII manual, pp.106-107) |

## PARAMETER pages

| Page | A-H | Notes | Source |
|---|---|---|---|
| TRIG | NOT VEL LEN PRB / SYN SMP ENV LFO | With nothing held these are the track's trig defaults, stored in the pattern. With a trig held, they lock that trig and D becomes **TRC**, its trig condition, which overrides PRB. SYN and SMP both off make a lock trig | (Rytm MKII manual, pp.43-44, 48) |
| TRIG page 2 | PL1 PL2 LEN EUC / RO1 RO2 TRO OP | The Euclidean sequencer of the active drum track ([TRIG] again on the TRIG page), stored in the pattern; see "Sequencer". The screen adds a map of generator 1, generator 2 and the trigs they place | (Rytm MKII manual, p.44) |
| SRC | per machine | See above | (Rytm MKII manual, pp.96-109) |
| SMPL | TUN FIN BR SMP / STA END LOP LEV | END below STA plays backwards. LOP loops for the trig's length. The twin ships synthesized one-shots in place of samples, and the second SMPL page (a waveform view) is not drawn | (Rytm MKII manual, pp.77-78) |
| FLTR | ATK DEC SUS REL / FRQ RES TYP ENV | Seven types (LP2 LP1 BP HP1 HP2 BS PK). The twin builds them all from one resonant 2-pole filter; the 1-pole types have a gentler slope | (Rytm MKII manual, p.78) |
| AMP | ATK HLD DEC OVR / DEL REV PAN VOL | HLD AUTO (0) holds while the pad is pressed; 1-127 are fixed holds. OVR drives the sound before the filter. **Twin**: on the sequencer HLD AUTO holds for the trig's length, and DEC 127 never decays | (Rytm MKII manual, p.79) |
| LFO | SPD MUL FAD DST / WAV SPH MOD DEP | Seven waves (TRI SIN SQR SAW EXP RMP RND) and five trig modes (FREE TRG HLD ONE HLF). MUL "x" values follow the tempo; "." values run at 120 BPM whatever the tempo. **Twin**: SPH adds slew on RND | (Rytm MKII manual, pp.79-80) |

Each control has its own id:
- `<track>_<key>` for the drum tracks (`bd_dec`, `cp_flt_typ`, `oh_amp_dec`).
- `fx_<key>` for the FX track (`fx_del_fdb`, `fx_cmp_mix`).
- `<track>_trk_lev`, `_acc_lev` and `_vel_vol` for track level, accent level and velocity to volume.
- `<track>_trig_cond` for the TRC lock, which exists only as a lock.
- `euc_pl1`, `euc_pl2`, `euc_len`, `euc_on`, `euc_ro1`, `euc_ro2`, `euc_tro` and `euc_op` for TRIG page 2. They edit the active track's settings in the pattern and are never stored themselves (they are in `uiControls`).

## FX track

| Page | A-H | Notes | Source |
|---|---|---|---|
| DELAY | TIM X WID FDB / HPF LPF REV VOL | TIM counts 128th notes of the tempo (32 = one beat). X is ping-pong. FDB above 127 builds up; DOV saturates the loop | (Rytm MKII manual, p.81) |
| REVERB | PRE DEC FRQ GAI / HPF LPF – VOL | **Twin**: a shared Reverb2 (FDN) node where DEC sets the decay from 0.25 to 14 s and GAI 127 keeps the treble | (Rytm MKII manual, pp.81-82) |
| DISTORTION | AMT SYM DOV – / – – DEL REV | SYM offsets the wave before the clipping. DEL and REV return the delay and reverb PRE or POST | (Rytm MKII manual, p.82) |
| COMPRESSOR | THR ATK REL MUP / RAT SEQ MIX VOL | ATK 0.03-30 ms. REL 0.1-2 s, A1, A2. RAT 1:2, 1:4, 1:8, MAX, where higher compresses harder. SEQ OFF, LPF, HPF, HIT. MIX 0 is dry, 127 all compressed | (Rytm MKII manual, pp.82-83) |
| LFO | SPD MUL FAD DST / WAV SPH MOD DEP | The FX LFO, aimed at any delay, reverb, distortion or compressor parameter | (Rytm MKII manual, p.83) |

## Pads and modes

| Mode | What the pads do | Source |
|---|---|---|
| PLAY | A tap plays the track; [TRK] + pad selects it. **Twin**: AUTO TRK SWITCH (off by default) makes a tap select too | (Rytm MKII manual, pp.21, 23, 67) |
| MUTE | A pad mutes or unmutes its track's sequencer. [FUNC] held + pads preselects mutes that apply when [FUNC] is released. [RTRG] + pads solo. These master mutes stay when the pattern or kit changes, are not stored in kit or pattern, and override trig mutes and song mutes. The twin keeps them in `Project.mutes` | (Rytm MKII manual, p.23) |
| CHRO | Play the active track chromatically over four octaves (the middle one, one up, two down), the pitch rising left to right, bottom to top; UP / DOWN move the octave; the pad colours show it. Pitches played in LIVE RECORDING (and in STEP RECORDING) are recorded as the trigs' NOT. **Twin**: the computer keyboard (A-K, Z / X for the octave) plays the active track chromatically too, through the same mapping as MIDI notes (below) | (Rytm MKII manual, pp.19, 23, 40, 43) |
| SCNE | Scenes on and off; hold [SCNE] (or FUNC + pad) to edit one by turning encoders | (Rytm MKII manual, pp.23, 28-29) |
| PERF | Performance macros follow pad pressure (in the twin, how high the finger is on the pad); hold [PERF] to edit one, where each turn is a depth away from the kit's value | (Rytm MKII manual, pp.23, 29-30) |
| [FIX] | Every hit at one velocity; AUTO uses the track's TRIG VEL | (Rytm MKII manual, pp.43, 45) |
| [RTRG] | Hold + pad: a roll at the track's RETRIG rate, length and velocity curve; pressure sets the velocity; ALWAYS ON rolls without [RTRG] | (Rytm MKII manual, p.41) |

## Sequencer

The twin uses the Elektron sequencer library (`lib/sequencer/elektron`, see
`docs/ELEKTRON_SEQUENCER.md`) with the Rytm's settings.

| Item | Fact | Source |
|---|---|---|
| Patterns | 8 banks × 16 patterns. A pattern holds trig settings, trigs, lock trigs, parameter locks, trig mutes, accents, slides, swing trigs and swing amount, the linked kit, and the lengths and scale. Up to 64 steps in pages of 16 | (Rytm MKII manual, pp.37, 46) |
| Transport | PLAY plays; PLAY while playing pauses; STOP stops and cuts the drum sounds; STOP twice also fades the send effects | (Rytm MKII manual, p.37) |
| Pattern modes | SEQUENTIAL (at the end; the default), DIRECT START, DIRECT JUMP, TEMP JUMP (one jump, then back) | (Rytm MKII manual, pp.38-39) |
| Trig types | Note trigs (red) and lock trigs (yellow) | (Rytm MKII manual, p.39) |
| GRID RECORDING | [RECORD]; trig keys place trigs; with a trig held, LEFT / RIGHT micro-time it and UP / DOWN set its retrig; FUNC + LEFT / RIGHT shift the track | (Rytm MKII manual, p.39) |
| LIVE RECORDING | [RECORD] + [PLAY]; [RECORD] + [PLAY] twice switches quantize (also the TRIGS SETUP / SEQUENCER CONFIG setting). Pad hits become note trigs with their velocity, their length (how long the pad is held) and, in CHROMATIC mode, their pitch; they keep their micro timing unless quantized; with [RTRG] held the roll is recorded as a retrig. A turn of a PARAMETER page encoder becomes a parameter lock on the active track: note trigs are locked, empty steps get lock trigs. [NO] + pads, [NO] + an encoder and [FUNC] + [NO] erase trigs, that parameter's locks or every lock on the steps reached while held; sound locks stay. [PLAY] leaves it and keeps playing; [STOP] ends both. **Twin**: the turn is also an ordinary edit (the kit value follows the knob, so you hear it at once); a turn lands on the step nearest to it, as a hit does; and turns of one encoder less than three steps apart also lock the steps in between to the value that played there, so a slow sweep records without gaps | (Rytm MKII manual, pp.40-41, 43, 47, 67) |
| STEP RECORDING | [RECORD] + [STOP]; a trig key picks the active step (green, double-blinking), LEFT / RIGHT move it. Pads place trigs on it (several pads: one step), then it moves on: one step (STANDARD), or the track's LEN (JUMP, [STOP] again with [RECORD] held; LEN is then locked on each trig). CHROMATIC pads place pitched trigs on the active track. [NO] removes the active track's trig there (a rest) and moves on. A trig held and an encoder turned locks it. [YES] held while placing: the trig's LEN is the press. A trig placed over one keeps its locks. [RECORD] leaves it. **Twin**: the active step moves on when the last pad is let go; MIDI notes and the computer keyboard place trigs as the pads do | (Rytm MKII manual, pp.40-41) |
| Parameter locks | Hold trigs and turn encoders. At most 72 different parameters per pattern (`LOCK_LIMIT_RYTM`; one more is refused). The trig editor shows the budget | (Rytm MKII manual, p.47) |
| Sound locks | Hold a note trig and turn TRACK LEVEL: the Sound pool list appears; the chosen Sound plays on that trig, TRACK SOUND (the first entry) is the kit's own; Sounds the track can't run and empty slots are marked (!). Holding a sound-locked trig shows its Sound. **Twin**: the list follows TRACK LEVEL or a tap on an entry, and the choice is written at once. It is kept as the trig's `sound` lock (pool slot 1-128), so it counts as one locked parameter of the track. The engine plays the whole pool Sound as locks, with the trig's own locks on top, and its machine for that trig; lock trigs after it lock that Sound too. The trig editor lists it as SOUND | (Rytm MKII manual, pp.26, 48) |
| Euclidean sequencer | TRIG page 2: PL1 and PL2 pulse generators spread their trigs as evenly as possible; RO1 / RO2 rotate each, TRO both; OP combines them (OR, XOR, AND, SUB); LEN is the track length (ADVANCED scale only); EUC turns it on, and [RECORD] turns purple. The track's own trigs are hidden while it is on and come back when it goes off; [FUNC] + EUC off keeps the generated trigs instead. Trigs can't be added by hand, but the generated ones take locks. **Twin**: settings per track in the pattern (`track.euc`); the generators use Bjorklund's algorithm with the first pulse on step 1; RO / TRO run from -63 to +63 within the track length; a generated trig on a step that holds one of the track's own note trigs plays that trig (our reading of "these trigs will be distributed according to the settings"); generated trigs that were edited stay when EUC goes off normally. The screen draws both generators and the result | (Rytm MKII manual, p.44) |
| Trig conditions | TRC on the TRIG page while a trig is held: probability, FILL, PRE, NEI, 1ST, their negations, and A:B | (Rytm MKII manual, p.48) |
| FILL | Hold it, cue one cycle, or latch it | (Rytm MKII manual, p.49) |
| TRIG MUTE | FUNC + [BANK E]: trig keys mute and unmute the active track's trigs | (Rytm MKII manual, p.49) |
| ACCENT | FUNC + [BANK F]: trig keys set accents; TRACK LEVEL sets the amount | (Rytm MKII manual, pp.49-50) |
| SWING | FUNC + [BANK G]: trig keys choose the swing trigs (every second step by default); TRACK LEVEL or UP / DOWN set 51-80 % (50 % is straight) | (Rytm MKII manual, p.50) |
| PARAMETER SLIDE | FUNC + [BANK H]: a locked value slides to the next trig's value | (Rytm MKII manual, pp.50-51) |
| Retrigs | Per trig: rate 1/1-1/80 (1/16 = one per step), length, velocity curve | (Rytm MKII manual, pp.39, 41) |
| SAVE / RELOAD PATTERN | [YES] / [NO] + [SCNE]: save the restore point, or go back to it | (Rytm MKII manual, pp.43, 51-52) |
| Chains | Patterns played in sequence and looped | (Rytm MKII manual, p.53) |
| Songs | Rows of a pattern or chain × repeats, with song mutes per pattern position. A song plays to its end and stops. On the hardware a double STOP moves the song back to its start; in the twin every STOP does | (Rytm MKII manual, pp.53-55) |
| Tempo | Project tempo, tap tempo, and a 10 % nudge while LEFT / RIGHT are held | (Rytm MKII manual, p.38) |

## Kits, scenes and performance macros

| Item | Fact | Twin | Source |
|---|---|---|---|
| Kit | 12 track sounds and the FX track, the track levels, retrig settings, sound settings, scenes and performance macros. Every pattern links a kit | `RytmProject.kits` and `pattern.kit`. The engine switches kits at the pattern's audio time | (Rytm MKII manual, p.26) |
| Scenes | 12 per kit, with 48 locked parameters in all | `kits[id].scenes`, with the 48-lock limit | (Rytm MKII manual, pp.28-29) |
| Performance macros | 12 per kit, with 48 locked parameters in all. A lock is a depth that grows with pad pressure | `kits[id].perfs`. QUICK PERF AMOUNT drives the macros picked with [QPER] | (Rytm MKII manual, pp.29-31) |
| SOUND SETTINGS | MACHINE, CHROMATIC, ENV RESET, VELOCITY TO VOL, velocity and aftertouch modulation, LEGACY FX SEND | MACHINE and VELOCITY TO VOL can be edited. The rest are fixed: CHROMATIC = SYN+SMP, ENV RESET = FILTER, aftertouch = +16 on filter frequency | (Rytm MKII manual, pp.33-34) |
| Sound pool | A project holds up to 128 Sounds in its pool. A Sound is a drum track's PARAMETER page settings (with its machine). Sounds are stored from a track ([YES] + [MUTE], STORE TRACK SOUND), loaded to a track, renamed and deleted in the SOUND MANAGER; only pool Sounds can be sound locked | `RytmProject.pool`. The twin's SOUND menu (FUNC + [MUTE], or [TRK] twice) has STORE TRACK SOUND (to the first free slot), the pool list (a tap previews a Sound on the active track; (!) marks the ones it can't run), LOAD TO TRACK, RENAME and DELETE. A Sound keeps its machine, its SRC parameters and the SMPL, FLTR, AMP and LFO pages; track level, retrig and the TRIG page stay in the kit and the pattern. There is no +Drive Sound library | (Rytm MKII manual, pp.24, 26, 31-33, 35) |
| User samples | The project's sample slots hold samples from the +Drive; a slot can be replaced, and SMP on the SMPL page picks a Sound's slot | FUNC + [SMPL] lists the 32 slots; LOAD YOUR OWN SAMPLE loads a WAV or AIFF (from the iPad's Files app too) into the active track's slot in place of its built-in one-shot. See "User samples" below | (Rytm MKII manual, pp.35-36, 58-59) |

## MIDI and the studio

| Item | Fact | Twin | Source |
|---|---|---|---|
| Clock | CLOCK RECEIVE and TRANSPORT RECEIVE make the Rytm follow external MIDI clock, start and stop | "Sync to studio clock" is on by default: the sequencer follows the studio transport, and PLAY starts or stops the studio | (Rytm MKII manual, p.61) |
| DIN sync | The OUT and THRU ports can send DIN 24 or DIN 48 instead of MIDI | Not modelled | (Rytm MKII manual, p.62) |
| MIDI notes | Notes 0-11 play tracks 1-12; notes 12-59 play the active track in its 48 chromatic variations, lowest to highest, as the CHROMATIC pads do | The studio delivers MIDI notes to the focused instrument (`lib/midi`, unchanged): notes 0-11 play the tracks, 12-59 the active track (36 = the sound's own pitch, the pads' middle octave), others are ignored. A track plays one note at a time; only its latest note ends the gate. They are recorded in LIVE and STEP RECORDING like the pads. Channels, CCs and NRPN are not modelled | (Rytm MKII manual, pp.22, 41, 85) |
| Arranger | Not on the hardware | `studio.patterns` lists the patterns that hold trigs, for the studio arranger | not in the manual |
| TRACK OUTs | Eight mono outputs, one per drum voice (BD, SD, RS/CP, BT, LT, MT/HT, CH/OH, CY/CB), which always carry their voice. ROUTE TO MAIN picks which tracks also reach the main output and its master effects; SEND TO FX is separate | The studio's separate outputs (`studio.outputs`, the mixer strip's **Outs** menu). A voice on its own output plays there, mono after its level and before its pan, and leaves the main mix and the master distortion and compressor, like a TRACK OUT cable with ROUTE TO MAIN off. Its delay and reverb sends stay. Its channel starts at the Rytm's fader and route. With no output on, the main output is bit-identical to before (21 of 21 null-test renders) | (Rytm MKII manual, p.12 rear panel; pp.27, 65 track routing) |

## Output level: how the kits were calibrated

The studio expects every instrument at about **-18 LUFS** at its own output,
with true peaks under **-1 dBTP** (`docs/AUDIO_QA.md`). Before calibration
most kits sat near -28 LUFS. The compressor's cleared defaults (MIX 0, VOL 64)
leave the output 6.4 dB under the mix, and makeup gain alone pushed true peaks
over 0 dBTP.

Each kit's master section (`presets.ts`) is now set like this. Kit 01's master
section is the FX defaults (`KIT01_MASTER` in `model.ts`).

- **DIST AMT** drives the mix into the master clipper. The clipper is an
  order-12 soft clipper at about 0.68 / 0.72 of full scale, and it is there even
  at AMT 0. It holds the peaks. Dub Chords, Deep Garage and Jungle Roller keep
  their drive at 18: there, bright hats ride on a big kick, and deeper clipping
  notches them on the kick's flattened crest, which crackles. For the same
  reason Warehouse (20), Big Beat (12) and Lo-Fi (20) were turned down once the
  closed hats got louder: dense downbeats drove them three to four times past
  the knee, where the output flattens into a plateau right after a fast rise.
  The audio-QA click detector flagged that now and then; it sounds like crunch,
  but it is an artefact of driving the whole mix that far.
- **COMP** keeps each kit's character (threshold, attack, release, ratio, SEQ).
  MIX is parallel compression, with MUP matched to the wet path's fixed loss
  plus the average gain reduction.
- **VOL** puts the kit at the target where its crest factor allows, with the
  worst true peak of 12 random states (offline, at the studio's 120 BPM) at or
  under -1.5 dBTP. Kits with parallel compression and delays returned POST have
  the most crest; Warehouse, Industrial Grind, Deep Garage, Dub Chords, Jungle
  Roller, Big Beat, Micro Clicks, Glitch Lab and Lo-Fi sit about 2-3 LU under
  the target.
- Echo kits return the delay **POST** (DIST page DEL), so the drive doesn't
  lift their tails. Their feedback and reverb decay are set so the tails fall
  below -60 dBFS within 2 s of stop.
- Three quiet kits (Dub Chords, Micro Clicks, Brush Jazz) have their track
  levels raised.

The calibration was measured offline through the real worklet code at 44.1 kHz
with the QA tool's own meters. It was then checked in the browser with
`scripts/audio-qa.cjs … analog-rytm --target -18`; the results are below.

The cleared hardware kit has DIST AMT 0 and COMP THR 96, MIX 0, VOL 64 (rytm-rs
init values). The twin's kit 01 is a designed kit that plays the demo song, so
its master section is calibrated instead.

### Measured loudness (audio QA, `--target -18`)

Two runs at 44.1 kHz on the instrument output: `audition` plays each kit's demo pattern through the module's own audition, and `transport` plays it from the studio transport (`--excite analog-rytm=transport`). Both play the kits synced to the studio's 120 BPM. Neither run has a click, DC or tail flag. Audition: median -18.9 LUFS, spread 3.1 LU, worst true peak -1.7 dBTP, 0 of 20 flagged. Transport: median -19.0 LUFS, spread 3.4 LU, worst true peak -1.7 dBTP, 0 of 20 flagged.

The true peaks were also checked offline over 12 random states per kit (the browser starts each kit from whatever state the kits before it left: hat oscillator phases, noise, the sample buffers), because single takes vary by up to 1.5 dB. Every kit's worst case is at or under -1.5 dBTP there. Bright hats raise the risk: around 9-12 kHz a true peak can sit 2.4-3.6 dB above the samples at 44.1 kHz.

| Kit | Audition LUFS | Audition dBTP | Transport LUFS | Transport dBTP |
|---|---:|---:|---:|---:|
| Techno / Warehouse | -20.3 | -1.7 | -20.4 | -1.7 |
| Techno / Industrial Grind | -20.9 | -3.5 | -21.0 | -4.3 |
| Techno / Dub Chords | -20.2 | -2.1 | -20.4 | -1.7 |
| House / Deep Garage | -20.5 | -2.3 | -20.6 | -1.7 |
| House / Nine-O-Nine Box | -18.8 | -2.5 | -18.8 | -2.4 |
| Electro / Miami Bass | -17.9 | -3.3 | -18.1 | -4.0 |
| Electro / Robot Funk | -18.3 | -2.6 | -18.5 | -2.8 |
| Drum Machine / Straight Boom | -17.7 | -1.9 | -17.9 | -1.9 |
| Hip-Hop / Dusty Boom Bap | -18.5 | -2.0 | -18.7 | -1.9 |
| Hip-Hop / Trap Sub | -17.8 | -3.1 | -18.0 | -3.8 |
| Breaks / Jungle Roller | -20.7 | -3.8 | -21.3 | -2.4 |
| Breaks / Big Beat | -20.2 | -2.0 | -20.1 | -2.2 |
| Minimal / Micro Clicks | -20.5 | -2.2 | -20.7 | -2.0 |
| IDM / Glitch Lab | -20.0 | -2.5 | -20.0 | -2.9 |
| Dub / Echo Chamber | -18.2 | -1.9 | -18.5 | -2.0 |
| Acoustic / Studio Kit | -18.3 | -3.8 | -18.3 | -3.7 |
| Acoustic / Brush Jazz | -18.0 | -3.0 | -18.3 | -2.8 |
| Lo-Fi / Bitcrushed Tape | -19.8 | -1.9 | -20.1 | -1.9 |
| Percussion / Afro-Latin | -18.1 | -4.1 | -18.5 | -3.8 |
| Synth / Analog Toys | -19.0 | -3.9 | -19.1 | -2.8 |

## Model choices (not in the manual)

| Item | What the twin does |
|---|---|
| Machine DSP | Each machine is modelled on the firmware's machine functions (rytm-mods): the two-oscillator circuit on BD, SD, RS and CP; the tuned resonator on the toms; the six-square hat bank (TR-808 ratios); and the cymbal and cowbell bank. Where no source gives absolute curves (Hz, ms), they are tuned by ear |
| Hat metal | The six squares feed a ringing band-pass (Q about 3.3) and a high-pass, so their edges blend into a sizzle rather than single-sample spikes |
| Hat levels | An output trim per hat machine: CH CLASSIC and HH BASIC +7 dB, CH METALLIC +5 dB, the others 0 dB. Without it the closed machines' init hits sat 10-17 LU under every other voice (momentary loudness -41.8 LUFS for CH CLASSIC against -24 to -30 for the kicks, snares and toms), so closed hats vanished in a groove. Each hat machine's init hit is now within about 3 LU of the others on the voice |
| Digital clicks | TIC, TRA and the snare and rim ticks use one smooth 0.5 ms tick (CLICK) and a 0.35 ms push (BUMP). Both are defined in time, so they sound the same at 44.1 and 48 kHz |
| Attack | AMP ATK 0 is a 0.4 ms linear ramp |
| Retrigger | A trig on a sounding voice crossfades: the old sound's offset fades out over 1.3 ms and the new sound fades in over 0.3 ms (raised cosines), at both the filter input and the voice output. The amp carries on from its current level. The input side keeps the filter from ringing on the step between the two sounds |
| STOP | Every voice fades out over about 5 ms; the delay and reverb ring on |
| Output | The main outputs' maximum level is +15 dBu (Rytm MKII manual, p.76), taken as full scale: an order-12 soft saturation there (unchanged below -6 dBFS), then AC coupling (a 5 Hz high-pass), so asymmetric kicks leave no DC. With every level, the makeup and the delay feedback at maximum the output stays near 0 dBFS instead of reaching +31 dBFS |
| Filter | A Simper state-variable filter. FRQ moves one semitone per step, with 440 Hz at 60. A moving cutoff glides sample by sample |
| Compressor | The rytm-mods calibrated model: a SEQ-filtered peak detector, a softplus curve per RAT, and ballistics from ATK and REL. Makeup is about 0.6 dB per step up to 48, and VOL follows a measured table. The output gain is smoothed by two one-pole stages |
| Reverb | The studio's Reverb2 (FDN), not the Rytm's algorithm |
| Samples | 32 synthesized one-shots (kick, snare, hats, percussion, noise) stand in for the +Drive sample library. Without a loop, the last 3 ms before the end point fade out (a raised cosine): most one-shots are still ringing when their buffer ends (KICK 909 at -20 dB re its peak, CRASH at -36 dB), and an END set inside a sample stops it mid-wave, so both used to click |
| Trig LEN with AMP HLD AUTO | The amp holds for the trig's length. The manual describes AUTO only for pads |
| Live recording, steps | A hit lands on the step nearest to it with its micro timing (none when quantized). An encoder turn lands on the nearest step too; turns of one encoder less than three steps apart lock the steps in between to the value that played there; the turn also edits the kit value, as any turn does. The panel reports each turn to the engine (`ui.liveTurn`), which knows where the sequencer is; the timing allows for the half-render it takes to get there |
| Sound lock storage | The trig's `sound` lock (1-128). A lock trig that holds only a sound lock (what [NO] + pads leave behind in LIVE RECORDING) plays nothing; a hit recorded on it later gets the Sound back |
| Euclidean view | Everything that plays or shows trigs (the sequencer, the trig keys, the trig editor, live recording, the arranger) reads a view of the project in which a Euclidean track's steps are its generated trigs. Lock edits made there are kept in the track's `euc.steps`; trigs added or removed there are refused with a message |

## User samples

A small design, after the hardware's replaceable sample slots (Rytm MKII manual, pp.35-36, 58-59):

| Item | What the twin does |
|---|---|
| Slots | The 32 slots of the SMPL page's SMP keep their built-in one-shots; any slot can hold a sample of the learner's instead, for this project (`RytmProject.samples`: slot -> `{ id, name }`). Nothing changes for SMP's range or the kits |
| Loading | FUNC + [SMPL]: pick the active track's slot, then LOAD YOUR OWN SAMPLE opens the file picker (an `<input type=file>`, so the iPad's Files app works). WAV (PCM 8-32-bit, float) and AIFF / AIFF-C (PCM, `sowt`, `fl32`, `fl64`) are read by our own code; other files go to the browser's decoder. Mixed to mono and cut at 33 s, the hardware's longest sampling time (Rytm MKII manual, p.56) |
| Storage | The audio goes into IndexedDB (database `synth-studio-rytm-samples`), keyed by a hash of the audio, so a file loaded twice is stored once; saved projects only keep the reference |
| Playback | The engine reads a slot's sample from IndexedDB, resamples it to the audio context's rate (the browser's resampler) and normalizes it to the built-in one-shots' peak (0.8) so it sits in the kits' calibrated mix, then sends it to the worklet (`{ t: 'smp' }`). The sample layer plays it like any one-shot: tune, start, end, loop, the 3 ms end fade |
| Missing samples | A project that names a sample this browser doesn't have (another device, cleared site data) plays that slot's built-in one-shot. The screen says which sample is missing and where to load it again; the SAMPLES menu marks the slot with "!" |
| BUILT-IN AGAIN | Puts the slot's one-shot back; the stored audio stays in IndexedDB |

## Simplified or not modelled

- Sampling ([SAMPLING], AUDIO IN), the +Drive sample library and its
  directories. The sample layer plays synthesized one-shots, or the learner's
  own files (see "User samples").
- EXT IN, the CV/expression inputs and the individual voice outputs.
- GLOBAL SETTINGS and projects: there is one project per instance, saved
  automatically.
- The +Drive Sound library, the SOUND BROWSER's sorting and tags, and the kit
  browser. The Sound pool and sound locks are modelled; the KIT menu links,
  saves and reloads kits.
- MIDI: channels, CCs, NRPN, program changes, DIN sync and MIDI CONFIG. The
  studio clock stands in for MIDI clock. Notes play the tracks (see "MIDI and
  the studio").
- SOUND SETTINGS: CHROMATIC, ENV RESET, the velocity and aftertouch modulation
  slots, and LEGACY FX SEND are fixed (see the table above).
- PAGE PLAYBACK (hold [PAGE]); it is not in the sequencer library yet
  (`docs/ELEKTRON_SEQUENCER.md` §8).
- In LIVE RECORDING: pad pressure recorded as lock trigs, and the CLICK TRACK
  PREROLL. In STEP RECORDING: [TRIG] + [YES] previews and the fixed-velocity
  [FUNC] for MIDI notes.
- The CLICK TRACK (metronome), pad scales and the rest of the TRACK menu.
- PATTERN tempo mode (a tempo per pattern, FUNC + [YES] in the TEMPO menu).
- Editing a step property on all tracks at once (FUNC held in the TRIG MUTE,
  ACCENT, SWING and PARAMETER SLIDE menus).
- A trig mute, accent or slide can sit only on a step that holds a trig.
- Songs and chains: one song and one chain per project (the hardware has 16
  song slots and 64 chains), no scratch pad row, and STOP always returns the
  song to its first row.

## Presets

There are twenty kits. Each has a demo pattern in the default project, in
B01-B16 and C01-C04. The demo song is in bank A and plays kit 01, with kit 02 for the drop.

The kits are our own sound design in familiar styles; Elektron's factory kits
and sound packs are not shipped. Names are descriptive ("Techno / Warehouse",
"Drum Machine / Straight Boom"), and each description names the style it
recreates.
