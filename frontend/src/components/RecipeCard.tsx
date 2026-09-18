import React from 'react';
import type { ProductResponse } from '../types/product';
import { IngredientLedger, getIngredientsForProduct } from './IngredientLedger';
import { Bone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecipeCardProps {
  product: ProductResponse;
  onAddToCart?: (productId: number) => Promise<void> | void;
}

export const RecipeCard: React.FC<RecipeCardProps> = React.memo(({ product, onAddToCart }) => {
  const navigate = useNavigate();
  const ingredients = getIngredientsForProduct(product.id, product.name);

  const [isAdding, setIsAdding] = React.useState(false);
  const [isAdded, setIsAdded] = React.useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddToCart) return;
    setIsAdding(true);
    const startTime = Date.now();
    try {
      await onAddToCart(product.id);
      
      // Enforce minimum loading time of 600ms for visual feedback
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 600 - elapsedTime);
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  // Canine-themed fallback SVG illustration
  const imageUrl = product.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23FAF6EC"/><path d="M 0,20 L 300,20 M 0,40 L 300,40 M 0,60 L 300,60 M 0,80 L 300,80 M 0,100 L 300,100 M 0,120 L 300,120 M 0,140 L 300,140 M 0,160 L 300,160 M 0,180 L 300,180" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><g transform="translate(110, 45)" fill="none" stroke="%234B6B3A" stroke-width="2"><path d="M10 50 L70 50 L60 25 L20 25 Z" stroke-linejoin="round"/><ellipse cx="40" cy="25" rx="20" ry="5"/><circle cx="35" cy="21" r="2" fill="%234B6B3A"/><circle cx="45" cy="22" r="2.5" fill="%234B6B3A"/><circle cx="40" cy="19" r="1.5" fill="%234B6B3A"/><path d="M 12 10 Q 5 5 0 10 Q -5 15 0 20 Q 5 25 12 20 L 68 20 Q 75 25 80 20 Q 85 15 80 10 Q 75 5 68 10 Z" transform="translate(-5, -20) rotate(-15 40 25)"/></g><text x="50%" y="80%" font-family="monospace" font-size="11" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 SCOOBY’S KITCHEN 🐾</text><text x="50%" y="90%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Canine Tested Recipe</text></svg>';

  return (
    <div className="border border-cardboard bg-paperLight flex flex-col shadow-sm hover-paper-lift animate-fade-in-up rounded-[4px]">
      {/* Product Image Area */}
      <div 
        onClick={() => navigate(`/product/${product.id}`)}
        className="torn-edge relative w-full aspect-[4/3] bg-paper overflow-hidden border-b border-cardboard cursor-pointer"
      >
        <img
          src={imageUrl}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-300 ${
            !product.is_active ? 'grayscale opacity-50' : 'hover:scale-[1.03]'
          }`}
          loading="lazy"
        />
        {/* Category Tag */}
        {product.category?.name && (
          <div className="absolute top-4 left-4 bg-herb text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-[3px]">
            {product.category.name}
          </div>
        )}
        {/* Deactivated Tag */}
        {!product.is_active && (
          <div className="absolute top-4 left-4 mt-7 bg-turmeric text-ink font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-[3px] font-bold shadow-sm animate-pulse">
            Deactivated
          </div>
        )}
        {/* Canine Approved Stamp */}
        <div className="absolute top-4 right-4 bg-turmeric text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-[3px] flex items-center space-x-1 shadow-sm">
          <Bone className="w-2.5 h-2.5" />
          <span>Dog Tested</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex-grow flex flex-col justify-between">
        <div>
          {/* Header Info */}
          <div className="flex justify-between items-start mb-2 gap-2">
            <h4 
              onClick={() => navigate(`/product/${product.id}`)}
              className="font-display font-bold text-lg text-ink line-clamp-2 text-left leading-snug cursor-pointer hover:text-turmeric transition-colors"
            >
              {product.name}
            </h4>
            <span className="font-mono font-bold text-turmeric text-base whitespace-nowrap">
              ₹{parseFloat(product.price).toFixed(2)}
            </span>
          </div>

          <p className="text-ink text-sm opacity-80 text-left line-clamp-3 mb-4 leading-relaxed font-body">
            {product.description || 'Crafted with premium ingredients in small batches, tested over 7 years for ultimate pet health.'}
          </p>
        </div>

        {/* The Signature Ingredient Ledger */}
        <IngredientLedger ingredients={ingredients} />

        {/* Action Button */}
        <button
          onClick={handleAdd}
          disabled={isAdding || !product.is_active}
          className={`w-full mt-5 font-body font-bold text-xs py-2.5 rounded-[4px] tracking-wide uppercase shadow-sm flex items-center justify-center space-x-1.5 transition-all duration-300 ${
            !product.is_active
              ? 'bg-cardboard bg-opacity-35 text-ink text-opacity-50 cursor-not-allowed border border-cardboard border-opacity-30'
              : isAdded
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-turmeric hover:bg-opacity-95 text-ink hover-bounce'
          } disabled:opacity-50`}
        >
          {isAdding ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Adding...</span>
            </>
          ) : isAdded ? (
            <span>Added! 🐾</span>
          ) : !product.is_active ? (
            <span>Deactivated</span>
          ) : (
            <span>Shop the Recipe</span>
          )}
        </button>
      </div>
    </div>
  );
});

RecipeCard.displayName = 'RecipeCard';
