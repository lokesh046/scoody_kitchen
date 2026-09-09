import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { X, Stethoscope, MapPin, Check, SlidersHorizontal } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { useResponsive } from '../../hooks/useResponsive';
import { styles } from './vetStyles';

type FilterSection = 'SPECIALIZATION' | 'CITY' | 'PRICE';

interface SpecializationCount {
  name: string;
  count: number;
}

interface CityCount {
  key: string;
  display: string;
  count: number;
}

interface PriceStats {
  min: number;
  max: number;
  tiers: number[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;

  section: FilterSection;
  onChangeSection: (section: FilterSection) => void;

  tempSpec: string;
  onChangeTempSpec: (spec: string) => void;
  tempCity: string;
  onChangeTempCity: (city: string) => void;
  tempPriceLimit: number | null;
  onChangeTempPriceLimit: (limit: number | null) => void;
  onResetTemp: () => void;

  dynamicSpecializations: SpecializationCount[];
  dynamicCities: CityCount[];
  dynamicPriceStats: PriceStats;
  allDoctorsCount: number;

  modalPreviewCount: number;
  onApply: () => void;
}

export function FilterModal({
  isOpen,
  onClose,
  section,
  onChangeSection,
  tempSpec,
  onChangeTempSpec,
  tempCity,
  onChangeTempCity,
  tempPriceLimit,
  onChangeTempPriceLimit,
  onResetTemp,
  dynamicSpecializations,
  dynamicCities,
  dynamicPriceStats,
  allDoctorsCount,
  modalPreviewCount,
  onApply,
}: FilterModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
        <View style={[styles.filterModalSheet, isTablet && modalSheetContainerStyle]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.profileHeaderBadgeRow}>
              <SlidersHorizontal size={18} color={COLORS.forestGreen} />
              <View>
                <Text style={styles.modalSubHeader}>REFINED DISCOVERY</Text>
                <Text style={styles.modalTitle}>Filter Specialists</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity onPress={onResetTemp} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.filterResetModalText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={COLORS.textCoffee} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Segment Header (Specialty / City / Fee Limit) */}
          <View style={styles.filterSegmentBar}>
            <TouchableOpacity
              style={[styles.filterSegmentTab, section === 'SPECIALIZATION' && styles.filterSegmentTabActive]}
              onPress={() => onChangeSection('SPECIALIZATION')}
            >
              <Stethoscope size={14} color={section === 'SPECIALIZATION' ? COLORS.forestGreen : COLORS.textMuted} />
              <Text
                style={[
                  styles.filterSegmentTabText,
                  section === 'SPECIALIZATION' && styles.filterSegmentTabTextActive,
                ]}
              >
                Specialty
              </Text>
              {tempSpec !== 'ALL' && <View style={styles.filterSegmentDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterSegmentTab, section === 'CITY' && styles.filterSegmentTabActive]}
              onPress={() => onChangeSection('CITY')}
            >
              <MapPin size={14} color={section === 'CITY' ? COLORS.forestGreen : COLORS.textMuted} />
              <Text style={[styles.filterSegmentTabText, section === 'CITY' && styles.filterSegmentTabTextActive]}>
                City
              </Text>
              {tempCity !== 'ALL' && <View style={styles.filterSegmentDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterSegmentTab, section === 'PRICE' && styles.filterSegmentTabActive]}
              onPress={() => onChangeSection('PRICE')}
            >
              <Text
                style={[styles.filterSegmentPriceSymbol, section === 'PRICE' && styles.filterSegmentTabTextActive]}
              >
                ₹
              </Text>
              <Text style={[styles.filterSegmentTabText, section === 'PRICE' && styles.filterSegmentTabTextActive]}>
                Fee Limit
              </Text>
              {tempPriceLimit !== null && <View style={styles.filterSegmentDot} />}
            </TouchableOpacity>
          </View>

          {/* Modal Body Scroll */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterModalScroll}>
            {/* SECTION 1: SPECIALIZATION */}
            <View style={styles.filterSectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.filterSectionTitle}>CLINICAL SPECIALIZATION</Text>
                <Text style={styles.filterSectionCountBadge}>{dynamicSpecializations.length} Disciplines</Text>
              </View>
              <Text style={styles.filterSectionHint}>
                Select an area of expertise to connect with targeted practitioners
              </Text>

              <View style={styles.filterPillsGrid}>
                <TouchableOpacity
                  style={[styles.filterChoicePill, tempSpec === 'ALL' && styles.filterChoicePillActive]}
                  onPress={() => onChangeTempSpec('ALL')}
                >
                  {tempSpec === 'ALL' && <Check size={13} color="#FFFFFF" />}
                  <Text style={[styles.filterChoicePillText, tempSpec === 'ALL' && styles.filterChoicePillTextActive]}>
                    All Disciplines ({allDoctorsCount})
                  </Text>
                </TouchableOpacity>

                {dynamicSpecializations.map((item) => {
                  const isChosen = tempSpec === item.name;
                  return (
                    <TouchableOpacity
                      key={item.name}
                      style={[styles.filterChoicePill, isChosen && styles.filterChoicePillActive]}
                      onPress={() => onChangeTempSpec(item.name)}
                    >
                      {isChosen && <Check size={13} color="#FFFFFF" />}
                      <Text style={[styles.filterChoicePillText, isChosen && styles.filterChoicePillTextActive]}>
                        {item.name} ({item.count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SECTION 2: CITIES (Only cities where doctors exist) */}
            <View style={styles.filterSectionDivider} />

            <View style={styles.filterSectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.filterSectionTitle}>PRACTICING CITY</Text>
                <Text style={styles.filterSectionCountBadge}>{dynamicCities.length} Cities</Text>
              </View>
              <Text style={styles.filterSectionHint}>
                Showing only cities where active veterinary specialists are practicing
              </Text>

              <View style={styles.filterPillsGrid}>
                <TouchableOpacity
                  style={[styles.filterChoicePill, tempCity === 'ALL' && styles.filterChoicePillActive]}
                  onPress={() => onChangeTempCity('ALL')}
                >
                  {tempCity === 'ALL' && <Check size={13} color="#FFFFFF" />}
                  <Text style={[styles.filterChoicePillText, tempCity === 'ALL' && styles.filterChoicePillTextActive]}>
                    All Cities
                  </Text>
                </TouchableOpacity>

                {dynamicCities.map((c) => {
                  const isChosen = tempCity === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.filterChoicePill, isChosen && styles.filterChoicePillActive]}
                      onPress={() => onChangeTempCity(c.key)}
                    >
                      <MapPin size={12} color={isChosen ? '#FFFFFF' : COLORS.brandGold} />
                      <Text style={[styles.filterChoicePillText, isChosen && styles.filterChoicePillTextActive]}>
                        {c.display} ({c.count} {c.count === 1 ? 'doctor' : 'doctors'})
                      </Text>
                      {isChosen && <Check size={13} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SECTION 3: CONSULTATION FEE / PRICE LIMIT */}
            <View style={styles.filterSectionDivider} />

            <View style={styles.filterSectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.filterSectionTitle}>MAX CONSULTATION FEE (BUDGET LIMIT)</Text>
                {tempPriceLimit !== null && (
                  <Text style={styles.filterCurrentLimitBadge}>Up to ₹{tempPriceLimit}</Text>
                )}
              </View>
              <Text style={styles.filterSectionHint}>
                {dynamicPriceStats.min > 0
                  ? `Active practitioner fees range from ₹${dynamicPriceStats.min} to ₹${dynamicPriceStats.max}`
                  : 'Set a maximum fee limit to filter your results'}
              </Text>

              <View style={styles.filterPillsGrid}>
                <TouchableOpacity
                  style={[styles.filterChoicePill, tempPriceLimit === null && styles.filterChoicePillActive]}
                  onPress={() => onChangeTempPriceLimit(null)}
                >
                  {tempPriceLimit === null && <Check size={13} color="#FFFFFF" />}
                  <Text
                    style={[styles.filterChoicePillText, tempPriceLimit === null && styles.filterChoicePillTextActive]}
                  >
                    Any Fee (No Limit)
                  </Text>
                </TouchableOpacity>

                {/* Dynamic Fee Tiers derived directly from DB */}
                {dynamicPriceStats.tiers.map((fee) => {
                  const isChosen = tempPriceLimit === fee;
                  return (
                    <TouchableOpacity
                      key={fee}
                      style={[styles.filterChoicePill, isChosen && styles.filterChoicePillActive]}
                      onPress={() => onChangeTempPriceLimit(fee)}
                    >
                      {isChosen && <Check size={13} color="#FFFFFF" />}
                      <Text style={[styles.filterChoicePillText, isChosen && styles.filterChoicePillTextActive]}>
                        ≤ ₹{fee.toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Modal Bottom Action Bar */}
          <View style={styles.filterModalFooter}>
            <View>
              <Text style={styles.feeLabel}>MATCHING SPECIALISTS</Text>
              <Text style={styles.filterFooterCountText}>
                {modalPreviewCount} {modalPreviewCount === 1 ? 'Doctor' : 'Doctors'} Available
              </Text>
            </View>

            <TouchableOpacity style={styles.filterApplyBtn} onPress={onApply}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.filterApplyBtnText}>Apply Filters ({modalPreviewCount})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
