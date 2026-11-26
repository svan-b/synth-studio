import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support, Fretward',
  description: 'How to get help with Fretward.',
};

/** The support page for the App Store listing. */
export default function SupportPage() {
  return (
    <div className="os-root" data-theme="light">
      <main className="os-scroll h-full">
        <article className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-[0.95rem] font-semibold uppercase tracking-widest text-os-muted">Fretward</p>
          <h1 className="mb-6 mt-1 font-os-serif text-5xl">Support</h1>
          <p className="text-[1.25rem] leading-relaxed text-os-ink">
            Questions, problems or ideas: write to{' '}
            <a className="underline" href="mailto:scott.vanbolhuis@gmail.com?subject=Fretward">scott.vanbolhuis@gmail.com</a>. Say which iPad you use and what happened, and you will get an answer.
          </p>
          <h2 className="mt-8 font-os-serif text-2xl">If the app cannot hear your guitar</h2>
          <p className="mt-2 text-[1.05rem] leading-relaxed text-os-ink">
            Check that Fretward is allowed to use the microphone, in the iPad’s Settings under Fretward. Set the iPad about an arm’s length in front of you, and run the sound check again from the app’s Settings.
          </p>
          <p className="mt-8 text-[1.05rem]">
            <a className="underline" href="/guitar/privacy">Privacy</a>
          </p>
        </article>
      </main>
    </div>
  );
}
