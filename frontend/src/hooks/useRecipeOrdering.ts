import { useFeatureFlag, useFeatureFlagFallback } from './useFeatureFlag';

// Whether a recommended recipe can be ordered right now, for places that suggest a product (the calorie
// calculator). 'on' = normal add-to-cart; 'teaser' = ordering is hidden or marked coming soon, so the recipe is
// shown blurred behind a "Coming soon" band; 'unavailable' = ordering is temporarily off, shown with that label.
// While the flags load the shop counts as on, so nothing flashes.
export function useRecipeOrdering(): 'on' | 'teaser' | 'unavailable' {
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const shopFallback = useFeatureFlagFallback('shop_checkout');
  if (isShopEnabled) return 'on';
  return shopFallback === 'unavailable' ? 'unavailable' : 'teaser';
}
