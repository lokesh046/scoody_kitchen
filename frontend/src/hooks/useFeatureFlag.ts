import { useQuery } from '@tanstack/react-query';
import { fetchPublicFeatures, type FeatureFallbackBehavior } from '../api/features';

export const useFeatureFlags = () => {
  return useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchPublicFeatures,
    staleTime: 0, // Always consider fresh to guarantee instant updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useFeatureFlag = (key: string, defaultEnabled = true): boolean => {
  const { data: flags, isError } = useFeatureFlags();
  if (isError || !flags || flags[key] === undefined) {
    return defaultEnabled;
  }
  return flags[key].enabled;
};

// For the handful of features that render a placeholder instead of just
// vanishing when off (see useFeatureFlag's own default of "hide" for
// everything else). Always returns 'hide' while off is actually enabled or
// flags haven't loaded yet, so a placeholder never flashes over real content.
export const useFeatureFlagFallback = (key: string): FeatureFallbackBehavior => {
  const { data: flags, isError } = useFeatureFlags();
  if (isError || !flags || flags[key] === undefined || flags[key].enabled) {
    return 'hide';
  }
  return flags[key].fallback_behavior;
};
