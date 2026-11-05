import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Minus, Scale, Activity, ClipboardList } from 'lucide-react';
import { Header } from '../../components/Header';
import { SiteFooter } from '../../components/SiteFooter';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { ToolCarousel } from '../../components/ToolCarousel';
import { RouteUnavailable } from '../../components/RouteUnavailable';
import { RecipeCalculator } from './RecipeCalculator';
import { useFeatureFlag, useFlagEntry, useVetEntryEnabled } from '../../hooks/useFeatureFlag';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';

const PAGE_TITLE = 'Recipe Calculator';
const PAGE_DESCRIPTION = "Estimate your dog's daily energy needs from their weight and activity level, then see a recipe that fits.";

const STEPS = [
  { icon: Scale, title: 'Tell us their size', text: "Pick a size preset, or enter your dog's exact weight in pounds." },
  { icon: Activity, title: 'Choose how active they are', text: 'From relaxed walks to daily training, activity changes how much energy they use.' },
  { icon: ClipboardList, title: 'Read the estimate', text: 'You get an estimated daily energy figure and a recipe from our range that suits their size.' },
];

const GOOD_TO_KNOW = [
  { title: 'It is an estimate', text: "The figure comes from a standard formula for a typical adult dog. It is a starting point for thinking about portions, not an exact prescription." },
  { title: 'Every dog is different', text: 'Age, health, breed, and whether your dog is neutered all change real energy needs, and the calculator does not account for them.' },
  { title: 'Your vet knows best', text: 'If your dog has a health condition, is a puppy, is a senior, or is losing or gaining weight, talk to a veterinarian about how much to feed.' },
];

const FAQS = [
  {
    q: 'How is the daily figure worked out?',
    a: "It starts from a standard resting-energy formula based on your dog's weight, then multiplies it by a factor for their activity level. The formula is shown beside the calculator so you can see exactly what it does.",
  },
  {
    q: 'Is the result what I should feed every day?',
    a: 'No. It is an estimate for a typical adult dog. Real needs vary with age, health, breed, and lifestyle, so treat it as a starting point and watch how your dog does.',
  },
  {
    q: 'Why does it suggest a particular recipe?',
    a: "The suggestion follows your dog's size and activity level and picks a recipe from our range to match. It is a convenient shortcut, not a veterinary recommendation.",
  },
  {
    q: 'Do you store the details I enter?',
    a: "The calculator works out the figure from what you type on the page. Your dog's name is only used to label the result.",
  },
  {
    q: 'Can this replace advice from my vet?',
    a: 'No. The calculator helps you understand the numbers behind a feeding routine. It does not replace advice, diagnosis, or treatment from a qualified veterinarian.',
  },
];

function OtherToolsSection() {
  const isConsultationsEnabled = useVetEntryEnabled();
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);

  const tools = [
    ...(isKnowYourPetEnabled ? [{ label: 'Know Your Pet', image: '/images/toolkit/know-your-pet.webp', text: "Keep your companion's details and health records in one place.", path: '/pets' }] : []),
    ...(isConsultationsEnabled ? [{ label: 'Vet Consults', image: '/images/toolkit/vet-consults.webp', text: 'Book time with a veterinarian when something needs a professional look.', path: '/consultations' }] : []),
    ...(isChatbotEnabled ? [{ label: 'AI Assistant', image: '/images/toolkit/ai-assistant.webp', text: 'Ask questions about nutrition and everyday pet care.', path: '/assistant' }] : []),
  ];

  if (tools.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-midnight text-paper">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
          <h2 className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
            Feeding is one part of their care.
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

export function RecipeCalculatorPage() {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // The calculator follows the same switch as the rest of the meal planner. While it is off, a
  // direct visit shows only its status (Coming soon / Unavailable), like the Shop and Vet pages.
  const entry = useFlagEntry('shop_meal_planner');

  useDocumentMetadata(PAGE_TITLE, PAGE_DESCRIPTION);

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

  if (entry.blocked) {
    return (
      <RouteUnavailable
        variant={entry.variant}
        activeTab="calculator"
        title={entry.variant === 'coming_soon' ? 'Recipe Calculator: Coming soon' : 'Recipe Calculator: Unavailable'}
        actionLabel="Back to Home"
        actionPath="/"
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header floatingUntilScroll activeTab="calculator" onCartToggle={() => setIsCartOpen(true)} />

      {/* Hero */}
      <section data-scroll-hero className="relative w-full overflow-hidden bg-midnight">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center px-4 sm:px-8 md:px-12 pt-32 pb-16 sm:pb-20 lg:pt-40 lg:pb-24">
          <div className="space-y-5 text-left animate-fade-in-up">
            <p className="font-mono text-sm sm:text-base uppercase tracking-widest text-turmeric">Metabolic Sizing Engine</p>
            <h1 className="font-script font-normal text-5xl sm:text-6xl md:text-7xl text-paper tracking-normal leading-[1.1]">
              The Recipe Calculator
            </h1>
            <p className="font-body text-sm sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              Enter your dog's weight and how active they are, and get an estimate of their daily energy needs, with a recipe from our range that suits their size.
            </p>
            <div className="pt-2">
              <button
                onClick={() => document.getElementById('fit-calculator')?.scrollIntoView({ behavior: 'smooth' })}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Try the calculator</span>
              </button>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px] lg:max-w-[480px] rounded-[24px] bg-paperLight p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <img
                src="/images/toolkit/meal-planner.webp"
                alt="An illustration of a dog bowl filled with chicken and vegetables, beside a calendar and a dial"
                width={800}
                height={800}
                loading="eager"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* The calculator itself */}
      <RecipeCalculator />

      {/* How it works */}
      <section aria-labelledby="calc-how-heading" className="bg-paper px-4 py-16 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 id="calc-how-heading" className="font-script text-3xl font-normal tracking-normal leading-snug text-ink sm:text-4xl lg:text-5xl">
              Three quick steps.
            </h2>
            <p className="mx-auto mt-4 max-w-lg font-body text-sm leading-relaxed text-ink/75">
              It takes under a minute, and you do not need an account to try it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-turmeric border border-turmeric border-opacity-40 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <Icon aria-hidden="true" className="w-5 h-5 text-turmeric" />
                  </div>
                  <h3 className="font-display font-bold text-base text-ink">{step.title}</h3>
                  <p className="font-body text-sm text-ink opacity-75 leading-relaxed">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Good to know -- keeps the estimate in proportion */}
      <section aria-labelledby="calc-know-heading" className="px-4 sm:px-6 md:px-8 py-16 md:py-20 bg-gradient-to-b from-midnight via-midnightCard to-midnight text-paper">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <p className="font-mono text-sm sm:text-base uppercase tracking-widest text-turmeric">Good to know</p>
            <h2 id="calc-know-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-5xl tracking-normal leading-snug">
              A starting point, not a prescription.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GOOD_TO_KNOW.map((item) => (
              <div key={item.title} className="rounded-[20px] border border-paper/10 bg-midnightCard p-6 sm:p-7 space-y-2 text-left">
                <h3 className="font-display font-bold text-base text-paper">{item.title}</h3>
                <p className="font-body text-sm text-paper/75 leading-relaxed">{item.text}</p>
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
      <section aria-labelledby="calc-cta-heading" className="px-4 sm:px-6 md:px-8 py-20 sm:py-24 md:py-28 bg-gradient-to-b from-midnightCard to-midnight text-paper text-center">
        <div className="max-w-4xl mx-auto">
          <h2 id="calc-cta-heading" className="font-script font-normal text-4xl sm:text-5xl md:text-6xl tracking-normal leading-snug">
            Want to go further?
          </h2>
          <p className="max-w-xl mx-auto mt-6 sm:mt-8 font-body text-base sm:text-lg md:text-xl text-paper/65 leading-relaxed">
            The step-by-step diet planner walks through your dog's details one question at a time.
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="pet-profile-cta group relative isolate overflow-hidden inline-flex max-w-full items-center justify-center gap-3 sm:gap-5 mt-10 sm:mt-12 rounded-full border border-turmeric bg-turmeric px-6 sm:px-9 py-4 sm:py-5 font-display font-semibold text-base sm:text-lg text-ink shadow-[inset_0_0_0_2px_rgba(249,246,240,0.25)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98]"
          >
            <span className="relative">Open the diet planner</span>
            <ArrowRight aria-hidden="true" className="relative w-5 h-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      <SiteFooter />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
