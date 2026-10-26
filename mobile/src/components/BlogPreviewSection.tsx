import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { BookOpen, ArrowRight } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY_BLACK, FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { fetchPublishedBlogPosts, type BlogPostListItem } from '../api/blog';

const PREVIEW_COUNT = 5;

export default function BlogPreviewSection({ navigation }: any) {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchPublishedBlogPosts()
      .then((data) => {
        if (mounted) setPosts(data.slice(0, PREVIEW_COUNT));
      })
      .catch(() => {
        if (mounted) setPosts([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Same convention as FAQSection — an empty, loaded section renders nothing
  // rather than an empty heading with nothing under it.
  if (!isLoading && posts.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>FROM THE JOURNAL</Text>
          <Text style={styles.heading}>Notes on feeding your dog well</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation?.navigate('Blog')}
          activeOpacity={0.7}
          style={styles.viewAllBtn}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <ArrowRight size={13} color={COLORS.forestGreen} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.card, styles.cardSkeleton]} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('BlogPost', { slug: post.slug })}
            >
              {post.cover_image_url ? (
                <Image source={{ uri: post.cover_image_url }} style={styles.cardImage} contentFit="contain" />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <BookOpen size={20} color={COLORS.kraftBorder} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.cardBody}>
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
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_WIDTH = 220;

const styles = StyleSheet.create({
  section: {
    paddingVertical: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    marginBottom: 4,
  },
  heading: {
    fontSize: 19,
    fontFamily: FONT_DISPLAY_BLACK,
    color: COLORS.textCoffee,
    maxWidth: 240,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 3,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.forestGreen,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  scrollRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  cardSkeleton: {
    height: 180,
    backgroundColor: COLORS.cardAlt,
  },
  cardImage: {
    width: '100%',
    height: 110,
    backgroundColor: COLORS.cardAlt,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 12,
    gap: 3,
  },
  cardTitle: {
    fontSize: 13.5,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    lineHeight: 18,
  },
  cardExcerpt: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
});
