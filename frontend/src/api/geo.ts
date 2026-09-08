import { apiClient } from './client';

export interface IpLocateResponse {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  countryCode?: string;
  ip?: string;
  is_fallback?: boolean;
}

export async function fetchIpLocation(): Promise<IpLocateResponse> {
  const res = await apiClient.get<IpLocateResponse>('/geo/ip-locate');
  return res.data;
}

export async function reverseGeocode(lat: number, lon: number): Promise<any> {
  const res = await apiClient.get('/geo/reverse', {
    params: { lat, lon },
  });
  return res.data;
}

export async function lookupPincode(code: string): Promise<any[]> {
  const res = await apiClient.get<any[]>('/geo/pincode', {
    params: { code },
  });
  return res.data;
}
