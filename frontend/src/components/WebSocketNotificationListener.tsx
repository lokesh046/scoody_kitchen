import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toasts';
import { refreshToken } from '../api/client';
import type { NotificationResponse } from '../api/notifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getWsUrl = (token: string) => {
  const base = API_BASE_URL.startsWith('http') 
    ? API_BASE_URL 
    : `${window.location.protocol}//${window.location.host}${API_BASE_URL}`;
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/notifications/ws?token=${token}`;
};

export function WebSocketNotificationListener() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    if (!accessToken) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;

    const connectWs = () => {
      if (isDisposed) return;
      
      const url = getWsUrl(accessToken);
      console.log("[Global WebSocket] Connecting to:", url);
      socket = new WebSocket(url);

      socket.onopen = () => {
        console.log("[Global WebSocket] Connected successfully!");
      };

      socket.onmessage = (event) => {
        console.log("[Global WebSocket] Message received:", event.data);
        try {
          const notification: NotificationResponse = JSON.parse(event.data);
          
          // Trigger floating toast
          addToast(notification);
          setTimeout(() => {
            removeToast(notification.id);
          }, 6000);

          // Instantly insert into local notifications list cache (0ms latency!)
          queryClient.setQueryData(['myNotifications'], (oldData: NotificationResponse[] | undefined) => {
            if (!oldData) return [notification];
            if (oldData.some((n) => n.id === notification.id)) return oldData;
            return [notification, ...oldData];
          });

          // Instantly increment the unread count in local cache
          queryClient.setQueryData(['unreadNotificationsCount'], (oldData: { count: number } | undefined) => {
            if (!oldData) return { count: 1 };
            return { count: oldData.count + 1 };
          });
        } catch (err) {
          console.error("[Global WebSocket] Failed to parse payload:", err);
        }
      };

      socket.onclose = async (event) => {
        if (isDisposed) return;
        console.warn(`[Global WebSocket] Disconnected. Code: ${event.code}, Reason: ${event.reason || 'None'}.`);

        // If closed because of token verification error
        if (event.code === 1008 || event.code === 1006) {
          console.log("[Global WebSocket] Attempting silent token refresh to recover connection...");
          try {
            await refreshToken();
            return;
          } catch (err) {
            console.error("[Global WebSocket] Failed to refresh token during reconnect:", err);
          }
        }

        console.log("[Global WebSocket] Scheduling reconnect in 5s...");
        reconnectTimeout = setTimeout(connectWs, 5000);
      };

      socket.onerror = (error) => {
        console.error("[Global WebSocket] Error details:", error);
        socket?.close();
      };
    };

    connectWs();

    return () => {
      isDisposed = true;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [accessToken, queryClient, addToast, removeToast]);

  return null;
}
