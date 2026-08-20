import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, LogOut, PawPrint } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { fetchProducts, fetchCategories } from '../../api/products';
import { Eyebrow } from '../../components/Eyebrow';
import { JournalCard } from '../../components/JournalCard';
import { RecipeCard } from '../../components/RecipeCard';
import { CartDrawer } from '../../components/CartDrawer';

export default function ShopPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

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

  const { user, clearAuth } = useAuthStore();

  // Queries
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products', search, selectedCategoryId],
    queryFn: () => fetchProducts({ search, categoryId: selectedCategoryId || undefined }),
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });



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

  const products = productsData?.items || [];



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
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors border-b-2 border-turmeric pb-1">Shop Recipes</button>
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

      {/* Centered Main Content Wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-center">
        <div className="lg:col-span-7 space-y-5 text-left">
          <Eyebrow label="original formula journal entry" />
          <h2 className="font-display text-3xl md:text-5xl font-bold text-ink leading-tight">
            Human-Grade Pet Recipes.{' '}
            <span className="text-paprika italic font-normal block md:inline">
              Formulated over 7 years
            </span>{' '}
            of kitchen testing.
          </h2>
          <p className="font-body text-sm md:text-base text-ink opacity-90 leading-relaxed max-w-xl">
            We believe transparency isn’t a marketing slogan; it’s a ledger of choices. 
            Every single batch is cooked under human-grade standards with zero fillers, 
            zero secret byproducts, and 100% trace-ready ingredients. Honest food 
            designed by a pet parent, for pet parents.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button onClick={() => {
              const el = document.getElementById('product-ledger-heading');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }} className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-6 py-3 rounded-sm tracking-wide hover:bg-opacity-95 transition-all shadow-sm active:translate-y-[1px] active:shadow-none">
              Shop the Recipes
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <JournalCard
            tabLabel="ENTRY — VOL. 07"
            title="Formula Diagnostics"
            stats={[
              { label: 'TESTING PERIOD', value: '7 YEARS' },
              { label: 'BATCH TYPE', value: 'SMALL BATCH KRAFT' },
              { label: 'FILLERS & BYPRODUCTS', value: '0.00%' },
              { label: 'INGREDIENT TRANSPARENCY', value: '100.0%' },
              { label: 'APPROVED BY', value: 'SCOOBY THE DOG' },
            ]}
          >
            "Tested through 400+ revisions. The recipe was born from a search for clean, single-source meat food when Scooby began showing diet sensitivities."
          </JournalCard>
        </div>
      </section>

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
          <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold mr-2 flex items-center">
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
          <div className="max-w-md mx-auto border border-paprika bg-paperLight p-8 rounded-sm text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="font-mono text-lg font-bold text-paprika">!</span>
            </div>
            <h4 className="font-display font-bold text-lg text-ink mb-2">Failed to Read Ledger</h4>
            <p className="font-body text-xs text-ink opacity-80 mb-6">
              Could not retrieve products from the database service. Verify the backend container is running.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2 rounded-sm tracking-wide"
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
        <p className="font-mono text-[9px] uppercase tracking-wider">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
        <p className="font-body text-[10px] mt-1 max-w-md mx-auto leading-relaxed">
          Tested and crafted with love for pet parents who care about what goes in the bowl.
        </p>
      </footer>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
