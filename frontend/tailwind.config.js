/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ledger: {
          950: '#0B1220',
          900: '#111A2E',
          800: '#1B2740',
          700: '#28365699',
        },
        accent: {
          DEFAULT: '#4F5FEA',
          soft: '#E7E9FD',
        },
        fine: {
          DEFAULT: '#C2760C',
          soft: '#FBEBD3',
        },
        ok: {
          DEFAULT: '#1E8A5F',
          soft: '#DFF4EA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
