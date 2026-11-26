'use client';

import { useEffect, useState } from 'react';
import { guitar } from '@/lib/guitar/audio/engine';
import { strikeBus } from '@/lib/guitar/input/bus';
import { canSpeak, speak, stopSpeaking } from '@/lib/guitar/audio/speech';
import { textSizeOf, useGuitar, type Experience } from '@/lib/guitar/learn/store';
import { isNative, setReminder } from '@/lib/guitar/native/bridge';
import { useListening } from './hooks';
import { SoundCheck } from './Screens';
import { Button, Icon, Toggle } from './ui';

const LEVELS: Array<{ value: Experience; title: string; text: string }> = [
  { value: 'new', title: 'I am new to the guitar', text: 'Start from the very beginning, with how to hold it and your first chord.' },
  { value: 'some', title: 'I know a few chords', text: 'You can strum some chords, if not always cleanly.' },
  { value: 'returning', title: 'I used to play', text: 'You played once and want it back.' },
];

const MINUTES: Array<{ value: number; title: string; text: string }> = [
  { value: 10, title: '10 minutes', text: 'A short visit. Enough to keep moving, and easy to fit in.' },
  { value: 15, title: '15 minutes', text: 'Room for a lesson or a song, and a little practice.' },
  { value: 20, title: '20 minutes', text: 'A lesson, a song and one exercise.' },
  { value: 30, title: '30 minutes', text: 'The fullest session, for days with time to spare.' },
];

const SIZES: Array<{ value: 0 | 1 | 2; title: string; px: number }> = [
  { value: 0, title: 'Standard', px: 16 },
  { value: 1, title: 'Large', px: 18 },
  { value: 2, title: 'Largest', px: 20 },
];

const TIMES: Array<{ value: string; title: string }> = [
  { value: '08:30', title: 'In the morning' },
  { value: '12:30', title: 'Around lunch' },
  { value: '17:30', title: 'Before dinner' },
  { value: '19:30', title: 'In the evening' },
];

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${selected ? 'border-os-ink bg-os-surface' : 'border-os-line bg-os-surface/60'}`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-os-ink bg-os-ink text-os-bg' : 'border-os-line'}`}>
        {selected && <Icon.Check size={14} />}
      </span>
      <span>
        <span className="block text-[1.15rem] font-semibold">{title}</span>
        {text && <span className="block text-os-muted">{text}</span>}
      </span>
    </button>
  );
}

/** The microphone, and a first strum heard. */
function Hearing() {
  const { status, start, ask } = useListening(true);
  const [strums, setStrums] = useState(0);
  useEffect(() => strikeBus.subscribe(() => setStrums((n) => n + 1)), []);
  const level = Math.max(0, Math.min(1, (status.level + 70) / 55));
  if (ask)
    return (
      <div className="rounded-3xl bg-os-surface p-6">
        <p className="text-[1.1rem] leading-relaxed text-os-muted">
          {status.state === 'denied'
            ? "The microphone is switched off for this app. You can turn it on in the iPad's Settings, under Privacy and Security, Microphone. Until then the app can still teach and play for you, but cannot hear you."
            : status.state === 'error'
              ? `The microphone could not start. ${status.error ?? ''}`
              : 'The iPad will ask whether the app may use the microphone. It only listens while you play, and nothing you play leaves the iPad.'}
        </p>
        {status.state !== 'denied' && (
          <Button className="mt-4" onClick={start} icon={<Icon.Mic size={18} />}>
            {status.state === 'starting' ? 'Starting' : 'Let it listen'}
          </Button>
        )}
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-os-surface p-6">
        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${strums > 0 ? 'os-pop bg-os-ok text-white' : 'bg-os-raised text-os-muted'}`}>
            {strums > 0 ? <Icon.Check size={28} /> : <Icon.Mic size={26} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[1.2rem] font-semibold">{strums > 0 ? 'Heard you' : 'Strum all six strings once'}</div>
            <div className="text-os-muted">{strums > 0 ? 'The app can hear your guitar. You can strum again, or carry on.' : 'Any way you like. It does not need to be a chord.'}</div>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-os-raised" aria-hidden>
          <div className="h-full rounded-full bg-os-accent transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      </div>
      <div className="rounded-3xl bg-os-surface p-6">
        <div className="text-[1.15rem] font-semibold">Is the iPad loud enough?</div>
        <p className="mb-4 mt-1 text-os-muted">The app plays examples for you to copy, and a click to play along with. Hear each one now, and turn the iPad up until it is easy to hear from your chair.</p>
        <SoundCheck />
      </div>
    </div>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const profile = useGuitar((s) => s.profile);
  const settings = useGuitar((s) => s.settings);
  const setProfile = useGuitar((s) => s.setProfile);
  const setSettings = useGuitar((s) => s.setSettings);
  const [step, setStep] = useState(0);
  const last = 6;
  const size = textSizeOf(settings);
  const native = isNative();

  const next = () => {
    void guitar.unlock();
    setStep((s) => Math.min(last, s + 1));
  };
  const finish = () => {
    if (native && settings.reminder && profile.playAt) {
      const [h, m] = profile.playAt.split(':').map(Number);
      setReminder(true, h, m, false, 'A few minutes with your guitar? Your session is ready.');
    }
    setProfile({ onboarded: true });
    onDone();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-os-bg os-safe-top os-safe-bottom">
      <div className="os-scroll min-h-0 flex-1">
        <div key={step} className="os-fade-up mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-8 py-10">
          {step === 0 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-os-ink text-os-bg">
                <Icon.Guitar size={42} />
              </div>
              <h1 className="font-os-serif text-6xl">Open String</h1>
              <p className="mx-auto mt-4 max-w-lg text-[1.25rem] leading-relaxed text-os-muted">
                A guitar teacher that listens. It hears your guitar through the iPad, takes you forward one small step at a time, and has you playing songs in your first week.
              </p>
            </div>
          )}
          {step === 1 && (
            <>
              <h2 className="font-os-serif text-4xl">Where are you starting from?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-os-muted">The course is the same for everyone. If you have played before, you can skip what you already know.</p>
              <div className="space-y-3">
                {LEVELS.map((l) => (
                  <Choice key={l.value} selected={profile.experience === l.value} title={l.title} text={l.text} onClick={() => setProfile({ experience: l.value })} />
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-os-serif text-4xl">How long on a normal day?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-os-muted">A little each day does more than a lot now and then. Pick what you will really do. Your fingertips will thank you for keeping it short at first.</p>
              <div className="space-y-3">
                {MINUTES.map((m) => (
                  <Choice key={m.value} selected={profile.minutes === m.value} title={m.title} text={m.text} onClick={() => setProfile({ minutes: m.value })} />
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="font-os-serif text-4xl">When will you play?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-os-muted">People who pick a time and a place keep going far more often than those who wait to feel like it.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TIMES.map((t) => (
                  <Choice key={t.value} selected={profile.playAt === t.value} title={t.title} onClick={() => setProfile({ playAt: t.value })} />
                ))}
              </div>
              <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-os-line bg-os-surface/60 px-5 py-3">
                <span className="text-[1.1rem] font-semibold">Or choose a time</span>
                <input
                  type="time"
                  value={profile.playAt ?? ''}
                  onChange={(e) => setProfile({ playAt: e.target.value || null })}
                  className="h-12 rounded-2xl border border-os-line bg-os-bg px-3 text-[1.1rem]"
                />
              </label>
              {native && (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-os-line bg-os-surface/60 px-5 py-4">
                  <div>
                    <div className="text-[1.1rem] font-semibold">Remind me at that time</div>
                    <div className="text-os-muted">Only on days you have not played yet.</div>
                  </div>
                  <Toggle
                    label="Remind me"
                    value={settings.reminder}
                    onChange={(v) => {
                      setSettings({ reminder: v });
                      if (v && !profile.playAt) setProfile({ playAt: '19:30' });
                    }}
                  />
                </div>
              )}
              <h3 className="mb-3 mt-8 font-os-serif text-2xl">Where will the guitar live?</h3>
              <div className="space-y-3">
                <Choice selected={profile.guitarOut} title="Out on a stand, where I can see it" text="The best choice. A guitar in sight gets picked up." onClick={() => setProfile({ guitarOut: true })} />
                <Choice selected={!profile.guitarOut} title="In its case" text="That works too. Leave the case open, or near your chair, so it takes a moment to start." onClick={() => setProfile({ guitarOut: false })} />
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="font-os-serif text-4xl">Can you read this from your chair?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-os-muted">Set the iPad where it will stand, on a table or a stand in front of you, and sit back as you will with the guitar. Then choose the size that reads easily from there.</p>
              <div className="space-y-3">
                {SIZES.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setSettings({ textSize: o.value })}
                    aria-pressed={size === o.value}
                    className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${size === o.value ? 'border-os-ink bg-os-surface' : 'border-os-line bg-os-surface/60'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${size === o.value ? 'border-os-ink bg-os-ink text-os-bg' : 'border-os-line'}`}>{size === o.value && <Icon.Check size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight" style={{ fontSize: o.px * 1.6 }}>
                        Strum once on each beat.
                      </span>
                      <span className="block text-os-muted" style={{ fontSize: 16 }}>
                        {o.title}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {canSpeak() && (
                <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-os-line bg-os-surface/60 px-5 py-4">
                  <div>
                    <div className="text-[1.1rem] font-semibold">Read the instructions aloud</div>
                    <div className="text-os-muted">The app says what to do and how it went, so your eyes can stay on your hands.</div>
                  </div>
                  <Toggle
                    label="Read the instructions aloud"
                    value={settings.speak === true}
                    onChange={(v) => {
                      setSettings({ speak: v });
                      if (v) speak('This is how the app sounds when it reads to you.');
                      else stopSpeaking();
                    }}
                  />
                </div>
              )}
            </>
          )}
          {step === 5 && (
            <>
              <h2 className="font-os-serif text-4xl">Let the app hear you</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-os-muted">Sit with the guitar and set the iPad up on a stand or table in front of you, about an arm&apos;s length away.</p>
              <Hearing />
            </>
          )}
          {step === 6 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-os-ok text-white">
                <Icon.Check size={44} />
              </div>
              <h2 className="font-os-serif text-5xl">You are set</h2>
              <div className="mx-auto mt-5 max-w-xl space-y-3 text-left text-[1.1rem] leading-relaxed text-os-muted">
                <p>Each day the app builds a short session for you. Start it from the Today page and it takes you through, beginning with tuning up.</p>
                <p>
                  <strong className="text-os-ink">Your hands can stay on the guitar.</strong> The app moves on by itself when it hears you get something right, and a strum starts each piece of playing. The large button at the bottom right is always the next thing to do.
                </p>
                <p>Your fingertips will be tender for the first couple of weeks. That is normal, and it passes. Short sessions on most days get you through it fastest.</p>
                {profile.experience !== 'new' && <p>Since you have played before, look at the Lessons page and use I know this to skip what you know.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between px-8 pb-7 pt-3">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: last + 1 }, (_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-os-ink' : 'w-2 bg-os-line'}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < last ? (
            <Button size="lg" onClick={next} className="min-w-[180px]">
              {step === 0 ? 'Begin' : step === 3 && !profile.playAt ? 'Skip for now' : 'Continue'}
            </Button>
          ) : (
            <Button size="lg" onClick={finish} className="min-w-[180px]">
              Open the app
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
