import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../theme/colors';
import {
  saveVaccinationHistory, type HistoryAnswer, type HistoryAnswerKind, type PickedPhoto, type VaccineStatusItem,
} from '../../api/vaccinations';
import DateField, { toIso } from './DateField';
import PhotoPickerField from './PhotoPickerField';

type Choice = { kind: HistoryAnswerKind | null; date: string; clinic: string; photo: PickedPhoto | null };
const OPTIONS: { kind: HistoryAnswerKind; label: string }[] = [
  { kind: 'given', label: 'Last dose given' },
  { kind: 'not_vaccinated', label: 'Not vaccinated' },
  { kind: 'unknown', label: "Don't know" },
];

/** Vaccination history for an older pet. Every core vaccine must be answered; a given dose needs a date and a card photo. */
export default function VaccinationHistoryModal({ visible, petId, petName, dob, items, dismissible, onDone, onClose }: {
  visible: boolean; petId: number; petName: string; dob: string | null; items: VaccineStatusItem[];
  dismissible: boolean; onDone: () => void; onClose?: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const get = (code: string): Choice => choices[code] ?? { kind: null, date: '', clinic: '', photo: null };
  const set = (code: string, patch: Partial<Choice>) => setChoices((c) => ({ ...c, [code]: { ...get(code), ...patch } }));

  const core = items.filter((i) => i.category === 'core');
  const optional = items.filter((i) => i.category !== 'core');
  const today = toIso(new Date());
  const invalid = (c: Choice) => c.kind === 'given' && (!c.date || c.date > today || (dob !== null && c.date < dob) || !c.photo);
  const ready = core.every((i) => get(i.code).kind !== null && !invalid(get(i.code))) && optional.every((i) => !invalid(get(i.code)));

  const submit = async () => {
    setSaving(true); setError('');
    const answers: HistoryAnswer[] = [];
    const photos: Record<string, PickedPhoto> = {};
    for (const i of items) {
      const c = get(i.code);
      if (c.kind === null) continue;
      answers.push({ vaccine_code: i.code, answer: c.kind, date_given: c.kind === 'given' ? c.date : null, clinic_name: c.kind === 'given' && c.clinic.trim() ? c.clinic.trim() : null });
      if (c.kind === 'given' && c.photo) photos[i.code] = c.photo;
    }
    try {
      await saveVaccinationHistory(petId, answers, photos);
      setChoices({});
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail && typeof e.response.data.detail === 'string' ? e.response.data.detail : 'Could not save. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const row = (i: VaccineStatusItem, required: boolean) => {
    const c = get(i.code);
    return (
      <View key={i.code} style={styles.row}>
        <Text style={styles.vName}>{i.name} {required ? <Text style={styles.req}>*</Text> : <Text style={styles.opt}>(optional)</Text>}</Text>
        <View style={styles.chips}>
          {OPTIONS.map((o) => (
            <TouchableOpacity key={o.kind} onPress={() => set(i.code, { kind: o.kind })} style={[styles.chip, c.kind === o.kind && styles.chipOn]}
              accessibilityRole="radio" accessibilityState={{ selected: c.kind === o.kind }} accessibilityLabel={`${i.name}: ${o.label}`}>
              <Text style={[styles.chipText, c.kind === o.kind && styles.chipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {c.kind === 'given' && (
          <View style={{ gap: 10, marginTop: 10 }}>
            <DateField value={c.date} onChange={(d) => set(i.code, { date: d })} minDate={dob} label="Last dose date" />
            <TextInput style={styles.input} value={c.clinic} onChangeText={(t) => set(i.code, { clinic: t })} placeholder="Clinic (optional)" placeholderTextColor={COLORS.textLight} maxLength={150} />
            <PhotoPickerField photo={c.photo} onChange={(p) => set(i.code, { photo: p })} />
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (dismissible) onClose?.(); }}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{petName}'s vaccination history</Text>
          {dismissible && onClose && (
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Tell us the last dose for each vaccine and add a photo of the vaccine card (take one or upload). If you're not sure, choose “Don't know” (no photo needed) and we'll flag it for a vet visit.</Text>
          {core.map((i) => row(i, true))}
          {optional.length > 0 && <Text style={styles.sub}>Other vaccines you may have given</Text>}
          {optional.map((i) => row(i, false))}
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          {!ready && <Text style={styles.hint}>Answer every vaccine marked * to continue.</Text>}
          <TouchableOpacity style={[styles.save, (!ready || saving) && styles.saveOff]} disabled={!ready || saving} onPress={submit} accessibilityRole="button" accessibilityLabel="Save vaccination history">
            {saving ? <ActivityIndicator color={COLORS.textWhite} /> : <Text style={styles.saveText}>Save history</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.forestDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.textWhite, fontSize: 18, fontWeight: '800', flex: 1 },
  closeBtn: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  closeText: { color: COLORS.textWhite, fontWeight: '700' },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  intro: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  sub: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  row: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 12 },
  vName: { color: COLORS.textCoffee, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  req: { color: COLORS.accentRed }, opt: { color: COLORS.textMuted, fontWeight: '400', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.kraftBorder, justifyContent: 'center', backgroundColor: COLORS.card },
  chipOn: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  chipText: { color: COLORS.textCoffee, fontSize: 13 }, chipTextOn: { color: COLORS.textWhite, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 6, paddingHorizontal: 12, color: COLORS.textCoffee, backgroundColor: COLORS.card },
  error: { color: COLORS.accentRed, fontWeight: '600' },
  footer: { padding: 16, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.kraftBorder, gap: 8 },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  save: { minHeight: 50, borderRadius: 8, backgroundColor: COLORS.forestGreen, alignItems: 'center', justifyContent: 'center' },
  saveOff: { opacity: 0.5 }, saveText: { color: COLORS.textWhite, fontWeight: '800', fontSize: 15 },
});
