import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_TOUR_SEEN_KEY = '@scooby_home_tour_seen';

interface TourState {
  hasLoadedSeenFlag: boolean;
  hasSeenHomeTour: boolean;
  isTourActive: boolean;
  stepIndex: number;
  loadSeenFlag: () => Promise<void>;
  startTour: () => void;
  nextStep: (totalSteps: number) => void;
  endTour: () => void;
}

// First-run coach-mark tour of the Home screen (see AppTour.tsx). Shown once
// per install — dismissing or completing it both permanently mark it seen,
// per the onboarding principle of never re-showing initial onboarding to a
// returning user.
export const useTourStore = create<TourState>((set, get) => ({
  hasLoadedSeenFlag: false,
  hasSeenHomeTour: true, // default true until AsyncStorage resolves, so the tour never flashes on for a returning user before the flag loads
  isTourActive: false,
  stepIndex: 0,

  loadSeenFlag: async () => {
    try {
      const seen = await AsyncStorage.getItem(HOME_TOUR_SEEN_KEY);
      set({ hasSeenHomeTour: seen === 'true', hasLoadedSeenFlag: true });
    } catch {
      set({ hasSeenHomeTour: true, hasLoadedSeenFlag: true });
    }
  },

  startTour: () => set({ isTourActive: true, stepIndex: 0 }),

  nextStep: (totalSteps: number) => {
    const next = get().stepIndex + 1;
    if (next >= totalSteps) {
      get().endTour();
    } else {
      set({ stepIndex: next });
    }
  },

  endTour: () => {
    set({ isTourActive: false, hasSeenHomeTour: true });
    AsyncStorage.setItem(HOME_TOUR_SEEN_KEY, 'true').catch(() => {});
  },
}));
