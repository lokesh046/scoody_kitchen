import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useNetworkStore } from '../store/networkStore';

// The banner's real height (status-bar inset + content) varies by device —
// a fixed -60 hide offset was smaller than that real height on devices with
// a taller inset, leaving a permanent sliver of red peeking on screen no
// matter what isConnected said. Hide it by its own measured height instead,
// with a safely-larger fallback for the one frame before that's known.
const FALLBACK_HIDDEN_OFFSET = -150;

export default function OfflineBanner() {
  const isConnected = useNetworkStore((state) => state.isConnected);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(FALLBACK_HIDDEN_OFFSET)).current;
  const [bannerHeight, setBannerHeight] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setBannerHeight(event.nativeEvent.layout.height);
  };

  useEffect(() => {
    const hiddenOffset = bannerHeight > 0 ? -bannerHeight : FALLBACK_HIDDEN_OFFSET;
    Animated.timing(translateY, {
      toValue: isConnected ? hiddenOffset : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isConnected, bannerHeight, translateY]);

  return (
    <Animated.View
      onLayout={handleLayout}
      pointerEvents="none"
      style={[
        styles.banner,
        { paddingTop: insets.top + 8, transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={isConnected ? undefined : 'You are offline. Some features may not work.'}
    >
      <WifiOff size={14} color="#FFFFFF" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: COLORS.accentRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
