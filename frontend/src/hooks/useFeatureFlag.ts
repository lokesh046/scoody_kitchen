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
    // This hook runs in the Header plus several components per page, so
    // staleTime: 0 meant a /features/public request on every navigation for
    // every visitor. A short window still picks up an admin's flag toggle on
    // the next focus or navigation, without re-asking on every mount.
    staleTime: 60_000,
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

// ---------------------------------------------------------------------------------------------
// Vet area: two flags decide what shows, not one.
//   consultations_booking     = online video consultations (the "Consult" side of the page)
//   consultations_gps_locator = nearby clinics (the "Near Me" side of the page)
// Each is on, or off with a fallback: coming_soon, unavailable or hide.
//   - The header link / tab shows when EITHER side is on, coming soon or unavailable (and only
//     disappears when both are set to hide). When neither side is on it carries a
//     "Coming soon" / "Unavailable" tag.
//   - The page opens when EITHER side is on. When both are off it shows only the status.
//   - The Near Me / Consult switch shows the other side disabled with its tag, or hides it.
// While flags are loading, or on an error, everything counts as on, so nothing flashes.
// ---------------------------------------------------------------------------------------------
export type VetSideState = 'on' | FeatureFallbackBehavior;

export interface VetAccess {
  booking: VetSideState;
  gps: VetSideState;
  navVisible: boolean;
  navLabel: 'Coming soon' | 'Unavailable' | null;
  blocked: boolean;
  blockedVariant: 'coming_soon' | 'unavailable';
}

const sideState = (
  flags: Record<string, { enabled: boolean; fallback_behavior: FeatureFallbackBehavior }> | undefined,
  key: string,
): VetSideState => {
  if (FORCE_FLAGS_ENABLED || !flags || flags[key] === undefined || flags[key].enabled) return 'on';
  return flags[key].fallback_behavior;
};

export const computeVetAccess = (booking: VetSideState, gps: VetSideState): VetAccess => {
  const visible = (s: VetSideState) => s !== 'hide';
  const anyOn = booking === 'on' || gps === 'on';
  const anyVisible = visible(booking) || visible(gps);
  const soon = booking === 'coming_soon' || gps === 'coming_soon';
  return {
    booking,
    gps,
    navVisible: anyVisible,
    navLabel: anyOn ? null : soon ? 'Coming soon' : 'Unavailable',
    blocked: !anyOn,
    blockedVariant: soon ? 'coming_soon' : 'unavailable',
  };
};

export const useVetAccess = (): VetAccess => {
  const { data: flags, isError } = useFeatureFlags();
  const f = isError ? undefined : (flags as any);
  return computeVetAccess(sideState(f, 'consultations_booking'), sideState(f, 'consultations_gps_locator'));
};

// For pages that only SHOW a link or card to the vet area (home, landing pages, footer): it counts as
// available when either side is on, and carries the "off" kind otherwise. Booking-specific places
// (doctor dashboard, "book a consultation" buttons) keep reading consultations_booking directly.
export const useVetEntryEnabled = (): boolean => !useVetAccess().blocked;
export const useVetEntryFallback = (): FeatureFallbackBehavior => {
  const v = useVetAccess();
  return v.blocked && v.navVisible ? v.blockedVariant : 'hide';
};

// One flag that controls a whole area (the Shop): the same idea as the vet area, with a single flag.
//   - The header link shows when the flag is on, coming soon or unavailable (hidden only for "hide"),
//     and carries a "Coming soon" / "Unavailable" tag when it is off.
//   - The page behind it shows only the status when the flag is off.
export interface FlagEntry {
  state: VetSideState;
  visible: boolean;
  label: 'Coming soon' | 'Unavailable' | null;
  blocked: boolean;
  variant: 'coming_soon' | 'unavailable';
}

export const useFlagEntry = (key: string): FlagEntry => {
  const { data: flags, isError } = useFeatureFlags();
  const state = sideState(isError ? undefined : (flags as any), key);
  return {
    state,
    visible: state !== 'hide',
    label: state === 'on' || state === 'hide' ? null : state === 'coming_soon' ? 'Coming soon' : 'Unavailable',
    blocked: state !== 'on',
    variant: state === 'coming_soon' ? 'coming_soon' : 'unavailable',
  };
};
