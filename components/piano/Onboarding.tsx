'use client';

import { useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { usePiano, type Experience } from '@/lib/piano/learn/store';
import ConnectionPanel from './Connection';
import { useInputMode, useMidiStatus } from './hooks';
import { Button, Icon } from './ui';

const LEVELS: Array<{ value: Experience; title: string; text: string }> = [
  { value: 'new', title: 'I am new to the piano', text: 'Start from the very beginning.' },
  { value: 'some', title: 'I can play a little', text: 'You know where the notes are and can pick out a tune.' },
  { value: 'returning', title: 'I used to play', text: 'You once read music and want it back.' },
];

const MINUTES: Array<{ value: number; title: string; text: string }> = [
  { value: 10, title: '10 minutes', text: 'A short visit to the piano. Enough to keep moving.' },
  { value: 20, title: '20 minutes', text: 'Room for a lesson, a piece and one exercise.' },
  { value: 30, title: '30 minutes', text: 'The fullest session, for days with time to spare.' },
];

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
        selected ? 'border-mc-ink bg-mc-surface' : 'border-mc-line bg-mc-surface/60'
      }`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-mc-ink bg-mc-ink text-mc-bg' : 'border-mc-line'}`}>
        {selected && <Icon.Check size={14} />}
      </span>
      <span>
        <span className="block text-[1.1rem] font-semibold">{title}</span>
        <span className="block text-mc-muted">{text}</span>
      </span>
    </button>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const profile = usePiano((s) => s.profile);
  const setProfile = usePiano((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const mode = useInputMode();
  const midi = useMidiStatus();

  const next = () => {
    void piano.unlock();
    setStep((s) => s + 1);
  };
  const finish = () => {
    setProfile({ onboarded: true });
    onDone();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <div className="mc-scroll min-h-0 flex-1">
        <div key={step} className="mc-fade-up mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-8 py-10">
          {step === 0 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-mc-ink text-mc-bg">
                <Icon.Piano size={40} />
              </div>
              <h1 className="font-mc-serif text-6xl">Middle C</h1>
              <p className="mx-auto mt-4 max-w-lg text-[1.25rem] leading-relaxed text-mc-muted">
                A piano teacher for your music stand. It listens to what you play, takes you forward one small step at a time, and teaches you how to
                practise as well as what to play.
              </p>
            </div>
          )}
          {step === 1 && (
            <>
              <h2 className="font-mc-serif text-4xl">Where are you starting from?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">This only sets where the course begins. You can skip ahead or go back at any time.</p>
              <div className="space-y-3">
                {LEVELS.map((l) => (
                  <Choice key={l.value} selected={profile.experience === l.value} title={l.title} text={l.text} onClick={() => setProfile({ experience: l.value })} />
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-mc-serif text-4xl">How long on a normal day?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">Short and regular beats long and rare. Pick what you will really do.</p>
              <div className="space-y-3">
                {MINUTES.map((m) => (
                  <Choice key={m.value} selected={profile.minutes === m.value} title={m.title} text={m.text} onClick={() => setProfile({ minutes: m.value })} />
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="font-mc-serif text-4xl">Connect your piano</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">
                The app works best when it can see exactly which keys you press. Choose how it should follow your playing. You can change this later
                in Settings.
              </p>
              <ConnectionPanel compact />
            </>
          )}
          {step === 4 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
                <Icon.Check size={44} />
              </div>
              <h2 className="font-mc-serif text-5xl">You are set</h2>
              <div className="mx-auto mt-5 max-w-xl space-y-3 text-left text-[1.1rem] leading-relaxed text-mc-muted">
                <p>Each day the app builds a short session for you. Press Start and it takes you through it.</p>
                {mode === 'midi' && (
                  <p>
                    <strong className="text-mc-ink">Your hands can stay on the piano.</strong> The very top key means continue. The very bottom key
                    means again. With a three pedal unit, the middle and left pedals do the same.
                  </p>
                )}
                {profile.experience !== 'new' && <p>Since you have played before, look at the Learn page and use I know this already to skip what you know.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between px-8 pb-7 pt-3">
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-mc-ink' : 'w-2 bg-mc-line'}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button size="lg" onClick={next} className="min-w-[180px]">
              {step === 0 ? 'Begin' : step === 3 ? (mode === 'touch' && midi.state !== 'connected' ? 'Not now' : 'Continue') : 'Continue'}
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
