import axios from 'axios';
import { useAuthStore } from '../store/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Necessary to send and receive HTTPOnly refresh cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach the current access token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Flag to prevent infinite looping during concurrent 401s
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  body?: any;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

let refreshPromise: Promise<string> | null = null;

// Exported refresh helper that shares the same promise for concurrent requests
export const refreshToken = (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true }
  )
    .then((response) => {
      refreshPromise = null;
      isRefreshing = false;
      const newAccessToken = response.data.access_token;
      const currentUser = useAuthStore.getState().user;
      const user = response.data.user || currentUser;

      // Save new token and user in Zustand store
      useAuthStore.getState().setAuth(user, newAccessToken);

      // Process queue of waiting requests
      processQueue(null, newAccessToken);
      return newAccessToken;
    })
    .catch((refreshError) => {
      refreshPromise = null;
      isRefreshing = false;
      processQueue(refreshError, null);

      const wasLoggedIn = localStorage.getItem('scooby_logged_in') === 'true';
      useAuthStore.getState().clearAuth();

      // Only dispatch redirect if they were actually logged in (session expired)
      if (wasLoggedIn) {
        window.dispatchEvent(new Event('auth-expired'));
      }

      throw refreshError;
    });

  return refreshPromise;
};

// Response Interceptor: Handle 401 Unauthorized errors with silent token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Guard: Only attempt refresh if response is 401, not already retried, and not the auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/magic-link')
    ) {
      if (isRefreshing) {
        // Queue this request and wait for the token refresh to finish
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshToken();
        
        // Re-execute original request with the new access token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
