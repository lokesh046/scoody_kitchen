import React, { useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import {
  Check,
  ShoppingBag,
  Minus,
  Plus,
  Star,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { Product } from '../types';
import { ProductReview } from '../api/reviews';
import { getOptimizedImageUrl, IMAGE_SIZE } from '../utils/cloudinaryImage';

export const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
];

const LEDGER_MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

function formatPrice(price: number | string): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return String(price);
  return n.toFixed(2);
}

// DESIGN.md's "Torn Edge Signature": product photos are cut with a zigzag
// bottom edge, like a page torn from a kitchen notebook. Drawn as a fixed
// viewBox path and stretched to the card's actual width via preserveAspectRatio
// "none", so it stays crisp at any column width without per-card layout math.
const TORN_EDGE_VIEW_WIDTH = 100;
const TORN_EDGE_VIEW_HEIGHT = 10;
const TORN_EDGE_TEETH = 14;
function buildTornEdgePath(): string {
  const step = TORN_EDGE_VIEW_WIDTH / TORN_EDGE_TEETH;
  let d = `M0,${TORN_EDGE_VIEW_HEIGHT}`;
  for (let i = 0; i <= TORN_EDGE_TEETH; i++) {
    const x = i * step;
    const y = i % 2 === 0 ? 0 : TORN_EDGE_VIEW_HEIGHT;
    d += ` L${x.toFixed(2)},${y}`;
  }
  d += ` L${TORN_EDGE_VIEW_WIDTH},${TORN_EDGE_VIEW_HEIGHT} Z`;
  return d;
}
const TORN_EDGE_PATH = buildTornEdgePath();

type StockBadgeInfo = { label: string; tone: 'in' | 'low' | 'out' } | null;

// available_stock is untracked (null/undefined) for recipes without live inventory
// counts, so those are treated as always in stock rather than flagged as a problem.
function getStockBadge(stock: number | null | undefined, lowThreshold: number | null | undefined): StockBadgeInfo {
  if (stock === null || stock === undefined) return { label: 'In Stock', tone: 'in' };
  if (stock <= 0) return { label: 'Out of Stock', tone: 'out' };
  if (stock <= (lowThreshold ?? 5)) return { label: `Low Stock (${stock} left)`, tone: 'low' };
  return { label: 'In Stock', tone: 'in' };
}

// DESIGN.md's brand faces: Outfit for display/headings, Quicksand for body copy.
const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
const FONT_BODY = 'Quicksand_400Regular';
const FONT_BODY_BOLD = 'Quicksand_700Bold';

interface RecipeCardItemProps {
  recipe: Product;
  inCartItem?: { id: number; quantity: number };
  isJustAdded: boolean;
  isStepperUpdating: boolean;
  onSelectRecipe: (recipe: Product) => void;
  onAddToCart: (recipe: Product) => void;
  onUpdateQuantity: (cartId: number, quantity: number) => void;
  onRemoveItem: (cartId: number) => void;
  // Set when shop_checkout is off (e.g. "Coming Soon" / "Unavailable") —
  // browsing the catalog stays live, only the actual Add button disables,
  // reusing the same treatment an out-of-stock recipe already gets.
  orderingDisabledLabel?: string;
}

export const RecipeCardItem = memo(function RecipeCardItem({
  recipe,
  inCartItem,
  isJustAdded,
  isStepperUpdating,
  onSelectRecipe,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  orderingDisabledLabel,
}: RecipeCardItemProps) {
  const displayImage =
    recipe.image_url ||
    (recipe.images && recipe.images.length > 0 ? recipe.images[0].image_url : null) ||
    'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&auto=format&fit=crop&q=75';

  const stockBadge = getStockBadge(recipe.available_stock, recipe.low_stock_threshold);
  const isOutOfStock = stockBadge?.tone === 'out';
  const isOrderingBlocked = isOutOfStock || !!orderingDisabledLabel;

  const liftAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(liftAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
  }, [liftAnim]);
  const handlePressOut = useCallback(() => {
    Animated.spring(liftAnim, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
  }, [liftAnim]);

  const animatedCardStyle = {
    transform: [
      { translateY: liftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
    ],
  };

  return (
    <Animated.View style={[recipeCardStyles.recipeCard, animatedCardStyle]}>
      {/* Full-width image block, its own section separate from the content below */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onSelectRecipe(recipe)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={recipeCardStyles.imageContainer}
      >
        <Image
          source={{ uri: getOptimizedImageUrl(displayImage, IMAGE_SIZE.productCard, IMAGE_SIZE.productCard) }}
          style={recipeCardStyles.recipeImage}
          contentFit="cover"
        />
        {isOutOfStock && <View style={recipeCardStyles.imageOutOfStockDim} />}

        {/* Torn Edge Signature (DESIGN.md): a zigzag tear along the photo's
            bottom edge, like a page pulled from Scooby's own kitchen journal. */}
        <Svg
          style={recipeCardStyles.tornEdge}
          width="100%"
          height={TORN_EDGE_VIEW_HEIGHT}
          viewBox={`0 0 ${TORN_EDGE_VIEW_WIDTH} ${TORN_EDGE_VIEW_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <Path d={TORN_EDGE_PATH} fill={COLORS.card} />
        </Svg>

        {stockBadge && (
          <View
            style={[
              recipeCardStyles.stockBadge,
              stockBadge.tone === 'low' && recipeCardStyles.stockBadgeLow,
              stockBadge.tone === 'out' && recipeCardStyles.stockBadgeOut,
            ]}
          >
            {stockBadge.tone === 'low' ? (
              <Clock size={10} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <View style={recipeCardStyles.stockDot} />
            )}
            <Text style={recipeCardStyles.stockBadgeText}>{stockBadge.label}</Text>
          </View>
        )}
        {recipe.category && (
          <View style={recipeCardStyles.categoryTag}>
            <Text style={recipeCardStyles.categoryTagText} numberOfLines={1}>{recipe.category.name}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content block below the image */}
      <TouchableOpacity
        style={recipeCardStyles.cardContent}
        onPress={() => onSelectRecipe(recipe)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Text style={recipeCardStyles.recipeTitle} numberOfLines={2}>{recipe.name}</Text>

        {/* Price row, then a full-width Add/stepper footer beneath it — the
            two-column card is too narrow for price and action side by side. */}
        <View style={recipeCardStyles.priceRow}>
          <Text style={recipeCardStyles.priceText} numberOfLines={1}>₹{formatPrice(recipe.price)}</Text>
          <Text style={recipeCardStyles.unitText} numberOfLines={1}>/ pouch</Text>
        </View>

        <View style={recipeCardStyles.footerRow}>
          {!isJustAdded && !isOrderingBlocked && inCartItem && inCartItem.quantity > 0 ? (
            <View style={[recipeCardStyles.cardStepperWrapper, isStepperUpdating && recipeCardStyles.cardStepperWrapperBusy]}>
              <TouchableOpacity
                style={recipeCardStyles.cardStepperBtn}
                onPress={() => {
                  if (inCartItem.quantity > 1) {
                    onUpdateQuantity(inCartItem.id, inCartItem.quantity - 1);
                  } else {
                    onRemoveItem(inCartItem.id);
                  }
                }}
                disabled={isStepperUpdating}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                accessibilityState={{ disabled: isStepperUpdating, busy: isStepperUpdating }}
              >
                <Minus size={12} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>

              {isStepperUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={recipeCardStyles.cardStepperQtyBusy} />
              ) : (
                <Text style={recipeCardStyles.cardStepperQty}>{inCartItem.quantity}</Text>
              )}

              <TouchableOpacity
                style={recipeCardStyles.cardStepperBtn}
                onPress={() => onUpdateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                disabled={isStepperUpdating}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                accessibilityState={{ disabled: isStepperUpdating, busy: isStepperUpdating }}
              >
                <Plus size={12} color="#FFFFFF" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>
          ) : (
            // Same TouchableOpacity across Add/Added/Out-of-Stock so tapping it
            // never swaps to a different component type mid-gesture (RN warns
            // "Ended a touch event which was not counted" when that happens).
            <TouchableOpacity
              style={[
                recipeCardStyles.addBtn,
                isOrderingBlocked && recipeCardStyles.addBtnDisabled,
                isJustAdded && recipeCardStyles.addBtnSuccess,
              ]}
              onPress={() => onAddToCart(recipe)}
              activeOpacity={0.85}
              disabled={isOrderingBlocked || isJustAdded}
            >
              {isOutOfStock ? (
                <Text style={recipeCardStyles.addBtnDisabledText}>Out of Stock</Text>
              ) : orderingDisabledLabel ? (
                <Text style={recipeCardStyles.addBtnDisabledText}>{orderingDisabledLabel}</Text>
              ) : isJustAdded ? (
                <>
                  <Check size={15} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={recipeCardStyles.addBtnText}>Added</Text>
                </>
              ) : (
                <>
                  <ShoppingBag size={15} color="#FFFFFF" />
                  <Text style={recipeCardStyles.addBtnText}>Add to Bowl</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

interface RecipeReviewCardProps {
  review: ProductReview;
  idx: number;
  recipeName: string;
  recipeImage?: string | null;
  onInspect: (review: ProductReview) => void;
}

export const RecipeReviewCard = memo(function RecipeReviewCard({
  review,
  idx,
  recipeName,
  recipeImage,
  onInspect,
}: RecipeReviewCardProps) {
  const displayImg =
    review.image_url ||
    recipeImage ||
    DEFAULT_DOG_IMAGES[idx % DEFAULT_DOG_IMAGES.length];
  const authorName = review.user?.first_name
    ? `${review.user.first_name} ${review.user.last_name || ''}`.trim()
    : 'Pet Parent';

  return (
    <TouchableOpacity
      style={recipeCardStyles.recipeReviewCard}
      onPress={() => onInspect(review)}
      activeOpacity={0.88}
    >
      {/* Top Image with Badge */}
      <View style={recipeCardStyles.recipeReviewImgWrap}>
        <Image
          source={{ uri: getOptimizedImageUrl(displayImg, IMAGE_SIZE.reviewCard, IMAGE_SIZE.reviewCard) }}
          style={recipeCardStyles.recipeReviewImg as any}
          contentFit="cover"
        />
        <View style={recipeCardStyles.recipeReviewBadge}>
          <CheckCircle2 size={10} color="#047857" />
          <Text style={recipeCardStyles.recipeReviewBadgeText}>Verified Meal</Text>
        </View>
      </View>

      {/* Centered 5 Emerald Stars */}
      <View style={recipeCardStyles.recipeReviewStarRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={15}
            color="#00B67A"
            fill={s <= review.rating ? '#00B67A' : '#E5E7EB'}
          />
        ))}
      </View>

      {/* Centered Italicized Quote */}
      <Text style={recipeCardStyles.recipeReviewQuoteText} numberOfLines={3}>
        "{review.comment || 'good one very one can buy this product'}"
      </Text>

      {/* Footer with Divider, Author, Verified Badge & Recipe Name */}
      <View style={recipeCardStyles.recipeReviewFooter}>
        <View style={recipeCardStyles.recipeReviewAuthorRow}>
          <Text style={recipeCardStyles.recipeReviewAuthorName} numberOfLines={1}>
            {authorName}
          </Text>
          {review.is_verified_buyer && <CheckCircle2 size={13} color="#00B67A" />}
        </View>
        <Text style={recipeCardStyles.recipeReviewRecipeTag} numberOfLines={1}>
          RECIPE: {recipeName.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export const recipeCardStyles = StyleSheet.create({
  /* Notebook Grid Product Tile */
  /* Product card: torn-edge photo block on top, content block below — each
     its own section — with a floating (elevated) ambient drop shadow. Sits
     in a two-column (wider on tablets) grid, so it shares its row via flex
     rather than claiming the full FlatList width. */
  recipeCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  imageContainer: { width: '100%', aspectRatio: 1, position: 'relative' },
  recipeImage: { width: '100%', height: '100%' },
  imageOutOfStockDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(249,246,240,0.6)' },
  // The zigzag "torn page" strip sits flush against the photo's bottom edge,
  // filled in the card's own background so it reads as a tear, not a stripe.
  tornEdge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stockBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  stockBadgeLow: { backgroundColor: COLORS.accentRed },
  stockBadgeOut: { backgroundColor: COLORS.textLight },
  stockDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF' },
  stockBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },
  categoryTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    maxWidth: '60%',
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontFamily: FONT_BODY_BOLD,
  },

  cardContent: { padding: 12, paddingTop: 12, gap: 4 },
  recipeTitle: { fontSize: 14.5, lineHeight: 18, color: COLORS.textCoffee, fontFamily: FONT_DISPLAY_SEMIBOLD },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  footerRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
  },
  priceText: { fontSize: 16, fontWeight: '800', color: COLORS.textCoffee, fontFamily: LEDGER_MONO },
  unitText: { fontSize: 10.5, color: COLORS.textMuted, fontFamily: FONT_BODY },
  addBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 20,
  },
  addBtnText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },
  addBtnSuccess: { backgroundColor: COLORS.successGreen },
  addBtnDisabled: { backgroundColor: COLORS.kraftBorder, paddingHorizontal: 12 },
  addBtnDisabledText: { fontSize: 11.5, fontWeight: '800', color: COLORS.textMuted, fontFamily: FONT_BODY_BOLD },

  /* Recipe Card In-Place Quantity Stepper */
  cardStepperWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.forestGreen,
    borderRadius: 20,
    paddingHorizontal: 5,
    height: 40,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardStepperWrapperBusy: { opacity: 0.6 },
  cardStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStepperQty: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 22,
    textAlign: 'center',
    fontFamily: LEDGER_MONO,
  },
  cardStepperQtyBusy: { minWidth: 22 },
  recipeReviewCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#EBE0D0',
    padding: 12,
    gap: 10,
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  recipeReviewImgWrap: {
    width: '100%',
    height: 155,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5EFE6',
  },
  recipeReviewImg: {
    width: '100%',
    height: 155,
  },
  recipeReviewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recipeReviewBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#047857',
    fontFamily: FONT_BODY_BOLD,
  },
  recipeReviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  recipeReviewQuoteText: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: COLORS.textCoffee,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
    fontFamily: FONT_BODY,
  },
  recipeReviewFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE9',
    paddingTop: 8,
    gap: 3,
    alignItems: 'center',
  },
  recipeReviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recipeReviewAuthorName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: FONT_BODY_BOLD,
  },
  recipeReviewRecipeTag: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: LEDGER_MONO,
  },
});
