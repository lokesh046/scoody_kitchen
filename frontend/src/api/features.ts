import { apiClient } from './client';

export type FeatureFallbackBehavior = 'hide' | 'coming_soon' | 'unavailable';

export interface AdminFeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string;
  category: string;
  is_enabled: boolean;
  fallback_behavior: FeatureFallbackBehavior;
  updated_at: string;
  updated_by_id?: number | null;
}

export interface PublicFeatureFlagState {
  enabled: boolean;
  fallback_behavior: FeatureFallbackBehavior;
}

export const fetchPublicFeatures = async (): Promise<Record<string, PublicFeatureFlagState>> => {
  const response = await apiClient.get<Record<string, PublicFeatureFlagState>>('/features/public');
  return response.data;
};

export const fetchAdminFeatures = async (): Promise<AdminFeatureFlag[]> => {
  const response = await apiClient.get<AdminFeatureFlag[]>('/admin/features');
  return response.data;
};

export const updateAdminFeature = async (
  key: string,
  is_enabled: boolean,
  fallback_behavior?: FeatureFallbackBehavior
): Promise<AdminFeatureFlag> => {
  const response = await apiClient.patch<AdminFeatureFlag>(`/admin/features/${key}`, {
    is_enabled,
    ...(fallback_behavior ? { fallback_behavior } : {}),
  });
  return response.data;
};
