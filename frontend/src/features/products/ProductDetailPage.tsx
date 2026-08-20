import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProductById } from '../../api/products';
import { useAuthStore } from '../../store/auth';
import { logoutUser } from '../../api/auth';
import { IngredientLedger, getIngredientsForProduct } from '../../components/IngredientLedger';
import { Eyebrow } from '../../components/Eyebrow';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, Bone, 
  Minus, Plus, ShieldCheck, Heart, AlertCircle, Loader2 
} from 'lucide-react';
import { useCartStore } from '../../store/cart';
import { CartDrawer } from '../../components/CartDrawer';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { user, clearAuth } = useAuthStore();
  const [quantity, setQuantity] = useState(1);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Parse ID
  const productId = id ? parseInt(id, 10) : NaN;

  // Query product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductById(productId),
    enabled: !isNaN(productId),
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

  const handleIncrement = () => {
    if (product && product.available_stock !== null && product.available_stock !== undefined) {
      if (quantity < product.available_stock) {
        setQuantity(prev => prev + 1);
      }
    } else {
      setQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      // Redirect unauthenticated user to login
      navigate('/login');
      return;
    }
    try {
      await addItem(productId, quantity);
    } catch (err) {
      console.error('Failed to add item to cart:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
            Reading recipe entry...
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-paprika bg-paperLight p-8 rounded-sm text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
          <h4 className="font-display font-bold text-lg text-ink mb-2">Recipe Not Found</h4>
          <p className="font-body text-xs text-ink opacity-80 mb-6">
            The requested recipe notebook entry could not be retrieved. It may have been archived.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
          >
            Back to Recipes
          </button>
        </div>
      </div>
    );
  }

  const ingredients = getIngredientsForProduct(product.id, product.name);
  const imageUrl = product.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23FAF6EC"/><path d="M 0,20 L 300,20 M 0,40 L 300,40 M 0,60 L 300,60 M 0,80 L 300,80 M 0,100 L 300,100 M 0,120 L 300,120 M 0,140 L 300,140 M 0,160 L 300,160 M 0,180 L 300,180" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><g transform="translate(110, 45)" fill="none" stroke="%234B6B3A" stroke-width="2"><path d="M10 50 L70 50 L60 25 L20 25 Z" stroke-linejoin="round"/><ellipse cx="40" cy="25" rx="20" ry="5"/><circle cx="35" cy="21" r="2" fill="%234B6B3A"/><circle cx="45" cy="22" r="2.5" fill="%234B6B3A"/><circle cx="40" cy="19" r="1.5" fill="%234B6B3A"/><path d="M 12 10 Q 5 5 0 10 Q -5 15 0 20 Q 5 25 12 20 L 68 20 Q 75 25 80 20 Q 85 15 80 10 Q 75 5 68 10 Z" transform="translate(-5, -20) rotate(-15 40 25)"/></g><text x="50%" y="80%" font-family="monospace" font-size="11" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 SCOOBY’S KITCHEN 🐾</text><text x="50%" y="90%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Canine Tested Recipe</text></svg>';
  
  const isOutOfStock = product.available_stock === 0;

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
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Shop Recipes</button>
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
                className="p-2 border border-cardboard border-opacity-45 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-45 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content wrapper */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative">
        {/* Notebook Spine Motif */}
        <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-35 hidden md:block"></div>

        {/* Back Link */}
        <div className="mb-6 pl-4">
          <button
            onClick={() => navigate('/shop')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Product Ledger</span>
          </button>
        </div>

        {/* Main Recipe Detail Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left pl-4">
        {/* Left Column - Product Image */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-cardboard bg-paperLight p-4 rounded-sm shadow-sm">
            <div className="torn-edge relative w-full aspect-[4/3] bg-paper overflow-hidden border border-cardboard">
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover grayscale-[10%] hover:grayscale-0 transition-all duration-300"
              />
              {/* Category Tag */}
              {product.category?.name && (
                <div className="absolute top-4 left-4 bg-herb text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
                  {product.category.name}
                </div>
              )}
              {/* Canine Approved Stamp */}
              <div className="absolute top-4 right-4 bg-turmeric text-paperLight font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm flex items-center space-x-1 shadow-sm">
                <Bone className="w-2.5 h-2.5" />
                <span>Dog Tested</span>
              </div>
            </div>
          </div>

          {/* Quality Seals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
              <ShieldCheck className="w-5 h-5 text-herb shrink-0" />
              <div>
                <span className="font-mono text-[9px] uppercase font-bold text-herb block leading-tight">Human-Grade</span>
                <span className="font-body text-[10px] text-ink opacity-80 leading-none">100% Sourced Food</span>
              </div>
            </div>
            <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
              <Heart className="w-5 h-5 text-paprika shrink-0" />
              <div>
                <span className="font-mono text-[9px] uppercase font-bold text-paprika block leading-tight">Canine Tested</span>
                <span className="font-body text-[10px] text-ink opacity-80 leading-none">Vol. 07 Formula Approved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recipe Card Info */}
        <div className="lg:col-span-6">
          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Page Tab */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              RECIPE NO. 0{product.id}
            </div>

            <div className="space-y-2">
              <Eyebrow label="NUTRITIONAL COMPOSITION LEDGER" />
              <h2 className="font-display font-bold text-3xl text-ink leading-tight">
                {product.name}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <span className="font-mono font-bold text-turmeric text-2xl">
                  ${parseFloat(product.price).toFixed(2)}
                </span>
                
                {/* Stock Status Badge */}
                {isOutOfStock ? (
                  <span className="font-mono text-[9px] font-bold text-paprika bg-red-50 border border-paprika border-opacity-35 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    Out of Stock
                  </span>
                ) : (
                  <span className="font-mono text-[9px] font-bold text-herb bg-emerald-50 border border-herb border-opacity-35 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    In Stock ({product.available_stock !== null ? `${product.available_stock} packs left` : 'Fresh Batch'})
                  </span>
                )}
              </div>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            {/* Monospace Ingredient Ledger */}
            <div className="space-y-3">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-wide block">
                🐾 Formula Ingredient Breakdown:
              </span>
              <IngredientLedger ingredients={ingredients} />
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            {/* Description */}
            <div className="space-y-2 text-left">
              <span className="font-mono text-[10px] uppercase font-bold text-herb tracking-wide block">
                Nutritionist Notes:
              </span>
              <p className="font-body text-sm md:text-base text-ink opacity-90 leading-relaxed">
                {product.description || 'Our original slow-cooked formula designed specifically for adult dogs with sensitive skin or digestive issues. Prepared under low heat to capture full nutritional value, containing zero wheat, soy, or corn byproducts.'}
              </p>
            </div>

            {/* Buy Box */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Quantity Selector */}
              <div className="flex items-center justify-between border border-cardboard bg-paperLight rounded-sm p-1 sm:w-32 shrink-0">
                <button
                  onClick={handleDecrement}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="p-1.5 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-sm px-4 text-ink">
                  {quantity}
                </span>
                <button
                  onClick={handleIncrement}
                  disabled={isOutOfStock}
                  className="p-1.5 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart CTA */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-grow bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 px-6 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{isOutOfStock ? 'Sold Out' : 'Shop the Recipe'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60">
        <p className="font-mono text-[9px] uppercase tracking-wider">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
        <p className="font-body text-[10px] mt-1 max-w-md mx-auto leading-relaxed">
          Tested and crafted with love for pet parents who care about what goes in the bowl.
        </p>
      </footer>
    </div>
    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
  </div>
  );
};
