import React, { memo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

// Equal-size illustrations with a warm gold surface marking the active tab.
interface TabIconProps {
  source?: ImageSourcePropType;
  /** Draws a vector icon instead of an image; receives the focused state. */
  render?: (focused: boolean) => React.ReactNode;
  focused: boolean;
}

export const TabIcon = memo(function TabIcon({ source, render, focused }: TabIconProps) {
  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      {render ? (
        render(focused)
      ) : (
        <Image
          source={source as ImageSourcePropType}
          style={[styles.icon, { opacity: focused ? 1 : 0.72 }]}
          resizeMode="contain"
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: 44, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  wrapFocused: { backgroundColor: '#F1E4CF', borderColor: '#DFC49C' },
  icon: { width: 28, height: 28 },
});
