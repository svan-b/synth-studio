# The Producer path

A design document for a new Synth Studio curriculum: from a first beat to a mastered,
bounced track. It is written for the people who will implement it once the instrument
rebuilds have merged. Nothing here is code yet. Instruments are described in hardware
terms ("A4 track 2, FILTER 2 TYPE HP2"), not control ids, because the ids are changing.

It follows `docs/PEDAGOGY.md`. The companion file `demo-tracks.md` specifies three
finished demo tracks. Demo 1, "Low Tide Lights", is the worked example for this path:
the learner builds a simpler track of their own with the same tools, and the lesson
hooks play short excerpts of the finished demo.

---

## 1. Who it is for, and what they leave with

- **Absolute beginners** who have never programmed a beat. Every term is defined the
  first time it appears, every early step has an exact target, and the first sound
  arrives within a minute.
- **Intermediate producers** who know a DAW but not hardware-style production: the
  path stays quick for them (a two-minute placement check lets them skip ahead) and
  each lesson ends with an open challenge and a "Go further" note.

By the end, the learner has their own two-minute track, a WAV master at a streaming
loudness, a set of stems, and the habits behind them: groove first, low end locked,
one idea per part, space by design, arrangement in phrases, and a mix judged by ear
and meter.

## 2. The path at a glance

| # | Lesson | Main instruments | Studio skill | Min | Needs |
|---|---|---|---|---|---|
| 1 | First beat | Analog Rytm | the grid, beats and steps | 10 | — |
| 2 | Groove | Analog Rytm | swing, ghost notes, velocity, micro timing | 14 | 1 |
| 3 | Bass locked to the kick | Analog Four T1, Rytm | kick and bass in time and in key | 15 | 2 |
| 4 | One clock for the whole studio | Studio Clock, DFAM, both Elektrons | MIDI-style sync and clock pulses | 15 | 3 |
| 5 | Chords and pads | Analog Four T2–T3 | minor-seventh chords, progression, stab vs pad | 18 | 3 |
| 6 | A hook | Analog Four T4 (Sub 37 optional) | pentatonic hook, register, call and response | 18 | 5 |
| 7 | Frequency slots | Xone:96 EQ, A4 and Rytm filters | masking, high-pass, kick vs bass | 16 | 6 |
| 8 | Movement | A4 and Rytm sequencers | parameter locks, trig conditions, slow LFO | 16 | 5 |
| 9 | Space and depth | A4 and Rytm FX, Xone sends | sends, pre-delay, tempo-synced delay | 18 | 7 |
| 10 | Ear lab: what changed? | Rytm, A4, Xone | interleaved ear training (checkpoint) | 10 | 9 |
| 11 | Arrangement | Song arranger | sections, 8/16-bar phrases, energy curve | 22 | 8 |
| 12 | Transitions | Rytm, A4, Xone, arranger | fills, retrigs, risers, sweeps, gaps | 18 | 11 |
| 13 | Mixdown | Xone:96, track levels and pans | gain staging, balance, pan, mono, headroom | 22 | 12 |
| 14 | Master and bounce | Studio master, meters, bounce | limiter, LUFS, true peak, WAV, stems | 18 | 13 |
| 15 | Capstone | your choice | a complete 2-minute track and reflection | 60–120 | 14 |

About 5½ hours of lessons plus the capstone. Recommended pace: two or three lessons
a week, with the daily review (3–5 minutes) before each new lesson.

**Interleaving instruments and skills.** Instrument lessons (1–3, 5, 6, 8) alternate
with studio lessons (4, 7, 9, 11–14). New instruments arrive when they solve a
problem: the DFAM arrives with the clock lesson because it has no MIDI, and the Xone:96
EQ arrives when the parts start to mask each other.

**Placement check (for intermediates).** Before Lesson 1 the path offers "I know the
basics: test me". It asks 8 retrieval questions drawn from the review sets of Lessons
1–4 and 7. Six or more right unlocks Lesson 5 and loads checkpoint CP-04. Fewer
starts at Lesson 1 without any judgement: "Let's build it from the ground up, it's quick".

## 3. How the path teaches (PEDAGOGY.md applied)

Every lesson has the required parts: an objective, a first win in the first minute, at
least one predict or listen, at least one quiz, a challenge or a match, a closing
reflect, and 3–5 review questions. On top of that:

- **Hook from the worked example.** Each lesson opens with 8–12 seconds of Demo 1 (or
  another demo) that shows the idea finished. Learners hear the goal before they build it.
- **Warm-up retrieval.** Lessons 2–15 have one quiz near the start on a concept from
  1–3 lessons back (a spaced, lagged retrieval). Its first answer counts toward the
  review schedule, like every quiz.
- **I do, we do, you do.** Early steps give exact targets ("trig 5 and 13"). Middle
  steps give goals with hints. Every lesson ends with an open challenge on the
  learner's own track, checked with generous tolerances.
- **One new idea per lesson.** Each lesson changes one dimension: time, pitch, tone,
  space or form. Steps that touch something else are pre-set by the checkpoint.
- **Ears before numbers.** `listen` A/B steps and `match` steps come before the
  meters. Meters confirm what the ears found; they never replace listening.
- **Interleaved checkpoints.** Lesson 10 mixes swing, filter, length, sends and EQ in
  one ear test. Lesson 15's final quiz mixes concepts from the whole path.
- **Motivation.** A quick win, visible progress (the learner's track grows every
  lesson), autonomy (choices from Lesson 5 on), and real music context (the demos).
  After Lesson 6 the app offers "Bounce your loop" so the learner has something to
  share early.

### Spacing and retrieval map

I = introduced, P = practised in a later step or challenge, R = retrieved by a quiz,
warm-up or review question, E = tested by ear (listen or match).

| Concept | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Beats, steps, bars | I | R | P |   |   |   |   |   |   |   | R | P |   |   | R |
| BPM and time maths | I |   |   | R |   |   |   |   | P |   | R |   |   |   | R |
| Swing and micro timing |   | I | R |   |   |   |   |   |   | E |   |   |   |   | R |
| Velocity, ghost notes |   | I |   |   |   |   |   |   |   | E |   | P |   |   |   |
| Kick vs bass |   |   | I | R |   |   | P |   | R | E |   |   | P |   | R |
| One clock, sync |   |   |   | I | R |   |   |   |   |   |   |   |   |   | R |
| Chords, progression |   |   |   |   | I | R |   |   |   |   | P |   |   |   | R |
| Hook, register |   |   |   |   |   | I | R |   |   |   | P |   |   |   |   |
| EQ, masking, high-pass |   |   |   |   |   |   | I | R | P | E |   |   | P | R | R |
| Locks, conditions, LFO |   |   |   |   |   |   |   | I | R |   | R | P |   |   |   |
| Sends, delay, reverb |   |   |   |   |   | P |   |   | I | E |   | P | P |   | R |
| Sections, phrasing, energy |   |   |   |   |   |   |   |   |   |   | I | P | R |   | P |
| Gain staging, headroom |   |   |   |   |   |   |   |   |   |   |   |   | I | R | P |
| Loudness, true peak |   |   |   |   |   |   |   |   |   |   |   |   |   | I | R |

The review queue (1, 3, 7, 16 and 35 days, a miss resets to 1 day) carries the long-term
spacing; this map makes sure every concept is also met again inside the path.

## 4. Start states: sets and checkpoints

Studio lessons need a whole studio, not one instrument, so each lesson names a **set**
(rack, routes, sync and cables) and a **checkpoint** (instrument data and settings).
The learner can always choose "Continue with my track" instead of the checkpoint; the
lesson checks are written so that both pass.

### Sets

| Set | Status | Rack and routing | Tempo |
|---|---|---|---|
| `elektron-live` | exists | Analog Rytm → Xone:96 ch 1, Analog Four → ch 2, both synced; Xone channels A and B on RTN (delay and reverb returns) | 124 |
| `elektron-live-dfam` | new | `elektron-live` + Studio Clock + DFAM → Xone ch 4; no cables (the lesson patches them) | 124 |
| `moog-sound-studio-mix` | new | Studio Clock, DFAM → ch 1, Mother-32 → ch 2, Subharmonicon → ch 3, Xone:96; clock cables as in Demo 2 | 110 |
| `bass-and-drums` | exists | Analog Rytm → ch 1, Sub 37 → ch 2, both synced | 122 |

### Checkpoints

Each checkpoint is a saved project shipped with the app. The learner's own project is
snapshotted before a checkpoint loads and can be restored with one press.

| Id | Loaded by | Contents |
|---|---|---|
| CP-00 | L1 | `elektron-live`. Rytm kit **PRODUCER**: kick tuned to A (about 55 Hz), clap, closed and open hats, rim, low tom, snare, ride; every pattern empty. A4 kit **PRODUCER**: T1 sub-saw bass, T2 stab (OSC 2 +7), T3 stab (OSC 1 +3, OSC 2 +10), T4 glass pluck; patterns empty. Xone flat, ch 1 fader 8, ch 2 fader 0, returns A and B at 5. Swing 50 %. |
| CP-01 | L2 | CP-00 + Rytm A01: BD 1 5 9 13, CP 5 13, CH 3 7 11 15, RS 12. |
| CP-02 | L3 | CP-01 + CH 16ths with ghost notes, SWING 56 %, CP 13 micro timing +3. Xone ch 2 fader 7. |
| CP-03 | L4 | CP-02 + A4 A01 T1 bass (A2 on 3 7 11 15, C3 on 11, G2 on 15, LEN 1). Kick TUN matched to A. |
| CP-04 | L5 | CP-03 in `elektron-live-dfam`: Studio Clock CLOCK → DFAM ADV/CLOCK, DFAM preset "Tick Perc", Xone ch 4 fader 3.5. |
| CP-05 | L6 | CP-04 + A4 pattern length 64, T2/T3 Am7–Am7–Dm7–Em7 stabs, T1 bass following the roots. |
| CP-06 | L7 (end) | CP-05 + T4 two-bar hook. |
| CP-07 | L7 (start) | CP-06 made deliberately muddy: A4 T2–T4 FILTER 2 set to LP2 open (no high-pass), Rytm CP/CH/OH filters LP2 open, Xone ch 2 LO MID +3 dB. |
| CP-08 | L8 | CP-07 cleaned (the L7 solution). |
| CP-09 | L9, L10 | CP-08 + two locks, two conditions, one LFO (the L8 solution). All sends at 0. |
| CP-11 | L11 | CP-09 + FX (L9 solution), and the pattern bank an arrangement needs: Rytm A01 intro drums, A02 full drums, A03 break drums (no kick); A4 A01 bass only, A02 full, A03 break pads with the hook. Arranger empty. |
| CP-12 | L12 | CP-11 + an arrangement of 7 sections without transitions, plus a 64-step Rytm A05 BUILD with kicks in bars 1–3 and an empty A4 A05 BUILD. |
| CP-13 | L13 | CP-12 + transitions, with a deliberately rough mix: every Xone fader at 10, ch 1 GAIN +6 dB (PK lighting), A4 T2/T3 panned centre. |
| CP-14 | L14 | CP-13 mixed (the L13 solution); master limiter off. |

## 5. What the checks look at

Lesson checks read `LessonCheckState`. They are written below as short pseudo-code
using the helpers in this section, so they survive the rebuilds: helpers resolve
hardware names ("FLTR FREQ", "AMP DEC") to whatever ids the rebuilt devices use.

### Available today

- `s.instances[id]` — `device`, `values`, `patches`, `data` (Elektron projects live in `data`).
- `s.studioCables` — cables between instruments.
- `s.routes[id]` — `'master'` or a mixer input such as `'xone96:studio_1'`.
- `s.sync[id]` — follows the studio clock (missing means on, for MIDI-syncable gear).
- `s.transport` — `playing`, `bpm`.
- `s.arrangement` — `enabled`, `loop`, `sections[]` with `name`, `bars` and `parts[instance]`
  of `{ pattern?, snapshot?, muted? }`.

### Proposed additions (needed by Lessons 2, 13 and 14)

```ts
s.transport.swing          // studio swing, 0..0.75 (fraction of a 16th)
s.meters.master            // { peakDb, truePeakDb, lufsM, lufsS, lufsI, lra, correlation,
                           //   grDb /* limiter gain reduction now */, maxGrDb, measuredSec }
                           // lufsI and maxGrDb reset when the transport starts from bar 1
s.meters.channels[input]   // input = 'xone96:1' … 'xone96:4', 'xone96:a', 'xone96:b':
                           //   { peakDbu, avgDbu, pk /* PK lit in the last 2 s */ }
s.meters.parts[instance]   // { lufsS, peakDb } of each instrument's own output (pre-mixer)
s.master                   // { limiterOn, driveDb, ceilingDbTP, mono }
s.bounce                   // { recording, last?: { seconds, lufsI, truePeakDb,
                           //   stems: string[], fromBar, toBar, at } }
s.history                  // since the lesson started: toggled(inst, control): boolean,
                           //   max(inst, control): number, min(inst, control): number
```

### Helpers (a new `lib/studio/checks.ts`)

```ts
inst(s, dev)                      // first instance id of a device ('analog-rytm' -> 'analog-rytm')
val(s, dev, name)                 // a control value by hardware name, e.g. val(s,'analog-four','T2 FILTER 2 TYPE')
proj(s, dev)                      // the Elektron project (asProject on the instance data)
trigs(s, dev, track, pattern?)    // 1-based step numbers holding note trigs (default: the active pattern)
step(s, dev, track, n, pattern?)  // { note, vel, len, cond, micro, locks, retrig, pslide, trigless } or undefined
locks(s, dev, track, name, pattern?) // 1-based steps that lock a parameter, e.g. 'FILTER 1 FREQ'
swing(s, dev, pattern?)           // pattern swing 50..80 (or the studio swing converted)
plen(s, dev, pattern?)            // pattern length in steps
cable(s, fromDev, fromJack, toDev, toJack)   // exists in lessons.ts
xch(s, dev)                       // Xone channel the device is routed to: '1'..'4' | 'a' | 'b' | null
xv(s, ch, name)                   // Xone value, e.g. xv(s,'2','LO MID') in dB, xv(s,'1','FADER') 0..10
sec(s, name)                      // arrangement section by name (case-insensitive)
part(s, section, dev)             // that section's part for the device's instance
pc(note)                          // pitch class 0..11 of a MIDI note (A = 9)
```

Track names: Rytm `BD SD RS CP BT LT MT HT CH OH CY CB`; Analog Four `1`–`4`.
Notes are MIDI numbers in checks (A2 = 45, A3 = 57, C4 = 60) and names in instructions.
Step numbers are 1-based everywhere in this document, like the trig keys.

Tolerances follow PEDAGOGY.md: generous on challenges (ranges, "at least"), exact
only where a step gives an exact target.

---

## 6. The lessons

Conventions in the step lists:

- **Kind** is the `LessonStep.kind`. Instruction text in quotes is what the coach shows
  (25 words or fewer, imperative, panel labels as printed). A principle is 20 words or fewer.
- For `predict` and `quiz`, options are listed in display order and the correct one is
  marked ✓. "Why" explains the right answer and the tempting wrong one.
- `instance` names the instrument the step acts on; focus names what to spotlight.
- Hints run from vague to specific. Every challenge has a `solution`, which the validator requires.
- Review questions list the options in display order with the answer marked ✓.

---

### L1 · First beat

`prod-01-first-beat` · beginner · 10 min · concepts: timing-tempo, sequencer-pattern

| | |
|---|---|
| **Objective** | Program a four-on-the-floor beat with kick, clap and hi-hats, and play it in time. |
| **Prerequisites** | none (the optional `studio-1-one-clock` covers BPM in more depth) |
| **Instruments** | Analog Rytm into Xone:96 channel 1 |
| **Start** | Set `elektron-live`, checkpoint CP-00 (sounds designed, patterns empty, 124 BPM) |
| **Hook** | Demo 1, bars 17–20, Rytm only |

**Steps**

1. **info, hook (autoplay 8 s).** "This path ends with a finished track like this one. Listen for the kick on every beat."
   - Principle: A steady kick on every beat gives listeners a pulse to move to.
2. **do, first win.** "Select the BD track. Tap trig keys 1, 5, 9 and 13, then press ▶." `instance: analog-rytm`, focus the four trig keys.
   - Check: `trigs(s,'analog-rytm','BD') ⊇ {1,5,9,13} && s.transport.playing`
   - Principle: Four evenly spaced kicks per bar, called four on the floor, drive house and techno.
   - Explanation: A *bar* is four *beats*. The Rytm splits each beat into four *steps* (16th notes), so a bar has 16 steps and the beats fall on steps 1, 5, 9 and 13.
   - Hints: "Look at the numbers printed under the trig keys." → "Tap keys 1, 5, 9 and 13 once each."
3. **predict.** "Select the CP track and tap trig keys 5 and 13."
   - Question: The clap goes on steps 5 and 13. Where in the bar will you hear it?
     - On beats 2 and 4, the backbeat ✓
     - On beats 1 and 3, with the kick
     - Between the beats
   - Why: Step 5 is beat 2 and step 13 is beat 4, where a crowd claps along. Beats 1 and 3 are steps 1 and 9; "between the beats" would be steps such as 3 or 7.
   - Check: `trigs(s,'analog-rytm','CP') ⊇ {5,13}`
   - Principle: A snare or clap on beats 2 and 4 (the backbeat) answers the kick.
4. **do.** "Select the CH track and tap trig keys 3, 7, 11 and 15."
   - Check: `trigs(s,'analog-rytm','CH') ⊇ {3,7,11,15}`
   - Principle: Off-beat hats fill the gaps between kicks and push the groove forward.
   - Explanation: Steps 3, 7, 11 and 15 are the *off-beats*, halfway between the beats. Kick, hat, kick, hat is the bounce of house music.
5. **listen.** "Compare the beat with and without the off-beat hats." `instance: analog-rytm`; A = CH VOL 100, B = CH VOL 0 (labels "With hats", "Without").
   - Question: What do the off-beat hats add?
     - A faster tempo
     - Movement between the kicks ✓
     - More bass
   - Why: The tempo is the same in both. The hats are high and short, so they add motion in the gaps, not weight; the weight comes from the kick.
6. **quiz.** "Quick check."
   - Question: At 124 BPM with four on the floor, how many kicks play in one minute?
     - 31
     - 496
     - 124 ✓
   - Why: BPM counts beats per minute and there is one kick per beat. 31 is the number of bars (124 ÷ 4); 496 would be every 16th step.
7. **challenge.** "Make the beat your own: add a hit that answers the clap, without moving the kick or the clap."
   - Checklist:
     - Kick still on every beat: `trigs(BD) ⊇ {1,5,9,13}`
     - Clap still on 5 and 13: `trigs(CP) ⊇ {5,13}`
     - At least one new hit off the beats: a trig on RS, LT or OH on any step not in {1,5,9,13}, or a CH trig outside {3,7,11,15}
   - Hints: "Try a step just before a beat." → "Steps 4, 8, 12 and 16 sit right before a beat." → "Put RS on step 12."
   - Solution: RS trig on step 12.
8. **reflect.** Prompt: In one sentence, why does the kick go on steps 1, 5, 9 and 13? Model: Those steps are the four beats of the bar, so the kick marks the pulse everyone feels.

**Review**

1. Four on the floor means… — a kick on every beat ✓ · four drums at once · four kicks anywhere in the pattern. *Why:* one kick per beat, four beats per bar.
2. In a 16-step bar, beat 3 is step… — 3 · 9 ✓ · 12. *Why:* the beats are steps 1, 5, 9, 13.
3. The backbeat is… — beats 2 and 4 (steps 5 and 13) ✓ · beats 1 and 3 · the last step. *Why:* the clap or snare answers the kick on 2 and 4.
4. Off-beat hats sit… — on the beats · halfway between the beats ✓ · only at the end of the bar. *Why:* steps 3, 7, 11 and 15 are the "ands".
5. 124 BPM means… — 124 bars per minute · 124 steps per minute · 124 beats per minute ✓. *Why:* BPM is beats per minute.

**Go further.** Add a soft kick on step 16 (VEL about 50) and hear how one extra note changes the feel of the bar line.

---

### L2 · Groove

`prod-02-groove` · beginner · 14 min · concepts: timing-tempo, velocity-dynamics, sequencer-pattern

| | |
|---|---|
| **Objective** | Turn a stiff beat into a groove with 16th hats, ghost notes, swing and micro timing. |
| **Prerequisites** | L1 |
| **Instruments** | Analog Rytm |
| **Start** | Learner's track or CP-01 |
| **Hook** | Demo 1 drums, bars 17–20: first with SWING 50 % and ghost notes muted, then as made |

**Steps**

1. **listen, hook.** "Same notes, two feels. Which one makes you want to move?" A = Demo 1 drums at SWING 50 % with the ghost notes at VEL 1; B = as made (54 %, ghosts on).
   - Question: What is different about B?
     - It is louder
     - It has more drums
     - The timing and loudness of the small notes ✓
   - Why: Both have the same drums at the same peak level. B delays every second 16th a little (swing) and plays the in-between notes softly (ghost notes).
2. **quiz, warm-up (L1).** In a 16-step bar, which steps are the beats? — 1, 2, 3, 4 · 1, 5, 9, 13 ✓ · 4, 8, 12, 16. *Why:* one beat every four steps.
3. **do, first win.** "On the CH track, add trigs on 2, 4, 6, 8, 10, 12, 14 and 16."
   - Check: `trigs(CH) ⊇ {2,4,6,8,10,12,14,16}`
   - Principle: Sixteenth-note hats make the grid audible, so small timing changes become easy to feel.
4. **do.** "Hold CH trig 2 and set VEL to about 45. Repeat for 6, 10 and 14."
   - Check: `[2,6,10,14].every(n => step(CH,n).vel <= 70)`
   - Principle: Quiet in-between notes, called ghost notes, add motion without adding clutter.
   - Explanation: *Velocity* is how hard a note is played, 1–127. Drummers hit the beat hard and the notes between softly; the ear hears the loud ones as the rhythm and the soft ones as feel.
   - Hints: "Hold the trig key down while you turn." → "VEL is on the TRIG page." → "About a third of the way up."
5. **predict.** "Set the pattern's SWING to 58 %."
   - Question: Swing delays every second 16th. What will you hear?
     - The hats get louder
     - A bouncier, shuffled feel at the same tempo ✓
     - A faster tempo
   - Why: Only the timing of steps 2, 4, 6… moves later, so the groove lopes while the beats stay put. Loudness is velocity, not swing.
   - Check: `swing(s,'analog-rytm') >= 55 && swing(s,'analog-rytm') <= 62`
   - Hints: "SWING is a pattern setting." → "On the Rytm it opens with [FUNC] + [BANK G]."
6. **listen.** "Compare two swing settings." A = SWING 50 %, B = SWING 66 %.
   - Question: Which one sounds like triplets, a heavy shuffle?
     - A
     - B ✓
     - Neither
   - Why: At about 66 % the late 16th lands two-thirds of the way through each 8th note, the triplet position. 50 % is straight.
7. **do.** "Hold CP trig 13 and nudge its micro timing late, to about +3."
   - Check: `step(CP,13).micro >= 1 && step(CP,13).micro <= 6`
   - Principle: A note played slightly late relaxes the groove; slightly early pushes it.
   - Explanation: Micro timing moves one trig off the grid in steps of 1/384 of a whole note, about 5 ms each at 124 BPM. +3 is about 15 ms.
8. **quiz.** What is the difference between swing and micro timing?
   - Swing changes velocity; micro timing changes pitch
   - Swing moves every second 16th by the same amount; micro timing moves one chosen trig ✓
   - They are the same control
   - Why: Swing is a pattern-wide timing rule; micro timing is a per-trig nudge. Neither changes pitch or velocity.
9. **match.** "Recreate the target groove by ear." `instance: analog-rytm`, controls: SWING. Target 64 % from a start of 50 % (47 % of the 50–80 travel, easy level).
   - Hints: "Is the target straighter or more shuffled than yours?" → "It is quite shuffled." → "Try the low 60s."
   - Needs SWING exposed as a matchable value (see §7). Until then, replace with a listen step: "Which one is 64 %?"
10. **challenge.** "Humanize the hats: loud and soft notes, and a swing between 52 and 62 %."
    - Checklist:
      - At least 8 CH trigs: `trigs(CH).length >= 8`
      - A velocity spread of 30 or more across the CH trigs
      - SWING 52–62 %
      - Kick still on every beat
    - Hints: "Loud on the off-beats, soft in between." → "Set 3, 7, 11 and 15 to about 100 and the others to about 45." → "House usually swings 54–58 %."
    - Solution: CH VEL 44 on 2, 6, 10, 14; 60 on 4, 8, 12, 16; 96 on 3, 7, 11, 15. SWING 56 %.
11. **reflect.** Prompt: In one sentence, what does swing change, and what does it leave alone? Model: Swing delays every second 16th to make a shuffle; it leaves the tempo and the beats where they are.

**Review**

1. SWING 50 % means… — straight timing ✓ · maximum shuffle · half tempo. *Why:* both 16ths of each pair are equal.
2. A ghost note is… — a muted track · a quiet in-between hit ✓ · a note with no sound. *Why:* it is played softly, not silent.
3. Micro timing on one trig moves… — every second step · only that trig, a little early or late ✓ · the whole pattern. *Why:* it is a per-trig offset.
4. Swing near 66 % sounds like… — straight 16ths · triplets, a heavy shuffle ✓ · double tempo. *Why:* the late 16th reaches the triplet position.
5. To make a clap feel laid back, nudge it… — early · late ✓ · louder. *Why:* late notes relax a groove; early notes push it.

**Go further.** On the Rytm, swing only moves steps marked as swing trigs. Remove the swing mark from one step in the SWING menu and hear that 16th go straight against the others.

---

### L3 · Bass locked to the kick

`prod-03-bass-kick` · beginner · 15 min · concepts: sequencer-pattern, envelope-decay, oscillator-pitch

| | |
|---|---|
| **Objective** | Write a bassline that locks to the kick: notes in the gaps, short enough to clear the next kick, in the same key. |
| **Prerequisites** | L2 |
| **Instruments** | Analog Four track 1 (sub-saw bass) into Xone ch 2; Analog Rytm |
| **Start** | Learner's track or CP-02. Xone ch 2 fader 7. A4 T1 kit sound: OSC 1 SAW with SUB 1OCT, FILTER 1 FREQ about 40, TRIG NOTE A2 |
| **Hook** | Demo 1, bars 9–12, kick and bass only |

**Steps**

1. **info, hook (autoplay 8 s).** "Kick and bass take turns: boom, dum, boom, dum. That is the engine of a dance track."
2. **quiz, warm-up (L2).** Swing moves… — the tempo up · every second 16th a little later ✓ · the hats' velocity. *Why:* swing is timing only.
3. **do, first win.** "On the Analog Four, select TRACK 1. Tap trigs 3, 7, 11 and 15, then press ▶." `instance: analog-four`
   - Check: `trigs(s,'analog-four',1) ⊇ {3,7,11,15} && s.transport.playing`
   - Principle: A bass on the off-beats answers the kick instead of fighting it.
   - Explanation: The kick owns the beat and the bass speaks in between. A *bassline* is the low melody that holds the harmony and the groove together.
4. **predict.** "Now add a bass trig on step 1, with the kick."
   - Question: Bass and kick both hit on step 1. What happens to the low end?
     - It just gets punchier, with no downside
     - Nothing; they are different instruments
     - The two low sounds blur and fight for the same space ✓
   - Why: Both put most of their energy below about 100 Hz. On the same step they add up to a louder, muddier thump that can clip. Being different instruments doesn't help: frequency and time are what separate sounds.
   - Check: `trigs(1).includes(1)`
5. **do.** "Remove the trig on step 1 again. Listen to the kick come back into focus."
   - Check: `!trigs(1).includes(1)`
   - Principle: Separate kick and bass in time and each one stays clear.
6. **do.** "On the TRIG page, set TRACK 1 LEN to 1, one 16th, so each note ends before the next kick."
   - Check: every T1 trig length ≤ 1.75 steps
   - Principle: Short bass notes leave silence for the kick, so both stay punchy.
   - Explanation: LEN (note length) is how long the note is held. An off-beat note that rings for two steps runs straight into the next kick.
7. **do.** "On the Rytm BD track, turn TUN until the kick and the bass sound like the same note."
   - Check: `|val(rytm,'BD TUN') - KIT_A_TUNE| <= 1` (the PRODUCER kit stores which TUN puts the kick body at A, about 55 Hz)
   - Principle: When kick and bass share a key, the low end sounds like one instrument.
   - Hints: "Mute everything but kick and bass." → "Turn slowly and listen for the wobble between them to slow down." → "The spectrum peak should sit near 55 Hz."
8. **do.** "Hold trig 11 and set NOTE to C3. Hold trig 15 and set NOTE to G2."
   - Check: `pc(step(1,11).note) === 0 && pc(step(1,15).note) === 7`
   - Principle: Roots on strong off-beats and passing notes on weaker ones keep a bassline solid but moving.
   - Explanation: The *root* is the note the key is named after, here A. C and G belong to A minor, so they add movement without leaving the key.
9. **quiz.** Why end bass notes before the next kick? — to save CPU · because the sequencer requires it · so the kick's attack isn't blurred by a ringing bass ✓. *Why:* overlap smears the kick's click and thump; the sequencer and the CPU don't care.
10. **match.** "Match the bass note length by ear: AMP DEC." `instance: analog-four`, controls: T1 AMP DEC; target 34 from a start of 80 (36 % of travel).
    - Hints: "Is the target shorter or longer?" → "Shorter: it stops well before the next kick."
11. **challenge.** "Write your own one-bar bassline that locks to the kick."
    - Checklist:
      - At least four notes: `trigs(1).length >= 4`
      - None on the kick steps 1, 5, 9, 13 (one is allowed if its LEN ≤ 1)
      - At least two different pitches
      - All notes in A minor: every `pc(note)` in {9, 11, 0, 2, 4, 5, 7}
      - Every LEN ≤ 2 steps
    - Hints: "Start from the off-beats." → "Use A for most notes and add C, D, E or G." → "Try a quiet octave jump, A3, on step 8."
    - Solution: Demo 1 bar 1 — A2 on 3 (VEL 112, LEN 1.5), A2 on 7 (100, 1), A3 on 8 (64, 0.5), A2 on 11 (108, 1.5), A2 on 15 (100, 1), E3 on 16 (60, 0.5).
12. **reflect.** Prompt: Explain how you made the kick and bass work together. Model: I put the bass in the gaps between kicks, kept its notes short so each kick is clean, and tuned the kick to the bass's key so the low end sounds like one instrument.

**Review**

1. Bass notes on the off-beats… — double the kick · answer the kick instead of clashing ✓ · slow the groove. *Why:* they fill the gaps the kick leaves.
2. Two low sounds on the same step tend to… — blur and fight for space ✓ · cancel out completely · get brighter. *Why:* both crowd the same frequencies at the same moment.
3. A trig's LEN sets… — its loudness · how long the note is held ✓ · its pitch. *Why:* LEN is the gate time.
4. Tuning the kick to the song's key helps because… — it makes the kick louder · kick and bass blend into one low end ✓ · it changes the tempo. *Why:* matched pitches stop them beating against each other.
5. Which note is NOT in A minor? — C · G · C# ✓. *Why:* A minor is A B C D E F G.

**Go further.** Load `bass-and-drums` and write the same idea on the Sub 37's step sequencer. Use TIE between two different notes to hear legato glide, and ratchet one ghost note.


---

### L4 · One clock for the whole studio

`prod-04-one-clock` · intermediate · 15 min · concepts: timing-tempo, signal-routing, polyrhythm

| | |
|---|---|
| **Objective** | Run every instrument from one clock: the Elektrons by MIDI-style sync and the DFAM by clock pulses, so a percussion layer plays in time. |
| **Prerequisites** | L3 (and `studio-1-one-clock` if the learner skipped L1–L3) |
| **Instruments** | Studio Clock, DFAM into Xone ch 4, Analog Rytm, Analog Four |
| **Start** | Learner's track or CP-03, in set `elektron-live-dfam` (no cables). DFAM preset "Tick Perc": short, high, 8 steps of 16th-note percussion with mixed velocities. Xone ch 4 fader 0 |
| **Hook** | Demo 2 ("Three Clocks"), bars 9–12: three Moog instruments, one clock |

**Steps**

1. **info, hook (autoplay 10 s).** "Three instruments with no shared brain, perfectly in time. The secret is one clock."
   - Principle: Music is organised time; one clock divides it into beats every instrument agrees on.
2. **quiz, warm-up (L3).** Why keep bass notes short? — so the next kick stays clear ✓ · to make them louder · so the sequencer runs faster. *Why:* a ringing bass blurs the next kick's attack.
3. **do, first win.** "In the Studio tab, check that 'Sync to studio clock' is ticked for the Analog Rytm and the Analog Four. Press ▶."
   - Check: `['analog-rytm','analog-four'].every(d => s.sync[inst(s,d)] !== false) && s.transport.playing`
   - Principle: A synced instrument ignores its own tempo and follows the leader.
   - Explanation: MIDI-style sync sends 24 clock ticks per beat, plus start and stop, so followers lock to the leader's tempo and position.
4. **predict.** "Press ■. Untick the A4's sync, set its TEMPO to 123 BPM, then press ▶ and listen for 30 seconds."
   - Question: The studio plays 124 BPM and the A4 plays 123. What happens over half a minute?
     - Nothing; 1 BPM is too small to hear
     - The A4 speeds up to match
     - They drift apart until the bass lands in the wrong place ✓
   - Why: One beat per minute is lost, so after 30 seconds the bass is half a beat late, right on top of the kick. Instruments don't correct each other unless they share a clock.
   - Check: `s.sync[inst(s,'analog-four')] === false && |val(a4,'TEMPO') - 123| < 0.5 && s.transport.playing`
5. **do.** "Tick 'Sync to studio clock' for the A4 again."
   - Check: `s.sync[inst(s,'analog-four')] !== false`
   - Principle: Only the leader's tempo matters; every follower inherits it.
6. **do.** "Patch Studio Clock CLOCK to DFAM ADV/CLOCK." `instance: studio-clock`, focus `out_clock`
   - Check: `cable(s,'studio-clock','out_clock','dfam','in_adv_clock')`
   - Principle: A clock pulse is a short voltage; each one tells a sequencer to take one step.
   - Explanation: The DFAM has no MIDI. Gear like this is synced the way modular synths are: with pulses on a patch cable.
7. **predict.** "Look at CLOCK DIV: it is 1/16."
   - Question: The DFAM has 8 steps and takes one step per 16th. How long is one loop of its sequence?
     - Half a bar (2 beats) ✓
     - One bar
     - Two bars
   - Why: 8 steps × one 16th each = 8 sixteenths = 2 beats. It loops twice per bar, so it stays lined up with a 4/4 beat. One bar would need 16 steps.
8. **do.** "Press ADVANCE until the DFAM sits on step 8, press RUN/STOP, then ▶. Raise Xone channel 4 to about 4."
   - Check: `s.transport.playing && val(dfam,'RUN/STOP') && xv(s,'4','FADER') >= 3`
   - Principle: Parking a sequencer on its last step makes the first clock pulse play step 1.
9. **predict.** "Switch CLOCK DIV to 1/16T (16th-note triplets)."
   - Question: The DFAM now steps 6 times per beat instead of 4. What happens against your beat?
     - It stops playing
     - A rolling cross-rhythm: its 8-step loop now fits three times into each bar ✓
     - Nothing changes
   - Why: 8 steps × 1/6 beat = 1⅓ beats, so three loops fill one 4-beat bar. Three loops against four beats is a *polyrhythm*: two pulse rates at once that meet again at the bar line.
   - Check: `val(clock,'CLOCK DIV') === '1/16T'`
10. **listen.** "Compare the two clock divisions." `instance: studio-clock`; A = CLOCK DIV 1/16, B = CLOCK DIV 1/16T.
    - Question: Which one is the polyrhythm?
      - A
      - B ✓
    - Why: B's loop is 1⅓ beats long, so its accents land in a different place on each beat and realign every bar.
11. **quiz.** How many MIDI clock ticks make one beat? — 4 · 96 · 24 ✓. *Why:* 24 pulses per quarter note is the MIDI standard; a 16th is 6 ticks. 4 is the number of 16ths per beat.
12. **challenge.** "Make the DFAM a percussion layer that supports your beat: in time, and sitting behind your hats."
    - Checklist:
      - Clock patched: `cable(s,'studio-clock','out_clock','dfam','in_adv_clock')`
      - Both Elektrons synced
      - DFAM routed into the Xone: `xch(s,'dfam') !== null`
      - Quieter than the drums: `xv(s,xch(s,'dfam'),'FADER') < xv(s,xch(s,'analog-rytm'),'FADER')`
    - Hints: "A layer supports; it shouldn't lead." → "Keep its fader well below channel 1." → "Try CLOCK DIV 1/16 for a tight layer, 1/16T for a rolling one."
    - Solution: cable as above, CLOCK DIV 1/16, Xone ch 4 fader 4 (ch 1 at 8).
13. **reflect.** Prompt: Why can't two instruments just be set to the same BPM instead of sharing a clock? Model: Two separate clocks always drift a little, so the parts slide apart over time. One shared clock keeps every step landing together.

**Review**

1. Two machines set to 124 and 123 BPM… — stay together · play in a 4:3 ratio · drift apart about a beat per minute ✓. *Why:* the 1 BPM difference accumulates.
2. Gear with no MIDI is synced with… — clock pulses on a cable ✓ · the same BPM number · a faster CPU. *Why:* each pulse advances one step.
3. 8 steps at 1/16 last… — 2 beats ✓ · 1 bar · 8 beats. *Why:* 8 sixteenths.
4. Clocking an 8-step loop at 1/16T against 4/4 gives… — double time · a 3-against-4 cross-rhythm ✓ · silence. *Why:* three loops fit in one bar.
5. Parking the DFAM on step 8 before starting makes… — the first pulse play step 1 ✓ · it skip step 1 · it play twice as fast. *Why:* the next pulse advances to step 1.

**Go further.** Patch Studio Clock BEAT (quarter notes) into the DFAM instead: the 8 steps now take two bars. Slow clocks turn a drum sequencer into a slowly evolving riff.

---

### L5 · Chords and pads

`prod-05-chords` · intermediate · 18 min · concepts: oscillator-pitch, envelope-attack, envelope-release

| | |
|---|---|
| **Objective** | Build minor-seventh chords from two A4 tracks, program a four-bar progression, and shape the same chord as a short stab or a slow pad. |
| **Prerequisites** | L3 |
| **Instruments** | Analog Four tracks 2 and 3 (and track 1), Analog Rytm |
| **Start** | Learner's track or CP-04. A4 T2 kit sound: two saws, OSC 2 TUN +7. T3: two saws, OSC 1 TUN +3, OSC 2 TUN +10. Both: FILTER 1 FREQ about 60, AMP ATK 0, DEC 46, SUS 0, REL 36 |
| **Hook** | Demo 1, bars 15–18 (the chords arrive at the drop) |

**Steps**

1. **info, hook (autoplay 10 s).** "Listen to what happens at the drop: the chords arrive and the track suddenly has a mood."
2. **quiz, warm-up (L4).** What keeps several instruments in time? — the same volume · one shared clock ✓ · the same key. *Why:* separate clocks drift; volume and key don't affect timing.
3. **do, first win.** "Select A4 TRACK 2. Tap trig 3, hold it, and set NOTE to A3."
   - Check: `trigs(2).includes(3) && pc(step(2,3).note ?? val(a4,'T2 TRIG NOTE')) === 9`
   - Principle: Two oscillators tuned seven semitones apart play a strong, open two-note chord.
   - Explanation: TRACK 2's OSC 2 is tuned +7 semitones, a *fifth*, so one trig plays A and E together. A *semitone* is the smallest step on a keyboard, one key to the next.
4. **predict.** "Select TRACK 3. Tap trig 3 and set NOTE to A3 as well."
   - Question: Track 2 plays A and E. Track 3 is tuned +3 and +10, so it adds C and G. What chord is A–C–E–G?
     - A major
     - A minor seventh ✓
     - A random cluster
   - Why: Root A, minor third C (+3), fifth E (+7) and minor seventh G (+10) make Am7, the warm chord of deep house and techno. A major would need C#, four semitones up.
   - Check: `trigs(3).includes(3) && pc(step(3,3).note ?? val(a4,'T3 TRIG NOTE')) === 9`
5. **info.** "Listen to your chord while you read how it is built."
   - Explanation: A *chord* is notes played together. Three notes stacked in thirds make a *triad*; add a fourth and you get a *seventh chord*. Because both tracks keep their tuning, any NOTE you give them plays a minor-seventh chord on that note, like the chord-memory buttons on classic house synths.
   - Principle: Fixed intervals move as a block, so one note per track changes the whole chord.
6. **do.** "Set the pattern LENGTH to 64 steps, four bars. The first bar is copied into the new pages."
   - Check: `plen(s,'analog-four') === 64`
   - Explanation: Extending a pattern copies the existing pages into the new ones, so your bass and chord trig appear in all four bars (A4 MKII manual p.49).
7. **do.** "On page 3, set the chord trigs on both tracks to NOTE D3. On page 4, set them to E3."
   - Check: tracks 2 and 3 have a trig in bar 3 with `pc === 2` and in bar 4 with `pc === 4`; bars 1–2 keep `pc === 9`
   - Principle: Moving the chord's root through the key makes a progression: home, away, and back.
   - Explanation: Am7 – Am7 – Dm7 – Em7 is a *progression*, a sequence of chords. Am7 is home in A minor; Dm7 and Em7 move away and pull back.
8. **quiz.** In A minor, which chord sounds most at rest? — Dm7 · Em7 · Am7 ✓. *Why:* the chord on the key's first note, the *tonic*, is home. Em7 leans back toward it, which is why it sounds unfinished at the end of the loop.
9. **do.** "Make the bass follow: on TRACK 1, set bar 3's notes to D3 and bar 4's to E3."
   - Check: track 1 has at least one note with `pc === 2` in bar 3 and `pc === 4` in bar 4
   - Principle: When the bass plays the chord's root, the harmony sounds solid and clear.
10. **predict.** "On TRACK 2 and TRACK 3 set AMP ATK to about 70 and REL to about 90, and LEN to 16."
    - Question: What will the slow attack and long release do to the chord?
      - Raise its pitch
      - Turn the short stab into a soft, swelling pad ✓
      - Speed up the pattern
    - Why: The *attack* is how long a note takes to reach full level and the *release* is how long it fades after the note ends. Slow and long turns a hit into a swell. Pitch and tempo are untouched.
    - Check: `[2,3].every(t => val(a4,`T${t} AMP ATK`) >= 50 && val(a4,`T${t} AMP REL`) >= 70)`
11. **listen.** "Compare the stab and the pad." `instance: analog-four`; A = T2 and T3 AMP ATK 0, REL 36 (stab); B = ATK 70, REL 90 (pad).
    - Question: Which leaves more room for the drums in a busy groove?
      - The stab ✓
      - The pad
    - Why: Short sounds leave silence between hits for the kick and hats. Pads fill every gap, which is why they suit breakdowns where the drums drop out.
12. **do.** "Put the stab back: AMP ATK 0, REL about 36, LEN 0.5 on both tracks."
    - Check: `[2,3].every(t => val(a4,`T${t} AMP ATK`) <= 10 && val(a4,`T${t} AMP REL`) <= 50)`
13. **match.** "Recreate the target pad by ear on TRACK 2." Controls: T2 AMP ATK and T2 AMP REL. Target ATK 84, REL 104 from ATK 0, REL 36.
    - Hints: "How long does it take to arrive?" → "It swells in slowly and hangs on." → "Both knobs are well past halfway."
14. **challenge.** "Write your own four-bar progression and stab rhythm. Keep the bass on the roots."
    - Checklist:
      - Tracks 2 and 3 have a trig in every bar
      - On every chord trig, tracks 2 and 3 play the same NOTE
      - At least two different roots
      - Every root in {A, D, E}: `pc in {9, 2, 4}`
      - Track 1 plays each bar's root at least once
    - Hints: "Start and end your phrase on A." → "Try A, A, D, E, or A, D, A, E." → "Copy each bar's root into track 1."
    - Why only A, D and E: with this two-track trick every chord is minor-seventh, and in A minor only A, D and E carry minor-seventh chords that stay in the key. Say so in the hint after the second failed check.
    - Solution: Demo 1 drop stabs — roots A3, A3, D3, E3; stabs on 3, 8, 11 (bar 1), 3, 11, 14 (bar 2), 3, 8, 11 (bar 3), 3, 8, 11 and a push on 15 to A3 (bar 4).
15. **reflect.** Prompt: What is the difference between a stab and a pad, in envelope terms? Model: A stab has a fast attack and a short release so it is a quick hit; a pad has a slow attack and a long release so it swells and sustains.

**Review**

1. A minor-seventh chord on A is… — A C# E G# · A C E G ✓ · A B C D. *Why:* root, minor third, fifth, minor seventh.
2. A minor third is how many semitones? — 3 ✓ · 4 · 7. *Why:* 4 is a major third, 7 a fifth.
3. A pad differs from a stab mainly by… — higher pitch · a slow attack and a long release ✓ · more distortion. *Why:* the envelope makes the difference.
4. In A minor the home chord is… — Em7 · Dm7 · Am7 ✓. *Why:* the tonic chord.
5. When the bass plays each chord's root… — the harmony sounds solid ✓ · the chord changes key · the kick disappears. *Why:* the lowest note defines how the chord is heard.

**Go further.** On real hardware the A4 can also play chords from one track: enable voices in POLY CONFIG ([FUNC] + [MIX]) and program overlapping notes (A4 MKII manual p.28). The two-track method keeps four independent tracks, which is why the demos use it.

---

### L6 · A hook

`prod-06-hook` · intermediate · 18 min · concepts: oscillator-pitch, sequencer-pattern, effects

| | |
|---|---|
| **Objective** | Write a short, memorable hook from the A minor pentatonic scale that fits your chords, in a register of its own. |
| **Prerequisites** | L5 |
| **Instruments** | Analog Four track 4 ("glass pluck": pulse plus a triangle an octave up). Optional: Sub 37 played live |
| **Start** | Learner's track or CP-05 |
| **Hook** | Demo 1, bars 49–52 (the hook over the chords) |

**Steps**

1. **info, hook (autoplay 10 s).** "One short line, repeated with a twist. That is a hook: the part people hum on the way home."
2. **quiz, warm-up (L5).** Which chord is home in A minor? — Dm7 · Am7 ✓ · Em7. *Why:* the chord on A, the tonic.
3. **do, first win.** "Select TRACK 4. Tap trigs 3, 6, 9 and 12: every third step."
   - Check: `trigs(4) ⊇ {3,6,9,12}`
   - Principle: A rhythm that repeats every three steps against a four-step beat creates a catchy cross-rhythm.
4. **do.** "Hold each trig and set NOTE: 3 = E5, 6 = D5, 9 = C5, 12 = A4."
   - Check: notes at 3, 6, 9, 12 have pitch classes 4, 2, 0, 9 and are A4 (69) or higher
   - Principle: Notes from the current chord sound stable; other scale notes add colour.
   - Explanation: A *scale* is the set of notes a key uses. The *pentatonic* scale is five of them, here A C D E G, with no notes a semitone apart, so it rarely clashes.
5. **predict.** "Press ▶ and listen across all four bars."
   - Question: The hook doesn't change, but the chords do. Why do E, D, C and A fit Am7, Dm7 and Em7?
     - Any notes fit any chord
     - They come from A minor pentatonic, which shares notes with all three chords ✓
     - Because the hook is quieter than the chords
   - Why: Every pentatonic note is also in A minor, and with no semitone steps none of them grinds against these chords. Not every note fits: an F# or Bb would clash.
   - Check: `s.transport.playing`
6. **info.** "Watch the spectrum while the bass, the stabs and the hook play: each has its own register."
   - Explanation: A *register* is a pitch range. The bass lives below about 120 Hz, the stabs around 150–400 Hz and the hook above 400 Hz, so none of them hides another.
   - Principle: Separate pitch ranges keep parts from masking each other.
7. **do.** "Answer the call: in bar 2, change the last two notes so the phrase rises instead of falls."
   - Check: track 4 bar 2 (steps 17–32) has at least 3 trigs, and its pitch sequence differs from bar 1 in at least one position
   - Principle: Repetition makes a hook memorable; one changed note makes it interesting.
   - Hints: "Keep the rhythm; change only the end." → "Try D5 then E5 on steps 12 and 15 of bar 2."
8. **quiz.** Your hook clashes with the Em7 chord in bar 4. What do you try first? — turn the hook up · move the clashing note to a chord tone: E, G, B or D ✓ · add more reverb. *Why:* the clash is a pitch problem, so fix the pitch; volume and reverb only make it louder or blurrier.
9. **listen.** "Hear the hook with and without the delay send." `instance: analog-four`; A = T4 AMP DEL 0, B = T4 AMP DEL 70 (with the FX delay at a dotted 8th).
   - Question: What does the delay add?
     - Echoes that fill the gaps between notes ✓
     - More bass
     - A faster tempo
   - Why: Each echo arrives three 16ths later and lands in the spaces of the three-step rhythm. Delay is covered properly in L9.
10. **match.** "Recreate the hook's tone by ear: FILTER 1 FREQ and ENV F DEC." Controls: T4 FILTER 1 FREQ, T4 ENV F DEC. Target FREQ 78, DEC 26 from FREQ 50, DEC 60.
    - Hints: "Brighter or darker? Longer or shorter pluck?" → "Brighter, and a snappier pluck."
11. **challenge.** "Write your own two-bar hook."
    - Checklist:
      - 4–8 notes in bars 1–2 of track 4
      - Every note in A minor pentatonic: `pc in {9, 0, 2, 4, 7}`
      - Every note A4 or higher (above the chords)
      - Bar 2 reuses at least two of bar 1's rhythm positions
      - At least one gap of 2 steps or more
    - Hints: "Sing a short phrase first, then find it." → "Use the three-step rhythm and change only the ending." → "Leave step 1 empty so the kick speaks."
    - Solution: Demo 1 hook bars 1–2 — E5, D5, C5, A4, C5 on steps 3, 6, 9, 12, 15; then E5, D5, C5, D5, E5 on 19, 22, 25, 28, 31.
12. **reflect.** Prompt: What makes a hook memorable? Model: A short idea repeated with a small change, in its own register, using notes that fit the chords, with space around it.
13. **info, optional.** "Want to share your loop already? Press REC, play eight bars, stop and save the WAV."

**Review**

1. A minor pentatonic is… — A B C D E F G · A C D E G ✓ · A C# E. *Why:* five notes of A minor with no semitone steps.
2. A chord tone on a strong beat sounds… — stable ✓ · clashing · quieter. *Why:* it belongs to the chord underneath.
3. Why keep a hook above the chords? — so the parts don't mask each other ✓ · so it is louder · so it stays in key. *Why:* separate registers stay clear.
4. A rhythm repeating every three steps over a four-beat bar creates… — a slower tempo · a cross-rhythm ✓ · a chord. *Why:* three-step groups shift against the beat.
5. Most hooks are… — 30 or more notes · one long note · 3–6 notes repeated with a variation ✓. *Why:* short ideas are easy to remember.

**Go further.** Play the hook live on the Sub 37 with its "Sync Lead"-style patch, or add a counter-line on the Mother-32 an octave below. Keep the counter-line rhythm in the hook's gaps.


---

### L7 · Frequency slots

`prod-07-frequency-slots` · intermediate · 16 min · concepts: equalization, filter-cutoff, mixing

| | |
|---|---|
| **Objective** | Give every part its own frequency slot: kick and bass share the lows by design, and everything else is high-passed out of their way. |
| **Prerequisites** | L6 |
| **Instruments** | Xone:96 channel EQ, Analog Four FILTER 2, Analog Rytm FLTR, the studio spectrum |
| **Start** | CP-07, the "muddy mix": A4 T2–T4 FILTER 2 set to LP2 fully open (no high-pass), Rytm CP, CH and OH filters LP2 open, Xone ch 2 LO MID +3 dB. Learners on their own track get the same changes applied, with an undo |
| **Hook** | Demo 1, bars 17–20, as made, then with every high-pass removed |

**Steps**

1. **listen, hook.** "Same parts, same levels. One mix is clear, one is muddy." A = Demo 1 as made; B = high-passes removed. (Needs a demo-level A/B; see §7.)
   - Question: What makes B muddy?
     - The tempo is slower
     - Too many parts piled up in the low end ✓
     - The hook is too loud
   - Why: In B the stabs, hook, clap and hats all keep their lows, which pile onto the kick and bass. Tempo and the hook's level are identical.
2. **quiz, warm-up (L6).** Why keep a hook above the chords? — so they don't mask each other ✓ · so it is louder · so it stays in key. *Why:* separate registers stay clear.
3. **info.** "Watch the spectrum while the loop plays: every sound lives somewhere between 20 Hz and 20 kHz."
   - Principle: Sounds that share a frequency range compete; the louder one hides the quieter one.
   - Explanation: A rough map: sub 20–60 Hz, bass 60–250 Hz, low mids 250–500 Hz, mids 500 Hz–2 kHz, presence 2–6 kHz, air above. When two sounds share a range the louder one hides the quieter one, which is called *masking*. You fix it by giving each part a range where it is the main thing.
4. **do, first win.** "On A4 TRACK 2 and TRACK 3, set FILTER 2 TYPE to HP2 and FREQ to about 32 (about 120 Hz)."
   - Check: `[2,3].every(t => val(a4,`T${t} FILTER 2 TYPE`) === 'HP2' && between(val(a4,`T${t} FILTER 2 FREQ`), 24, 44))`
   - Principle: A high-pass filter removes lows a part doesn't need, leaving room for kick and bass.
5. **predict.** "Do the same on TRACK 4, the hook, at about 50 (about 300 Hz)."
   - Question: Played alone, the high-passed hook will sound…
     - Thinner on its own, but in the full mix the low end gets clearer and you barely miss it ✓
     - Completely different and unusable
     - Louder
   - Why: Solo, a high-passed part loses weight. In the mix the kick and bass supply the weight, and the hook is heard by its mids and highs. Judge EQ in the mix, not in solo.
   - Check: `['HP1','HP2'].includes(val(a4,'T4 FILTER 2 TYPE')) && val(a4,'T4 FILTER 2 FREQ') >= 40`
6. **do.** "On the Rytm, set CH and OH to FLTR TYPE HP2, FREQ about 58, and CP to HP2, FREQ about 41."
   - Check: CH, OH and CP use a high-pass type (HP1/HP2) with FREQ ≥ 36
   - Explanation: FREQ 58 is about 400 Hz and 41 about 150 Hz.
   - Principle: Hats and claps are heard by their highs; their lows only add mud.
7. **listen.** "Hear a low-mid cut on the synth channel." `instance: xone96`; A = ch 2 LO MID 0 dB, B = ch 2 LO MID −6 dB.
   - Question: Which sounds clearer and less boxy?
     - A
     - B ✓
   - Why: 350 Hz is where stacked chords, bass harmonics and the hook's body overlap. A small cut there opens the mix without making any part sound thin.
8. **do.** "On Xone channel 2, cut LO MID by about 3 dB."
   - Check: `between(xv(s,'2','LO MID'), -6, -1.5)`
   - Principle: Small cuts where parts overlap clear a mix more naturally than big boosts.
9. **quiz.** Kick and bass both live below 120 Hz. Which plan is best? — boost both with LO · high-pass the kick at 200 Hz · decide who owns the deepest lows and keep the other short or higher ✓. *Why:* boosting both adds mud, and a 200 Hz high-pass removes the kick's punch. Your kick owns the 50–60 Hz thump on the beat; the bass owns the off-beats (L3).
10. **info.** "Watch the spectrum on a kick hit, then on a bass note."
    - Explanation: The kick peaks around 55 Hz on the beat; the bass peaks around 55 Hz between beats. They share the frequency by taking turns in time.
11. **match.** "A mystery EQ is on channel 2. Recreate it by ear: LO MID and HI MID." `instance: xone96`, controls: ch 2 LO MID, ch 2 HI MID. Target LO MID −11 dB, HI MID +4.5 dB, from 0 / 0.
    - Hints: "One band is cut, one boosted." → "The boxiness is gone and the stabs bite more." → "LO MID well down, HI MID a little up."
12. **challenge.** "Clean up the rest of the muddy mix: only kick and bass keep their deep lows."
    - Checklist:
      - A4 tracks 2, 3 and 4 high-passed: FILTER 2 TYPE HP1 or HP2 and FREQ ≥ 24
      - A4 track 1 not high-passed above about 40 Hz: FILTER 2 FREQ ≤ 12 or a low-pass type
      - Rytm CH, OH and CP high-passed
      - Rytm BD filter open: FLTR TYPE LP with FREQ ≥ 100, or the filter fully open
      - Xone ch 2 LO MID ≤ −1.5 dB, and neither channel's LO boosted above +1 dB
    - Hints: "Ask each part: does it need anything below 150 Hz?" → "Only kick and bass do." → "Use FILTER 2 on the A4 tracks and FLTR on the Rytm hats and clap."
    - Solution: CP-08 settings (T2/T3 HP2 FREQ 32, T4 HP1 FREQ 50, T1 HP2 FREQ 8; Rytm CH/OH HP2 58, CP HP2 41; Xone ch 2 LO MID −3 dB).
13. **reflect.** Prompt: Why judge EQ in the full mix rather than solo? Model: Masking only happens between parts. A sound that seems thin alone can be right in context, where other parts supply the lows.

**Review**

1. A high-pass filter… — removes highs · removes lows below its cutoff ✓ · boosts bass. *Why:* it lets the highs pass.
2. Which parts usually keep their deepest lows? — kick and bass ✓ · hi-hats · the hook. *Why:* they carry the low end.
3. Masking means… — a stereo effect · one sound hiding another in the same range ✓ · a mute button. *Why:* the louder sound covers the quieter one.
4. The Xone:96's LO MID band sits at about… — 50 Hz · 350 Hz ✓ · 3 kHz. *Why:* LO is 180 Hz, LO MID 350 Hz, HI MID 1.1 kHz, HI 3 kHz.
5. A good first EQ move is usually… — a big boost · boosting everything · a small cut where parts overlap ✓. *Why:* cuts remove the clash instead of adding level.

**Go further.** The Xone's LO is a shelf at 180 Hz that can kill fully. DJs use it to swap basslines between two tracks; try killing ch 2 LO for 8 bars of your loop and bringing it back on a bar line.

---

### L8 · Movement

`prod-08-movement` · intermediate · 16 min · concepts: parameter-locks, lfo, sequencer-pattern

| | |
|---|---|
| **Objective** | Make a loop evolve without adding parts: parameter locks, trig conditions and a slow LFO. |
| **Prerequisites** | L5 (L7 recommended) |
| **Instruments** | Analog Four (stabs), Analog Rytm (hats, snare) |
| **Start** | Learner's track or CP-08 |
| **Hook** | Demo 1, bars 17–24: the same loop, never exactly the same twice |

**Steps**

1. **info, hook (autoplay 12 s).** "Eight bars of the same loop. Listen for the small changes that keep it alive."
   - Principle: The ear tires of exact repetition; small changes every few bars hold attention.
2. **quiz, warm-up (L7).** A high-pass filter removes… — highs · lows below the cutoff ✓ · the middle. *Why:* highs pass through.
3. **do, first win.** "Hold A4 TRACK 2 trig 11 and turn FILTER 1 FREQ up by about 20. Do the same on TRACK 3."
   - Check: `locks(s,'analog-four',2,'FILTER 1 FREQ').includes(11) && locks(s,'analog-four',3,'FILTER 1 FREQ').includes(11)`, each lock ≥ the track value + 10
   - Principle: A parameter lock changes a sound for one step only, so a loop varies without new notes.
   - Explanation: Holding a trig while you turn a knob stores the new value on that trig alone. The next trig goes back to the track's own setting.
4. **predict.** "Hold Rytm CH trig 16 and set its condition (TRC) to 1:2."
   - Question: What will trig 16 do now?
     - Play half as loud
     - Play on the first of every two loops ✓
     - Play at half speed
   - Why: A:B conditions count loops of the pattern: 1:2 plays on loops 1, 3, 5… Loudness is velocity; speed is the pattern's scale.
   - Check: `step(rytm,'CH',16).cond === '1:2'`
5. **do.** "Add a fill at the end of every four bars: SD trigs on 14, 15 and 16, each with condition 4:4."
   - Check: `[14,15,16].every(n => step(rytm,'SD',n)?.cond === '4:4')`
   - Principle: Changes on the fourth or eighth bar mark the end of a phrase, which the ear expects.
6. **quiz.** Which condition plays only on the fourth bar of every four? — 1:4 · 4:4 ✓ · 4:1. *Why:* A:B means "loop A of every B". 1:4 is the first bar of each four; 4:1 isn't a valid setting.
7. **do.** "On A4 TRACK 2 open LFO 1: DEST F1 FRQ, DEPTH about +12, SPD 8, MUL 1. Copy the settings to TRACK 3."
   - Check: tracks 2 and 3: LFO 1 destination is FILTER 1 FREQ, |depth| ≥ 6, and SPD × MUL ≤ 32 (a cycle of 4 bars or longer)
   - Principle: A slow LFO moves a sound over many bars, so a loop breathes on its own.
   - Explanation: An *LFO* (low-frequency oscillator) is a slow wave that moves a knob for you. On the A4, SPD × MUL = 128 is about one cycle per bar, so 8 × 1 takes about 16 bars.
8. **listen.** "Hear the LFO, sped up so it is easy to notice." `instance: analog-four`; A = T2 LFO 1 DEPTH 0; B = DEPTH +24 with SPD 32 (one cycle every 4 bars).
   - Question: What is moving in B?
     - The pitch of the chords
     - The brightness of the chords, slowly up and down ✓
     - The tempo
   - Why: The LFO is routed to the filter, so only the tone changes. Pitch would need an oscillator TUN destination.
9. **predict.** "Hold Rytm SD trig 13 and set its condition to FILL. Then hold the FILL key."
   - Question: When does the snare on step 13 play now?
     - Only while FILL is held or latched ✓
     - Every fourth bar
     - Never
   - Why: FILL is true only while fill mode is on, so you can perform fills by hand without changing the pattern.
   - Check: `step(rytm,'SD',13).cond === 'FILL'`
10. **match.** "Match the filter movement by ear: TRACK 2 LFO 1 DEPTH." Controls: T2 LFO 1 DEPTH A. Target +30 from 0 (24 % of travel), with SPD 32 so a full cycle fits in the test.
    - Hints: "More or less movement than yours?" → "More: the chords open and close clearly."
11. **challenge.** "Make eight bars that never repeat exactly, without adding new trigs for new parts."
    - Checklist:
      - At least 2 parameter locks across the A4 and Rytm patterns in use
      - At least 2 trigs with a trig condition (A:B, %, FILL, PRE, NEI or 1ST)
      - At least 1 track with an LFO destination and a non-zero depth
      - No new tracks used compared with the start (same tracks hold trigs)
    - Hints: "Use one tool for one-step accents, one for every few bars, one for slow change." → "Lock a brighter filter on the last stab of each bar; put a 1:2 or 3:4 on a hat; add the slow filter LFO." → "Try a 50 % condition on a ghost hat for variation that never repeats."
    - Solution: locks on T2/T3 trig 11 (FILTER 1 FREQ +20); CH 16 = 1:2; SD 14–16 = 4:4; T2/T3 LFO 1 → F1 FRQ, DEPTH +12, SPD 8, MUL 1.
12. **reflect.** Prompt: Name three ways to make a loop change over time on an Elektron, and when to use each. Model: Parameter locks for one-step accents, trig conditions for changes every few bars, and an LFO for slow continuous movement.

**Review**

1. A parameter lock affects… — the whole track · only the trig it is on ✓ · every pattern. *Why:* the next trig reverts it.
2. Condition 1:2 plays… — on the first of every two loops ✓ · half as loud · at half speed. *Why:* A:B counts loops.
3. Condition 4:4 suits… — the first beat · random hits · fills on the last bar of a four-bar phrase ✓. *Why:* it fires on loop 4 of every 4.
4. A slow LFO is best for… — gradual movement over many bars ✓ · a single accent · changing the tempo. *Why:* it moves continuously.
5. A trig with the FILL condition plays… — every bar · never · only while FILL is active ✓. *Why:* the condition is true in fill mode only.

**Go further.** Trig conditions NEI and PRE make tracks answer each other: give the CP a 50 % trig, then a RS trig with NEI. The rim plays only when the clap before it did.

---

### L9 · Space and depth

`prod-09-space-depth` · intermediate · 18 min · concepts: effects, mixing, timing-tempo

| | |
|---|---|
| **Objective** | Place sounds front to back: a tempo-synced delay for echoes, a reverb with pre-delay for depth, and dry parts up front. |
| **Prerequisites** | L7 |
| **Instruments** | Analog Four FX track (chorus, delay, reverb), Analog Rytm FX track, Xone:96 SEND 1 / SEND 2 with returns on channels A and B |
| **Start** | Learner's track or CP-09 (all sends at 0) |
| **Hook** | Demo 1, bars 33–36 (the break: pads and the hook in the space) |

**Steps**

1. **info, hook (autoplay 10 s).** "The break sounds big and far away; the drop sounds close and dry. That difference is effects used on purpose."
2. **quiz, warm-up (L8).** A parameter lock changes… — only the trig it is on ✓ · the whole pattern · the tempo. *Why:* locks belong to one trig.
3. **info.** "Open the AMP page on any A4 track and find the CHO, DEL and REV sends."
   - Explanation: A *send* copies some of a sound to an effect; the effect's output, the *return*, is mixed back in. The original stays dry, so you control how much echo or room each part gets.
   - Principle: Sends add an effect alongside the dry sound, so one effect can serve many parts.
4. **do, first win.** "On A4 TRACK 4 (the hook), turn the AMP page DEL send to about 70."
   - Check: `val(a4,'T4 AMP DEL') >= 50`
   - Principle: Echoes in the gaps make a sparse part feel fuller without more notes.
5. **predict.** "On the A4 FX track, set the DELAY TIM to 24."
   - Question: TIM counts 128th notes, so 24 is a dotted 8th. At 124 BPM, how long is that?
     - About 121 ms
     - About 363 ms ✓
     - About 1 second
   - Why: One beat is 60 000 ÷ 124 ≈ 484 ms. An 8th is half that, 242 ms, and dotted adds half again: 363 ms. 121 ms is a 16th.
   - Check: `val(a4,'FX DELAY TIM') === 24`
6. **do.** "Set the delay FB to about 50 and HPF to about 40, so echoes fade and stay out of the bass."
   - Check: `between(val(a4,'FX DELAY FB'), 35, 70) && val(a4,'FX DELAY HPF') >= 25`
   - Principle: Filtering echoes keeps them behind the dry sound and out of the low end.
   - Explanation: FB (feedback) sets how many repeats you hear. The delay's high-pass keeps echoes from piling onto the bass.
7. **do.** "Send the stabs to the reverb: TRACK 2 and TRACK 3 REV about 45. Set the REVERB PRE to about 15."
   - Check: `[2,3].every(t => val(a4,`T${t} AMP REV`) >= 30) && val(a4,'FX REVERB PRE') >= 8`
   - Principle: Pre-delay holds the reverb back a moment, so the dry attack stays clear in front.
8. **listen.** "Compare reverb pre-delay." `instance: analog-four`; A = FX REVERB PRE 0, B = PRE 30.
   - Question: Which keeps the stab's attack clearer?
     - A
     - B ✓
   - Why: With pre-delay the room starts a few milliseconds after the hit, so the ear hears the attack first and the space after it.
9. **quiz.** Which parts usually stay dry, with little or no reverb? — pads · hook echoes · kick and bass ✓. *Why:* reverb on low sounds smears the low end and blurs the groove; keep them dry and centred and put space on the higher parts.
10. **do.** "On the Xone, set the FX DELAY to 3/16 and raise channel A, the delay return, to about 5."
    - Check: `val(xone,'DELAY') === '3/16' && xv(s,'a','FADER') >= 4`
    - Explanation: SEND 1 feeds the Xone's delay and returns on channel A; SEND 2 feeds the reverb and returns on channel B. Use them for whole-channel moves, such as a dub throw: turn SND 1 up for one beat at the end of a phrase.
11. **match.** "Recreate the depth by ear: TRACK 2 REV send and REVERB DEC." Controls: T2 AMP REV, FX REVERB DEC. Target REV 92, DEC 104 from REV 20, DEC 50.
    - Hints: "Closer or further away than yours?" → "Further: more reverb, and a longer tail."
12. **challenge.** "Create three depths: one part dry and close, one in the middle with delay, one far back in the reverb. Keep kick and bass dry."
    - Checklist:
      - Rytm BD DEL and REV sends = 0; A4 T1 DEL and REV ≤ 10
      - At least one A4 track with DEL ≥ 40
      - At least one A4 track with REV ≥ 60
      - Reverb PRE ≥ 5 and delay HPF ≥ 25
    - Hints: "Front means dry, loud and bright; back means wet, quiet and darker." → "Hook in the delay, stabs in the reverb, bass dry." → "Lower the reverb's LPF to push the tail further back."
    - Solution: T4 DEL 70, REV 50; T2/T3 DEL 60, REV 45; T1 dry; FX DELAY TIM 24, FB 52, HPF 40; REVERB PRE 14, DEC 82, LPF 76.
13. **reflect.** Prompt: How do you push a sound further back in a mix? Model: Send more of it to the reverb, make it a little quieter and darker, and keep pre-delay so the parts in front stay clear.

**Review**

1. A dotted-8th delay at 124 BPM is about… — 242 ms · 363 ms ✓ · 484 ms. *Why:* an 8th (242 ms) plus half of it.
2. Reverb pre-delay… — delays the start of the reverb, keeping the attack clear ✓ · lengthens the tail · removes bass. *Why:* it is a gap before the room.
3. A send is… — a mute · a copy of a channel sent to an effect ✓ · an EQ band. *Why:* the dry sound stays as it is.
4. To push a sound back you… — make it louder and brighter · add reverb, lower it a little and darken it ✓ · pan it to the centre. *Why:* distance sounds wetter, quieter and duller.
5. Why high-pass a delay or reverb? — to keep echoes out of the low end ✓ · to make it louder · to change the tempo. *Why:* low echoes muddy the kick and bass.

**Go further.** On the Rytm FX track, set the compressor's SEQ (sidechain EQ) to LPF: it reacts mostly to the kick, so the whole kit pumps gently around each beat (Rytm MKII manual p.83).


---

### L10 · Ear lab: what changed?

`prod-10-ear-lab` · intermediate · 10 min · concepts: filter-cutoff, envelope-decay, effects, equalization, timing-tempo

| | |
|---|---|
| **Objective** | Tell apart, by ear, changes in swing, filter, note length, sends and EQ, and put each one right. |
| **Prerequisites** | L9 |
| **Instruments** | Analog Rytm, Analog Four, Xone:96 |
| **Start** | Learner's track or CP-09 (each step sets only the controls it tests) |
| **Hook** | none: the first round starts at once |

This is the mid-path checkpoint. Rounds mix lessons 2, 3, 7 and 9 on purpose (interleaving): the
learner has to decide *which* tool changed before fixing it. The match feedback ladder from
PEDAGOGY.md applies (count, then control, then direction; "show me" after four tries).

**Steps**

1. **info.** "Five quick rounds. Each changes one thing you have learned. Name it first, then fix it."
2. **listen.** `instance: analog-four`; A = T2 FILTER 1 FREQ 60, B = 40.
   - Question: What changed between A and B?
     - Note length
     - Filter brightness ✓
     - Swing
     - Reverb send
   - Why: B is darker but just as long and in the same place in time; that is the cutoff moving down.
3. **listen.** `instance: analog-rytm`; A = SWING 50 %, B = SWING 60 %.
   - Question: What changed?
     - Reverb
     - Volume
     - Swing ✓
   - Why: The hats between beats arrive later in B; nothing got louder or wetter.
4. **listen.** `instance: analog-four`; A = T1 AMP DEC 40, B = AMP DEC 90.
   - Question: What changed in the bass?
     - Note length ✓
     - Filter
     - Pitch
   - Why: B rings on into the next kick. Same pitch and tone, longer tail.
5. **listen.** `instance: analog-four`; A = T4 AMP DEL 0, B = AMP DEL 70.
   - Question: What changed on the hook?
     - Reverb send
     - Delay send ✓
     - Chorus
   - Why: B repeats in rhythm (distinct echoes). Reverb would be a smooth wash without repeats.
6. **listen.** `instance: xone96`; A = ch 2 LO MID 0 dB, B = ch 2 LO MID −10 dB.
   - Question: What changed on the synth channel?
     - A high cut
     - The fader
     - A low-mid cut ✓
   - Why: B lost boxiness but kept its bass and its highs; a fader change would move everything equally.
7. **match.** "Two changes this time: put TRACK 2 back by ear." Controls: T2 FILTER 1 FREQ and T2 AMP REV. Target FREQ 74, REV 80 from FREQ 50, REV 20.
   - Hints: "One control is tone, one is space." → "It is brighter and further away."
8. **match.** "Three changes on the hook." Controls: T4 FILTER 1 FREQ, T4 ENV F DEC, T4 AMP DEL. Target 84 / 24 / 76 from 60 / 50 / 20.
   - Hints: "Listen to brightness, then pluck length, then echoes, one at a time." → "Brighter, snappier, more echo."
9. **quiz.** A part sounds muddy and far away at the same time. Which change helps most? — boost LO and add reverb · raise the swing · high-pass it and lower its reverb send ✓. *Why:* mud is low-end build-up and distance is reverb; boosting LO and adding reverb makes both worse.
10. **reflect.** Prompt: Which change was hardest to hear, and what will you listen for next time? Model: For example: "Swing was hardest; next time I'll listen to the hats between the beats, not the kick."

**Review**

1. A sound gets darker and duller. Most likely… — a longer release · the filter cutoff came down ✓ · more swing. *Why:* the cutoff removes upper harmonics.
2. The groove starts to lope but the tempo stays the same… — the swing went up ✓ · the delay feedback went up · the kick got shorter. *Why:* swing moves every second 16th.
3. A part sounds further away… — more reverb send ✓ · more high-pass · a shorter decay. *Why:* distance is mostly reflections.
4. The low mids sound boxy. Try… — boosting 3 kHz · raising the master · cutting around 350 Hz ✓. *Why:* boxiness lives in the low mids.

---

### L11 · Arrangement

`prod-11-arrangement` · intermediate · 22 min · concepts: sequencer-pattern, mixing

| | |
|---|---|
| **Objective** | Turn your loop into a two-minute arrangement (intro, drop, break, build, drop, outro) in 8- and 16-bar phrases, with energy that rises and falls. |
| **Prerequisites** | L8 (L9 recommended). Replaces the existing `studio-5-arrange-and-bounce` in this path |
| **Instruments** | Song arranger, Analog Rytm patterns, Analog Four patterns |
| **Start** | CP-11: Rytm A01 intro drums, A02 full drums, A03 break drums (no kick); A4 A01 bass only, A02 full, A03 break pads with the hook; arranger empty. Learners on their own track first make these variations (steps 5a–5b) |
| **Hook** | Demo 1, bars 29–36 (the end of drop 1 falling into the break) |

**Steps**

1. **info, hook (autoplay 14 s).** "A loop becomes a song when it changes over time. Hear the energy fall away at the break."
2. **quiz, warm-up (L9).** Which parts usually stay dry? — pads · kick and bass ✓ · hook echoes. *Why:* reverb on low sounds smears the groove.
3. **info.** "Think of your track as a line of energy that rises and falls."
   - Explanation: *Energy* is how many parts play, how loud, how bright and how busy. An *arrangement* is a plan for energy over time: sections that add, remove and swap parts.
   - Principle: Listeners feel structure through contrast; what leaves and returns matters more than what stays.
4. **do, first win.** "Open the Song arranger. Add two sections: Intro, 8 bars, and Drop, 16 bars. Tick Song mode and press ▶."
   - Check: `s.arrangement.sections.length >= 2 && [8,16].includes(sections[0].bars) && [8,16].includes(sections[1].bars) && s.arrangement.enabled && s.transport.playing`
5. **predict.** "In the Intro, tick mute for the Analog Four."
   - Question: Muting the bass and chords in the Intro will make the Drop feel…
     - Smaller, because the intro is quieter
     - Bigger, because they arrive ✓
     - The same
   - Why: Energy is relative. Holding parts back and bringing them in on a bar line is the oldest trick in dance music.
   - Check: `part(s, s.arrangement.sections[0], 'analog-four')?.muted === true`
   - 5a (own track only). **do.** "In the Rytm PATTERN menu, copy A01 to A02. In A01, clear the CP and OH tracks: your intro drums." Check: Rytm A02 has CP trigs; A01 has BD trigs and no CP trigs.
   - 5b (own track only). **do.** "Copy A02 to A03 and clear the BD track in A03: your break drums." Check: A03 has trigs but none on BD.
6. **do.** "Set the patterns: Intro uses Rytm A01. Drop uses Rytm A02 and A4 A02."
   - Check: `part(intro,'analog-rytm').pattern === 'A01' && part(drop,'analog-rytm').pattern === 'A02' && part(drop,'analog-four').pattern === 'A02'`
   - Principle: Sections switch on bar lines, so every change lands on the downbeat.
7. **info.** "Plan your changes on multiples of 8 bars."
   - Explanation: Dance music moves in *phrases* of 8 and 16 bars, and listeners count them without knowing it. DJs also like 8–16 bars of drums at the start and end to mix in and out.
8. **quiz.** At 124 BPM, how long is a 16-bar section? — about 16 seconds · about 31 seconds ✓ · about 2 minutes. *Why:* 16 bars × 4 beats = 64 beats; 64 × 60 ÷ 124 ≈ 31 s. "16 seconds" confuses bars with seconds.
9. **do.** "Add an 8-bar Break: Rytm A03 (no kick) and A4 A03 (pads and hook)."
   - Check: some section with `bars === 8` whose Rytm pattern has no BD trigs (or whose Rytm part is muted)
   - Principle: Removing the kick and bass resets the listener's ears, so their return feels huge.
10. **do.** "Add Build (8 bars), Drop 2 (16 bars) and Outro (16 bars, drums only)."
    - Check: `sections.length >= 6` and the last section mutes the A4 or uses an A4 pattern with only track 1 trigs
11. **predict.** "Press '▶ from here' on the Break and listen through to Drop 2."
    - Question: What makes the moment Drop 2 arrives hit hardest?
      - The tempo speeds up
      - The kick and bass return together on the downbeat after being away ✓
      - The chords change key
    - Why: The release comes from contrast: the low end was missing for 16 bars and returns on beat 1. Tempo and key stay the same.
12. **challenge.** "Build a two-minute arrangement with a clear energy curve."
    - Checklist:
      - At least 6 sections
      - Every section is 4, 8, 16 or 32 bars
      - At least 1:55 long: `totalBars * 240 / s.transport.bpm >= 115`
      - The first section has no A4 (muted) or bass only
      - A break: a section whose Rytm pattern has no BD trigs, or with the Rytm muted
      - At least two sections use the full patterns (the drops)
      - The last section has fewer parts than the drops (A4 muted or fewer tracks with trigs)
    - Hints: "Draw the energy as a line first: low, rising, high, low, rising, highest, falling." → "Intro 8 · Groove 8 · Drop 16 · Break 8 · Build 8 · Drop 16 · Outro 16 = 80 bars, about 2:35." → "Give Drop 2 one thing Drop 1 didn't have, like the hook or a ride cymbal."
    - Solution: the CP-12 arrangement — Intro 8 (Rytm A01, A4 muted), Groove 8 (A02 / A01), Drop 16 (A02 / A02), Break 8 (A03 / A03), Build 8 (A02 / A01), Drop 2 16 (A02 / A02), Outro 16 (A01, A4 muted).
13. **reflect.** Prompt: What makes the second drop feel bigger than the first? Model: The break takes the kick and bass away, so their return is a release, and the second drop adds one new element so it is the peak.

**Review**

1. A 16-bar section at 124 BPM lasts about… — 16 s · 31 s ✓ · 64 s. *Why:* 64 beats at 124 per minute.
2. DJ-friendly intros usually start with… — the full mix · the hook alone · drums only ✓. *Why:* simple drums are easy to mix over.
3. Section changes feel natural on… — any bar · every 3 bars · multiples of 8 bars ✓. *Why:* dance music phrases in 8s and 16s.
4. A drop hits hardest when… — the kick and bass return on the downbeat after a break ✓ · everything always plays · the tempo rises. *Why:* contrast.
5. Muting a part in the intro… — makes its arrival in the drop more noticeable ✓ · deletes it · changes its pattern. *Why:* the ear notices what arrives.

---

### L12 · Transitions

`prod-12-transitions` · intermediate to advanced · 18 min · concepts: sequencer-pattern, parameter-locks, filter-cutoff

| | |
|---|---|
| **Objective** | Glue sections together with fills, retrigs, a riser, a filter sweep and a gap before the drop. |
| **Prerequisites** | L11 (L8 for trig conditions) |
| **Instruments** | Analog Rytm (snare roll, retrigs), Analog Four track 4 (noise riser with parameter slide), Xone:96 FILTER 1, arranger snapshots |
| **Start** | CP-12: the arrangement from L11 plus a 64-step Rytm A05 BUILD (kick, clap and hats in all 4 bars) and an empty A4 A05. The Build section uses Rytm A05 and A4 A05 |
| **Hook** | Demo 1, bars 45–49: the last four bars of the build into Drop 2 |

**Steps**

1. **info, hook (autoplay 10 s).** "Listen to how the last bars of the build tell you the drop is coming: rising, thinning, then a breath."
2. **quiz, warm-up (L11).** Section changes feel natural on… — any bar · multiples of 8 bars ✓ · every 3 bars. *Why:* phrases.
3. **info.** "Listen for three signals that a change is coming."
   - Explanation: A *transition* tells the listener a change is near. The classic signals are more notes and more volume, rising pitch or brightness, and a short silence just before the change.
4. **do, first win.** "In Rytm pattern A05, put SD trigs on 61, 62, 63 and 64 with rising VEL: about 70, 85, 100, 115."
   - Check: `trigs(rytm,'SD','A05') ⊇ {61,62,63,64}`, velocities non-decreasing, the last ≥ 100
   - Principle: Rising density and loudness at the end of a phrase tells the listener something is coming.
5. **predict.** "Hold SD trig 64. Turn RETRIG on with RATE 1/32 and a rising velocity curve."
   - Question: What will step 64 sound like?
     - One longer snare
     - A fast roll of hits inside one step ✓
     - Silence
   - Why: A retrig repeats the hit within the step; 1/32 means two hits per 16th, and the curve makes them rise. Length is LEN; nothing is muted.
   - Check: `step(rytm,'SD',64,'A05').retrig !== undefined`
6. **do.** "Remove the kicks from the last bar of A05, steps 49–64."
   - Check: `!trigs(rytm,'BD','A05').some(n => n >= 49)`
   - Principle: A short silence before the drop makes the returning kick feel louder by contrast.
7. **do.** "In A4 pattern A05, TRACK 4, tap trig 1, set LEN 64, and lock NOISE LEV 110, OSC 1 LEV 0, FILTER 1 FREQ 30."
   - Check: `trigs(a4,4,'A05').includes(1)` and step 1 locks NOISE LEV ≥ 90, OSC 1 LEV ≤ 10, FILTER 1 FREQ ≤ 40
   - Explanation: These locks turn the hook's sound into filtered white noise for this one trig. That is the raw material of a *riser*, a sound that climbs into the drop.
8. **predict.** "Add a lock trig on step 64 with FILTER 1 FREQ 120. Then hold trig 1 and press [BANK H] for PARAMETER SLIDE."
   - Question: What will you hear across the four bars?
     - Noise that jumps bright on the last step
     - Noise that slowly gets brighter all the way into the drop ✓
     - A falling pitch
   - Why: Parameter slide glides every locked value from one trig to the next, so the filter opens over the whole build instead of jumping at step 64 (A4 MKII manual p.53).
   - Check: `step(a4,4,1,'A05').pslide && (locks(a4,4,'FILTER 1 FREQ','A05').includes(64))` with the step-64 value ≥ 100
9. **listen.** "Hear the build with and without the riser." `instance: analog-four`; A = T4 AMP VOL 0, B = T4 AMP VOL as set.
   - Question: What does the riser do to the drop?
     - Makes it quieter
     - Makes its arrival feel expected and bigger ✓
     - Changes the key
   - Why: Rising brightness creates tension; the drop resolves it. Noise has no pitch, so the key is untouched.
10. **quiz.** Why leave a short gap just before the drop? — to rest the CPU · silence makes the returning kick hit harder by contrast ✓ · to change the tempo. *Why:* the ear measures loudness against what came just before.
11. **do.** "Assign Xone channel 1 to FILTER 1 (HPF, RES about 5, FREQ about 150 Hz) and capture it as the Build section's snapshot."
    - Check: `sec(s,'Build').parts[inst(s,'xone96')].snapshot` sets ch 1 FILTER = 1, FILTER 1 TYPE = HPF, FREQ 100–400 Hz
    - Principle: Taking the low end away before a drop builds tension; giving it back releases it.
12. **do.** "Capture a Xone snapshot for Drop 2 with channel 1 FILTER OFF."
    - Check: `sec(s,'Drop 2').parts[xone].snapshot` sets ch 1 FILTER = OFF
    - Explanation: Snapshots apply on the section's first beat, so the drums snap back to full exactly on the drop. A live sweep (turning FREQ up by hand through the build) works too: the snapshot then resets it for you.
13. **match.** "Match the swept build sound by ear: FILTER 1 FREQ and RES." `instance: xone96`. Target FREQ 1.2 kHz, RES 6 from 200 Hz, RES 2.
    - Hints: "Thinner or fuller than yours?" → "Much thinner, with a whistle at the cutoff."
14. **challenge.** "Announce at least three section changes in your track."
    - Checklist:
      - A fill: a Rytm trig with FILL, 4:4 or 8:8 in a pattern used just before a section change
      - A retrig in the build pattern
      - A riser (an A4 trig with parameter slide) or an Xone filter snapshot in the build
      - A gap: the build pattern's kick stops at least one beat before its end
      - The drop puts things back: an Xone snapshot with FILTER OFF, or no filter assignment
    - Hints: "Look at the last bar before each section starts." → "Fills on the intro's last bar, a riser into each drop, a gap before Drop 2." → "Copy A05's last bar into A01 as a small fill with condition 8:8."
    - Solution: Demo 1 Build B (Rytm A06 and A4 A05 in `demo-tracks.md`), plus SD 14–16 with 8:8 in the intro pattern.
15. **reflect.** Prompt: Pick one transition in your track. What tension did you build and how was it released? Model: For example: "The riser and the high-pass thinned and brightened the build, the last beat was silent, and the drop gave back the kick and bass on beat one."

**Review**

1. A retrig on a trig plays… — a longer note · fast repeated hits within that step ✓ · a different sound. *Why:* it re-triggers the sound inside the step.
2. A parameter slide… — glides a locked value to the next trig's value ✓ · slides pitch only · plays the pattern backwards. *Why:* it moves locked parameters between trigs.
3. The classic pre-drop move is… — a tempo drop · more reverb on the kick · a short gap of silence ✓. *Why:* contrast makes the return louder.
4. A high-pass sweep up during a build… — adds bass · removes more and more low end, building tension ✓ · shortens the pattern. *Why:* the low end leaves and returns at the drop.
5. Snapshots in the arranger apply… — gradually across the section · on the section's first beat ✓ · only while you hold a key. *Why:* sections switch on bar lines.


---

### L13 · Mixdown

`prod-13-mixdown` · advanced · 22 min · concepts: gain-staging, mixing, equalization

| | |
|---|---|
| **Objective** | Mix the track: gain-stage every channel, balance the parts against the kick, pan for width, check in mono, and leave about 6 dB of headroom for mastering. |
| **Prerequisites** | L12 (L7 and L9). Replaces `studio-4-into-the-mixer` in this path |
| **Instruments** | Xone:96 (GAIN, faders, channel meters, BOOTH MONO, YOU HEAR), A4 and Rytm track VOL and PAN, the studio master meter |
| **Start** | CP-13, the "rough mix": every Xone fader at 10, ch 1 GAIN +6 dB so PK lights, A4 T2/T3 panned centre, master limiter off. Own-track learners get the same rough settings with an undo |
| **Hook** | Demo 1, bars 49–52: as mixed, then with the kick 6 dB down |

**Steps**

1. **listen, hook.** `instance: xone96` on the demo; A = as mixed, B = ch 1 fader 2 steps lower.
   - Question: In B, what is wrong?
     - The hook is too quiet
     - The kick is buried, so the groove loses its push ✓
     - The tempo dragged
   - Why: Only the drum channel moved. Everything else is the same level, but without a strong kick the groove sags.
2. **quiz, warm-up (L12).** A parameter slide… — glides locked values to the next trig ✓ · slides pitch only · reverses the pattern. *Why:* it moves locked parameters between trigs.
3. **info.** "Mix in order: gain first, then faders and pans."
   - Explanation: *Gain staging* means a healthy level at each stage, from the instrument to the channel GAIN. A *static mix* is faders and pans with no effects moves, built up from the kick.
   - Principle: Set levels at the input first; balance with faders second.
4. **do, first win.** "Pull every Xone channel fader down to 0. Then raise channel 1 (drums) to about 7."
   - Check: `s.history.min(xone,'CH 2 FADER') <= 0.5 && between(xv(s,'1','FADER'), 6, 8.5)`
   - Principle: Start a mix from the kick; every other part is balanced against it.
5. **do.** "Play the Drop. Turn channel 1 GAIN until its meter peaks between +3 and +6, never PK."
   - Check: `between(s.meters.channels['xone96:1'].peakDbu, 1, 8) && !s.meters.channels['xone96:1'].pk`
   - Explanation: The channel meter reads before the fader, from −20 to +10 with PK at the top. Peaks around +3 to +6 leave room above without dropping into noise.
6. **do.** "Set channel 2 GAIN the same way."
   - Check: the same range on `'xone96:2'`, no PK
7. **predict.** "Raise channel 2 until the bass feels about as strong as the kick."
   - Question: When the bass is set right, the studio master meter will…
     - Stay the same
     - Rise by a few dB, because two loud parts add up ✓
     - Drop
   - Why: Two strong low parts sum; that is why you balance first and set the overall level last. Nothing makes the master quieter here.
   - Check: `xv(s,'2','FADER') >= 3`
8. **info.** "Use this level guide as a starting point, then trust your ears."
   - Explanation: Measured soloed, as short-term loudness against the kick: bass −2 to −4 dB, clap −5, hats −12 to −16, chords −8 to −10, hook −6 to −8, FX returns −15 to −20. Each demo in `demo-tracks.md` lists its exact balance.
9. **do.** "Pan A4 TRACK 2 to about L15 and TRACK 3 to about R15. Keep the kick, bass, snare and hook centred."
   - Check: `val(a4,'T2 AMP PAN') <= -8 && val(a4,'T3 AMP PAN') >= 8 && |val(a4,'T1 AMP PAN')| <= 4 && val(rytm,'BD PAN') === 0`
   - Principle: Spreading similar parts left and right gives each its own space without changing level.
   - Explanation: The Xone:96, like most DJ mixers, has no pan knobs, so stereo placement happens on the instruments' own PAN controls.
10. **predict.** "Press BOOTH MONO and set YOU HEAR to BOOTH."
    - Question: In mono, what should you check?
      - That the mix gets wider
      - That nothing important disappears or gets much quieter ✓
      - That the tempo is the same
    - Why: Mono sums left and right. Phones, club systems and some speakers play mono, so a part that only works in stereo can vanish. Mono is never wider, and tempo can't change.
    - Check: `val(xone,'BOOTH MONO') && val(xone,'YOU HEAR') === 'BOOTH'`
11. **quiz.** Why keep the kick and bass in the centre? — so the mix gets wider · because drums can't be panned · because the low end carries most of the energy and must stay strong in mono ✓. *Why:* off-centre lows lose power on mono systems and unbalance the speakers.
12. **do.** "Turn MONO off and set YOU HEAR back to MASTER."
    - Check: `!val(xone,'BOOTH MONO') && val(xone,'YOU HEAR') === 'MASTER'`
13. **do.** "With the limiter off, lower the Xone MASTER until the studio master peaks around −6 dBFS in the drop."
    - Check: `!s.master.limiterOn && between(s.meters.master.peakDb, -8, -4) && s.meters.master.measuredSec >= 8`
    - Principle: Headroom, the space below 0 dBFS, keeps peaks clean and leaves room for mastering.
14. **match.** "A reference balance is hidden. Match channel 2's fader to it by ear." `instance: xone96`, controls: ch 2 FADER. Target 7.2 from 4.0 (32 % of travel).
    - Hints: "Is the synth channel too loud or too quiet against the drums?" → "Raise it until the bass sits level with the kick."
15. **challenge.** "Finish a clean, balanced mixdown."
    - Checklist:
      - Every channel in use peaks between 0 and +7 with no PK in the drop
      - The studio master peaks between −8 and −4 dBFS, limiter off
      - Kick and bass centred; at least one pair of parts panned opposite
      - The mono check was done: `s.history.toggled(xone,'BOOTH MONO')`
      - The FX return channels sit below the instrument channels
    - Hints: "Gain first, then faders, then pans." → "Kick at 7, synths until the bass matches the kick, returns around 5." → "If the master is too hot, lower the Xone MASTER, not the GAINs."
    - Solution: CP-14 settings (Demo 1 mix table in `demo-tracks.md`).
16. **reflect.** Prompt: Describe your mixing order and why. Model: Gain first so every channel has a healthy level, then the kick, then the bass against the kick, then the other parts by importance; pan for width, check in mono, and leave headroom for mastering.

**Review**

1. Gain staging means… — turning everything up · setting healthy levels at each stage before balancing ✓ · muting channels. *Why:* good input levels make every later stage easier.
2. Start a static mix from… — the reverb · the hook · the kick ✓. *Why:* it is the reference everything else sits against.
3. A mono check reveals… — parts that vanish or thin out when left and right are summed ✓ · tempo problems · tuning. *Why:* out-of-phase or wide parts cancel in mono.
4. Before mastering, mix peaks of about… — 0 dBFS · −6 dBFS ✓ · −30 dBFS. *Why:* room for the limiter without wasting resolution.
5. Usually kept centred… — pads · delays · kick, bass, snare and lead ✓. *Why:* the core of the track stays solid in mono.

---

### L14 · Master and bounce

`prod-14-master-bounce` · advanced · 18 min · concepts: gain-staging, mixing

| | |
|---|---|
| **Objective** | Master the track to a streaming level (about −14 LUFS integrated, true peak −1 dBTP or lower), then bounce a WAV and stems. |
| **Prerequisites** | L13 |
| **Instruments** | Studio master limiter (DRIVE, CEILING), loudness meter (LUFS momentary, short-term, integrated), true-peak meter, REC and stem bounce |
| **Start** | Learner's track or CP-14 (mixed, limiter off, master peaks about −6 dBFS) |
| **Hook** | Demo 1 master against a version 6 dB louder and crushed, loudness-matched |

**Steps**

1. **listen, hook.** "Two masters played at the same loudness, the way a streaming service plays them. Which hits harder?" A = Demo 1 master (−10.5 LUFS); B = the same pushed to −6 LUFS; both played back loudness-matched (`listen.matchLoudness`).
   - Question: Which one sounds punchier when both are equally loud?
     - A ✓
     - B
     - They sound identical
   - Why: B's extra loudness came from squashing its peaks. Once both are equally loud, A keeps its kick transients and B sounds flat.
2. **quiz, warm-up (L13).** Before mastering, mix peaks of about… — −6 dBFS ✓ · 0 dBFS · −30 dBFS. *Why:* headroom for the limiter.
3. **info.** "Watch the loudness and true-peak meters while the drop plays."
   - Explanation: *LUFS* measures loudness the way ears hear it, averaged over time: momentary (0.4 s), short-term (3 s) and integrated (the whole song). *True peak* estimates the peaks between samples that appear after conversion and encoding.
   - Principle: Perceived loudness follows average energy, not the highest peak.
4. **do, first win.** "Switch on the master LIMITER and set CEILING to −1.0 dB TP."
   - Check: `s.master.limiterOn && s.master.ceilingDbTP <= -1.0`
   - Principle: A limiter stops peaks at a ceiling, so the whole mix can be turned up safely.
5. **predict.** "Play the drop and raise the limiter DRIVE by about 6 dB."
   - Question: What happens to loudness and peaks?
     - The peaks go above the ceiling
     - Loudness rises; peaks stay at the ceiling while the limiter works harder ✓
     - Nothing changes
   - Why: DRIVE is gain into the limiter. The ceiling holds, so the average rises and the gain-reduction meter shows the limiter working. Peaks can't pass the ceiling.
   - Check: `s.master.driveDb >= 5`
6. **listen.** "Compare light and heavy limiting at matched loudness." A = DRIVE +3 dB, B = DRIVE +10 dB, `matchLoudness`.
   - Question: Which keeps the kick punchier?
     - A ✓
     - B
   - Why: 10 dB of limiting flattens every kick peak; 3 dB only catches the loudest ones.
7. **quiz.** Spotify plays tracks at about −14 LUFS. Your master is −8 LUFS. What happens? — it plays louder than other tracks · it is rejected · it is turned down about 6 dB and keeps its squashed dynamics ✓. *Why:* normalization turns loud masters down; the lost punch doesn't come back. Apple Music normalizes to about −16 LUFS, so −14 is a good all-round target.
8. **do.** "Play the whole song from bar 1. Set DRIVE so the integrated loudness reads −14 LUFS, ±1, with true peak at −1.0 dBTP or lower."
   - Check: `between(s.meters.master.lufsI, -15, -13) && s.meters.master.measuredSec >= 90 && s.meters.master.truePeakDb <= -1.0`
   - Hints: "Integrated loudness needs the whole song: play from the top." → "Each dB of DRIVE adds about a dB of loudness until the limiter works hard." → "If the gain-reduction meter shows more than 4 dB on the kicks, back off and lower the hottest part in the mix instead."
9. **info.** "Decide whether you also need a club master."
   - Explanation: DJs and clubs don't normalize, so club masters often run −9 to −6 LUFS. Louder costs punch, so make a separate club master if you need one, with true peak at −1 dBTP or lower; Spotify suggests −2 dBTP for masters louder than −14 LUFS.
10. **do.** "Bounce: press REC, play from bar 1, stop after the last reverb tail, and save the WAV."
    - Check: `s.bounce.last && s.bounce.last.seconds >= songSeconds - 1 && between(s.bounce.last.lufsI, -15, -13) && s.bounce.last.truePeakDb <= -1.0`
    - Principle: Bouncing renders the mix to a file you can share, release or finish elsewhere.
11. **do.** "Bounce stems with the limiter bypassed: drums, synths and FX returns."
    - Check: `s.bounce.last.stems.length >= 3`
    - Explanation: *Stems* are separate audio files for groups of parts, all starting together, that add up to the mix. Remixers, live sets and mastering engineers use them. Leave the limiter off so they sum cleanly.
12. **challenge.** "Deliver a streaming master and a set of stems."
    - Checklist:
      - Integrated −15 to −13 LUFS (or −10 to −9 if you made a club master)
      - True peak −1.0 dBTP or lower
      - The limiter's largest gain reduction is 4 dB or less: `s.meters.master.maxGrDb <= 4`
      - WAV bounced from bar 1 through the tail
      - Stems bounced, all the same length
    - Hints: "Measure the whole song, not a loop." → "If you can't reach −14 without heavy limiting, revisit the mix: usually a part is peaking far above the rest." → "Bounce the stems last, with the limiter bypassed."
    - Solution: DRIVE about +4.5 dB, CEILING −1.0 dBTP on CP-14 gives about −14 LUFS-I; stems = Rytm channel, A4 channel, returns A and B.
13. **reflect.** Prompt: Why is louder not better for streaming? Model: Streaming services turn loud masters down to the same loudness, so extra loudness only costs punch and clarity. Aim for a healthy level with headroom instead.

**Review**

1. LUFS measures… — peak level only · perceived loudness over time ✓ · tempo. *Why:* it weights frequencies the way ears do and averages over time.
2. True peak catches… — average loudness · bass level · peaks between samples that appear after conversion ✓. *Why:* the waveform can overshoot between samples.
3. A common streaming target is about… — −14 LUFS integrated ✓ · 0 LUFS · −30 LUFS. *Why:* Spotify, YouTube and others normalize near −14.
4. Set the limiter ceiling to about… — +3 dB · −1 dBTP or lower ✓ · −20 dB. *Why:* it leaves room for lossy encoding.
5. Stems are… — MIDI files · separate audio files for groups of parts that sum to the mix ✓ · a louder master. *Why:* they let others rebalance or remix the track.

---

### L15 · Capstone: your track

`prod-15-capstone` · advanced · 60–120 min over several sessions · concepts: all

| | |
|---|---|
| **Objective** | Produce, arrange, mix, master and bounce an original two-minute track, then explain your decisions. |
| **Prerequisites** | L14 |
| **Instruments** | Your choice. Suggested: the Elektron live set plus one guest (DFAM, Mother-32, Subharmonicon, Sub 37, your own MIDI synth, audio input or a Web Audio plugin) |
| **Start** | New project, or keep your course track and remake it. Any set |
| **Hook** | 10 s of each demo in turn: "Three different tracks from the same studio. Yours is next." |

Each milestone is a challenge, so the learner can stop between sessions and return. Progress is
saved after each one, and the app suggests doing the daily review before continuing.

**Steps**

1. **info, hook.** The brief: "Two minutes or more, 100–140 BPM, one key, a clear energy curve, mixed and mastered. It can be any style."
2. **reflect, plan.** Prompt: Write your plan: tempo, key, the instruments and the job of each, and your energy curve in one line. Model: "124 BPM, A minor. Rytm drums, A4 bass and stabs, Sub 37 lead. Intro 8, groove 8, drop 16, break 8, build 8, drop 16, outro 16."
3. **challenge, milestone 1: the loop.**
   - Checklist: tempo 100–140; a beat with a kick pattern; a bass part in the same key as the other melodic parts; a chord or pad part; a hook or lead; every instrument synced or clocked (no unsynced sequencer running)
   - Hints: "Reuse your best sounds from the path." → "Four bars is enough for a loop." → "Check kick against bass first."
   - Solution: the CP-09 loop.
4. **challenge, milestone 2: the arrangement.** The L11 checklist, with at least 2:00 of music.
   - Solution: the L11 solution arrangement.
5. **challenge, milestone 3: transitions.** The L12 checklist (three announced section changes).
   - Solution: the L12 solution.
6. **challenge, milestone 4: the mixdown.** The L13 checklist.
   - Solution: the L13 solution settings.
7. **challenge, milestone 5: master and bounce.** The L14 checklist; the learner chooses streaming (−14) or club (−10 to −9) loudness.
   - Solution: the L14 solution.
8. **listen, then reflect.** "Compare your master with a demo, loudness-matched." A = your bounce, B = the demo closest in style, `matchLoudness`, no question. Then a reflect step: Prompt: Where is the biggest difference: low end, mids, space or arrangement? Model: "Name one, then revisit its lesson: low end L3 and L7, mids L5–L7, space L9, arrangement L11–L12." (A reflect rather than a quiz, because there is no single right answer.)
9. **quiz, final interleaved.** A track sounds great in your headphones but the bass vanishes on a phone speaker. First check… — the reverb send · the swing · the bass's harmonics: a little brightness or a higher octave so it is heard on small speakers ✓. *Why:* small speakers can't play below about 100 Hz, so the ear finds the bass through its harmonics. Reverb and swing don't affect that.
10. **reflect.** Prompts: (1) Which decision made the biggest difference, and why? (2) What would you do differently next time? (3) Which lesson's idea did you use without thinking? Model: For example: "Locking the bass between the kicks made the groove; next time I'd plan the break before the drop; I high-passed everything without being told."

**Self-assessment rubric** (shown with the final reflect; 1–4 per row, private to the learner):

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Groove | stiff | some feel | steady with ghosts and swing | makes you move |
| Low end | kick and bass fight | separated but loose | locked in time and key | locked, solid in mono |
| Harmony and hook | clashes | in key | progression and hook fit | memorable, own register |
| Arrangement | one loop | sections | phrases with contrast | clear energy curve, a peak |
| Transitions | none | some | announced changes | seamless |
| Mix | parts buried or clipping | audible | balanced, clean headroom | every part clear, mono-safe |
| Master | clipping or too quiet | near target | on target, ≤ −1 dBTP | on target, still punchy |

**Review**

1. Kick and bass fight. The first fix to try… — more reverb on both · put the bass between the kicks and shorten its notes ✓ · raise the tempo. *Why:* separate them in time first (L3).
2. A loop sounds boring after 16 bars. Try… — trig conditions, locks and a slow LFO ✓ · a louder master · more swing only. *Why:* movement without new parts (L8).
3. The break feels weak. Try… — keeping the kick in · removing the kick and bass so the drop returns them ✓ · making it 3 bars long. *Why:* contrast (L11).
4. The mix is muddy. Start with… — boosting LO on every channel · high-passing the parts that don't need lows ✓ · adding reverb. *Why:* frequency slots (L7).
5. Your master reads −7 LUFS for streaming. Do… — nothing, louder is better · lower the drive toward −14 LUFS and keep the punch ✓ · raise the ceiling to 0 dBTP. *Why:* streaming normalizes (L14).


---

## 7. Implementation notes

What has to exist before these lessons can ship, in rough priority order.

### 7.1 Lesson schema

| Need | Proposal | Used by |
|---|---|---|
| A new path | Add `'producer'` to `Lesson['path']` and to the validator's list of paths; `order` 1–15; `device: 'studio'` | all |
| Whole-studio start states | `start: { set?: string; checkpoint?: string; offerOwnTrack?: boolean }` for studio lessons. Snapshot the whole studio (rack, routes, sync, cables, arrangement, every instance) before applying, and restore it with one press | all |
| Hooks from the demos | `info.play?: { demo: string; fromBar: number; toBar: number; solo?: string[] }` plays an excerpt of a bundled demo project in a separate, temporary engine state, then restores the learner's studio | most |
| Demo-level A/B | `listen.demo?: { project: string; a: Patch; b: Patch; bars: [number, number] }` where a Patch is `{ [instance]: values }` | L2, L7, L13, L14 |
| Loudness-matched A/B | `listen.matchLoudness?: boolean`: measure short-term LUFS of A and B and gain-match them before playback, so "louder" never wins by default | L14, L15 |
| Sequencer settings in listen and match | Either expose pattern SWING as a control on both Elektrons, or allow `listen`/`match` targets on project data (`{ data: { swing: 64 } }`) | L2, L10 |
| Arranger snapshots of chosen controls | A "capture snapshot" button per instrument per section that stores only the controls the learner picked (for the Xone: one channel's filter assignment, the filter type and frequency) | L12, demos |

### 7.2 Check state

The fields in §5 marked "proposed": `transport.swing`, `meters` (master, channels, parts), `master`,
`bounce` and `history`. Helpers go in a new `lib/studio/checks.ts` and resolve hardware names to
control ids through a small alias table per device, so lesson text never mentions ids. Each helper
returns `undefined` rather than throwing when an instrument is missing, and checks treat
`undefined` as "not done".

### 7.3 Meters, limiter and bounce

- **Loudness** follows ITU-R BS.1770: K-weighting, momentary (400 ms), short-term (3 s) and gated
  integrated loudness (absolute gate −70 LUFS, relative gate −10 LU). LRA per EBU Tech 3342. Run it
  in an AudioWorklet on the master bus, after the limiter. Integrated loudness and the maximum gain
  reduction reset when playback starts from bar 1.
- **True peak** with 4× oversampling, shown in dBTP.
- **Channel meters** on the Xone model read in dBu like the hardware: 9 LEDs from −20 to +10 with
  PK at the top (Xone:96 User Guide 2026, p.5 and the spec sheet). Expose the numbers to checks, and
  name the LED "PK" in every message, never by colour.
- **Master limiter**: DRIVE 0 to +18 dB, CEILING −0.1 to −3.0 dBTP, automatic release, true-peak
  aware. The current soft limiter in `lib/audio/context.ts` (−6 dB threshold, 12:1) stays as a
  safety net only when the mastering limiter is off, so lessons measure what learners set.
- **Bounce**: 24-bit WAV at the context's sample rate, from bar 1 to the end of the arrangement,
  plus the tail until the level falls below −60 dBFS or 4 s pass. **Stems**: one file per mixer
  input in use (Xone channels 1–4, A, B), taken before the master limiter, all the same start and
  length so they sum back to the pre-limiter mix.

### 7.4 Content to build

| Asset | Where it is specified |
|---|---|
| Rytm kit PRODUCER and A4 kit PRODUCER | Demo 1 sound design (`demo-tracks.md`), simplified: the same sounds without the Build/Break extras |
| DFAM preset "Tick Perc" | Short, high percussion: VCO 1 TRI, VCA DECAY about 90 ms, NOISE 20 %, VCF HP about 1 kHz, PITCH 1–8 = +12 +24 +19 +24 +12 +24 +17 +24 semitones, VELOCITY 1–8 = 70 25 55 30 75 25 50 35 % |
| Checkpoints CP-00 … CP-14 | §4 of this document |
| The three demo projects | `demo-tracks.md` |
| New sets `elektron-live-dfam`, `moog-sound-studio-mix` | §4 and Demo 2 |

### 7.5 The existing studio lessons

| Existing | In the producer path |
|---|---|
| `studio-1-one-clock` | Optional refresher before L1; L1 and L4 reuse its BPM questions |
| `studio-2-clock-pulses` | Optional deep dive linked from L4 |
| `studio-3-midi-sync` | Optional deep dive linked from L4 |
| `studio-4-into-the-mixer` | Superseded by L13; keep it in the `studio` path for learners outside this path |
| `studio-5-arrange-and-bounce` | Superseded by L11 and L14; keep it as the quick version in the `studio` path |

### 7.6 Accessibility and devices

- Every instruction names a control by its printed label and every meter by its number; no step
  depends on colour (LED colours are mentioned only as an extra).
- Trig keys are referred to by number; screen readers announce "trig 5, note trig, velocity 100".
- Ear steps (listen, match) always have a visual twin: the spectrum or meter that shows the change.
- On older iPads the heaviest start state is `elektron-live-dfam` (four instruments). L4 offers to
  power the DFAM off afterwards; the capstone suggests at most five instruments.

### 7.7 Facts checked against the manuals

Hardware behaviour this path relies on, checked in the reference manuals (facts only, in our own words):

- Rytm MKII OS 1.72: SWING menu [FUNC] + [BANK G], 51–80 %, applied to swing trigs (p.50); PARAMETER
  SLIDE [FUNC] + [BANK H] (p.50); trig conditions A:B, %, FILL, PRE, NEI, 1ST and negations (p.48–49);
  retrig rates 1/1 to 1/80 with a velocity curve (p.41); extending a pattern copies its pages (p.46);
  AMP page HLD/DEC/OVR/DEL/REV/PAN/VOL (p.79); LFO modes FREE, TRIG, HOLD, ONE, HALF (p.80); delay
  time in 128th notes, 32 = one beat (p.81); compressor sidechain EQ LPF/HPF/HIT (p.83).
- Analog Four MKII OS 1.55: POLY CONFIG and polyphonic tracks (p.28); arpeggiator with note offsets
  NO2–NO4 (p.43–44); micro timing in 1/384 steps and trig probability/conditions (p.45); extending a
  pattern copies trigs (p.49); note slide and parameter slide (p.52–53); SWING [FUNC] + [PTN] (p.53);
  delay time in 128th notes (p.95).
- Sub 37 manual v1.1: 64-step sequencer with REST and TIE, ties between different notes play legato
  (p.17); ratchet and per-step SEQ MOD values (p.20); LFO clock-division sync (p.23); GATE LENGTH,
  CLOCK DIV and SWING for the arpeggiator and sequencer (p.40).
- Subharmonicon owner's manual: internal clock 1 PPQ, MIDI clock 4 PPQ (16ths), MIDI overrides an
  analog clock (p.24); CLOCK input and output (p.36); clocking a DFAM from it (p.37).
- Mother-32 owner's manual: per-step gate length, accent, rest, tie, glide and ratchet (p.25);
  pattern length up to 32 (p.34); splitting an output with a mult or stackable cables is fine
  (p.47); TEMPO input default Single Clock Advance, one step per rising edge (p.56); MIDI clock turns
  the TEMPO knob into a divider and MIDI Start runs from step 1 (p.58).
- DFAM owner's manual: ADV/CLOCK input (p.29).
- Xone:96 User Guide (2026): channels 1–4 HI 3 kHz and LO 180 Hz kill to +6 dB, HI MID 1.1 kHz and
  LO MID 350 Hz −27 to +10 dB (p.7); channels A/B 3-band with a swept 190 Hz–2.75 kHz mid (p.5); no
  channel pan controls.
- Loudness targets: Spotify recommends −14 LUFS integrated and true peak below −1 dBTP, or −2 dBTP
  for masters louder than −14 LUFS (Spotify for Artists, "Loudness normalization").
