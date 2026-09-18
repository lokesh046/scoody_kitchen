import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, Shield, Sparkles, ChevronRight, 
  Activity, Database, ArrowRight, Check
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts } from '../../api/products';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { Eyebrow } from '../../components/Eyebrow';
import { HomeBannerCarousel } from '../../components/HomeBannerCarousel';
import { ReviewsCarousel } from '../../components/ReviewsCarousel';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

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
  useDocumentMetadata(
    "Honest Small-Batch Pet Cooking",
    "Human-grade, small-batch pet food cooked under veterinary supervision. Transparent recipes for pet parents who care."
  );

  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // Feature Flags
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const isShopEnabled = useFeatureFlag('shop_checkout', true);

  // Auth Store
  const { user } = useAuthStore();

  // Calculator State
  const [dogName, setDogName] = useState('');
  const [dogWeight, setDogWeight] = useState<number | ''>(35);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'active' | 'very_active'>('active');
  const [isAddingRecommended, setIsAddingRecommended] = useState(false);
  const [isAddedRecommended, setIsAddedRecommended] = useState(false);

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
      {/* Full-width Top Navigation Header bar */}
      <Header onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        {/* Centered Peeking Banner Carousel */}
        <HomeBannerCarousel />

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left border-b border-cardboard pb-6 animate-fade-in-up">
              <div className="space-y-2">
                <Eyebrow label="FRESH FORMULATIONS" />
                <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink">
                  Signature Recipes
                </h2>
                <p className="font-body text-sm text-ink opacity-75">
                  Veterinary-audited small batch recipes, cooked to biological perfection.
                </p>
              </div>
              {isShopEnabled && (
                <button 
                  onClick={() => navigate('/shop')}
                  className="font-mono text-xs uppercase font-bold text-turmeric hover:text-ink transition-colors flex items-center space-x-1.5 cursor-pointer group"
                >
                  <span>View Full Product Ledger</span>
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              )}
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
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Interactive Recipe Calculator Section */}
        <section 
          className="bg-paperLight py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35 relative" 
          id="fit-calculator" 
          style={{ backgroundImage: 'radial-gradient(#EBE0D0 1.2px, transparent 1.2px)', backgroundSize: '16px 16px' }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center text-left relative z-10">
            <div className="lg:col-span-5 space-y-5 animate-fade-in-up">
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
                        className={`font-mono text-[10px] uppercase px-3 py-1.5 rounded-[8px] transition-all cursor-pointer font-bold border ${
                          isSelected
                            ? 'bg-turmeric text-ink border-turmeric shadow-xs scale-102'
                            : 'bg-paper text-ink opacity-85 border-cardboard hover:border-turmeric hover:opacity-100'
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
                  className="inline-flex items-center space-x-2 bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold px-5 py-3 rounded-[10px] tracking-wider transition-all hover-bounce cursor-pointer shadow-xs active:scale-98"
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
                    <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Dog's Name (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Scooby" 
                      value={dogName}
                      onChange={(e) => setDogName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Weight (lbs)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 35" 
                      value={dogWeight}
                      onChange={(e) => setDogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                      min="1"
                      className="w-full px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Daily Activity Output</label>
                  <select 
                    value={activityLevel}
                    onChange={(e: any) => setActivityLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-cardboard rounded-[10px] bg-paperLight font-body text-sm text-ink focus:outline-hidden focus:border-turmeric focus:ring-2 focus:ring-turmeric/20 transition-all cursor-pointer"
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
                          className={`font-mono text-[10px] font-bold uppercase px-4 py-2.5 rounded-[8px] transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
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

        {/* Feature Service Cards Section */}
        <section className="bg-paper py-16 md:py-24 px-4 sm:px-6 md:px-8 border-b border-cardboard border-opacity-35">
          <div className="max-w-7xl mx-auto space-y-12 text-left animate-fade-in-up">
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
              <div 
                onClick={() => navigate('/pets')}
                className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                    <Database className="w-6 h-6 text-turmeric" />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">PORTAL // 01</span>
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

              {isConsultationsEnabled && (
                <div 
                  onClick={() => navigate('/consultations')}
                  className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-herb transition-colors">
                      <Heart className="w-6 h-6 text-herb" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">CLINICAL // 02</span>
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
              )}

              {isChatbotEnabled && (
                <div 
                  onClick={() => navigate('/assistant')}
                  className="border border-cardboard hover:border-turmeric hover-paperLift bg-paperLight p-6 sm:p-8 rounded-[16px] space-y-4 cursor-pointer group shadow-sm transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-[12px] group-hover:border-turmeric transition-colors">
                      <Sparkles className="w-6 h-6 text-turmeric" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-cardboard font-bold">AI COACH // 03</span>
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
              )}
            </div>
          </div>
        </section>

        {/* Let our #Scoobysfam speak for us Carousel */}
        <ReviewsCarousel />
        
        {/* Polished Footer with Navigation Ledger */}
        <footer className="py-14 bg-ink text-paper px-4 sm:px-6 md:px-8 border-t border-cardboard border-opacity-20 text-center">
          <div className="max-w-7xl mx-auto space-y-8 flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 logo-medallion flex items-center justify-center p-1 overflow-hidden mb-1 shadow-lg">
              <img
                src="/scooby-logo-256.png"
                alt="Scooby's Kitchen Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain select-none"
              />
            </div>
            
            <div className="space-y-2">
              <p className="font-display font-black text-2xl text-paper tracking-tight">
                Scooby's Kitchen
              </p>
              <p className="font-body text-xs max-w-md mx-auto leading-relaxed text-paper opacity-75">
                Transparent small-batch pet wellness, human-grade meal formulations, and clinical telemedicine.
              </p>
            </div>

            {/* Quick Links Navigation Ledger */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 font-mono text-[11px] uppercase tracking-wider text-turmeric font-bold pt-2 border-t border-b border-cardboard/20 py-4 w-full max-w-2xl">
              <button onClick={() => navigate('/shop')} className="hover:text-white transition-colors cursor-pointer">Shop Meals</button>
              <button onClick={() => navigate('/pets')} className="hover:text-white transition-colors cursor-pointer">Pet Ledger</button>
              <button onClick={() => navigate('/consultations')} className="hover:text-white transition-colors cursor-pointer">Telehealth</button>
              <button onClick={() => navigate('/assistant')} className="hover:text-white transition-colors cursor-pointer">AI Coach</button>
              <button onClick={() => navigate('/onboarding')} className="hover:text-white transition-colors cursor-pointer">Diet Planner</button>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-wider text-cardboard opacity-75">
              © {new Date().getFullYear()} Scooby's Kitchen. Crafted with care for pet parents everywhere.
            </p>
          </div>
        </footer>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
