import { BREED_NAMES } from './breedCategory';

// Suggestions are shortcuts, not an exhaustive list; custom entries remain valid.
export const PET_BREED_SUGGESTIONS: Record<string, readonly string[]> = {
  dog: BREED_NAMES,
  cat: ['Bengal', 'British Shorthair', 'Domestic Longhair', 'Domestic Shorthair', 'Egyptian Mau', 'Indian Billi', 'Maine Coon', 'Persian', 'Ragdoll', 'Russian Blue', 'Siamese', 'Sphynx', 'Tabby'],
  bird: ['African Grey Parrot', 'Budgerigar', 'Canary', 'Cockatiel', 'Cockatoo', 'Lovebird', 'Macaw', 'Parakeet', 'Parrot'],
  reptile: ['Ball Python', 'Bearded Dragon', 'Corn Snake', 'Green Iguana', 'Leopard Gecko', 'Red-Eared Slider', 'Russian Tortoise'],
};
