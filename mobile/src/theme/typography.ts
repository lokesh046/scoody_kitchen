import { Platform } from 'react-native';

// Same brand-font vocabulary PetsScreen.tsx and KitchenScreen.tsx each define
// locally: real cross-platform monospace for ledger numerals (bare
// 'monospace' silently falls back to the system font on iOS), plus the
// Outfit/Quicksand display and body faces. Centralized here so new screens
// (Orders, OrderDetail) can adopt the same system without re-declaring it.
export const LEDGER_MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';
export const FONT_DISPLAY = 'Outfit_700Bold';
export const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
export const FONT_BODY = 'Quicksand_400Regular';
export const FONT_BODY_BOLD = 'Quicksand_700Bold';
