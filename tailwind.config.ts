import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette is unchanged — the immersive canvas is built purely from blends
      // of these tokens (see `.canvas-*` in globals.css), never new hues.
      colors: {
        navy: '#0B3558',
        action: '#635BFF',
        paper: '#FFFFFF',
        mist: '#F8F9FB',
        fog: '#E7EDF6',
        muted: '#476788',
        ink: '#0A0A0A',
        border: '#D4E0ED',
        'g-pink': '#E55CFF',
        'g-purple': '#8247F5',
        'g-amber': '#FFA600',
        'g-cyan': '#0099FF',
      },
      borderRadius: { button: '10px', card: '20px', panel: '28px', pill: '999px' },
      maxWidth: { container: '1200px' },
      // Diffuse and brand-tinted rather than neutral grey — depth should read as
      // coloured light, not as a drop shadow.
      boxShadow: {
        soft: '0 19px 60px rgba(11,53,88,.10)',
        lift: '0 24px 60px -12px rgba(99,91,255,.22)',
        float: '0 40px 80px -20px rgba(11,53,88,.45)',
        glow: '0 12px 34px -8px rgba(99,91,255,.55)',
        'glow-lg': '0 20px 60px -12px rgba(99,91,255,.65)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'Poppins', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      animation: { float: 'float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
