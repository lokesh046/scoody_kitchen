import apiClient from './client';

export interface PetMinimal {
  id: number;
  name: string;
  species: string;
  breed?: string | null;
}

export interface DoctorUser {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  profile_image_url?: string | null;
}

export interface DoctorClinic {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

export interface DoctorMinimal {
  id: number;
  user_id?: number | null;
  specialization: string;
  qualification: string;
  consultation_fee: string | number;
  profile_image_url?: string | null;
  user?: DoctorUser | null;
  clinic?: DoctorClinic | null;
}

export type ConsultationStatusType =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Consultation {
  id: number;
  customer_id: number;
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
  duration_minutes: number;
  status: ConsultationStatusType;
  reason: string;
  customer_notes?: string | null;
  doctor_notes?: string | null;
  meeting_room_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  can_join?: boolean;
  time_until_start_seconds?: number | null;
  time_remaining_seconds?: number | null;
  is_expired?: boolean;
  created_at: string;
  updated_at: string;
  pet?: PetMinimal | null;
  doctor?: DoctorMinimal | null;
}

export interface PaginatedConsultations {
  items: Consultation[];
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ConsultationCreatePayload {
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
  reason: string;
  customer_notes?: string | null;
}

export interface ConsultationPaymentIntentRequest {
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
}

export interface ConsultationPaymentIntentResponse {
  doctor_id: number;
  amount: string; // Decimal as string
  currency: string;
  razorpay_order_id?: string | null;
  razorpay_key_id?: string | null;
}

export interface ConsultationBookWithPaymentPayload {
  pet_id: number;
  doctor_id: number;
  scheduled_at: string;
  reason: string;
  customer_notes?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
}

export interface ConsultationJoinResponse {
  meeting_room_id: string;
  room_name: string;
  jitsi_token: string;
  jitsi_app_id: string;
  jitsi_domain: string;
  is_moderator: boolean;
  role: string;
  expires_at: string;
}

// Fetch current user's consultation ledger
export const fetchMyConsultations = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedConsultations> => {
  const response = await apiClient.get('/consultations', { params });
  return response.data;
};

// Fetch single consultation detail
export const fetchConsultationDetail = async (id: number): Promise<Consultation> => {
  const response = await apiClient.get(`/consultations/${id}`);
  return response.data;
};

// Book a new consultation with verified backend payload
export const bookConsultation = async (
  payload: ConsultationCreatePayload
): Promise<Consultation> => {
  const response = await apiClient.post('/consultations', payload);
  return response.data;
};

// Create a Razorpay payment intent for a consultation's fee before booking it
export const createConsultationPaymentIntent = async (
  payload: ConsultationPaymentIntentRequest
): Promise<ConsultationPaymentIntentResponse> => {
  const response = await apiClient.post(
    '/consultations/create-payment-intent',
    payload
  );
  return response.data;
};

// Finalize the consultation booking after the Razorpay payment is verified
export const bookConsultationWithPayment = async (
  payload: ConsultationBookWithPaymentPayload
): Promise<Consultation> => {
  const response = await apiClient.post('/consultations/book-with-payment', payload);
  return response.data;
};

// Request signed Jitsi room token to join call
export const joinConsultation = async (id: number): Promise<ConsultationJoinResponse> => {
  const response = await apiClient.post(`/consultations/${id}/join`);
  return response.data;
};

// Record participant leave telemetry
export const leaveConsultation = async (id: number): Promise<any> => {
  const response = await apiClient.post(`/consultations/${id}/leave`);
  return response.data;
};

// Cancel an upcoming consultation
export const cancelConsultation = async (id: number): Promise<Consultation> => {
  const response = await apiClient.patch(`/consultations/${id}/cancel`);
  return response.data;
};
