import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_HEADING_SCRIPT, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { fetchActiveFaqs, type FAQ } from '../api/faqs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FAQSection() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchActiveFaqs()
      .then((data) => {
        if (mounted) setFaqs(data);
      })
      .catch(() => {
        if (mounted) setFaqs([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((prev) => (prev === id ? null : id));
  };

  if (!isLoading && faqs.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>QUESTIONS, ANSWERED</Text>
      <Text style={styles.heading}>Frequently Asked Questions</Text>

      {isLoading ? (
        <ActivityIndicator color={COLORS.forestGreen} style={{ marginTop: 16 }} />
      ) : (
        <View style={styles.list}>
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <View key={faq.id} style={styles.item}>
                <TouchableOpacity
                  onPress={() => toggle(faq.id)}
                  activeOpacity={0.7}
                  style={styles.itemHeader}
                >
                  <Text style={styles.question}>{faq.question}</Text>
                  <ChevronDown
                    size={16}
                    color={COLORS.sageIcon}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {isOpen && <Text style={styles.answer}>{faq.answer}</Text>}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textAlign: 'center',
    marginBottom: 6,
  },
  heading: {
    fontSize: 27,
    fontFamily: FONT_HEADING_SCRIPT,
    color: COLORS.textCoffee,
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  item: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 4,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
  },
  answer: {
    fontSize: 13,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
});
