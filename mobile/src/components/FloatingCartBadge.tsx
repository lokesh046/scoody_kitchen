import React, { useRef, useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
  Platform,
} from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '../store/cartStore';

interface FloatingCartBadgeProps {
  onPress?: () => void;
  bottomOffset?: number;
  rightOffset?: number;
  visible?: boolean;
}

export function FloatingCartBadge({
  onPress,
  bottomOffset = Platform.OS === 'ios' ? 96 : 76,
  rightOffset = 18,
  visible = true,
}: FloatingCartBadgeProps) {
  const navigation = useNavigation<any>();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const shouldShow = totalItems > 0 && visible;
  const scaleAnim = useRef(new Animated.Value(shouldShow ? 1 : 0)).current;
  const [isRendered, setIsRendered] = useState(shouldShow);

  useEffect(() => {
    if (shouldShow) {
      setIsRendered(true);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => {
        setIsRendered(false);
      });
    }
  }, [shouldShow]);

  if (!isRendered && !shouldShow) return null;

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    try {
      navigation.navigate('MainTabs', { screen: 'Cart' });
    } catch {
      try {
        navigation.navigate('Cart');
      } catch (err) {
        console.warn('Could not navigate to Cart:', err);
      }
    }
  };

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          bottom: bottomOffset,
          right: rightOffset,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.outerCircle}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Concentric Inner White Ring */}
        <View style={styles.innerRing}>
          <ShoppingCart size={21} color="#362820" strokeWidth={2.4} />
        </View>

        {/* Count Badge Capsule at Top-Right */}
        <View style={styles.badgeCapsule}>
          <Text style={styles.badgeText}>{totalItems}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    zIndex: 9998,
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
    backgroundColor: '#CF9255', // Warm Ochre Caramel matching reference image & Scooby palette
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  badgeCapsule: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#362820', // Dark Roasted Coffee capsule
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default FloatingCartBadge;
