import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet } from 'react-native';

// Illustrated icon for a home service card (the same artwork the web toolkit
// uses), with a slow float so the list feels alive without drawing the eye.
interface ToolIconProps {
  source: ImageSourcePropType;
  size?: number;
  // Offsets the loop so neighbouring icons don't bob in lockstep.
  delay?: number;
  dimmed?: boolean;
}

export const ToolIcon = memo(function ToolIcon({ source, size = 68, delay = 0, dimmed = false }: ToolIconProps) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, delay]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, opacity: dimmed ? 0.45 : 1 },
        { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }] },
      ]}
    >
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
