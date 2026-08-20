import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyOrders, cancelOrder } from '../../api/orders';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  Clock, CheckCircle, XCircle, Loader2, AlertCircle
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Query order history
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchMyOrders,
  });

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => cancelOrder(orderId),
    onSuccess: () => {
      // Invalidate orders cache to refresh history
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      console.error('Failed to cancel order:', err);
    }
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      navigate('/login');
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'text-turmeric bg-amber-50 border-amber-200';
      case 'PAID':
      case 'SHIPPED':
      case 'DELIVERED':
        return 'text-herb bg-emerald-50 border-emerald-200';
      case 'CANCELLED':
        return 'text-paprika bg-red-50 border-red-200';
      default:
        return 'text-ink bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return <Clock className="w-3 h-3" />;
      case 'CANCELLED':
        return <XCircle className="w-3 h-3" />;
      default:
        return <CheckCircle className="w-3 h-3" />;
    }
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
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">My Orders</button>
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

      {/* Back Link */}
      <div className="mb-8 text-left">
        <button
          onClick={() => navigate('/shop')}
          className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Product Ledger</span>
        </button>
      </div>

      <div className="space-y-6 text-left">
        <div className="space-y-1">
          <Eyebrow label="VETERINARY SOURCING RECIPES HISTOR" />
          <h2 className="font-display font-bold text-3xl text-ink">
            Your Order Ledger
          </h2>
          <p className="font-body text-xs text-ink opacity-70">
            Track and manage your kitchen recipes and active veterinarian shipments.
          </p>
        </div>

        <hr className="border-t border-dashed border-cardboard" />

        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
              Fetching active orders...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto border border-paprika bg-paperLight p-8 rounded-sm text-center shadow-md">
            <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
            <h4 className="font-display font-bold text-lg text-ink mb-2">Error Loading Orders</h4>
            <p className="font-body text-xs text-ink opacity-80">
              Failed to retrieve orders history. Please check your authentication status.
            </p>
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="max-w-md mx-auto border border-cardboard bg-paperLight p-8 rounded-sm text-center shadow-md my-12">
            <Clock className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
            <h4 className="font-display font-bold text-lg text-ink mb-2">No Orders Placed Yet</h4>
            <p className="font-body text-xs text-ink opacity-80 mb-6">
              You haven't ordered any custom pet formulations yet.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
            >
              Browse Sourced Recipes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Card Header info */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[8px] uppercase font-bold text-herb block">
                        ORDER ID: #{order.id}
                      </span>
                      <span className="font-mono text-[9px] text-cardboard block">
                        Placed: {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm flex items-center space-x-1 uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span>{order.status}</span>
                    </span>
                  </div>

                  <hr className="border-t border-dashed border-cardboard" />

                  {/* Items list */}
                  <div className="space-y-2">
                    <span className="font-mono text-[8px] uppercase font-bold text-herb tracking-wide block">
                      Ledger Recipes Sourced:
                    </span>
                    <div className="space-y-1">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs font-body opacity-95">
                          <span>Product ID: #{item.product_id} (Qty: {item.quantity})</span>
                          <span className="font-mono">${parseFloat(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-t border-dashed border-cardboard" />

                  {/* Address block */}
                  <div className="space-y-1">
                    <span className="font-mono text-[8px] uppercase font-bold text-herb tracking-wide block">
                      Delivering To:
                    </span>
                    <p className="font-body text-xs text-ink opacity-80 truncate">
                      {order.shipping_address}
                    </p>
                  </div>
                </div>

                {/* Total & Action Box */}
                <div className="mt-6 flex justify-between items-center pt-4 border-t border-cardboard">
                  <div>
                    <span className="font-mono text-[8px] uppercase text-cardboard font-bold block">
                      TOTAL CHARGED
                    </span>
                    <span className="font-mono font-bold text-turmeric text-base">
                      ${parseFloat(order.total_amount).toFixed(2)}
                    </span>
                  </div>

                  {order.status.toUpperCase() === 'PENDING' && (
                    <button
                      onClick={() => cancelMutation.mutate(order.id)}
                      disabled={cancelMutation.isPending}
                      className="bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-[10px] uppercase py-1.5 px-3 rounded-sm tracking-wide transition-colors disabled:opacity-50"
                    >
                      {cancelMutation.isPending && cancelMutation.variables === order.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Cancel Order</span>
                      )}
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      </div>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
