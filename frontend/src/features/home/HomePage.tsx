import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Heart, Shield, Sparkles, ChevronRight, Activity, Database } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts } from '../../api/products';
import { Eyebrow } from '../../components/Eyebrow';
import { JournalCard } from '../../components/JournalCard';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';

export default function HomePage() {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // Auth Store
  const { user } = useAuthStore();

  // Calculator State
  const [dogName, setDogName] = useState('');
  const [dogWeight, setDogWeight] = useState<number | ''>('');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'active' | 'very_active'>('active');
  const [calcResult, setCalcResult] = useState<{
    calories: number;
    recommendedProduct: any | null;
  } | null>(null);

  // Queries - Fetch first 3 products for featured spotlight
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => fetchProducts({ limit: 3 }),
  });

  const featuredProducts = productsData?.items?.slice(0, 3) || [];





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

  // Recipe Fit Calculator Logic
  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dogWeight || dogWeight <= 0) return;

    // Weight in kg
    const weightInKg = Number(dogWeight) * 0.45359237;
    // RER (Resting Energy Requirement) = 70 * (weight in kg)^0.75
    const rer = 70 * Math.pow(weightInKg, 0.75);

    // MER (Maintenance Energy Requirement) factor
    let factor = 1.4; // active standard
    if (activityLevel === 'sedentary') factor = 1.0;
    if (activityLevel === 'very_active') factor = 1.8;

    const dailyCalories = Math.round(rer * factor);

    // Recommend based on activity and size
    let recProduct = null;
    if (productsData?.items && productsData.items.length > 0) {
      const items = productsData.items;
      if (activityLevel === 'very_active') {
        // High protein/calorie formula like Beef
        recProduct = items.find(p => p.name.toLowerCase().includes('beef')) || items[0];
      } else if (Number(dogWeight) < 18) {
        // Delicate digestive or fish formula like Salmon
        recProduct = items.find(p => p.name.toLowerCase().includes('salmon') || p.name.toLowerCase().includes('fish')) || items[0];
      } else {
        // Balanced standard formula like Chicken
        recProduct = items.find(p => p.name.toLowerCase().includes('chicken')) || items[0];
      }
    }

    setCalcResult({
      calories: dailyCalories,
      recommendedProduct: recProduct
    });
  };



  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        
        {/* Editorial Hero Section */}

        <section className="bg-gradient-to-br from-ink via-[#2E3C33] to-[#24352A] text-paper py-24 px-4 md:px-8 border-b border-cardboard relative overflow-hidden text-left">
          {/* Subtle blueprint graph background overlays */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#EBE0D0 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-cardboard border-opacity-10 hidden md:block"></div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6 animate-fade-in-up">
              {/* Pulsing Active Ticker Badge */}
              <div className="inline-flex items-center space-x-2 bg-paperLight bg-opacity-5 border border-cardboard border-opacity-25 px-3 py-1.5 rounded-none select-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-turmeric">KITCHEN LEDGER BATCH: ONLINE & ACTIVE 🟢</span>
              </div>

              <div className="border-t border-b border-dashed border-cardboard border-opacity-30 py-4 space-y-4">
                <Eyebrow label="est. 2019 — batch ledger cooking" />
                <h2 className="font-display text-4xl md:text-6xl font-extrabold text-turmeric leading-tight tracking-tight">
                  Honest Ingredients.<br/>
                  <span className="text-paperLight italic font-normal">
                    Zero Filler Secrets.
                  </span>
                </h2>
              </div>

              <p className="font-body text-sm md:text-base text-paper opacity-85 leading-relaxed max-w-xl">
                We formulated Scooby's Kitchen because transparency shouldn't require a magnifying glass. 
                We cook human-grade pet meals in documented small batches. No synthetic powders, 
                no rendering plant meals, and no hidden starches. Just real food prepared for families 
                who hold their dogs' nutrition to the same standards as their own.
              </p>

              <div className="pt-4 flex flex-wrap gap-4">
                <button 
                  onClick={() => navigate('/shop')}
                  className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-all shadow-sm active:translate-y-[1px] hover-bounce cursor-pointer"
                >
                  Explore Shop Recipes
                </button>
                <a 
                  href="#fit-calculator"
                  className="border border-cardboard border-opacity-40 text-paper hover:bg-paperLight hover:bg-opacity-10 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-colors flex items-center cursor-pointer"
                >
                  Configure My Dog's Diet
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 hover:scale-[1.02] hover:-rotate-1 transition-all duration-300 relative">
              <JournalCard
                tabLabel="DIAGNOSTIC NOTEBOOK"
                title="Kitchen Standard 01"
                stats={[
                  { label: 'HUMAN GRADE STATUS', value: '100% CERTIFIED' },
                  { label: 'BATCH LOG RECORDS', value: 'BLOCKCHAIN TRACEABLE' },
                  { label: 'REV. ARCHIVE COUNT', value: '400+ KITCHEN TRIALS' },
                  { label: 'TASTE COMPLIANCE', value: '100% TAIL WAG RATE' },
                ]}
              >
                "Every batch is cooked under the direct supervision of veterinary diet consultants, guaranteeing maximum bio-availability and zero allergen cross-contamination."
              </JournalCard>
            </div>
          </div>
        </section>

        {/* Feature Grid / Brand Philosophy */}
        <section className="bg-paper py-20 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto text-left space-y-12 animate-fade-in-up">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">// OUR QUALITY INDEX PROTOCOL</span>
              <h3 className="font-display font-black text-4xl uppercase tracking-tight text-ink">Built on Traceability</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-2 leading-relaxed">
                We believe pet nutrition isn't a trade secret. Every single batch bag we cook contains a detailed ledger of ingredient decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-default">
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Heart className="w-6 h-6 text-turmeric" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">Real Meat First</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Single-source premium proteins (Beef, Chicken, Salmon) form 80%+ of our formulations. No meat-meals or hidden byproducts are ever added.
                </p>
              </div>

              <div className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-default">
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Shield className="w-6 h-6 text-herb" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">Zero Starch Fillers</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Grain-free and potato-free formulations designed for active bio-absorption. No corn, soy, wheat, or synthetic colorings inside the bowl.
                </p>
              </div>

              <div className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-default">
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Sparkles className="w-6 h-6 text-ink" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">Veterinary Oversight</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Each formula batch is audited by certified pet nutrition specialists to ensure complex, life-stage-specific macro profile standards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Product Spotlight */}
        <section className="bg-paper py-16 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left border-b border-cardboard pb-6 animate-fade-in-up">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">// RECIPE SPOTLIGHT</span>
                <h3 className="font-display font-black text-4xl uppercase tracking-tight text-ink">Signature Formulations</h3>
                <p className="font-body text-xs text-ink opacity-70 mt-1">
                  Our veterinary-certified small batch recipes, cooked to perfection.
                </p>
              </div>
              <button 
                onClick={() => navigate('/shop')}
                className="font-mono text-[10px] uppercase font-bold text-turmeric hover:text-ink transition-colors flex items-center space-x-1.5 cursor-pointer group"
              >
                <span>View Full Product Ledger</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4 animate-pulse">
                    <div className="w-full aspect-[4/3] bg-paper border border-cardboard border-dashed"></div>
                    <div className="h-6 bg-paper w-3/4"></div>
                    <div className="h-4 bg-paper w-1/2"></div>
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
        <section className="bg-paperLight py-20 px-4 md:px-8 border-b border-cardboard border-opacity-30 relative" id="fit-calculator" style={{ backgroundImage: 'radial-gradient(#EBE0D0 1.2px, transparent 1.2px)', backgroundSize: '16px 16px' }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center text-left relative z-10">
            <div className="lg:col-span-5 space-y-4 animate-fade-in-up">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block">// DIAGNOSTIC CALCULATOR</span>
              <h3 className="font-display font-black text-4xl uppercase tracking-tight text-ink">Recipe Fit Calculator</h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                Pet nutrition is specific to body mass and active energy outputs. Input your dog's diagnostics to dynamically calculate their targeted caloric demands and find the formula suited to them.
              </p>
              <div className="border-l-2 border-dashed border-cardboard pl-4 py-2 space-y-2 font-mono text-[10px] text-ink opacity-75">
                <p>Formula base: RER = 70 * (wt_kg)^0.75</p>
                <p>Output MER = RER * activity_multiplier</p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-paper border border-cardboard p-8 rounded-none relative shadow-md">
              <form onSubmit={handleCalculate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Dog's Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Scooby" 
                      value={dogName}
                      onChange={(e) => setDogName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Weight (lbs)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 35" 
                      value={dogWeight}
                      onChange={(e) => setDogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Activity Output</label>
                  <select 
                    value={activityLevel}
                    onChange={(e: any) => setActivityLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                  >
                    <option value="sedentary">Sedentary (Couches & Walks)</option>
                    <option value="active">Active (Daily Runs & Playtime)</option>
                    <option value="very_active">Working/Sporting (Constant activity)</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold py-3.5 tracking-wider transition-colors hover-bounce cursor-pointer shadow-sm"
                >
                  Analyze Diagnostic Log
                </button>
              </form>

              {calcResult && (
                <div className="mt-6 border-t-2 border-dashed border-cardboard pt-6 space-y-4 animate-fade-in-up">
                  {/* Thermal Printer Receipt Style */}
                  <div className="bg-paperLight p-6 border-4 border-double border-cardboard relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-paperLight border-b border-dashed border-cardboard"></div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-cardboard">
                        <div className="text-left">
                          <span className="font-mono text-[9px] uppercase font-bold text-turmeric block">// CALCULATOR OUTPUT</span>
                          <span className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-65">SUBJECT: {dogName || 'N/A'} ({dogWeight} LBS)</span>
                        </div>
                        <Activity className="w-5 h-5 text-turmeric shrink-0" />
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] text-ink uppercase font-bold">DAILY DEMAND:</span>
                        <span className="font-mono font-bold text-lg text-ink">{calcResult.calories} kCal / day</span>
                      </div>
                    </div>
                  </div>

                  {calcResult.recommendedProduct ? (
                    <div className="space-y-3">
                      <span className="font-mono text-[9px] uppercase font-bold text-herb block">// RECOMMENDED RECIPE BLEND:</span>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border border-cardboard p-4 gap-4 bg-paperLight">
                        <div className="flex items-center space-x-3 text-left">
                          <img 
                            src={calcResult.recommendedProduct.image_url} 
                            alt={calcResult.recommendedProduct.name} 
                            className="w-12 h-12 object-cover border border-cardboard rounded-none"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=80&w=200';
                            }}
                          />
                          <div>
                            <h5 className="font-display font-bold text-xs text-ink">{calcResult.recommendedProduct.name}</h5>
                            <p className="font-body text-[10px] text-ink opacity-70">${calcResult.recommendedProduct.price} per lb</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAddToCart(calcResult.recommendedProduct.id)}
                          className="bg-turmeric text-ink font-mono text-[9px] font-bold uppercase px-4 py-2 rounded-none hover:bg-opacity-95 transition-colors cursor-pointer hover-bounce"
                        >
                          Add Recommended
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-xs text-ink opacity-70 text-left">
                      Load full product list in Shop to view matching recipes.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Feature Service Cards Section */}
        <section className="bg-paper py-20 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto space-y-12 text-left animate-fade-in-up">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">// INTEGRATED PET LEDGER</span>
              <h3 className="font-display font-black text-4xl uppercase tracking-tight text-ink">Explore the Ecosystem</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-2 leading-relaxed">
                Manage all aspects of your pet's dietary records, care consultations, and real-time AI assistance diagnostics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div 
                onClick={() => navigate('/pets')}
                className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-pointer group"
              >
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Database className="w-5 h-5 text-turmeric" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">Pets Health Ledger</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Log your pet's diagnostics, allergen sensitivities, weight trends, and profile details in one secure ledger database.
                </p>
                <div className="flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold text-turmeric pt-2">
                  <span>Manage Logs</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                </div>
              </div>

              <div 
                onClick={() => navigate('/consultations')}
                className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-pointer group"
              >
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Heart className="w-5 h-5 text-herb" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">Vet Consultations</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Schedule direct appointments and maintain records with certified veterinary professionals to audit your dog's custom diets.
                </p>
                <div className="flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold text-herb pt-2">
                  <span>Schedule Appointment</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                </div>
              </div>

              <div 
                onClick={() => navigate('/assistant')}
                className="border-double border-4 border-cardboard hover:border-turmeric hover:-translate-y-2 hover:shadow-lg transition-all duration-300 bg-paperLight p-8 rounded-none space-y-4 cursor-pointer group"
              >
                <div className="w-12 h-12 flex items-center justify-center border border-dashed border-cardboard bg-paper rounded-none mb-2">
                  <Sparkles className="w-5 h-5 text-turmeric" />
                </div>
                <h4 className="font-display text-lg font-bold uppercase tracking-tight text-ink">AI Assistant</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Get real-time dietary suggestions, recipe ingredient explanations, and general pet health guidance from our AI coach model.
                </p>
                <div className="flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold text-turmeric pt-2">
                  <span>Consult Assistant</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="py-12 bg-ink text-paper px-4 md:px-8 border-t border-cardboard border-opacity-20 text-center">
          <div className="max-w-7xl mx-auto space-y-4">
            <p className="font-mono text-[9px] uppercase tracking-wider">
              © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
            </p>
            <p className="font-body text-[10px] max-w-md mx-auto leading-relaxed opacity-75">
              Tested and crafted with love for pet parents who care about what goes in the bowl.
            </p>
          </div>
        </footer>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
