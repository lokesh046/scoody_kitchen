import { useFeatureFlagStore } from '../store/featureFlagStore';
import type { FeatureFallbackBehavior } from '../api/features';

// Build-time only, set via EXPO_PUBLIC_FORCE_FLAGS_ENABLED=true in
// scripts/build-beta.sh -- never read from a runtime value (a user action,
// a header, anything fetched over the network), so there is no way for
// this to end up enabled in a production build by anything a user does.
// scripts/build-production.sh never sets it, so it is always false there
// regardless of this file's content. Mirrors the web beta build's
// VITE_FORCE_FLAGS_ENABLED (frontend/src/hooks/useFeatureFlag.ts).
const FORCE_FLAGS_ENABLED = process.env.EXPO_PUBLIC_FORCE_FLAGS_ENABLED === 'true';

export const useFeatureFlag = (key: string, defaultEnabled = true): boolean => {
  const flags = useFeatureFlagStore((state) => state.flags);
  const isLoaded = useFeatureFlagStore((state) => state.isLoaded);
  if (FORCE_FLAGS_ENABLED) return true;
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
  if (FORCE_FLAGS_ENABLED) return 'hide';
  if (!isLoaded || flags[key] === undefined || flags[key].enabled) {
    return 'hide';
  }
  return flags[key].fallback_behavior;
};
