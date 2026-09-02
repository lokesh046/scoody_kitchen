import { apiClient } from './client';

export interface AdminFeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string;
  category: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by_id?: number | null;
}

export const fetchPublicFeatures = async (): Promise<Record<string, boolean>> => {
  const response = await apiClient.get<Record<string, boolean>>('/features/public');
  return response.data;
};

export const fetchAdminFeatures = async (): Promise<AdminFeatureFlag[]> => {
  const response = await apiClient.get<AdminFeatureFlag[]>('/admin/features');
  return response.data;
};

export const updateAdminFeature = async (
  key: string,
  is_enabled: boolean
): Promise<AdminFeatureFlag> => {
  const response = await apiClient.patch<AdminFeatureFlag>(`/admin/features/${key}`, {
    is_enabled,
  });
  return response.data;
};
