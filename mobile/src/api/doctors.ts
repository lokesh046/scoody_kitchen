import apiClient from './client';
import { Doctor } from '../types';

export const fetchDoctors = async (params?: {
  search?: string;
  specialization?: string;
  city?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: Doctor[]; total: number; page: number; pages: number }> => {
  const response = await apiClient.get('/doctors', { params });
  return response.data;
};

export const fetchNearbyDoctors = async (lat: number, lng: number, radiusKm = 15): Promise<Doctor[]> => {
  const response = await apiClient.get('/doctors/nearby', {
    params: { latitude: lat, longitude: lng, radius_km: radiusKm },
  });
  return response.data;
};

export interface DoctorAvailabilityWindow {
  id: number;
  doctor_id: number;
  day_of_week: string; // e.g. 'monday', 'tuesday', etc.
  start_time: string; // '09:00:00'
  end_time: string; // '20:00:00'
  is_available: boolean;
}

export interface DoctorScheduleResponse {
  doctor_id: number;
  is_accepting_consultations: boolean;
  schedule: DoctorAvailabilityWindow[];
}

export const fetchDoctorSchedule = async (
  doctorId: number
): Promise<DoctorScheduleResponse> => {
  const response = await apiClient.get(`/doctors/${doctorId}/availability`);
  return response.data;
};

export interface DoctorSlotsResponse {
  doctor_id: number;
  date: string;
  duration_minutes: number;
  slots: string[];
}

export const fetchDoctorSlots = async (
  doctorId: number,
  dateStr: string
): Promise<DoctorSlotsResponse> => {
  const response = await apiClient.get(`/doctors/${doctorId}/slots`, {
    params: { date: dateStr },
  });
  return response.data;
};

export interface DoctorReviewItem {
  id: number;
  consultation_id: number;
  doctor_id: number;
  customer_id: number;
  rating: number;
  comment?: string;
  created_at: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
  };
}

export const fetchDoctorDetail = async (doctorId: number): Promise<Doctor> => {
  const response = await apiClient.get(`/doctors/${doctorId}`);
  return response.data;
};

export const fetchDoctorReviews = async (
  doctorId: number
): Promise<{ items: DoctorReviewItem[]; total_items: number }> => {
  const response = await apiClient.get(`/reviews/doctors/${doctorId}`);
  return response.data;
};


