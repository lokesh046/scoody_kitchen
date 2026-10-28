import React, { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

// The Hearth & One AI mascot: a small Doberman face that blinks, wags its ears,
// pants and carries a twinkling sparkle. Drawn as flat vector shapes in the
// brand's cream, brown and gold, in layers so each part can move on its own.
// Everything animates with transforms and opacity only (native driver), and it
// holds still when the device asks for reduced motion.

interface AIDogIconProps {
  size?: number;
  /** Round cream backing behind the face. Turn off to place it on a coloured surface. */
  withBackground?: boolean;
  animated?: boolean;
}

const VIEW = 48;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => mounted && setReduce(on))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  return reduce;
}

export const AIDogIcon = memo(function AIDogIcon({ size = 44, withBackground = true, animated = true }: AIDogIconProps) {
  const reduce = useReduceMotion();
  const run = animated && !reduce;

  const blink = useRef(new Animated.Value(1)).current; // eye scaleY
  const wag = useRef(new Animated.Value(0)).current; // ear sway 0..1
  const pant = useRef(new Animated.Value(0)).current; // tongue 0..1
  const twinkle = useRef(new Animated.Value(0)).current; // sparkle 0..1

  useEffect(() => {
    if (!run) {
      blink.setValue(1);
      wag.setValue(0.5);
      pant.setValue(0);
      twinkle.setValue(1);
      return;
    }
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.delay(2600),
          Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(wag, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(wag, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pant, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pant, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(twinkle, { toValue: 0.2, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [run, blink, wag, pant, twinkle]);

  const fill = StyleSheet.absoluteFill;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {withBackground && (
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} style={fill}>
          <Circle cx="24" cy="24" r="23" fill="#F6E7CF" />
        </Svg>
      )}

      {/* Ears — each swings a few degrees about its base. */}
      <Animated.View
        style={[
          fill,
          {
            transformOrigin: '38% 36%',
            transform: [{ rotate: wag.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '5deg'] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Path d="M10.5 5 L19.5 15.5 L9.5 22 Z" fill="#2B1D16" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          fill,
          {
            transformOrigin: '62% 36%',
            transform: [{ rotate: wag.interpolate({ inputRange: [0, 1], outputRange: ['7deg', '-5deg'] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Path d="M37.5 5 L28.5 15.5 L38.5 22 Z" fill="#2B1D16" />
        </Svg>
      </Animated.View>

      {/* Head, tan muzzle and nose */}
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} style={fill}>
        <Path d="M11.5 19.5 Q24 9 36.5 19.5 L34.5 33.5 Q24 44.5 13.5 33.5 Z" fill="#3A2A20" />
        <Ellipse cx="24" cy="33.5" rx="8.6" ry="6.4" fill="#C98B4F" />
        <Circle cx="18" cy="19.6" r="1.5" fill="#C98B4F" />
        <Circle cx="30" cy="19.6" r="1.5" fill="#C98B4F" />
        <Ellipse cx="24" cy="30.4" rx="3.2" ry="2.2" fill="#1A120D" />
        <Path d="M24 32.4 L24 35.2 M20.6 35.6 Q24 38 27.4 35.6" stroke="#1A120D" strokeWidth={1.1} strokeLinecap="round" fill="none" />
      </Svg>

      {/* Tongue — drops and lifts as the dog pants. */}
      <Animated.View
        style={[
          fill,
          {
            transformOrigin: '50% 76%',
            opacity: pant.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
            transform: [{ scaleY: pant.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Path d="M22.2 36.4 Q24 42 25.8 36.4 Z" fill="#E86B7A" />
        </Svg>
      </Animated.View>

      {/* Eyes — blink by squashing vertically. */}
      <Animated.View style={[fill, { transformOrigin: '50% 50%', transform: [{ scaleY: blink }] }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Ellipse cx="18" cy="25" rx="2.6" ry="2.9" fill="#F9F6F0" />
          <Ellipse cx="30" cy="25" rx="2.6" ry="2.9" fill="#F9F6F0" />
          <Circle cx="18.4" cy="25.4" r="1.6" fill="#1A120D" />
          <Circle cx="29.6" cy="25.4" r="1.6" fill="#1A120D" />
          <Circle cx="18.9" cy="24.7" r="0.55" fill="#FFFFFF" />
          <Circle cx="30.1" cy="24.7" r="0.55" fill="#FFFFFF" />
        </Svg>
      </Animated.View>

      {/* AI sparkle, top right */}
      <Animated.View
        style={[
          fill,
          {
            opacity: twinkle,
            transformOrigin: '84% 14%',
            transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Path d="M40.5 4 L42 9 L47 10.5 L42 12 L40.5 17 L39 12 L34 10.5 L39 9 Z" fill="#E5A93C" />
        </Svg>
      </Animated.View>
    </View>
  );
});

export default AIDogIcon;
