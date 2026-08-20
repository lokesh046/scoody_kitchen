import React from 'react';
import type { ProductResponse } from '../types/product';
import { IngredientLedger, getIngredientsForProduct } from './IngredientLedger';
import { Bone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecipeCardProps {
  product: ProductResponse;
  onAddToCart?: (productId: number) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ product, onAddToCart }) => {
  const navigate = useNavigate();
  const ingredients = getIngredientsForProduct(product.id, product.name);

  // Canine-themed fallback SVG illustration
  const imageUrl = product.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23FAF6EC"/><path d="M 0,20 L 300,20 M 0,40 L 300,40 M 0,60 L 300,60 M 0,80 L 300,80 M 0,100 L 300,100 M 0,120 L 300,120 M 0,140 L 300,140 M 0,160 L 300,160 M 0,180 L 300,180" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><g transform="translate(110, 45)" fill="none" stroke="%234B6B3A" stroke-width="2"><path d="M10 50 L70 50 L60 25 L20 25 Z" stroke-linejoin="round"/><ellipse cx="40" cy="25" rx="20" ry="5"/><circle cx="35" cy="21" r="2" fill="%234B6B3A"/><circle cx="45" cy="22" r="2.5" fill="%234B6B3A"/><circle cx="40" cy="19" r="1.5" fill="%234B6B3A"/><path d="M 12 10 Q 5 5 0 10 Q -5 15 0 20 Q 5 25 12 20 L 68 20 Q 75 25 80 20 Q 85 15 80 10 Q 75 5 68 10 Z" transform="translate(-5, -20) rotate(-15 40 25)"/></g><text x="50%" y="80%" font-family="monospace" font-size="11" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 SCOOBY’S KITCHEN 🐾</text><text x="50%" y="90%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Canine Tested Recipe</text></svg>';

  return (
    <div className="border border-cardboard bg-paperLight flex flex-col shadow-sm hover-paper-lift animate-fade-in-up rounded-sm">
      {/* Product Image Area */}
      <div 
        onClick={() => navigate(`/product/${product.id}`)}
        className="torn-edge relative w-full aspect-[4/3] bg-paper overflow-hidden border-b border-cardboard cursor-pointer"
      >
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-300"
          loading="lazy"
        />
        {/* Category Tag */}
        {product.category?.name && (
          <div className="absolute top-4 left-4 bg-herb text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
            {product.category.name}
          </div>
        )}
        {/* Canine Approved Stamp */}
        <div className="absolute top-4 right-4 bg-turmeric text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm flex items-center space-x-1 shadow-sm">
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
              ${parseFloat(product.price).toFixed(2)}
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
          onClick={() => onAddToCart && onAddToCart(product.id)}
          className="w-full mt-5 bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs py-2.5 rounded-sm tracking-wide uppercase shadow-sm hover-bounce"
        >
          Shop the Recipe
        </button>
      </div>
    </div>
  );
};
