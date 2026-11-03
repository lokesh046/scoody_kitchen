import type { FeatureFallbackBehavior } from '../api/features';

// Vet area: two flags decide what shows, not one (the website has the same rule in useVetAccess).
//   consultations_booking     = online video consultations (the "Consult" side)
//   consultations_gps_locator = nearby clinics (the "Near Me" side)
// Each is on, or off with a fallback: coming_soon, unavailable or hide.
//   - The VET tab shows when EITHER side is on, coming soon or unavailable (hidden only when both
//     are set to hide). With neither side on it carries a "SOON" / "!" tag.
//   - The screen opens when either side is on; with both off it shows only the status.
//   - The Near Me / Consult switch shows the other side disabled with its tag, or hides it.
export type VetSideState = 'on' | FeatureFallbackBehavior;

export interface VetAccess {
  booking: VetSideState;
  gps: VetSideState;
  navVisible: boolean;
  /** Which tag the tab carries when neither side is on; null when something is on. */
  navFallback: 'coming_soon' | 'unavailable' | null;
  blocked: boolean;
  blockedVariant: 'coming_soon' | 'unavailable';
}

export const computeVetAccess = (booking: VetSideState, gps: VetSideState): VetAccess => {
  const visible = (s: VetSideState) => s !== 'hide';
  const anyOn = booking === 'on' || gps === 'on';
  const soon = booking === 'coming_soon' || gps === 'coming_soon';
  const variant = soon ? 'coming_soon' : 'unavailable';
  return {
    booking,
    gps,
    navVisible: visible(booking) || visible(gps),
    navFallback: anyOn ? null : variant,
    blocked: !anyOn,
    blockedVariant: variant,
  };
};
