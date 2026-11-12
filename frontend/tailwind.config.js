/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  },
  darkMode: 'class',
  // index.css owns the base reset; preserve native styles used by existing forms.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        dark: {
          pure: '#050505',
          abyss: '#020408',
        },
        surface: {
          DEFAULT: '#111113',
          elevated: '#18181B',
        },
        border: {
          DEFAULT: '#27272A',
          strong: '#3F3F46',
        },
        foreground: {
          DEFAULT: '#FAFAFA',
          muted: '#A1A8B5',
        },
        brand: {
          DEFAULT: '#22D3EE',
          hover: '#67E8F9',
          subtle: '#083344',
          foreground: '#0A0A0A',
        },
        neon: {
          cyan: '#00F0FF',
          purple: '#A855F7',
          blue: '#38BDF8',
        },
        accent: {
          DEFAULT: '#A78BFA',
          hover: '#C4B5FD',
          subtle: '#2E1065',
          foreground: '#0A0A0A',
        },
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#FB7185',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-brand': '0 0 24px rgb(34 211 238 / 0.16)',
        'glow-accent': '0 0 24px rgb(167 139 250 / 0.16)',
        'glow-neon-cyan': '0 0 35px rgba(0, 240, 255, 0.25)',
        'glow-neon-purple': '0 0 35px rgba(168, 85, 247, 0.25)',
        panel: '0 16px 48px rgb(0 0 0 / 0.24)',
        'glass-edge': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 0 rgba(0, 0, 0, 0.4)',
        'glass-wet': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), inset 0 0 16px 0 rgba(255, 255, 255, 0.02), 0 20px 40px -15px rgba(0, 0, 0, 0.6)',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
      borderRadius: {
        panel: '1rem',
      },
    },
  },
  plugins: [],
}
