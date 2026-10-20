import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

interface FeaturePrivacyNoteProps {
  children: React.ReactNode;
}

// A short, feature-specific privacy blurb — grounded in the matching
// section of /privacy, not a paraphrase of the whole policy. Drop one of
// these into any screen that collects or processes a distinct category of
// data (a photo, a payment, a location, an AI conversation); the full
// policy itself stays the single place with the complete picture.
export const FeaturePrivacyNote: React.FC<FeaturePrivacyNoteProps> = ({ children }) => (
  <div className="flex items-start gap-2.5 border border-cardboard bg-paper rounded-sm px-3.5 py-3">
    <ShieldCheck className="w-3.5 h-3.5 text-ink text-opacity-50 shrink-0 mt-0.5" />
    <p className="font-body text-xs text-ink text-opacity-70 leading-relaxed">
      {children}{' '}
      <Link to="/privacy" className="font-bold text-ink text-opacity-90 hover:text-turmeric whitespace-nowrap">
        Full Privacy Policy →
      </Link>
    </p>
  </div>
);
