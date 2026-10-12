import { apiClient } from './client';
import type { FAQResponse } from '../types/faq';

export const fetchActiveFaqs = async (): Promise<FAQResponse[]> => {
  const response = await apiClient.get<FAQResponse[]>('/faqs/');
  return response.data;
};

export const fetchAllFaqs = async (): Promise<FAQResponse[]> => {
  const response = await apiClient.get<FAQResponse[]>('/faqs/all');
  return response.data;
};

export interface FaqPayload {
  question: string;
  answer: string;
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
