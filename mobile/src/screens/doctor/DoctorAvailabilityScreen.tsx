import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Trash2, CalendarClock } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from '../../theme/typography';
import {
  getDoctorAvailabilities,
  createDoctorAvailability,
  deleteDoctorAvailability,
  updateDoctorAvailabilitySlot,
  DoctorAvailabilityResponse,
  DayOfWeek,
} from '../../api/doctor';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function DoctorAvailabilityScreen() {
  const [slots, setSlots] = useState<DoctorAvailabilityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState<DayOfWeek | null>(null);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [saving, setSaving] = useState(false);

  const lastFetchedRef = useRef(0);
  const load = useCallback(async (force = false) => {
    // Skip refetching if we already have a recent copy — avoids a redundant
    // network round-trip every time this tab regains focus.
    if (!force && Date.now() - lastFetchedRef.current < 12000) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getDoctorAvailabilities();
      setSlots(data);
      lastFetchedRef.current = Date.now();
    } catch {
      Alert.alert('Error', 'Could not load your availability.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAddSlot = async (day: DayOfWeek) => {
    if (!TIME_PATTERN.test(newStart) || !TIME_PATTERN.test(newEnd)) {
      Alert.alert('Invalid Time', 'Enter times as 24-hour HH:MM, e.g. 09:00 and 17:00.');
      return;
    }
    setSaving(true);
    try {
      const created = await createDoctorAvailability({ day_of_week: day, start_time: newStart, end_time: newEnd, is_available: true });
      setSlots((prev) => [...prev, created]);
      setAddingDay(null);
      setNewStart('09:00');
      setNewEnd('17:00');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = (id: number) => {
    Alert.alert('Remove Slot', 'Remove this availability window?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoctorAvailability(id);
            setSlots((prev) => prev.filter((s) => s.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to remove slot.');
          }
        },
      },
    ]);
  };

  const handleToggleSlot = async (slot: DoctorAvailabilityResponse) => {
    const next = !slot.is_available;
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, is_available: next } : s)));
    try {
      await updateDoctorAvailabilitySlot(slot.id, { is_available: next });
    } catch {
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, is_available: !next } : s)));
      Alert.alert('Error', 'Failed to update slot.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <CalendarClock size={18} color={COLORS.brandGold} />
        </View>
        <Text style={styles.headerTitle}>Weekly Availability</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.day_of_week === day.key);
            return (
              <View key={day.key} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <Text style={styles.dayTitle}>{day.label}</Text>
                  <TouchableOpacity
                    onPress={() => setAddingDay(addingDay === day.key ? null : day.key)}
                    style={styles.addSlotBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Add availability slot on ${day.label}`}
                  >
                    <Plus size={14} color={COLORS.forestGreen} />
                  </TouchableOpacity>
                </View>

                {daySlots.length === 0 && addingDay !== day.key && (
                  <Text style={styles.noSlotsText}>No slots set</Text>
                )}

                {daySlots.map((slot) => (
                  <View key={slot.id} style={styles.slotRow}>
                    <Text style={styles.slotTime}>{slot.start_time} – {slot.end_time}</Text>
                    <View style={styles.slotActions}>
                      <Switch
                        value={slot.is_available}
                        onValueChange={() => handleToggleSlot(slot)}
                        trackColor={{ false: COLORS.kraftBorder, true: COLORS.forestGreen }}
                        accessibilityLabel={`Slot ${slot.start_time} to ${slot.end_time} ${slot.is_available ? 'enabled' : 'disabled'}`}
                      />
                      <TouchableOpacity
                        onPress={() => handleDeleteSlot(slot.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove slot ${slot.start_time} to ${slot.end_time}`}
                      >
                        <Trash2 size={15} color={COLORS.ctaBrown} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {addingDay === day.key && (
                  <View style={styles.addForm}>
                    <View style={styles.addFormRow}>
                      <TextInput
                        value={newStart}
                        onChangeText={setNewStart}
                        placeholder="09:00"
                        placeholderTextColor={COLORS.textLight}
                        style={styles.timeInput}
                        maxLength={5}
                      />
                      <Text style={styles.toText}>to</Text>
                      <TextInput
                        value={newEnd}
                        onChangeText={setNewEnd}
                        placeholder="17:00"
                        placeholderTextColor={COLORS.textLight}
                        style={styles.timeInput}
                        maxLength={5}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.saveSlotBtn, saving && styles.btnDisabled]}
                      onPress={() => handleAddSlot(day.key)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Save availability slot"
                    >
                      {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveSlotBtnText}>Save Slot</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
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
  },
  headerIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 40 },
  dayCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { fontSize: 14, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  addSlotBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  noSlotsText: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textLight },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
  },
  slotTime: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  slotActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  addForm: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.kraftBorder, borderStyle: 'dashed' },
  addFormRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.textCoffee,
    textAlign: 'center',
  },
  toText: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textMuted },
  saveSlotBtn: { backgroundColor: COLORS.forestGreen, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  saveSlotBtnText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});
