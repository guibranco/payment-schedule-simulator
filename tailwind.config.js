/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#79378b',
        secondary: '#93cd3f',
        'primary-light': '#8f4ca1',
        'primary-dark': '#632d72',
        'secondary-light': '#a3d95f',
        'secondary-dark': '#83b737'
      }
    },
  },
  plugins: [],
};