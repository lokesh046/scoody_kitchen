import apiClient from './client';

export const fetchPublicFeatures = async (): Promise<Record<string, boolean>> => {
  const response = await apiClient.get<Record<string, boolean>>('/features/public');
  return response.data;
};
