import React, { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

// Small animated icons for the Pets screen's nutrition targets: a flickering
// flame (calories), a bobbing drumstick (protein) and a pouch that fills
// (portion). Deliberately flat two-tone vector drawings, not the illustrated
// artwork used in the tab bar and home cards, and each moves with transforms
// and opacity only so it runs on the native thread.

const SIZE = 40;

// Loops a 0..1..0 value; stays still when the device asks for reduced motion.
function useLoop(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => mounted && setReduceMotion(on)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      value.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay, reduceMotion]);

  return value;
}

/** Calories: an orange flame whose inner flame flickers against the outer one. */
export const FlameIcon = memo(function FlameIcon({ size = SIZE }: { size?: number }) {
  const sway = useLoop(900);
  const flicker = useLoop(650);
  const glow = useLoop(1400);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: 'bottom', transform: [
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
            { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) },
          ] },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path
            d="M24 3 C25 11 35 15 35 27 C35 36 30 44 24 44 C18 44 13 36 13 28 C13 22 16.5 19 18 13 C20 16 22 15 24 3 Z"
            fill="#E8892E"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: 'bottom', transform: [
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '-4deg'] }) },
            { scaleY: flicker.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.94] }) },
          ] },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path d="M24 21 C25 26 30 28 30 34 C30 39 27 43 24 43 C21 43 18 39 18 34 C18 30 21.5 28 24 21 Z" fill="#F8D27A" />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Circle cx="24" cy="32" r="15" fill="#F8D27A" />
        </Svg>
      </Animated.View>
    </View>
  );
});

/** Protein: a drumstick that bobs and tilts as if it were being lifted. */
export const DrumstickIcon = memo(function DrumstickIcon({ size = SIZE }: { size?: number }) {
  const bob = useLoop(1000, 150);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [1.5, -2] }) },
          { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M20 29 L9.5 39.5" stroke="#F4EBDD" strokeWidth={5.5} strokeLinecap="round" />
        <Circle cx="7.5" cy="37" r="3.6" fill="#F4EBDD" />
        <Circle cx="11" cy="41.5" r="3.6" fill="#F4EBDD" />
        <Path
          d="M30 5 C40.5 5 45 16 38.5 24.5 C34 30.5 25.5 32 19.5 27.5 C13.5 22.5 15 12.5 23 8 C25.5 6.4 27.7 5 30 5 Z"
          fill="#C4623A"
        />
        <Ellipse cx="29.5" cy="13.5" rx="6" ry="3.6" fill="#E08A5C" transform="rotate(-35 29.5 13.5)" />
      </Svg>
    </Animated.View>
  );
});

/** Portion pouch: a bag whose contents rise and settle, with a paw on the front. */
export const PouchIcon = memo(function PouchIcon({ size = SIZE }: { size?: number }) {
  const fill = useLoop(1500);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: 'bottom', transform: [{ scaleY: fill.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }] },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Rect x="13" y="16" width="22" height="26" rx="4" fill="#C9A15A" />
        </Svg>
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path
            d="M11 13 H37 L39 40 Q39 44.5 34.5 44.5 H13.5 Q9 44.5 9 40 Z"
            fill="none"
            stroke="#3F5E4D"
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Rect x="9.5" y="7" width="29" height="7" rx="2.5" fill="#3F5E4D" />
          <Circle cx="24" cy="30" r="3.4" fill="#3F5E4D" />
          <Circle cx="18.6" cy="25.4" r="1.7" fill="#3F5E4D" />
          <Circle cx="22" cy="22.8" r="1.7" fill="#3F5E4D" />
          <Circle cx="26" cy="22.8" r="1.7" fill="#3F5E4D" />
          <Circle cx="29.4" cy="25.4" r="1.7" fill="#3F5E4D" />
        </Svg>
      </View>
    </View>
  );
});
