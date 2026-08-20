import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { X, Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Eyebrow } from './Eyebrow';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { items, totalAmount, updateItem, removeItem, isLoading } = useCartStore();

  const handleCheckoutRedirect = () => {
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

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md bg-paperLight border-l border-cardboard shadow-2xl flex flex-col justify-between relative transform transition-transform duration-300">
          
          {/* Decorative notebook binding left border */}
          <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>

          {/* Panel Header */}
          <div className="p-6 border-b border-cardboard flex justify-between items-center bg-paperLight pl-8">
            <div className="text-left space-y-1">
              <Eyebrow label="ACTIVE NUTRITION CAR" />
              <h3 className="font-display font-bold text-xl text-ink flex items-center space-x-1.5">
                <ShoppingBag className="w-5 h-5 text-herb" />
                <span>The Pantry Ledger</span>
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-paper rounded-full text-ink opacity-70 hover:opacity-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Items List */}
          <div className="flex-grow overflow-y-auto p-6 space-y-4 pl-8">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20">
                <ShoppingBag className="w-12 h-12 text-cardboard stroke-1" />
                <p className="font-display font-bold text-base text-ink italic">Your Ledger is Empty</p>
                <p className="font-body text-xs text-ink opacity-70 max-w-xs">
                  Your pet's recipe journal is currently blank. Explore our nutritional small-batch catalog to add items.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 text-herb underline font-mono text-[10px] uppercase font-bold tracking-wider hover:text-ink transition-colors"
                >
                  Start Sourcing Recipes
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const fallbackImageUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70"><rect width="100" height="70" fill="%23FAF6EC"/><path d="M 0,10 L 100,10 M 0,20 L 100,20 M 0,30 L 100,30 M 0,40 L 100,40 M 0,50 L 100,50 M 0,60 L 100,60" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><text x="50%" y="50%" font-family="monospace" font-size="8" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">RECIPE</text></svg>';
                  const imageSrc = item.image_url || fallbackImageUrl;

                  return (
                    <div 
                      key={item.id}
                      className="border border-cardboard rounded-sm p-4 bg-paperLight bg-opacity-40 flex items-start space-x-3 text-left relative"
                    >
                      {/* Mini Thumbnail */}
                      <div className="w-16 h-16 shrink-0 border border-cardboard bg-paper rounded-sm overflow-hidden aspect-square">
                        <img 
                          src={imageSrc} 
                          alt={item.name} 
                          className="w-full h-full object-cover grayscale-[10%]"
                        />
                      </div>

                      {/* Info Area */}
                      <div className="flex-grow space-y-1.5 min-w-0 pr-6">
                        <h4 className="font-display font-bold text-sm text-ink truncate">
                          {item.name}
                        </h4>
                        
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-herb">
                            ${parseFloat(item.price).toFixed(2)} / pack
                          </span>
                          <span className="font-mono font-bold text-ink text-xs">
                            ${parseFloat(item.subtotal).toFixed(2)}
                          </span>
                        </div>

                        {/* Controls buy box */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center justify-between border border-cardboard bg-paperLight rounded-sm p-0.5 w-24 shrink-0">
                            <button
                              onClick={() => updateItem(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1 || isLoading}
                              className="p-1 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs px-2 text-ink">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateItem(item.id, item.quantity + 1)}
                              disabled={isLoading}
                              className="p-1 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={isLoading}
                        className="p-1 hover:bg-paper rounded-sm text-paprika opacity-70 hover:opacity-100 transition-colors absolute top-2 right-2 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Running Totals Block */}
          {items.length > 0 && (
            <div className="p-6 bg-paperLight border-t border-cardboard pl-8 space-y-4">
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

              {/* Checkout Trigger button */}
              <button
                onClick={handleCheckoutRedirect}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm flex items-center justify-center space-x-2"
              >
                <span>Proceed to Checkout</span>
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
