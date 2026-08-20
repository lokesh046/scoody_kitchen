import { apiClient } from './client';

export interface UserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export interface ClinicResponse {
  id: number;
  name: string;
  address: string;
  city: string;
}

export interface DoctorResponse {
  id: number;
  user_id: number;
  clinic_id: number | null;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: string; // Decimal returned as string
  license_number: string;
  bio: string | null;
  profile_image_url: string | null;
  is_available: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: UserResponse | null;
  clinic?: ClinicResponse | null;
}

export interface PaginatedDoctorResponse {
  items: DoctorResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DoctorSlotsResponse {
  doctor_id: number;
  date: string;
  duration_minutes: number;
  slots: string[]; // List of available slot times e.g. ["10:00", "10:30"]
}

export interface ConsultationCreate {
  pet_id: number;
  doctor_id: number;
  scheduled_at: string; // ISO datetime string (e.g. YYYY-MM-DDTHH:MM:SS)
  reason: string;
  customer_notes?: string | null;
}

export interface PetMinimalResponse {
  id: number;
  name: string;
  species: string;
  breed: string | null;
}

export interface DoctorMinimalResponse {
  id: number;
  specialization: string;
  qualification: string;
  consultation_fee: string;
}

export interface ConsultationResponse {
  id: number;
  customer_id: number;
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  reason: string;
  customer_notes: string | null;
  doctor_notes: string | null;
  created_at: string;
  updated_at: string;
  pet?: PetMinimalResponse | null;
  doctor?: DoctorMinimalResponse | null;
}

export interface PaginatedConsultationResponse {
  items: ConsultationResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const fetchDoctors = async (params: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedDoctorResponse> => {
  const response = await apiClient.get<PaginatedDoctorResponse>('/doctors', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      search: params.search || undefined,
    },
  });
  return response.data;
};

export const fetchDoctorSlots = async (doctorId: number, dateStr: string): Promise<DoctorSlotsResponse> => {
  const response = await apiClient.get<DoctorSlotsResponse>(`/doctors/${doctorId}/slots`, {
    params: { date: dateStr },
  });
  return response.data;
};

export const bookConsultation = async (bookingData: ConsultationCreate): Promise<ConsultationResponse> => {
  const response = await apiClient.post<ConsultationResponse>('/consultations', bookingData);
  return response.data;
};

export const fetchMyConsultations = async (params: { page?: number; limit?: number; status?: string } = {}): Promise<PaginatedConsultationResponse> => {
  const response = await apiClient.get<PaginatedConsultationResponse>('/consultations', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      status: params.status || undefined,
    },
  });
  return response.data;
};

export const cancelConsultation = async (consultationId: number): Promise<ConsultationResponse> => {
  const response = await apiClient.patch<ConsultationResponse>(`/consultations/${consultationId}/cancel`);
  return response.data;
};
