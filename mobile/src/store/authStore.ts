import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { resetTabPrefetch } from '../services/tabPrefetch';
import { clearPushTokenOnLogout } from '../services/pushNotifications';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '../services/secureTokenStorage';

export interface UserProfile {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  profile_image_url?: string | null;
  role: string;
  is_email_verified: boolean;
  is_phone_verified?: boolean;
  is_active: boolean;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isGuest: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  setAuth: (user: UserProfile | null, accessToken: string | null, refreshToken?: string | null) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  hydrateAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isGuest: false,
  isLoading: false,
  isHydrated: false,
  setAuth: async (user, accessToken, refreshToken = null) => {
    if (accessToken) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      await setAccessToken(accessToken);
      if (refreshToken) {
        await setRefreshToken(refreshToken);
      }
      if (user) {
        await AsyncStorage.setItem('@auth_user', JSON.stringify(user));
      }
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
      await clearTokens();
      await AsyncStorage.removeItem('@auth_user');
    }
    set({ user, accessToken, refreshToken: refreshToken || null, isGuest: false });
  },
  setTokens: async (accessToken: string, refreshToken: string) => {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    await Promise.all([setAccessToken(accessToken), setRefreshToken(refreshToken)]);
    set({ accessToken, refreshToken });
  },
  updateUser: async (user) => {
    await AsyncStorage.setItem('@auth_user', JSON.stringify(user));
    set({ user });
  },
  continueAsGuest: async () => {
    await AsyncStorage.setItem('@auth_guest', 'true');
    set({ isGuest: true });
  },
  logout: async () => {
    try {
      const storedRefreshToken = await getRefreshToken();
      await apiClient.post('/auth/logout', null, {
        params: storedRefreshToken ? { refresh_token: storedRefreshToken } : undefined,
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      await clearPushTokenOnLogout();
      delete apiClient.defaults.headers.common['Authorization'];
      await clearTokens();
      await AsyncStorage.multiRemove(['@auth_user', '@auth_guest']);
      set({ user: null, accessToken: null, refreshToken: null, isGuest: false });
      resetTabPrefetch();
    }
  },
  hydrateAuth: async () => {
    try {
      const [token, refreshToken, userStr, guestStr] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
        AsyncStorage.getItem('@auth_user'),
        AsyncStorage.getItem('@auth_guest'),
      ]);
      if (token && userStr) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({
          user: JSON.parse(userStr),
          accessToken: token,
          refreshToken: refreshToken || null,
          isGuest: false,
          isHydrated: true,
        });
      } else if (guestStr === 'true') {
        set({ isGuest: true, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },
}));
