import { HeroScrollHint } from '../../components/HeroScrollHint';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Plus,
  Minus,
} from 'lucide-react';
import { PetGettingStarted } from './PetGettingStarted';
import { SiteFooter } from '../../components/SiteFooter';
import { ToolCarousel } from '../../components/ToolCarousel';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { useFeatureFlag, useVetEntryEnabled } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useLandingFaqs, useLandingHero } from '../../hooks/useAdminContent';
import { markLandingSeen } from '../../utils/landingSeen';

const DEFAULT_HERO_IMAGE = '/images/hero/hero-2.webp';

const PROFILE_DETAILS = [
  { icon: '/images/pet-icons/rfid.svg', label: 'Microchip ID', value: 'RFID', position: 'lg:col-start-1 lg:row-start-1', side: 1 },
  { icon: '/images/pet-icons/name.svg', label: 'Name', value: 'Puma', position: 'lg:col-start-1 lg:row-start-2', side: 1 },
  { icon: '/images/pet-icons/date-of-birth.svg', label: 'Date of birth', value: '14 Mar 2022', position: 'lg:col-start-3 lg:row-start-1', side: -1 },
  { icon: '/images/pet-icons/gender.svg', label: 'Gender', value: 'Male', position: 'lg:col-start-3 lg:row-start-2', side: -1 },
  { icon: '/images/pet-icons/breed.svg', label: 'Species & breed', value: 'Dog · Golden Retriever', position: 'lg:col-start-1 lg:row-start-3', side: 1 },
  { icon: '/images/pet-icons/weight.svg', label: 'Weight', value: '28 kg', position: 'lg:col-start-3 lg:row-start-3', side: -1 },
  { icon: '/images/pet-icons/breed-origin.svg', label: 'Breed origin', value: 'Scotland', position: 'lg:col-start-1 lg:row-start-4', side: 1 },
  { icon: '/images/pet-icons/health-records.svg', label: 'Health records', value: 'Vaccinations & check-ups', position: 'lg:col-start-3 lg:row-start-4', side: -1 },
];

const DEFAULT_HERO = {
  image: DEFAULT_HERO_IMAGE,
  title: 'Everything about your pet, in one place',
  subtitle: "Build a profile that captures your companion's essential details, unique characteristics, and everyday needs.",
};

const DEFAULT_FAQS = [
  {
    q: 'What is Know Your Pet?',
    a: 'Know Your Pet helps you create a profile for your pet and explore information about their characteristics and needs.',
  },
  {
    q: 'What information can I add to a pet profile?',
    a: "You can add the details supported by the app, such as your pet's name, species, breed, age, and other relevant information.",
  },
  {
    q: 'Can I create profiles for multiple pets?',
    a: "Yes — Know Your Pet supports multiple pet profiles, so you can keep every companion's details in one place.",
  },
  {
    q: "Can I update my pet's information later?",
    a: "Yes — you can update your pet's profile at any time as new details come up.",
  },
  {
    q: 'Does Know Your Pet replace veterinary advice?',
    a: 'No. Know Your Pet is intended to help you organise information and learn about your pet. It does not replace advice, diagnosis, or treatment from a qualified veterinarian.',
  },
];

function OtherToolsSection() {
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isConsultationsEnabled = useVetEntryEnabled();
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  const tools = [
    ...(isShopEnabled ? [{ label: 'Shop Recipes', image: '/images/toolkit/shop-recipes.webp', text: 'Human-grade meals built around what your pet actually needs.', path: '/shop' }] : []),
    ...(isConsultationsEnabled ? [{ label: 'Vet Consults', image: '/images/toolkit/vet-consults.webp', text: 'Book time with a veterinarian when something needs a professional look.', path: '/consultations' }] : []),
    ...(isMealPlannerEnabled ? [{ label: 'Count Their Calories', image: '/images/toolkit/meal-planner.webp', text: "Estimate your pet's daily energy needs from their profile.", path: '/recipe-calculator#fit-calculator' }] : []),
    ...(isChatbotEnabled ? [{ label: 'AI Assistant', image: '/images/toolkit/ai-assistant.webp', text: 'Ask questions about nutrition and everyday pet care.', path: '/assistant' }] : []),
  ];

  if (tools.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-midnight text-paper">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-6xl mx-auto text-center space-y-3 mb-8">
          <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-[clamp(2rem,3.7vw,3.75rem)] lg:whitespace-nowrap tracking-normal leading-snug">
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
          <p className="mx-auto max-w-2xl pt-4 md:pt-5 font-body text-base sm:text-lg text-paper opacity-90 leading-relaxed">
            Explore the tools designed to support different parts of the pet-parent journey.
          </p>
        </div>
        <ToolCarousel items={tools} matchStepCards />
      </div>
    </section>
  );
}

export function PetsLandingPage() {
  // Remember that this landing page has been opened, so the home-page card can go straight to the feature next time.
  useEffect(() => {
    markLandingSeen('pets');
  }, []);

  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const FAQS = useLandingFaqs('pets', DEFAULT_FAQS);
  const hero = useLandingHero('pets_hero', DEFAULT_HERO);

  useDocumentMetadata(
    'Know Your Pet',
    'Create a profile for your pet and explore information about their characteristics, breed traits, and everyday needs.'
  );

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Know Your Pet',
    description: 'Create a profile for your pet and explore information about their characteristics, breed traits, and everyday needs.',
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
      {/* Transparent over the hero, crossfades to the normal solid ink bar
          once scrolled past it -- same header behavior as the homepage. */}
      <Header floatingUntilScroll activeTab="pets" onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero -- same shape as the homepage's hero: full-bleed photo, a
          single legibility gradient (not a left/right split), copy
          anchored bottom-left over it. */}
      <section data-scroll-hero className="relative w-full min-h-[100svh] overflow-hidden bg-midnight">
        <img
          src={hero.image}
          alt="A Doberman resting against its owner, who gently rests a hand on its shoulder"
          className={`absolute inset-0 w-full h-full object-cover object-[68%_center] md:object-center transition-opacity duration-500 ${hero.ready ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-28 sm:pb-28 max-w-5xl">
          <div className={`max-w-2xl space-y-4 text-left animate-fade-in-up ${hero.ready ? '' : 'invisible'}`}>
            <h1 className="font-script font-normal text-4xl sm:text-5xl md:text-6xl text-paper normal-case tracking-normal leading-[1.1] [text-shadow:0_2px_6px_rgba(0,0,0,0.85),0_4px_28px_rgba(0,0,0,0.8)]">
              {hero.title}
            </h1>
            <p className="font-body text-base sm:text-lg text-paperLight opacity-90 leading-relaxed max-w-xl">
              {hero.subtitle}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/pets/app')}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Create Your Pet's Profile</span>
              </button>
            </div>
          </div>
        </div>
        {/* Blend the bottom of the photo into the section below so there is no hard edge. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 md:h-56 bg-gradient-to-t from-midnight via-midnight/70 to-transparent" />
        <HeroScrollHint />
    </section>
      {/* Pet profile overview: compact profile details around a future pet portrait. */}
      <section aria-labelledby="pet-profile-heading" className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-midnight text-paper">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-8">
            <p className="font-script font-normal text-[clamp(1.125rem,4.6vw,2.5rem)] whitespace-nowrap tracking-normal leading-snug text-turmeric">Your Pet's Profile</p>
            <h2 id="pet-profile-heading" className="font-body font-normal text-base sm:text-lg text-paper opacity-90 tracking-normal leading-relaxed">
              <span className="sr-only">A clearer picture of the companion you know by heart</span>
              <span aria-hidden="true">
                {'A clearer picture of the companion you know by heart'.split(' ').map((word, index) => (
                  <span key={index}>
                    {index > 0 ? ' ' : ''}
                    <span
                      className="pet-profile-heading-word inline-block"
                      style={{ animationDelay: `${index * 160}ms` }}
                    >
                      {word}
                    </span>
                  </span>
                ))}
              </span>
            </h2>
          </div>

          <svg width="0" height="0" aria-hidden="true" className="absolute">
            <defs>
              <clipPath id="pet-portrait-arch" clipPathUnits="objectBoundingBox">
                <path d="M .5 0 C .22 .07 0 .16 0 .32 L 0 .95 Q 0 1 .09 1 L .91 1 Q 1 1 1 .95 L 1 .32 C 1 .16 .78 .07 .5 0 Z" />
              </clipPath>
            </defs>
          </svg>
          <motion.div
            initial={reduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.16 } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] lg:auto-rows-fr gap-3 sm:gap-4 max-w-5xl mx-auto"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.96, y: 20 },
                visible: { opacity: 1, scale: 1, y: 0 },
              }}
              transition={{ duration: reduceMotion ? 0 : 0.5 }}
              style={{ clipPath: 'url(#pet-portrait-arch)' }}
              className="relative isolate overflow-hidden min-h-[280px] sm:col-span-2 lg:min-h-[380px] lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-span-4 bg-midnightCard"
            >
              <img
                src="/images/pet-profile/owner-and-dog.webp"
                alt="A smiling pet parent hugging their golden retriever while looking at a tablet together"
                width={1000}
                height={1500}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-[50%_38%]"
              />
            </motion.div>

            {PROFILE_DETAILS.map(({ icon, label, value, position, side }) => (
              <motion.article
                key={label}
                variants={{
                  hidden: { opacity: 0, x: side * 24, y: 16, scale: 0.96 },
                  visible: { opacity: 1, x: 0, y: 0, scale: 1 },
                }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={`min-w-0 min-h-[116px] h-full flex items-center gap-4 rounded-[20px] border border-paper/10 bg-midnightCard px-5 py-5 lg:px-6 ${position}`}>
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-[14px] bg-paper">
                  <img src={icon} alt="" aria-hidden="true" className="w-8 h-8 object-contain" loading="lazy" />
                </div>
                <dl className="min-w-0 space-y-1">
                  <dt className="font-body text-xs text-paper/75">{label}</dt>
                  <dd className="font-display font-semibold text-base sm:text-lg leading-snug text-paper">{value}</dd>
                </dl>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <PetGettingStarted />

      {/* One companion, different aspects of care -- cross-promo */}
      <OtherToolsSection />

      {/* Closing CTA */}
      <section aria-labelledby="pet-cta-heading" className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper text-center">
        <div className="max-w-4xl mx-auto">
          <h2 id="pet-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl tracking-normal leading-snug lg:whitespace-nowrap">
            Get to know them a little better
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg text-paper/90 leading-relaxed">
            Start building a clearer picture of your pet, one detail at a time.
          </p>
          <button
            type="button"
            onClick={() => navigate('/pets/app')}
            className="pet-profile-cta group relative isolate overflow-hidden inline-flex max-w-full items-center justify-center gap-3 sm:gap-5 mt-10 sm:mt-12 rounded-full border border-turmeric bg-turmeric px-6 sm:px-9 py-4 sm:py-5 font-display font-semibold text-base sm:text-lg text-ink shadow-[inset_0_0_0_2px_rgba(249,246,240,0.25)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]"
          >
            <span className="relative">Create your pet's profile</span>
            <ArrowRight aria-hidden="true" className="relative w-5 h-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-midnight text-paper">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">Frequently asked questions</h2>
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
