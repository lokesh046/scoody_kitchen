import apiClient from './client';

// Mirrors frontend/src/api/doctor.ts and the doctor-facing parts of
// frontend/src/api/consultations.ts exactly — same backend, same
// endpoints, already fully built and used by web's DoctorDashboard.tsx.
// No backend changes needed for a mobile doctor panel.

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DoctorResponse {
  id: number;
  user_id: number;
  clinic_id: number | null;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: string;
  license_number: string;
  bio: string | null;
  profile_image_url: string | null;
  is_available: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export interface DoctorAvailabilityResponse {
  id: number;
  doctor_id: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorAvailabilityCreate {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface DoctorAvailabilityUpdate {
  day_of_week?: DayOfWeek;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
}

export interface UserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export interface PetMinimalResponse {
  id: number;
  name: string;
  species: string;
  breed: string | null;
}

export interface ConsultationResponse {
  id: number;
  customer_id: number;
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason: string;
  customer_notes: string | null;
  doctor_notes: string | null;
  meeting_room_id: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  jitsi_token?: string | null;
  jitsi_app_id?: string | null;
  jitsi_domain?: string | null;
  can_join?: boolean;
  time_until_start_seconds?: number | null;
  time_remaining_seconds?: number | null;
  is_expired?: boolean;
  created_at: string;
  updated_at: string;
  pet?: PetMinimalResponse | null;
  customer?: UserResponse | null;
}

export interface HealthRecord {
  id: number;
  pet_id: number;
  doctor_id: number | null;
  consultation_id?: number | null;
  record_type: 'vaccination' | 'checkup' | 'surgery' | 'lab_result' | 'prescription' | 'other' | 'general' | 'symptom' | 'diagnosis';
  title?: string;
  symptoms?: string | null;
  clinical_findings?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  medications?: string | null;
  description?: string;
  notes?: string | null;
  follow_up_date?: string | null;
  created_at: string;
}

export interface PetHealthHistoryResponse {
  pet_id: number;
  records: HealthRecord[];
}

export interface CreateHealthRecordPayload {
  record_type: string;
  description: string;
  notes?: string;
  follow_up_date?: string;
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

export const createDoctorAvailability = async (
  data: DoctorAvailabilityCreate
): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.post<DoctorAvailabilityResponse>('/doctor/me/availability', data);
  return response.data;
};

export const updateDoctorAvailabilitySlot = async (
  id: number,
  data: DoctorAvailabilityUpdate
): Promise<DoctorAvailabilityResponse> => {
  const response = await apiClient.patch<DoctorAvailabilityResponse>(`/doctor/me/availability/${id}`, data);
  return response.data;
};

export const deleteDoctorAvailability = async (id: number): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/doctor/me/availability/${id}`);
  return response.data;
};

export const getDoctorConsultations = async (): Promise<ConsultationResponse[]> => {
  const response = await apiClient.get<{ items: ConsultationResponse[] }>('/doctor/consultations');
  return response.data.items;
};

export const getDoctorConsultationById = async (id: number): Promise<ConsultationResponse> => {
  const response = await apiClient.get<ConsultationResponse>(`/doctor/consultations/${id}`);
  return response.data;
};

export const updateConsultationStatus = async (id: number, status: string): Promise<ConsultationResponse> => {
  const response = await apiClient.patch<ConsultationResponse>(`/doctor/consultations/${id}/status`, { status });
  return response.data;
};

export const getPetHealthRecords = async (petId: number): Promise<PetHealthHistoryResponse> => {
  const response = await apiClient.get<PetHealthHistoryResponse>(`/doctor/pets/${petId}/health-records`);
  return response.data;
};

export const createHealthRecord = async (
  petId: number,
  data: CreateHealthRecordPayload
): Promise<HealthRecord> => {
  const response = await apiClient.post<HealthRecord>(`/doctor/pets/${petId}/health-records`, data);
  return response.data;
};
