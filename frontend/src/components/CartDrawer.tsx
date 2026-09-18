import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { validateCoupon } from '../api/coupons';
import { X, Trash2, Minus, Plus, ShoppingBag, ArrowRight, Tag, AlertCircle, Loader2 } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { 
    items, 
    totalAmount, 
    updateItem, 
    removeItem, 
    isLoading,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    loadCart,
  } = useCartStore();

  useEffect(() => {
    if (isOpen) {
      loadCart();
    }
  }, [isOpen, loadCart]);

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const hasStockError = items.some((item) => {
    const s = item.available_stock;
    return typeof s === 'number' && (s === 0 || item.quantity > s);
  });

  const totalPacksCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const res = await validateCoupon(couponCodeInput.trim(), totalAmount);
      applyCoupon({
        code: res.code,
        discountType: res.discount_type,
        discountValue: Number(res.discount_value),
        discountAmount: Number(res.discount_amount),
        message: res.message,
      });
      setCouponCodeInput('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Invalid or expired coupon code.';
      setCouponError(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const finalPayableAmount = Math.max(0, totalAmount - (appliedCoupon?.discountAmount || 0));

  const handleCheckoutRedirect = () => {
    if (hasStockError) return;
    onClose();
    navigate('/checkout');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-body">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-ink bg-opacity-40 backdrop-blur-xs transition-opacity duration-300"
      ></div>

      <div className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10 pl-0 w-full sm:w-auto">
        {/* Sliding Panel */}
        <div className="w-full sm:w-screen sm:max-w-md bg-paperLight border-l border-cardboard shadow-2xl flex flex-col justify-between relative transform transition-transform duration-300">
          
          {/* Decorative notebook binding left border */}
          <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>

          {/* Panel Header */}
          <div className="p-6 border-b border-cardboard flex justify-between items-center bg-paperLight pl-8">
            <div className="text-left space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-xl text-ink flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-herb" />
                  <span>The Pantry Ledger</span>
                </h3>
                {items.length > 0 && (
                  <span className="font-mono text-[10px] font-bold text-herb bg-herb/10 border border-herb/30 px-2 py-0.5 rounded-full">
                    {totalPacksCount} {totalPacksCount === 1 ? 'pack' : 'packs'}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-ink opacity-60">
                Veterinary active batch reservations
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-paper rounded-full text-ink opacity-70 hover:opacity-100 transition-colors cursor-pointer"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Items List */}
          <div className="flex-grow overflow-y-auto p-6 space-y-4 pl-8">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 px-2">
                <div className="w-full bg-paper bg-opacity-70 border-2 border-dashed border-cardboard rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-paperLight flex items-center justify-center border border-cardboard shadow-inner">
                    <ShoppingBag className="w-6 h-6 text-turmeric stroke-2" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display font-bold text-base text-ink">Your Ledger is Empty</p>
                    <p className="font-body text-xs text-ink opacity-70 max-w-xs leading-relaxed">
                      Your companion's recipe journal is currently blank. Explore our nutritional small-batch catalog to add fresh meals.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/shop');
                    }}
                    className="w-full max-w-xs bg-turmeric hover:bg-amber-400 text-ink font-display font-black text-xs uppercase py-3.5 px-6 rounded-xl tracking-wider transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2 border border-ink/10 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <span>Start Sourcing Recipes</span>
                    <ArrowRight className="w-4 h-4 text-ink" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {items.map((item) => {
                  const fallbackImageUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70"><rect width="100" height="70" fill="%23FAF6EC"/><path d="M 0,10 L 100,10 M 0,20 L 100,20 M 0,30 L 100,30 M 0,40 L 100,40 M 0,50 L 100,50 M 0,60 L 100,60" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><text x="50%" y="50%" font-family="monospace" font-size="8" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">RECIPE</text></svg>';
                  const imageSrc = item.image_url || fallbackImageUrl;

                  const stock = item.available_stock;
                  const hasStockInfo = typeof stock === 'number';
                  const isOutOfStock = hasStockInfo && stock === 0;
                  const exceedsStock = hasStockInfo && item.quantity > stock;
                  const isMaxStockReached = hasStockInfo && item.quantity >= stock;
                  const isLowStock = hasStockInfo && stock > 0 && stock <= 3;

                  return (
                    <div 
                      key={item.id}
                      className={`border rounded-sm p-4 bg-paperLight bg-opacity-80 flex items-start space-x-3 text-left relative transition-all duration-200 ${
                        isOutOfStock || exceedsStock 
                          ? 'border-red-300 bg-red-50/30' 
                          : 'border-cardboard hover:border-turmeric/50'
                      }`}
                    >
                      {/* Mini Thumbnail */}
                      <div className="w-16 h-16 shrink-0 border border-cardboard bg-paper rounded-sm overflow-hidden aspect-square relative">
                        <img 
                          src={imageSrc} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-ink/60 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="text-[8px] font-mono font-bold text-paper uppercase tracking-wider text-center px-1">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info Area */}
                      <div className="flex-grow space-y-2 min-w-0 pr-6">
                        <div>
                          <h4 className="font-display font-bold text-sm text-ink truncate flex items-center gap-1.5">
                            <span className="truncate">{item.name}</span>
                            {item.selected_weight && (
                              <span className="text-[10px] text-herb font-mono shrink-0 bg-paper px-1.5 py-0.5 rounded border border-cardboard font-bold">
                                {item.selected_weight}
                              </span>
                            )}
                          </h4>

                          {/* Stock Micro-Badge */}
                          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-red-700 bg-red-100/80 border border-red-200 px-2 py-0.5 rounded-sm">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Out of Stock
                              </span>
                            ) : exceedsStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-sm">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Only {item.available_stock} in batch (adjust qty)
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Only {item.available_stock} left in batch
                              </span>
                            ) : hasStockInfo ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50/70 border border-emerald-200 px-2 py-0.5 rounded-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {item.available_stock} available
                              </span>
                            ) : null}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-baseline">
                          <span className="font-mono text-[10px] text-herb">
                            ₹{parseFloat(item.price).toFixed(2)} / pack
                          </span>
                          <span className="font-mono font-bold text-ink text-xs">
                            ₹{parseFloat(item.subtotal).toFixed(2)}
                          </span>
                        </div>

                        {/* Controls buy box */}
                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center border border-cardboard bg-paperLight rounded-sm p-0.5 shrink-0">
                            <button
                              onClick={() => updateItem(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1 || isLoading}
                              className="p-1 hover:bg-paper rounded-sm text-ink disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                              title="Decrease quantity"
                              aria-label={`Decrease quantity of ${item.name}`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs px-2.5 text-ink min-w-[28px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateItem(item.id, item.quantity + 1)}
                              disabled={isLoading || isMaxStockReached || isOutOfStock}
                              className={`p-1 rounded-sm transition-colors ${
                                isMaxStockReached || isOutOfStock
                                  ? 'text-ink/30 cursor-not-allowed bg-cardboard/20'
                                  : 'hover:bg-paper text-ink cursor-pointer'
                              }`}
                              title={
                                isOutOfStock
                                  ? 'Item is out of stock'
                                  : isMaxStockReached
                                  ? `Maximum available batch stock (${item.available_stock}) reached`
                                  : 'Increase quantity'
                              }
                              aria-label={`Increase quantity of ${item.name}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {isMaxStockReached && !isOutOfStock && !exceedsStock && (
                            <span className="font-mono text-[9px] text-ink/60 font-semibold pl-2">
                              Max batch reached
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={isLoading}
                        className="p-1.5 hover:bg-paper rounded-sm text-paprika opacity-70 hover:opacity-100 transition-colors absolute top-2.5 right-2.5 disabled:opacity-30 cursor-pointer"
                        title="Remove item"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 className="w-3.5 h-3.5 hover:text-red-700" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Running Totals & Coupon Block */}
          {items.length > 0 && (
            <div className="p-6 bg-paperLight border-t border-cardboard pl-8 space-y-4">
              
              {/* Promo Code Input & Status */}
              <div className="space-y-2">
                {appliedCoupon ? (
                  <div className="bg-herb/10 border border-herb/30 rounded-sm p-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-left min-w-0">
                      <Tag className="w-4 h-4 text-herb shrink-0" />
                      <div className="truncate">
                        <span className="font-mono font-bold text-xs text-herb uppercase tracking-wider block truncate">
                          {appliedCoupon.code} APPLIED
                        </span>
                        <span className="font-body text-[10px] text-ink opacity-70 block truncate">
                          {appliedCoupon.discountType === 'PERCENTAGE' 
                            ? `${appliedCoupon.discountValue}% discount savings`
                            : `Flat ₹${appliedCoupon.discountValue} off`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="font-mono text-[10px] text-paprika hover:underline font-bold uppercase shrink-0 pl-2 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <div className="relative flex-grow">
                        <Tag className="w-3.5 h-3.5 text-cardboard absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={couponCodeInput}
                          onChange={(e) => {
                            setCouponCodeInput(e.target.value.toUpperCase());
                            if (couponError) setCouponError(null);
                          }}
                          placeholder="PROMO CODE (e.g. PUPPY10)"
                          className="w-full bg-paper border border-cardboard text-ink font-mono text-xs pl-8 pr-2 py-2 rounded-sm uppercase tracking-wider placeholder:normal-case placeholder:font-body placeholder:text-[10px] placeholder:opacity-50 focus:outline-none focus:border-herb"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!couponCodeInput.trim() || isApplyingCoupon}
                        className="bg-cardboard hover:bg-herb text-paperLight font-mono font-bold text-xs uppercase px-3 py-2 rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        {isApplyingCoupon ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Apply</span>
                        )}
                      </button>
                    </div>
                    {couponError && (
                      <p className="font-body text-[10px] text-paprika text-left flex items-center space-x-1 pt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{couponError}</span>
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 font-mono text-xs">
                {/* Subtotal */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-herb font-bold uppercase tracking-wider text-[10px]">SUBTOTAL</span>
                  <span className="bg-paperLight pl-2 text-ink font-bold">₹{totalAmount.toFixed(2)}</span>
                </div>

                {/* Coupon Discount if applied */}
                {appliedCoupon && (
                  <div className="flex justify-between items-center dotted-divider pb-1 text-herb">
                    <span className="bg-paperLight pr-2 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <span>COUPON SAVINGS</span>
                    </span>
                    <span className="bg-paperLight pl-2 font-bold font-mono">
                      - ₹{appliedCoupon.discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                
                {/* Shipping */}
                <div className="flex justify-between items-center dotted-divider pb-1">
                  <span className="bg-paperLight pr-2 text-cardboard font-bold uppercase tracking-wider text-[10px]">SHIPPING</span>
                  <span className="bg-paperLight pl-2 text-herb font-bold">FREE TASTING SHIP</span>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="font-display text-xs font-bold text-ink uppercase tracking-wider">TOTAL DUE</span>
                  <span className="font-mono font-bold text-turmeric text-lg">₹{finalPayableAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Stock Warning Notice if items exceed batch capacity */}
              {hasStockError && (
                <div className="bg-red-50 border border-red-200 rounded-sm p-3 flex items-start space-x-2 text-left">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-red-800 font-body leading-relaxed">
                    <strong className="block font-bold">Pantry Stock Limit Exceeded</strong>
                    Some items in your ledger exceed the available batch inventory. Please adjust quantities or remove out-of-stock items before checkout.
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckoutRedirect}
                disabled={hasStockError}
                className={`w-full font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-all shadow-sm flex items-center justify-center space-x-2 ${
                  hasStockError
                    ? 'bg-cardboard text-ink/40 cursor-not-allowed'
                    : 'bg-turmeric hover:bg-amber-400 text-ink cursor-pointer'
                }`}
              >
                <span>{hasStockError ? 'Adjust Quantities to Proceed' : 'Proceed to Checkout'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="font-body text-[9px] text-ink opacity-60 text-center leading-normal">
                🐾 Securely ledgered by Scooby’s Veterinary Portal. Purchases support small-farm protein sourcing.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

