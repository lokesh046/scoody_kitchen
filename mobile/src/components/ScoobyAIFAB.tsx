import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
  Animated,
  DimensionValue,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PawPrint, Sparkles } from 'lucide-react-native';

interface ScoobyAIFABProps {
  initialPrompt?: string;
  topOffset?: DimensionValue;
}

export function ScoobyAIFAB({
  initialPrompt,
  topOffset = '42%',
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
    <>
      <Animated.View
        style={[
          styles.tabContainer,
          { top: topOffset, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => navigation.navigate('Chatbot', { initialQuery: initialPrompt })}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          {/* Top Sparkle Star */}
          <View style={styles.topIconWrapper}>
            <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
          </View>

          {/* Rotated Vertical Title: "CHAT ASSISTANT" */}
          <View style={styles.textWrapper}>
            <Text style={styles.verticalText} numberOfLines={1}>
              CHAT ASSISTANT
            </Text>
          </View>

          {/* Bottom Dual Blue Paws */}
          <View style={styles.pawsWrapper}>
            <PawPrint
              size={11}
              color="#3B82F6"
              fill="#3B82F6"
              style={{ transform: [{ rotate: '-18deg' }] }}
            />
            <PawPrint
              size={9}
              color="#3B82F6"
              fill="#3B82F6"
              style={{
                transform: [{ rotate: '14deg' }],
                marginLeft: 2,
                marginTop: 3,
              }}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    right: 0,
    zIndex: 9999,
    shadowColor: '#2C1D11',
    shadowOffset: { width: -3, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 7,
    elevation: 8,
  },
  tabButton: {
    backgroundColor: '#CF9255', // Warm ochre caramel matching brand & reference image
    width: 36,
    paddingTop: 14,
    paddingBottom: 12,
    paddingLeft: 4,
    paddingRight: 2,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  textWrapper: {
    height: 110,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalText: {
    width: 110,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.3,
    transform: [{ rotate: '90deg' }],
  },
  pawsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});

export default ScoobyAIFAB;
