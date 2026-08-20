import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { checkoutCart } from '../../api/orders';
import type { OrderResponse } from '../../api/orders';
import { createPayment, simulatePaymentSuccess, simulatePaymentFailure } from '../../api/payments';
import { logoutUser } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  MapPin, ShieldCheck, Truck, Loader2, AlertCircle 
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { items: cartItems, totalAmount, clear: clearCart } = useCartStore();
  
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Placed Order & Payment Simulation state
  const [placedOrder, setPlacedOrder] = useState<OrderResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('IDLE');

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

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

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            setDoorNo(addr.house_number || addr.building || '');
            setStreet(addr.road || addr.suburb || '');
            setCity(addr.city || addr.town || addr.village || addr.county || '');
            setState(addr.state || addr.region || '');
            setCountry(addr.country || '');
          } else {
            setErrorMessage('Could not resolve geolocation coordinates to a physical address.');
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          setErrorMessage('Failed to resolve address from coordinates.');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.error('Geolocation lookup failed:', err);
        setIsLocating(false);
        setErrorMessage('Location access denied or failed. Please type your address manually.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doorNo || !street || !city || !state || !country) {
      setErrorMessage('Please fill in all address fields.');
      return;
    }

    const combinedAddress = `Door No: ${doorNo}, ${street}, ${city}, ${state}, ${country}`;

    if (combinedAddress.trim().length < 10) {
      setErrorMessage('Please enter a valid shipping address (minimum 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const order = await checkoutCart(combinedAddress);
      setPlacedOrder(order);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setErrorMessage(
        err.response?.data?.detail || 
        'Failed to process checkout. Please check your network and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (simulateSuccess: boolean) => {
    if (!placedOrder) return;
    
    if (paymentMethod === 'CARD') {
      if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
        setErrorMessage('Please enter all card details.');
        return;
      }
    }

    setPaymentStatus('PROCESSING');
    setErrorMessage('');

    try {
      await createPayment(placedOrder.id, paymentMethod);

      if (simulateSuccess) {
        await simulatePaymentSuccess(placedOrder.id);
        setPaymentStatus('SUCCESS');
        clearCart();
      } else {
        await simulatePaymentFailure(placedOrder.id);
        setPaymentStatus('FAILED');
        setErrorMessage('Payment simulation declined. Please try again with a valid card.');
      }
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      setPaymentStatus('FAILED');
      setErrorMessage(
        err.response?.data?.detail || 
        'Failed to process payment session. Please try again.'
      );
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

      {placedOrder ? (
        /* Payment Simulation Screen */
        <div className="max-w-2xl mx-auto border border-cardboard bg-paperLight p-8 rounded-sm shadow-md my-12 text-left space-y-6 relative">
          <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
            SECURE CHECKOUT TERMINAL
          </div>

          <div className="space-y-1">
            <Eyebrow label="STEP 2 OF 2 — PAYMENT PROCESSOR" />
            <h2 className="font-display font-bold text-2xl text-ink">
              Secure Sourced Payment
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Confirm your checkout selection for Order ID <span className="font-mono font-bold text-herb">#{placedOrder.id}</span>.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {paymentStatus === 'SUCCESS' ? (
            /* Success confirmation display */
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-herb animate-bounce">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-bold text-xl text-ink">Payment Successful!</h3>
                <p className="font-body text-xs text-ink opacity-80 max-w-sm mx-auto">
                  Your payment of <span className="font-mono font-bold text-turmeric">${parseFloat(placedOrder.total_amount).toFixed(2)}</span> has been confirmed. Recipes are being prepared fresh!
                </p>
              </div>
              <button
                onClick={() => navigate('/orders')}
                className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-6 py-3 rounded-sm tracking-wide transition-colors"
              >
                Go to Order History 🐾
              </button>
            </div>
          ) : (
            /* Form inputs */
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-paper p-4 rounded-sm border border-cardboard border-dashed">
                <div>
                  <span className="font-mono text-[9px] uppercase text-cardboard font-bold block">Grand Total Due</span>
                  <span className="font-mono font-bold text-turmeric text-lg">${parseFloat(placedOrder.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`font-mono text-[9px] uppercase font-bold py-1.5 px-3 rounded-sm border ${
                      paymentMethod === 'CARD' ? 'bg-herb text-paper border-herb' : 'border-cardboard text-ink hover:bg-paper'
                    }`}
                  >
                    Credit Card 💳
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`font-mono text-[9px] uppercase font-bold py-1.5 px-3 rounded-sm border ${
                      paymentMethod === 'CASH' ? 'bg-herb text-paper border-herb' : 'border-cardboard text-ink hover:bg-paper'
                    }`}
                  >
                    Cash / COD 💵
                  </button>
                </div>
              </div>

              {paymentMethod === 'CARD' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="cardholder" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Cardholder Name:
                    </label>
                    <input
                      type="text"
                      id="cardholder"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                      disabled={paymentStatus === 'PROCESSING'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="cardNumber" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Card Number:
                    </label>
                    <input
                      type="text"
                      id="cardNumber"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="e.g. 4111 1111 1111 1111"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                      disabled={paymentStatus === 'PROCESSING'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="expiry" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        Expiry Date:
                      </label>
                      <input
                        type="text"
                        id="expiry"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                        disabled={paymentStatus === 'PROCESSING'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="cvv" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        CVV Code:
                      </label>
                      <input
                        type="password"
                        id="cvv"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                        disabled={paymentStatus === 'PROCESSING'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="border border-paprika border-opacity-35 bg-red-50 p-3 rounded-sm flex items-start space-x-2 text-paprika font-body text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => handlePayment(true)}
                  disabled={paymentStatus === 'PROCESSING'}
                  className="bg-herb hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {paymentStatus === 'PROCESSING' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>💳 Complete Payment (Simulate Success)</span>
                  )}
                </button>
                <button
                  onClick={() => handlePayment(false)}
                  disabled={paymentStatus === 'PROCESSING'}
                  className="border border-paprika text-paprika hover:bg-red-50 font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>⚠️ Simulate Failure</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : cartItems.length === 0 ? (
        /* Empty State */
        <div className="max-w-md mx-auto border border-cardboard bg-paperLight p-8 rounded-sm text-center shadow-md my-12">
          <ShoppingCart className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
          <h4 className="font-display font-bold text-lg text-ink mb-2">Your Ledger is Empty</h4>
          <p className="font-body text-xs text-ink opacity-80 mb-6">
            You cannot proceed to checkout without adding human-grade recipes to your cart first.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
          >
            Sourced Products Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left">
          {/* Left Column - Shipping Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6">
              <div className="space-y-1">
                <Eyebrow label="STEP 1 OF 2 — DELIVERY DETAILS" />
                <h2 className="font-display font-bold text-2xl text-ink">
                  Sourcing Shipping Address
                </h2>
              </div>
              <div className="flex justify-between items-center pb-2">
                <p className="font-body text-xs text-ink opacity-70 leading-relaxed pr-4">
                  Every order is prepared fresh in our veterinary kitchen. Provide a clear address for safe delivery.
                </p>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating || isSubmitting}
                  className="font-mono text-[9px] uppercase tracking-wider text-herb border border-herb border-dashed hover:bg-paper rounded-sm px-3 py-1.5 flex items-center space-x-1 hover:text-ink transition-colors disabled:opacity-50 shrink-0"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-herb" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3 h-3 text-herb" />
                      <span>Detect Location 🐾</span>
                    </>
                  )}
                </button>
              </div>

              <hr className="border-t border-dashed border-cardboard" />

              <form onSubmit={handlePlaceOrder} className="space-y-4">
                {/* Row 1: Door No & Street */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-1.5">
                    <label htmlFor="doorNo" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🏡 Door / Flat No:
                    </label>
                    <input
                      type="text"
                      id="doorNo"
                      value={doorNo}
                      onChange={(e) => setDoorNo(e.target.value)}
                      placeholder="e.g. Flat 4B"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="street" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🛣️ Street Name:
                    </label>
                    <input
                      type="text"
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Baker Street"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: City & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="city" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🌆 City:
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. London"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="state" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      📍 State / Region:
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. England"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Row 3: Country */}
                <div className="space-y-1.5">
                  <label htmlFor="country" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    🇬🇧 Country:
                  </label>
                  <input
                    type="text"
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United Kingdom"
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {errorMessage && (
                  <div className="border border-paprika border-opacity-35 bg-red-50 p-3 rounded-sm flex items-start space-x-2 text-paprika font-body text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Shipping info cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
                    <Truck className="w-5 h-5 text-herb shrink-0" />
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-herb block leading-tight">Fresh Transit</span>
                      <span className="font-body text-[10px] text-ink opacity-80 leading-none">Delivered in 2-3 Days</span>
                    </div>
                  </div>
                  <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
                    <ShieldCheck className="w-5 h-5 text-turmeric shrink-0" />
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-turmeric block leading-tight">100% Guaranteed</span>
                      <span className="font-body text-[10px] text-ink opacity-80 leading-none">Fresh-seal Packaging</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Receipt Summary */}
          <div className="lg:col-span-5">
            <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
              {/* Page Tab */}
              <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
                NOTEBOOK RECEIPT
              </div>

              <div className="space-y-1">
                <Eyebrow label="STEP 2 OF 2 — ORDER SUMMARY" />
                <h3 className="font-display font-bold text-xl text-ink">
                  Recipe Receipt
                </h3>
              </div>

              <hr className="border-t border-dashed border-cardboard" />

              {/* Items Breakdown */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-start text-xs">
                    <div className="max-w-[70%] text-left">
                      <span className="font-display font-bold text-ink block">{item.name}</span>
                      <span className="font-mono text-[10px] text-herb">
                        Qty: {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ink">
                      ${parseFloat(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="border-t border-dashed border-cardboard" />

              {/* Running Totals */}
              <div className="space-y-2 font-mono text-xs">
                {/* Subtotal */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-herb font-bold uppercase tracking-wider text-[10px]">SUBTOTAL</span>
                  <span className="bg-paperLight pl-2 text-ink font-bold">${totalAmount.toFixed(2)}</span>
                </div>
                
                {/* Shipping */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-cardboard font-bold uppercase tracking-wider text-[10px]">SHIPPING</span>
                  <span className="bg-paperLight pl-2 text-herb font-bold">FREE TASTING SHIP</span>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="font-display text-xs font-bold text-ink uppercase tracking-wider">TOTAL INK DUE</span>
                  <span className="font-mono font-bold text-turmeric text-lg">${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <span>Place Order & Cook Recipes 🐾</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60">
        <p className="font-mono text-[9px] uppercase tracking-wider">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
      </footer>
      </main>
    </div>
  );
};
