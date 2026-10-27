import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BookOpen, Calendar } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { StackHeader } from '../components/ScreenHeader';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { fetchPublishedBlogPosts, type BlogPostListItem } from '../api/blog';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BlogScreen({ navigation }: any) {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchPublishedBlogPosts();
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Journal" eyebrow="HEARTH & ONE" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.forestGreen} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.forestGreen} />}
        >
          <Text style={styles.intro}>
            Practical, vet-informed guidance on nutrition, feeding amounts, and everyday health.
          </Text>

          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen size={28} color={COLORS.kraftBorder} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No journal entries yet</Text>
              <Text style={styles.emptySub}>Check back soon for guidance on feeding and dog care.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('BlogPost', { slug: post.slug })}
              >
                {post.cover_image_url ? (
                  <Image source={{ uri: post.cover_image_url }} style={styles.cardImage} contentFit="contain" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <BookOpen size={22} color={COLORS.kraftBorder} strokeWidth={1.5} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  {post.published_at && (
                    <View style={styles.dateRow}>
                      <Calendar size={11} color={COLORS.sageIcon} />
                      <Text style={styles.dateText}>{formatDate(post.published_at)}</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  {post.excerpt && (
                    <Text style={styles.cardExcerpt} numberOfLines={2}>
                      {post.excerpt}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  intro: {
    fontSize: 13,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginBottom: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 150,
    backgroundColor: COLORS.cardAlt,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
    gap: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    lineHeight: 20,
  },
  cardExcerpt: {
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
});
