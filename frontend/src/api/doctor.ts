import { apiClient } from './client';
import type { DoctorResponse, ConsultationResponse } from './consultations';

export interface DoctorAvailabilityResponse {
  id: number;
  doctor_id: number;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorAvailabilityCreate {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface DoctorUpdateSelf {
  qualification?: string;
  experience_years?: number;
  consultation_fee?: string;
  bio?: string | null;
  profile_image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_available?: boolean;
}

export const getDoctorProfile = async (): Promise<DoctorResponse> => {
  const response = await apiClient.get<DoctorResponse>('/doctor/me');
  return response.data;
};

export const updateDoctorProfile = async (data: DoctorUpdateSelf): Promise<DoctorResponse> => {
  const response = await apiClient.patch<DoctorResponse>('/doctor/me', data);
  return response.data;
};

export const getDoctorAvailabilities = async (): Promise<DoctorAvailabilityResponse[]> => {
  const response = await apiClient.get<DoctorAvailabilityResponse[]>('/doctor/me/availability');
  return response.data;
};

export const createDoctorAvailability = async (data: DoctorAvailabilityCreate): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.post<DoctorAvailabilityResponse>('/doctor/me/availability', data);
  return response.data;
};

export const deleteDoctorAvailability = async (id: number): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/doctor/me/availability/${id}`);
  return response.data;
};

export const replaceDoctorAvailabilityBulk = async (schedule: DoctorAvailabilityCreate[]): Promise<DoctorAvailabilityResponse[]> => {
  const response = await apiClient.put<DoctorAvailabilityResponse[]>('/doctor/me/availability/bulk', {
    schedule
  });
  return response.data;
};

export const getDoctorConsultations = async (): Promise<ConsultationResponse[]> => {
  const response = await apiClient.get<{ items: ConsultationResponse[] }>('/doctor/consultations');
  return response.data.items;
};

export const updateConsultationStatus = async (id: number, status: string): Promise<ConsultationResponse> => {
  const response = await apiClient.patch<ConsultationResponse>(`/doctor/consultations/${id}/status`, { status });
  return response.data;
};

export const getDoctorConsultationById = async (id: number): Promise<ConsultationResponse> => {
  const response = await apiClient.get<ConsultationResponse>(`/doctor/consultations/${id}`);
  return response.data;
};

export interface DoctorAvailabilityUpdate {
  day_of_week?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
}

export const updateDoctorAvailabilitySlot = async (id: number, data: DoctorAvailabilityUpdate): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.patch<DoctorAvailabilityResponse>(`/doctor/me/availability/${id}`, data);
  return response.data;
};

export interface HealthRecord {
  id: number;
  pet_id: number;
  doctor_id: number;
  record_type: 'vaccination' | 'checkup' | 'surgery' | 'lab_result' | 'prescription' | 'other';
  description: string;
  notes?: string | null;
  follow_up_date?: string | null;
  created_at: string;
  updated_at: string;
  doctor_name?: string;
}

export interface PetHealthHistoryResponse {
  pet_id: number;
  records: HealthRecord[];
}

export const getPetHealthRecords = async (petId: number): Promise<PetHealthHistoryResponse> => {
  const response = await apiClient.get<PetHealthHistoryResponse>(`/doctor/pets/${petId}/health-records`);
  return response.data;
};

export const getHealthRecordById = async (recordId: number): Promise<HealthRecord> => {
  const response = await apiClient.get<HealthRecord>(`/doctor/health-records/${recordId}`);
  return response.data;
};

export const createHealthRecord = async (petId: number, data: { record_type: string; description: string; notes?: string; follow_up_date?: string }): Promise<HealthRecord> => {
  const response = await apiClient.post<HealthRecord>(`/doctor/pets/${petId}/health-records`, {
    ...data,
    pet_id: petId
  });
  return response.data;
};
