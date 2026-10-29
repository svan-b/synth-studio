// ============================================================================
// Audio input lessons (v2, docs/PEDAGOGY.md)
//
// They work without gear: the Practice synth and the 1 kHz line-up tone stand
// in for a synth on your interface, so the numbers in a lesson are the
// numbers you see. Steps that need real gear say so and can be skipped.
//
//   foundations  1 choose an input (and why voice processing is off)
//                2 gain staging: peaks around -12 dBFS
//                3 monitoring and latency
//                4 into the mixer and onto disk
//   studio       your hardware synth in the studio: MIDI out, audio back in,
//                a mixer channel, a take
//
// Checks read the input's data (source, level check, takes), its values (GAIN,
// MODE, MUTE), the routes and the other instruments, so steps complete by
// themselves. Routing steps need a mixer with studio inputs (the Xone:96);
// with none in the studio, OUTPUT lists only the master and the step can be
// skipped.
// ============================================================================

import type { Lesson, LessonCheckState } from '@/types';
import { asData as asSynthData } from '@/devices/midi-synth/config';
import { TARGET_ZONE, asInputData, initialInputData, levelIsGood, type AudioInData } from './config';

const O = (n: number) => n / 100;
const SOURCE = 'Synth Studio · audio engineering practice (gain staging, monitoring)';

// ---------------------------------------------------------------- helpers

const d = (s: LessonCheckState) => asInputData(s.data);
const num = (s: LessonCheckState, id: string) => Number(s.values[id] ?? 0);
/** This input's instance id (its data object is the lesson's) */
const selfId = (s: LessonCheckState) => Object.entries(s.instances).find(([, i]) => i.data === s.data && i.device === 'audio-in')?.[0];
const route = (s: LessonCheckState) => s.routes[selfId(s) ?? 'audio-in'] ?? 'master';
const onMixer = (s: LessonCheckState) => route(s) !== 'master';
const synths = (s: LessonCheckState) => Object.values(s.instances).filter(i => i.device === 'midi-synth').map(i => asSynthData(i.data));

/** Full data for solutions */
const input = (patch: Partial<AudioInData> = {}): AudioInData => ({ ...initialInputData(), enabled: true, source: 'practice', ...patch });
const goodCheck = (source: AudioInData['source'], gainDb = 0) => ({ peakDb: -12, gainDb, source, at: 1 });

// ============================================================================
// 1. Choose an input
// ============================================================================

const l1: Lesson = {
  id: 'audio-in-1-connect', device: 'audio-in', path: 'foundations', order: O(1), difficulty: 'beginner',
  name: 'Bring sound in: choose an input',
  description: 'Connect a synth through your interface (or the Practice synth), choose MODE, and see why voice-call processing is off.',
  objective: 'Connect an audio source, match MODE to the cables, and explain why voice-call processing must be off for instruments.',
  source: SOURCE, estimatedMinutes: 6,
  concepts: ['signal-routing'],
  start: { values: { gain: 0, mute: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing', focus: ['source'],
      instruction: 'Audio input brings any instrument\'s sound into the studio: a synth through your audio interface, a microphone, or the built-in Practice synth.',
      principle: 'An audio interface turns the voltage on a cable into numbers a computer can mix.',
      explanation: 'MIDI only carries instructions. To mix, process or record a hardware synth, its sound has to come back in through an input.',
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['source', 'connect'],
      instruction: 'Choose a source: Interface / mic for your gear, or Practice synth if you have none.',
      check: s => d(s).enabled && d(s).source !== 'tone',
      solution: { data: input() },
      principle: 'Every studio input starts with one question: which socket is this instrument on?',
      explanation: 'The browser asks once before it opens your interface or microphone. Pick your interface (not the built-in mic) for a synth. On iPad, a class-compliant USB interface works through an adapter.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'Video calls clean up voices with echo cancellation, noise suppression and auto gain. What would they do to a synth?',
        options: ['Pump the level, cut quiet notes and smear the sound', 'Make it sound better', 'Nothing at all'], answer: 0,
        explain: 'They are tuned for speech: noise suppression treats a held note as noise, auto gain pushes the level up and down, and echo cancellation removes sound that also comes out of your speakers. Audio input turns all three off.',
      },
    },
    {
      kind: 'predict', control: 'mode', targetValue: 3, concept: 'signal-routing', focus: ['mode'],
      instruction: 'Set MODE to STEREO.',
      predict: {
        question: 'A synth\'s left and right outputs go into inputs 1 and 2. Which MODE keeps its stereo image?',
        options: ['STEREO: input 1 left, input 2 right', 'IN 1', 'L+R'], answer: 0,
        explain: 'IN 1 plays only the first cable, in the middle; L+R folds both into the middle. STEREO keeps left and right apart. A mono synth on one cable wants IN 1.',
      },
      principle: 'Match MODE to the cables: one cable is mono, two cables are stereo.',
    },
    {
      kind: 'listen', concept: 'signal-routing', focus: ['mute'],
      instruction: 'Compare the input heard through the studio with MUTE on.',
      listen: {
        a: { mute: false }, b: { mute: true }, labels: ['Through the studio', 'MUTE on'],
        question: {
          question: 'With MUTE on, what still works?',
          options: ['The meter and Record take', 'Nothing: the input is off', 'Only the sound'], answer: 0,
          explain: 'MUTE only silences the input in the studio. The meter and takes read it before MUTE, which is what you want when you listen to the synth straight from your interface.',
        },
      },
    },
    {
      kind: 'challenge', concept: 'signal-routing', focus: ['mode', 'mute'],
      instruction: 'Set this input up for a mono synth on one cable, heard through the studio, and name it after the synth.',
      checklist: [
        { text: 'MODE is IN 1', check: s => num(s, 'mode') === 0 },
        { text: 'MUTE off', check: s => !s.values.mute },
        { text: 'Named (tap the name at the top)', check: s => !!d(s).name },
      ],
      hints: ['One cable is mono.', 'The cable goes into input 1, so IN 1.', 'Tap the name at the top left to rename it: the rack and routing menus use it.'],
      solution: { values: { mode: 0, mute: false }, data: input({ name: 'Mono synth' }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Why does Audio input switch voice-call processing off?',
        model: 'Echo cancellation, noise suppression and auto gain are made for speech; on a synth they cut held notes, pump the level and colour the sound, so an instrument needs the raw signal.',
      },
    },
  ],
  review: [
    { question: 'An audio interface…', options: ['Turns the sound on a cable into numbers the computer can record', 'Sends MIDI notes', 'Powers the synth'], answer: 0, explain: 'It converts analog to digital (and back).' },
    { question: 'Noise suppression on a synth can…', options: ['Cut held notes it mistakes for noise', 'Make it brighter', 'Change its pitch'], answer: 0, explain: 'It is tuned for speech.' },
    { question: 'A stereo synth on inputs 1 and 2 needs MODE…', options: ['STEREO', 'IN 1', 'IN 2'], answer: 0, explain: 'Input 1 left, input 2 right.' },
    { question: 'MUTE on this input…', options: ['Silences it in the studio but keeps the meter and takes', 'Disconnects it', 'Turns it up'], answer: 0, explain: 'Monitoring off, recording on.' },
  ],
};

// ============================================================================
// 2. Gain staging
// ============================================================================

const l2: Lesson = {
  id: 'audio-in-2-gain', device: 'audio-in', path: 'foundations', order: O(2), difficulty: 'beginner',
  name: 'Gain staging: peaks around -12 dBFS',
  description: 'Use a line-up tone to see exactly what GAIN does, leave headroom, and read the CLIP lights.',
  objective: 'Set GAIN so the loudest peaks land around -12 dBFS, with headroom, and read the meter and CLIP lights.',
  source: SOURCE, estimatedMinutes: 8,
  prerequisites: ['audio-in-1-connect'],
  concepts: ['gain-staging'],
  start: { values: { gain: 0, mute: false } },
  steps: [
    {
      kind: 'do', concept: 'gain-staging', focus: ['source'],
      instruction: 'Choose Test tone: a steady 1 kHz tone at a known level.',
      check: s => d(s).enabled && d(s).source === 'tone',
      solution: { data: input({ source: 'tone' }) },
      principle: 'A known reference level makes gain settings repeatable.',
      explanation: 'Studios line up their gear with a tone like this before a session. It is loud and plain on purpose: turn your speakers down a little.',
    },
    {
      kind: 'info', concept: 'gain-staging', focus: ['meter'],
      instruction: 'dBFS means decibels below full scale. 0 dBFS is the loudest a digital signal can be. The tone peaks at -20 dBFS.',
      principle: 'In digital audio, 0 dBFS is a hard ceiling: anything above it is cut off.',
      explanation: 'The green band on the meter, -18 to -6 dBFS, is the target zone, with a line at -12. The number on the right is the highest recent peak.',
    },
    {
      kind: 'predict', control: 'gain', targetValue: 8, tolerance: 1, concept: 'gain-staging',
      instruction: 'Turn GAIN up to +8 dB and watch the peak readout.',
      predict: {
        question: 'The tone peaks at -20 dBFS. Where will it peak with GAIN at +8 dB?',
        options: ['-12 dBFS', '-28 dBFS', '0 dBFS'], answer: 0,
        explain: 'Decibels add: -20 + 8 = -12, the middle of the target zone. +6 dB roughly doubles the signal; -6 dB halves it.',
      },
      principle: 'Gain in decibels adds to the level: +6 dB is about twice the signal.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'gain-staging',
      quiz: {
        question: 'Why aim for -12 dBFS rather than as close to 0 as possible?',
        options: ['Headroom: louder notes and resonance peaks still fit below 0 dBFS', 'It sounds brighter', 'Digital audio is louder at -12'], answer: 0,
        explain: 'A recording has plenty of room above its noise; the danger is the ceiling. A synth\'s peaks jump with velocity, resonance and chords, and anything over 0 dBFS is clipped flat.',
      },
    },
    {
      kind: 'do', concept: 'gain-staging', focus: ['level-check'],
      instruction: 'Press Check level. It listens for 5 seconds and judges the peaks.',
      check: s => levelIsGood(d(s)),
      solution: { data: input({ source: 'tone', levelCheck: goodCheck('tone', 8) }) },
      principle: 'Judge levels by the loudest peaks over a few seconds, not one glance.',
      explanation: 'If it is not "Good", it offers a GAIN setting that would put the peaks on -12 dBFS.',
    },
    {
      kind: 'predict', control: 'gain', targetValue: 22, tolerance: 2, concept: 'gain-staging', focus: ['meter'],
      instruction: 'Turn GAIN up to +22 dB.',
      predict: {
        question: 'What will the CLIP light do?',
        options: ['Light up and stay lit', 'Nothing', 'Turn the input off'], answer: 0,
        explain: '-20 + 22 = +2 dBFS, over the ceiling: in a recording the tops of the wave are cut off, a harsh distortion. CLIP stays lit until you tap it, so you never miss a short peak.',
      },
      principle: 'Clipping flattens the peaks into harsh distortion, and it cannot be undone later.',
    },
    {
      kind: 'challenge', concept: 'gain-staging', focus: ['source', 'level-check'],
      instruction: 'Now a real source: choose your interface (or Practice synth), play its loudest part and check the level until it says Good.',
      checklist: [
        { text: 'Source: your interface or the Practice synth', check: s => d(s).enabled && d(s).source !== 'tone' },
        { text: 'A level check of that source says Good', check: s => levelIsGood(d(s)) && d(s).levelCheck?.source === d(s).source },
      ],
      hints: [
        'With the Practice synth, Check level plays its phrase for you.',
        `Below ${TARGET_ZONE[0]} dBFS? Turn GAIN up. Above ${TARGET_ZONE[1]}? Down.`,
        'Real gear: set the interface\'s own gain first, so its IN light never clips, then fine-tune GAIN here.',
      ],
      solution: { values: { gain: 0 }, data: input({ source: 'practice', levelCheck: goodCheck('practice') }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What does gain staging mean, and why aim for -12 dBFS?',
        model: 'Setting the level at each stage so the signal stays well above the noise and well below 0 dBFS; peaks around -12 leave room for louder moments without clipping.',
      },
    },
  ],
  review: [
    { question: '0 dBFS is…', options: ['The loudest a digital signal can be', 'Silence', 'A normal speaking level'], answer: 0, explain: 'Full scale: the ceiling.' },
    { question: 'A tone at -20 dBFS with +8 dB of gain peaks at…', options: ['-12 dBFS', '-28 dBFS', '+8 dBFS'], answer: 0, explain: 'Decibels add.' },
    { question: 'Headroom is…', options: ['The space between your peaks and 0 dBFS', 'The noise floor', 'The input latency'], answer: 0, explain: 'Room for louder moments.' },
    { question: 'CLIP and IN light up. What do you turn down first?', options: ['The gain on your interface', 'Your speakers', 'Nothing'], answer: 0, explain: 'IN means it clipped before GAIN, in the interface.' },
  ],
};

// ============================================================================
// 3. Monitoring and latency
// ============================================================================

const l3: Lesson = {
  id: 'audio-in-3-latency', device: 'audio-in', path: 'foundations', order: O(3), difficulty: 'intermediate',
  name: 'Monitoring and latency',
  description: 'What round-trip latency is, where it comes from, and how direct monitoring avoids it.',
  objective: 'Explain round-trip latency, read it on the panel, and choose between monitoring through the studio and direct monitoring.',
  source: SOURCE, estimatedMinutes: 7,
  prerequisites: ['audio-in-1-connect'],
  concepts: ['timing-tempo', 'signal-routing'],
  start: { values: { mute: false } },
  steps: [
    {
      kind: 'info', concept: 'timing-tempo', focus: ['latency'],
      instruction: 'Sound through the studio makes a round trip: into the interface, through the browser, back out to your speakers. LATENCY adds up each part.',
      principle: 'Every buffer on the way adds a little delay; together they make latency.',
      explanation: 'In: the interface and driver collecting samples. Base: the browser\'s own processing. Out: the trip to your speakers or headphones. Chrome reports all three; other browsers may not report the input part.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'LATENCY shows in 6, base 5 and out 20 ms. How late do you hear a hardware synth through the studio?',
        options: ['About 31 ms', 'About 6 ms', 'About 20 ms'], answer: 0,
        explain: 'The parts add up: 6 + 5 + 20 = 31 ms, about a 32nd note at 120 BPM. Playing fast parts, you would feel it.',
      },
    },
    {
      kind: 'info', concept: 'timing-tempo', focus: ['latency'],
      instruction: 'Under 10 ms feels instant; up to 20 ms is fine for most playing. More than that, lower your interface\'s buffer size.',
      principle: 'Smaller buffers mean less delay, but more work for the computer.',
      explanation: 'Buffer size is in the interface\'s control panel (or the computer\'s sound settings), often in samples: 128 samples at 48 kHz is under 3 ms. Too small and the audio crackles.',
    },
    {
      kind: 'predict', control: 'mute', targetValue: true, concept: 'signal-routing', focus: ['mute', 'latency'],
      instruction: 'Press MUTE.',
      predict: {
        question: 'Your interface has direct monitoring on. With MUTE on here, what do you hear?',
        options: ['The synth with almost no delay, straight from the interface', 'Nothing at all', 'The synth twice'], answer: 0,
        explain: 'Direct monitoring sends the input to your headphones inside the interface, before the computer. MUTE stops the delayed copy from the studio, and the meter and takes still work.',
      },
      principle: 'Direct monitoring skips the computer, so it has no round-trip delay.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'signal-routing',
      quiz: {
        question: 'You hear your synth twice, like a short slap echo. Why?',
        options: ['Direct monitoring and studio monitoring are both on', 'The cable is faulty', 'MIDI clock is wrong'], answer: 0,
        explain: 'One copy comes straight from the interface and the other a round trip later. Turn one off: direct monitoring on the interface, or MUTE here.',
      },
    },
    {
      kind: 'challenge', concept: 'signal-routing', focus: ['mute'],
      instruction: 'You want the studio\'s mixer effects on the synth while you play. Set the input to monitor through the studio.',
      checklist: [
        { text: 'The input is connected', check: s => d(s).enabled },
        { text: 'MUTE off: you hear it through the studio', check: s => !s.values.mute },
      ],
      hints: ['Effects in the studio only reach you through the studio.', 'MUTE silences the studio copy.', 'Then turn direct monitoring off on your interface, so nothing doubles.'],
      solution: { values: { mute: false }, data: input() },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'What is round-trip latency, and how can you avoid it while you play?',
        model: 'It is the delay for sound to go through the interface and the computer and back to your ears; lower the buffer size, or listen with direct monitoring while the studio records.',
      },
    },
  ],
  review: [
    { question: 'Round-trip latency is…', options: ['The delay from the instrument through the computer back to your ears', 'The time MIDI takes to start', 'How long a note lasts'], answer: 0, explain: 'In + processing + out.' },
    { question: 'Smaller audio buffers give…', options: ['Less latency but more CPU load', 'More latency', 'Better sound quality'], answer: 0, explain: 'Too small and it crackles.' },
    { question: 'Direct monitoring…', options: ['Sends the input to your headphones inside the interface, with almost no delay', 'Records the input', 'Mutes the synth'], answer: 0, explain: 'It skips the computer.' },
    { question: 'Hearing the synth twice means…', options: ['Direct and studio monitoring are both on', 'It is in stereo', 'The gain is too high'], answer: 0, explain: 'Turn one of them off.' },
  ],
};

// ============================================================================
// 4. Into the mixer and onto disk
// ============================================================================

const l4: Lesson = {
  id: 'audio-in-4-route-record', device: 'audio-in', path: 'foundations', order: O(4), difficulty: 'intermediate',
  name: 'Into the mixer and onto disk',
  description: 'Give the input its own mixer channel, then record a clean take of it on its own.',
  objective: 'Route the input to a mixer channel, record a take of it on its own, and know when to use REC instead.',
  source: SOURCE, estimatedMinutes: 8,
  prerequisites: ['audio-in-2-gain'],
  requires: ['xone96'],
  concepts: ['mixing', 'gain-staging', 'signal-routing'],
  start: { values: { mute: false } },
  steps: [
    {
      kind: 'do', concept: 'signal-routing', focus: ['source'],
      instruction: 'Connect a source: your synth through the interface, or the Practice synth.',
      check: s => d(s).enabled && d(s).source !== 'tone',
      solution: { data: input() },
      principle: 'Routing starts at the source: one instrument, one input.',
    },
    {
      kind: 'info', concept: 'mixing', focus: ['route'],
      instruction: 'A mixer channel gives one instrument its own gain, EQ, filter and fader. OUTPUT decides where this input goes.',
      principle: 'Routing decides where a signal goes next; a channel lets you shape it on its own.',
      explanation: 'Master out mixes it straight into the studio\'s output. A Xone:96 channel puts it next to the drums and twins, where you balance the whole track.',
    },
    {
      kind: 'challenge', concept: 'mixing', focus: ['route'],
      instruction: 'Set OUTPUT to a Xone:96 channel, such as STUDIO 1.',
      checklist: [{ text: 'OUTPUT is a mixer channel', check: onMixer }],
      hints: ['OUTPUT is at the bottom left of this panel.', 'Pick "Xone:96 · STUDIO 1".', 'Only Master out listed? The mixer has no studio inputs yet: press Skip.'],
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'mixing',
      quiz: {
        question: 'Why record the synth on its own, as well as the whole mix?',
        options: ['You can mix, edit or replace it later without touching the rest', 'It sounds louder', 'It uses less memory'], answer: 0,
        explain: 'A separate track (a stem) keeps your options open: fix one note, change its EQ or send it to a collaborator. REC in the top bar records only the finished mix.',
      },
    },
    {
      kind: 'predict', concept: 'mixing', focus: ['record'],
      instruction: 'Press Record take, let a few bars play, then press it again. The WAV file goes to your downloads.',
      predict: {
        question: 'Record take starts the studio too. What will the file contain?',
        options: ['Only this input, after GAIN', 'The whole mix', 'The MIDI notes'], answer: 0,
        explain: 'A take records this input alone, after GAIN and before MUTE, so it works while you monitor directly. The studio starts so your sequencer plays the synth during the take.',
      },
      check: s => d(s).takes.length >= 1,
      solution: { data: input({ takes: [{ n: 1, seconds: 8, peakDb: -11.5, at: 1 }] }) },
      principle: 'Recording each part separately keeps every decision open until the mix.',
    },
    {
      kind: 'challenge', concept: 'gain-staging', focus: ['level-check', 'record'],
      instruction: 'Record a clean take: check the level until it says Good, then record a take that never clips.',
      checklist: [
        { text: 'A level check of this source says Good', check: s => levelIsGood(d(s)) && d(s).levelCheck?.source === d(s).source },
        { text: 'A take whose peaks stay below -1 dBFS', check: s => d(s).takes.some(t => t.peakDb < -1 && t.peakDb > -60) },
      ],
      hints: ['Level first, then record.', 'The take list at the bottom shows each take\'s peak.', 'Peaks above -1 dBFS? Turn GAIN down a little and record again.'],
      solution: { data: input({ levelCheck: goodCheck('practice'), takes: [{ n: 1, seconds: 8, peakDb: -10.8, at: 1 }] }) },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'When do you use Record take, and when REC in the top bar?',
        model: 'Record take saves one input on its own, a stem to edit or mix later; REC records the finished mix of the whole studio.',
      },
    },
  ],
  review: [
    { question: 'A mixer channel gives an instrument…', options: ['Its own gain, EQ, filter and fader', 'A new tempo', 'More notes'], answer: 0, explain: 'Independent control in the mix.' },
    { question: 'A take of one input is often called…', options: ['A stem or track', 'A patch', 'A preset'], answer: 0, explain: 'One part, recorded alone.' },
    { question: 'Record take reads the input…', options: ['After GAIN and before MUTE', 'After the master limiter', 'Before the interface'], answer: 0, explain: 'So it records while you monitor directly.' },
  ],
};

// ============================================================================
// Studio: your hardware synth in the studio
// ============================================================================

const st1: Lesson = {
  id: 'audio-in-studio-1-hardware-synth', device: 'audio-in', path: 'studio', order: 6, difficulty: 'intermediate',
  name: 'Your hardware synth in the studio',
  description: 'The whole loop: MIDI notes and clock out to a synth, its audio back in, on a mixer channel, recorded as a take.',
  objective: 'Play a synth from the studio over MIDI, bring its audio back in, put it on a mixer channel and record a take.',
  source: SOURCE, estimatedMinutes: 12,
  prerequisites: ['audio-in-2-gain'],
  requires: ['midi-synth', 'xone96'],
  concepts: ['signal-routing', 'timing-tempo', 'gain-staging', 'mixing'],
  start: { values: { mute: false } },
  steps: [
    {
      kind: 'info', concept: 'signal-routing',
      instruction: 'The loop: the studio sends MIDI notes and clock to the synth, and the synth\'s audio comes back in here. No gear? The Practice synth plays both parts.',
      principle: 'MIDI goes out, audio comes back: two different cables doing two different jobs.',
      explanation: 'With hardware: USB or a MIDI interface carries MIDI to the synth; a cable from the synth\'s output to your audio interface brings the sound back.',
    },
    {
      kind: 'challenge', concept: 'timing-tempo', instance: 'midi-synth', focus: ['setup', 'clock'],
      instruction: 'In the Studio tab, open Your synth\'s Setup: choose its output (or Practice synth) and tick Send MIDI clock. Then come back here.',
      checklist: [
        { text: 'Your synth has an output', check: s => synths(s).some(x => !!x.port) },
        { text: 'MIDI clock is sent to it', check: s => synths(s).some(x => x.clock && !!x.port) },
      ],
      hints: ['The Studio tab shows every instrument; Setup… is on Your synth\'s panel.', 'Send MIDI clock is under "Where the MIDI goes".', 'Come back with this tab (Audio input) at the top.'],
    },
    {
      kind: 'do', concept: 'signal-routing', focus: ['source', 'connect'],
      instruction: 'Here, connect the input your synth is plugged into, or choose Practice synth.',
      check: s => d(s).enabled && d(s).source !== 'tone',
      solution: { data: input() },
      principle: 'The audio input is where the synth joins the studio\'s mix.',
      explanation: 'With the Practice synth, its direct sound switches off as soon as an input listens, just as you would turn off direct monitoring on a real interface.',
    },
    {
      kind: 'predict', concept: 'gain-staging', focus: ['level-check'],
      instruction: 'Press Check level while the synth plays (the Practice synth plays by itself).',
      predict: {
        question: 'Where should the synth\'s loudest peaks sit?',
        options: ['Around -12 dBFS', 'At 0 dBFS, as loud as possible', 'Around -40 dBFS, to be safe'], answer: 0,
        explain: 'Around -12 dBFS leaves headroom for accents and resonance, and stays well clear of the noise. 0 dBFS clips; -40 is buried and noisy once you turn it up.',
      },
      check: s => !!d(s).levelCheck && d(s).levelCheck!.source === d(s).source,
      solution: { data: input({ levelCheck: goodCheck('practice') }) },
      principle: 'Set the level where the sound enters, before anything else in the chain.',
    },
    {
      kind: 'challenge', concept: 'mixing', focus: ['route'],
      instruction: 'Put it on the mixer: set OUTPUT to a Xone:96 channel, such as STUDIO 1.',
      checklist: [{ text: 'OUTPUT is a mixer channel', check: onMixer }],
      hints: ['OUTPUT is at the bottom left of this panel.', 'Pick "Xone:96 · STUDIO 1".', 'Only Master out listed? The mixer has no studio inputs yet: press Skip.'],
    },
    {
      kind: 'do', concept: 'mixing', focus: ['record'],
      instruction: 'Press Record take: the studio starts, the sequencer plays the synth, and this input is recorded. Press it again after a few bars.',
      check: s => d(s).takes.length >= 1,
      solution: { data: input({ levelCheck: goodCheck('practice'), takes: [{ n: 1, seconds: 8, peakDb: -11.2, at: 1 }] }) },
      principle: 'A take is a performance captured as audio: from now on it plays back the same every time.',
      explanation: 'The take is this input alone. For the whole track, use REC in the top bar.',
    },
    {
      kind: 'quiz', instruction: 'Quick check.', concept: 'timing-tempo',
      quiz: {
        question: 'Through the studio, the hardware sounds a little late compared with the twins. Why?',
        options: ['Its audio makes a round trip through the interface and the computer', 'MIDI is slow', 'The mixer adds an echo'], answer: 0,
        explain: 'MIDI arrives on time (it is sent early with timestamps), but the sound then takes the input latency to come back. A small negative Offset in MIDI settings lines it up.',
      },
    },
    {
      kind: 'reflect', instruction: 'Explain it in your own words.',
      reflect: {
        prompt: 'Describe the path from the studio\'s ▶ to a recorded take of your synth.',
        model: 'The sequencer sends notes and the studio sends clock over MIDI; the synth plays; its audio comes back through the interface into Audio input, then to a mixer channel, and Record take saves it.',
      },
    },
  ],
  review: [
    { question: 'To record a hardware synth, its sound must…', options: ['Come back in through an audio input', 'Travel over MIDI', 'Be sent as clock'], answer: 0, explain: 'MIDI carries no audio.' },
    { question: 'MIDI clock to the synth makes…', options: ['Its arpeggiator and sequencer follow the studio tempo', 'Its sound louder', 'Its audio come back'], answer: 0, explain: 'Clock is timing only.' },
    { question: 'Hardware sounds late through the studio because of…', options: ['Input latency on the way back', 'Slow MIDI', 'The mixer'], answer: 0, explain: 'Fix it with a small negative offset.' },
  ],
};

export const AUDIO_IN_LESSONS: Lesson[] = [l1, l2, l3, l4, st1];
