import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import SafeAreaView from '../components/FeatureSafeArea';
import RenderHTML from 'react-native-render-html';
import { AlertCircle, Calendar } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { StackHeader } from '../components/ScreenHeader';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { fetchBlogPostBySlug, type BlogPost } from '../api/blog';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// Only http(s) links are ever opened — content_html ultimately comes from an
// automated LLM pipeline, so a stray javascript: or data: href in generated
// markup is never trusted enough to hand to Linking.openURL as-is.
function openSafeUrl(href: string) {
  if (/^https?:\/\//i.test(href)) {
    Linking.openURL(href).catch(() => {});
  }
}

export default function BlogPostScreen({ navigation, route }: any) {
  const { slug } = route?.params || {};
  const { width } = useWindowDimensions();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchBlogPostBySlug(slug);
      setPost(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StackHeader title="Journal" onBack={() => navigation.goBack()} />
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.forestGreen} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StackHeader title="Journal" onBack={() => navigation.goBack()} />
        <View style={styles.centerFill}>
          <AlertCircle size={32} color={COLORS.accentRed} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Entry Not Found</Text>
          <Text style={styles.errorSub}>This journal entry doesn't exist, or isn't published.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const contentWidth = width - 32; // matches scrollContent's horizontal padding

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Journal" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {post.published_at && (
          <View style={styles.dateRow}>
            <Calendar size={11} color={COLORS.sageIcon} />
            <Text style={styles.dateText}>{formatDate(post.published_at)}</Text>
          </View>
        )}
        <Text style={styles.title}>{post.title}</Text>

        {post.cover_image_url && (
          <Image source={{ uri: post.cover_image_url }} style={styles.coverImage} contentFit="contain" />
        )}

        <RenderHTML
          contentWidth={contentWidth}
          source={{ html: post.content_html }}
          baseStyle={styles.htmlBase}
          tagsStyles={htmlTagStyles}
          renderersProps={{
            a: {
              onPress: (_event, href) => openSafeUrl(href),
            },
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const htmlTagStyles = {
  h2: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: COLORS.textCoffee,
    marginTop: 22,
    marginBottom: 8,
  },
  h3: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: COLORS.textCoffee,
    marginTop: 16,
    marginBottom: 6,
  },
  p: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 22,
    color: COLORS.textCoffee,
    marginBottom: 10,
  },
  li: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLORS.textCoffee,
  },
  a: {
    color: COLORS.forestGreen,
    textDecorationLine: 'underline' as const,
  },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
  },
  errorSub: {
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    lineHeight: 28,
    marginBottom: 14,
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
    marginBottom: 12,
  },
  htmlBase: {
    fontFamily: FONT_BODY,
  },
});
