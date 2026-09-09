export const COLORS = {
  canvas: '#F9F6F0',       // Warm cream background
  card: '#FFFFFF',         // Clean surface card
  cardAlt: '#F4EFEB',      // Subtle muted cream
  forestGreen: '#3F5E4D',  // Primary brand / natural forest — DESIGN.md's Canopy Stamp Rule reserves this for CTAs and warning flags; keep its use scarce, not decorative.
  forestDark: '#2C4236',   // Deep green header
  brandGold: '#976430',    // Warm Ochre accent (darkened from #D09E6B — the lighter value failed WCAG AA as text, even at large sizes)
  navy: '#17233D',         // Midnight Navy — DESIGN.md: consultation logs and appointment summaries
  sage: '#8FA89B',         // Muted Sage Green — DESIGN.md: category tags, active badge indicators, verified labels
  sageIcon: '#556D60',     // Darkened sage for icon-on-light-tint use (same WCAG reasoning as brandGold above — raw #8FA89B is only ~2.5:1 against white)
  sageLight: '#C2CCC7',    // Lightened sage for text/icons on dark-green cards (e.g. Telehealth) — 6.67:1 against #274233
  textCoffee: '#2C1810',   // Deep rich text
  textMuted: '#6E6259',    // Secondary muted
  textLight: '#786D65',    // Placeholder (darkened from #9E948C — the lighter value failed WCAG AA as text)
  textWhite: '#FFFFFF',
  kraftBorder: '#E6DFD5',  // Subtle craft border
  accentRed: '#C25E48',    // Urgent / Alert
  accentGold: '#E5A93C',   // Rating / Gold star
  successGreen: '#2E7D32', // Success / confirmed
  ctaBrown: '#8B5A2B',     // Secondary CTA (Add to Cart, Find a Vet) — deliberately off forestGreen to keep the Canopy Stamp budget on genuinely high-priority actions, since these repeat on every product card
  navyTintBg: '#F4F5F8',    // Light navy card/surface tint (e.g. doctor-type review badges)
  navyTintBorder: '#CBD2E1',
  navyTintBadgeBg: '#DEE3ED',
  navyTintText: '#263964',
  sageTintBg: '#F5F7F6',     // Light sage card/surface tint (e.g. product-type review badges)
  sageTintBorder: '#D3D9D6',
  sageTintBadgeBg: '#E3E8E5',
  sageTintText: '#3C4D45',
};
