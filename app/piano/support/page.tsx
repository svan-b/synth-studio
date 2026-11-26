import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support, Keyward',
  description: 'How to get help with Keyward.',
};

/** The support page for the App Store listing. */
export default function SupportPage() {
  return (
    <div className="mc-root" data-theme="light">
      <main className="mc-scroll h-full">
        <article className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-[0.95rem] font-semibold uppercase tracking-widest text-mc-muted">Keyward</p>
          <h1 className="mb-6 mt-1 font-mc-serif text-5xl">Support</h1>
          <p className="text-[1.25rem] leading-relaxed text-mc-ink">
            Questions, problems or ideas: write to{' '}
            <a className="underline" href="mailto:scott.vanbolhuis@gmail.com?subject=Keyward">scott.vanbolhuis@gmail.com</a>. Say which iPad and which piano you use and what happened, and you will get an answer.
          </p>
          <h2 className="mt-8 font-mc-serif text-2xl">If the app cannot find your piano</h2>
          <p className="mt-2 text-[1.05rem] leading-relaxed text-mc-ink">
            Connect the piano by USB cable or Bluetooth MIDI and open Settings, Your piano. A Bluetooth piano is paired from inside the app, not from the iPad’s Bluetooth settings. Without MIDI the app can listen through the microphone, or you can play on the screen.
          </p>
          <p className="mt-8 text-[1.05rem]">
            <a className="underline" href="/piano/privacy">Privacy</a>
          </p>
        </article>
      </main>
    </div>
  );
}
