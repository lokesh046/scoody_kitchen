import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../theme/colors';
import { fetchVaccineGuide, type GuideStatus, type VaccineGuide as Guide } from '../../api/vaccinations';
import { prettyDate } from './DateField';

const TABS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'planner', label: 'Due dates' },
  { id: 'rules', label: 'Rules' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const STATUS_LABEL: Record<GuideStatus, string> = {
  done: 'Done', overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming', not_recorded: 'Not recorded', optional: 'Optional', info: '',
};
// Same colours as the spreadsheets: green = done, orange = due soon, red = overdue.
const STATUS_COLOR: Record<GuideStatus, { badge: string; badgeText: string; tint: string }> = {
  done: { badge: '#2E9E55', badgeText: '#FFFFFF', tint: '#C8E6C9' },
  overdue: { badge: '#D93636', badgeText: '#FFFFFF', tint: '#FFCDD2' },
  due_soon: { badge: '#F59E0B', badgeText: '#3A2A00', tint: '#FFE0B2' },
  upcoming: { badge: COLORS.cardAlt, badgeText: COLORS.textCoffee, tint: COLORS.card },
  not_recorded: { badge: COLORS.cardAlt, badgeText: COLORS.textMuted, tint: COLORS.card },
  optional: { badge: COLORS.cardAlt, badgeText: COLORS.textMuted, tint: COLORS.card },
  info: { badge: COLORS.cardAlt, badgeText: COLORS.textMuted, tint: COLORS.card },
};

function Legend() {
  return (
    <View style={styles.legend}>
      {([['done', 'Done'], ['due_soon', 'Due soon (within 30 days)'], ['overdue', 'Overdue']] as const).map(([k, l]) => (
        <View key={k} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: STATUS_COLOR[k].tint, borderColor: STATUS_COLOR[k].badge }]} />
          <Text style={styles.muted}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

// The species' full vaccine guide: due dates worked out from the birth date, a timeline, the schedule and the rules.
// `refreshKey` changes whenever the owner records or deletes a dose, so the Done marks stay current.
export default function VaccineGuide({ petId, petName, refreshKey }: { petId: number; petName: string; refreshKey: number }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('schedule');

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchVaccineGuide(petId).then((g) => { if (live) setGuide(g); }).catch(() => { if (live) setGuide(null); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [petId, refreshKey]);

  if (loading && !guide) return <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.forestGreen} />;
  if (!guide || !guide.supported) return null;

  return (
    <View style={styles.box} accessibilityLabel="Vaccine guide">
      <Text style={styles.title}>{guide.title}</Text>
      <Text style={styles.sub}>{guide.subtitle}</Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.id === 'rules' && guide.rules_title ? guide.rules_title : t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'planner' && (guide.date_of_birth_known ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>Due dates worked out from {petName}'s birth date. A dose turns Done when you record it above.</Text>
          <Legend />
          {guide.planner.map((p, i) => {
            const col = STATUS_COLOR[p.status];
            return (
              <View key={i} style={[styles.row, { backgroundColor: col.tint }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.vaccine}</Text>
                  <Text style={styles.muted}>{p.dose} · {p.planned_age}</Text>
                  <Text style={styles.muted}>Due {prettyDate(p.due_date)}{p.date_given ? ` · Given ${prettyDate(p.date_given)}` : ''}</Text>
                  {!!p.note && <Text style={styles.note}>{p.note}</Text>}
                </View>
                <View style={[styles.badge, { backgroundColor: col.badge }]}><Text style={[styles.badgeText, { color: col.badgeText }]}>{STATUS_LABEL[p.status]}</Text></View>
              </View>
            );
          })}
          {!!guide.planner_note && <Text style={styles.note}>{guide.planner_note}</Text>}
        </View>
      ) : (
        <Text style={styles.muted}>Add {petName}'s date of birth to see due dates.</Text>
      ))}

      {tab === 'timeline' && (
        <View style={{ gap: 10 }}>
          {guide.timeline.map((t) => (
            <View key={t.stage} style={styles.tlRow}>
              <View style={styles.tlDot}><Text style={styles.tlDotText}>{t.stage}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.age}</Text>
                <Text style={styles.muted}>{t.what}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'schedule' && (
        <View style={{ gap: 8 }}>
          {guide.date_of_birth_known ? <Legend /> : <Text style={styles.muted}>Add {petName}'s date of birth to see status, last dose and next due for each line.</Text>}
          {guide.schedule.map((s) => {
            const col = s.status ? STATUS_COLOR[s.status] : null;
            const showBadge = !!s.status && s.status !== 'info';
            return (
              <View key={s.sno} style={[styles.schedCard, col && { backgroundColor: col.tint }]}>
                <View style={styles.schedTop}>
                  <Text style={[styles.age, { flex: 1 }]}>{s.sno}. {s.age}</Text>
                  {showBadge && col && s.status && (
                    <View style={[styles.badge, { backgroundColor: col.badge }]}><Text style={[styles.badgeText, { color: col.badgeText }]}>{STATUS_LABEL[s.status]}</Text></View>
                  )}
                </View>
                <Text style={styles.rowTitle}>{s.vaccine}</Text>
                {(!!s.last_dose || !!s.next_due) && (
                  <Text style={styles.muted}>
                    {s.last_dose ? `Last dose ${prettyDate(s.last_dose)}` : ''}{s.last_dose && s.next_due ? ' · ' : ''}{s.next_due ? `Next due ${prettyDate(s.next_due)}` : ''}
                  </Text>
                )}
                {!!s.protects && <Text style={styles.muted}>Protects against: {s.protects}</Text>}
                {!!s.notes && <Text style={styles.note}>{s.notes}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {tab === 'rules' && (
        <View style={{ gap: 10 }}>
          {guide.rules.map((r, i) => (
            <View key={i}>
              <Text style={styles.rowTitle}>{r.topic}</Text>
              <Text style={styles.muted}>{r.guidance}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>About this guide</Text>
        {guide.about.map((a) => (
          <View key={a.label}>
            <Text style={styles.muted}><Text style={styles.bold}>{a.label}:</Text> {a.text}</Text>
            {a.label === 'Sources' && guide.sources.map((src) => (
              <TouchableOpacity key={src.url} onPress={() => Linking.openURL(src.url).catch(() => undefined)} accessibilityRole="link" style={styles.link}>
                <Text style={styles.linkText}>• {src.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {!!guide.disclaimer && <Text style={styles.note}>{guide.disclaimer}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 12, gap: 10, marginTop: 8 },
  title: { color: COLORS.textCoffee, fontWeight: '800', fontSize: 15 },
  sub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: -6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { minHeight: 40, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.kraftBorder, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  tabText: { color: COLORS.textCoffee, fontWeight: '700', fontSize: 12 }, tabTextOn: { color: COLORS.textWhite },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  note: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, opacity: 0.85 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 10 },
  rowTitle: { color: COLORS.textCoffee, fontWeight: '800', fontSize: 13 },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }, badgeText: { fontSize: 10, fontWeight: '800' },
  tlRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tlDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: COLORS.forestGreen, alignItems: 'center', justifyContent: 'center' },
  tlDotText: { color: COLORS.forestGreen, fontWeight: '800', fontSize: 12 },
  schedCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, padding: 10, gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  schedTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  about: { borderTopWidth: 1, borderTopColor: COLORS.kraftBorder, paddingTop: 10, gap: 6 },
  aboutTitle: { color: COLORS.textCoffee, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  bold: { fontWeight: '800', color: COLORS.textCoffee },
  link: { minHeight: 36, justifyContent: 'center', marginLeft: 8 },
  linkText: { color: COLORS.forestGreen, textDecorationLine: 'underline', fontSize: 12 },
  age: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});
