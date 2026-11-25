import axios from 'axios';
import { useAuthStore, type User } from '../store/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

// The backend rotates the refresh token on every use (the old one is revoked as soon as a new one
// is issued). If two tabs each call /auth/refresh around the same moment, the loser sends a token
// that's already been revoked by the winner and gets logged out for no real reason. The lock +
// broadcast below make only one tab actually call the endpoint; the rest just wait for its result.
const REFRESH_CHANNEL_NAME = 'scooby-auth-refresh';
const REFRESH_LOCK_KEY = 'scooby_refresh_lock';
const REFRESH_LOCK_TTL_MS = 5000; // stale-lock cutoff, in case the leader tab crashed/closed without releasing it
const REFRESH_WAIT_TIMEOUT_MS = 4000;

type RefreshBroadcastMessage =
  | { type: 'refresh-success'; accessToken: string; user: User | null }
  | { type: 'refresh-failure' };

let refreshChannel: BroadcastChannel | null = null;
try {
  refreshChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(REFRESH_CHANNEL_NAME) : null;
} catch {
  refreshChannel = null;
}

function tryAcquireRefreshLock(): boolean {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (raw) {
      const { ts } = JSON.parse(raw) as { ts: number };
      if (Date.now() - ts < REFRESH_LOCK_TTL_MS) return false; // another tab is actively refreshing
    }
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ ts: Date.now() }));
    return true;
  } catch {
    return true; // storage unavailable - don't block, just behave like before
  }
}

function releaseRefreshLock() {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    // ignore
  }
}

// Waits for the tab currently holding the lock to broadcast its result. Falls back to doing the
// refresh itself if nothing arrives in time (e.g. that tab was closed mid-request).
function waitForBroadcastRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!refreshChannel) {
      reject(new Error('no-broadcast-channel'));
      return;
    }
    const timeout = setTimeout(() => {
      refreshChannel?.removeEventListener('message', onMessage);
      reject(new Error('refresh-wait-timeout'));
    }, REFRESH_WAIT_TIMEOUT_MS);

    const onMessage = (event: MessageEvent<RefreshBroadcastMessage>) => {
      if (event.data.type === 'refresh-success') {
        clearTimeout(timeout);
        refreshChannel?.removeEventListener('message', onMessage);
        const currentUser = useAuthStore.getState().user;
        useAuthStore.getState().setAuth(event.data.user ?? currentUser, event.data.accessToken);
        resolve(event.data.accessToken);
      } else if (event.data.type === 'refresh-failure') {
        clearTimeout(timeout);
        refreshChannel?.removeEventListener('message', onMessage);
        reject(new Error('refresh-failed-in-other-tab'));
      }
    };
    refreshChannel.addEventListener('message', onMessage);
  });
}

function performRefresh(): Promise<string> {
  isRefreshing = true;
  return axios.post(
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
      refreshChannel?.postMessage({ type: 'refresh-success', accessToken: newAccessToken, user } satisfies RefreshBroadcastMessage);
      releaseRefreshLock();

      // Process queue of waiting requests
      processQueue(null, newAccessToken);
      return newAccessToken;
    })
    .catch((refreshError) => {
      refreshPromise = null;
      isRefreshing = false;
      refreshChannel?.postMessage({ type: 'refresh-failure' } satisfies RefreshBroadcastMessage);
      releaseRefreshLock();
      processQueue(refreshError, null);

      const wasLoggedIn = localStorage.getItem('scooby_logged_in') === 'true';
      useAuthStore.getState().clearAuth();

      // Only dispatch redirect if they were actually logged in (session expired)
      if (wasLoggedIn) {
        window.dispatchEvent(new Event('auth-expired'));
      }

      throw refreshError;
    });
}

// Exported refresh helper that shares the same promise for concurrent requests within this tab,
// and defers to another tab's in-flight refresh (see above) instead of racing it.
export const refreshToken = (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  if (!tryAcquireRefreshLock()) {
    refreshPromise = waitForBroadcastRefresh()
      .then((token) => {
        refreshPromise = null;
        return token;
      })
      .catch(() => {
        refreshPromise = null;
        return performRefresh();
      });
    return refreshPromise;
  }

  refreshPromise = performRefresh();
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
