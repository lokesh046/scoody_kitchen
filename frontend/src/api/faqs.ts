import { apiClient } from './client';
import type { FAQResponse } from '../types/faq';
import type { FaqPage } from '../constants/contentPlacements';

export const fetchActiveFaqs = async (page: FaqPage = 'home'): Promise<FAQResponse[]> => {
  const response = await apiClient.get<FAQResponse[]>('/faqs/', { params: { page } });
  return response.data;
};

export const fetchAllFaqs = async (): Promise<FAQResponse[]> => {
  const response = await apiClient.get<FAQResponse[]>('/faqs/all');
  return response.data;
};

export interface FaqPayload {
  question: string;
  answer: string;
  page?: FaqPage;
  display_order: number;
  is_active: boolean;
}

export const createFaq = async (payload: FaqPayload): Promise<FAQResponse> => {
  const response = await apiClient.post<FAQResponse>('/faqs/', payload);
  return response.data;
};

export const updateFaq = async (id: number, payload: Partial<FaqPayload>): Promise<FAQResponse> => {
  const response = await apiClient.patch<FAQResponse>(`/faqs/${id}`, payload);
  return response.data;
};

export const deleteFaq = async (id: number): Promise<void> => {
  await apiClient.delete(`/faqs/${id}`);
};
