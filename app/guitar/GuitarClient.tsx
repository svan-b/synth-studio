'use client';

import dynamic from 'next/dynamic';

// The app keeps its state in the browser, so it renders on the client only.
const App = dynamic(() => import('@/components/guitar/App'), {
  ssr: false,
  loading: () => (
    <div className="os-root flex items-center justify-center">
      <div className="font-os-serif text-2xl text-os-muted">Fretward</div>
    </div>
  ),
});

export default function GuitarClient() {
  return <App />;
}
