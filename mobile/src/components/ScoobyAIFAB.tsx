import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PawPrint, Sparkles } from 'lucide-react-native';

interface ScoobyAIFABProps {
  initialPrompt?: string;
  bottomOffset?: number;
  leftOffset?: number;
  // Set when ai_chatbot is off but its fallback isn't "hide" — renders a
  // muted, non-navigating version instead of the real FAB.
  disabledFallback?: 'coming_soon' | 'unavailable';
}

// Was a ~175px-tall vertical strip anchored at a fixed percentage of the
// *viewport* height (top: '42%'), rendered once globally above every tab
// screen's own scroll content. Because the screen scrolls behind it while
// it stays fixed on-screen, it inevitably overlapped whatever content
// happened to land at that height — a product card's Add button, review
// text, a section badge — depending on scroll position, not by design.
//
// Collapsed to a compact circular corner FAB, anchored to the bottom-left
// (FloatingCartBadge already owns bottom-right) just above the tab bar —
// the one screen-relative zone that's never occupied by scrollable primary
// content on any of the 6 tab screens, mirroring FloatingCartBadge's own
// proven bottom-anchored pattern instead of a content-relative percentage.
export function ScoobyAIFAB({
  initialPrompt,
  bottomOffset = 96,
  leftOffset = 18,
  disabledFallback,
}: ScoobyAIFABProps) {
  const navigation = useNavigation<any>();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        { bottom: bottomOffset, left: leftOffset, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.outerCircle, disabledFallback && styles.outerCircleDisabled]}
        onPress={() =>
          disabledFallback
            ? Alert.alert(
                disabledFallback === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable',
                disabledFallback === 'coming_soon'
                  ? "The AI Nutrition Coach isn't available yet — check back soon!"
                  : 'The AI Nutrition Coach is temporarily unavailable. Please check back later.'
              )
            : navigation.navigate('Chatbot', { initialQuery: initialPrompt })
        }
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          disabledFallback
            ? `Scooby AI chat assistant — ${disabledFallback === 'coming_soon' ? 'coming soon' : 'temporarily unavailable'}`
            : 'Open Scooby AI chat assistant'
        }
      >
        <View style={[styles.innerRing, disabledFallback && styles.innerRingDisabled]}>
          <Sparkles size={21} color="#FFFFFF" strokeWidth={2.4} />
        </View>

        {/* Paw accent capsule, mirroring FloatingCartBadge's corner-badge
            convention instead of the old two-paw decorative flourish. */}
        {!disabledFallback && (
          <View style={styles.pawCapsule}>
            <PawPrint size={11} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    zIndex: 9997,
    shadowColor: '#2C1D11',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  outerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#CF9255', // Warm ochre caramel — same brand accent as FloatingCartBadge
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerCircleDisabled: {
    backgroundColor: '#A3A3A3',
    opacity: 0.7,
  },
  innerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  innerRingDisabled: {
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pawCapsule: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#362820',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ScoobyAIFAB;
