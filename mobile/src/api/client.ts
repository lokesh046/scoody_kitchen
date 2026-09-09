import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveHost } from './resolveHost';
import { getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '../services/secureTokenStorage';

export const BASE_URL = resolveHost(8000, process.env.EXPO_PUBLIC_API_URL);
console.log('[API Client] Active backend baseURL:', BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

// Refresh token queue management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Silent token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthUrl =
      url.includes('/auth/refresh') ||
      url.includes('/auth/magic-link') ||
      url.includes('/auth/google') ||
      url.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthUrl) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        console.log('[API Client] Access token expired (401). Silently refreshing with refresh token...');

        // Use clean Axios instance to avoid infinite loop
        const res = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refresh_token: storedRefreshToken },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );

        const { access_token, refresh_token: newRefreshToken } = res.data;
        if (!access_token) {
          throw new Error('Malformed token refresh response');
        }

        console.log('[API Client] Silent token refresh succeeded!');

        // Update default header for subsequent requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

        // Persist fresh tokens
        await setAccessToken(access_token);
        if (newRefreshToken) {
          await setRefreshToken(newRefreshToken);
        }

        // Sync zustand authStore without circular dependency
        try {
          const { useAuthStore } = require('../store/authStore');
          useAuthStore.getState().setTokens(access_token, newRefreshToken || storedRefreshToken);
        } catch {
          // ignore module resolution edge cases
        }

        // Release queued requests
        processQueue(null, access_token);

        // Replay original request
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshErr: any) {
        console.warn('[API Client] Refresh token expired or revoked. Logging out user:', refreshErr?.message);
        processQueue(refreshErr, null);

        try {
          const { useAuthStore } = require('../store/authStore');
          useAuthStore.getState().logout();
        } catch {
          await clearTokens();
          await AsyncStorage.multiRemove(['@auth_user', '@auth_guest']);
          delete apiClient.defaults.headers.common['Authorization'];
        }

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const refreshAuthTokenSilently = async (): Promise<string | null> => {
  try {
    const storedRefreshToken = await getRefreshToken();
    if (!storedRefreshToken) return null;
    const res = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refresh_token: storedRefreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const { access_token, refresh_token: newRefreshToken } = res.data;
    if (access_token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await setAccessToken(access_token);
      if (newRefreshToken) {
        await setRefreshToken(newRefreshToken);
      }
      try {
        const { useAuthStore } = require('../store/authStore');
        useAuthStore.getState().setTokens(access_token, newRefreshToken || storedRefreshToken);
      } catch {}
      return access_token;
    }
  } catch {
    return null;
  }
  return null;
};

export default apiClient;
