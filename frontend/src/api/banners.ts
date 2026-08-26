import { apiClient } from './client';
import type { BannerResponse } from '../types/banner';

export const fetchActiveBanners = async (): Promise<BannerResponse[]> => {
  const response = await apiClient.get<BannerResponse[]>('/banners');
  return response.data;
};

export const fetchAllBanners = async (): Promise<BannerResponse[]> => {
  const response = await apiClient.get<BannerResponse[]>('/banners/all');
  return response.data;
};

export const createBanner = async (formData: FormData): Promise<BannerResponse> => {
  const response = await apiClient.post<BannerResponse>('/banners/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateBanner = async (id: number, formData: FormData): Promise<BannerResponse> => {
  const response = await apiClient.patch<BannerResponse>(`/banners/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteBanner = async (id: number): Promise<void> => {
  await apiClient.delete(`/banners/${id}`);
};
