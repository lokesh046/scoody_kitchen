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
