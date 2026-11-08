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
        vibrantGold: '#FFDD43',  // Vivid gold accent (documented in DESIGN.md) -- black-bg statement moments only
        herb: '#8FA89B',         // Muted Sage Green labels
        paprika: '#3F5E4D',      // Forest Green CTA buttons
        navy: '#17233D',         // Midnight Navy secondary accent
        cardboard: '#EBE0D0',    // Creamy Biscuit dividers/borders
        obsidian: '#F9F6F0',     // Black & Gold homepage: base section bg -- testing the cream color requested
        obsidianCard: '#FFFFFF', // Black & Gold homepage: card/panel surface, one step lighter than obsidian
        stone: '#FFFFFF',        // Black & Gold homepage: light interlude (Recipe Calculator)
        midnight: '#0E0B08',     // Black & Gold homepage: deliberate true-black statement sections (toolkit, newsletter)
        midnightCard: '#17120D', // Black & Gold homepage: card surface on midnight sections
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Quicksand', 'sans-serif'],
        mono: ['Courier Prime', 'monospace'],
        script: ['Lobster', 'cursive'],
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
