import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
      borderRadius: { button: '4px', card: '16px' },
      maxWidth: { container: '1200px' },
      boxShadow: { soft: '0 30px 50px rgba(71,103,136,.08)' },
      fontFamily: { sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
