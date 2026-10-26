import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Heart, Shield, Sparkles, ChevronRight,
  Activity, Database, ArrowRight, Check,
  Image as ImageIcon
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts } from '../../api/products';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';
import { SiteFooter } from '../../components/SiteFooter';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import { HomeBannerCarousel } from '../../components/HomeBannerCarousel';
import { FullscreenHomeHero } from '../../components/FullscreenHomeHero';
import { HoundPortalReveal } from '../../components/HoundPortalReveal';
import { ReviewsCarousel } from '../../components/ReviewsCarousel';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useFeatureFlag, useFeatureFlagFallback, useFeatureFlags } from '../../hooks/useFeatureFlag';
import { FeaturePlaceholderCard } from '../../components/FeaturePlaceholderCard';
import { FAQSection, FAQ_QUERY_KEY } from '../../components/FAQSection';
import { JournalPreviewSection } from '../../components/JournalPreviewSection';
import { useToolkitOverrides } from '../../hooks/useAdminContent';
import { fetchActiveFaqs } from '../../api/faqs';
import type { FAQResponse } from '../../types/faq';

interface QuickPreset {
  label: string;
  weight: number;
  activity: 'sedentary' | 'active' | 'very_active';
}

const DOG_PRESETS: QuickPreset[] = [
  { label: 'Toy / Small (12 lbs)', weight: 12, activity: 'active' },
  { label: 'Medium Breed (35 lbs)', weight: 35, activity: 'active' },
  { label: 'Large Breed (65 lbs)', weight: 65, activity: 'active' },
  { label: 'Working / Giant (90 lbs)', weight: 90, activity: 'very_active' },
];

export default function HomePage() {
  const { hash } = useLocation();
  useEffect(() => {
    const id = hash.slice(1);
    if (!['fit-calculator', 'hearth-hound', 'faq'].includes(id)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  useDocumentMetadata(
    "Honest Small-Batch Pet Cooking",
    "Human-grade, small-batch pet food cooked under veterinary supervision. Transparent recipes for pet parents who care."
  );

  // Shares react-query's cache with FAQSection's own useQuery call (same
  // key) so this doesn't fire a second network request just to build the
  // FAQPage structured-data block below.
  const { data: faqsForSchema = [] } = useQuery<FAQResponse[]>({
    queryKey: FAQ_QUERY_KEY,
    queryFn: () => fetchActiveFaqs(),
    staleTime: 1000 * 60 * 10,
  });

  // useStructuredData only supports one JSON-LD block per page (fixed
  // script id), so Organization and FAQPage are combined into a single
  // @graph instead of each feature calling the hook independently.
  useStructuredData({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: "Hearth & One",
        url: 'https://hearthandone.com/',
        logo: 'https://hearthandone.com/images/scooby_logo.png',
      },
      ...(faqsForSchema.length > 0
        ? [{
            '@type': 'FAQPage',
            mainEntity: faqsForSchema.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          }]
        : []),
    ],
  });

  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // Feature Flags
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isFullscreenHeroEnabled = useFeatureFlag('home_fullscreen_hero', false);
  const toolkitOverrides = useToolkitOverrides();
  // This teaser must be explicitly enabled in Admin, even in beta builds
  // that force the platform's other features on.
  const { data: adminFeatureFlags, isError: featureFlagsError } = useFeatureFlags();
  const isRecipeComingSoonEnabled = !featureFlagsError && adminFeatureFlags?.home_recipe_coming_soon?.enabled === true;
  const consultationsFallback = useFeatureFlagFallback('consultations_booking');
  const chatbotFallback = useFeatureFlagFallback('ai_chatbot');
  const shopFallback = useFeatureFlagFallback('shop_checkout');
  const mealPlannerFallback = useFeatureFlagFallback('shop_meal_planner');
  const knowYourPetFallback = useFeatureFlagFallback('pets_know_your_pet');

  // Auth Store
  const { user } = useAuthStore();

  // Calculator State
  const [dogName, setDogName] = useState('');
  const [dogWeight, setDogWeight] = useState<number | ''>(35);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'active' | 'very_active'>('active');
  const [isAddingRecommended, setIsAddingRecommended] = useState(false);
  const [isAddedRecommended, setIsAddedRecommended] = useState(false);

  // Toolkit cards animate in only once the section is actually scrolled
  // into view, not on initial page mount (which would finish playing
  // before the visitor ever scrolls down to see it).
  const toolkitGridRef = useRef<HTMLDivElement>(null);
  const [isToolkitVisible, setIsToolkitVisible] = useState(false);
  useEffect(() => {
    const node = toolkitGridRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsToolkitVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Optimized Query - Fetch limited active products for slider and featured sections
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => fetchProducts({ limit: 12 }),
    staleTime: 5 * 60 * 1000,
  });

  const featuredProducts = useMemo(() => {
    return productsData?.items?.filter((p) => p.is_active)?.slice(0, 3) || [];
  }, [productsData]);

  const handleAddToCart = async (productId: number) => {
    if (!isShopEnabled) return; // safety net — RecipeCard's own button is already disabled in this case
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await addItem(productId, 1);
    } catch (err) {
      console.error('Failed to add item to cart:', err);
    }
  };

  // Memoized Daily Calorie & Recommended Product calculation
  const calcResult = useMemo(() => {
    if (!dogWeight || Number(dogWeight) <= 0) return null;

    const weightInKg = Number(dogWeight) * 0.45359237;
    // RER (Resting Energy Requirement) = 70 * (weight in kg)^0.75
    const rer = 70 * Math.pow(weightInKg, 0.75);

    // MER factor based on activity
    let factor = 1.4;
    if (activityLevel === 'sedentary') factor = 1.0;
    if (activityLevel === 'very_active') factor = 1.8;

    const dailyCalories = Math.round(rer * factor);

    let recProduct = null;
    if (productsData?.items && productsData.items.length > 0) {
      const items = productsData.items;
      if (activityLevel === 'very_active') {
        recProduct = items.find((p) => p.name.toLowerCase().includes('beef')) || items[0];
      } else if (Number(dogWeight) < 18) {
        recProduct = items.find((p) => p.name.toLowerCase().includes('salmon') || p.name.toLowerCase().includes('fish')) || items[0];
      } else {
        recProduct = items.find((p) => p.name.toLowerCase().includes('chicken')) || items[0];
      }
    }

    return {
      calories: dailyCalories,
      recommendedProduct: recProduct,
    };
  }, [dogWeight, activityLevel, productsData]);

  const handleApplyPreset = useCallback((preset: QuickPreset) => {
    setDogWeight(preset.weight);
    setActivityLevel(preset.activity);
  }, []);

  const handleAddRecommended = async (productId: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setIsAddingRecommended(true);
    try {
      await addItem(productId, 1);
      setIsAddedRecommended(true);
      setTimeout(() => setIsAddedRecommended(false), 2000);
    } catch (err) {
      console.error('Failed to add recommended product:', err);
    } finally {
      setIsAddingRecommended(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {isFullscreenHeroEnabled ? (
        <>
          {/* Transparent over the hero, crossfades to the normal solid ink
              bar once scrolled past it -- stays pinned to the top throughout. */}
          <Header floatingUntilScroll onCartToggle={() => setIsCartOpen(true)} />
          <FullscreenHomeHero />
        </>
      ) : (
        <Header onCartToggle={() => setIsCartOpen(true)} />
      )}

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        {/* Centered Peeking Banner Carousel */}
        {!isFullscreenHeroEnabled && <HomeBannerCarousel />}

        {/* ============== Black & Gold homepage (home_fullscreen_hero on) ============== */}
        {isFullscreenHeroEnabled && (
          <>
            {/* Why Hearth & One */}
            <section className="relative bg-obsidian py-20 md:py-28 px-4 sm:px-6 md:px-8">
              <div className="max-w-7xl mx-auto text-left space-y-16">
                <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
                  <span className="w-6 h-[1px] bg-turmeric opacity-70"></span>
                  <span>Why Hearth &amp; One</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-center">
                  <div className="space-y-6">
                    <h2 className="font-script font-normal text-4xl sm:text-5xl lg:text-6xl tracking-normal text-ink leading-snug">
                      Bringing the pieces of pet care together.
                    </h2>
                    <p className="font-body text-base text-ink opacity-70 leading-relaxed max-w-md">
                      Everything works better when it's <span className="text-turmeric italic">connected.</span>
                    </p>
                  </div>
                  {/* Placeholder -- swap the src below for your own image */}
                  <div className="relative h-[220px] sm:h-[260px] lg:h-[300px] rounded-[4px] border border-dashed border-ink border-opacity-25 flex flex-col items-center justify-center gap-2.5 text-ink text-opacity-40">
                    <ImageIcon className="w-7 h-7" strokeWidth={1.2} />
                    <span className="font-mono text-[10px] uppercase tracking-wider">Add Your Image Here</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink divide-opacity-10 gap-10 md:gap-0 pt-4">
                  {[
                    { img: '/images/why-section/care.webp', title: 'Care', text: "We believe every companion deserves thoughtful attention to their everyday needs, health, and well-being." },
                    { img: '/images/why-section/clarity.webp', title: 'Clarity', text: "We make it easier to find useful information and navigate everyday pet-care decisions with confidence." },
                    { img: '/images/why-section/connection.webp', title: 'Connection', text: "We bring complementary pet-care tools together in one ecosystem, helping pet parents navigate different needs in one place." },
                  ].map(({ img, title, text }) => (
                    <div key={title} className="flex flex-col items-center text-center space-y-5 md:px-10 pt-8 md:pt-0 first:pt-0">
                      <div className="w-32 h-32 flex items-center justify-center">
                        <img src={img} alt="" width={256} height={256} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                      </div>
                      <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
                      <p className="font-body text-sm text-ink opacity-65 leading-relaxed max-w-xs">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Pet-care toolkit teaser */}
            <section className="relative bg-gradient-to-b from-midnightCard to-midnight py-20 md:py-28 px-4 sm:px-6 md:px-8">
              <div className="max-w-7xl mx-auto text-center space-y-16">
                <div className="max-w-2xl mx-auto space-y-3">
                  <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal text-paper">
                    Your pet-care toolkit.
                  </h2>
                  <p className="font-body text-sm text-paper opacity-60">
                    Three tools, one ecosystem — built around how pet parents actually care for their companions.
                  </p>
                </div>

                <div ref={toolkitGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { link: '/pets', image: '/images/toolkit/know-your-pet.webp', title: 'Know Your Pet', text: "Create a dedicated profile for your pet and keep their key details organised and easy to access whenever you need them.", cta: 'Create Their Profile', enabled: isKnowYourPetEnabled, onClick: () => navigate('/pets'), secondaryOnClick: () => navigate('/pets') },
                    { link: '/consultations', image: '/images/toolkit/locate-vet.webp', title: 'Locate Your Vet', text: "Find veterinary clinics near you, explore available options, and make it easier to know where to turn when your companion needs professional care.", cta: 'Explore Nearby Vets', enabled: isConsultationsEnabled, onClick: () => navigate('/consultations'), secondaryOnClick: () => navigate('/consultations') },
                    { link: '/onboarding', image: '/images/toolkit/meal-planner.webp', title: 'Recipe Calculator', text: "Explore an estimate of your pet's daily energy needs, helping you better understand the nutritional considerations behind their feeding routine.", cta: 'Estimate Their Needs', enabled: isMealPlannerEnabled, onClick: () => document.getElementById('fit-calculator')?.scrollIntoView({ behavior: 'smooth' }), secondaryOnClick: () => navigate('/onboarding') },
                  ].map((card) => {
                    // Image, title and text can be replaced from the admin panel (Banners > "Home page - tool card").
                    const override = toolkitOverrides[card.link];
                    return {
                      ...card,
                      image: override?.image ?? card.image,
                      title: override?.title ?? card.title,
                      text: override?.text ?? card.text,
                    };
                  }).map(({ image, title, text, cta, enabled, onClick, secondaryOnClick }, index) => (
                    <div
                      key={title}
                      className={`group flex flex-col rounded-[4px] overflow-hidden border border-paper border-opacity-10 bg-midnightCard transition-all duration-300 hover:border-turmeric hover:border-opacity-40 hover:-translate-y-1 ${
                        isToolkitVisible ? 'animate-fade-in-up' : 'opacity-0'
                      }`}
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      {/* Placeholder -- swap for a real photo per tool */}
                      <div className="relative aspect-[4/3] border-b border-paper border-opacity-10 flex flex-col items-center justify-center gap-2 text-paper text-opacity-30 bg-midnight">
                        {image ? (
                          <div className="toolkit-icon-stage absolute inset-0" aria-hidden="true">
                            <span className="toolkit-icon-glow" />
                            <div className="toolkit-icon-turn absolute inset-0" style={{ animationDelay: `${index * -1.6}s` }}>
                              <img
                                src={image}
                                alt=""
                                width={800}
                                height={800}
                                loading="lazy"
                                className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="w-7 h-7" strokeWidth={1.2} />
                            <span className="font-mono text-[9px] uppercase tracking-wider">Add Image</span>
                          </>
                        )}
                      </div>

                      <div className="p-6 space-y-2 grow text-center">
                        <h3 className="font-display font-bold text-lg text-paper">{title}</h3>
                        <p className="font-body text-sm text-paper opacity-65 leading-relaxed">{text}</p>
                      </div>

                      <div className={`grid grid-cols-1 gap-3 p-6 pt-0 ${enabled ? 'sm:grid-cols-2' : ''}`}>
                        {enabled && (
                          <button
                            onClick={onClick}
                            className="pet-profile-cta relative isolate overflow-hidden flex items-center justify-center w-full min-w-0 h-14 bg-turmeric text-ink font-mono text-[11px] font-bold uppercase tracking-wider px-4 py-3 rounded-[4px] border border-[#E5BB8E] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_20px_rgba(208,158,107,0.15)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(208,158,107,0.35)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-midnightCard transition-all duration-300 cursor-pointer motion-reduce:transform-none"
                          >
                            <span className="relative">{cta}</span>
                          </button>
                        )}
                        <button
                          onClick={secondaryOnClick}
                          className="flex items-center justify-center w-full min-w-0 h-14 border border-paper border-opacity-25 text-paper font-mono text-[11px] font-bold uppercase tracking-wider px-4 py-3 rounded-[4px] hover:border-turmeric hover:text-turmeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-midnightCard transition-colors cursor-pointer"
                        >
                          <span className="relative">Learn More</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Signature Recipes -- Black & Gold restyle */}
            <section className="relative bg-obsidian py-20 md:py-28 px-4 sm:px-6 md:px-8">
              <div className="max-w-7xl mx-auto space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-ink border-opacity-10 pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
                      <span className="w-6 h-[1px] bg-turmeric opacity-70"></span>
                      <span>Fresh Formulations</span>
                    </div>
                    <h2 className="font-script font-normal text-4xl sm:text-5xl tracking-normal text-ink">Signature Recipes</h2>
                    <p className="font-body text-sm text-ink opacity-60">Veterinary-audited small batch recipes, cooked to biological perfection.</p>
                  </div>
                  {isShopEnabled ? (
                    <button
                      onClick={() => navigate('/shop')}
                      className="font-mono text-xs uppercase font-bold text-turmeric hover:text-ink transition-colors flex items-center space-x-1.5 cursor-pointer group"
                    >
                      <span>View Full Product Ledger</span>
                      <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  ) : shopFallback !== 'hide' ? (
                    <span className="font-mono text-xs uppercase font-bold text-ink opacity-40">
                      {shopFallback === 'coming_soon' ? 'Ordering Coming Soon' : 'Ordering Temporarily Unavailable'}
                    </span>
                  ) : null}
                </div>

                {productsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="border border-ink border-opacity-10 bg-ink bg-opacity-5 p-6 rounded-[16px] space-y-4 animate-pulse">
                        <div className="w-full aspect-[4/3] bg-ink bg-opacity-10 rounded-[12px]"></div>
                        <div className="h-6 bg-ink bg-opacity-10 w-3/4 rounded-xs"></div>
                        <div className="h-4 bg-ink bg-opacity-10 w-1/2 rounded-xs"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {featuredProducts.map((product) => (
                      <div key={product.id} className="relative">
                        <div
                          className={`h-full [&>div]:h-full ${isRecipeComingSoonEnabled ? 'pointer-events-none opacity-70' : ''}`}
                        >
                          <RecipeCard
                            product={product}
                            onAddToCart={isRecipeComingSoonEnabled ? undefined : handleAddToCart}
                            orderingDisabledLabel={
                              isRecipeComingSoonEnabled
                                ? 'Coming Soon'
                                : isShopEnabled
                                ? undefined
                                : shopFallback === 'coming_soon'
                                ? 'Coming Soon'
                                : shopFallback === 'unavailable'
                                ? 'Unavailable'
                                : 'Ordering Unavailable'
                            }
                          />
                        </div>
                        {isRecipeComingSoonEnabled && (
                          <div
                            aria-label={`${product.name}: Coming soon`}
                            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-[4px] text-center"
                          >
                            <div className="w-full border-y border-turmeric/40 bg-midnight px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                              <p className="font-script text-4xl sm:text-5xl font-normal text-turmeric">Coming soon</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Hearth & Hound -- coming soon */}
            <section id="hearth-hound" className="relative bg-obsidian py-20 md:py-28 px-4 sm:px-6 md:px-8">
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div className="order-2 lg:order-1">
                  <HoundPortalReveal />
                </div>
                <div className="space-y-6 order-1 lg:order-2">
                  <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
                    <span className="w-6 h-[1px] bg-turmeric opacity-70"></span>
                    <span>Hearth &amp; Hound · Coming Soon</span>
                  </div>
                  <h2 className="font-script text-3xl sm:text-4xl lg:text-5xl font-normal tracking-normal text-ink leading-snug">
                    Thoughtfully made for the ones who are <span className="text-turmeric">one of us.</span>
                  </h2>
                  <p className="font-body text-sm sm:text-base text-ink opacity-65 leading-relaxed max-w-md">
                    We're preparing a natural, thoughtfully crafted range of pet food with a focus on quality ingredients, sustainable practices, and pesticide-free sourcing.
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-2">
                    {['Human-Grade', 'Pesticide-Free', 'Sustainably Sourced', 'Vet-Reviewed'].map((label) => (
                      <span key={label} className="font-mono text-[10px] uppercase font-bold tracking-wider text-turmeric border border-turmeric border-opacity-40 rounded-full px-3.5 py-2">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Interactive Recipe Calculator -- Black & Gold restyle */}
            {isMealPlannerEnabled ? (
              <section
                className="bg-stone py-20 md:py-28 px-4 sm:px-6 md:px-8 relative"
                id="fit-calculator"
                style={{
                  backgroundImage: 'radial-gradient(rgba(208,158,107,0.18) 1.2px, transparent 1.2px)',
                  backgroundSize: '16px 16px',
                }}
              >
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center text-left relative z-10">
                  <div className="lg:col-span-5 space-y-5">
                    <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-ink">
                      <span className="w-6 h-[1px] bg-turmeric opacity-70"></span>
                      <span>Metabolic Sizing Engine</span>
                    </div>
                    <h2 className="font-script font-normal text-4xl sm:text-5xl lg:text-6xl tracking-normal text-ink leading-tight">
                      Recipe Fit Calculator
                    </h2>
                    <p className="font-body text-sm text-ink opacity-75 leading-relaxed">
                      Pet nutrition is directly proportional to body mass and daily energy output. Pick your dog's size or enter their exact weight to calculate targeted caloric requirements in real time.
                    </p>

                    <div className="space-y-2 pt-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-ink opacity-70 block">
                        Quick Size Presets:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {DOG_PRESETS.map((preset) => {
                          const isSelected = Number(dogWeight) === preset.weight && activityLevel === preset.activity;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleApplyPreset(preset)}
                              className={`min-h-[44px] inline-flex items-center justify-center font-mono text-[10px] uppercase px-3 py-1.5 rounded-[8px] transition-all cursor-pointer font-bold border ${
                                isSelected
                                  ? 'bg-turmeric text-ink border-turmeric shadow-xs scale-102'
                                  : 'bg-transparent text-ink opacity-80 border-ink border-opacity-20 hover:border-turmeric hover-opacity-100'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border border-dashed border-ink border-opacity-20 p-3 space-y-1 font-mono text-[11px] text-ink opacity-70 rounded-xl">
                      <p>Formula base: RER = 70 × (weight_kg)⁰·⁷⁵</p>
                      <p>Output MER = RER × activity_multiplier</p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => navigate('/onboarding')}
                        className="min-h-[44px] inline-flex items-center space-x-2 bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold px-5 py-3 rounded-[10px] tracking-wider transition-all hover-bounce cursor-pointer shadow-xs active:scale-98"
                      >
                        <span>Step-by-Step Diet Planner</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-obsidian border border-ink border-opacity-15 p-6 sm:p-8 rounded-[20px] relative">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="calc-dog-name" className="font-mono text-[10px] uppercase font-bold text-ink opacity-80 block">Dog's Name (Optional)</label>
                          <input
                            id="calc-dog-name"
                            type="text"
                            placeholder="e.g. Scooby"
                            value={dogName}
                            onChange={(e) => setDogName(e.target.value)}
                            className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-transparent font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="calc-dog-weight" className="font-mono text-[10px] uppercase font-bold text-ink opacity-80 block">Weight (lbs)</label>
                          <input
                            id="calc-dog-weight"
                            type="number"
                            placeholder="e.g. 35"
                            value={dogWeight}
                            onChange={(e) => setDogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                            min="1"
                            className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-transparent font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="calc-activity-level" className="font-mono text-[10px] uppercase font-bold text-ink opacity-80 block">Daily Activity Output</label>
                        <select
                          id="calc-activity-level"
                          value={activityLevel}
                          onChange={(e: any) => setActivityLevel(e.target.value)}
                          className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-obsidian font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all cursor-pointer"
                        >
                          <option value="sedentary">Sedentary (Couches &amp; Relaxed Walks)</option>
                          <option value="active">Active (Daily Runs, Fetch &amp; Playtime)</option>
                          <option value="very_active">Working / Sporting (Constant Agility &amp; Training)</option>
                        </select>
                      </div>
                    </div>

                    {calcResult && (
                      <div className="mt-6 border-t-2 border-dashed border-ink border-opacity-15 pt-6 space-y-4 animate-fade-in-up">
                        <div className="bg-ink bg-opacity-5 p-5 sm:p-6 border border-ink border-opacity-15 rounded-[14px] relative">
                          <div className="flex justify-between items-center pb-3 border-b border-dashed border-ink border-opacity-15">
                            <div className="text-left">
                              <span className="font-mono text-[10px] uppercase font-bold text-turmeric block flex items-center space-x-1.5">
                                <span className="w-2 h-2 rounded-full bg-turmeric animate-pulse inline-block" />
                                <span>Diagnostic Output</span>
                              </span>
                              <span className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-60">
                                SUBJECT: {dogName.trim() ? dogName.trim().toUpperCase() : 'CANINE COMPANION'} ({dogWeight} LBS)
                              </span>
                            </div>
                            <Activity className="w-5 h-5 text-turmeric shrink-0" />
                          </div>

                          <div className="flex justify-between items-center pt-3">
                            <span className="font-mono text-xs text-ink uppercase font-bold">Target Daily Demand:</span>
                            <span className="font-mono font-black text-xl sm:text-2xl text-ink">
                              {calcResult.calories} <span className="text-sm font-semibold opacity-70">kCal / day</span>
                            </span>
                          </div>
                        </div>

                        {calcResult.recommendedProduct && (
                          <div className="space-y-2.5">
                            <span className="font-mono text-[10px] uppercase font-bold text-turmeric block">
                              RECOMMENDED RECIPE FORMULATION:
                            </span>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-ink border-opacity-15 p-4 gap-4 rounded-[14px] hover:border-turmeric transition-colors">
                              <div className="flex items-center space-x-3 text-left">
                                <img
                                  src={calcResult.recommendedProduct.image_url || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=200'}
                                  alt={calcResult.recommendedProduct.name}
                                  width={56}
                                  height={56}
                                  className="w-14 h-14 object-cover border border-ink border-opacity-15 rounded-[8px] shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=200';
                                  }}
                                />
                                <div>
                                  <h4 className="font-display font-bold text-sm text-ink">{calcResult.recommendedProduct.name}</h4>
                                  <p className="font-mono text-xs text-turmeric font-bold">₹{parseFloat(calcResult.recommendedProduct.price).toFixed(2)} per lb</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (calcResult.recommendedProduct) {
                                    handleAddRecommended(calcResult.recommendedProduct.id);
                                  }
                                }}
                                disabled={isAddingRecommended}
                                className={`min-h-[44px] font-mono text-[10px] font-bold uppercase px-4 py-2.5 rounded-[8px] transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                                  isAddedRecommended
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-turmeric text-ink hover:bg-opacity-90 hover-bounce shadow-xs active:scale-98'
                                }`}
                              >
                                {isAddedRecommended ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                    <span>Added!</span>
                                  </>
                                ) : (
                                  <span>Add Recommended</span>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : mealPlannerFallback !== 'hide' ? (
              <section className="relative bg-stone py-12 px-4 sm:px-6 md:px-8 text-center">
                <div className="max-w-xl mx-auto space-y-3">
                  <h3 className="font-display font-bold text-2xl tracking-tight text-ink opacity-70">
                    Customized Canine Meal Planner
                  </h3>
                  <p className="font-body text-sm text-ink opacity-60">
                    {mealPlannerFallback === 'coming_soon'
                      ? 'Our interactive recipe calculator and personalized meal planning tool are launching soon.'
                      : 'The meal planning tool is temporarily unavailable while undergoing maintenance.'}
                  </p>
                </div>
              </section>
            ) : null}
          </>
        )}

        {!isFullscreenHeroEnabled && (
        <>
        {/* Feature Grid / Brand Philosophy */}
        <section className="bg-paper py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35">
          <div className="max-w-7xl mx-auto text-left space-y-10 animate-fade-in-up">
            <div className="max-w-2xl space-y-2">
              <Eyebrow label="OUR CORE ETHOS" />
              <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink">
                Built on Traceability
              </h2>
              <p className="font-body text-sm sm:text-base text-ink opacity-75 leading-relaxed">
                Pet nutrition is not a trade secret. Every single batch we prepare carries a transparent ledger of farm sources, bioavailable proteins, and clinical audits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="border border-cardboard bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 shadow-sm hover-paper-lift transition-all duration-300 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                    <Heart className="w-6 h-6 text-turmeric" />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">ETHOS // 01</span>
                </div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">Real Meat First</h3>
                <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                  Single-source premium proteins (Beef, Chicken, Salmon) form 80%+ of our formulations. Zero meat-meals or rendering byproducts ever make it into the bowl.
                </p>
              </div>

              <div className="border border-cardboard bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 shadow-sm hover-paper-lift transition-all duration-300 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-herb transition-colors">
                    <Shield className="w-6 h-6 text-herb" />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">ETHOS // 02</span>
                </div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">Zero Starch Fillers</h3>
                <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                  Grain-free and potato-free formulations crafted for fast bio-absorption. No synthetic preservatives, corn, soy, or wheat fillers.
                </p>
              </div>

              <div className="border border-cardboard bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 shadow-sm hover-paper-lift transition-all duration-300 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                    <Sparkles className="w-6 h-6 text-turmeric" />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">ETHOS // 03</span>
                </div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">Veterinary Oversight</h3>
                <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                  Each formula batch is reviewed and validated by certified pet nutrition specialists to ensure complete, life-stage-specific macro profiles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Product Spotlight */}
        <section className="bg-paper py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35">
          <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left border-b border-cardboard pb-6">
              <div className="space-y-2">
                <Eyebrow label="FRESH FORMULATIONS" />
                <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink">
                  Signature Recipes
                </h2>
                <p className="font-body text-sm text-ink opacity-75">
                  Veterinary-audited small batch recipes, cooked to biological perfection.
                </p>
              </div>
              {isShopEnabled ? (
                <button
                  onClick={() => navigate('/shop')}
                  className="font-mono text-xs uppercase font-bold text-turmeric hover:text-ink transition-colors flex items-center space-x-1.5 cursor-pointer group"
                >
                  <span>View Full Product Ledger</span>
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              ) : shopFallback !== 'hide' ? (
                <span className="font-mono text-xs uppercase font-bold text-ink opacity-40">
                  {shopFallback === 'coming_soon' ? 'Ordering Coming Soon' : 'Ordering Temporarily Unavailable'}
                </span>
              ) : null}
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="border border-cardboard bg-paperLight p-6 rounded-[16px] space-y-4 animate-pulse">
                    <div className="w-full aspect-[4/3] bg-paper border border-cardboard border-dashed rounded-[12px]"></div>
                    <div className="h-6 bg-paper w-3/4 rounded-xs"></div>
                    <div className="h-4 bg-paper w-1/2 rounded-xs"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {featuredProducts.map((product) => (
                  <RecipeCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    orderingDisabledLabel={
                      isShopEnabled
                        ? undefined
                        : shopFallback === 'coming_soon'
                        ? 'Coming Soon'
                        : shopFallback === 'unavailable'
                        ? 'Unavailable'
                        : 'Ordering Unavailable'
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>        {/* Interactive Recipe Calculator Section */}
        {isMealPlannerEnabled ? (
          <section 
            className="bg-paperLight py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35 relative" 
            id="fit-calculator" 
            style={{ backgroundImage: 'radial-gradient(#EBE0D0 1.2px, transparent 1.2px)', backgroundSize: '16px 16px' }}
          >
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center text-left relative z-10">
              <div className="lg:col-span-5 space-y-5">
                <Eyebrow label="METABOLIC SIZING ENGINE" />
                <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink leading-tight">
                  Recipe Fit Calculator
                </h2>
                <p className="font-body text-sm text-ink opacity-80 leading-relaxed">
                  Pet nutrition is directly proportional to body mass and daily energy output. Pick your dog's size or enter their exact weight to calculate targeted caloric requirements in real time.
                </p>

                {/* Quick Size Presets */}
                <div className="space-y-2 pt-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-ink opacity-70 block">
                    Quick Size Presets:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DOG_PRESETS.map((preset) => {
                      const isSelected = Number(dogWeight) === preset.weight && activityLevel === preset.activity;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className={`min-h-[44px] inline-flex items-center justify-center font-mono text-[10px] uppercase px-3 py-1.5 rounded-[8px] transition-all cursor-pointer font-bold border ${
                            isSelected
                              ? 'bg-turmeric text-ink border-turmeric shadow-xs scale-102'
                              : 'bg-paper text-ink opacity-85 border-cardboard hover:border-turmeric hover-opacity-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-dashed border-cardboard/70 p-3 space-y-1 font-mono text-[11px] text-ink opacity-75 bg-paper/60 rounded-xl">
                  <p>Formula base: RER = 70 × (weight_kg)⁰·⁷⁵</p>
                  <p>Output MER = RER × activity_multiplier</p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="min-h-[44px] inline-flex items-center space-x-2 bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold px-5 py-3 rounded-[10px] tracking-wider transition-all hover-bounce cursor-pointer shadow-xs active:scale-98"
                  >
                    <span>Step-by-Step Diet Planner</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-paper border border-cardboard p-6 sm:p-8 rounded-[20px] relative shadow-md">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="calc-dog-name-light" className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Dog's Name (Optional)</label>
                      <input
                        id="calc-dog-name-light"
                        type="text"
                        placeholder="e.g. Scooby"
                        value={dogName}
                        onChange={(e) => setDogName(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="calc-dog-weight-light" className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Weight (lbs)</label>
                      <input
                        id="calc-dog-weight-light"
                        type="number"
                        placeholder="e.g. 35"
                        value={dogWeight}
                        onChange={(e) => setDogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                        min="1"
                        className="w-full min-h-[44px] px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="calc-activity-level-light" className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Daily Activity Output</label>
                    <select
                      id="calc-activity-level-light"
                      value={activityLevel}
                      onChange={(e: any) => setActivityLevel(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all cursor-pointer"
                    >
                      <option value="sedentary">Sedentary (Couches & Relaxed Walks)</option>
                      <option value="active">Active (Daily Runs, Fetch & Playtime)</option>
                      <option value="very_active">Working / Sporting (Constant Agility & Training)</option>
                    </select>
                  </div>
                </div>

                {calcResult && (
                  <div className="mt-6 border-t-2 border-dashed border-cardboard pt-6 space-y-4 animate-fade-in-up">
                    {/* Thermal Diagnostic Output Box */}
                    <div className="bg-paperLight p-5 sm:p-6 border border-cardboard rounded-[14px] shadow-xs relative">
                      <div className="flex justify-between items-center pb-3 border-b border-dashed border-cardboard">
                        <div className="text-left">
                          <span className="font-mono text-[10px] uppercase font-bold text-turmeric block flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-turmeric animate-pulse inline-block" />
                            <span>DIAGNOSTIC OUTPUT</span>
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-65">
                            SUBJECT: {dogName.trim() ? dogName.trim().toUpperCase() : 'CANINE COMPANION'} ({dogWeight} LBS)
                          </span>
                        </div>
                        <Activity className="w-5 h-5 text-turmeric shrink-0" />
                      </div>

                      <div className="flex justify-between items-center pt-3">
                        <span className="font-mono text-xs text-ink uppercase font-bold">Target Daily Demand:</span>
                        <span className="font-mono font-black text-xl sm:text-2xl text-ink">
                          {calcResult.calories} <span className="text-sm font-semibold opacity-70">kCal / day</span>
                        </span>
                      </div>
                    </div>

                    {calcResult.recommendedProduct && (
                      <div className="space-y-2.5">
                        <span className="font-mono text-[10px] uppercase font-bold text-herb block">
                          RECOMMENDED RECIPE FORMULATION:
                        </span>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-cardboard p-4 gap-4 bg-paperLight rounded-[14px] shadow-xs hover:border-turmeric transition-colors">
                          <div className="flex items-center space-x-3 text-left">
                            <img 
                              src={calcResult.recommendedProduct.image_url || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=200'} 
                              alt={calcResult.recommendedProduct.name} 
                              width={56}
                              height={56}
                              className="w-14 h-14 object-cover border border-cardboard rounded-[8px] shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=200';
                              }}
                            />
                            <div>
                              <h4 className="font-display font-bold text-sm text-ink">{calcResult.recommendedProduct.name}</h4>
                              <p className="font-mono text-xs text-turmeric font-bold">₹{parseFloat(calcResult.recommendedProduct.price).toFixed(2)} per lb</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (calcResult.recommendedProduct) {
                                handleAddRecommended(calcResult.recommendedProduct.id);
                              }
                            }}
                            disabled={isAddingRecommended}
                            className={`min-h-[44px] font-mono text-[10px] font-bold uppercase px-4 py-2.5 rounded-[8px] transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                              isAddedRecommended
                                ? 'bg-emerald-600 text-white'
                                : 'bg-turmeric text-ink hover:bg-opacity-90 hover-bounce shadow-xs active:scale-98'
                            }`}
                          >
                            {isAddedRecommended ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Added! 🐾</span>
                              </>
                            ) : (
                              <span>Add Recommended</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : mealPlannerFallback !== 'hide' ? (
          <section className="bg-paperLight py-12 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35 text-center">
            <div className="max-w-xl mx-auto space-y-3">
              <Eyebrow label="METABOLIC SIZING ENGINE" />
              <h3 className="font-display font-bold text-2xl uppercase tracking-tight text-ink opacity-70">
                Customized Canine Meal Planner
              </h3>
              <p className="font-body text-sm text-ink opacity-60">
                {mealPlannerFallback === 'coming_soon'
                  ? 'Our interactive recipe calculator and personalized meal planning tool are launching soon.'
                  : 'The meal planning tool is temporarily unavailable while undergoing maintenance.'}
              </p>
            </div>
          </section>
        ) : null}

        {/* Feature Service Cards Section */}
        <section className="bg-paper py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35">
          <div className="max-w-7xl mx-auto space-y-12 text-left">
            <div className="max-w-2xl space-y-2">
              <Eyebrow label="HOLISTIC COMPANION CARE" />
              <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink">
                Explore the Ecosystem
              </h2>
              <p className="font-body text-sm sm:text-base text-ink opacity-75 leading-relaxed">
                Seamlessly manage all aspects of your pet's dietary records, online veterinary consultations, and real-time AI nutrition assistance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {isKnowYourPetEnabled ? (
                <div 
                  onClick={() => navigate('/pets')}
                  className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
                >
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                    <Database className="w-6 h-6 text-turmeric" />
                  </div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">Pet Health Ledger</h3>
                  <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                    Log your pet's diagnostics, allergen sensitivities, weight trends, and profile details in one secure database.
                  </p>
                  <div className="flex items-center space-x-1.5 font-mono text-xs uppercase font-bold text-turmeric pt-2">
                    <span>Manage Health Logs</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                  </div>
                </div>
              ) : knowYourPetFallback !== 'hide' ? (
                <FeaturePlaceholderCard
                  icon={Database}
                  title="Pet Health Ledger"
                  description="Log your pet's diagnostics, allergen sensitivities, weight trends, and profile details in one secure database."
                  variant={knowYourPetFallback}
                />
              ) : null}

              {isConsultationsEnabled ? (
                <div
                  onClick={() => navigate('/consultations')}
                  className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
                >
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-herb transition-colors">
                    <Heart className="w-6 h-6 text-herb" />
                  </div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">Vet Consultations</h3>
                  <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                    Schedule direct video appointments with certified veterinarians to audit custom dietary plans.
                  </p>
                  <div className="flex items-center space-x-1.5 font-mono text-xs uppercase font-bold text-herb pt-2">
                    <span>Schedule Consultation</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                  </div>
                </div>
              ) : consultationsFallback !== 'hide' ? (
                <FeaturePlaceholderCard
                  icon={Heart}
                  title="Vet Consultations"
                  description="Schedule direct video appointments with certified veterinarians to audit custom dietary plans."
                  variant={consultationsFallback}
                />
              ) : null}

              {isChatbotEnabled ? (
                <div
                  onClick={() => navigate('/assistant')}
                  className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
                >
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                    <Sparkles className="w-6 h-6 text-turmeric" />
                  </div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink">AI Nutrition Coach</h3>
                  <p className="font-body text-xs sm:text-sm text-ink opacity-80 leading-relaxed">
                    Get instant dietary recommendations, ingredient breakdowns, and round-the-clock pet wellness guidance.
                  </p>
                  <div className="flex items-center space-x-1.5 font-mono text-xs uppercase font-bold text-turmeric pt-2">
                    <span>Consult AI Coach</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                  </div>
                </div>
              ) : chatbotFallback !== 'hide' ? (
                <FeaturePlaceholderCard
                  icon={Sparkles}
                  title="AI Nutrition Coach"
                  description="Get instant dietary recommendations, ingredient breakdowns, and round-the-clock pet wellness guidance."
                  variant={chatbotFallback}
                />
              ) : null}
            </div>
          </div>
        </section>
        </>
        )}

        {/* Let our #Scoobysfam speak for us Carousel */}
        <ReviewsCarousel dark={isFullscreenHeroEnabled} />

        <JournalPreviewSection dark={isFullscreenHeroEnabled} />

        <div id="faq">
          <FAQSection dark={isFullscreenHeroEnabled} />
        </div>

        {/* Polished Footer with Navigation Ledger -- default homepage only */}
        {!isFullscreenHeroEnabled && (
          <footer className="py-14 bg-ink text-paper px-4 sm:px-6 md:px-8 border-t border-cardboard border-opacity-20 text-center">
            <div className="max-w-7xl mx-auto space-y-8 flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 logo-medallion flex items-center justify-center p-1 overflow-hidden mb-1 shadow-lg">
                <img
                  src="/scooby-logo-256.webp"
                  alt="Hearth & One Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain select-none"
                />
              </div>

              <div className="space-y-2">
                <p className="font-display font-black text-2xl text-paper tracking-tight">
                  Hearth & One
                </p>
                <p className="font-body text-xs max-w-md mx-auto leading-relaxed text-paper opacity-75">
                  Transparent small-batch pet wellness, human-grade meal formulations, and clinical telemedicine.
                </p>
              </div>

              {/* Quick Links Navigation Ledger */}
              <div className="flex flex-wrap justify-center gap-4 sm:gap-8 font-mono text-[11px] uppercase tracking-wider text-turmeric font-bold pt-2 border-t border-b border-cardboard/20 py-4 w-full max-w-2xl">
                {isShopEnabled && (
                  <button onClick={() => navigate('/shop')} className="hover:text-white transition-colors cursor-pointer">Shop Meals</button>
                )}
                {isKnowYourPetEnabled && (
                  <button onClick={() => navigate('/pets')} className="hover:text-white transition-colors cursor-pointer">Pet Ledger</button>
                )}
                {isConsultationsEnabled && (
                  <button onClick={() => navigate('/consultations')} className="hover:text-white transition-colors cursor-pointer">Telehealth</button>
                )}
                {isChatbotEnabled && (
                  <button onClick={() => navigate('/assistant')} className="hover:text-white transition-colors cursor-pointer">AI Coach</button>
                )}
                {isMealPlannerEnabled && (
                  <button onClick={() => navigate('/onboarding')} className="hover:text-white transition-colors cursor-pointer">Diet Planner</button>
                )}
              </div>

              <a
                href="https://www.instagram.com/hearth__and__hound/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Hearth & One on Instagram"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-cardboard border-opacity-30 text-paper hover:text-turmeric hover:border-turmeric transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>

              <p className="font-mono text-[10px] uppercase tracking-wider text-cardboard opacity-75">
                © {new Date().getFullYear()} Hearth & One. Crafted with care for pet parents everywhere. ·{' '}
                <Link to="/privacy" className="hover:text-turmeric transition-colors">Privacy Policy</Link>{' '}
                · <Link to="/terms" className="hover:text-turmeric transition-colors">Terms & Conditions</Link>
              </p>
            </div>
          </footer>
        )}

        {/* Newsletter + Footer -- Black & Gold homepage only, sharing one
            continuous gradient so the color doesn't jump at the seam
            between them (each had its own from-midnightCard-to-midnight
            gradient before, which restarted the brightness ramp twice). */}
        {isFullscreenHeroEnabled && (
        <div className="bg-gradient-to-b from-midnightCard to-midnight">
          <section className="relative py-20 md:py-24 px-4 sm:px-6 md:px-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
                  <span className="w-6 h-[1px] bg-turmeric opacity-70"></span>
                  <span>Stay In The Loop</span>
                </div>
                <h2 className="font-script font-normal text-3xl sm:text-4xl tracking-normal text-paper">
                  Good things are worth staying connected to.
                </h2>
                <p className="font-body text-sm text-paper opacity-65 leading-relaxed max-w-md">
                  Stay up to date with what's happening at Hearth &amp; One, from new features and services to useful resources and special updates for pet parents. Only the updates that matter, delivered to your inbox.
                </p>
              </div>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-3.5"
              >
                <div className="flex border border-paper border-opacity-20 rounded-[2px] overflow-hidden focus-within:border-turmeric transition-colors">
                  <label htmlFor="nl-email" className="sr-only">Email address</label>
                  <input
                    id="nl-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="flex-1 min-w-0 bg-transparent border-none outline-hidden px-4 py-3.5 text-paper font-body text-sm placeholder:text-paper placeholder:opacity-40"
                  />
                  <button
                    type="submit"
                    className="bg-turmeric text-ink font-mono text-[11px] font-bold uppercase tracking-wider px-5 sm:px-6 hover:bg-opacity-90 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Keep Me Updated ↗
                  </button>
                </div>
                <label className="flex items-start space-x-2.5 text-[12px] text-paper opacity-60 leading-relaxed cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-turmeric" />
                  <span>Yes, I'd like to receive updates from Hearth &amp; One. I understand I can unsubscribe at any time.</span>
                </label>
                <p className="text-[11px] text-paper opacity-45">
                  Your email will only be used in accordance with your preferences. Read our{' '}
                  <Link to="/privacy" className="underline hover:text-turmeric transition-colors">privacy policy</Link>.
                </p>
              </form>
            </div>
          </section>

          <SiteFooter className="" />
        </div>
        )}
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
