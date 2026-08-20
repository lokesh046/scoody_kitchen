import { create } from 'zustand';

export interface User {
  id: number;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  profile_image_url?: string | null;
  auth_provider?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User | null, accessToken: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => {
    if (accessToken) {
      localStorage.setItem('scooby_logged_in', 'true');
    } else {
      localStorage.removeItem('scooby_logged_in');
    }
    set({ user, accessToken });
  },
  clearAuth: () => {
    localStorage.removeItem('scooby_logged_in');
    set({ user: null, accessToken: null });
  },
}));
