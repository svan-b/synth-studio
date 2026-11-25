# Open String

A guitar teacher for an acoustic guitar and an iPad on a stand. It lives at `/guitar` in this app and is self contained, like the piano teacher beside it, so it can be moved to its own project later without untangling anything.

## What it does

- **Listens through the microphone.** No cable, no pickup. It hears single notes, every strum, and the chord in a strum, and has a tuner that takes you string by string.
- **A course in six stages**, 24 short lessons: holding and tuning the guitar, a first chord on day one and a first song in the first week, strumming patterns and waltz time, the campfire chords, tab and melodies, fingerpicking, and then the first barre chord, the blues, chords by ear and a song of your own.
- **24 songs**, traditional, in the public domain, or written for the course. Any song whose chords you know is open to you.
- **Chord changes practised as changes.** Most beginners can hold a chord. What stops a song is getting to the next one in time. So new chords come with back and forth changes, and an exercise counts clean changes in a minute and keeps your best for each pair.
- **A practice coach for songs.** First the chord changes in your own time, since the music waits for you. Then one strum on each beat of a slow click, then the song's own strum, then the whole song faster. A change that keeps catching is taken out, drilled, and put back.
- **Feedback that says what to fix.** Which chord a strum sounded like when it was not the one asked for, which strings did not ring, changes that came late, and strums that rushed ahead of the click.
- **Each new chord checked one string at a time**, so a muted string is told apart from a wrong note.
- **Hear yourself.** The first time through each learned song is recorded and kept, with your latest, to play back or send to family.
- **Exercises**: a chord check from names (spaced review), one minute changes, strumming with the click, and ear training.
- **A daily session** sized to the time you have. It starts by tuning up, brings the new lesson early, gives most of the time to songs, and ends on something you already play well. New lessons wait while two songs are still being learned.
- **Made to keep you playing.** The week shows the days you played, not a run of days that one missed day would wipe out. After a break the app says welcome back and picks up where you were. You choose a time to play, and inside the iPad app a reminder comes at that time on days you have not played yet. Each session ends with what changed, and what tomorrow holds.
- **A sound check.** The app strums, you strum, and it tells you whether the iPad is loud enough beside your guitar, with the iPad's own volume shown.
- **The method page** in the app sets out each teaching choice, the studies behind it, and how strong the evidence is.

## The iPad app

`ios-guitar/` holds a native iPad app that carries the guitar teacher inside it. It needs no connection, keeps progress in a file of its own with a dated copy in the Files app, saves recordings to the Files app, sets the reminder at your time to play, reports the iPad's volume for the sound check, and holds the screen awake on its stand. `ios-guitar/README.md` has the steps for putting it on an iPad from a Mac.

The web app does not care which of the two it runs in, with one exception: `lib/guitar/native/bridge.ts` asks the shell for the few things only the shell can do.

In a browser the app works too, including Safari on the iPad. Microphone access needs a tap there, and the reminder and the Files folder are not available.

## The sound of the app's guitar

The app's guitar is made on the device from a model of a plucked string (extended Karplus Strong, in `lib/guitar/audio/synth.ts`), with the body of an acoustic guitar as a few resonances. The pluck was shaped against real recordings: on GuitarSet, the low strings of an acoustic show their second and third harmonics about as strong as the fundamental, so the model's pluck includes the snap of a pick letting go, most on the wound strings.

That matters for loudness. An iPad's speaker gives little below about 150 Hz, where the fundamentals of the low strings sit, so a guitar sound built on its fundamentals sounds thin and quiet beside a real guitar. A sound with the harmonics a real guitar has carries through the iPad speaker. Every note is brought to the same level before it is played, and a limiter at the end lets the whole thing run hot without distorting. The sound check measures what actually leaves the app against what the microphone hears from the guitar.

## How the listening works

- **Tuner**: YIN pitch detection on a decimated copy of the input, with an octave check and smoothing (`lib/guitar/dsp/pitch.ts`).
- **Strikes and notes**: onsets from spectral flux, then each new sound is compared with what was ringing just before it, and notes are scored by how well their harmonics explain the new peaks (`lib/guitar/dsp/tracker.ts`). Notes the music expects next get a gentler test, so a right note is confirmed quickly.
- **Chords**: the app always knows which chord it asked for. A strum's pitch content, read from a longer window once all six strings have sounded, is compared with that chord, with the chord before it, which is the likeliest slip, and with the other chords of the same song, which must fit more clearly to be named (`lib/guitar/dsp/chordmatch.ts`). The check is lenient by design: a chord that is nearly right passes, a chord that only adds one note to the one asked for (A7 for A) is not counted as a mistake, and a chord a fifth above the one asked for (D for G) must win clearly, since the right chord's own harmonics fall on its notes. A retry costs nothing, and Move on is always there.
- **The click** is pitched between frets, so the detector can tell it from a string, and the app's own demonstrations are ignored while they play.

## Evaluation on real guitars

The detector is measured against GuitarSet (Xi, Bittner, Pauwels, Ye and Bello, 2018, CC BY 4.0): six players on an acoustic guitar, recorded with a microphone, every note annotated string by string. The recordings are not stored in the repository.

1. Download GuitarSet from Zenodo (record 3371780): `annotation.zip` and `audio_mono-mic.zip`.
2. Unpack the annotations into `<dir>/ann` and the audio into `<dir>/audio`.
3. `python3 -I scripts/convert_guitarset.py <dir> <dir>/notes.json`
4. `GUITARSET_DIR=<dir> npx vitest run lib/guitar/dsp/tracker.eval.test.ts`

Results on the evaluation set, as last run:

| What is measured | Result |
| --- | --- |
| Tuner, on 124 sustained notes | right pitch for 93.5 percent, an octave out for 2.4 percent |
| Notes in melodies, with the music to follow, as in the app | 76 percent heard, and 71 percent of what was named was right |
| Notes in melodies, without the music to follow | 65 percent heard, 67 percent right, octave slips 4 percent |
| Strums heard | 73 percent |
| The right chord passes the chord check | 75 percent |
| A wrong chord passes the chord check | 3.1 percent, against four wrong chords for each strum |
| A plain chord taken for its seventh, such as A for A7 | never, in 176 plain chords |

The chord check is set to let very few wrong chords through, at the cost of sometimes asking for a right chord again.

These recordings are harder than a beginner's playing: fast jazz, rock and singer songwriter lines, and comping with quick changes. The test material in the course is slow and plain by comparison.

## Code map

```
app/guitar/                 route, theme, page shell
components/guitar/          screens, the tuner, chord pictures, tab, the playing surface
lib/guitar/music/           pitches and strings, chord shapes, the score model and text notation
lib/guitar/audio/           the plucked string model, the engine, metronome, scheduling
lib/guitar/input/           listening, the note and strike bus
lib/guitar/dsp/             pitch, note and strike detection, chord matching
lib/guitar/engine/          the follower (wait and tempo modes), which records each run
lib/guitar/learn/           progress store, spaced review, coach, planner, milestones, recordings
lib/guitar/content/         lessons, songs, the method
lib/guitar/native/          the few calls into the iPad app
lib/guitar/dev/             a robot guitarist for automated checks
ios-guitar/                 the iPad app: web view shell, progress file, recordings, reminders
public/guitar/              icons, manifest, audio worklet
public/guitar-sw.js         offline cache
scripts/convert_guitarset.py   GuitarSet annotations to one file, for the evaluation
```

Music is written in a compact text notation, described at the top of `lib/guitar/music/score.ts`: single notes with their string (`E4q@1`), chords by the beat (`G . . . | C . G .`), strum patterns (`D.DU.UDU`) and picking patterns (`p 3 2 1 2 3`). Every song and lesson is checked by tests: measures must add up, every note must be playable in first position or have a string given, the words must line up with the chords, and no song asks for a chord before the lesson that teaches it.

## Tests

```bash
npm test
```

runs the unit tests, including the listening chain on the app's own synthesised guitar. Adding `?osdebug=1` to the address loads development tools, including a robot guitarist that plays whatever the app is waiting for, as sound into the listening input, the way a microphone would hear a real guitar.

## Credits

Note detection evaluated on GuitarSet, Creative Commons Attribution 4.0. Review scheduling: ts-fsrs. All songs are traditional, in the public domain, or written for the course.
