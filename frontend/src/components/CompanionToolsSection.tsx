import { useFeatureFlag, useVetEntryEnabled } from '../hooks/useFeatureFlag';
import { ToolCarousel, type ToolCarouselItem } from './ToolCarousel';

export type CompanionToolKey = 'shop' | 'pets' | 'vet' | 'calories' | 'assistant';

const HEADING = 'One companion. Different aspects of their care';

// The "One companion. Different aspects of their care." band: the tool cards that link to the rest of the site.
// One shared copy for every page. Pass `exclude` to leave out the page's own tool. Each tool only shows while its
// feature is on, so hiding a feature in the admin removes its card here as well.
export function CompanionToolsSection({ exclude, matchStepCards = true, stepColumns = 4, className = '' }: {
  exclude?: CompanionToolKey;
  matchStepCards?: boolean;
  stepColumns?: 3 | 4;
  className?: string;
}) {
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isVetEnabled = useVetEntryEnabled();
  const isCalorieCounterEnabled = useFeatureFlag('shop_calorie_counter', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  const tools: (ToolCarouselItem & { key: CompanionToolKey; on: boolean })[] = [
    { key: 'shop', on: isShopEnabled, label: 'Shop Recipes', image: '/images/toolkit/shop-recipes.webp', text: 'Human-grade meals built around what your pet actually needs.', path: '/shop' },
    { key: 'pets', on: isKnowYourPetEnabled, label: 'Know Your Pet', image: '/images/toolkit/know-your-pet.webp', text: "Understand your pet's characteristics and keep their profile information organised.", path: '/pets' },
    { key: 'vet', on: isVetEnabled, label: 'Vet Consults', image: '/images/toolkit/vet-consults.webp', text: 'Book time with a veterinarian when something needs a professional look.', path: '/consultations' },
    { key: 'calories', on: isCalorieCounterEnabled, label: 'Count Their Calories', image: '/images/toolkit/meal-planner.webp', text: "Estimate your pet's daily energy needs from their profile.", path: '/recipe-calculator#fit-calculator' },
    { key: 'assistant', on: isChatbotEnabled, label: 'Bravo AI', image: '/images/toolkit/ai-assistant.webp', text: 'Talk to Bravo and get answers to your pet care questions.', path: '/assistant', cta: 'Talk to Bravo' },
  ];
  const items = tools.filter((t) => t.on && t.key !== exclude).map(({ key: _key, on: _on, ...item }) => item);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="companion-tools-heading" className={`px-4 sm:px-6 md:px-8 py-8 md:py-10 bg-midnight text-paper ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="max-w-6xl mx-auto text-center space-y-3 mb-8">
          <h2 id="companion-tools-heading" className="font-script font-normal text-3xl sm:text-4xl lg:text-[clamp(2rem,3.7vw,3.75rem)] lg:whitespace-nowrap tracking-normal leading-snug">
            <span className="sr-only">{HEADING}</span>
            <span aria-hidden="true">
              {HEADING.split(' ').map((word, index) => (
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
        <ToolCarousel items={items} matchStepCards={matchStepCards} stepColumns={stepColumns} />
      </div>
    </section>
  );
}
