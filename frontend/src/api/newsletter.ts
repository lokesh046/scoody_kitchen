import { apiClient } from './client';

export interface NewsletterSubscriberResponse {
  id: number;
  email: string;
  is_active: boolean;
  source: string | null;
  created_at: string;
}

export const subscribeToNewsletter = async (email: string, source?: string): Promise<NewsletterSubscriberResponse> => {
  const response = await apiClient.post<NewsletterSubscriberResponse>('/newsletter/subscribe', { email, source });
  return response.data;
};

export const fetchAllNewsletterSubscribers = async (): Promise<NewsletterSubscriberResponse[]> => {
  const response = await apiClient.get<NewsletterSubscriberResponse[]>('/newsletter/all');
  return response.data;
};

export const deleteNewsletterSubscriber = async (id: number): Promise<void> => {
  await apiClient.delete(`/newsletter/${id}`);
};
