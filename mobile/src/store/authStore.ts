import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

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
      await AsyncStorage.setItem('@auth_token', accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem('@auth_refresh_token', refreshToken);
      }
      if (user) {
        await AsyncStorage.setItem('@auth_user', JSON.stringify(user));
      }
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
      await AsyncStorage.multiRemove(['@auth_token', '@auth_refresh_token', '@auth_user']);
    }
    set({ user, accessToken, refreshToken: refreshToken || null, isGuest: false });
  },
  setTokens: async (accessToken: string, refreshToken: string) => {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    await Promise.all([
      AsyncStorage.setItem('@auth_token', accessToken),
      AsyncStorage.setItem('@auth_refresh_token', refreshToken),
    ]);
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
      const storedRefreshToken = await AsyncStorage.getItem('@auth_refresh_token');
      await apiClient.post('/auth/logout', null, {
        params: storedRefreshToken ? { refresh_token: storedRefreshToken } : undefined,
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      delete apiClient.defaults.headers.common['Authorization'];
      await AsyncStorage.multiRemove(['@auth_token', '@auth_refresh_token', '@auth_user', '@auth_guest']);
      set({ user: null, accessToken: null, refreshToken: null, isGuest: false });
    }
  },
  hydrateAuth: async () => {
    try {
      const [token, refreshToken, userStr, guestStr] = await Promise.all([
        AsyncStorage.getItem('@auth_token'),
        AsyncStorage.getItem('@auth_refresh_token'),
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
