// Font-family tokens for the "Sourced Kitchen Journal" type system (see
// DESIGN.md -> Typography). OrdersScreen.tsx and OrderDetailScreen.tsx
// already imported these exact names (FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD,
// FONT_BODY_BOLD, LEDGER_MONO) from this path before this file existed —
// this is that module, matching their established naming rather than
// introducing a second, incompatible token scheme.
//
// Each constant is a specific static weight file, not a family name plus a
// separate `fontWeight` — mixing a named Google Fonts static weight with a
// conflicting `fontWeight` style causes Android to either ignore the
// requested weight or synthetically re-bold it. Apply only
// `fontFamily: <TOKEN>` on a style and drop any `fontWeight` on that style.

import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

// DESIGN.md "Display/Headline: Bold, weight 700" — section titles, banner
// titles, the brand wordmark.
export const FONT_DISPLAY = 'Outfit_700Bold';
// A lighter display weight for headline-tier text that shouldn't compete
// with a page's primary heading (e.g. an empty-state title).
export const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
// DESIGN.md "Body: Regular, weight 400" — descriptions, notes, reviews,
// ordinary UI copy.
export const FONT_BODY = 'Quicksand_400Regular';
// A heavier body weight for short emphatic UI text (button labels, links,
// card titles) that isn't a full headline but needs more presence than body.
export const FONT_BODY_BOLD = 'Quicksand_700Bold';
// DESIGN.md "Label: Medium Mono, weight 500" — the Ledger Monospace Rule:
// raw percentages, quantities, prices, datestamps, SKU/batch codes, and
// small tech/status tags.
export const LEDGER_MONO = 'IBMPlexMono_500Medium';

// Passed to Expo's `useFonts()` once, centrally, in App.tsx — not re-loaded
// per screen — so every screen has these ready before its first render.
export const FONT_ASSETS = {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Quicksand_400Regular,
  Quicksand_700Bold,
  IBMPlexMono_500Medium,
};
