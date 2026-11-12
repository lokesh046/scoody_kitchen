import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../../theme/colors';
import { useVetAccess } from '../../hooks/useFeatureFlag';
import {
  addVaccination, deleteVaccination, fetchVaccinationCardHtml, fetchVaccinations,
  type PickedPhoto, type VaccineStatus, type VaccineStatusItem, type VaccinationOverview,
} from '../../api/vaccinations';
import DateField, { prettyDate, toIso } from './DateField';
import PhotoPickerField from './PhotoPickerField';
import VaccinationHistoryModal from './VaccinationHistoryModal';
import VaccineGuide from './VaccineGuide';

const STATUS_LABEL: Record<VaccineStatus, string> = { overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'On track', optional: 'Optional', not_started: 'Add birth date', complete: 'Complete' };
const STATUS_COLOR: Record<VaccineStatus, { bg: string; fg: string }> = {
  overdue: { bg: COLORS.accentRedTintBg, fg: COLORS.accentRed },
  due_soon: { bg: '#FFF6E0', fg: '#8A5A00' },
  upcoming: { bg: '#E8F3EA', fg: COLORS.successGreen },
  optional: { bg: COLORS.cardAlt, fg: COLORS.textMuted },
  not_started: { bg: COLORS.cardAlt, fg: COLORS.textMuted },
  complete: { bg: '#E8F3EA', fg: COLORS.successGreen },
};

export default function VaccinationsModal({ visible, petId, petName, dob, onClose, onFindVet }: {
  visible: boolean; petId: number; petName: string; dob: string | null; onClose: () => void; onFindVet: () => void;
}) {
  const vet = useVetAccess();
  const [data, setData] = useState<VaccinationOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});
  const openDose = (code: string) => {
    setAdding(code);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max((cardY.current[code] ?? 0) - 8, 0), animated: true }), 50);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await fetchVaccinations(petId)); } catch { setError("Couldn't load vaccination records. Please try again."); } finally { setLoading(false); }
  }, [petId]);
  useEffect(() => { if (visible) { setAdding(null); load(); } }, [visible, load]);

  const shareCard = async () => {
    setCardBusy(true);
    try {
      const html = await fetchVaccinationCardHtml(petId);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${petName}'s vaccination card`, UTI: 'com.adobe.pdf' });
      else Alert.alert('Saved', 'The card was created but sharing is not available on this device.');
    } catch {
      Alert.alert("Couldn't create the card", 'Please check your connection and try again.');
    } finally { setCardBusy(false); }
  };

  const needsVet = (data?.items ?? []).filter((i) => i.category === 'core' && (i.status === 'overdue' || i.status === 'not_started'));
  const nameOf = (code: string) => data?.items.find((i) => i.code === code)?.name ?? code;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Image source={require('../../../assets/pet/vaccination.webp')} style={styles.headIcon} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={styles.title}>{petName}: Vaccinations</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close vaccinations"><Text style={styles.closeText}>Close</Text></TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {loading && !data && <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.forestGreen} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {data && !data.supported && (
            <View style={styles.soon}><Text style={styles.soonText}>Vaccine schedules for {data.species || 'this species'} are coming soon. We currently support dogs and cats.</Text></View>
          )}
          {data && data.supported && (
            <>
              {needsVet.length > 0 && (
                <View style={styles.vetCard} accessibilityRole="alert">
                  <Text style={styles.vetText}>
                    <Text style={{ fontWeight: '800' }}>{petName} needs a vet visit</Text> for {needsVet.map((i) => i.name.replace(/\s*\(.*\)$/, '')).join(', ')}. A vet can vaccinate and note it on the card.
                  </Text>
                  {vet.gps === 'on' ? (
                    <TouchableOpacity style={styles.vetBtn} onPress={onFindVet} accessibilityRole="button" accessibilityLabel="Find a vet near me">
                      <Text style={styles.vetBtnText}>Find a vet near me</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.vetBtn, styles.vetBtnOff]} accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel="Find a vet near me, coming soon">
                      <Text style={[styles.vetBtnText, { color: COLORS.textMuted }]}>Find a vet near me · Coming soon</Text>
                    </View>
                  )}
                </View>
              )}

              {data.history_required && !data.history_complete && (
                <View style={styles.histBanner}>
                  <Text style={styles.histText}>{petName}'s vaccination history isn't complete yet. Tell us the last dose for each core vaccine.</Text>
                  <TouchableOpacity style={styles.histBtn} onPress={() => setShowHistory(true)} accessibilityRole="button" accessibilityLabel="Complete vaccination history"><Text style={styles.histBtnText}>Complete history</Text></TouchableOpacity>
                </View>
              )}

              {data.items.map((item) => (
                <View key={item.code} onLayout={(e) => { cardY.current[item.code] = e.nativeEvent.layout.y; }}>
                  <VaccineCard item={item} open={adding === item.code} petId={petId} dob={dob}
                    onToggle={() => setAdding(adding === item.code ? null : item.code)}
                    onSaved={() => { setAdding(null); load(); }} />
                </View>
              ))}

              <View style={styles.recHead}>
                <Text style={styles.sectionTitle}>Recorded doses ({data.records.length})</Text>
                <TouchableOpacity style={styles.cardBtn} onPress={shareCard} disabled={cardBusy} accessibilityRole="button" accessibilityLabel="Share vaccine card as PDF">
                  {cardBusy ? <ActivityIndicator size="small" color={COLORS.forestGreen} /> : <Text style={styles.cardBtnText}>Vaccine card (PDF)</Text>}
                </TouchableOpacity>
              </View>
              {data.records.length === 0 && <Text style={styles.muted}>No doses recorded yet.</Text>}
              {data.records.map((r) => (
                <View key={r.id} style={styles.record}>
                  {r.image_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(r.image_url!)} accessibilityRole="imagebutton" accessibilityLabel="Open vaccine card photo">
                      <Image source={{ uri: r.image_url }} style={styles.recThumb} />
                    </TouchableOpacity>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>{nameOf(r.vaccine_code)} · {prettyDate(r.date_given)}</Text>
                    <Text style={styles.muted}>{[r.clinic_name, r.batch_number && `Batch ${r.batch_number}`, r.notes].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <TouchableOpacity style={styles.delBtn} accessibilityRole="button" accessibilityLabel="Delete this dose"
                    onPress={() => Alert.alert('Delete this dose?', 'This removes the record and its photo.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteVaccination(petId, r.id); load(); } catch { Alert.alert('Could not delete', 'Please try again.'); } } },
                    ])}>
                    <Text style={styles.delText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <VaccineGuide petId={petId} petName={petName} refreshKey={data.records.length} vaccines={data.items} onUpdate={openDose} />
              {data.items.some((i) => !i.vet_reviewed) && (
                <Text style={styles.disclaimer}>Schedules follow general veterinary guidance (WSAVA) and are pending review by our vets. Always confirm timings with your own vet.</Text>
              )}
            </>
          )}
        </ScrollView>

        {data && (
          <VaccinationHistoryModal visible={showHistory} petId={petId} petName={petName} dob={dob} items={data.items} dismissible
            onClose={() => setShowHistory(false)} onDone={() => { setShowHistory(false); load(); }} />
        )}
      </View>
    </Modal>
  );
}

function VaccineCard({ item, open, onToggle, petId, dob, onSaved }: {
  item: VaccineStatusItem; open: boolean; onToggle: () => void; petId: number; dob: string | null; onSaved: () => void;
}) {
  const [date, setDate] = useState('');
  const [clinic, setClinic] = useState('');
  const [batch, setBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = toIso(new Date());
  const dateBad = date !== '' && (date > today || (dob !== null && date < dob));
  const canSave = !!date && !!photo && !dateBad && !saving;
  const col = STATUS_COLOR[item.status];

  const save = async () => {
    if (!photo) return;
    setSaving(true); setError('');
    try {
      await addVaccination(petId, { vaccine_code: item.code, date_given: date, clinic_name: clinic.trim() || undefined, batch_number: batch.trim() || undefined, notes: notes.trim() || undefined }, photo);
      setDate(''); setClinic(''); setBatch(''); setNotes(''); setPhoto(null);
      onSaved();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Could not save this dose. Please try again.');
    } finally { setSaving(false); }
  };

  const status = item.declared
    ? (item.declared === 'unknown' ? "You said you don't know. Please check with your vet." : 'Marked as not vaccinated. Please see your vet.')
    : item.doses_given === 0 ? (item.category === 'core' ? 'No dose recorded yet.' : 'Not given yet.')
    : `Last dose ${prettyDate(item.last_given_date)} · ${item.doses_given} recorded`;

  return (
    <View style={styles.vCard}>
      <View style={styles.vTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vName}>{item.name}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: col.bg }]}><Text style={[styles.badgeText, { color: col.fg }]}>{STATUS_LABEL[item.status]}</Text></View>
            {item.recent && <View style={[styles.badge, { backgroundColor: '#E8F3EA' }]}><Text style={[styles.badgeText, { color: COLORS.successGreen }]}>Recent</Text></View>}
          </View>
          <Text style={styles.muted}>{status}{item.next_due_date ? ` · Next due ${prettyDate(item.next_due_date)}` : ''}{item.doses_given > 0 && item.doses_given < item.series_doses ? ` · starter series ${item.doses_given}/${item.series_doses}` : ''}</Text>
          {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${open ? 'Cancel adding' : 'Add'} dose for ${item.name}`}>
          <Text style={styles.addText}>{open ? 'Cancel' : 'Add dose'}</Text>
        </TouchableOpacity>
      </View>
      {open && (
        <View style={styles.form}>
          <DateField value={date} onChange={setDate} minDate={dob} />
          {dateBad && <Text style={styles.error}>Date can't be in the future or before the birth date.</Text>}
          <TextInput style={styles.input} value={clinic} onChangeText={setClinic} placeholder="Clinic / vet (optional)" placeholderTextColor={COLORS.textLight} maxLength={150} />
          <TextInput style={styles.input} value={batch} onChangeText={setBatch} placeholder="Batch number (optional)" placeholderTextColor={COLORS.textLight} maxLength={60} />
          <TextInput style={[styles.input, { minHeight: 64, textAlignVertical: 'top', paddingTop: 10 }]} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={COLORS.textLight} multiline maxLength={1000} />
          <PhotoPickerField photo={photo} onChange={setPhoto} />
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <TouchableOpacity style={[styles.save, !canSave && styles.saveOff]} disabled={!canSave} onPress={save} accessibilityRole="button" accessibilityLabel="Save dose">
            {saving ? <ActivityIndicator color={COLORS.textWhite} /> : <Text style={styles.saveText}>Save dose</Text>}
          </TouchableOpacity>
          {!photo && <Text style={styles.hint}>A photo of the vaccine card is required.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.forestDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headIcon: { width: 34, height: 34, marginRight: 10 },
  title: { color: COLORS.textWhite, fontSize: 18, fontWeight: '800', flex: 1 },
  closeBtn: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 }, closeText: { color: COLORS.textWhite, fontWeight: '700' },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  soon: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 16, backgroundColor: COLORS.cardAlt }, soonText: { color: COLORS.textCoffee, fontSize: 14 },
  vetCard: { backgroundColor: COLORS.accentRedTintBg, borderWidth: 1, borderColor: COLORS.accentRedTintBorder, borderRadius: 8, padding: 12, gap: 10 },
  vetText: { color: COLORS.accentRedTintText, fontSize: 13, lineHeight: 19 },
  vetBtn: { minHeight: 44, borderRadius: 8, backgroundColor: COLORS.forestGreen, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  vetBtnOff: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder }, vetBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: 13 },
  histBanner: { backgroundColor: '#FFF6E0', borderWidth: 1, borderColor: '#EBCB7A', borderRadius: 8, padding: 12, gap: 10 },
  histText: { color: '#6B4A00', fontSize: 13, lineHeight: 19 },
  histBtn: { minHeight: 44, borderRadius: 8, backgroundColor: COLORS.forestGreen, alignItems: 'center', justifyContent: 'center' }, histBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: 13 },
  vCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 12 },
  vTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  vName: { color: COLORS.textCoffee, fontWeight: '800', fontSize: 14 },
  badges: { flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }, badgeText: { fontSize: 11, fontWeight: '800' },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 }, desc: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, opacity: 0.85 },
  addBtn: { minHeight: 44, minWidth: 76, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, addText: { color: COLORS.textCoffee, fontWeight: '700', fontSize: 12 },
  form: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.kraftBorder, gap: 10 },
  input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 6, paddingHorizontal: 12, color: COLORS.textCoffee, backgroundColor: COLORS.card },
  save: { minHeight: 48, borderRadius: 8, backgroundColor: COLORS.forestGreen, alignItems: 'center', justifyContent: 'center' }, saveOff: { opacity: 0.5 }, saveText: { color: COLORS.textWhite, fontWeight: '800' },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' }, error: { color: COLORS.accentRed, fontSize: 12, fontWeight: '600' },
  recHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  sectionTitle: { color: COLORS.textCoffee, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', flex: 1 },
  cardBtn: { minHeight: 44, minWidth: 120, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, cardBtnText: { color: COLORS.forestGreen, fontWeight: '800', fontSize: 12 },
  record: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 10 },
  recThumb: { width: 48, height: 48, borderRadius: 4 }, recTitle: { color: COLORS.textCoffee, fontWeight: '700', fontSize: 13 },
  delBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, delText: { color: COLORS.accentRed, fontWeight: '700', fontSize: 12 },
  disclaimer: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
