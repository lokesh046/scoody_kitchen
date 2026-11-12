import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS } from '../../theme/colors';

export const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
export const prettyDate = (iso: string | null) =>
  iso && fromIso(iso) ? fromIso(iso)!.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** A tap-to-pick date (never in the future, never before the pet's birth date). Value is YYYY-MM-DD or ''. */
export default function DateField({ value, onChange, minDate, label = 'Date given' }: {
  value: string; onChange: (iso: string) => void; minDate?: string | null; label?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const min = minDate ? fromIso(minDate) ?? undefined : undefined;
  const open = () => {
    const current = fromIso(value) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current, mode: 'date', maximumDate: new Date(), minimumDate: min,
        onChange: (e, d) => { if (e.type === 'set' && d) onChange(toIso(d)); },
      });
    } else {
      setIosOpen(true);
    }
  };
  return (
    <View>
      <Text style={styles.label}>{label} <Text style={styles.req}>*</Text></Text>
      <TouchableOpacity style={styles.field} onPress={open} accessibilityRole="button"
        accessibilityLabel={value ? `${label} ${prettyDate(value)}. Tap to change` : `Choose ${label.toLowerCase()}`}>
        <Text style={value ? styles.value : styles.placeholder}>{value ? prettyDate(value) : 'Choose date'}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && iosOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <DateTimePicker value={fromIso(value) ?? new Date()} mode="date" display="inline" maximumDate={new Date()} minimumDate={min}
                onChange={(_e, d) => { if (d) onChange(toIso(d)); }} />
              <TouchableOpacity style={styles.done} onPress={() => setIosOpen(false)} accessibilityRole="button" accessibilityLabel="Done choosing date">
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: COLORS.textCoffee, marginBottom: 6, fontWeight: '600' },
  req: { color: COLORS.accentRed },
  field: { minHeight: 44, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 6, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: COLORS.card },
  value: { color: COLORS.textCoffee, fontSize: 14 },
  placeholder: { color: COLORS.textLight, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  done: { minHeight: 48, backgroundColor: COLORS.forestGreen, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  doneText: { color: COLORS.textWhite, fontWeight: '700' },
});
