/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          900: '#0a0a0a', /* True cinematic black */
          800: '#121212',
          700: '#18181b', /* zinc-900 */
          600: '#27272a', /* zinc-800 */
          500: '#3f3f46',
        },
        brand: {
          400: '#f87171',
          500: '#e50914', /* Cinematic Red */
          600: '#b91c1c',
        },
        gold: '#f5c518', /* IMDb Gold */
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
