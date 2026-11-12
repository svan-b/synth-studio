import type { Metadata, Viewport } from 'next';
import './piano.css';

export const metadata: Metadata = {
  title: 'Middle C',
  description: 'A piano teacher built on the science of how people learn to play.',
  manifest: '/piano/manifest.webmanifest',
  applicationName: 'Middle C',
  appleWebApp: {
    capable: true,
    title: 'Middle C',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/piano/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/piano/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/piano/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F3EC' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

export default function PianoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
