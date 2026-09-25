import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock, AlertCircle } from 'lucide-react';

interface FeaturePlaceholderCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  variant: 'coming_soon' | 'unavailable';
}

// Disabled-state sibling of the feature cards in HomePage's "Explore the
// Ecosystem" grid — same shape (border/padding/rounded/shadow) so it reads
// as a natural part of that grid rather than a mismatched insert, but
// grayscale and non-interactive, matching DESIGN.md's existing "Deactivated
// Action" treatment (bg-cardboard bg-opacity-35, disabled click state)
// rather than inventing a new disabled pattern.
export const FeaturePlaceholderCard: React.FC<FeaturePlaceholderCardProps> = ({
  icon: Icon,
  title,
  description,
  variant,
}) => {
  const isComingSoon = variant === 'coming_soon';

  return (
    <div className="border border-cardboard bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 shadow-sm relative overflow-hidden cursor-default">
      <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-cardboard bg-opacity-35 rounded-[12px]">
        <Icon className="w-6 h-6 text-ink opacity-40" />
      </div>
      <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink opacity-60">{title}</h3>
      <p className="font-body text-xs sm:text-sm text-ink opacity-50 leading-relaxed">{description}</p>
      <div
        className={`inline-flex items-center space-x-1.5 font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-sm ${
          isComingSoon ? 'bg-turmeric bg-opacity-15 text-turmeric' : 'bg-paprika bg-opacity-10 text-paprika'
        }`}
      >
        {isComingSoon ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
        <span>{isComingSoon ? 'Coming Soon' : 'Temporarily Unavailable'}</span>
      </div>
    </div>
  );
};
