/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sidebar / chrome surfaces — a deep blue-black "ink".
        ledger: {
          950: '#080D1A',
          900: '#0E1527',
          800: '#18213A',
          700: '#26304D99',
        },
        accent: {
          DEFAULT: '#5B5BF0',
          soft: '#ECECFE',
        },
        fine: {
          DEFAULT: '#B4610A',
          soft: '#FDF1DE',
        },
        ok: {
          DEFAULT: '#16805A',
          soft: '#E1F5EC',
        },
        // A slightly deeper, more saturated indigo than Tailwind's default
        // so every existing indigo-* class across the app picks up the
        // refined brand colour without touching each component.
        indigo: {
          50: '#F2F2FF',
          100: '#E6E6FE',
          200: '#D0D0FD',
          300: '#AFAEFA',
          400: '#8B87F5',
          500: '#6E66EE',
          600: '#5B4FE3',
          700: '#4C3FC8',
          800: '#3F35A1',
          900: '#36317F',
          950: '#211D4A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Numbers, codes and amounts are set in Inter with tabular figures
        // (see index.css) — cleaner than a code font in a finance ledger.
        // Real code (<code>, <kbd>, <pre>) keeps a true monospace.
        mono: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        code: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Heavy 800/900 weights read as shouty; cap them for a calmer,
      // more editorial hierarchy app-wide.
      fontWeight: {
        extrabold: '700',
        black: '750',
      },
      boxShadow: {
        // Softer, layered default shadows for every card.
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.03)',
        DEFAULT: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 2px 6px -1px rgb(15 23 42 / 0.05)',
        md: '0 2px 4px -1px rgb(15 23 42 / 0.05), 0 6px 16px -4px rgb(15 23 42 / 0.08)',
        lg: '0 4px 8px -2px rgb(15 23 42 / 0.05), 0 16px 32px -8px rgb(15 23 42 / 0.10)',
        xl: '0 8px 16px -4px rgb(15 23 42 / 0.06), 0 24px 48px -12px rgb(15 23 42 / 0.14)',
        '2xl': '0 24px 64px -16px rgb(15 23 42 / 0.25)',
        glow: '0 0 0 1px rgb(91 79 227 / 0.12), 0 8px 24px -6px rgb(91 79 227 / 0.35)',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'page-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'page-in': 'page-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
