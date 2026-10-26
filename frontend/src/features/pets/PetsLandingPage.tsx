import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  ClipboardList,
  BookOpen,
  FileHeart,
  Plus,
  Minus,
} from 'lucide-react';
import { PetGettingStarted } from './PetGettingStarted';
import { SiteFooter } from '../../components/SiteFooter';
import { ToolCarousel } from '../../components/ToolCarousel';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { ScrollSpyTimeline } from '../../components/ScrollSpyTimeline';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useLandingFaqs, useLandingHero } from '../../hooks/useAdminContent';

const DEFAULT_HERO_IMAGE = 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg';

const CLOSER_LOOK = [
  { icon: Sparkles, iconSrc: '/images/timeline-icons/traits.svg', iconTone: 'color' as const, title: 'Understand their traits', text: "Learn about characteristics associated with your pet's species and breed." },
  { icon: ClipboardList, iconSrc: '/images/timeline-icons/details.svg', iconTone: 'mono' as const, title: 'Keep their details organised', text: 'Create a profile with essential information about your companion.' },
  { icon: BookOpen, title: 'Explore useful pet knowledge', text: 'Access available information about breed characteristics and everyday needs.', image: '/images/pet-timeline/explore-knowledge.webp', imageAlt: 'A curious dog looking down at an open book' },
  { icon: FileHeart, iconSrc: '/images/timeline-icons/records.svg', iconTone: 'mono' as const, title: 'Keep relevant records', text: 'Maintain important health information using the records supported by the app.' },
];

const PROFILE_DETAILS = [
  { icon: '/images/pet-icons/name.svg', label: 'Name', value: 'Puma', position: 'lg:col-start-1 lg:row-start-1', side: 1 },
  { icon: '/images/pet-icons/date-of-birth.svg', label: 'Date of birth', value: '14 Mar 2022', position: 'lg:col-start-3 lg:row-start-1', side: -1 },
  { icon: '/images/pet-icons/species.svg', label: 'Species', value: 'Dog', position: 'lg:col-start-1 lg:row-start-2', side: 1 },
  { icon: '/images/pet-icons/gender.svg', label: 'Gender', value: 'Male', position: 'lg:col-start-3 lg:row-start-2', side: -1 },
  { icon: '/images/pet-icons/breed.svg', label: 'Breed', value: 'Golden Retriever', position: 'lg:col-start-1 lg:row-start-3', side: 1 },
  { icon: '/images/pet-icons/weight.svg', label: 'Weight', value: '28 kg', position: 'lg:col-start-3 lg:row-start-3', side: -1 },
  { icon: '/images/pet-icons/breed-origin.svg', label: 'Breed origin', value: 'Scotland', position: 'lg:col-start-1 lg:row-start-4', side: 1 },
  { icon: '/images/pet-icons/health-records.svg', label: 'Health records', value: 'Vaccinations & check-ups', position: 'lg:col-start-3 lg:row-start-4', side: -1 },
];

const DEFAULT_HERO = {
  image: DEFAULT_HERO_IMAGE,
  title: 'Everything about your pet, in one place.',
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
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  const tools = [
    ...(isShopEnabled ? [{ label: 'Shop Recipes', image: '/images/toolkit/shop-recipes.webp', text: 'Human-grade meals built around what your pet actually needs.', path: '/shop' }] : []),
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
            <span className="sr-only">One companion. Different aspects of their care.</span>
            <span aria-hidden="true">
              {'One companion. Different aspects of their care.'.split(' ').map((word, index) => (
                <span key={index}>
                  {index > 0 ? ' ' : ''}
                  <span className="pet-profile-heading-word inline-block" style={{ animationDelay: `${index * 160}ms` }}>
                    {word}
                  </span>
                </span>
              ))}
            </span>
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

export function PetsLandingPage() {
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
      <section className="relative w-full min-h-[100svh] overflow-hidden bg-obsidian">
        <img
          src={hero.image}
          alt="A golden retriever with their owner"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hero.ready ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-16 sm:pb-20 max-w-5xl">
          <div className={`max-w-2xl space-y-4 text-left animate-fade-in-up ${hero.ready ? '' : 'invisible'}`}>
            <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-paper uppercase tracking-tight leading-[1.05] drop-shadow-md">
              {hero.title}
            </h1>
            <p className="font-body text-sm sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              {hero.subtitle}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/pets/app')}
                className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-8 py-4 tracking-wider transition-all shadow-sm active:translate-y-[1px] hover-bounce cursor-pointer"
              >
                Create Your Pet's Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* A closer look -- scroll-spy timeline, gold marker handing off step to step */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-gradient-to-b from-midnight via-midnightCard to-midnight">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <div className="flex items-center justify-center space-x-2 font-mono text-xs uppercase tracking-widest text-turmeric">
              <span>A closer look</span>
            </div>
            <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug text-paper">
              Get to know them, beyond the basics.
            </h2>
            <p className="font-body text-sm text-paper opacity-70 leading-relaxed">
              Every pet has their own traits, background, and needs. Here's what you can discover and keep track of with Know Your Pet.
            </p>
          </div>
          <ScrollSpyTimeline steps={CLOSER_LOOK} />
        </div>
      </section>

      {/* Pet profile overview: compact profile details around a future pet portrait. */}
      <section aria-labelledby="pet-profile-heading" className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-midnight text-paper">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-10 md:mb-12">
            <p className="font-mono text-xs uppercase tracking-widest text-turmeric">Your Pet's Profile</p>
            <h2 id="pet-profile-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
              <span className="sr-only">A clearer picture of the companion you know by heart.</span>
              <span aria-hidden="true">
                {'A clearer picture of the companion you know by heart.'.split(' ').map((word, index) => (
                  <span key={index}>
                    {index > 0 ? ' ' : ''}
                    <span
                      className={`pet-profile-heading-word inline-block ${index >= 7 ? 'text-turmeric' : ''}`}
                      style={{ animationDelay: `${index * 160}ms` }}
                    >
                      {word}
                    </span>
                  </span>
                ))}
              </span>
            </h2>
            <p className="font-body text-sm text-paper/75 leading-relaxed">
              Name, species, breed, gender, date of birth, and weight — the real details that make their profile theirs, kept together and easy to update.
            </p>
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
                  <dt className="font-body text-xs text-paper/60">{label}</dt>
                  <dd className="font-display font-semibold text-base sm:text-lg leading-snug text-paper">{value}</dd>
                </dl>
              </motion.article>
            ))}
          </motion.div>
          <p className="max-w-5xl mx-auto mt-4 font-mono text-[10px] uppercase tracking-wider text-paper/60">Sample pet profile · Details for illustration</p>
        </div>
      </section>

      <PetGettingStarted />

      {/* FAQ */}
      <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug text-ink">Frequently asked questions</h2>
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

      {/* One companion, different aspects of care -- cross-promo */}
      <OtherToolsSection />

      {/* Closing CTA */}
      <section aria-labelledby="pet-cta-heading" className="px-4 sm:px-6 md:px-8 py-20 sm:py-24 md:py-28 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper text-center">
        <div className="max-w-4xl mx-auto">
          <h2 id="pet-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl tracking-normal leading-snug lg:whitespace-nowrap">
            Get to know them a little better.
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg md:text-xl text-paper/65 leading-relaxed">
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

      <SiteFooter />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
