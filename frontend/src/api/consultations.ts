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
  user_id?: number;
  specialization: string;
  qualification: string;
  consultation_fee: string;
  user?: UserResponse | null;
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
  doctor?: DoctorMinimalResponse | null;
}

export interface PaginatedConsultationResponse {
  items: ConsultationResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const fetchDoctors = async (params: { 
  page?: number; 
  limit?: number; 
  search?: string;
  city?: string;
  specialization?: string;
} = {}): Promise<PaginatedDoctorResponse> => {
  const response = await apiClient.get<PaginatedDoctorResponse>('/doctors', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      search: params.search || undefined,
      city: params.city || undefined,
      specialization: params.specialization || undefined,
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

export interface NearbyDoctorResponse extends DoctorResponse {
  name: string;
  distance_km: number;
}

export interface DoctorSchedulePublicResponse {
  doctor_id: number;
  is_accepting_consultations: boolean;
  schedule: any[];
}

export const fetchDoctorById = async (doctorId: number): Promise<DoctorResponse> => {
  const response = await apiClient.get<DoctorResponse>(`/doctors/${doctorId}`);
  return response.data;
};

export const fetchDoctorAvailability = async (doctorId: number): Promise<DoctorSchedulePublicResponse> => {
  const response = await apiClient.get<DoctorSchedulePublicResponse>(`/doctors/${doctorId}/availability`);
  return response.data;
};

export const fetchNearbyDoctors = async (latitude: number, longitude: number, radiusKm: number = 10): Promise<NearbyDoctorResponse[]> => {
  const response = await apiClient.get<NearbyDoctorResponse[]>('/doctors/nearby', {
    params: { latitude, longitude, radius_km: radiusKm }
  });
  return response.data;
};

export const fetchConsultationById = async (consultationId: number): Promise<ConsultationResponse> => {
  const response = await apiClient.get<ConsultationResponse>(`/consultations/${consultationId}`);
  return response.data;
};

export interface ConsultationJoinResponse {
  meeting_room_id: string;
  room_name: string;
  jitsi_token: string;
  jitsi_app_id?: string | null;
  jitsi_domain: string;
  is_moderator: boolean;
  role: string;
  expires_at?: string | null;
}

export const joinConsultation = async (consultationId: number, isDoctor: boolean = false): Promise<ConsultationJoinResponse> => {
  const url = isDoctor 
    ? `/doctor/consultations/${consultationId}/join` 
    : `/consultations/${consultationId}/join`;
  const response = await apiClient.post<ConsultationJoinResponse>(url);
  return response.data;
};

export interface ConsultationParticipantAudit {
  id: number;
  session_id: number;
  consultation_id: number;
  user_id: number;
  role: string;
  joined_at: string;
  left_at?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

export interface ConsultationSessionAudit {
  id: number;
  consultation_id: number;
  room_id: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  participants: ConsultationParticipantAudit[];
}

export interface ConsultationAuditResponse {
  consultation_id: number;
  status: string;
  scheduled_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  total_sessions: number;
  sessions: ConsultationSessionAudit[];
}

export const leaveConsultation = async (consultationId: number, isDoctor: boolean = false): Promise<ConsultationParticipantAudit | null> => {
  const url = isDoctor 
    ? `/doctor/consultations/${consultationId}/leave` 
    : `/consultations/${consultationId}/leave`;
  try {
    const response = await apiClient.post<ConsultationParticipantAudit>(url);
    return response.data;
  } catch (err) {
    console.warn('Failed to post participant leave event:', err);
    return null;
  }
};

export const fetchConsultationAudit = async (consultationId: number, isDoctor: boolean = false): Promise<ConsultationAuditResponse> => {
  const url = isDoctor 
    ? `/doctor/consultations/${consultationId}/audit` 
    : `/consultations/${consultationId}/audit`;
  const response = await apiClient.get<ConsultationAuditResponse>(url);
  return response.data;
};


