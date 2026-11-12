import { HeroScrollHint } from '../../components/HeroScrollHint';
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowRight, Plus, Minus, PawPrint } from 'lucide-react';
import { SiteFooter } from '../../components/SiteFooter';
import { ToolCarousel } from '../../components/ToolCarousel';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';
import { useLandingFaqs, useLandingHero } from '../../hooks/useAdminContent';
import { markLandingSeen } from '../../utils/landingSeen';
import { getOptimizedImageUrl, IMAGE_WIDTH, originalOnError } from '../../utils/cloudinaryImage';

const DEFAULT_HERO_IMAGE = '/images/hero/vet-3.webp';

const STEPS = [
  {
    image: '/images/vet-journey/location.webp',
    stop: 'Your starting point',
    title: 'Add your location',
    text: 'Enter your city, area, or PIN code, or allow GPS to detect your current location.',
  },
  {
    image: '/images/vet-journey/clinic.webp',
    stop: 'Explore your options',
    title: 'Browse nearby clinics',
    text: 'Explore the available veterinary clinics and review the information provided in their listings.',
  },
  {
    image: '/images/vet-journey/contact.webp',
    stop: 'Take the next step',
    title: 'View details and get in touch',
    text: 'Open a clinic listing to check its available details and contact the clinic directly.',
  },
];

const DEFAULT_HERO = {
  image: DEFAULT_HERO_IMAGE,
  title: 'The right care starts closer than you think',
  subtitle: 'Find veterinary clinics in your area and take the next step towards getting your companion the care they need.',
};

const DEFAULT_FAQS = [
  {
    q: 'What is Locate Your Vet?',
    a: 'Locate Your Vet helps pet parents discover veterinary clinics in their area. It is designed to make finding relevant clinic information and taking the next step towards veterinary care easier.',
  },
  {
    q: 'How can I find a veterinary clinic near me?',
    a: 'Enter your city, area, or PIN code in the search field to explore available clinic listings. If location detection is supported, you may also be able to use your current location.',
  },
  {
    q: 'Can I search using my current location?',
    a: 'Yes, if the app supports GPS-based search. You can allow location access when prompted to find clinics around you. Alternatively, use manual location search if available.',
  },
  {
    q: 'What information can I see about a veterinary clinic?',
    a: "Depending on the information available in each listing, you may be able to view details such as the clinic's address, contact information, services, and opening hours.",
  },
  {
    q: 'Can I contact a clinic directly through Locate Your Vet?',
    a: "You can use the contact details provided in a clinic's listing to get in touch, where available. Confirm the clinic's contact information and availability before visiting.",
  },
  {
    q: 'Can I book a veterinary appointment through the platform?',
    a: 'Appointment booking depends on the features currently supported by Locate Your Vet. If online booking is unavailable, you may need to contact the clinic directly to arrange a visit.',
  },
  {
    q: 'Can I find a clinic that offers a specific service?',
    a: 'That depends on the search and filtering options available in the platform and the information provided by each clinic. If service filters are not available, contact clinics directly to confirm whether they offer the care your pet needs.',
  },
  {
    q: 'How do I know whether a clinic is open?',
    a: "If opening hours are included in a clinic's listing, check them before visiting. We recommend contacting the clinic to confirm its current availability, especially on holidays or outside regular hours.",
  },
  {
    q: 'Can Locate Your Vet help me find emergency veterinary care?',
    a: 'Locate Your Vet may help you identify clinics in your area, but you should confirm directly whether a clinic provides emergency services and is available to treat your pet. If your pet needs urgent attention, contact a veterinary clinic or local emergency veterinary service immediately.',
  },
  {
    q: 'Does Locate Your Vet replace advice from a veterinarian?',
    a: 'No. Locate Your Vet helps you find veterinary clinics; it does not replace a professional examination, diagnosis, or treatment plan. Always consult a qualified veterinarian about your pet’s health concerns.',
  },
];

function JourneyIcon({ image, index }: { image: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });

  return (
    <div ref={ref} aria-hidden="true" className="relative h-24 w-24 sm:h-28 sm:w-28 md:h-44 md:w-44" style={{ perspective: 600 }}>
      <img
        src={image}
        alt=""
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="vet-journey-art h-full w-full object-contain"
        style={{ animationDelay: `${index * -1.6}s`, animationPlayState: inView ? 'running' : 'paused' }}
      />
    </div>
  );
}

function JourneyPaw({ progress, order, reverse }: { progress: MotionValue<number>; order: number; reverse: boolean }) {
  const reduceMotion = useReducedMotion();
  const t = (order + 1) / 11;
  const curveX = t * t * (3 - 2 * t);
  const x = (reverse ? 1 - curveX : curveX) * 100;
  const opacity = useTransform(progress, [Math.max(0, t - 0.06), t], [0.15, 1]);
  const scale = useTransform(progress, [Math.max(0, t - 0.06), t], [0.8, 1]);
  const filter = useTransform(progress, [Math.max(0, t - 0.06), t], ['drop-shadow(0 0 0px #D09E6B00)', 'drop-shadow(0 0 7px #D09E6BAA)']);

  return (
    <motion.span
      className="absolute text-turmeric"
      style={{ left: `${x}%`, top: `${t * 100}%`, x: order % 2 === 0 ? -18 : 2, y: '-50%', rotate: reverse ? 215 : 145, opacity: reduceMotion ? 1 : opacity, scale: reduceMotion ? 1 : scale, filter: reduceMotion ? 'none' : filter }}
    >
      <PawPrint className="h-4 w-4 md:h-5 md:w-5" fill="currentColor" strokeWidth={1} />
    </motion.span>
  );
}

function JourneyTrail({ reverse }: { reverse: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 55%', 'end 55%'] });
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none relative mx-auto my-5 h-40 w-[20%] md:my-7 md:h-48 md:w-[60%]">
      {Array.from({ length: 10 }, (_, order) => <JourneyPaw key={order} progress={scrollYProgress} order={order} reverse={reverse} />)}
    </div>
  );
}

function JourneyStep({ step, index }: { step: typeof STEPS[number]; index: number }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress: arrival } = useScroll({ target: nodeRef, offset: ['center 75%', 'center 55%'] });
  const badgeShadow = useTransform(arrival, [0, 1], ['0 0 0px #D09E6B00', '0 0 20px #D09E6B88']);
  const opacity = useTransform(arrival, [0, 1], [0.45, 1]);
  const y = useTransform(arrival, [0, 1], [24, 0]);

  return (
    <li className="relative">
      <div className={`relative flex w-[80%] flex-col items-center text-center md:w-[40%] ${index % 2 === 0 ? 'mr-auto' : 'ml-auto'}`}>
        <div ref={nodeRef} className="relative">
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-turmeric/25 blur-2xl" style={{ opacity: reduceMotion ? 0.5 : arrival }} />
          <JourneyIcon image={step.image} index={index} />
          <motion.span className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-turmeric bg-midnight font-mono text-[10px] font-bold text-turmeric" style={{ boxShadow: reduceMotion ? 'none' : badgeShadow }}>
            {String(index + 1).padStart(2, '0')}
          </motion.span>
        </div>
        <motion.div style={{ opacity: reduceMotion ? 1 : opacity, y: reduceMotion ? 0 : y }} className="relative mt-5 max-w-sm">
          <p className="mb-2 font-mono text-xs sm:text-sm uppercase tracking-wider text-turmeric">{step.stop}</p>
          <h3 className="font-display font-bold text-xl lg:text-2xl leading-snug text-paper">{step.title}</h3>
          <p className="mt-3 font-body text-sm leading-relaxed text-paper/90">{step.text}</p>
        </motion.div>
      </div>
      {index < STEPS.length - 1 && <JourneyTrail reverse={index % 2 === 1} />}
    </li>
  );
}

function OtherToolsSection() {
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  // Same set and layout as the Know Your Pet page's "One companion" section (every tool except this page's own),
  // so with three or more tools the cards turn in the same orbit.
  const tools = [
    ...(isShopEnabled ? [{ label: 'Shop Recipes', image: '/images/toolkit/shop-recipes.webp', text: 'Human-grade meals built around what your pet actually needs.', path: '/shop' }] : []),
    ...(isKnowYourPetEnabled ? [{ label: 'Know Your Pet', image: '/images/toolkit/know-your-pet.webp', text: "Understand your pet's characteristics and keep their profile information organised.", path: '/pets' }] : []),
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
        <ToolCarousel items={tools} />
      </div>
    </section>
  );
}

export function VetLandingPage() {
  // Remember that this landing page has been opened, so the home-page card can go straight to the feature next time.
  useEffect(() => {
    markLandingSeen('vet');
  }, []);

  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const FAQS = useLandingFaqs('vet', DEFAULT_FAQS);
  const hero = useLandingHero('vet_hero', DEFAULT_HERO);

  useDocumentMetadata(
    'Locate Your Vet',
    'Find veterinary clinics in your area and take the next step towards getting your companion the care they need.'
  );

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Locate Your Vet',
    description: 'Find veterinary clinics in your area and take the next step towards getting your companion the care they need.',
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
      <Header floatingUntilScroll activeTab="consultations" onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero */}
      <section data-scroll-hero className="relative w-full min-h-[100svh] overflow-hidden bg-midnight">
        <img
          src={getOptimizedImageUrl(hero.image, IMAGE_WIDTH.hero)}
          onError={originalOnError(hero.image)}
          alt="A veterinarian in a green coat gently examining a Doberman"
          className={`absolute inset-0 w-full h-full object-cover object-[78%_center] lg:object-center transition-opacity duration-500 ${hero.ready ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-28 sm:pb-28 max-w-5xl">
          <div className={`max-w-2xl space-y-4 text-left animate-fade-in-up ${hero.ready ? '' : 'invisible'}`}>
            <h1 className="font-script font-normal text-4xl sm:text-5xl md:text-6xl text-paper normal-case tracking-normal leading-[1.1] [text-shadow:0_2px_6px_rgba(0,0,0,0.85),0_4px_28px_rgba(0,0,0,0.8)]">
              {hero.title}
            </h1>
            <p className="font-body text-xs sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              {hero.subtitle}
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/consultations/app')}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Find Vets Near Me</span>
              </button>
            </div>
          </div>
        </div>
        {/* Blend the bottom of the photo into the section below so there is no hard edge. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 md:h-56 bg-gradient-to-t from-midnight via-midnight/70 to-transparent" />
        <HeroScrollHint />
    </section>

      {/* A connected journey from location search to contacting a clinic. */}
      <section aria-labelledby="vet-how-it-works" className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-3 mb-8">
            <h2 id="vet-how-it-works" className="font-script font-normal text-4xl sm:text-5xl lg:text-6xl tracking-normal text-turmeric leading-snug">How it works</h2>
            <p className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
              Three steps to a clinic near you.
            </p>
          </div>

          <ol className="relative mx-auto max-w-5xl">
            {STEPS.map((step, index) => <JourneyStep key={step.title} step={step} index={index} />)}
          </ol>
        </div>
      </section>

      <OtherToolsSection />

      {/* Closing CTA */}
      <section aria-labelledby="vet-cta-heading" className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper text-center">
        <div className="max-w-7xl mx-auto">
          <h2 id="vet-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl lg:text-[clamp(2rem,3.7vw,3.75rem)] lg:whitespace-nowrap tracking-normal leading-snug">
            The right care starts closer than you think
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg text-paper/90 leading-relaxed">
            Find the clinics around you and take the next step for your companion.
          </p>
          <button
            type="button"
            onClick={() => navigate('/consultations/app')}
            className="pet-profile-cta group relative isolate overflow-hidden inline-flex max-w-full items-center justify-center gap-3 sm:gap-5 mt-10 sm:mt-12 rounded-full border border-turmeric bg-turmeric px-6 sm:px-9 py-4 sm:py-5 font-display font-semibold text-base sm:text-lg text-ink shadow-[inset_0_0_0_2px_rgba(249,246,240,0.25)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]"
          >
            <span className="relative">Find vets near me</span>
            <ArrowRight aria-hidden="true" className="relative w-5 h-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="vet-faq-heading" className="px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-midnight text-paper">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 id="vet-faq-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
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
