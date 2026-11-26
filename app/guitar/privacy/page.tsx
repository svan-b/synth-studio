import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy, Fretward',
  description: 'Fretward collects nothing about you.',
};

const UPDATED = '25 November 2026';

const SECTIONS: Array<{ heading: string; text: string }> = [
  {
    heading: 'What stays on your iPad',
    text:
      'Your progress and settings are stored on your iPad, in the app’s own storage. Each day you play, the app also puts a dated copy of your progress in its folder in the Files app, keeping the last thirty, so you have backups you can see. If you back up your iPad with iCloud or a computer, those backups include this, as they do for any app.',
  },
  {
    heading: 'The microphone',
    text:
      'The app listens to your guitar through the iPad’s microphone, to tune it and to follow along as you play. The sound is worked on as it arrives and is not sent anywhere. The iPad asks your permission first, and you can turn it off again in the iPad’s Settings.',
  },
  {
    heading: 'Recordings',
    text:
      'When you finish learning a song, the app keeps a recording of that first time through, and of your latest. They are kept on your iPad and shown in the Files app, under Fretward, Recordings, so you can play them or share them. They leave the iPad only if you share them yourself.',
  },
  {
    heading: 'Reminders',
    text:
      'If you choose a time to play, the iPad itself reminds you on days you have not played yet. The reminder is set on the iPad and nothing is sent to a server. You can turn reminders off in the app or in the iPad’s Settings.',
  },
  {
    heading: 'The iPad’s volume',
    text: 'During the sound check the app reads how loud the iPad is set, to tell you if it is too quiet beside your guitar. It is not kept.',
  },
  {
    heading: 'When something leaves the app',
    text:
      'Only when you send it yourself. Saving a backup or sharing a recording opens the iPad’s share sheet, and what you share goes where you choose. The developer never receives it.',
  },
  {
    heading: 'Deleting your data',
    text: 'Deleting the app removes everything it stored, including its folder in the Files app and its recordings.',
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
    text: 'Write to scott.vanbolhuis@gmail.com.',
  },
];

/** The privacy policy at a public address, for the App Store listing. */
export default function PrivacyPage() {
  return (
    <div className="os-root" data-theme="light">
      <main className="os-scroll h-full">
        <article className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-[0.95rem] font-semibold uppercase tracking-widest text-os-muted">Fretward</p>
          <h1 className="mb-6 mt-1 font-os-serif text-5xl">Privacy</h1>
          <p className="text-[1rem] text-os-muted">Last changed {UPDATED}</p>
          <p className="mt-3 text-[1.25rem] leading-relaxed text-os-ink">
            Fretward collects nothing about you. It has no accounts, no advertising, no analytics and no tracking, and the iPad app does not connect to the internet.
          </p>
          <div className="mt-6 space-y-6">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="font-os-serif text-2xl">{s.heading}</h2>
                <p className="mt-2 text-[1.05rem] leading-relaxed text-os-ink">{s.text}</p>
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
