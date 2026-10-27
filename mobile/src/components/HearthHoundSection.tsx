import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { FONT_BODY, FONT_HEADING_SCRIPT, LEDGER_MONO } from '../theme/typography';

// "Hearth & Hound · Coming Soon" — the web home page's teaser for the upcoming
// pet-food range, as copy plus the four promise chips.
const PROMISES = ['Human-Grade', 'Pesticide-Free', 'Sustainably Sourced', 'Vet-Reviewed'];

export const HearthHoundSection = memo(function HearthHoundSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>HEARTH & HOUND · COMING SOON</Text>
      <Text style={styles.heading}>
        Thoughtfully made for the ones who are <Text style={styles.headingAccent}>one of us.</Text>
      </Text>
      <Text style={styles.body}>
        We're preparing a natural, thoughtfully crafted range of pet food with a focus on quality ingredients,
        sustainable practices, and pesticide-free sourcing.
      </Text>
      <View style={styles.chips}>
        {PROMISES.map((label) => (
          <View key={label} style={styles.chip}>
            <Text style={styles.chipText}>{label.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 32 },
  label: { fontSize: 11, letterSpacing: 1.4, fontFamily: LEDGER_MONO, color: COLORS.brandGold, marginBottom: 10 },
  heading: { fontSize: 29, lineHeight: 38, fontFamily: FONT_HEADING_SCRIPT, color: COLORS.textCoffee },
  headingAccent: { color: COLORS.brandGold },
  body: { marginTop: 12, fontSize: 14, lineHeight: 21, fontFamily: FONT_BODY, color: COLORS.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(151,100,48,0.4)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 10, letterSpacing: 0.9, fontFamily: LEDGER_MONO, color: COLORS.brandGold },
});
