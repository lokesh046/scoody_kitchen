import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, PawPrint } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { fetchProducts, fetchCategories, fetchCategoryById } from '../../api/products';
import { Eyebrow } from '../../components/Eyebrow';
import { JournalCard } from '../../components/JournalCard';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';

export default function ShopPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

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

  const { user } = useAuthStore();

  // Queries
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products', search, selectedCategoryId],
    queryFn: () => fetchProducts({ search, categoryId: selectedCategoryId || undefined }),
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: categoryDetails } = useQuery({
    queryKey: ['categoryDetails', selectedCategoryId],
    queryFn: () => fetchCategoryById(selectedCategoryId!),
    enabled: selectedCategoryId !== null,
  });





  const products = productsData?.items || [];



  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Landing Content */}
      <main className="flex-grow w-full">
        
        {/* Editorial Hero Section */}
        <section className="bg-gradient-to-br from-ink via-[#2E3C33] to-[#24352A] text-paper py-24 px-4 md:px-8 border-b border-cardboard relative overflow-hidden text-left mb-12">
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
                  onClick={() => {
                    const el = document.getElementById('product-ledger-heading');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-all shadow-sm active:translate-y-[1px] hover-bounce cursor-pointer"
                >
                  Explore Shop Recipes
                </button>
                <button
                  onClick={() => {
                    navigate('/#fit-calculator');
                    setTimeout(() => {
                      const el = document.getElementById('fit-calculator');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }}
                  className="border border-cardboard border-opacity-40 text-paper hover:bg-paperLight hover:bg-opacity-10 font-body font-bold text-xs uppercase px-8 py-4 rounded-none tracking-wider transition-colors flex items-center cursor-pointer"
                >
                  Configure My Dog's Diet
                </button>
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

        {/* Centered Main Content Wrapper */}
        <div className="max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Shop / Feed Section */}
      <section className="space-y-8" id="product-ledger-heading">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cardboard pb-6 gap-4">
          <div className="text-left">
            <h3 className="font-display text-2xl font-bold text-ink">
              The Product Ledger
            </h3>
            <p className="font-body text-xs text-ink opacity-70">
              Browse our small-batch recipes and active nutritional formulas.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipes (e.g. Chicken)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-paprika font-bold mr-2 flex items-center">
            <PawPrint className="w-3 h-3 mr-1" /> Filters:
          </span>
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`font-body text-xs font-bold px-3 py-1.5 rounded-sm border uppercase transition-colors ${
              selectedCategoryId === null
                ? 'bg-ink text-paperLight border-ink'
                : 'border-cardboard text-ink hover:bg-paperLight'
            }`}
          >
            Show All
          </button>
          {!categoriesLoading &&
            categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`font-body text-xs font-bold px-3 py-1.5 rounded-sm border uppercase transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'bg-ink text-paperLight border-ink'
                    : 'border-cardboard text-ink hover:bg-paperLight'
                }`}
              >
                {cat.name}
              </button>
            ))}
        </div>

        {/* Category Description Banner */}
        {selectedCategoryId !== null && categoryDetails && (
          <div className="p-6 border border-cardboard bg-paperLight rounded-sm shadow-sm space-y-2 text-left animate-fade-in-up">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">CATEGORY HIGHLIGHT</span>
            <h3 className="font-display font-bold text-2xl text-ink uppercase tracking-tight">{categoryDetails.name}</h3>
            {categoryDetails.description ? (
              <p className="font-body text-sm text-ink opacity-90 leading-relaxed italic">
                "{categoryDetails.description}"
              </p>
            ) : (
              <p className="font-body text-xs text-ink opacity-60 italic">
                No description logged for this recipe category.
              </p>
            )}
          </div>
        )}

        {/* Product Grid / States */}
        {productsLoading ? (
          /* Stylized Notebook Grid Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="border border-cardboard bg-paperLight p-6 rounded-sm space-y-4 animate-pulse">
                <div className="w-full aspect-[4/3] bg-paper border border-cardboard border-dashed"></div>
                <div className="h-6 bg-paper w-3/4 rounded-sm"></div>
                <div className="h-4 bg-paper w-1/2 rounded-sm"></div>
                <div className="border-t border-dashed border-cardboard pt-4">
                  <div className="h-3 bg-paper w-full rounded-sm mb-2"></div>
                  <div className="h-3 bg-paper w-5/6 rounded-sm"></div>
                </div>
              </div>
            ))}
          </div>
        ) : productsError ? (
          /* Notebook Error Card */
          <div className="max-w-md mx-auto border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="font-mono text-lg font-bold text-paprika">!</span>
            </div>
            <h4 className="font-display font-bold text-lg text-ink mb-2">Failed to Read Ledger</h4>
            <p className="font-body text-xs text-ink opacity-80 mb-6">
              Could not retrieve products from the database service. Verify the backend container is running.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2 rounded-sm tracking-wide cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : products.length === 0 ? (
          /* Empty State invitation to act */
          <div className="max-w-md mx-auto border border-cardboard border-dashed p-10 rounded-sm text-center">
            <h4 className="font-display font-bold text-lg text-ink mb-2">Empty Notebook Page</h4>
            <p className="font-body text-xs text-ink opacity-70 mb-4">
              No recipes match your filter search tags. Try relaxing your filters.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategoryId(null);
              }}
              className="text-herb underline font-mono text-[10px] uppercase font-bold tracking-wider hover:text-ink transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* Recipe Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <RecipeCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
        <p className="font-body text-xs mt-1 max-w-md mx-auto leading-relaxed">
          Tested and crafted with love for pet parents who care about what goes in the bowl.
        </p>
      </footer>
      </div>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
