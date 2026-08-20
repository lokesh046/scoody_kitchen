import { apiClient } from './client';

export interface PetCreate {
  name: string;
  species: string;
  breed?: string | null;
  gender?: string | null;
  date_of_birth?: string | null; // ISO Date YYYY-MM-DD
  weight?: number | null;
}

export interface PetResponse {
  id: number;
  user_id: number;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  date_of_birth: string | null;
  weight: number | null;
  created_at: string;
}

export const fetchMyPets = async (): Promise<PetResponse[]> => {
  const response = await apiClient.get<PetResponse[]>('/pets');
  return response.data;
};

export const createPet = async (petData: PetCreate): Promise<PetResponse> => {
  const response = await apiClient.post<PetResponse>('/pets', petData);
  return response.data;
};

export const deletePet = async (petId: number): Promise<void> => {
  await apiClient.delete(`/pets/${petId}`);
};
