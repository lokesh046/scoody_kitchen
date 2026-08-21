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

export interface HealthRecordResponse {
  id: number;
  pet_id: number;
  doctor_id: number | null;
  consultation_id: number | null;
  record_type: 'general' | 'symptom' | 'diagnosis';
  title: string;
  symptoms: string | null;
  clinical_findings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  medications: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  doctor?: {
    id: number;
    specialization: string;
  } | null;
}

export interface PetHealthHistoryResponse {
  pet_id: number;
  records: HealthRecordResponse[];
}

export const fetchPetById = async (petId: number): Promise<PetResponse> => {
  const response = await apiClient.get<PetResponse>(`/pets/${petId}`);
  return response.data;
};

export const updatePet = async (petId: number, petData: Partial<PetCreate>): Promise<PetResponse> => {
  const response = await apiClient.patch<PetResponse>(`/pets/${petId}`, petData);
  return response.data;
};

export const fetchPetHealthRecords = async (petId: number, recordType?: string): Promise<PetHealthHistoryResponse> => {
  const response = await apiClient.get<PetHealthHistoryResponse>(`/pets/${petId}/health-records`, {
    params: { record_type: recordType || undefined }
  });
  return response.data;
};

export const fetchPetHealthRecordDetail = async (petId: number, recordId: number): Promise<HealthRecordResponse> => {
  const response = await apiClient.get<HealthRecordResponse>(`/pets/${petId}/health-records/${recordId}`);
  return response.data;
};

export interface HealthRecordCreate {
  pet_id: number;
  consultation_id?: number | null;
  record_type?: string;
  title: string;
  symptoms?: string | null;
  clinical_findings?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  medications?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
}

export const createHealthRecord = async (petId: number, data: HealthRecordCreate): Promise<HealthRecordResponse> => {
  const response = await apiClient.post<HealthRecordResponse>(`/doctor/pets/${petId}/health-records`, data);
  return response.data;
};

export const updateHealthRecord = async (recordId: number, data: Partial<HealthRecordCreate>): Promise<HealthRecordResponse> => {
  const response = await apiClient.patch<HealthRecordResponse>(`/doctor/health-records/${recordId}`, data);
  return response.data;
};
