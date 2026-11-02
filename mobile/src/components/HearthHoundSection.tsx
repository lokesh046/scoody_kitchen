import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { FONT_HEADING_SCRIPT } from '../theme/typography';

// "Coming Soon" teaser for the upcoming pet-food range. Heading only, with no product
// claims or tags, until each one can be supported.
export const HearthHoundSection = memo(function HearthHoundSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Coming Soon</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 32 },
  label: { fontSize: 44, lineHeight: 52, fontFamily: FONT_HEADING_SCRIPT, color: COLORS.brandGold, marginBottom: 6 },
});
