/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'color-mix(in srgb, var(--bg) calc(<alpha-value> * 100%), transparent)',
        surface: 'color-mix(in srgb, var(--surface) calc(<alpha-value> * 100%), transparent)',
        sunken: 'color-mix(in srgb, var(--sunken) calc(<alpha-value> * 100%), transparent)',
        line: 'color-mix(in srgb, var(--line) calc(<alpha-value> * 100%), transparent)',
        ink: 'color-mix(in srgb, var(--ink) calc(<alpha-value> * 100%), transparent)',
        muted: 'color-mix(in srgb, var(--muted) calc(<alpha-value> * 100%), transparent)',
        accent: 'color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)',
        good: 'color-mix(in srgb, var(--good) calc(<alpha-value> * 100%), transparent)',
        warn: 'color-mix(in srgb, var(--warn) calc(<alpha-value> * 100%), transparent)',
        bad: 'color-mix(in srgb, var(--bad) calc(<alpha-value> * 100%), transparent)',
      },
    },
  },
  plugins: [],
}
