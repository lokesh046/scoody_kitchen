import apiClient from './client';
import type { Order } from './orders';
import type { Consultation } from './consultations';

export type SupportTicketCategory = 'order_issue' | 'consultation_issue' | 'product_issue' | 'payment' | 'account' | 'other';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportUserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export interface SupportMessageResponse {
  id: number;
  ticket_id: number;
  sender_id: number;
  is_staff_reply: boolean;
  body: string;
  created_at: string;
  sender?: SupportUserResponse | null;
}

export interface SupportTicketResponse {
  id: number;
  customer_id: number;
  order_id: number | null;
  consultation_id: number | null;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  assigned_admin_id: number | null;
  created_at: string;
  updated_at: string;
  customer?: SupportUserResponse | null;
  assigned_admin?: SupportUserResponse | null;
}

export interface SupportTicketDetailResponse extends SupportTicketResponse {
  messages: SupportMessageResponse[];
  order?: Order | null;
  consultation?: Consultation | null;
}

export interface PaginatedSupportTickets {
  items: SupportTicketResponse[];
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export const createSupportTicket = async (payload: {
  subject: string;
  category: SupportTicketCategory;
  order_id?: number | null;
  consultation_id?: number | null;
  message: string;
}): Promise<SupportTicketDetailResponse> => {
  const response = await apiClient.post<SupportTicketDetailResponse>('/support/tickets', payload);
  return response.data;
};

export const fetchMySupportUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get<{ count: number }>('/support/unread-count');
  return response.data.count;
};

export const fetchMySupportTickets = async (
  page: number = 1,
  limit: number = 20
): Promise<PaginatedSupportTickets> => {
  const response = await apiClient.get<PaginatedSupportTickets>('/support/tickets', {
    params: { skip: (page - 1) * limit, limit },
  });
  return response.data;
};

export const fetchMySupportTicketById = async (ticketId: number): Promise<SupportTicketDetailResponse> => {
  const response = await apiClient.get<SupportTicketDetailResponse>(`/support/tickets/${ticketId}`);
  return response.data;
};

export const replyToMySupportTicket = async (
  ticketId: number,
  body: string
): Promise<SupportMessageResponse> => {
  const response = await apiClient.post<SupportMessageResponse>(`/support/tickets/${ticketId}/messages`, { body });
  return response.data;
};
