/**
 * The teaching method, with the studies behind each choice and an honest
 * note on how strong the evidence is. Shown on the Method page.
 *
 * Choices shared with the piano app keep its sources. Those new to the
 * guitar, and those about keeping going, were checked against the papers
 * themselves before being written here.
 */

export type Strength = 'strong' | 'moderate' | 'limited';

export interface Principle {
  title: string;
  what: string;
  evidence: string;
  strength: Strength;
  sources: string[];
}

export const PRINCIPLES: Principle[] = [
  {
    title: 'Hear it before you play it',
    what: 'Every new song and chord is played for you first, and the Hear it button is always there.',
    evidence: 'Beginners who heard a model performance before practising improved more during practice and were still ahead the next day.',
    strength: 'moderate',
    sources: ['Cash, Allen, Simmons and Duke, 2014, Journal of Research in Music Education'],
  },
  {
    title: 'Right chords first, then the beat, then speed',
    what: 'A new song starts with its chord changes in your own time, because the music waits for you. Then one strum on each beat of a slow click, then the song\'s own strum, then faster. Speed goes up after two good runs in a row, or one clean one.',
    evidence:
      'Among 17 advanced pianists, practice time and repetitions did not predict how well a passage was played the next day. The share of correct attempts did, along with slowing down to get things right. It is one small study of pianists, and no trial has compared this with practising at speed.',
    strength: 'moderate',
    sources: ['Duke, Simmons and Cash, 2009, Journal of Research in Music Education', 'Allingham and Wöllner, 2022, Psychology of Music'],
  },
  {
    title: 'Practise the change, not just the chord',
    what: 'Most beginners can hold a chord. What stops a song is getting from one chord to the next in time. So the change itself is practised, back and forth and a minute at a time, counting the clean ones. When a song keeps catching on one change, the coach takes that change out, drills it, and puts it back. Pairs of chords are mixed, not drilled one pair for a long time.',
    evidence:
      'Studies of practice order in music found that mixing what is practised felt worse at the time but was better later. Beginning clarinettists who practised in mixed order played faster at a retention test, and pianists who mixed melodies were faster two days later while believing the opposite. These are small studies on other instruments. No study has tested guitar chord changes, so the minute of changes is a teaching tradition built on that idea.',
    strength: 'limited',
    sources: [
      'Stambaugh, 2011, Journal of Research in Music Education',
      'Abushanab and Bishara, 2013, Memory and Cognition',
      'Carter and Grahn, 2016, Frontiers in Psychology',
    ],
  },
  {
    title: 'Practise what you cannot yet play',
    what: 'The first time you open a song you play it through once. Lines you already have are not drilled again, and a clean run moves you on without a repeat.',
    evidence:
      'Accounts of how experts practise put the work on what cannot yet be done, and in the pianist study above neither time nor repetitions predicted the result. Across many studies, hours of this kind of practice explain about a fifth of the differences between musicians. That is a great deal, but not everything.',
    strength: 'limited',
    sources: ['Ericsson, Krampe and Tesch-Römer, 1993, Psychological Review', 'Macnamara, Hambrick and Oswald, 2014, Psychological Science', 'Duke, Simmons and Cash, 2009'],
  },
  {
    title: 'Take trouble spots out and fix them',
    what: 'After a run the coach says where it went wrong and, when the playing shows it, why, such as a late change, strums rushing ahead, or a string that did not ring. The trouble spot is practised on its own, then put back.',
    evidence: 'The best practisers in the pianist study stopped at errors, found exactly where they came from, and repeated the spot until it was right. Beginners left alone mostly play pieces straight through.',
    strength: 'moderate',
    sources: ['Duke, Simmons and Cash, 2009', 'McPherson and Renwick, 2001, Music Education Research'],
  },
  {
    title: 'Check a chord one string at a time',
    what: 'Each new chord is played one string at a time, and the app says which strings rang and which did not. A muted string is told apart from a wrong note, so you know whether to move a finger or press differently.',
    evidence: 'This is how guitar teachers check a chord, and it gives exact feedback on the one thing to fix. It is a teaching tradition, not a tested method.',
    strength: 'limited',
    sources: [],
  },
  {
    title: 'A little on most days',
    what: 'Sessions are short, ten to thirty minutes. The app stops a song when its time is up and tells you to come back tomorrow. It also gives sore fingertips the time they need to toughen.',
    evidence:
      'Spreading practice out beats cramming across hundreds of memory experiments, and across movement tasks too. In one study of musicians learning a short sequence, accuracy improved between sessions only when they were a day apart, which suggests the skill settles overnight.',
    strength: 'strong',
    sources: [
      'Cepeda and colleagues, 2006, Psychological Bulletin',
      'Donovan and Radosevich, 1999, Journal of Applied Psychology',
      'Simmons, 2011, Journal of Research in Music Education',
      'Simmons and Duke, 2006, Journal of Research in Music Education',
    ],
  },
  {
    title: 'A time and a place to play',
    what: 'When you start, you choose a time of day to play, and the iPad app can remind you then. Keeping the guitar out on a stand, where you see it, makes picking it up the easy thing to do.',
    evidence:
      'A plan of the form "when it is this time, I will do this" helps people follow through. A review of 642 tests found the effect real but small, smaller once bias in the published studies is allowed for. Habits form with repetition in the same setting. In one study they took 66 days on average to become automatic, from 18 days to 254.',
    strength: 'moderate',
    sources: [
      'Gollwitzer, 1999, American Psychologist',
      'Sheeran, Listrom and Gollwitzer, 2024, European Review of Social Psychology',
      'Lally, van Jaarsveld, Potts and Wardle, 2010, European Journal of Social Psychology',
    ],
  },
  {
    title: 'A missed day is just a missed day',
    what: 'Progress shows the days you played this week, not a run of days that one gap would wipe out. After a break, the app welcomes you back with a short, easy session instead of a reproach.',
    evidence:
      'In the habit study, missing a single day did not materially slow a habit forming, though many missed days did. In a large trial with 61,293 gym members, the most effective of 54 programmes was a small reward for coming back after a missed workout. That reward was money, so a welcome back in an app is a reasoned step from it, not a tested one.',
    strength: 'moderate',
    sources: ['Lally, van Jaarsveld, Potts and Wardle, 2010', 'Milkman and colleagues, 2021, Nature'],
  },
  {
    title: 'Songs from the first week',
    what: 'A real song comes in the first week, and the songbook keeps growing as the chords you know grow. You can open any song you have the chords for, at any time.',
    evidence:
      'Fender, the guitar maker, reports that most new players give up within a year, and in its survey of beginners a third said progress felt too slow and most wanted to learn songs. That is a company\'s survey, not published research. In a close study of one young learner, practice on a piece she chose was longer and more thoughtful than on pieces set for her.',
    strength: 'limited',
    sources: ['Fender, 2018, survey of beginning players', 'Renwick and McPherson, 2002, British Journal of Music Education'],
  },
  {
    title: 'See your progress',
    what: 'The Progress page keeps what you have done, with songs learned, your best minute of changes for each pair of chords, the days you played, and recordings of you playing.',
    evidence: 'A review of 138 experiments found that keeping track of progress helps people reach their goals, more so when the progress is recorded rather than just noticed.',
    strength: 'strong',
    sources: ['Harkin and colleagues, 2016, Psychological Bulletin'],
  },
  {
    title: 'Help that fades',
    what: 'Chord pictures and the next note are shown at first, then only after a pause or two tries. A pause to think is never counted as a mistake.',
    evidence: 'Guidance helps beginners with complex tasks, and guidance that fades as skill grows looks better than guidance that never goes. The evidence is mixed, so this is a careful default.',
    strength: 'limited',
    sources: ['Sigrist and colleagues, 2013, Psychonomic Bulletin and Review', 'McKay and colleagues, 2022, Psychology of Sport and Exercise'],
  },
  {
    title: 'By ear as well as by eye',
    what: 'From the first lesson you find strings and copy short patterns by ear, and tell major from minor by listening.',
    evidence: 'Students taught to play by ear did better on every listening measure in a matched comparison. Most of this evidence comes from children.',
    strength: 'moderate',
    sources: ['Baker and Green, 2013, Research Studies in Music Education', 'McPherson, 2005, Psychology of Music'],
  },
  {
    title: 'Count, and keep the click audible',
    what: 'Rhythm is taught by counting and by a strumming hand that never stops, like a pendulum. The metronome is a sound, not a flashing light.',
    evidence: 'Counting systems are among the rhythm teaching methods that hold up across studies, and people keep time more steadily to a sound than to a light.',
    strength: 'moderate',
    sources: ['Mishra, 2016, Psychology of Music', 'Repp and Su, 2013, Psychonomic Bulletin and Review'],
  },
  {
    title: 'Judge it yourself first',
    what: 'After a run with the beat, the app pauses for a moment and asks you to decide how it went before it shows the result.',
    evidence: 'In a classic experiment, instant feedback after every attempt hurt later retention, while estimating your own error first helped.',
    strength: 'limited',
    sources: ['Swinnen and colleagues, 1990, Journal of Experimental Psychology: Learning, Memory, and Cognition'],
  },
  {
    title: 'Hear yourself from the outside',
    what: 'After a run you can hear a recording of your own playing. The first time through a learned song is kept, with your latest, so you can hear how far you have come, and share it.',
    evidence: 'Players judge their own playing differently once they hear a recording of it, mostly more critically. Judging their own playing helped young players when they also had a model to compare with, so the two buttons sit side by side.',
    strength: 'limited',
    sources: ['Silveira and Gavin, 2016, Psychology of Music', 'Hewitt, 2001, Journal of Research in Music Education'],
  },
  {
    title: 'Spaced review, for chords and songs',
    what: 'Chords you have learned come back for a quick check, from their names, on a schedule that stretches as you get them right. Learned songs come back now and then for a play through.',
    evidence:
      'Recalling something at growing intervals is one of the best supported findings about memory for facts. A test of it for memorising melodies found no benefit, so here it is used for recalling chord shapes and keeping songs alive, not as a rule for everything.',
    strength: 'strong',
    sources: ['Roediger and Karpicke, 2006, Psychological Science', 'Telesco and colleagues, 2021, College Music Symposium'],
  },
  {
    title: 'Never too late',
    what: 'The course is paced for a grown up beginner, with plain words, short sessions, and no hurry.',
    evidence:
      'Adults starting an instrument in later life make real progress. In one trial, people of 60 to 85 with no training improved after six months of piano lessons. In two recent studies, beginners in their sixties and seventies made measurable gains within a year, and kept them. None of these studies were of guitar.',
    strength: 'moderate',
    sources: ['Bugos and colleagues, 2007, Aging and Mental Health', 'Losch and colleagues, 2024, BMC Geriatrics', 'Chmiel and colleagues, 2025, PLoS ONE'],
  },
  {
    title: 'Your choices',
    what: 'You can open any song you have the chords for, practise your own way, take a lesson early, and see the plan the coach is following.',
    evidence:
      'Feeling capable and in control of what you play goes with keeping going on an instrument. Claims that small choices also speed up learning have shrunk under analyses that correct for bias, so choice is offered here because it is yours, not as a trick.',
    strength: 'moderate',
    sources: ['McPherson and McCormick, 2006, Psychology of Music', 'Evans, McPherson and Davidson, 2013, Psychology of Music', 'McKay and colleagues, 2022, Meta-Psychology'],
  },
  {
    title: 'End on something that goes well',
    what: 'When there is time, a session closes with a song you already play well.',
    evidence: 'People judge an experience largely by how it ended, and are more willing to repeat one that ended well. That comes from studies of discomfort, not music, so this is a reasoned choice about wanting to come back tomorrow.',
    strength: 'limited',
    sources: ['Kahneman, Fredrickson, Schreiber and Redelmeier, 1993, Psychological Science'],
  },
];

export const NOT_USED: Array<{ title: string; why: string }> = [
  {
    title: 'A count of days in a row',
    why: 'Such counters reset to zero after one gap, which makes a missed day feel like a loss. One missed day does not undo a habit forming, so the app shows the days played this week instead.',
  },
  {
    title: 'Lights to follow on the neck',
    why: 'In an experiment with a lit fretboard, results were mixed, and the lights have to go away eventually. The app shows where the fingers go at first, then steps back.',
  },
  {
    title: 'A fixed success rate',
    why: 'The idea that learning is fastest at a set rate of success comes from computer learning, not hands. Difficulty here simply follows how you are doing.',
  },
  {
    title: 'Forced rests between tries',
    why: 'Later work argues that short rests only let tiredness clear and add no learning. You pause when you like.',
  },
];

export const TIPS: string[] = [
  'Ten good minutes today are worth more than an hour at the weekend, and your fingertips toughen faster that way.',
  'Leave the guitar out on a stand, where you will see it. A guitar in its case gets played less.',
  'Tune before you play, every time. Nothing sounds right out of tune, and tuning trains your ear.',
  'Press just behind the fret, with the very tip of the finger. Less pressure than you think.',
  'When a change is hard, look at the next shape before you move, then move all the fingers at once.',
  'Keep the strumming hand moving, even when a chord is late. The beat matters more than any one chord.',
  'If a chord sounds dull, pick it one string at a time to find the finger that is in the way.',
  'Sing or hum along. Your hands follow your voice.',
  'Missed a day? Just pick it up again. One day off does not undo a habit.',
  'Stop before your fingertips hurt. Tender is normal in the first weeks. Pain means rest.',
  'End each session with a song you already play well.',
  'Play for someone. A song at a birthday is the best practice there is.',
  'What felt hard today will often feel easier tomorrow, with no extra work. That is your memory settling.',
];
