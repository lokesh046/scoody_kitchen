import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchPublicFeatures, type PublicFeatureFlagState } from '../api/features';

// The last flags the server sent are kept on the phone. On the next launch they are used straight away, so a feature that is
// off (like the "Coming soon" recipe cards) looks right from the first frame instead of flashing as "on" until the
// network answers. The fresh answer from the server replaces them a moment later.
const CACHE_KEY = 'feature_flags_cache_v1';

interface FeatureFlagState {
  flags: Record<string, PublicFeatureFlagState>;
  isLoaded: boolean;
  /** Loads the saved flags from the phone, if there are any and the server has not already answered. */
  hydrateFlags: () => Promise<void>;
  fetchFlags: () => Promise<void>;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: {},
  isLoaded: false,
  hydrateFlags: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw || get().isLoaded) return; // nothing saved, or the server was faster
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') set({ flags: saved, isLoaded: true });
    } catch {
      // No usable saved flags: the app waits for the server, as before.
    }
  },
  fetchFlags: async () => {
    try {
      const flags = await fetchPublicFeatures();
      set({ flags, isLoaded: true });
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(flags)).catch(() => undefined);
    } catch {
      // Keep whatever defaults callers apply; mark loaded so callers stop waiting.
      set({ isLoaded: true });
    }
  },
}));
