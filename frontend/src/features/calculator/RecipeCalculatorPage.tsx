import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Plus, Minus, Flame, SlidersHorizontal, Compass } from 'lucide-react';
import { Header } from '../../components/Header';
import { HeroScrollHint } from '../../components/HeroScrollHint';
import { SiteFooter } from '../../components/SiteFooter';
import { CartDrawer } from '../../components/CartDrawer';
import { ToolCarousel } from '../../components/ToolCarousel';
import { RouteUnavailable } from '../../components/RouteUnavailable';
import { CalculatorGettingStarted } from './CalculatorGettingStarted';
import { RecipeCalculator } from './RecipeCalculator';
import { useFeatureFlag, useFlagEntry, useVetEntryEnabled } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useLandingHero } from '../../hooks/useAdminContent';
import { markLandingSeen } from '../../utils/landingSeen';

const PAGE_TITLE = 'Count The Calories';
const PAGE_DESCRIPTION = "Understand your dog's daily energy requirements and get a more informed starting point for planning their meals.";

// The top image, headline and text can be changed in Admin > Banners ("Count The Calories page - top
// image"); anything left empty there keeps these defaults.
const DEFAULT_HERO = {
  image: '/images/hero/calculator-1.webp',
  title: 'A little more clarity in every meal',
  subtitle: "Understand your pet's daily energy requirements and get a more informed starting point for planning their meals.",
};

// Three photo cards, one per point.
const ENERGY_STEPS = [
  {
    icon: Flame,
    image: '/images/calculator-timeline/energy.webp',
    imageAlt: 'A golden retriever running across a sunlit grass field',
    title: 'Adequate energy everyday',
    text: 'The right amount of food provides the energy pets need for movement, activity, and essential body functions.',
  },
  {
    icon: SlidersHorizontal,
    image: '/images/calculator-timeline/needs-vary.webp',
    imageAlt: 'A senior dog and a puppy resting side by side on a rug',
    title: 'Needs that vary',
    text: 'Energy requirements can differ with factors such as age, body weight, activity level, and health.',
  },
  {
    icon: Compass,
    image: '/images/calculator-timeline/informed.webp',
    imageAlt: 'A person weighing fresh chicken and vegetable dog food on a kitchen scale while their golden retriever waits beside them',
    title: 'A more informed approach to meals',
    text: 'An energy estimate can help you make more informed feeding decisions, alongside appropriate nutritional guidance.',
  },
];

// Answers describe what the meal planner (/onboarding) actually does today. If the planner changes
// (cats, new questions, a meal plan, pricing), update these with it.
const FAQS = [
  {
    q: 'What does Count The Calories do?',
    a: "Count The Calories estimates your dog's daily energy requirements using the details you provide. The result can help you make more informed decisions when planning their meals.",
  },
  {
    q: 'What information do I need to provide?',
    a: "The calculator on this page needs your dog's weight and how active they are; a name is optional. The step-by-step meal planner asks a little more: your dog's name and gender, their breed, age and weight (in kilograms or pounds), how active they are, and any sensitivities you would like recipes to avoid, such as beef, chicken, or grains.",
  },
  {
    q: 'What does the result show?',
    a: "Both show an estimate of your dog's daily energy requirements, worked out from their weight and activity level. The calculator on this page also suggests a recipe from our range for their size, and the meal planner compares the figure with a typical value for their breed and lists recipes that match the preferences you chose.",
  },
  {
    q: 'Can I use the calculator for both dogs and cats?',
    a: 'The calculator currently supports dogs only.',
  },
  {
    q: 'How accurate is the calorie estimate?',
    a: "The result is an estimate rather than an exact measurement. It uses your dog's weight and activity level, so age, body condition, and health are not part of the figure. Energy requirements vary between individual pets, and actual needs can depend on factors such as age, activity, body condition, and health.",
  },
  {
    q: 'Does the calculator create a complete meal plan?',
    a: 'No. It estimates energy requirements and suggests recipes that match your preferences. The result is a starting point for feeding decisions rather than a complete nutritional plan, and it does not give portion sizes or ingredient amounts.',
  },
  {
    q: 'Can I use the result to choose a recipe or food?',
    a: 'After the estimate, the planner shows recipes from our range that match the preferences you selected, so you can open them from there. The recipe filters check recipe names and descriptions, not a verified allergen list, so please read the full ingredients before choosing food, especially for a dog with allergies.',
  },
  {
    q: 'Should I consult a veterinarian?',
    a: "Yes. A veterinarian can help assess your pet's individual nutritional requirements, particularly if your pet has a medical condition, food sensitivities, or specific dietary needs.",
  },
  {
    q: "Should I recalculate if my pet's needs change?",
    a: "Your pet's energy requirements may change as they grow, age, become more or less active, or experience changes in health or body condition. Reassess their needs when appropriate and seek veterinary guidance if unsure.",
  },
  {
    q: 'Is Count The Calories free to use?',
    a: "Calculating your dog's estimate is free, and the calculator on this page works without an account. You will be asked to sign in or create an account to continue to the meal planner or to add a recipe to your cart. Buying a recipe is a separate step.",
  },
];

export function RecipeCalculatorPage() {
  // Remember that this landing page has been opened, so the home-page card can go straight to the feature next time.
  useEffect(() => {
    markLandingSeen('calculator');
  }, []);

  const { hash } = useLocation();
  const reduceMotion = useReducedMotion();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isVetEnabled = useVetEntryEnabled();
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  // The calculator follows the same switch as the rest of the meal planner. While it is off, a
  // direct visit shows only its status (Coming soon / Unavailable), like the Shop and Vet pages.
  const entry = useFlagEntry('shop_meal_planner');
  const hero = useLandingHero('calculator_hero', DEFAULT_HERO);

  useDocumentMetadata(PAGE_TITLE, PAGE_DESCRIPTION);

  // The page loads lazily, so the site-wide anchor jump runs before the calculator exists. Do it here.
  useEffect(() => {
    if (hash !== '#fit-calculator' || entry.blocked) return;
    const timer = window.setTimeout(() => {
      document.getElementById('fit-calculator')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [hash, entry.blocked]);

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: window.location.origin + window.location.pathname,
    isPartOf: { '@type': 'WebSite', name: 'Hearth & One', url: window.location.origin },
  });

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });

  // Both "Calculate" buttons take the visitor to the calculator on this same page.
  const startCalculating = () => {
    document.getElementById('fit-calculator')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const ecosystem = [
    ...(isKnowYourPetEnabled
      ? [{
          label: 'Know Your Pet',
          image: '/images/toolkit/know-your-pet.webp',
          text: "Understand your pet's characteristics and keep their profile information organised.",
          path: '/pets',
          cta: 'Explore Know Your Pet',
        }]
      : []),
    ...(isVetEnabled
      ? [{
          label: 'Locate Your Vet',
          image: '/images/toolkit/locate-vet.webp',
          text: 'Find veterinary clinics in your area and take the next step towards their care.',
          path: '/consultations',
          cta: 'Explore Locate Your Vet',
        }]
      : []),
    ...(isShopEnabled
      ? [{
          label: 'Shop Recipes',
          image: '/images/toolkit/shop-recipes.webp',
          text: 'Recipes made in small batches, with each ingredient listed so you can check what goes into the bowl.',
          path: '/shop',
        }]
      : []),
    ...(isChatbotEnabled
      ? [{
          label: 'AI Assistant',
          image: '/images/toolkit/ai-assistant.webp',
          text: 'Ask questions about nutrition and everyday pet care.',
          path: '/assistant',
        }]
      : []),
  ];

  // Hidden (not just off) means the page should not exist for visitors, like the other hidden features.
  if (entry.state === 'hide') return <Navigate to="/" replace />;

  if (entry.blocked) {
    return (
      <RouteUnavailable
        variant={entry.variant}
        activeTab="calculator"
        title={entry.variant === 'coming_soon' ? 'Count The Calories: Coming soon' : 'Count The Calories: Unavailable'}
        actionLabel="Back to Home"
        actionPath="/"
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header floatingUntilScroll activeTab="calculator" onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero -- same shape as the other landing pages: full-bleed photo, legibility gradients, copy
          anchored bottom-left. The photo, headline and text come from Admin > Banners. */}
      <section data-scroll-hero className="relative w-full min-h-[100svh] overflow-hidden bg-midnight">
        <img
          src={hero.image}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover ${
            // The default photo has its subject (dog and bowl) at the far right, so a phone crop must sit further right.
            hero.image === DEFAULT_HERO.image ? 'object-[97%_center]' : 'object-[68%_center]'
          } md:object-center transition-opacity duration-500 ${hero.ready ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-28 sm:pb-28 max-w-5xl">
          <div className={`max-w-2xl space-y-4 text-left animate-fade-in-up ${hero.ready ? '' : 'invisible'}`}>
            <h1 className="font-hero font-normal text-5xl sm:text-6xl md:text-7xl text-paper normal-case tracking-normal leading-[1.1] [text-shadow:0_2px_6px_rgba(0,0,0,0.85),0_4px_28px_rgba(0,0,0,0.8)]">
              {hero.title}
            </h1>
            <p className="font-body text-sm sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              {hero.subtitle}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={startCalculating}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden inline-flex items-center gap-2 bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Calculate their needs</span>
                <ArrowUpRight aria-hidden="true" className="relative w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {/* The photo melts into the dark of the next section, so the banner and the first section read as one. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 md:h-56 bg-gradient-to-t from-midnight via-midnight/70 to-transparent" />
        <HeroScrollHint />
      </section>

      {/* Every pet has their own energy needs */}
      <section aria-labelledby="calc-needs-heading" className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto text-center space-y-3 mb-12">
            <h2 id="calc-needs-heading" className="font-script font-normal text-3xl sm:text-4xl xl:text-5xl tracking-normal leading-snug lg:whitespace-nowrap">
              Every pet has their own energy needs
            </h2>
            <p className="mx-auto max-w-2xl font-body text-sm sm:text-base text-paper/90 leading-relaxed">
              The right amount of energy helps support your pet's everyday activities, from resting and playing to growing and staying active. Understanding their daily energy requirements can give you a useful starting point when planning their meals.
            </p>
          </div>
          <motion.ol
            initial={reduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.18 } } }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {ENERGY_STEPS.map(({ icon: Icon, image, imageAlt, title, text }) => (
              <motion.li
                key={title}
                variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="group flex flex-col overflow-hidden rounded-[24px] border border-paper/10 bg-midnightCard text-left transition-colors duration-300 hover:border-turmeric/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={image}
                    alt={imageAlt}
                    width={1200}
                    height={896}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-midnightCard/80 via-transparent to-transparent" />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <div className="flex items-center gap-3">
                    <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-turmeric" strokeWidth={1.6} />
                    <h3 className="font-display text-lg font-bold leading-snug text-paper">{title}</h3>
                  </div>
                  <p className="font-body text-sm leading-relaxed text-paper/75">{text}</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* How it works -- the same staged animation as Know Your Pet's "Getting started" */}
      <CalculatorGettingStarted />

      {/* The calculator section that used to be on the home page, unchanged. Links from the home page,
          the footer and the other landing pages can open it directly (/recipe-calculator#fit-calculator). */}
      <RecipeCalculator />

      {/* Hearth & One ecosystem -- the animated tool cards the other landing pages use */}
      {ecosystem.length > 0 && (
        <section aria-labelledby="calc-ecosystem-heading" className="px-4 sm:px-6 md:px-8 pt-16 pb-10 md:pt-20 md:pb-12 bg-midnight text-paper">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-6xl mx-auto text-center space-y-3 mb-12">
              <h2 id="calc-ecosystem-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-[clamp(2rem,3.7vw,3.75rem)] lg:whitespace-nowrap tracking-normal leading-snug">
                <span className="sr-only">One companion Different aspects of their care</span>
                <span aria-hidden="true">
                  {'One companion Different aspects of their care'.split(' ').map((word, index) => (
                    <span key={index}>
                      {index > 0 ? ' ' : ''}
                      <span className="pet-profile-heading-word inline-block" style={{ animationDelay: `${index * 160}ms` }}>
                        {word}
                      </span>
                    </span>
                  ))}
                </span>
              </h2>
              <p className="mx-auto max-w-2xl font-body text-sm text-paper opacity-70 leading-relaxed">
                Explore the tools designed to support different parts of the pet-parent journey.
              </p>
            </div>
            <ToolCarousel items={ecosystem} />
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section aria-labelledby="calc-cta-heading" className="px-4 sm:px-6 md:px-8 pt-12 sm:pt-14 md:pt-16 pb-10 md:pb-12 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper text-center">
        <div className="max-w-7xl mx-auto">
          <h2 id="calc-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl lg:text-[clamp(2rem,3.7vw,3.75rem)] lg:whitespace-nowrap tracking-normal leading-snug">
            Take the next step towards more informed meals
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg md:text-xl text-paper/65 leading-relaxed">
            Estimate your pet's daily energy requirements and use the result as a starting point for making informed feeding decisions.
          </p>
          <button
            type="button"
            onClick={startCalculating}
            className="pet-profile-cta group relative isolate overflow-hidden inline-flex max-w-full items-center justify-center gap-3 sm:gap-5 mt-10 sm:mt-12 rounded-full border border-turmeric bg-turmeric px-6 sm:px-9 py-4 sm:py-5 font-display font-semibold text-base sm:text-lg text-ink shadow-[inset_0_0_0_2px_rgba(249,246,240,0.25)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]"
          >
            <span className="relative">Calculate Their Needs</span>
            <ArrowRight aria-hidden="true" className="relative w-5 h-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="calc-faq-heading" className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-midnight text-paper">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h2 id="calc-faq-heading" className="font-script font-normal text-3xl sm:text-4xl tracking-normal leading-snug">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="border border-paper/10 bg-midnightCard rounded-sm overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                  >
                    <span className="font-body font-bold text-sm text-paper">{faq.q}</span>
                    {isOpen ? <Minus aria-hidden="true" className="w-5 h-5 shrink-0 text-paper" /> : <Plus aria-hidden="true" className="w-5 h-5 shrink-0 text-paper" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 font-body text-sm leading-relaxed text-paper/80">{faq.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
