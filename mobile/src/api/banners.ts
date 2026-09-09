import apiClient from './client';
import { withTtlCache } from './ttlCache';

export interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// Banners rarely change between admin updates — cache briefly so every
// Home screen focus/mount doesn't refetch from scratch.
export const fetchActiveBanners = async (): Promise<Banner[]> => {
  return withTtlCache('banners:active', 5 * 60 * 1000, async () => {
    const response = await apiClient.get<Banner[]>('/banners/');
    return response.data;
  });
};
