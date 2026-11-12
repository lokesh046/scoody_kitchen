// Casiome Impera headline pictures for the home page hero, one per known banner title.
// A banner whose title is not listed here (a new or edited title) shows as text instead.
// Generated from the licensed font; the font file itself is not part of the site.

import { withoutHeadingFullStops } from '../utils/headings';

export interface HeroTitleImage {
  slug: string;
  wide: [number, number];
  narrow: [number, number];
}

export const heroTitleKey = (title: string) => withoutHeadingFullStops(title).trim().toLowerCase().replace(/\s+/g, ' ');

export const HERO_TITLE_IMAGES: Record<string, HeroTitleImage> = {
  "hearth & hound: small-batch canine nutrition": { slug: 'home-1', wide: [605, 112], narrow: [329, 64] },
  "honest ingredients zero filler": { slug: 'home-2', wide: [605, 136], narrow: [329, 77] },
  "farm-to-freezer holistic meals": { slug: 'home-3', wide: [605, 152], narrow: [330, 86] },
  "farm-to-bowl fresh holistic meals": { slug: 'home-4', wide: [605, 128], narrow: [329, 73] },
  "farm-to-bowl holistic meals": { slug: 'home-5', wide: [515, 154], narrow: [331, 102] },
  "raptor: high-protein all-meat diet": { slug: 'home-6', wide: [606, 126], narrow: [329, 70] },
  "the hearth & one fam": { slug: 'home-7', wide: [467, 154], narrow: [316, 106] },
};
