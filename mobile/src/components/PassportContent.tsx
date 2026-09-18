import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ShieldCheck, Globe2, Award, Dna, Flame, Sparkles, Heart, Eye, Waves } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BreedHeritage } from '../api/vision';

export type PassportFormat = 'card' | 'story';

interface PassportContentProps {
  format: PassportFormat;
  petName: string;
  breedName: string;
  species: string;
  photoUri: string | null;
  heritage: BreedHeritage;
  passportCode: string;
}

const SKILLS = [
  { key: 'scent_radar' as const, label: 'Scent & Sniff Radar', icon: Flame, color: '#C0392B' },
  { key: 'stamina_speed' as const, label: 'Stamina & Athletic Speed', icon: Sparkles, color: COLORS.brandGold },
  { key: 'cuddle_index' as const, label: 'Lapdog Cuddle Index', icon: Heart, color: '#E11D48' },
  { key: 'watchdog_instinct' as const, label: 'Watchdog Guarding', icon: Eye, color: COLORS.forestGreen },
  { key: 'swimming_affinity' as const, label: 'Water & Swimming Affinity', icon: Waves, color: '#2563EB' },
];

// Native re-implementation of web's PetHeritagePassport visual language
// (frontend/src/components/PetHeritagePassport.tsx) — dark ink frame,
// brand-gold "guilloche" border, cream document card, certified photo
// stamp, and five superpower bars — rendered as a real View tree so
// react-native-view-shot can rasterize it, rather than a second, divergent
// design invented for mobile.
const PassportContent = forwardRef<View, PassportContentProps>(
  ({ format, petName, breedName, species, photoUri, heritage, passportCode }, ref) => {
    const isStory = format === 'story';

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.outer, isStory ? styles.outerStory : styles.outerCard]}
      >
        <View style={styles.inner}>
          {/* Header band */}
          <View style={styles.headerBand}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <ShieldCheck size={isStory ? 22 : 18} color={COLORS.brandGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerEyebrow, isStory && styles.textLg]}>
                  Official Canine & Feline Registry
                </Text>
                <Text style={[styles.headerTitle, isStory && styles.headerTitleStory]}>
                  Companion Heritage Passport
                </Text>
              </View>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Doc No.</Text>
              <Text style={styles.codeValue}>{passportCode}</Text>
            </View>
          </View>

          {/* Photo + identity — Story format restacks this into a single
              vertical column instead of the Card format's side-by-side
              layout, so the export reads as a tall 9:16-shaped frame. */}
          <View style={[styles.dossierRow, isStory && styles.dossierColumn]}>
            <View style={[styles.photoCol, isStory && styles.photoColStory]}>
              <View style={[styles.photoFrame, isStory && styles.photoFrameStory]}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImg} contentFit="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <Award size={32} color={COLORS.brandGold} />
                  </View>
                )}
                <View style={styles.stampBadge}>
                  <Text style={styles.stampText}>CERTIFIED {heritage.origin_flag}</Text>
                </View>
              </View>
              <Text style={[styles.petName, isStory && styles.textLg]}>{petName}</Text>
              <Text style={styles.breedLabel}>{breedName}</Text>
            </View>

            <View style={[styles.infoCol, isStory && styles.infoColStory]}>
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <Globe2 size={12} color={COLORS.brandGold} />
                  <Text style={styles.infoCardLabel}>Geographic Homeland</Text>
                </View>
                <Text style={styles.infoCardValue}>
                  {heritage.origin_flag} {heritage.origin_country}
                </Text>
                <Text style={styles.infoCardSub} numberOfLines={1}>
                  {heritage.historical_homeland}
                </Text>
              </View>
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <Award size={12} color={COLORS.forestGreen} />
                  <Text style={styles.infoCardLabel}>Era of Discovery</Text>
                </View>
                <Text style={styles.infoCardValue}>{heritage.origin_era}</Text>
                <Text style={styles.infoCardSub}>Preserved Working Lineage</Text>
              </View>

              <View style={styles.storyCard}>
                <View style={styles.infoCardHeader}>
                  <Dna size={12} color={COLORS.brandGold} />
                  <Text style={styles.infoCardLabel}>Evolutionary Trait & Mutation Story</Text>
                </View>
                <Text style={[styles.storyText, isStory && styles.textLg]} numberOfLines={isStory ? 5 : 4}>
                  {heritage.mutation_story}
                </Text>
              </View>
            </View>
          </View>

          {/* Superpowers */}
          <View style={styles.skillsSection}>
            <Text style={[styles.skillsHeading, isStory && styles.textLg]}>
              Biological Superpowers & Skill Ratings
            </Text>
            {SKILLS.map((s) => {
              const Icon = s.icon;
              const val = heritage.superpowers[s.key];
              return (
                <View key={s.key} style={styles.skillRow}>
                  <View style={styles.skillLabelRow}>
                    <Icon size={12} color={s.color} />
                    <Text style={[styles.skillLabel, isStory && styles.textLg]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text style={styles.skillScore}>{val}/10</Text>
                  </View>
                  <View style={styles.skillBarBg}>
                    <View style={[styles.skillBarFill, { width: `${(val / 10) * 100}%`, backgroundColor: s.color }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {!isStory && heritage.famous_icons && heritage.famous_icons.length > 0 && (
            <View style={styles.iconsRow}>
              <Text style={styles.iconsLabel}>Notable Icons:</Text>
              {heritage.famous_icons.slice(0, 3).map((icon, idx) => (
                <View key={idx} style={styles.iconChip}>
                  <Text style={styles.iconChipText}>✨ {icon}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }
);

PassportContent.displayName = 'PassportContent';
export default PassportContent;

const styles = StyleSheet.create({
  outer: {
    backgroundColor: COLORS.textCoffee,
    padding: 10,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: COLORS.brandGold,
  },
  outerCard: { width: 420 },
  outerStory: { width: 375 },
  inner: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },

  headerBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.textCoffee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textCoffee,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerTitleStory: { fontSize: 18 },
  codeBox: { alignItems: 'flex-end' },
  codeLabel: { fontSize: 7.5, color: COLORS.textMuted, textTransform: 'uppercase' },
  codeValue: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textCoffee,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
  },

  dossierRow: { flexDirection: 'row', gap: 12 },
  dossierColumn: { flexDirection: 'column', alignItems: 'center' },
  photoCol: { alignItems: 'center', width: 120 },
  photoColStory: { width: '100%', marginBottom: 4 },
  photoFrame: {
    width: 110,
    height: 130,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.textCoffee,
    overflow: 'hidden',
    position: 'relative',
  },
  photoFrameStory: { width: 160, height: 190 },
  photoImg: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardAlt },
  stampBadge: {
    position: 'absolute',
    bottom: 4,
    right: -6,
    transform: [{ rotate: '-10deg' }],
    backgroundColor: COLORS.brandGold,
    borderWidth: 1.5,
    borderColor: COLORS.textCoffee,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stampText: { fontSize: 7, fontWeight: '900', color: COLORS.textCoffee, textTransform: 'uppercase' },
  petName: { fontSize: 12, fontWeight: '800', color: COLORS.textCoffee, marginTop: 8, textTransform: 'uppercase', textAlign: 'center' },
  breedLabel: { fontSize: 10, fontWeight: '800', color: COLORS.brandGold, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },

  infoCol: { flex: 1, gap: 8 },
  infoColStory: { width: '100%', flex: undefined },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    padding: 8,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  infoCardLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase' },
  infoCardValue: { fontSize: 11, fontWeight: '800', color: COLORS.textCoffee, textTransform: 'uppercase' },
  infoCardSub: { fontSize: 8.5, color: COLORS.textMuted, marginTop: 1 },

  storyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    padding: 8,
    flex: 1,
  },
  storyText: { fontSize: 9.5, color: COLORS.textCoffee, lineHeight: 13, marginTop: 2 },

  skillsSection: {
    backgroundColor: COLORS.textCoffee,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  skillsHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  skillRow: { gap: 3 },
  skillLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  skillLabel: { flex: 1, fontSize: 9.5, fontWeight: '700', color: '#FFFFFF' },
  skillScore: { fontSize: 9.5, fontWeight: '800', color: COLORS.brandGold },
  skillBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  skillBarFill: { height: '100%', borderRadius: 3 },

  iconsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  iconsLabel: { fontSize: 8.5, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase' },
  iconChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  iconChipText: { fontSize: 8.5, color: COLORS.textCoffee },

  textLg: { fontSize: 12 },
});
