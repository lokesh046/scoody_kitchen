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

// "Vets Near Me" — merges registered vets with real-world clinics from
// Google Places. radiusKm must be one of the server's presets (2/5/10).
export interface NearbyClinicResult {
  source: 'registered' | 'google';
  distance_km: number;
  latitude: number | null;
  longitude: number | null;
  doctor_id: number | null;
  name: string | null;
  specialization: string | null;
  consultation_fee: string | null;
  profile_image_url: string | null;
  average_rating: number | null;
  review_count: number | null;
  clinic_name: string | null;
  address: string | null;
  phone: string | null;
  opening_hours: string[] | null;
  place_id: string | null;
}

export interface NearbyClinicsResponse {
  results: NearbyClinicResult[];
  radius_km_used: number;
  fallback_to_registered_only: boolean;
}

export interface PlaceDetailsResponse {
  place_id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  opening_hours: string[] | null;
  photo_url: string | null;
}

export const fetchNearbyClinics = async (
  lat: number,
  lng: number,
  radiusKm: 2 | 5 | 10
): Promise<NearbyClinicsResponse> => {
  const response = await apiClient.get('/doctors/nearby-clinics', {
    params: { latitude: lat, longitude: lng, radius_km: radiusKm },
  });
  return response.data;
};

export const fetchClinicDetails = async (placeId: string): Promise<PlaceDetailsResponse> => {
  const response = await apiClient.get(`/doctors/nearby-clinics/${encodeURIComponent(placeId)}`);
  return response.data;
};

// Google Maps "get directions" deep link — same shape as the web app's
// helper, works for both registered vets (lat/lng from our own Clinic
// record) and Google-sourced clinics (lat/lng from the Places response).
export const buildDirectionsUrl = (clinic: NearbyClinicResult): string | null => {
  if (clinic.latitude == null || clinic.longitude == null) return null;
  const params = new URLSearchParams({ api: '1', destination: `${clinic.latitude},${clinic.longitude}` });
  if (clinic.place_id) params.set('destination_place_id', clinic.place_id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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


