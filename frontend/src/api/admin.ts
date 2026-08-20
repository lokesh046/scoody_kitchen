import { apiClient } from './client';

export interface OrderItemResponse {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: string;
}

export interface OrderResponse {
  id: number;
  user_id: number;
  total_amount: string;
  status: string;
  payment_method: string;
  shipping_address: string;
  shipping_city: string;
  shipping_phone: string;
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
  tracking_number?: string;
  carrier?: string;
}

export interface ClinicResponse {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  is_active: boolean;
}

export interface DoctorResponse {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  specialization: string;
  qualification?: string;
  experience_years?: number | null;
  consultation_fee?: string;
  license_number: string;
  bio?: string | null;
  profile_image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_available?: boolean;
  clinic_id: number;
  is_verified: boolean;
  is_active: boolean;
  clinic?: ClinicResponse;
}

export interface PaginatedClinics {
  items: ClinicResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedDoctors {
  items: DoctorResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ORDER MANAGEMENT
export const fetchAdminOrders = async (status?: string): Promise<OrderResponse[]> => {
  const response = await apiClient.get<OrderResponse[]>('/admin/orders', {
    params: { status: status || undefined }
  });
  return response.data;
};

export const updateAdminOrderStatus = async (orderId: number, status: string): Promise<OrderResponse> => {
  const response = await apiClient.patch<OrderResponse>(`/admin/orders/${orderId}/status`, {
    status
  });
  return response.data;
};

export const createOrderShipment = async (
  orderId: number,
  carrier: string,
  trackingNumber: string
): Promise<any> => {
  const response = await apiClient.post(`/admin/orders/${orderId}/shipment`, {
    carrier,
    tracking_number: trackingNumber
  });
  return response.data;
};

// CLINIC MANAGEMENT
export const fetchAdminClinics = async (page: number = 1, limit: number = 50): Promise<PaginatedClinics> => {
  const response = await apiClient.get<PaginatedClinics>('/admin/clinics', {
    params: { page, limit }
  });
  return response.data;
};

export const createAdminClinic = async (clinicData: {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
}): Promise<ClinicResponse> => {
  const response = await apiClient.post<ClinicResponse>('/admin/clinics', clinicData);
  return response.data;
};

// DOCTOR MANAGEMENT
export const fetchAdminDoctors = async (page: number = 1, limit: number = 50): Promise<PaginatedDoctors> => {
  const response = await apiClient.get<PaginatedDoctors>('/admin/doctors', {
    params: { page, limit }
  });
  return response.data;
};

export const createAdminDoctor = async (doctorData: {
  user_email: string;
  specialization: string;
  license_number: string;
  clinic_id: number;
  consultation_fee: string;
}): Promise<DoctorResponse> => {
  const response = await apiClient.post<DoctorResponse>('/admin/doctors', {
    user_email: doctorData.user_email,
    specialization: doctorData.specialization,
    license_number: doctorData.license_number,
    clinic_id: Number(doctorData.clinic_id),
    consultation_fee: doctorData.consultation_fee
  });
  return response.data;
};

export const verifyAdminDoctor = async (doctorId: number, isVerified: boolean): Promise<DoctorResponse> => {
  const response = await apiClient.patch<DoctorResponse>(`/admin/doctors/${doctorId}/verify`, null, {
    params: { is_verified: isVerified }
  });
  return response.data;
};

export const updateAdminDoctorStatus = async (doctorId: number, isActive: boolean): Promise<DoctorResponse> => {
  const response = await apiClient.patch<DoctorResponse>(`/admin/doctors/${doctorId}/status`, null, {
    params: { is_active: isActive }
  });
  return response.data;
};

export const updateAdminClinicStatus = async (clinicId: number, isActive: boolean): Promise<ClinicResponse> => {
  const response = await apiClient.patch<ClinicResponse>(`/admin/clinics/${clinicId}`, {
    is_active: isActive
  });
  return response.data;
};

export const cleanupUnverifiedUsers = async (maxAgeHours: number = 24): Promise<{ message: string; deleted_count: number }> => {
  const response = await apiClient.delete<{ message: string; deleted_count: number }>('/admin/users/cleanup-unverified', {
    params: { max_age_hours: maxAgeHours }
  });
  return response.data;
};

export const getAdminDoctor = async (doctorId: number): Promise<DoctorResponse> => {
  const response = await apiClient.get<DoctorResponse>(`/admin/doctors/${doctorId}`);
  return response.data;
};

export const updateAdminDoctor = async (doctorId: number, data: any): Promise<DoctorResponse> => {
  const response = await apiClient.patch<DoctorResponse>(`/admin/doctors/${doctorId}`, data);
  return response.data;
};

export interface PaginatedConsultations {
  items: any[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const fetchAdminConsultations = async (page: number = 1, limit: number = 20, status?: string): Promise<PaginatedConsultations> => {
  const response = await apiClient.get<PaginatedConsultations>('/admin/consultations', {
    params: { page, limit, status }
  });
  return response.data;
};

export const updateAdminConsultationStatus = async (consultationId: number, status: string): Promise<any> => {
  const response = await apiClient.patch<any>(`/admin/consultations/${consultationId}/status`, { status });
  return response.data;
};
