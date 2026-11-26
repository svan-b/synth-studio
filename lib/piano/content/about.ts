/**
 * What the app says about privacy, and the credit it gives for the work of
 * others it contains. The same words are shown inside the app and on the
 * privacy web page, so the two cannot drift apart.
 *
 * Every statement here has to stay true of the code. If the app ever starts
 * to send, keep or share something new, this is the first thing to change.
 */

export interface AboutSection {
  heading: string;
  text: string;
  links?: Array<{ label: string; href: string }>;
}

/** The day the privacy policy was last changed. */
export const PRIVACY_UPDATED = '25 November 2026';

export const PRIVACY_INTRO =
  'Keyward collects nothing about you. It has no accounts, no advertising, no analytics and no tracking, and the iPad app does not connect to the internet.';

export const PRIVACY: AboutSection[] = [
  {
    heading: 'What stays on your iPad',
    text:
      'Your progress, your settings, and the recordings the app keeps of pieces you have learned are stored on your iPad, in the app’s own storage. A recording here is the keys you pressed and when, not sound.\n\nEach day you practise, the app also puts a dated copy of your progress in its folder in the Files app, keeping the last thirty, so you have backups you can see. If you back up your iPad with iCloud or a computer, those backups include this, as they do for any app.',
  },
  {
    heading: 'The microphone',
    text:
      'If you choose to have the app listen to your piano through the microphone, it uses the sound to work out which notes you play. The sound is worked on as it arrives, and it is never recorded, kept or sent anywhere. The iPad asks your permission first, and you can turn it off again in the iPad’s Settings.',
  },
  {
    heading: 'Bluetooth and MIDI',
    text:
      'Bluetooth is used only to connect to a piano that has Bluetooth MIDI. Over MIDI the app receives the keys and pedals you play, and sends notes to the piano when it plays you a demonstration. Nothing else passes between them.',
  },
  {
    heading: 'When something leaves the app',
    text:
      'Only when you send it yourself. Saving a backup or sharing the connection report opens the iPad’s share sheet, and what you share goes where you choose. The developer never receives it.',
  },
  {
    heading: 'Deleting your data',
    text: 'Start over, in Settings, erases your progress. Deleting the app removes everything it stored, including its folder in the Files app.',
  },
  {
    heading: 'Children',
    text: 'The app collects nothing from anyone, children included.',
  },
  {
    heading: 'The web version',
    text:
      'The same teacher can be opened in a web browser. There your progress is kept in that browser only. The company that hosts the website receives what any website receives in order to send you its pages, such as your IP address. The app adds nothing to that.',
  },
  {
    heading: 'Changes',
    text: 'If any of this changes, this page will say so before the change reaches the app, with a new date at the top.',
  },
  {
    heading: 'Questions',
    text: 'Use the support link on the app’s App Store page.',
  },
];

export const CREDITS: AboutSection[] = [
  {
    heading: 'The piano sound',
    text:
      'Salamander Grand Piano V3, recorded by Alexander Holm, used under the Creative Commons Attribution 3.0 licence. For this app one of its sixteen loudness layers is used, and each recording was shortened, faded out at its end and encoded again as MP3. When your piano is connected over MIDI, it can play the demonstrations in its own sound.',
    links: [
      { label: 'The recordings', href: 'https://archive.org/details/SalamanderGrandPianoV3' },
      { label: 'The licence', href: 'https://creativecommons.org/licenses/by/3.0/' },
    ],
  },
  {
    heading: 'The music symbols',
    text:
      'Notes, clefs and the other symbols are drawn from Bravura, a music font by Steinberg Media Technologies, in the form converted for VexFlow, under the SIL Open Font License 1.1.',
    links: [{ label: 'The licence', href: 'https://openfontlicense.org' }],
  },
  {
    heading: 'Software',
    text:
      'Notation is drawn with VexFlow, and reviews are scheduled with ts-fsrs. The app is built with Next.js, React and Zustand. Each is open source under its own licence, and the full texts follow.',
  },
  {
    heading: 'The music',
    text: 'Every piece in the course is traditional, by a composer whose work is in the public domain, or written for this course. The arrangements and fingerings were made for it.',
  },
];

/** Where the full licence texts are, beside the app's other files. */
export const LICENCES_PATH = '/piano/licences.txt';
