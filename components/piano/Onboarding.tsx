'use client';

import { useState } from 'react';
import { piano } from '@/lib/piano/audio/engine';
import { allStages } from '@/lib/piano/content/catalog';
import { markKnownThrough } from '@/lib/piano/learn/placement';
import { usePiano, type Experience } from '@/lib/piano/learn/store';
import { isNative } from '@/lib/piano/native/bridge';
import ConnectionPanel from './Connection';
import { useHints, useInputMode, useRemote } from './hooks';
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
  const [index, setIndex] = useState(0);
  // Where the course begins, for a learner who has played before. Nothing is marked until setup ends, so it can be changed freely.
  const [startStage, setStartStage] = useState(1);
  const mode = useInputMode();
  const experienced = profile.experience !== 'new';
  // Someone who has played before is asked where to begin. A beginner is not shown the question.
  const pages = ['welcome', 'level', ...(experienced ? ['place'] : []), 'minutes', 'connect', 'set'];
  const step = pages[Math.min(index, pages.length - 1)];
  const last = index >= pages.length - 1;
  const from = experienced ? startStage : 1;

  const next = () => {
    void piano.unlock();
    setIndex((s) => s + 1);
  };
  const finish = () => {
    if (from > 1) markKnownThrough(from - 1);
    setProfile({ onboarded: true });
    onDone();
  };
  // Once the piano is connected its keys turn these pages too, and nothing behind them can be reached.
  const hints = useHints();
  useRemote({ primary: last ? finish : next, secondary: index > 0 ? () => setIndex((s) => s - 1) : undefined });

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-mc-bg mc-safe-top mc-safe-bottom">
      <div className="mc-scroll min-h-0 flex-1">
        <div key={step} className={`mc-fade-up mx-auto flex min-h-full w-full flex-col justify-center px-8 py-10 ${step === 'place' ? 'max-w-4xl' : 'max-w-2xl'}`}>
          {step === 'welcome' && (
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
          {step === 'level' && (
            <>
              <h2 className="font-mc-serif text-4xl">Where are you starting from?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">The course is the same for everyone. If you have played before, the next page lets you begin further in.</p>
              <div className="space-y-3">
                {LEVELS.map((l) => (
                  <Choice key={l.value} selected={profile.experience === l.value} title={l.title} text={l.text} onClick={() => setProfile({ experience: l.value })} />
                ))}
              </div>
            </>
          )}
          {step === 'place' && (
            <>
              <h2 className="font-mc-serif text-4xl">Where should the course begin?</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">
                Pick the first stage that holds something new to you. What comes before it is marked as known, and the Learn page can undo that. If
                you are unsure, begin a stage early. Easy lessons go by quickly.
              </p>
              <div className="grid gap-3 landscape:grid-cols-2">
                {allStages().map((stage) => (
                  <Choice
                    key={stage.id}
                    selected={startStage === stage.id}
                    title={stage.id === 1 ? `From the beginning: ${stage.title}` : `Stage ${stage.id}: ${stage.title}`}
                    text={stage.goal}
                    onClick={() => setStartStage(stage.id)}
                  />
                ))}
              </div>
            </>
          )}
          {step === 'minutes' && (
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
          {step === 'connect' && (
            <>
              <h2 className="font-mc-serif text-4xl">Connect your piano</h2>
              <p className="mb-6 mt-2 text-[1.1rem] text-mc-muted">
                {isNative()
                  ? 'Through a cable the app sees exactly which keys you press, how firmly, and the pedals. Plug in now, or carry on and do it later.'
                  : 'The app works best when it can see exactly which keys you press. Choose how it should follow your playing. You can change this later in Settings.'}
              </p>
              <ConnectionPanel compact />
            </>
          )}
          {step === 'set' && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mc-ok text-white">
                <Icon.Check size={44} />
              </div>
              <h2 className="font-mc-serif text-5xl">You are set</h2>
              <div className="mx-auto mt-5 max-w-xl space-y-3 text-left text-[1.1rem] leading-relaxed text-mc-muted">
                <p>Each day the app builds a short session for you. Start it from the Today page and it takes you through.</p>
                {mode === 'midi' && (
                  <p>
                    <strong className="text-mc-ink">Your hands can stay on the piano.</strong> The very top key means continue. The very bottom key
                    means again, or back. On a page with no music, the right pedal means continue too.
                  </p>
                )}
                {experienced &&
                  (from > 1 ? (
                    <p>
                      The course begins at stage {from}. The stages before it are marked as known, and the Learn page can undo that if it turns out to
                      be too far.
                    </p>
                  ) : (
                    <p>If the first lessons turn out too easy, each stage on the Learn page has a button to mark it as known.</p>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between px-8 pb-7 pt-3">
        <div className="flex gap-2">
          {pages.map((name, i) => (
            <span key={name} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-mc-ink' : 'w-2 bg-mc-line'}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {index > 0 && (
            <Button variant="ghost" size="lg" onClick={() => setIndex((s) => s - 1)} hint={hints.bottom}>
              Back
            </Button>
          )}
          {!last ? (
            <Button size="lg" onClick={next} className="min-w-[180px]" hint={hints.top}>
              {step === 'welcome' ? 'Begin' : step === 'connect' && mode === 'touch' ? 'Not now' : 'Continue'}
            </Button>
          ) : (
            <Button size="lg" onClick={finish} className="min-w-[180px]" hint={hints.top}>
              Open the app
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
