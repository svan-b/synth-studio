'use client';

import { useState } from 'react';
import { CREDITS, LICENCES_PATH, PRIVACY, PRIVACY_INTRO, PRIVACY_UPDATED, type AboutSection } from '@/lib/piano/content/about';
import { Button, Prose } from './ui';

function Sections({ sections }: { sections: AboutSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.heading}>
          <h3 className="font-mc-serif text-[1.4rem] text-mc-ink">{s.heading}</h3>
          <Prose text={s.text} className="mt-1.5 text-[1.1rem] leading-relaxed text-mc-muted" />
          {s.links && (
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[1.05rem]">
              {s.links.map((l) => (
                // Links leave the app. Inside the iPad app they open in the browser.
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="font-semibold text-mc-accent underline underline-offset-4">
                  {l.label}
                </a>
              ))}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/** The privacy policy, as shown in Settings and on its own web page. */
export function PrivacyText() {
  return (
    <div>
      <p className="text-[1rem] text-mc-muted">Last changed {PRIVACY_UPDATED}</p>
      <p className="mt-3 text-[1.25rem] leading-relaxed text-mc-ink">{PRIVACY_INTRO}</p>
      <div className="mt-6">
        <Sections sections={PRIVACY} />
      </div>
    </div>
  );
}

/** Credit for the work of others the app contains, with the full licence texts a tap away. */
export function CreditsText() {
  const [full, setFull] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const load = async () => {
    try {
      const res = await fetch(LICENCES_PATH);
      if (!res.ok) throw new Error(String(res.status));
      setFull(await res.text());
    } catch {
      setFailed(true);
    }
  };
  return (
    <div>
      <Sections sections={CREDITS} />
      <div className="mt-6">
        {full === null ? (
          <Button variant="soft" onClick={() => void load()}>
            Show the full licence texts
          </Button>
        ) : (
          <pre className="mc-selectable whitespace-pre-wrap rounded-2xl bg-mc-bg p-4 font-mono text-[0.8rem] leading-relaxed text-mc-muted">{full}</pre>
        )}
        {failed && <p className="mt-2 text-[1.05rem] text-mc-muted">The licence texts could not be opened just now.</p>}
      </div>
    </div>
  );
}
