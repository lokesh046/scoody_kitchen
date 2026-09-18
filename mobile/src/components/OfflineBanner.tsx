import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useNetworkStore } from '../store/networkStore';

export default function OfflineBanner() {
  const isConnected = useNetworkStore((state) => state.isConnected);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isConnected ? -60 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isConnected, translateY]);

  return (
    <Animated.View
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
