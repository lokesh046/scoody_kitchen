// Section colours for the Count The Calories page (see SectionFade.tsx). All dark shades of one warm
// family, so the fades between them stay clean instead of passing through grey.
export const TONE = {
  midnight: '#0E0B08',   // hero edge, page end
  espresso: '#1A130C',   // energy needs: coffee brown
  forest: '#12211A',     // how it works: deep forest green
  forestDeep: '#0F1B15',
  navy: '#0F1A2E',       // ecosystem: deep navy
  navyDeep: '#0B1424',
  plum: '#1E1420',       // FAQ: dark plum
  plumDeep: '#170F19',   // closing call to action starts here
} as const;
