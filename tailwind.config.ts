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
        teaching: {
          current: '#00ff00',
          target: '#ffaa00',
          correct: '#00ff00',
          wrong: '#ff0000',
        },
      },
      fontFamily: {
        label: ['"Arial Narrow"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
