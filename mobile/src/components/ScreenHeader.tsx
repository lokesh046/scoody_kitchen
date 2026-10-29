import React, { memo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_HEADING_SCRIPT, LEDGER_MONO } from '../theme/typography';

import { BrandMedallion } from './BrandLogo';

export const HEADER_GOLD = '#D7AF76';
export const HEADER_CREAM = '#FAF4E8';
export const headerActionStyle = { backgroundColor: '#251E16', borderWidth: 1, borderColor: '#51402B', borderRadius: 14 };

interface ScreenHeaderProps {
  title: string;
  /** Functional status, such as cart syncing, kept on the title row. */
  statusContent?: ReactNode;
  leadingElement?: ReactNode;
  rightContent?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Compact feature toolbar. Home keeps its separate brand header. */
export const ScreenHeader = memo(function ScreenHeader({ title, statusContent, leadingElement, rightContent, style }: ScreenHeaderProps) {
  return (
    <LinearGradient colors={['#0E0B08', '#17120D', '#0E0B08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, style]}>
      {leadingElement ?? <BrandMedallion size="sm" />}
      <View style={styles.textColumn}>
        <Text style={styles.eyebrow} numberOfLines={1}>HEARTH & ONE</Text>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.5}>{title}</Text>
      </View>
      {statusContent}
      {rightContent && <View style={styles.actions}>{rightContent}</View>}
    </LinearGradient>
  );
});

interface StackHeaderProps {
  title: string;
  onBack: () => void;
  rightContent?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const StackHeader = memo(function StackHeader({ title, onBack, rightContent, style }: StackHeaderProps) {
  return (
    <LinearGradient colors={['#0E0B08', '#17120D', '#0E0B08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, styles.stackHeader, style]}>
      <TouchableOpacity onPress={onBack} style={[styles.actionTarget, headerActionStyle]} accessibilityRole="button" accessibilityLabel="Go back">
        <ArrowLeft size={22} color={HEADER_CREAM} />
      </TouchableOpacity>
      <View style={styles.textColumn}>
        <Text style={[styles.eyebrow, styles.stackTitle]} numberOfLines={1}>HEARTH & ONE</Text>
        <Text accessibilityRole="header" style={[styles.title, styles.stackTitle]} numberOfLines={1} maxFontSizeMultiplier={1.5}>{title}</Text>
      </View>
      <View style={styles.actionTarget}>{rightContent}</View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#0E0B08',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#665034',
  },
  title: {
    fontSize: 23,
    fontFamily: FONT_HEADING_SCRIPT,
    color: HEADER_CREAM,
    letterSpacing: -0.2,
  },
  textColumn: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 9, fontFamily: LEDGER_MONO, letterSpacing: 1.2, color: HEADER_GOLD },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  stackHeader: { paddingHorizontal: 8, gap: 4 },
  stackTitle: { textAlign: 'center' },
  actionTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
