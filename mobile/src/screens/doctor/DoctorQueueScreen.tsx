import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, ChevronRight, Stethoscope } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../../theme/typography';
import { getDoctorConsultations, ConsultationResponse } from '../../api/doctor';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FFF8E8', text: COLORS.brandGold },
  APPROVED: { bg: '#EDF5F0', text: COLORS.forestGreen },
  CONFIRMED: { bg: '#EDF5F0', text: COLORS.forestGreen },
  IN_PROGRESS: { bg: '#E8F0FE', text: '#1D5FBF' },
  COMPLETED: { bg: '#F1F1F1', text: COLORS.textMuted },
  CANCELLED: { bg: '#FDF2F2', text: '#C0392B' },
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function DoctorQueueScreen({ navigation }: any) {
  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchedRef = useRef(0);
  const load = useCallback(async (isRefresh = false) => {
    // Skip refetching if we already have a recent copy — avoids a redundant
    // network round-trip every time this tab regains focus.
    if (!isRefresh && Date.now() - lastFetchedRef.current < 12000) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const items = await getDoctorConsultations();
      // Soonest-scheduled first, so the day's next appointment is always at the top.
      items.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      setConsultations(items);
      setError(null);
      lastFetchedRef.current = Date.now();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load your consultation queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = useCallback(
    ({ item }: { item: ConsultationResponse }) => {
      const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING;
      const customerName =
        `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`.trim() ||
        item.customer?.email ||
        'Pet Parent';
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DoctorConsultationDetail', { consultationId: item.id })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Consultation with ${customerName} for ${item.pet?.name || 'a pet'}, status ${item.status}`}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{item.status}</Text>
            </View>
            <View style={styles.whenRow}>
              <Calendar size={12} color={COLORS.textMuted} />
              <Text style={styles.whenText}>{formatWhen(item.scheduled_at)}</Text>
            </View>
          </View>
          <Text style={styles.petName}>{item.pet?.name || 'Pet'}</Text>
          <Text style={styles.petMeta}>
            {item.pet?.species || ''} {item.pet?.breed ? `(${item.pet.breed})` : ''}
          </Text>
          <View style={styles.cardBottomRow}>
            <Text style={styles.customerName}>{customerName}</Text>
            <ChevronRight size={16} color={COLORS.textLight} />
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Stethoscope size={18} color={COLORS.brandGold} />
        </View>
        <Text style={styles.headerTitle}>Consultation Queue</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => load()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading queue"
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={consultations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forestGreen} />}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>No consultations booked yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textMuted },
  retryBtn: {
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  listContent: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 9.5, fontFamily: FONT_BODY_BOLD, letterSpacing: 0.4 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whenText: { fontSize: 10.5, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  petName: { fontSize: 15, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee, marginTop: 4 },
  petMeta: { fontSize: 11.5, fontFamily: FONT_BODY, color: COLORS.textMuted },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
  },
  customerName: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
});
