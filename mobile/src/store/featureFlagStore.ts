import { create } from 'zustand';
import { fetchPublicFeatures } from '../api/features';

interface FeatureFlagState {
  flags: Record<string, boolean>;
  isLoaded: boolean;
  fetchFlags: () => Promise<void>;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set) => ({
  flags: {},
  isLoaded: false,
  fetchFlags: async () => {
    try {
      const flags = await fetchPublicFeatures();
      set({ flags, isLoaded: true });
    } catch {
      // Keep whatever defaults callers apply; mark loaded so callers stop waiting.
      set({ isLoaded: true });
    }
  },
}));
