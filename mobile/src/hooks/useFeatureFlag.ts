import { useFeatureFlagStore } from '../store/featureFlagStore';
import type { FeatureFallbackBehavior } from '../api/features';

export const useFeatureFlag = (key: string, defaultEnabled = true): boolean => {
  const flags = useFeatureFlagStore((state) => state.flags);
  const isLoaded = useFeatureFlagStore((state) => state.isLoaded);
  if (!isLoaded || flags[key] === undefined) {
    return defaultEnabled;
  }
  return flags[key].enabled;
};

// For the handful of features that render a placeholder instead of just
// vanishing when off. Always returns 'hide' while enabled or flags haven't
// loaded yet, so a placeholder never flashes over real content.
export const useFeatureFlagFallback = (key: string): FeatureFallbackBehavior => {
  const flags = useFeatureFlagStore((state) => state.flags);
  const isLoaded = useFeatureFlagStore((state) => state.isLoaded);
  if (!isLoaded || flags[key] === undefined || flags[key].enabled) {
    return 'hide';
  }
  return flags[key].fallback_behavior;
};
