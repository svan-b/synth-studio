'use client';

import dynamic from 'next/dynamic';

// The app keeps its state in the browser, so it renders on the client only.
const App = dynamic(() => import('@/components/piano/App'), {
  ssr: false,
  loading: () => (
    <div className="mc-root flex items-center justify-center">
      <div className="font-mc-serif text-2xl text-mc-muted">Middle C</div>
    </div>
  ),
});

export default function PianoClient() {
  return <App />;
}
