import type { MetadataRoute } from 'next';

/** Home-screen install: opens as a standalone app without browser bars (iOS supports `standalone`, not `fullscreen`) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Synth Studio',
    short_name: 'Synth Studio',
    description: 'Play, patch and learn classic hardware synths as digital twins, then wire them into a studio and make full tracks.',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#111111',
    theme_color: '#111111',
    categories: ['music', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
