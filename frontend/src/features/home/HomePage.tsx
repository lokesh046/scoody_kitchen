import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, PawPrint, Heart, Shield, Sparkles, ChevronRight, Activity, Database } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { fetchProducts } from '../../api/products';
import { Eyebrow } from '../../components/Eyebrow';
import { JournalCard } from '../../components/JournalCard';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';

export default function HomePage() {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Auth Store
  const { user, clearAuth } = useAuthStore();

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



  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

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
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center md:grid md:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer md:col-span-3 justify-start select-none" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-6 h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[9px] uppercase tracking-wider text-turmeric opacity-85">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-paprika text-paperLight font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        
        {/* Editorial Hero Section */}
        <section className="bg-ink text-paper py-20 px-4 md:px-8 border-b border-cardboard border-opacity-20 text-left">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <Eyebrow label="est. 2019 — batch ledger cooking" />
              <h2 className="font-display text-4xl md:text-6xl font-extrabold text-paper leading-tight tracking-tight">
                Honest Ingredients.<br/>
                <span className="text-turmeric italic font-normal">
                  Zero Filler Secrets.
                </span>
              </h2>
              <p className="font-body text-sm md:text-base text-paper opacity-85 leading-relaxed max-w-xl">
                We formulated Scooby's Kitchen because transparency shouldn't require a magnifying glass. 
                We cook human-grade pet meals in documented small batches. No synthetic powders, 
                no rendering plant meals, and no hidden starches. Just real food prepared for families 
                who hold their dogs' nutrition to the same standards as their own.
              </p>
              <div className="pt-4 flex flex-wrap gap-4">
                <button 
                  onClick={() => navigate('/shop')}
                  className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider hover:bg-opacity-90 transition-all shadow-sm active:translate-y-[1px]"
                >
                  Explore Shop Recipes
                </button>
                <a 
                  href="#fit-calculator"
                  className="border border-cardboard border-opacity-50 text-paper hover:bg-paperLight hover:bg-opacity-10 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-colors flex items-center"
                >
                  Configure My Dog's Diet
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
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
        <section className="bg-paper py-16 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto text-left space-y-12">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">Our Core Standards</span>
              <h3 className="font-display text-3xl font-bold text-ink">Built on Traceability</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-2">
                We believe pet nutrition isn't a trade secret. Every bag contains a ledger of decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="border border-cardboard bg-paperLight p-8 rounded-none space-y-4">
                <Heart className="w-8 h-8 text-paprika" />
                <h4 className="font-display text-lg font-bold text-ink">Real Meat First</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Single-source proteins (Beef, Chicken, Salmon) form 80%+ of our formulations. No meat-meals or byproducts are ever added.
                </p>
              </div>

              <div className="border border-cardboard bg-paperLight p-8 rounded-none space-y-4">
                <Shield className="w-8 h-8 text-herb" />
                <h4 className="font-display text-lg font-bold text-ink">Zero Starch Fillers</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Grain-free and potato-free formulations designed for active bio-absorption. No corn, soy, wheat, or synthetic colorings.
                </p>
              </div>

              <div className="border border-cardboard bg-paperLight p-8 rounded-none space-y-4">
                <Sparkles className="w-8 h-8 text-turmeric" />
                <h4 className="font-display text-lg font-bold text-ink">Veterinary Oversight</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Each formula is audited by certified pet nutrition specialists to ensure complex, life-stage-specific macro profiles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Product Spotlight */}
        <section className="bg-paper py-16 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">Recipe Spotlight</span>
                <h3 className="font-display text-3xl font-bold text-ink">Signature Formulations</h3>
                <p className="font-body text-xs text-ink opacity-70 mt-1">
                  Our veterinary-certified small batch recipes, cooked to perfection.
                </p>
              </div>
              <button 
                onClick={() => navigate('/shop')}
                className="font-mono text-[10px] uppercase font-bold text-paprika hover:text-ink transition-colors flex items-center space-x-1.5"
              >
                <span>View Full Product Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
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
        <section className="bg-paperLight py-16 px-4 md:px-8 border-b border-cardboard border-opacity-30" id="fit-calculator">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center text-left">
            <div className="lg:col-span-5 space-y-4">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block">Interactive Diagnostic Tool</span>
              <h3 className="font-display text-3xl font-bold text-ink">Recipe Fit Calculator</h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                Pet nutrition is specific to body mass and active energy outputs. Input your dog's diagnostics to dynamically calculate their targeted caloric demands and find the formula suited to them.
              </p>
              <div className="border-l-2 border-dashed border-cardboard pl-4 py-2 space-y-3 font-mono text-[11px] text-ink opacity-75">
                <p>Formula base: RER = 70 * (wt_kg)^0.75</p>
                <p>Output MER = RER * activity_multiplier</p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-paper border border-cardboard p-8 rounded-none relative">
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
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric"
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
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Activity Output</label>
                  <select 
                    value={activityLevel}
                    onChange={(e: any) => setActivityLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric"
                  >
                    <option value="sedentary">Sedentary (Couches & Walks)</option>
                    <option value="active">Active (Daily Runs & Playtime)</option>
                    <option value="very_active">Working/Sporting (Constant activity)</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-ink text-paperLight font-mono text-[10px] uppercase font-bold py-3 tracking-wider hover:bg-opacity-90 transition-colors"
                >
                  Analyze Diagnostic Log
                </button>
              </form>

              {calcResult && (
                <div className="mt-6 border-t border-dashed border-cardboard pt-6 space-y-4 animate-fade-in-up">
                  <div className="flex justify-between items-center bg-paperLight p-4 border border-cardboard">
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-paprika">Calculated Daily Energy</span>
                      <h4 className="font-display font-bold text-lg text-ink">{calcResult.calories} kCal / day</h4>
                    </div>
                    <Activity className="w-6 h-6 text-turmeric" />
                  </div>

                  {calcResult.recommendedProduct ? (
                    <div className="space-y-3">
                      <span className="font-mono text-[10px] uppercase font-bold text-herb block">Recommended Recipe Blend:</span>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border border-cardboard p-4 gap-4 bg-paper">
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
                          className="bg-paprika text-paperLight font-mono text-[9px] font-bold uppercase px-3 py-1.5 rounded-none hover:bg-opacity-90 transition-colors"
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
        <section className="bg-paper py-16 px-4 md:px-8 border-b border-cardboard border-opacity-30">
          <div className="max-w-7xl mx-auto space-y-12 text-left">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-widest block mb-2">Explore the Ecosystem</span>
              <h3 className="font-display text-3xl font-bold text-ink">Integrated Pet Ledger</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-2">
                Manage all aspects of your pet's dietary records, care consults, and AI assistance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div 
                onClick={() => navigate('/pets')}
                className="border border-cardboard bg-paperLight p-8 rounded-none hover-paper-lift cursor-pointer space-y-4 text-left"
              >
                <div className="w-10 h-10 bg-paprika bg-opacity-10 border border-paprika flex items-center justify-center">
                  <Database className="w-5 h-5 text-paprika" />
                </div>
                <h4 className="font-display text-lg font-bold text-ink">Pets Health Ledger</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Log your pet's diagnostics, allergen sensitivities, weight trends, and profile details in one secure ledger database.
                </p>
                <span className="font-mono text-[9px] uppercase font-bold text-paprika block pt-2">Manage Logs &rarr;</span>
              </div>

              <div 
                onClick={() => navigate('/consultations')}
                className="border border-cardboard bg-paperLight p-8 rounded-none hover-paper-lift cursor-pointer space-y-4 text-left"
              >
                <div className="w-10 h-10 bg-herb bg-opacity-10 border border-herb flex items-center justify-center">
                  <Heart className="w-5 h-5 text-herb" />
                </div>
                <h4 className="font-display text-lg font-bold text-ink">Vet Consultations</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Schedule direct appointments and maintain records with certified veterinary professionals to audit your dog's custom diets.
                </p>
                <span className="font-mono text-[9px] uppercase font-bold text-herb block pt-2">Schedule Appointment &rarr;</span>
              </div>

              <div 
                onClick={() => navigate('/assistant')}
                className="border border-cardboard bg-paperLight p-8 rounded-none hover-paper-lift cursor-pointer space-y-4 text-left"
              >
                <div className="w-10 h-10 bg-turmeric bg-opacity-10 border border-turmeric flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-turmeric" />
                </div>
                <h4 className="font-display text-lg font-bold text-ink">AI Assistant</h4>
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  Get real-time dietary suggestions, recipe ingredient explanations, and general pet health guidance from our AI coach model.
                </p>
                <span className="font-mono text-[9px] uppercase font-bold text-turmeric block pt-2">Consult Assistant &rarr;</span>
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
