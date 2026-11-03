import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock } from 'lucide-react';
import { Header } from './Header';

interface RouteUnavailableProps {
  variant: 'coming_soon' | 'unavailable';
  activeTab?: 'shop' | 'pets' | 'consultations' | 'orders' | 'assistant' | 'profile' | 'admin' | 'doctor' | 'apply-doctor' | 'support' | 'blog';
  title: string;
  // Optional: pass nothing to show only the status (title) and no explanatory text.
  description?: string;
  // Defaults keep the old behaviour ("Return to Shop"). The Shop and Vet status pages use Home instead.
  actionLabel?: string;
  actionPath?: string;
}

// Full-page sibling of FeaturePlaceholderCard's visual language (same
// icon/badge treatment), for routes that are entirely one flagged feature
// rather than a page with a few optional sections -- see useRouteFeatureGate.
export const RouteUnavailable: React.FC<RouteUnavailableProps> = ({ variant, activeTab, title, description, actionLabel = 'Return to Shop', actionPath = '/shop/app' }) => {
  const navigate = useNavigate();
  const isComingSoon = variant === 'coming_soon';
  const Icon = isComingSoon ? Clock : AlertCircle;

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab={activeTab} />
      <main className="flex-grow max-w-3xl w-full mx-auto px-4 py-24 text-center space-y-5">
        <div className="w-16 h-16 mx-auto flex items-center justify-center border border-dashed border-cardboard bg-cardboard bg-opacity-35 rounded-[16px]">
          <Icon className={`w-8 h-8 ${isComingSoon ? 'text-turmeric' : 'text-paprika'}`} />
        </div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-ink">{title}</h1>
        {description && (
          <p className="font-body text-sm text-ink opacity-60 max-w-md mx-auto leading-relaxed">{description}</p>
        )}
        <button
          onClick={() => navigate(actionPath)}
          className="font-mono text-xs uppercase tracking-wider font-bold text-paper bg-ink px-5 py-2.5 rounded-sm hover:bg-opacity-90 transition-colors"
        >
          {actionLabel}
        </button>
      </main>
    </div>
  );
};
