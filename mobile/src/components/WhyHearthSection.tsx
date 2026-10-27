import React, { memo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_BODY, FONT_HEADING_SCRIPT, FONT_DISPLAY, LEDGER_MONO } from '../theme/typography';

// "Why Hearth & One" — the dark story block from the web home page: a label,
// a script headline, one photo and the three principles with their icons.
const PILLARS = [
  {
    image: require('../../assets/why/care.webp'),
    title: 'Care',
    text: 'We believe every companion deserves thoughtful attention to their everyday needs, health, and well-being.',
  },
  {
    image: require('../../assets/why/clarity.webp'),
    title: 'Clarity',
    text: 'We make it easier to find useful information and navigate everyday pet-care decisions with confidence.',
  },
  {
    image: require('../../assets/why/connection.webp'),
    title: 'Connection',
    text: 'We bring complementary pet-care tools together in one ecosystem, helping pet parents navigate different needs in one place.',
  },
];

export const WhyHearthSection = memo(function WhyHearthSection() {
  return (
    <LinearGradient colors={['#0E0B08', '#17120D']} style={styles.section}>
      <Text style={styles.label}>WHY HEARTH & ONE</Text>
      <Text style={styles.heading}>Bringing the pieces of pet care together.</Text>
      <Text style={styles.lead}>
        Everything works better when it's <Text style={styles.leadAccent}>connected.</Text>
      </Text>

      <Image
        source={require('../../assets/why/connected.webp')}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel="A woman at a sunlit kitchen table with her Doberman resting its chin on her knee"
      />

      <View style={styles.pillars}>
        {PILLARS.map((p, i) => (
          <View key={p.title} style={[styles.pillar, i > 0 && styles.pillarDivider]}>
            <Image source={p.image} style={styles.pillarIcon} resizeMode="contain" />
            <Text style={styles.pillarTitle}>{p.title}</Text>
            <Text style={styles.pillarText}>{p.text}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingVertical: 40, marginBottom: 28 },
  label: { fontSize: 11, letterSpacing: 1.6, fontFamily: LEDGER_MONO, color: '#D09E6B', marginBottom: 10 },
  heading: { fontSize: 31, lineHeight: 40, fontFamily: FONT_HEADING_SCRIPT, color: '#F9F6F0' },
  lead: { marginTop: 12, fontSize: 14, lineHeight: 21, fontFamily: FONT_BODY, color: 'rgba(249,246,240,0.7)' },
  leadAccent: { color: '#D09E6B', fontStyle: 'italic' },
  photo: { marginTop: 22, width: '100%', height: 210, borderRadius: 6 },
  pillars: { marginTop: 30 },
  pillar: { alignItems: 'center', paddingVertical: 26 },
  pillarDivider: { borderTopWidth: 1, borderTopColor: 'rgba(249,246,240,0.1)' },
  pillarIcon: { width: 104, height: 104 },
  pillarTitle: { marginTop: 14, fontSize: 18, fontFamily: FONT_DISPLAY, color: '#F9F6F0' },
  pillarText: {
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT_BODY,
    color: 'rgba(249,246,240,0.65)',
  },
});
