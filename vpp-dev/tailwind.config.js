/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'vpp-white':  '#FFFFFF',
        'vpp-green':  '#10B981',
        'vpp-forest': '#064E3B',
        'vpp-gray':   '#F9FAFB',
        'vpp-dim':    '#6B7280',
        'vpp-border': '#E5E7EB',
        'vpp-card':   '#FFFFFF',
        'vpp-dark':   '#111827',
        'vpp-warn':   '#F59E0B',
        'vpp-danger': '#EF4444',
      },
      fontFamily: {
        josefin: ['"Josefin Sans"', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in':   'slideIn 0.3s ease-out',
        'fade-in':    'fadeIn 0.4s ease-out',
        'tick':       'tick 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        tick: {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
