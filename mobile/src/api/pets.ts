import apiClient from './client';
import { PetProfile } from '../types';

export interface PetCreatePayload {
  name: string;
  species: string;
  breed?: string;
  gender?: string;
  weight?: number;
  date_of_birth?: string;
  profile_image_url?: string;
}

export interface PetUpdatePayload {
  name?: string;
  species?: string;
  breed?: string;
  gender?: string;
  weight?: number;
  date_of_birth?: string;
  profile_image_url?: string;
}

export interface HealthRecord {
  id: number;
  pet_id: number;
  doctor_id?: number | null;
  consultation_id?: number | null;
  record_type: string;
  title: string;
  symptoms?: string | null;
  clinical_findings?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  medications?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  doctor?: {
    id: number;
    specialization: string;
  } | null;
}

export interface PetHealthRecordsResponse {
  pet_id: number;
  records: HealthRecord[];
}

export const fetchMyPets = async (): Promise<PetProfile[]> => {
  const response = await apiClient.get<PetProfile[]>('/pets');
  return response.data;
};

export const createPet = async (data: PetCreatePayload): Promise<PetProfile> => {
  const response = await apiClient.post<PetProfile>('/pets', data);
  return response.data;
};

export const updatePet = async (petId: number, data: PetUpdatePayload): Promise<PetProfile> => {
  const response = await apiClient.patch<PetProfile>(`/pets/${petId}`, data);
  return response.data;
};

export const deletePet = async (petId: number): Promise<void> => {
  await apiClient.delete(`/pets/${petId}`);
};

export const fetchPetHealthRecords = async (petId: number): Promise<PetHealthRecordsResponse> => {
  const response = await apiClient.get<PetHealthRecordsResponse>(`/pets/${petId}/health-records`);
  return response.data;
};
