import { useQuery } from '@tanstack/react-query';
import { fetchPublicFeatures, type FeatureFallbackBehavior } from '../api/features';

// Build-time only, set via VITE_FORCE_FLAGS_ENABLED=true for the beta
// deployment's build command -- never read from a runtime value (a user
// query param, a header, anything fetched over the network), so there is
// no way for this to end up enabled in a production build by anything a
// visitor does. Production's build command never sets it, so it is always
// false there regardless of this file's content.
const FORCE_FLAGS_ENABLED = import.meta.env.VITE_FORCE_FLAGS_ENABLED === 'true';

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
  if (FORCE_FLAGS_ENABLED) return true;
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
  if (FORCE_FLAGS_ENABLED) return 'hide';
  if (isError || !flags || flags[key] === undefined || flags[key].enabled) {
    return 'hide';
  }
  return flags[key].fallback_behavior;
};

export type RouteGateResult =
  | { blocked: false }
  | { blocked: true; fallback: FeatureFallbackBehavior };

// For routes that are entirely one feature (e.g. /onboarding is entirely
// the meal planner, /assistant is entirely the chatbot) rather than a page
// with a few optional sections. Unlike useFeatureFlagFallback, this never
// defaults to a "blocked" state while loading or on error -- treating the
// whole route as blocked during that brief window (rather than just one
// placeholder card) would flash every visitor into a wrong/unavailable
// page on every load, including when the feature is actually enabled.
export const useRouteFeatureGate = (key: string): RouteGateResult => {
  const { data: flags, isLoading, isError } = useFeatureFlags();
  if (FORCE_FLAGS_ENABLED) return { blocked: false };
  if (isLoading || isError || !flags || flags[key] === undefined || flags[key].enabled) {
    return { blocked: false };
  }
  return { blocked: true, fallback: flags[key].fallback_behavior };
};
