/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FFF9F2',        // Warm Milk Cream background (cozy & organic)
        paperLight: '#FFFFFF',   // Pure white card surfaces (clean e-commerce style)
        ink: '#2B1B17',          // Espresso Cocoa text (soft, friendly dark brown)
        turmeric: '#F4B251',     // Honey Yellow highlights (vibrant dog-approved accents)
        herb: '#769F6A',         // Clover Green (fresh, natural label accents)
        paprika: '#FF5A5F',      // Coral Red CTA buttons (playful and highly interactive)
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
