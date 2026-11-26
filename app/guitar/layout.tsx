import type { Metadata, Viewport } from 'next';
import './guitar.css';

export const metadata: Metadata = {
  title: 'Fretward',
  description: 'A guitar teacher that listens, built on the science of how people learn to play.',
  manifest: '/guitar/manifest.webmanifest',
  applicationName: 'Fretward',
  appleWebApp: {
    capable: true,
    title: 'Fretward',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/guitar/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/guitar/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/guitar/icons/apple-touch-icon.png', sizes: '180x180' }],
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
    { media: '(prefers-color-scheme: light)', color: '#F7F3EB' },
    { media: '(prefers-color-scheme: dark)', color: '#131413' },
  ],
};

export default function GuitarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
