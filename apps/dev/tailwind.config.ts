import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0A1628',
          50: '#E8EBF0',
          100: '#C5CBD6',
          500: '#0A1628',
          600: '#081220',
        },
        teal: {
          DEFAULT: '#00897B',
          500: '#00897B',
          600: '#00796B',
          700: '#00695C',
        },
        ink: {
          DEFAULT: '#0B0F19',
          100: '#1A1F2E',
          200: '#2A3042',
          300: '#3A4154',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
