// Casiome Impera headline pictures for the home page hero, one per known banner title.
// A banner whose title is not listed here (a new or edited title) shows as text instead.
// Generated from the licensed font; the font file itself is not part of the site.

export interface HeroTitleImage {
  slug: string;
  wide: [number, number];
  narrow: [number, number];
}

export const heroTitleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

export const HERO_TITLE_IMAGES: Record<string, HeroTitleImage> = {
  "hearth & hound: small-batch canine nutrition": { slug: 'home-1', wide: [608, 251], narrow: [338, 222] },
  "honest ingredients. zero filler.": { slug: 'home-2', wide: [608, 251], narrow: [338, 171] },
  "farm-to-freezer holistic meals": { slug: 'home-3', wide: [608, 173], narrow: [338, 171] },
  "farm-to-bowl fresh holistic meals": { slug: 'home-4', wide: [608, 251], narrow: [338, 171] },
  "farm-to-bowl holistic meals": { slug: 'home-5', wide: [608, 173], narrow: [338, 119] },
  "raptor: high-protein all-meat diet": { slug: 'home-6', wide: [608, 251], narrow: [338, 171] },
  "the hearth & one fam": { slug: 'home-7', wide: [608, 173], narrow: [338, 119] },
};
