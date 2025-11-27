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
    },
  },
  plugins: [],
}
