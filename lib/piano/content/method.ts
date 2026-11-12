/**
 * The teaching method, with the studies behind each choice and an honest
 * note on how strong the evidence is. Shown on the Method page.
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
    what: 'Every new phrase is played for you first, and the Hear it button is always there.',
    evidence:
      'Beginners who heard a model performance before practising improved more during practice and were still ahead the next day.',
    strength: 'moderate',
    sources: ['Cash, Allen, Simmons and Duke, 2014, Journal of Research in Music Education'],
  },
  {
    title: 'Right notes first, then the beat, then speed',
    what: 'New notes are learned with no time pressure, because the music waits for you. A slow beat comes next, and the tempo rises only after two good passes in a row.',
    evidence:
      'Among 17 advanced pianists, practice time and number of repetitions did not predict how well a passage was played the next day. The share of correct attempts did, along with slowing down to get things right and fixing errors at once. This is one small study of advanced players, and no controlled trial has compared slow then faster against practising at speed.',
    strength: 'moderate',
    sources: ['Duke, Simmons and Cash, 2009, Journal of Research in Music Education', 'Allingham and Wöllner, 2022, Psychology of Music'],
  },
  {
    title: 'Take trouble spots out and fix them',
    what: 'When the same measure trips you twice, the coach isolates it, has you play it right twice, and puts it back.',
    evidence:
      'The best practisers in the same study stopped at errors, located their source precisely, and repeated the spot until it was correct and stable. Beginners left alone mostly play pieces straight through.',
    strength: 'moderate',
    sources: ['Duke, Simmons and Cash, 2009', 'McPherson and Renwick, 2001, Music Education Research'],
  },
  {
    title: 'Hands together early',
    what: 'Each hand gets one pass alone, then they play together. Early two hand pieces keep one part very simple.',
    evidence:
      'Older studies found learning hands together more efficient. A modern experiment found that what is learned one handed transfers only a little to two handed playing, about a tenth of the gain. There is no good trial with beginners, so this is a reasoned choice more than a proven one.',
    strength: 'limited',
    sources: ['Yokoi, Bai and Diedrichsen, 2017, Journal of Neurophysiology', 'Brown, 1933, Journal of Experimental Psychology'],
  },
  {
    title: 'A little on most days',
    what: 'Sessions are short and daily. The app stops you when the time for a piece is up and tells you to come back tomorrow.',
    evidence:
      'Spreading practice out beats cramming across hundreds of memory experiments, and across movement tasks as well. Keyboard studies show gains after a night that includes sleep, though whether sleep adds skill or only protects it is debated. One piano study found no benefit from gaps of a few minutes, so the spacing that matters is across days.',
    strength: 'strong',
    sources: [
      'Cepeda and colleagues, 2006, Psychological Bulletin',
      'Simmons and Duke, 2006, Journal of Research in Music Education',
      'Pan and Rickard, 2015, Psychological Bulletin',
      'Wiseheart, D\'Souza and Chae, 2017, PLoS ONE',
    ],
  },
  {
    title: 'One new thing at a time',
    what: 'A session has at most one new lesson, and then goes back to pieces you are already learning.',
    evidence: 'In one study, learning a second melody straight after the first wiped out the overnight gain on the first, unless the first was played again before stopping.',
    strength: 'limited',
    sources: ['Allen, 2013, Psychology of Music'],
  },
  {
    title: 'Help that fades',
    what: 'The key to press lights up only after a pause or two wrong tries. Fingering and note names appear early and are withdrawn later.',
    evidence:
      'The old claim that constant guidance harms learning is weaker than textbooks say, and guidance helps beginners with complex tasks. What does look useful is guidance that fades as skill grows. A recent piano study found it beat fixed guidance when the help was taken away.',
    strength: 'limited',
    sources: ['Sigrist and colleagues, 2013, Psychonomic Bulletin and Review', 'McKay and colleagues, 2022, Psychology of Sport and Exercise', 'Hsieh and colleagues, 2026, preprint'],
  },
  {
    title: 'By ear as well as by eye',
    what: 'From the first lesson you copy short patterns by ear, and the first tunes are learned before any notation.',
    evidence:
      'Students taught to play by ear did better on every listening measure in a matched comparison, and a three year study of young beginners found that how they thought about music mattered more than how long they practised. Most of this evidence comes from children.',
    strength: 'moderate',
    sources: ['Baker and Green, 2013, Research Studies in Music Education', 'McPherson, 2005, Psychology of Music'],
  },
  {
    title: 'Read shapes, and look ahead',
    what: 'Reading starts from two landmark notes on each staff and then moves by step and skip. Notation is first shown for tunes you can already play.',
    evidence:
      'Skilled readers take in groups of notes and look ahead of their hands. Training studies show small gains overall, with ear training and reading in patterns among the things that help. No study shows this approach beating others for beginners, so it is used because it fits how fluent readers work.',
    strength: 'limited',
    sources: ['Furneaux and Land, 1999, Proceedings of the Royal Society B', 'Kopiez and Lee, 2008, Music Education Research', 'Mishra, 2014, Psychology of Music'],
  },
  {
    title: 'Count, and keep the click audible',
    what: 'Rhythm is taught by counting the beat, and the metronome is a sound, not a flashing light.',
    evidence: 'Counting systems with movement or drill are among the rhythm teaching methods that hold up across studies. People keep time more steadily to a sound than to a light.',
    strength: 'moderate',
    sources: ['Mishra, 2016, Psychology of Music', 'Repp and Su, 2013, Psychonomic Bulletin and Review'],
  },
  {
    title: 'Judge it yourself first',
    what: 'After a timed run the app pauses and asks you to decide how it went before it shows the result.',
    evidence: 'In a classic experiment, instant feedback after every attempt hurt later retention, while estimating your own error first helped.',
    strength: 'limited',
    sources: ['Swinnen and colleagues, 1990, Journal of Experimental Psychology: Learning, Memory, and Cognition'],
  },
  {
    title: 'Spaced review, for reading',
    what: 'Notes you have learned to read come back for review on a schedule that stretches as you get them right.',
    evidence:
      'Recalling something at growing intervals is one of the best supported findings about memory for facts. A direct test of it for memorising melodies found no benefit, so the app uses it for note reading and for keeping learned pieces alive, not as a general rule for movement.',
    strength: 'strong',
    sources: ['Roediger and Karpicke, 2006, Psychological Science', 'Telesco and colleagues, 2021, College Music Symposium'],
  },
  {
    title: 'Listen to the sound',
    what: 'Instructions point you to how the music should sound more than to what your fingers are doing.',
    evidence:
      'Music students played a passage more evenly when they attended to the sound than to their fingers. The wider claim that this always helps has shrunk under scrutiny, so it is used as a cue, not a rule.',
    strength: 'limited',
    sources: ['Duke, Cash and Allen, 2011, Journal of Research in Music Education', 'McKay and colleagues, 2024, Psychological Bulletin'],
  },
  {
    title: 'Your choices and your progress',
    what: 'You can open any piece at any time, practise your own way in Options, and see what you have learned.',
    evidence:
      'Belief in your own ability is the strongest predictor of how music students perform, and people tend to give up an instrument when they feel neither capable nor in control of what they play.',
    strength: 'moderate',
    sources: ['McPherson and McCormick, 2006, Psychology of Music', 'Evans, McPherson and Davidson, 2013, Psychology of Music'],
  },
];

export const NOT_USED: Array<{ title: string; why: string }> = [
  {
    title: 'Forced rests between tries',
    why: 'A well known study suggested that most early gains in a finger sequence happen during ten second rests. Later work argues that the rests only let fatigue clear and add no extra learning. The app lets you pause when you like and does not make you wait.',
  },
  {
    title: 'A fixed success rate',
    why: 'The idea that learning is fastest at 85 percent success was derived for learning algorithms, not hands, and a recent movement study found lower success rates taught more. Difficulty here simply follows how you are doing.',
  },
  {
    title: 'Falling notes',
    why: 'No controlled study shows that following falling blocks builds playing that survives when the blocks are gone. Reading and listening are the skills that last, so those are what the app trains.',
  },
];

export const TIPS: string[] = [
  'Slow is not a punishment. Playing slowly enough to be right is the fastest way to learn a passage.',
  'When you slip, stop there. Find the exact note, play just that spot correctly, then carry on.',
  'Look for what repeats. Most pieces are built from a few ideas used again.',
  'Before you play, look at the first note and the last. Knowing where you are going steadies everything between.',
  'Keep your shoulders loose. If you feel tension creeping in, lift your hands and let your arms hang for a moment.',
  'Ten good minutes today are worth more than an hour at the weekend.',
  'Hum the tune as you play it. If you can sing it, your hands have something to follow.',
  'In time with the beat, a wrong note is a smaller mistake than a late one. Keep going.',
  'End each session by playing something you can already play well.',
  'What felt hard today will often feel easier tomorrow, with no extra work. That is your memory settling.',
];
