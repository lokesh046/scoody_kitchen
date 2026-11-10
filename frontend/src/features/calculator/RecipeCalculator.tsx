import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, Check } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts } from '../../api/products';
import { useRecipeOrdering } from '../../hooks/useRecipeOrdering';

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

// The calculator section (Count Their Calories). It used to be a section of the home page; it now lives on its own
// page (/recipe-calculator). The maths and the wording are unchanged from the home page version.
export function RecipeCalculator() {
  const ordering = useRecipeOrdering();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const addItem = useCartStore((state) => state.addItem);

  const [dogName, setDogName] = useState('');
  const [dogWeight, setDogWeight] = useState<number | ''>(35);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'active' | 'very_active'>('active');
  const [isAddingRecommended, setIsAddingRecommended] = useState(false);
  const [isAddedRecommended, setIsAddedRecommended] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => fetchProducts({ limit: 12 }),
    staleTime: 5 * 60 * 1000,
  });

  // Daily calories and the recipe suggested for them.
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

    return { calories: dailyCalories, recommendedProduct: recProduct };
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
      console.error('Failed to add recommended item to cart:', err);
    } finally {
      setIsAddingRecommended(false);
    }
  };

  return (
    <section
      className="bg-paper py-8 md:py-10 px-4 sm:px-6 md:px-8 relative scroll-mt-20 md:scroll-mt-24"
      id="fit-calculator"
      style={{
        backgroundImage: 'radial-gradient(rgba(208,158,107,0.18) 1.2px, transparent 1.2px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="max-w-6xl mx-auto text-left relative z-10">
      <h2 className="mb-8 md:mb-10 font-script font-normal text-3xl sm:text-4xl lg:text-[clamp(2rem,3.7vw,3.75rem)] tracking-normal text-ink leading-snug">
        Count Their Calories
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-5 space-y-5">
          <p className="font-body text-base lg:text-lg text-ink opacity-80 leading-relaxed">
            Pet nutrition is directly proportional to body mass and daily energy output. Pick your dog's size or enter their exact weight to calculate targeted caloric requirements in real time.
          </p>

          <div className="space-y-2 pt-2">
            <span className="font-mono text-xs sm:text-sm uppercase font-bold text-ink opacity-70 block">
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
                    className={`min-h-[44px] inline-flex items-center justify-center font-mono text-xs sm:text-sm uppercase px-4 py-2.5 rounded-[8px] transition-all cursor-pointer font-bold border ${
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

          <div className="border border-dashed border-ink border-opacity-20 p-3 space-y-1 font-mono text-xs sm:text-sm text-ink opacity-75 rounded-xl">
            <p>Formula base: RER = 70 × (weight_kg)⁰·⁷⁵</p>
            <p>Output MER = RER × activity_multiplier</p>
          </div>
        </div>

        <div className="lg:col-span-7 bg-paperLight border border-ink border-opacity-15 p-6 sm:p-8 rounded-[20px] relative">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="calc-dog-name" className="font-mono text-xs sm:text-sm uppercase font-bold text-ink opacity-80 block">Dog's Name (Optional)</label>
                <input
                  id="calc-dog-name"
                  type="text"
                  placeholder="e.g. Scooby"
                  value={dogName}
                  onChange={(e) => setDogName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-transparent font-body text-base text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="calc-dog-weight" className="font-mono text-xs sm:text-sm uppercase font-bold text-ink opacity-80 block">Weight (lbs)</label>
                <input
                  id="calc-dog-weight"
                  type="number"
                  placeholder="e.g. 35"
                  value={dogWeight}
                  onChange={(e) => setDogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                  min="1"
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-transparent font-body text-base text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="calc-activity-level" className="font-mono text-xs sm:text-sm uppercase font-bold text-ink opacity-80 block">Daily Activity Output</label>
              <select
                id="calc-activity-level"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as 'sedentary' | 'active' | 'very_active')}
                className="w-full min-h-[44px] px-3.5 py-2.5 border border-ink border-opacity-20 rounded-[10px] bg-paperLight font-body text-base text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all cursor-pointer"
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
                    <span className="font-mono text-xs sm:text-sm uppercase font-bold text-turmeric block flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-turmeric animate-pulse inline-block" />
                      <span>Diagnostic Output</span>
                    </span>
                    <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-ink opacity-60">
                      SUBJECT: {dogName.trim() ? dogName.trim().toUpperCase() : 'CANINE COMPANION'} ({dogWeight} LBS)
                    </span>
                  </div>
                  <Activity className="w-5 h-5 text-turmeric shrink-0" />
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="font-mono text-sm sm:text-base text-ink uppercase font-bold">Target Daily Demand:</span>
                  <span className="font-mono font-black text-3xl sm:text-5xl text-ink">
                    {calcResult.calories} <span className="text-base sm:text-lg font-semibold opacity-70">kCal / day</span>
                  </span>
                </div>
              </div>

              {calcResult.recommendedProduct && (
                <div className="space-y-2.5">
                  <span className="font-mono text-xs sm:text-sm uppercase font-bold text-turmeric block">
                    RECOMMENDED RECIPE FORMULATION:
                  </span>
                  <div className="relative">
                  <div
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border border-ink border-opacity-15 p-4 gap-4 rounded-[14px] hover:border-turmeric transition-colors ${
                      ordering === 'teaser' ? 'pointer-events-none select-none opacity-70 blur-[3px]' : ''
                    }`}
                  >
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
                        <h4 className="font-display font-bold text-base sm:text-lg text-ink">{calcResult.recommendedProduct.name}</h4>
                        <p className="font-mono text-sm sm:text-base text-turmeric font-bold">₹{parseFloat(calcResult.recommendedProduct.price).toFixed(2)} per lb</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (calcResult.recommendedProduct && ordering === 'on') {
                          handleAddRecommended(calcResult.recommendedProduct.id);
                        }
                      }}
                      disabled={isAddingRecommended || ordering !== 'on'}
                      className={`min-h-[44px] font-mono text-xs sm:text-sm font-bold uppercase px-5 py-3 rounded-[8px] transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
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
                        <span>{ordering === 'unavailable' ? 'Unavailable' : 'Add Recommended'}</span>
                      )}
                    </button>
                  </div>
                  {ordering === 'teaser' && (
                    <div
                      aria-label={`${calcResult.recommendedProduct.name}: Coming soon`}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-[14px] text-center"
                    >
                      <div className="w-full border-y border-turmeric/40 bg-midnight/90 px-6 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                        <p className="font-script text-2xl sm:text-3xl font-normal text-turmeric">Coming soon</p>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
