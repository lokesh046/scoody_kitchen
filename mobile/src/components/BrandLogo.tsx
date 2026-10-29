import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  StyleProp,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY } from '../theme/typography';

// Local asset reference for the authentic Scooby Mascot Logo
const SCOOBY_LOGO_IMG = require('../../assets/scooby-logo-256.png');
// Native pixel dimensions of the source artwork, used to keep the mark crisp and unsquished at any size.
const LOGO_ASPECT_RATIO = 256 / 322;

export type MedallionSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface BrandMedallionProps {
  size?: MedallionSize;
  style?: StyleProp<ImageStyle>;
  onPress?: () => void;
}

// Display height per size; width is derived from LOGO_ASPECT_RATIO so the mark never looks stretched.
const SIZE_CONFIG: Record<MedallionSize, number> = {
  xs: 26,
  sm: 40,
  md: 50,
  lg: 76,
  xl: 108,
};

/**
 * Scooby's Mascot Logo mark, rendered directly against the surface behind it
 * (no boxed badge/frame) so it reads as part of the header rather than a sticker on it.
 */
export const BrandMedallion = memo(function BrandMedallion({
  size = 'md',
  style,
  onPress,
}: BrandMedallionProps) {
  const height = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const width = height * LOGO_ASPECT_RATIO;

  const content = (
    <Image
      source={SCOOBY_LOGO_IMG}
      style={[{ width, height }, style]}
      contentFit="contain"
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
});

interface BrandHeaderProps {
  subtitle?: string;
  medallionSize?: MedallionSize;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hearth & One brand header: the mascot logo, the brand name in the display
 * face (as on the web header) and a live status subtitle.
 */
export const BrandHeader = memo(function BrandHeader({
  subtitle = 'CANINE NUTRITION LEDGER',
  medallionSize = 'md',
  onPress,
  style,
}: BrandHeaderProps) {
  const content = (
    <View style={[styles.brandHeaderRow, style]}>
      <BrandMedallion size={medallionSize} />
      <View style={styles.brandTextColumn}>
        <Text style={styles.wordmark} numberOfLines={1}>Hearth & One</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.livePulseDot} />
          <Text style={styles.subtitleText} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTextColumn: {
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 17,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    letterSpacing: -0.3,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    marginTop: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  subtitleText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
