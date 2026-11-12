import { categoryForBreed, type PetCategory } from '../../constants/breedCategory';

export const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Reptile', 'Goat', 'Cattle', 'Buffalo'];

/** Matches a species case-insensitively to the options; anything else (a pet saved earlier) is kept as typed. */
export const canonSpecies = (value?: string | null): string => {
  const v = (value || '').trim();
  if (!v) return 'Dog';
  return SPECIES_OPTIONS.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v;
};

/** What to save for a pet's category: dogs only; a recognised breed decides, otherwise the owner's pick. */
export const resolveCategory = (species: string, breed: string, chosen: PetCategory | null): PetCategory | null =>
  species.toLowerCase() === 'dog' ? categoryForBreed(breed) ?? chosen : null;
