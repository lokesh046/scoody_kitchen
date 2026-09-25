import apiClient from './client';

// Nominatim's raw search result shape — lat/lon come back as strings.
export interface PincodeLookupResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export const lookupPincode = async (code: string): Promise<PincodeLookupResult[]> => {
  const response = await apiClient.get<PincodeLookupResult[]>('/geo/pincode', {
    params: { code },
  });
  return response.data;
};
