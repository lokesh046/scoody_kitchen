// Headline pictures for the home hero, one per known banner title -- the same
// set the web home page uses (frontend/src/constants/heroTitleImages.ts). A
// banner whose title is not listed here (a new or edited title) shows as text.
import type { ImageSourcePropType } from 'react-native';

export interface HeroTitleImage {
  source: ImageSourcePropType;
  width: number;
  height: number;
}

export const heroTitleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

export const HERO_TITLE_IMAGES: Record<string, HeroTitleImage> = {
  'hearth & hound: small-batch canine nutrition': { source: require('../../assets/hero-titles/home-1-narrow.webp'), width: 338, height: 222 },
  'honest ingredients. zero filler.': { source: require('../../assets/hero-titles/home-2-narrow.webp'), width: 338, height: 171 },
  'farm-to-freezer holistic meals': { source: require('../../assets/hero-titles/home-3-narrow.webp'), width: 338, height: 171 },
  'farm-to-bowl fresh holistic meals': { source: require('../../assets/hero-titles/home-4-narrow.webp'), width: 338, height: 171 },
  'farm-to-bowl holistic meals': { source: require('../../assets/hero-titles/home-5-narrow.webp'), width: 338, height: 119 },
  'raptor: high-protein all-meat diet': { source: require('../../assets/hero-titles/home-6-narrow.webp'), width: 338, height: 171 },
  'the hearth & one fam': { source: require('../../assets/hero-titles/home-7-narrow.webp'), width: 338, height: 119 },
};
