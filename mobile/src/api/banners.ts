import apiClient from './client';

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

export const fetchActiveBanners = async (): Promise<Banner[]> => {
  const response = await apiClient.get<Banner[]>('/banners/');
  return response.data;
};
