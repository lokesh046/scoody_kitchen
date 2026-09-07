import { create } from 'zustand';
import { PetProfile } from '../types';

interface PetState {
  pets: PetProfile[];
  activePetId: number | null;
  setPets: (pets: PetProfile[]) => void;
  addPet: (pet: PetProfile) => void;
  updatePet: (id: number, updatedPet: PetProfile) => void;
  removePet: (id: number) => void;
  setActivePet: (id: number) => void;
  getActivePet: () => PetProfile | undefined;
}

export const usePetStore = create<PetState>((set, get) => ({
  pets: [],
  activePetId: null,

  setPets: (pets) => {
    set({
      pets,
      activePetId: pets.length > 0 ? pets[0].id : null,
    });
  },

  addPet: (createdPet) => {
    set((state) => ({
      pets: [...state.pets, createdPet],
      activePetId: createdPet.id,
    }));
  },

  updatePet: (id, updatedPet) => {
    set((state) => ({
      pets: state.pets.map((p) => (p.id === id ? updatedPet : p)),
    }));
  },

  removePet: (id: number) => {
    set((state) => {
      const filtered = state.pets.filter((p) => p.id !== id);
      return {
        pets: filtered,
        activePetId: filtered.length > 0 ? filtered[0].id : null,
      };
    });
  },

  setActivePet: (id: number) => set({ activePetId: id }),

  getActivePet: () => {
    const { pets, activePetId } = get();
    return pets.find((p) => p.id === activePetId) || pets[0];
  },
}));
