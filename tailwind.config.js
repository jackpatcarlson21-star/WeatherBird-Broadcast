/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wb-dark': '#003366',
        'wb-navy': '#001122',
        'wb-cyan': '#00FFFF',
        'wb-mid': '#0055AA',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'rain-fall': {
          '0%': { transform: 'translateY(-100%) translateX(0)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) translateX(-20px)', opacity: '0.3' },
        },
        'snow-fall': {
          '0%': { transform: 'translateY(-100%) translateX(0)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) translateX(30px)', opacity: '0' },
        },
        'star-twinkle': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        'cloud-drift': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100vw)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'alert-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(239, 68, 68, 0.3), 0 0 10px rgba(239, 68, 68, 0.1)' },
          '50%': { boxShadow: '0 0 15px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.3)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'rain-fall': 'rain-fall 1s linear infinite',
        'snow-fall': 'snow-fall 3s linear infinite',
        'star-twinkle': 'star-twinkle 2s ease-in-out infinite',
        'cloud-drift': 'cloud-drift 20s linear infinite',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'alert-glow': 'alert-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
