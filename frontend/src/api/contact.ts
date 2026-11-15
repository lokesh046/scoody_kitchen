import { apiClient } from './client';

export type ContactReason = 'general' | 'sales' | 'promotion' | 'investment' | 'partnership' | 'other';

export interface ContactInquiryPayload {
  reason: ContactReason;
  name: string;
  email: string;
  phone?: string;
  notes: string;
  /** Honeypot: stays empty for real visitors. */
  website?: string;
}

export const sendContactInquiry = async (payload: ContactInquiryPayload): Promise<void> => {
  await apiClient.post('/contact', payload);
};
