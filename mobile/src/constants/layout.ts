// Height of the bottom tab bar's icon+label content, excluding top padding
// and the device-specific bottom safe-area inset (home indicator / gesture
// bar / nav buttons). Lives in its own dependency-free module — rather than
// inside TabNavigator.tsx — specifically so anything overlaying the whole
// window (AppTour's spotlight callouts, floating buttons) can reuse this
// exact calculation without importing TabNavigator itself, which would
// create a circular import (TabNavigator -> HomeScreen -> AppTour -> back
// to TabNavigator).
export const TAB_BAR_CONTENT_HEIGHT = 48;
export const TAB_BAR_TOP_PADDING = 8;
