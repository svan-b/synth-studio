# Fretward

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
- **A sound check that needs no guitar.** The app plays its guitar, then its click, and you turn the iPad up until each is easy to hear from your chair, with the iPad's own volume shown.
- **The method page** in the app sets out each teaching choice, the studies behind it, and how strong the evidence is.

## Made for hands on the guitar

The learner sits with a guitar on the lap and the iPad on a stand about an arm's length away. Both hands are busy, and the eyes move between the fretting hand and the screen. Every playing screen is built around that.

- **One line at the top** says what to do, or how the last try went. It is set large enough to read from the chair. Text size is a choice made at the first start and in Settings (standard, large, largest), and large is where it begins.
- **One bar along the bottom** holds every control, in the same places on every screen. Back, again and hearing it sit on one side. The next thing to do sits on the other side and is the largest button on the screen. For a left handed player the sides swap.
- **The app moves on by itself.** After a step that went well, the next one begins in a few seconds, shown as a count on the button. A touch anywhere else holds it there for as long as the learner wants to read.
- **A strum starts things.** Where the app waits to begin a run, one strum begins it. Between the parts of a session a strum carries on to the next part.
- **A foot pedal works.** Bluetooth page turning pedals are small keyboards, so the keys they send are answered: right arrow, down arrow, page down, return and space go forward, and left arrow, up arrow and page up go back or play it again. A keyboard works the same way. The pedal only ever does the plain next thing. It never skips a step, since leaving something undone should take a deliberate touch.
- **Nobody gets stuck.** Every step can be skipped with a touch. A step that is not heard right after three tries is let go and the lesson carries on, and after two failed runs the main button becomes Move on. In a song, the plan opens to show every step, and a tap on any of them goes there. Going back in the plan asks first, since it gives up steps already held.
- **Skipping is honest.** A lesson gone through without playing any of it is kept as one you know, not as one taken today: it adds no chords to your reviews and claims no milestone. A session with every part skipped does not count as the day's session. A one minute test that is stopped part way keeps no score.
- **A stray press does no harm.** For a moment after a screen changes, a press that would move on is taken to be meant for the screen before and is let pass. A strum only carries a session on when it is a real strum of several strings, not one plucked note or a knock on the guitar.
- **Leaving and coming back.** A lesson closed part way opens at the same step. A session left part way is carried on from the same part later that day. Time at the guitar is saved every half minute and whenever the app is put away, so it is never lost and never lands on the wrong day. A run with the click that is cut into by the iPad being put away is dropped, not judged.
- **Eyes on the music.** While a run with the click is under way, the words at the top step back and only the chord, the next chord, the strum and the bar stay. The chord to play is the largest thing on the screen, the next chord sits beside it and lights up in the beat before the change, and the count in fills the middle of the screen.
- **The tuner follows the string that is plucked**, so there is nothing to tap between strings, and it says Tighten or Loosen in large words.
- **Read aloud**, a setting that is off until asked for, speaks each instruction and result in the iPad's own voice. The app does not take its own voice for the guitar, and it does not move on while it is still speaking.

These choices follow what the best known music apps do well, and what their users complain about. Sheet music readers take page turns from a pedal. Song trainers show the next chord beside the current one, with the strum under it. Tuners find the string by ear. The most common complaint about listening apps is being held on a step the app did not hear right, which is why skipping is always one press away here.

## The iPad app

`ios-guitar/` holds a native iPad app that carries the guitar teacher inside it. It needs no connection, keeps progress in a file of its own with a dated copy in the Files app, saves recordings to the Files app, sets the reminder at your time to play, reports the iPad's volume for the sound check, and holds the screen awake on its stand. `ios-guitar/README.md` has the steps for putting it on an iPad from a Mac.

The web app does not care which of the two it runs in, with one exception: `lib/guitar/native/bridge.ts` asks the shell for the few things only the shell can do.

In a browser the app works too, including Safari on the iPad. Microphone access needs a tap there, and the reminder and the Files folder are not available.

## The sound of the app's guitar

The app's guitar is made on the device from a model of a plucked string (extended Karplus Strong, in `lib/guitar/audio/synth.ts`), with the body of an acoustic guitar as a few resonances. The pluck was shaped against real recordings: on GuitarSet, the low strings of an acoustic show their second and third harmonics about as strong as the fundamental, so the model's pluck includes the snap of a pick letting go, most on the wound strings.

The model on its own is much darker than a real guitar. Set beside 72 recordings of strummed acoustic guitar in GuitarSet, it carried about 9 dB more of its energy below 100 Hz, and 6 to 13 dB less in every band above 800 Hz, which is where the ear hears a pick on a string and where a small speaker does its work. Through an iPad that came out dull and quiet, since most of the level sat where the speaker gives nothing. So what the app plays is voiced after the model (`VOICE` and `APP_PLUCK` in `synth.ts`): plucked a little nearer the bridge, with the bottom trimmed and the upper range lifted until the balance matches the recordings. Measured as played, the share of energy in each band is now within about 2 dB of the real guitars from 100 Hz to 6.4 kHz:

| Band | Real strummed guitar | The app before | The app now |
| --- | --- | --- | --- |
| below 100 Hz | -19 dB | -11 dB | -14 dB |
| 100 to 400 Hz | -1 dB | -1 dB | -1 dB |
| 400 to 800 Hz | -13 dB | -12 dB | -11 dB |
| 800 Hz to 1.6 kHz | -16 dB | -22 dB | -16 dB |
| 1.6 to 3.2 kHz | -18 dB | -29 dB | -20 dB |
| 3.2 to 6.4 kHz | -23 dB | -35 dB | -22 dB |
| above 6.4 kHz | -30 dB | -42 dB | -27 dB |

A test holds the voicing to this, so it cannot drift back.

For loudness, every note is brought to the same level as a small speaker would give it, so a low string is as easy to hear as a high one. The sound is then evened out by a compressor, the first instant of each pick is rounded off, and a limiter guards the top, so the whole thing sits within a decibel of full scale without distorting. The click is a single tone at nearly full scale, since it has to be heard over the learner's own strumming.

## Sound on an iPad while the microphone is open

This is the main reason the app holds the microphone only while the learner is playing.

While a web page on an iPad or iPhone holds the microphone, the system plays all of that page's sound the way it would for a video call. It uses the call volume, which is lower and is set apart from the ordinary one, and a thin tone made for voices. WebKit sets this up itself and gives neither the page nor the app around the web view a way to change it. Turning echo cancellation off does not avoid it. It has been reported for years and is still so on current iPadOS (WebKit bugs 218012, 236219 and 311451). The web view's sound also lives in a process of its own, with its own audio session, so nothing the iPad shell does to the app's audio session reaches it.

An earlier build opened the microphone once and kept it. Every example was then played at the call volume with the voice tone, which is what made the app sound quiet and wrong.

So now (`lib/guitar/input/listen.ts`):

- **Screens that do not listen do not hold the microphone.** Today, Songs, Progress and Settings play at the iPad's ordinary volume, and the orange microphone dot is off.
- **The microphone steps aside for anything the learner should hear well.** Before an example, a note to tune to, an ear training sound or a recording plays, the microphone is let go and sound is put back to its ordinary strength. This takes about a third of a second. When the sound ends, listening picks up again.
- **Only the click, the count in and the chime play while it is open.** Those are short, bright sounds that carry in the call mode.
- **The sound check plays each the way it will be heard.** The guitar at the ordinary volume, the click with the microphone open, so each can be set with the volume buttons while it sounds.

On a computer, where none of this applies, the microphone stays open as before. For checks, `?osdebug=1&osaside=1` makes a computer behave as an iPad does.

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

## Checked end to end

The development robot (`?osdebug=1`) plays the app as a learner would, as sound into the listening input, with its strings damped when played again as on a real guitar. With it, all 24 lessons play through, the songs of every kind (strummed, waltz, six eight, melody, fingerpicked, the blues) go from the first play through to learned at full speed, the four exercises run, and a simulated learner goes through a week of daily sessions, a break, and the welcome back. The lessons and songs are run with the microphone stepping aside for every example, as it does on an iPad. These runs found real faults that unit tests had not: bass notes in waltz patterns that could never be matched, plain chords taken for their seventh, every known chord compared with every strum, and fingerpicking judged too harshly. The same web app also runs with a stand in for the iPad app's bridge, which checks that listening starts without a tap, progress and reminders reach the app, and the iPad app's self test passes its page half.

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
