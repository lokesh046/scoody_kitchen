import React, { memo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_BODY_BOLD } from '../theme/typography';
import { BrandMedallion, MedallionSize } from './BrandLogo';

/**
 * The shared header identity for every screen except Home (which has its
 * own BrandHeader — the logo already carries the wordmark, so it doesn't
 * need a separate page title). Every other screen had independently
 * hand-built its own header before this: font sizes ranging 15-19px, one
 * screen in pure black instead of the app's textCoffee ink, one missing
 * its font-family entirely and silently falling back to the system font.
 * This is the single place that scale now lives — change it here, not per
 * screen.
 */

interface ScreenHeaderProps {
  /** The page's name — "Orders Ledger", "Companion Registry", etc. */
  title: string;
  /** Small uppercase label above the title, e.g. Profile's "ACCOUNT LEDGER". */
  eyebrow?: string;
  /** Shows a live-status pulse dot next to the eyebrow (matches BrandHeader's own convention). */
  eyebrowLive?: boolean;
  /** Extra content in the same row as the eyebrow, after the label — e.g. Cart's "Syncing..." pill. */
  eyebrowExtra?: ReactNode;
  /** Extra content directly under the title — Pets' roster-avatar row, etc. */
  belowTitle?: ReactNode;
  /** Defaults to the brand medallion; pass a different icon (e.g. Support's headset) to override. */
  leadingElement?: ReactNode;
  medallionSize?: MedallionSize;
  /** The screen's own unique right-side content — tally stamp, live chip, avatar, logout button. */
  rightContent?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  eyebrow,
  eyebrowLive,
  eyebrowExtra,
  belowTitle,
  leadingElement,
  medallionSize = 'sm',
  rightContent,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.leftGroup}>
        {leadingElement ?? <BrandMedallion size={medallionSize} />}
        <View style={styles.textCol}>
          {eyebrow && (
            <View style={styles.eyebrowRow}>
              {eyebrowLive && <View style={styles.livePulseDot} />}
              <Text style={styles.eyebrowText} numberOfLines={1}>
                {eyebrow}
              </Text>
              {eyebrowExtra}
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {belowTitle}
        </View>
      </View>
      {rightContent && <View style={styles.rightGroup}>{rightContent}</View>}
    </View>
  );
});

/**
 * The "pushed screen" counterpart — SupportTicket, MealPlanner, OrderDetail
 * all already independently converged on the same back-arrow + centered
 * title + spacer shape; this just gives that shape one definition instead
 * of three copies with slightly different sizes.
 */
interface StackHeaderProps {
  title: string;
  /** Small centered uppercase label above the title, e.g. OrderDetail's "OFFICIAL ORDER LEDGER". */
  eyebrow?: string;
  onBack: () => void;
  /** Defaults to a spacer matching the back button's width, so the title stays visually centered. */
  rightContent?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const StackHeader = memo(function StackHeader({ title, eyebrow, onBack, rightContent, style }: StackHeaderProps) {
  return (
    <View style={[styles.stackHeader, style]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={20} color={COLORS.textCoffee} />
      </TouchableOpacity>
      <View style={styles.stackTitleCol}>
        {eyebrow && (
          <Text style={styles.stackEyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        )}
        <Text style={styles.stackTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {rightContent ?? <View style={styles.backBtnSpacer} />}
    </View>
  );
});

// Single type scale for every non-Home header. 18px sits at the middle of
// the 15-19px spread the eleven screens had drifted to independently;
// textCoffee replaces the one screen that had drifted to pure #000000.
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  textCol: {
    flexShrink: 1,
    gap: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  eyebrowText: {
    fontSize: 9.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    letterSpacing: -0.2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  stackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: {
    width: 36,
  },
  stackTitleCol: {
    flex: 1,
    alignItems: 'center',
  },
  stackEyebrow: {
    fontSize: 9.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stackTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    letterSpacing: -0.2,
  },
});
