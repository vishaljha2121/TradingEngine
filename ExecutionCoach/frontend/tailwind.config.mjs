/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tmblue: '#0F172A',
        tmgray: '#475569',
        tmaccent: '#1D4ED8',
      }
    },
  },
  plugins: [],
}
