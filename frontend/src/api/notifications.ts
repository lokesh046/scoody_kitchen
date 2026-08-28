import { apiClient } from './client';

export interface NotificationResponse {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface UnreadCountResponse {
  count: number;
}

export const fetchMyNotifications = async (skip: number = 0, limit: number = 20): Promise<NotificationResponse[]> => {
  const response = await apiClient.get<NotificationResponse[]>('/notifications', {
    params: { skip, limit }
  });
  return response.data;
};

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> => {
  const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
  return response.data;
};

export const markNotificationAsRead = async (notificationId: number): Promise<NotificationResponse> => {
  const response = await apiClient.patch<NotificationResponse>(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async (): Promise<{ message: string }> => {
  const response = await apiClient.patch<{ message: string }>('/notifications/read-all');
  return response.data;
};

export const sendGlobalBroadcast = async (title: string, message: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/notifications/broadcast', {
    title,
    message
  });
  return response.data;
};
