import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hardware: {
          bg: '#1a1a1a',
          panel: '#2a2a2a',
          label: '#888888',
          led: {
            on: '#00ff00',
            off: '#333333',
          },
        },
        mc: {
          bg: 'rgb(var(--mc-bg) / <alpha-value>)',
          surface: 'rgb(var(--mc-surface) / <alpha-value>)',
          raised: 'rgb(var(--mc-raised) / <alpha-value>)',
          ink: 'rgb(var(--mc-ink) / <alpha-value>)',
          muted: 'rgb(var(--mc-muted) / <alpha-value>)',
          faint: 'rgb(var(--mc-faint) / <alpha-value>)',
          line: 'rgb(var(--mc-line) / <alpha-value>)',
          accent: 'rgb(var(--mc-accent) / <alpha-value>)',
          ok: 'rgb(var(--mc-ok) / <alpha-value>)',
          bad: 'rgb(var(--mc-bad) / <alpha-value>)',
          hint: 'rgb(var(--mc-hint) / <alpha-value>)',
        },
        teaching: {
          current: '#00ff00',
          target: '#ffaa00',
          correct: '#00ff00',
          wrong: '#ff0000',
        },
      },
      fontFamily: {
        label: ['"Arial Narrow"', 'Arial', 'sans-serif'],
        'mc-serif': ['ui-serif', '"New York"', '"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
        'mc-sans': ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
