import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-first palette tuned for an in-gym, one-handed experience.
        base: {
          bg: '#0b0e14',
          surface: '#141922',
          elevated: '#1c232f',
          border: '#2a333f',
        },
        brand: {
          DEFAULT: '#4f8cff',
          muted: '#2f5bb7',
        },
        accent: '#22d3a6',
        warn: '#f4b740',
        danger: '#f2555a',
        text: {
          DEFAULT: '#e8edf5',
          muted: '#9aa7b8',
          faint: '#5f6b7c',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
