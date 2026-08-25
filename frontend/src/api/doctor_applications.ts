import { apiClient } from './client';

export interface DoctorApplicationResponse {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: string;
  license_number: string;
  bio: string | null;
  degree_start_year: number;
  degree_end_year: number;
  nationality: string;
  clinic_name: string;
  clinic_address: string;
  clinic_city: string;
  clinic_state: string;
  aadhaar_card_url: string | null;
  pan_card_url: string | null;
  medical_certificate_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  education_history?: string | null;
}

export interface DoctorApplicationCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number;
  license_number: string;
  bio?: string;
  degree_start_year: number;
  degree_end_year: number;
  nationality: string;
  clinic_name: string;
  clinic_address: string;
  clinic_city: string;
  clinic_state: string;
  aadhaar_card_url?: string | null;
  pan_card_url?: string | null;
  medical_certificate_url?: string | null;
  education_history?: string | null;
}

/**
 * Upload a document (Aadhaar, PAN, Medical Certificate) to get its secure URL.
 */
export const uploadDoctorDocument = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post<{ url: string }>('/doctor-applications/upload-document', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.url;
};

/**
 * Submit onboarding doctor application
 */
export const submitDoctorApplication = async (data: DoctorApplicationCreate): Promise<DoctorApplicationResponse> => {
  const response = await apiClient.post<DoctorApplicationResponse>('/doctor-applications', data);
  return response.data;
};

/**
 * Fetch status of the logged-in user's doctor application
 */
export const fetchMyApplicationStatus = async (): Promise<DoctorApplicationResponse | null> => {
  const response = await apiClient.get<DoctorApplicationResponse | null>('/doctor-applications/status');
  return response.data;
};

/**
 * [Admin] Fetch all applications
 */
export const fetchDoctorApplications = async (status?: string): Promise<DoctorApplicationResponse[]> => {
  const response = await apiClient.get<DoctorApplicationResponse[]>('/doctor-applications', {
    params: { status: status || undefined },
  });
  return response.data;
};

/**
 * [Admin] Direct Approve / Reject status update
 */
export const updateApplicationStatus = async (id: number, status: 'APPROVED' | 'REJECTED'): Promise<DoctorApplicationResponse> => {
  const response = await apiClient.patch<DoctorApplicationResponse>(`/doctor-applications/${id}/status`, { status });
  return response.data;
};

/**
 * [Admin] Export CSV with date parameters
 */
export const exportDoctorApplicationsCsv = async (startDate?: string, endDate?: string): Promise<Blob> => {
  const response = await apiClient.get('/doctor-applications/export', {
    params: {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    },
    responseType: 'blob',
  });
  return new Blob([response.data], { type: 'text/csv' });
};

/**
 * [Admin] Import CSV of verified doctors
 */
export const importDoctorApplicationsCsv = async (file: File): Promise<{ message: string; success_count: number; warnings: string[] }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post<{ message: string; success_count: number; warnings: string[] }>(
    '/doctor-applications/import-csv',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};
