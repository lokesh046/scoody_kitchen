import apiClient from './client';
import { withTtlCache } from './ttlCache';

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// FAQs rarely change between admin updates — same caching rationale as
// banners.ts, so every Home screen focus/mount doesn't refetch from scratch.
export const fetchActiveFaqs = async (): Promise<FAQ[]> => {
  return withTtlCache('faqs:active', 5 * 60 * 1000, async () => {
    const response = await apiClient.get<FAQ[]>('/faqs/');
    return response.data;
  });
};
