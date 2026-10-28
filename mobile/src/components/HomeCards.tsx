import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  Heart,
  Star,
  Plus,
  Minus,
  Stethoscope,
  UtensilsCrossed,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_DISPLAY_SEMIBOLD, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO, FONT_SCRIPT } from '../theme/typography';
import { HERO_TITLE_IMAGES, heroTitleKey } from '../constants/heroTitleImages';
import { Product } from '../types';
import { UnifiedReview } from '../api/reviews';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;

export const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
];

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  targetScreen: string;
  bgImage: string;
}

export const HERO_BANNERS: HeroBanner[] = [
  {
    id: '1',
    title: 'Hearth & Hound: Small-Batch Nutrition',
    subtitle: 'Wholesome Chicken & Sweet Potato recipes hand-crafted with human-grade ingredients.',
    ctaText: 'Explore Kitchen',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg',
  },
  {
    id: '2',
    title: 'Honest Ingredients. Zero Filler.',
    subtitle: 'Every batch contains zero corn, wheat, soy, or synthetic preservatives. Tested by nutritionists.',
    ctaText: 'Explore Recipes',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg',
  },
  {
    id: '3',
    title: 'Farm-To-Freezer Holistic Meals',
    subtitle: 'Real whole-food chicken and sweet potatoes, cooked once and flash-frozen to lock in nutrition — no preservatives needed.',
    ctaText: 'Explore Menu',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521315/scooby_kitchen/nji85annhntaovsycm9q.jpg',
  },
  {
    id: '4',
    title: 'Raptor: All-Meat Diet',
    subtitle: 'Pure primal nutrition engineered for athletic endurance, lean muscle, and digestive resilience.',
    ctaText: 'View Recipe',
    targetScreen: 'Shop',
    bgImage: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521296/scooby_kitchen/fcw2fhniavnni3qracok.jpg',
  },
];

interface BannerSlideItemProps {
  item: HeroBanner;
  onNavigate: (targetScreen: string) => void;
  slideWidth?: number;
  cardWidth?: number;
}

export const BannerSlideItem = memo(function BannerSlideItem({
  item,
  onNavigate,
  slideWidth,
  cardWidth,
}: BannerSlideItemProps) {
  const [imgUri, setImgUri] = useState(item.bgImage);

  useEffect(() => {
    setImgUri(item.bgImage);
  }, [item.bgImage]);

  const titleImage = HERO_TITLE_IMAGES[heroTitleKey(item.title)];
  const titleWidth = Math.min(190, (cardWidth ?? BANNER_WIDTH) - 36);

  return (
    <View style={[homeCardStyles.bannerSlideWrapper, slideWidth ? { width: slideWidth } : null]}>
      <View style={[homeCardStyles.bannerSlide, cardWidth ? { width: cardWidth } : null]}>
        <Image
          source={{ uri: imgUri }}
          style={homeCardStyles.bannerImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={item.bgImage}
          onError={() => {
            if (imgUri !== HERO_BANNERS[0].bgImage) {
              setImgUri(HERO_BANNERS[0].bgImage);
            }
          }}
        />
        <LinearGradient
          colors={['rgba(14,11,8,0.35)', 'rgba(14,11,8,0.1)', 'rgba(14,11,8,0.55)', 'rgba(14,11,8,0.94)']}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={homeCardStyles.bannerContent}>
          {/* Headline: a picture for the known titles, otherwise script text.
              Banner copy comes from the admin panel, so the text fallback is
              capped at 3 lines rather than overflowing the slide. */}
          {titleImage ? (
            <Image
              source={titleImage.source}
              style={{ width: titleWidth, height: (titleWidth * titleImage.height) / titleImage.width }}
              contentFit="contain"
              accessibilityLabel={item.title}
            />
          ) : (
            <Text style={homeCardStyles.bannerTitle} numberOfLines={2}>{item.title}</Text>
          )}

          <Text style={homeCardStyles.bannerSub} numberOfLines={2}>
            {item.subtitle}
          </Text>

          <TouchableOpacity
            style={homeCardStyles.bannerCtaBtn}
            onPress={() => onNavigate(item.targetScreen)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={item.ctaText}
          >
            <Text style={homeCardStyles.bannerCtaText}>{item.ctaText}</Text>
            <ArrowRight size={15} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

interface ProductFavoriteCardProps {
  product: Product;
  inCartItem?: { id: number; quantity: number };
  isFav: boolean;
  onToggleFavorite: (id: number) => void;
  onAddItem: (productId: number, quantity: number) => void;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onSelectProduct: (productId: number) => void;
  // Set when shop_checkout is off (e.g. "Coming Soon" / "Unavailable") — same
  // treatment web's RecipeCard uses: browsing stays live, only the actual
  // purchase action disables, showing this label instead of "Add".
  orderingDisabledLabel?: string;
}

export const ProductFavoriteCard = memo(function ProductFavoriteCard({
  product,
  inCartItem,
  isFav,
  onToggleFavorite,
  onAddItem,
  onUpdateQuantity,
  onRemoveItem,
  onSelectProduct,
  orderingDisabledLabel,
}: ProductFavoriteCardProps) {
  const hasReviews = !!product.review_count && product.review_count > 0;
  const hasStockInfo = product.available_stock !== null && product.available_stock !== undefined;
  const isOutOfStock = hasStockInfo && product.available_stock === 0;

  return (
    <View style={homeCardStyles.favoriteCard}>
      {/* Product Image & Badges */}
      <TouchableOpacity
        style={homeCardStyles.cardImageContainer}
        onPress={() => onSelectProduct(product.id)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}`}
      >
        <Image
          source={{
            uri:
              product.image_url ||
              'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=75',
          }}
          style={homeCardStyles.cardProductImage}
          contentFit="cover"
        />

        {/* Stock Badge — reflects the product's real available_stock, hidden when unknown */}
        {hasStockInfo && (
          <View style={[homeCardStyles.stockTag, isOutOfStock && homeCardStyles.stockTagOut]}>
            <Text style={[homeCardStyles.stockTagText, isOutOfStock && homeCardStyles.stockTagTextOut]}>
              {isOutOfStock ? 'OUT OF STOCK' : 'IN STOCK'}
            </Text>
          </View>
        )}

        {/* Heart Button */}
        <TouchableOpacity
          style={homeCardStyles.heartCircle}
          onPress={() => onToggleFavorite(product.id)}
          activeOpacity={0.8}
          hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
          accessibilityRole="button"
          accessibilityLabel={isFav ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
        >
          <Heart
            size={14}
            color={isFav ? COLORS.accentRed : COLORS.textCoffee}
            fill={isFav ? COLORS.accentRed : 'none'}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Card Body */}
      <View style={homeCardStyles.cardBody}>
        <TouchableOpacity
          onPress={() => onSelectProduct(product.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`View ${product.name}`}
        >
          {/* Rating (only shown once the recipe has real reviews) */}
          {hasReviews && (
            <View style={homeCardStyles.ratingRow}>
              <Star size={13} color={COLORS.accentGold} fill={COLORS.accentGold} />
              <Text style={homeCardStyles.ratingText}>
                {(product.average_rating ?? 0).toFixed(1)}{' '}
                <Text style={homeCardStyles.reviewsCount}>
                  ({product.review_count} review{product.review_count === 1 ? '' : 's'})
                </Text>
              </Text>
            </View>
          )}

          {/* Product Title & Subtitle */}
          <Text style={homeCardStyles.cardTitle} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={homeCardStyles.cardSubtitle} numberOfLines={1}>
            {product.description || 'Digestive comfort & gentle fiber balance'}
          </Text>
        </TouchableOpacity>

        {/* Batch & Price + Add Button */}
        <View style={homeCardStyles.cardFooter}>
          <View style={homeCardStyles.cardFooterLeft}>
            {product.sku && (
              <Text style={homeCardStyles.batchLabel} numberOfLines={1}>
                SKU: {product.sku}
              </Text>
            )}
            <Text style={homeCardStyles.cardPrice}>₹{product.price}</Text>
          </View>

          {orderingDisabledLabel ? (
            <View style={homeCardStyles.cardAddBtnDisabled}>
              <Text style={homeCardStyles.cardAddDisabledText}>{orderingDisabledLabel}</Text>
            </View>
          ) : inCartItem && inCartItem.quantity > 0 ? (
            /* Connected Quantity Stepper */
            <View style={homeCardStyles.stepperContainer}>
              <TouchableOpacity
                style={homeCardStyles.stepperBtn}
                onPress={() => {
                  if (inCartItem.quantity > 1) {
                    onUpdateQuantity(inCartItem.id, inCartItem.quantity - 1);
                  } else {
                    onRemoveItem(inCartItem.id);
                  }
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={inCartItem.quantity > 1 ? `Decrease quantity of ${product.name}` : `Remove ${product.name} from cart`}
              >
                <Minus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>

              <Text style={homeCardStyles.stepperQty}>{inCartItem.quantity}</Text>

              <TouchableOpacity
                style={homeCardStyles.stepperBtn}
                onPress={() => onUpdateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity of ${product.name}`}
              >
                <Plus size={11} color="#FFFFFF" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={homeCardStyles.cardAddBtn}
              onPress={() => onAddItem(product.id, 1)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
            >
              <Plus size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={homeCardStyles.cardAddText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

interface ReviewCardItemProps {
  review: UnifiedReview;
  index: number;
  onOpenModal: (review: UnifiedReview) => void;
  onNavigateTarget: (review: UnifiedReview) => void;
  width?: number;
}

export const ReviewCardItem = memo(function ReviewCardItem({
  review,
  index,
  onOpenModal,
  onNavigateTarget,
  width = 224,
}: ReviewCardItemProps) {
  const displayImage =
    review.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];

  return (
    <TouchableOpacity
      style={[homeCardStyles.reviewCard, { width }]}
      onPress={() => onOpenModal(review)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Read ${review.author_name}'s ${review.rating}-star review`}
    >
      {/* Photo with a dark type pill, as on the web card */}
      <View style={homeCardStyles.reviewImageWrap}>
        <Image
          source={{ uri: displayImage }}
          style={homeCardStyles.reviewCardImg as any}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={homeCardStyles.reviewTypeBadge}>
          {review.type === 'doctor' ? (
            <Stethoscope size={11} color="#D09E6B" strokeWidth={2.2} />
          ) : (
            <UtensilsCrossed size={11} color="#D09E6B" strokeWidth={2.2} />
          )}
          <Text style={homeCardStyles.reviewTypeBadgeText}>
            {review.type === 'doctor' ? 'VET CONSULT' : 'FRESH MEAL'}
          </Text>
        </View>
      </View>

      {/* White card overlapping the photo */}
      <View style={homeCardStyles.reviewBody}>
        <View style={homeCardStyles.reviewStarRow} accessibilityLabel={`${review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={14}
              color={star <= review.rating ? '#D09E6B' : COLORS.kraftBorder}
              fill={star <= review.rating ? '#D09E6B' : 'transparent'}
            />
          ))}
          <Text style={homeCardStyles.reviewRatingNumber}>{review.rating.toFixed(1)}</Text>
        </View>

        <Text style={homeCardStyles.reviewCommentSnippet} numberOfLines={4}>
          “{review.comment || 'No comment provided.'}”
        </Text>

        <View style={homeCardStyles.reviewFooter}>
          <View style={homeCardStyles.reviewAvatar}>
            <Text style={homeCardStyles.reviewAvatarText}>
              {(review.author_name || '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={homeCardStyles.reviewAuthorRow}>
              <Text style={homeCardStyles.reviewAuthorName} numberOfLines={1}>
                {review.author_name}
              </Text>
              {review.is_verified_buyer && <CheckCircle2 size={13} color="#D09E6B" />}
            </View>
            <Text style={homeCardStyles.reviewTargetItem} numberOfLines={1}>
              {review.reviewed_item_name}
            </Text>
          </View>
        </View>

        <View style={homeCardStyles.reviewReadMore}>
          <Text style={homeCardStyles.reviewReadMoreText}>READ THEIR STORY</Text>
          <ChevronRight size={13} color="#D09E6B" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const homeCardStyles = StyleSheet.create({
  bannerSlideWrapper: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    backgroundColor: '#0E0B08',
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  // Padding lives here, not on bannerSlide: a padded parent shrinks the
  // image's 100% width and leaves a dark strip down one side.
  bannerContent: {
    gap: 8,
    padding: 18,
  },
  bannerTitle: {
    fontSize: 28,
    fontFamily: FONT_SCRIPT,
    color: '#F5F1EA',
    lineHeight: 32,
  },
  bannerSub: {
    fontSize: 11.5,
    fontFamily: FONT_BODY,
    color: 'rgba(245,241,234,0.85)',
    lineHeight: 16,
    maxWidth: '92%',
  },
  bannerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.forestGreen,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  bannerCtaText: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },
  favoriteCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#EAE1D5',
  },
  cardProductImage: {
    width: '100%',
    height: '100%',
  },
  stockTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.sageTintBadgeBg, // Sage tint — DESIGN.md's sage is the documented "verified label" color, replacing generic Tailwind green
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockTagOut: {
    backgroundColor: '#EEE0DD', // accentRed tint — the existing brand "Urgent/Alert" color, not generic red
  },
  stockTagText: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageTintText,
    letterSpacing: 0.4,
  },
  stockTagTextOut: {
    color: '#672F22',
  },
  heartCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: LEDGER_MONO,
    color: COLORS.textCoffee,
  },
  reviewsCount: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
  },
  // Lets the SKU/price block shrink and truncate instead of forcing the
  // row wider than the card — without this, a long SKU pushed the Add
  // button/stepper past the card's own right edge.
  cardFooterLeft: {
    flex: 1,
    marginRight: 8,
  },
  batchLabel: {
    fontSize: 9,
    fontFamily: LEDGER_MONO,
    color: COLORS.textLight,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: LEDGER_MONO,
    color: COLORS.textCoffee,
  },
  cardAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.ctaBrown,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  cardAddText: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },
  cardAddBtnDisabled: {
    backgroundColor: COLORS.kraftBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  cardAddDisabledText: {
    fontSize: 11,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textLight,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forestGreen,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 6,
    flexShrink: 0,
  },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 11,
    fontFamily: LEDGER_MONO,
    color: '#FFFFFF',
    minWidth: 14,
    textAlign: 'center',
  },
  reviewCard: {
    width: 224,
  },
  reviewImageWrap: {
    width: '100%',
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1E8DA',
  },
  reviewCardImg: {
    width: '100%',
    height: 140,
  },
  reviewTypeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(14,11,8,0.85)',
  },
  reviewTypeBadgeText: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontFamily: LEDGER_MONO,
    color: '#F9F6F0',
  },
  // Used by the review detail popup in HomeScreen.
  productTypeBadge: {
    backgroundColor: COLORS.sageTintBadgeBg,
    borderColor: COLORS.sageLight,
  },
  doctorTypeBadge: {
    backgroundColor: COLORS.navyTintBg,
    borderColor: COLORS.navyTintBorder,
  },
  productTypeText: {
    color: COLORS.sageTintText,
  },
  doctorTypeText: {
    color: COLORS.navy,
  },
  reviewBody: {
    marginHorizontal: 9,
    marginTop: -22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(235,224,208,0.6)',
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  reviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 10,
  },
  reviewRatingNumber: {
    marginLeft: 6,
    fontSize: 11,
    fontFamily: LEDGER_MONO,
    color: 'rgba(54,40,32,0.6)',
  },
  reviewCommentSnippet: {
    minHeight: 68,
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: 'rgba(54,40,32,0.8)',
    lineHeight: 17,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(235,224,208,0.7)',
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0E0B08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 15,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: '#D09E6B',
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewAuthorName: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
    color: COLORS.textCoffee,
  },
  reviewTargetItem: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: 'rgba(54,40,32,0.6)',
  },
  reviewReadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 12,
  },
  reviewReadMoreText: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: LEDGER_MONO,
    color: 'rgba(54,40,32,0.7)',
  },
});
