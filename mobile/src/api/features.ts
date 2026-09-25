import apiClient from './client';

export type FeatureFallbackBehavior = 'hide' | 'coming_soon' | 'unavailable';

export interface PublicFeatureFlagState {
  enabled: boolean;
  fallback_behavior: FeatureFallbackBehavior;
}

export const fetchPublicFeatures = async (): Promise<Record<string, PublicFeatureFlagState>> => {
  const response = await apiClient.get<Record<string, PublicFeatureFlagState>>('/features/public');
  return response.data;
};
