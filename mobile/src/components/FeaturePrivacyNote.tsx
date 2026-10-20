import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_BODY, FONT_BODY_BOLD } from '../theme/typography';

interface FeaturePrivacyNoteProps {
  text: string;
  onPressFullPolicy: () => void;
}

// A short, feature-specific privacy blurb — grounded in the matching
// section of the Privacy Policy screen, not a paraphrase of the whole
// policy. Drop one of these into any screen that collects or processes a
// distinct category of data (a photo, a payment, a location, an AI
// conversation); the full policy itself stays the single place with the
// complete picture.
export function FeaturePrivacyNote({ text, onPressFullPolicy }: FeaturePrivacyNoteProps) {
  return (
    <View style={styles.container}>
      <ShieldCheck size={14} color={COLORS.textMuted} style={styles.icon} />
      <Text style={styles.text}>
        {text}{' '}
        <Text style={styles.link} onPress={onPressFullPolicy}>
          Full Privacy Policy →
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textMuted, lineHeight: 16 },
  link: { fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
});
