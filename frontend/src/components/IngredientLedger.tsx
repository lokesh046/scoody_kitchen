import React from 'react';
import type { Ingredient } from '../types/product';

// Mock ingredients mapping helper
export const getIngredientsForProduct = (productId: number, productName: string): Ingredient[] => {
  const lowerName = productName.toLowerCase();
  if (lowerName.includes('chicken')) {
    return [
      { name: 'Human-Grade Chicken', percentage: 65 },
      { name: 'Organic Sweet Potatoes', percentage: 15 },
      { name: 'Fresh Spinach & Kelp', percentage: 10 },
      { name: 'Cold-Pressed Flaxseed Oil', percentage: 5 },
      { name: 'Essential Mineral Blend', percentage: 5 },
    ];
  }
  if (lowerName.includes('beef')) {
    return [
      { name: 'Premium Ground Beef', percentage: 60 },
      { name: 'Organic Carrots', percentage: 20 },
      { name: 'Dandelion Greens & Blueberries', percentage: 10 },
      { name: 'Sardine Oil (Omega-3)', percentage: 5 },
      { name: 'Calcium & Vitamin Mix', percentage: 5 },
    ];
  }
  if (lowerName.includes('salmon') || lowerName.includes('fish')) {
    return [
      { name: 'Wild-Caught Salmon', percentage: 58 },
      { name: 'Whole Brown Rice', percentage: 22 },
      { name: 'Steam-Cooked Peas', percentage: 12 },
      { name: 'Organic Cranberries', percentage: 4 },
      { name: 'Trace Mineral Ledger', percentage: 4 },
    ];
  }
  if (lowerName.includes('turkey')) {
    return [
      { name: 'Cage-Free Turkey Meat', percentage: 62 },
      { name: 'Butternut Squash', percentage: 18 },
      { name: 'Organic Kelp Meal', percentage: 10 },
      { name: 'Cold-Pressed Sunflower Oil', percentage: 6 },
      { name: 'Nutritional Yeast Blend', percentage: 4 },
    ];
  }
  // Generic fallback based on product id
  const variations = [
    [
      { name: 'Human-Grade Chicken', percentage: 65 },
      { name: 'Organic Sweet Potatoes', percentage: 15 },
      { name: 'Fresh Spinach & Kelp', percentage: 10 },
      { name: 'Cold-Pressed Flaxseed Oil', percentage: 5 },
      { name: 'Essential Mineral Ledger', percentage: 5 },
    ],
    [
      { name: 'Wild-Caught Salmon', percentage: 58 },
      { name: 'Whole Brown Rice', percentage: 22 },
      { name: 'Steam-Cooked Peas', percentage: 12 },
      { name: 'Organic Cranberries', percentage: 4 },
      { name: 'Trace Mineral Ledger', percentage: 4 },
    ],
    [
      { name: 'Premium Ground Beef', percentage: 60 },
      { name: 'Organic Carrots', percentage: 20 },
      { name: 'Dandelion Greens & Blueberries', percentage: 10 },
      { name: 'Sardine Oil (Omega-3)', percentage: 5 },
      { name: 'Calcium & Vitamin Mix', percentage: 5 },
    ]
  ];
  return variations[productId % variations.length];
};

interface IngredientLedgerProps {
  ingredients: Ingredient[];
}

export const IngredientLedger: React.FC<IngredientLedgerProps> = ({ ingredients }) => {
  return (
    <div className="border-t border-dashed border-cardboard pt-4 mt-4 text-left">
      {/* Title with letter spacing and trailing rule */}
      <div className="flex items-center space-x-2 mb-3">
        <span className="font-mono text-[10px] font-bold tracking-widest text-herb uppercase">
          INGREDIENT LEDGER
        </span>
        <span className="flex-grow h-[1px] bg-cardboard opacity-50"></span>
      </div>

      {/* Ingredient percentages with dotted divider */}
      <div className="space-y-2 font-mono text-xs">
        {ingredients.map((ing, idx) => (
          <div key={idx} className="flex justify-between items-end relative overflow-hidden">
            <span className="bg-paperLight pr-2 text-ink z-10 relative">{ing.name}</span>
            {/* The dotted divider expands between name and percentage */}
            <span className="flex-grow border-b border-dotted border-cardboard h-3 mx-1 z-0 relative"></span>
            <span className="bg-paperLight pl-2 font-bold text-ink z-10 relative">{ing.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
