import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Plus, Minus,
  ListTree,
  Scale,
  Star,
  Sprout,
} from 'lucide-react';
import { SiteFooter } from '../../components/SiteFooter';
import { ToolCarousel } from '../../components/ToolCarousel';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { ScrollSpyTimeline } from '../../components/ScrollSpyTimeline';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useLandingFaqs, useLandingHero } from '../../hooks/useAdminContent';

const DEFAULT_HERO_IMAGE = 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg';

const CLOSER_LOOK = [
  {
    icon: Sprout,
    image: '/images/shop-timeline/ingredients.webp',
    imageAlt: 'Hands reading an ingredient list on a paper pouch beside fresh chicken, carrots, sweet potato and spinach',
    title: 'See exactly what goes in',
    text: 'Every recipe lists its ingredients with their percentages, so you can read the bowl instead of guessing at it.',
  },
  {
    icon: ListTree,
    image: '/images/shop-timeline/browse.webp',
    imageAlt: 'A person on the kitchen floor browsing a tablet while a Doberman rests its head on their knee',
    title: 'Browse by what they need',
    text: 'Categories and subcategories narrow the catalogue down, and search finds a recipe straight away by name.',
  },
  {
    icon: Scale,
    image: '/images/shop-timeline/size.webp',
    imageAlt: 'A hand reaching for the smaller of two paper pet-food bags beside a kitchen scale',
    title: 'Pick the right size',
    text: 'Recipes come in more than one weight, each with its own price and its own live stock count.',
  },
  {
    icon: Star,
    image: '/images/shop-timeline/reviews.webp',
    imageAlt: 'A phone showing a five-star rating while a Doberman sits patiently by its food bowl',
    title: 'Read what other pet parents found',
    text: 'Ratings and reviews on a recipe come from people who actually bought it.',
  },
];

// Illustrative figures for the ledger preview below -- a sample recipe, not
// a live product. Real percentages come from each product's own ingredients.
const SAMPLE_LEDGER = [
  { name: 'Chicken', percentage: 62 },
  { name: 'Sweet potato', percentage: 18 },
  { name: 'Carrot', percentage: 9 },
  { name: 'Pumpkin', percentage: 7 },
  { name: 'Vitamins & minerals', percentage: 4 },
];

const DEFAULT_HERO = {
  image: DEFAULT_HERO_IMAGE,
  title: 'Food you can read, start to finish.',
  subtitle: 'Human-grade recipes cooked in small batches, with every ingredient and its percentage published for you to check.',
};

const DEFAULT_FAQS = [
  {
    q: 'What makes these recipes different?',
    a: 'They are human-grade and cooked in small batches, with no corn, wheat, soy, or rendering byproducts. Each recipe also publishes its ingredient percentages rather than a general ingredient list.',
  },
  {
    q: 'How do I know what is actually in a recipe?',
    a: 'Open any recipe and you will find its ingredients listed with the percentage each one contributes, along with the description and weight options available.',
  },
  {
    q: 'Do recipes come in different sizes?',
    a: 'Where a recipe offers more than one weight, each size carries its own price and its own stock, so you can choose the one that suits your pet and your routine.',
  },
  {
    q: 'Are the ratings from real customers?',
    a: 'Yes. Ratings and reviews shown on a recipe come from verified pet parents who purchased it.',
  },
  {
    q: 'Can Shop Recipes replace advice from my vet?',
    a: 'No. The catalogue helps you understand what is in the food you are buying. It does not replace advice, diagnosis, or treatment from a qualified veterinarian.',
  },
];

const STEPS = [
  { title: 'Browse the catalogue', text: 'Start from everything, or narrow down by category and subcategory until you find the right shelf.' },
  { title: 'Read the ingredient ledger', text: 'Open a recipe to see its ingredients and the percentage each one contributes.' },
  { title: 'Choose a weight', text: 'Pick the size that fits your pet and your routine; each one shows its own price and stock.' },
  { title: 'Add to cart and check out', text: 'Add what you need, apply any coupon you have, and complete the order.' },
];

function OtherToolsSection() {
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);

  const tools = [
    ...(isKnowYourPetEnabled ? [{ label: 'Know Your Pet', image: '/images/toolkit/know-your-pet.webp', text: "Keep your companion's details and health records in one place.", path: '/pets' }] : []),
    ...(isConsultationsEnabled ? [{ label: 'Vet Consults', image: '/images/toolkit/vet-consults.webp', text: 'Book time with a veterinarian when something needs a professional look.', path: '/consultations' }] : []),
    ...(isMealPlannerEnabled ? [{ label: 'Meal Planner', image: '/images/toolkit/meal-planner.webp', text: "Estimate your pet's daily energy needs from their profile.", path: '/onboarding' }] : []),
    ...(isChatbotEnabled ? [{ label: 'AI Assistant', image: '/images/toolkit/ai-assistant.webp', text: 'Ask questions about nutrition and everyday pet care.', path: '/assistant' }] : []),
  ];

  if (tools.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-midnight text-paper">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
          <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
            Good food is one part of their care.
          </h2>
          <p className="font-body text-sm text-paper opacity-70 leading-relaxed">
            Explore the tools designed to support different parts of the pet-parent journey.
          </p>
        </div>
        <ToolCarousel items={tools} />
      </div>
    </section>
  );
}

export function ShopLandingPage() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const FAQS = useLandingFaqs('shop', DEFAULT_FAQS);
  const hero = useLandingHero('shop_hero', DEFAULT_HERO);

  useDocumentMetadata(
    'Shop Recipes',
    'Human-grade, small-batch recipes for dogs, with the ingredients and their percentages published for every recipe.'
  );

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Shop Recipes',
    description: 'Human-grade, small-batch recipes for dogs, with the ingredients and their percentages published for every recipe.',
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

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header floatingUntilScroll activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero -- same shape as the homepage: full-bleed photo, legibility
          gradients, copy anchored bottom-left. */}
      <section className="relative w-full min-h-[100svh] overflow-hidden bg-obsidian">
        <img
          src={hero.image}
          alt="A Hearth &amp; Hound recipe bag beside the fire"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hero.ready ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-16 sm:pb-20 max-w-5xl">
          <div className={`max-w-2xl space-y-4 text-left animate-fade-in-up ${hero.ready ? '' : 'invisible'}`}>
            <h1 className="font-hero font-normal text-5xl sm:text-6xl md:text-7xl text-paper normal-case tracking-normal leading-[1.1] [text-shadow:0_2px_6px_rgba(0,0,0,0.85),0_4px_28px_rgba(0,0,0,0.8)]">
              {/* The default headline is a picture drawn in the brand display font, so the font file itself is never served;
                  a title set from the admin panel falls back to the script text. */}
              {hero.title === DEFAULT_HERO.title ? (
                <picture>
                  <source media="(min-width: 640px)" srcSet="/images/hero-titles/shop-wide.webp" width={608} height={173} />
                  <img
                    src="/images/hero-titles/shop-narrow.webp"
                    alt={hero.title}
                    width={338}
                    height={171}
                    className="block h-auto w-[min(100%,338px)] sm:w-[min(100%,608px)] [filter:drop-shadow(0_2px_14px_rgba(0,0,0,0.85))]"
                  />
                </picture>
              ) : (
                hero.title
              )}
            </h1>
            <p className="font-body text-sm sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              {hero.subtitle}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/shop/app')}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Browse The Recipes</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* A closer look -- scroll-spy timeline */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-gradient-to-b from-midnight via-midnightCard to-midnight">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <div className="flex items-center justify-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
              <span>A closer look</span>
            </div>
            <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug text-paper">
              What you can expect from the catalogue.
            </h2>
            <p className="font-body text-sm text-paper opacity-70 leading-relaxed">
              Every recipe is listed with the same detail, so comparing two of them is a matter of reading, not guessing.
            </p>
          </div>
          <ScrollSpyTimeline steps={CLOSER_LOOK} />
        </div>
      </section>

      {/* Ingredient ledger -- the brand's differentiator, shown as a sample */}
      <section aria-labelledby="shop-ledger-heading" className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-midnight text-paper">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-10 md:mb-12">
            <p className="font-mono text-xs uppercase tracking-widest text-turmeric">The Ingredient Ledger</p>
            <h2 id="shop-ledger-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
              Percentages, not promises.
            </h2>
            <p className="font-body text-sm text-paper/75 leading-relaxed">
              Most labels tell you what went in. Each of our recipes tells you how much of it went in.
            </p>
          </div>

          <motion.div
            initial={reduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.12 } } }}
            className="max-w-2xl mx-auto rounded-[28px] border border-paper/10 bg-midnightCard p-6 sm:p-8"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-turmeric mb-6">
              Sample recipe · Chicken &amp; Sweet Potato
            </p>
            <div className="space-y-5">
              {SAMPLE_LEDGER.map(({ name, percentage }) => (
                <motion.div
                  key={name}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-body text-sm text-paper">{name}</span>
                    <span className="font-mono text-sm text-turmeric tabular-nums">{percentage}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-paper/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-turmeric"
                      initial={reduceMotion ? false : { width: 0 }}
                      whileInView={{ width: `${percentage}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="mt-7 font-mono text-[10px] uppercase tracking-wider text-paper/50">
              Illustrative figures · Each recipe publishes its own
            </p>
          </motion.div>
        </div>
      </section>

      {/* Getting started */}
      <section aria-labelledby="shop-getting-started" className="bg-paper px-4 py-16 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 id="shop-getting-started" className="font-script text-3xl font-normal tracking-normal leading-snug text-ink sm:text-4xl lg:text-5xl">
              Finding the right recipe.
            </h2>
            <p className="mx-auto mt-4 max-w-lg font-body text-sm leading-relaxed text-ink/75">
              Four steps from the catalogue to a bowl you understand.
            </p>
          </div>
          <div className="space-y-8">
            {STEPS.map((step, index) => (
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

      {/* FAQ */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Eyebrow label="A Few Helpful Answers" />
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="border border-cardboard border-opacity-40 bg-paperLight rounded-sm overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                  >
                    <span className="font-body font-bold text-sm text-ink">{faq.q}</span>
                    {isOpen ? <Minus aria-hidden="true" className="w-5 h-5 shrink-0 text-black" /> : <Plus aria-hidden="true" className="w-5 h-5 shrink-0 text-black" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 font-body text-sm leading-relaxed text-ink opacity-80">{faq.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <OtherToolsSection />

      {/* Closing CTA */}
      <section aria-labelledby="shop-cta-heading" className="px-4 sm:px-6 md:px-8 py-20 sm:py-24 md:py-28 bg-gradient-to-b from-midnightCard to-midnight text-paper text-center">
        <div className="max-w-4xl mx-auto">
          <h2 id="shop-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl tracking-normal leading-snug">
            See what is in the bowl.
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg md:text-xl text-paper/65 leading-relaxed">
            Browse the recipes and read every one of them all the way down.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shop/app')}
            className="pet-profile-cta group relative isolate overflow-hidden inline-flex max-w-full items-center justify-center gap-3 sm:gap-5 mt-10 sm:mt-12 rounded-full border border-turmeric bg-turmeric px-6 sm:px-9 py-4 sm:py-5 font-display font-semibold text-base sm:text-lg text-ink shadow-[inset_0_0_0_2px_rgba(249,246,240,0.25)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]"
          >
            <span className="relative">Browse the recipes</span>
            <ArrowRight aria-hidden="true" className="relative w-5 h-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      <SiteFooter />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
