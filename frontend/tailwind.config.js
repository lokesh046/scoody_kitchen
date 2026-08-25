/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F9F6F0',        // Warm Cream background (cozy & organic)
        paperLight: '#FFFFFF',   // Pure white card surfaces (clean e-commerce style)
        ink: '#362820',          // Dark Roasted Coffee text / header background
        turmeric: '#D09E6B',     // Warm Ochre titles / highlights
        herb: '#8FA89B',         // Muted Sage Green labels
        paprika: '#3F5E4D',      // Forest Green CTA buttons
        navy: '#17233D',         // Midnight Navy secondary accent
        cardboard: '#EBE0D0',    // Creamy Biscuit dividers/borders
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Quicksand', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        'sm': '12px',            // Soft rounded buttons/inputs
        'md': '16px',            // Rounded recipe cards
        'lg': '24px',            // Large dashboard cards
        'xl': '32px',
      },
    },
  },
  plugins: [],
}
