import { HeroScrollHint } from './HeroScrollHint';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';
import { Eyebrow } from './Eyebrow';
import { useDocumentMetadata } from '../hooks/useDocumentMetadata';
import { useStructuredData } from '../hooks/useStructuredData';

export interface FeatureHighlight {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface FeatureStep {
  title: string;
  text: string;
}

export interface FeatureLandingPageProps {
  /** Header nav-highlight key, e.g. 'pets'. */
  activeTab?: 'shop' | 'pets' | 'consultations' | 'orders' | 'assistant' | 'profile' | 'admin' | 'doctor' | 'apply-doctor' | 'support' | 'blog';
  eyebrow: string;
  title: string;
  /** A word or short phrase from `title` to render in the turmeric accent -- must appear verbatim inside `title`. */
  titleHighlight?: string;
  subtitle: string;
  heroImage: { src: string; alt: string };
  ctaLabel: string;
  ctaPath: string;
  metaTitle: string;
  metaDescription: string;
  highlights: FeatureHighlight[];
  steps?: FeatureStep[];
  closingHeadline: string;
  closingText: string;
}

function renderTitle(title: string, highlight?: string) {
  if (!highlight) return title;
  const index = title.indexOf(highlight);
  if (index === -1) return title;
  return (
    <>
      {title.slice(0, index)}
      <span className="text-turmeric">{highlight}</span>
      {title.slice(index + highlight.length)}
    </>
  );
}

// A reusable static explainer page: a feature's hero, what-it-does
// highlights, and a CTA into the real (often auth-gated) tool. Entry points
// from the header/homepage land here first rather than on the gated tool
// directly, so a logged-out visitor -- or a crawler -- gets real content
// and a clear next step instead of bouncing off a login wall.
export function FeatureLandingPage({
  activeTab,
  eyebrow,
  title,
  titleHighlight,
  subtitle,
  heroImage,
  ctaLabel,
  ctaPath,
  metaTitle,
  metaDescription,
  highlights,
  steps,
  closingHeadline,
  closingText,
}: FeatureLandingPageProps) {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);

  useDocumentMetadata(metaTitle, metaDescription);

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: metaTitle,
    description: metaDescription,
    url: window.location.origin + window.location.pathname,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Hearth & One',
      url: window.location.origin,
    },
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab={activeTab} onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero -- static, no carousel */}
      <section data-scroll-hero className="relative px-4 sm:px-6 md:px-8 pt-14 pb-28 md:pt-20 md:pb-28">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-center">
          <div className="space-y-6">
            <Eyebrow label={eyebrow} />
            <h1 className="font-script font-normal text-4xl sm:text-5xl lg:text-6xl tracking-normal text-ink leading-snug">
              {renderTitle(title, titleHighlight)}
            </h1>
            <p className="font-body text-sm sm:text-base text-ink opacity-75 leading-relaxed max-w-lg">
              {subtitle}
            </p>
            <button
              onClick={() => navigate(ctaPath)}
              className="inline-flex items-center gap-2 bg-paprika hover:bg-opacity-90 text-paperLight font-display font-bold text-sm uppercase tracking-wide px-7 py-3.5 rounded-sm transition-all cursor-pointer shadow-xs"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="aspect-square rounded-md overflow-hidden border border-cardboard">
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
        <HeroScrollHint light />
      </section>

      {/* Highlights */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-paperLight border-y border-cardboard border-opacity-40">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {highlights.map(({ icon: Icon, title: hTitle, text }) => (
              <div
                key={hTitle}
                className="border border-cardboard border-opacity-60 bg-paper rounded-sm p-6 space-y-3"
              >
                <div className="w-10 h-10 rounded-full bg-herb bg-opacity-15 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-paprika" strokeWidth={1.6} />
                </div>
                <h3 className="font-display font-bold text-base text-ink">{hTitle}</h3>
                <p className="font-body text-sm text-ink opacity-75 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      {steps && steps.length > 0 && (
        <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20">
          <div className="max-w-4xl mx-auto">
            <Eyebrow label="How It Works" />
            <div className="mt-8 space-y-8">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-5 items-start">
                  <span className="font-mono text-xs font-bold text-turmeric border border-turmeric border-opacity-40 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-base text-ink">{step.title}</h3>
                    <p className="font-body text-sm text-ink opacity-75 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Closing CTA band */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-ink text-paper text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight">{closingHeadline}</h2>
          <p className="font-body text-sm text-paper opacity-75 leading-relaxed">{closingText}</p>
          <button
            onClick={() => navigate(ctaPath)}
            className="inline-flex items-center gap-2 bg-turmeric hover:bg-opacity-90 text-ink font-display font-bold text-sm uppercase tracking-wide px-7 py-3.5 rounded-sm transition-all cursor-pointer"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Hearth & One. All rights reserved.
        </p>
      </footer>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
