import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyOrders, cancelOrder, fetchOrderTracking } from '../../api/orders';
import { submitProductReview } from '../../api/reviews';

import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, 
  Clock, CheckCircle, XCircle, Loader2, AlertCircle,
  Truck, Calendar, Check, Star, Camera
} from 'lucide-react';

const TRACKING_STEPS = [
  { label: 'Placed', statusKey: 'PENDING', icon: '📝' },
  { label: 'Confirmed', statusKey: 'CONFIRMED', icon: '🤝' },
  { label: 'Processing', statusKey: 'PROCESSING', icon: '🍳' },
  { label: 'Shipped', statusKey: 'SHIPPED', icon: '🚚' },
  { label: 'Out for Delivery', statusKey: 'OUT_FOR_DELIVERY', icon: '🛵' },
  { label: 'Delivered', statusKey: 'DELIVERED', icon: '🎁' }
];

const getActiveStepIndex = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'PENDING') return 0;
  if (s === 'CONFIRMED') return 1;
  if (s === 'PROCESSING' || s === 'PACKED') return 2;
  if (s === 'SHIPPED' || s === 'IN_TRANSIT') return 3;
  if (s === 'OUT_FOR_DELIVERY') return 4;
  if (s === 'DELIVERED' || s === 'COMPLETED') return 5;
  return -1;
};

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<number | null>(null);

  // State for rating recipes inside delivered orders
  const [reviewingOrder, setReviewingOrder] = useState<any | null>(null);
  const [activeReviewProductId, setActiveReviewProductId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [reviewImagePreview, setReviewImagePreview] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewedProductIds, setReviewedProductIds] = useState<Record<number, boolean>>({});

  const { data: trackingData, isLoading: trackingLoading, error: trackingError } = useQuery({
    queryKey: ['tracking', selectedTrackingOrderId],
    queryFn: () => fetchOrderTracking(selectedTrackingOrderId!),
    enabled: selectedTrackingOrderId !== null,
  });



  // Query order history
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchMyOrders,
  });

  const [activeTab, setActiveTab] = useState<'active' | 'delivered' | 'cancelled'>('active');

  const filteredOrders = orders?.filter((order: any) => {
    const status = order.status.toUpperCase();
    if (activeTab === 'active') {
      return (
        status === 'PENDING' ||
        status === 'CONFIRMED' || 
        status === 'PROCESSING' || 
        status === 'PACKED' || 
        status === 'SHIPPED' || 
        status === 'IN_TRANSIT' || 
        status === 'OUT_FOR_DELIVERY'
      );
    } else if (activeTab === 'delivered') {
      return status === 'DELIVERED' || status === 'COMPLETED';
    } else if (activeTab === 'cancelled') {
      return status === 'CANCELLED' || status === 'DELIVERY_FAILED';
    }
    return false;
  }) || [];

  const getOrdersCountByTab = (tab: 'active' | 'delivered' | 'cancelled') => {
    if (!orders) return 0;
    return orders.filter((order: any) => {
      const status = order.status.toUpperCase();
      if (tab === 'active') {
        return (
          status === 'PENDING' ||
          status === 'CONFIRMED' || 
          status === 'PROCESSING' || 
          status === 'PACKED' || 
          status === 'SHIPPED' || 
          status === 'IN_TRANSIT' || 
          status === 'OUT_FOR_DELIVERY'
        );
      } else if (tab === 'delivered') {
        return status === 'DELIVERED' || status === 'COMPLETED';
      } else if (tab === 'cancelled') {
        return status === 'CANCELLED' || status === 'DELIVERY_FAILED';
      }
      return false;
    }).length;
  };

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => cancelOrder(orderId),
    onSuccess: () => {
      // Invalidate orders cache to refresh history
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      console.error('Failed to cancel order:', err);
      alert(err.response?.data?.detail || 'Failed to cancel order. Please try again.');
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReviewImage(file);
      setReviewImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRecipeReviewSubmit = async (e: React.FormEvent, productId: number) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(false);

    try {
      const formData = new FormData();
      formData.append('rating', String(reviewRating));
      
      const fullComment = reviewTitle.trim() 
        ? `${reviewTitle.trim()}\n\n${reviewComment.trim()}` 
        : reviewComment.trim();
        
      formData.append('comment', fullComment);
      if (reviewImage) {
        formData.append('file', reviewImage);
      }

      await submitProductReview(productId, formData);
      
      setReviewSubmitSuccess(true);
      setReviewedProductIds(prev => ({ ...prev, [productId]: true }));
      
      // Reset form fields
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      setReviewImage(null);
      setReviewImagePreview(null);
      
      // Delay closing or resetting active product
      setTimeout(() => {
        setReviewSubmitSuccess(false);
        setActiveReviewProductId(null);
      }, 1500);

    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setReviewSubmitError(err.response?.data?.detail || 'Failed to submit your review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };



  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'text-turmeric bg-amber-50 border-amber-200';
      case 'PAID':
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PACKED':
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
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
      <Header activeTab="orders" onCartToggle={() => setIsCartOpen(true)} />

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
          <h2 className="font-display font-black text-4xl uppercase tracking-tight text-ink">
            Your Order Ledger
          </h2>
          <p className="font-body text-xs text-ink opacity-70">
            Track and manage your kitchen recipes and active veterinarian shipments.
          </p>
        </div>

        <hr className="border-t border-dashed border-cardboard" />

        {/* Tactile Category Navigation Tabs */}
        <div className="flex border-b border-cardboard border-opacity-40 mb-8 font-mono text-xs uppercase tracking-wider font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
              activeTab === 'active'
                ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
                : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
            }`}
          >
            📦 Active & Transit ({getOrdersCountByTab('active')})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delivered')}
            className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
              activeTab === 'delivered'
                ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
                : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
            }`}
          >
            ✅ Delivered ({getOrdersCountByTab('delivered')})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
              activeTab === 'cancelled'
                ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
                : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
            }`}
          >
            ❌ Cancelled ({getOrdersCountByTab('cancelled')})
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
              Fetching active orders...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md">
            <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
            <h4 className="font-display font-bold text-lg text-ink mb-2">Error Loading Orders</h4>
            <p className="font-body text-xs text-ink opacity-80">
              Failed to retrieve orders history. Please check your authentication status.
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="max-w-md mx-auto border border-cardboard bg-paperLight p-8 rounded-sm text-center shadow-md my-12 animate-fade-in">
            <Clock className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
            <h4 className="font-display font-bold text-lg text-ink mb-2">
              {activeTab === 'active' && 'No Active Shipments'}
              {activeTab === 'delivered' && 'No Delivered Formulations'}
              {activeTab === 'cancelled' && 'No Cancelled Orders'}
            </h4>
            <p className="font-body text-xs text-ink opacity-80 mb-6">
              {activeTab === 'active' && "You don't have any pending or active recipe orders right now."}
              {activeTab === 'delivered' && "You haven't had any custom pet food recipe orders delivered yet."}
              {activeTab === 'cancelled' && "You have not cancelled any veterinary formulations."}
            </p>
            {activeTab === 'active' && (
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
              >
                Browse Sourced Recipes
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            {filteredOrders.map((order: any) => (
              <div 
                key={order.id} 
                className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                {/* Delivered Postmark Stamp */}
                {order.status.toUpperCase() === 'DELIVERED' && (
                  <div className="absolute top-2 right-12 opacity-80 pointer-events-none select-none">
                    <div className="border-2 border-dashed border-herb text-herb font-mono text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-sm rotate-[-8deg] transform bg-paperLight flex items-center space-x-1 shadow-xs">
                      <span>🌿 INK APPROVED</span>
                    </div>
                  </div>
                )}

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
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs font-body opacity-95">
                          <span>
                            {item.product_name ? `${item.product_name} (ID: #${item.product_id})` : `Product #${item.product_id}`}
                            {item.selected_weight && <span className="text-[10px] text-herb font-mono ml-1 font-bold">({item.selected_weight})</span>}
                            <span className="opacity-60"> (Qty: {item.quantity})</span>
                          </span>
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

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTrackingOrderId(order.id)}
                      className="border border-cardboard hover:bg-paper font-body font-bold text-[10px] uppercase py-1.5 px-3 rounded-sm tracking-wide transition-colors flex items-center space-x-1"
                    >
                      <Truck className="w-3.5 h-3.5 text-herb" />
                      <span>Track Journey</span>
                    </button>

                    {['DELIVERED', 'COMPLETED'].includes(order.status.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingOrder(order);
                          setActiveReviewProductId(null);
                        }}
                        className="bg-[#00b67a] hover:bg-opacity-95 text-white font-body font-bold text-[10px] uppercase py-1.5 px-3 rounded-sm tracking-wide transition-colors flex items-center space-x-1 border-0 cursor-pointer shadow-sm select-none"
                      >
                        <Star className="w-3.5 h-3.5 fill-white text-[#00b67a]" />
                        <span>Rate Recipes</span>
                      </button>
                    )}

                    {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        className="bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-[10px] uppercase py-1.5 px-3 rounded-sm tracking-wide transition-colors disabled:opacity-50"
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

              </div>
            ))}
          </div>
        )}
      </div>
      </main>
      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider w-full">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Sourced Recipe Tracking Modal */}
      {selectedTrackingOrderId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-lg w-full p-6 space-y-6 animate-fade-in-up relative overflow-hidden text-left">
            {/* Delivery Complete Wax Seal Delight Overlay */}
            {!trackingLoading && !trackingError && trackingData && trackingData.order_status.toUpperCase() === 'DELIVERED' && (
              <div className="absolute inset-0 bg-ink bg-opacity-5 backdrop-blur-[0.5px] pointer-events-none flex flex-col items-center justify-center animate-fade-in z-20">
                <div className="bg-white border-2 border-herb text-herb p-6 rounded-xs shadow-md max-w-xs text-center rotate-[-4deg] transform animate-scale-up space-y-2 relative pointer-events-auto">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-herb block">
                    JOURNEY VERIFIED
                  </span>
                  <div className="text-4xl">📦🌿🐾</div>
                  <span className="font-display font-bold text-lg text-ink block">
                    Recipes Delivered!
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard block">
                    Scooby's Kitchen Ink Approved
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTrackingOrderId(null)}
                    className="mt-4 w-full bg-herb hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase font-bold py-2 tracking-wider rounded-xs cursor-pointer border-0"
                  >
                    Close Ledger
                  </button>
                </div>
                
                {/* Floating Emojis Confetti */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {['📦', '🌿', '🐾', '💚', '📦', '🌿'].map((emoji, idx) => (
                    <span
                      key={idx}
                      className="absolute text-xl animate-drift-down"
                      style={{
                        left: `${10 + idx * 16}%`,
                        animationDelay: `${idx * 0.4}s`,
                        animationDuration: `${2.8 + idx * 0.4}s`
                      }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => setSelectedTrackingOrderId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="SOURCED RECIPE JOURNEY" />
              <h3 className="font-display font-bold text-xl text-ink">
                Tracking Ledger #{selectedTrackingOrderId}
              </h3>
            </div>

            {trackingLoading ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                  Sourcing live tracking ledger...
                </p>
              </div>
            ) : trackingError || !trackingData ? (
              <div className="py-6 text-center space-y-2">
                <AlertCircle className="w-10 h-10 text-paprika mx-auto" />
                <p className="font-body text-xs text-ink opacity-80">
                  Failed to fetch tracking data. Please try again later.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Premium Progress Bar Timeline */}
                {(() => {
                  const activeStep = getActiveStepIndex(trackingData.order_status);
                  const isCancelled = ['CANCELLED', 'DELIVERY_FAILED'].includes(trackingData.order_status.toUpperCase());
                  return (
                    <div className="w-full bg-paper p-5 border border-cardboard border-opacity-40 rounded-sm space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-cardboard border-dashed">
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink">
                          Fulfillment Status
                        </span>
                        <span className={`font-mono text-[9px] font-bold px-2 py-0.5 border uppercase tracking-wider rounded-xs ${
                          isCancelled 
                            ? 'text-paprika bg-red-50 border-red-200' 
                            : activeStep === 5
                              ? 'text-herb bg-emerald-50 border-emerald-200'
                              : 'text-turmeric bg-amber-50 border-amber-200'
                        }`}>
                          {trackingData.order_status.replace('_', ' ')}
                        </span>
                      </div>

                      {isCancelled ? (
                        <div className="py-4 text-center space-y-2">
                          <div className="text-3xl animate-bounce">❌</div>
                          <h4 className="font-display font-bold text-sm text-paprika uppercase tracking-wide">This shipment has been cancelled</h4>
                          <p className="font-body text-[11px] text-ink opacity-70">If you have any questions or need support, please contact customer care.</p>
                        </div>
                      ) : (
                        <div className="relative pt-4 pb-2">
                          {/* Connector Progress Line */}
                          <div className="absolute top-8 left-[5%] right-[5%] h-1 bg-cardboard bg-opacity-25 rounded-full z-0 hidden sm:block">
                            <div 
                              className="h-full bg-turmeric transition-all duration-1000 ease-out rounded-full"
                              style={{ width: `${(activeStep / (TRACKING_STEPS.length - 1)) * 100}%` }}
                            />
                          </div>

                          {/* Horizontal Steps (Desktop) */}
                          <div className="relative flex justify-between z-10 hidden sm:flex">
                            {TRACKING_STEPS.map((step, idx) => {
                              const isCompleted = idx < activeStep || (activeStep === 5 && idx === 5);
                              const isActive = idx === activeStep && activeStep !== 5;
                              return (
                                <div key={idx} className="flex flex-col items-center w-[15%] space-y-2">
                                  <div 
                                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-sm border-2 transition-all duration-500 ${
                                      isActive 
                                        ? 'bg-turmeric text-paper border-turmeric scale-110 shadow-md ring-2 ring-turmeric ring-opacity-20 animate-pulse'
                                        : isCompleted
                                          ? 'bg-ink text-turmeric border-ink'
                                          : 'bg-paperLight text-cardboard border-cardboard border-opacity-40'
                                    }`}
                                  >
                                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.icon}
                                  </div>
                                  <span className={`font-mono text-[9px] uppercase tracking-tight text-center leading-tight font-bold ${
                                    isActive 
                                      ? 'text-turmeric'
                                      : isCompleted
                                        ? 'text-ink'
                                        : 'text-cardboard opacity-65'
                                  }`}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Vertical Steps (Mobile) */}
                          <div className="flex flex-col space-y-4 sm:hidden pl-2">
                            {TRACKING_STEPS.map((step, idx) => {
                              const isCompleted = idx < activeStep || (activeStep === 5 && idx === 5);
                              const isActive = idx === activeStep && activeStep !== 5;
                              return (
                                <div key={idx} className="flex items-center space-x-3.5">
                                  <div 
                                    className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs border-2 shrink-0 transition-all duration-500 ${
                                      isActive 
                                        ? 'bg-turmeric text-paper border-turmeric scale-105 shadow-sm animate-pulse'
                                        : isCompleted
                                          ? 'bg-ink text-turmeric border-ink'
                                          : 'bg-paperLight text-cardboard border-cardboard border-opacity-40'
                                    }`}
                                  >
                                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.icon}
                                  </div>
                                  <span className={`font-mono text-[10px] uppercase font-bold tracking-wide ${
                                    isActive 
                                      ? 'text-turmeric'
                                      : isCompleted
                                        ? 'text-ink font-semibold'
                                        : 'text-cardboard opacity-65'
                                  }`}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Active Shipment block */}
                {trackingData.shipment ? (
                  <div className="p-4 border border-cardboard rounded-sm bg-paper bg-opacity-50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">
                          ACTIVE SHIPMENT CARRIER
                        </span>
                        <div className="font-body text-xs text-ink font-semibold flex items-center space-x-1">
                          <Truck className="w-3.5 h-3.5 text-herb" />
                          <span className="uppercase">{trackingData.shipment.carrier}</span>
                          <span className="text-[10px] font-normal text-cardboard">({trackingData.shipment.provider})</span>
                        </div>
                      </div>
                      {trackingData.shipment.estimated_delivery && (
                        <div className="text-right space-y-1">
                          <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                            EST. DELIVERY
                          </span>
                          <div className="font-body text-xs text-ink font-semibold flex items-center justify-end space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-turmeric" />
                            <span>{new Date(trackingData.shipment.estimated_delivery).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-cardboard border-dashed">
                      <div>
                        <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                          TRACKING NUMBER
                        </span>
                        <span className="font-mono text-xs text-ink font-bold">{trackingData.shipment.tracking_number}</span>
                      </div>
                      <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                        trackingData.shipment.status.toLowerCase() === 'delivered'
                          ? 'text-herb bg-emerald-50 border-emerald-200'
                          : 'text-turmeric bg-amber-50 border-amber-200'
                      }`}>
                        {trackingData.shipment.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-cardboard border-dashed rounded-sm bg-paper bg-opacity-30 flex items-center space-x-3">
                    <Clock className="w-6 h-6 text-cardboard shrink-0" />
                    <div>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                        COURIER DISPATCH
                      </span>
                      <p className="font-body text-[11px] text-ink opacity-70">
                        Fulfillment team is preparing your package. Carrier details will populate upon dispatch.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sourcing Timeline */}
                <div className="space-y-3">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">
                    JOURNEY STATUS TIMELINE
                  </span>
                  
                  {trackingData.timeline.length === 0 ? (
                    <p className="font-body text-xs text-ink opacity-60 italic">No tracking entries recorded yet.</p>
                  ) : (
                    <div className="relative pl-6 border-l border-cardboard border-dashed space-y-5 ml-2 pt-1 pb-1">
                      {trackingData.timeline.map((item, idx) => {
                        const isLatest = idx === trackingData.timeline.length - 1;
                        const isFinished = idx < trackingData.timeline.length - 1;
                        const isTimelineCompleted = trackingData.order_status.toUpperCase() === 'COMPLETED' || trackingData.order_status.toUpperCase() === 'CANCELLED';
                        const showCheck = isFinished || (isLatest && isTimelineCompleted);
                        return (
                          <div key={idx} className="relative text-xs">
                            {/* Dot indicator */}
                            {showCheck ? (
                              <span className="absolute -left-[32px] top-1 w-4 h-4 rounded-full bg-herb text-paperLight flex items-center justify-center border border-herb">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className={`absolute -left-[30px] top-1.5 w-3 h-3 rounded-full border border-cardboard ${
                                isLatest 
                                  ? 'bg-turmeric animate-pulse border-turmeric shadow-sm' 
                                  : 'bg-paperLight'
                              }`} />
                            )}
                            
                            <div className="space-y-0.5">
                              <div className="flex justify-between items-baseline">
                                <span className={`font-mono font-bold uppercase tracking-wider text-[10px] ${
                                  isLatest ? 'text-turmeric' : 'text-ink'
                                }`}>
                                  {item.status.replace('_', ' ')}
                                </span>
                                <span className="font-mono text-[9px] text-cardboard">
                                  {new Date(item.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="font-body text-ink opacity-75 leading-relaxed text-[11px]">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedTrackingOrderId(null)}
                  className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors mt-2"
                >
                  Return to Ledger
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sourced Recipe Review Modal Overlay */}
      {reviewingOrder !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border-double border-4 border-cardboard rounded-none shadow-2xl max-w-xl w-full p-6 space-y-6 relative overflow-y-auto max-h-[85vh] text-left">
            <button 
              onClick={() => setReviewingOrder(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold border-none bg-transparent cursor-pointer text-lg"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">
                DELIVERED ORDER RECIPIENT FEEDBACK
              </span>
              <h3 className="font-display font-black text-2xl text-ink uppercase">
                Rate Recipe Formulations
              </h3>
              <p className="font-body text-xs text-ink opacity-70">
                Provide feedback for items delivered in Order #{reviewingOrder.id}.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            <div className="space-y-4">
              {reviewingOrder.items?.map((item: any) => {
                const isAlreadyReviewed = reviewedProductIds[item.product_id];
                const isCurrentActive = activeReviewProductId === item.product_id;

                return (
                  <div 
                    key={item.id} 
                    className="border border-cardboard p-4 bg-paper bg-opacity-50 space-y-3 rounded-none transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <span className="font-display font-bold text-sm text-ink block">
                          {item.product_name || `Recipe Formulation #${item.product_id}`}
                        </span>
                        {item.selected_weight && (
                          <span className="font-mono text-[9px] text-herb font-bold uppercase tracking-wider block">
                            Size: {item.selected_weight}
                          </span>
                        )}
                      </div>

                      {isAlreadyReviewed ? (
                        <div className="border border-[#00b67a] bg-[#00b67a]/5 text-[#00b67a] font-mono text-[9px] font-black uppercase tracking-wider px-2.5 py-1 flex items-center space-x-1 select-none border-solid">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Review Posted</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReviewProductId(isCurrentActive ? null : item.product_id);
                            setReviewSubmitError(null);
                            setReviewSubmitSuccess(false);
                            setReviewRating(5);
                            setReviewTitle('');
                            setReviewComment('');
                            setReviewImage(null);
                            setReviewImagePreview(null);
                          }}
                          className={`font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 font-bold cursor-pointer transition-colors border ${
                            isCurrentActive
                              ? 'border-ink bg-ink text-paperLight'
                              : 'border-cardboard bg-paperLight text-ink hover:bg-paper'
                          }`}
                        >
                          {isCurrentActive ? 'Close Form' : 'Write Review'}
                        </button>
                      )}
                    </div>

                    {/* Collapsible Form for this specific product */}
                    {isCurrentActive && !isAlreadyReviewed && (
                      <form 
                        onSubmit={(e) => handleRecipeReviewSubmit(e, item.product_id)} 
                        className="space-y-4 pt-4 border-t border-cardboard border-dashed animate-fade-in text-center"
                      >
                        {reviewSubmitSuccess ? (
                          <div className="py-6 text-center space-y-2">
                            <span className="text-3xl animate-bounce block">🐾🌿💚</span>
                            <span className="font-display font-bold text-base text-[#00b67a] block uppercase tracking-wide">
                              Sourced Review Approved!
                            </span>
                            <span className="font-mono text-[9px] text-cardboard block">
                              Thank you for sharing your experience.
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* Star Selector */}
                            <div className="space-y-1 text-left">
                              <span className="font-mono text-[9px] uppercase font-bold text-ink opacity-85 block">Rating</span>
                              <div className="flex space-x-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className="hover:scale-110 transition-transform cursor-pointer border-0 bg-transparent p-0"
                                  >
                                    <Star
                                      className={`w-6 h-6 ${
                                        star <= reviewRating
                                          ? 'fill-[#00b67a] text-[#00b67a]'
                                          : 'text-[#00b67a] opacity-35'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Title field */}
                            <div className="space-y-1 text-left">
                              <label className="font-mono text-[9px] uppercase font-bold text-ink opacity-85 block">Review Title</label>
                              <input
                                type="text"
                                required
                                value={reviewTitle}
                                onChange={(e) => setReviewTitle(e.target.value)}
                                placeholder="e.g. Delicious healthy option!, My dog loved it!"
                                className="w-full bg-paper border border-cardboard border-opacity-70 p-2.5 outline-none font-body text-xs focus:border-turmeric transition-colors rounded-none"
                              />
                            </div>

                            {/* Comment field */}
                            <div className="space-y-1 text-left">
                              <label className="font-mono text-[9px] uppercase font-bold text-ink opacity-85 block">Review Details</label>
                              <textarea
                                required
                                rows={3}
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Write your recipe formulation review details here..."
                                className="w-full bg-paper border border-cardboard border-opacity-70 p-2.5 outline-none font-body text-xs resize-none focus:border-turmeric transition-colors rounded-none"
                              />
                            </div>

                            {/* Custom File Upload block */}
                            <div className="space-y-1 text-left">
                              <label className="font-mono text-[9px] uppercase font-bold text-ink opacity-85 block">Upload Photo (Optional)</label>
                              <div className="border border-cardboard border-dashed bg-paper bg-opacity-40 p-4 text-center cursor-pointer relative hover:border-turmeric transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageChange}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                {reviewImagePreview ? (
                                  <div className="flex flex-col items-center space-y-2">
                                    <img
                                      src={reviewImagePreview}
                                      alt="Upload Preview"
                                      className="w-16 h-16 object-cover border border-cardboard rounded-xs"
                                    />
                                    <span className="font-mono text-[8px] uppercase font-bold text-herb">
                                      {reviewImage?.name} (Click to change)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center space-y-1 text-cardboard hover:text-ink transition-colors">
                                    <Camera className="w-6 h-6 stroke-1" />
                                    <span className="font-mono text-[9px] uppercase font-bold">Select Pet Image</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {reviewSubmitError && (
                              <div className="bg-red-50 border border-red-200 text-paprika font-mono text-[9px] uppercase font-bold p-2 text-left">
                                ⚠ {reviewSubmitError}
                              </div>
                            )}

                            {/* Submit Row */}
                            <div className="flex justify-end space-x-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setActiveReviewProductId(null)}
                                className="border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold px-4 py-2 cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingReview}
                                className="bg-[#00b67a] hover:bg-opacity-95 text-white font-mono text-[9px] uppercase font-bold px-5 py-2 cursor-pointer transition-colors border-0 shadow-sm disabled:opacity-50"
                              >
                                {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                              </button>
                            </div>
                          </>
                        )}
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setReviewingOrder(null)}
              className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase font-bold py-3 tracking-wider rounded-none transition-colors mt-4 cursor-pointer"
            >
              Close Feedback Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
