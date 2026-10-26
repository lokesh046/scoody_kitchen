// Where admin-managed content can appear. The values match the backend (FAQPage and
// BannerPlacement in the API schemas), so change both together.

export type FaqPage = 'home' | 'shop' | 'pets' | 'vet';

export const FAQ_PAGES: { value: FaqPage; label: string }[] = [
  { value: 'home', label: 'Home page' },
  { value: 'shop', label: 'Shop Recipes page' },
  { value: 'pets', label: 'Know Your Pet page' },
  { value: 'vet', label: 'Locate Your Vet page' },
];

export type BannerPlacement = 'home' | 'shop_hero' | 'pets_hero' | 'vet_hero' | 'home_toolkit';

export const BANNER_PLACEMENTS: { value: BannerPlacement; label: string; hint: string }[] = [
  { value: 'home', label: 'Home page - banner carousel', hint: 'Landscape, e.g. 1920x600.' },
  { value: 'shop_hero', label: 'Shop Recipes page - top image', hint: 'Landscape, e.g. 1920x1080. Only the first active one is used. Title and subtitle become the headline and text.' },
  { value: 'pets_hero', label: 'Know Your Pet page - top image', hint: 'Landscape, e.g. 1920x1080. Only the first active one is used. Title and subtitle become the headline and text.' },
  { value: 'vet_hero', label: 'Locate Your Vet page - top image', hint: 'Landscape, e.g. 1920x1080. Only the first active one is used. Title and subtitle become the headline and text.' },
  { value: 'home_toolkit', label: 'Home page - tool card', hint: 'Square icon, transparent PNG or WebP. Set the link to /pets, /consultations or /onboarding to choose which card it replaces.' },
];

export const bannerPlacementLabel = (value: string) =>
  BANNER_PLACEMENTS.find((p) => p.value === value)?.label ?? value;

export const faqPageLabel = (value: string) => FAQ_PAGES.find((p) => p.value === value)?.label ?? value;
