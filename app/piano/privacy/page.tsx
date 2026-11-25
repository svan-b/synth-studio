import type { Metadata } from 'next';
import { PrivacyText } from '@/components/piano/About';

export const metadata: Metadata = {
  title: 'Privacy, Middle C',
  description: 'Middle C collects nothing about you.',
};

/** The privacy policy at a public address, for the App Store listing. The same text is in the app under Settings. */
export default function PrivacyPage() {
  return (
    <div className="mc-root" data-theme="light">
      <main className="mc-scroll h-full">
        <article className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-[0.95rem] font-semibold uppercase tracking-widest text-mc-muted">Middle C</p>
          <h1 className="mb-6 mt-1 font-mc-serif text-5xl">Privacy</h1>
          <PrivacyText />
        </article>
      </main>
    </div>
  );
}
