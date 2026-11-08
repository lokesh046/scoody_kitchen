import { BREED_DATA, type AkcGroup } from '../constants/breedData';

// The pet form groups dogs into four easy categories. They are worked out from the breed (the same breed
// list and official groups the Meal Planner uses), so nobody has to know the official group names.
export const PET_CATEGORIES = ['Working', 'Hound', 'Sporting', 'Companion'] as const;
export type PetCategory = (typeof PET_CATEGORIES)[number];

const GROUP_TO_CATEGORY: Record<AkcGroup, PetCategory> = {
  'Working Group': 'Working',
  'Herding Group': 'Working',
  'Hound Group': 'Hound',
  'Sporting Group': 'Sporting',
  'Toy Group': 'Companion',
  'Terrier Group': 'Companion',
  'Non-Sporting Group': 'Companion',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const ENTRIES = BREED_DATA.map((b) => ({ key: norm(b.name), category: GROUP_TO_CATEGORY[b.group] }));

/** The category for a breed name the owner typed or scanned, or null when the breed isn't recognised. */
export function categoryForBreed(breed?: string | null): PetCategory | null {
  const typed = norm(breed || '');
  if (!typed) return null;
  const exact = ENTRIES.find((e) => e.key === typed);
  if (exact) return exact.category;
  // "my Golden Retriever mix": a known breed name inside the text (longest name wins).
  const inside = ENTRIES.filter((e) => ` ${typed} `.includes(` ${e.key} `)).sort((a, b) => b.key.length - a.key.length)[0];
  if (inside) return inside.category;
  // "Labrador": a short name that identifies exactly one breed.
  if (typed.length >= 5) {
    const starts = ENTRIES.filter((e) => ` ${e.key} `.includes(` ${typed} `));
    if (starts.length > 0 && new Set(starts.map((e) => e.category)).size === 1) return starts[0].category;
  }
  return null;
}
