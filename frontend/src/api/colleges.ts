import { apiClient } from './client';

export interface CollegeSearchResult {
  id: number;
  name: string;
  city: string;
  district: string;
}

/**
 * Query colleges by name with pg_trgm trigram search support.
 * Accepts an AbortSignal to cancel in-flight search requests.
 */
export const searchColleges = async (q: string, signal?: AbortSignal): Promise<CollegeSearchResult[]> => {
  const response = await apiClient.get<CollegeSearchResult[]>('/colleges/search', {
    params: { q },
    signal,
  });
  return response.data;
};
