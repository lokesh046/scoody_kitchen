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
  Clock, XCircle, Loader2, AlertCircle,
  Truck, Check, Star, Camera, Package, 
  CheckCircle2, ShoppingBag, MapPin, X
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
      
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      setReviewImage(null);
      setReviewImagePreview(null);
      
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
        return 'text-amber-800 bg-amber-50 border-amber-300';
      case 'PAID':
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PACKED':
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
      case 'SHIPPED':
        return 'text-blue-800 bg-blue-50 border-blue-300';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'text-emerald-800 bg-emerald-50 border-emerald-300';
      case 'CANCELLED':
      case 'DELIVERY_FAILED':
        return 'text-rose-800 bg-rose-50 border-rose-300';
      default:
        return 'text-ink bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5" />;
      case 'CANCELLED':
      case 'DELIVERY_FAILED':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'DELIVERED':
      case 'COMPLETED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-herb" />;
      default:
        return <Truck className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header */}
      <Header activeTab="orders" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Back Link */}
        <div className="mb-6 text-left">
          <button
            onClick={() => navigate('/shop')}
            className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1.5 transition-opacity"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Fresh Meal Store</span>
          </button>
        </div>

        {/* Section Header Title */}
        <div className="space-y-1 text-left mb-8">
          <Eyebrow label="FULFILLMENT & DISPATCH LEDGER" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-ink tracking-tight">
                Your Order Ledger
              </h1>
              <p className="font-body text-xs sm:text-sm text-ink opacity-75 max-w-2xl mt-1">
                Track live courier fulfillment milestones, shipment journey ledgers, and rate small-batch recipe meals.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-mono font-bold bg-herb/10 text-herb border border-herb/30">
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                <span>{orders?.length || 0} Total Orders Placed</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tactile Category Navigation Tabs */}
        <div className="flex border-b border-cardboard border-opacity-35 mb-8 font-mono text-xs uppercase tracking-wider font-bold overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'active'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <Truck className="w-4 h-4 text-turmeric" />
            <span>Active & In-Transit</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-sm font-mono font-bold ${
              getOrdersCountByTab('active') > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-cardboard/30 text-ink'
            }`}>
              {getOrdersCountByTab('active')}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('delivered')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'delivered'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-herb" />
            <span>Delivered Recipes</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-sm font-mono font-bold">
              {getOrdersCountByTab('delivered')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'cancelled'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <XCircle className="w-4 h-4 text-paprika" />
            <span>Cancelled Orders</span>
            <span className="text-[10px] bg-cardboard/30 text-ink px-2 py-0.5 rounded-sm font-mono font-bold">
              {getOrdersCountByTab('cancelled')}
            </span>
          </button>
        </div>

        {/* Orders Content Area */}
        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-herb font-bold animate-pulse">
              Reading fulfillment dispatch ledger...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md space-y-3">
            <AlertCircle className="w-12 h-12 text-paprika mx-auto stroke-1" />
            <h4 className="font-display font-bold text-lg text-ink">Error Retrieving Orders</h4>
            <p className="font-body text-xs text-ink opacity-80">
              Failed to retrieve your order history. Please check your network connection and try again.
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="max-w-md mx-auto border border-cardboard border-dashed bg-paperLight p-10 rounded-sm text-center space-y-4 my-8 animate-fade-in">
            <Package className="w-12 h-12 text-cardboard mx-auto stroke-1" />
            <div>
              <h4 className="font-display font-bold text-lg text-ink">
                {activeTab === 'active' && 'No Active Shipments'}
                {activeTab === 'delivered' && 'No Delivered Formulations Yet'}
                {activeTab === 'cancelled' && 'No Cancelled Orders'}
              </h4>
              <p className="font-body text-xs text-ink opacity-75 max-w-xs mx-auto mt-1">
                {activeTab === 'active' && "You don't have any pending preparation or in-transit packages right now."}
                {activeTab === 'delivered' && "You haven't had any small-batch fresh meals delivered yet."}
                {activeTab === 'cancelled' && "You have not cancelled any pet nutrition orders."}
              </p>
            </div>
            {activeTab === 'active' && (
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase px-5 py-2.5 rounded-sm tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                Browse Fresh Meals 🐾
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left animate-fade-in">
            {filteredOrders.map((order: any) => (
              <div 
                key={order.id} 
                className="bg-paperLight border border-cardboard border-opacity-40 p-6 rounded-sm shadow-xs hover:border-turmeric transition-colors relative overflow-hidden flex flex-col justify-between"
              >
                {/* Left notebook spine line */}
                <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-30"></div>

                <div className="space-y-4 pl-4">
                  {/* Order Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                        ORDER LEDGER #{order.id}
                      </span>
                      <span className="font-mono text-[10px] text-ink opacity-70 block mt-0.5">
                        Placed: {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <span className={`font-mono text-[9px] font-bold border px-2.5 py-0.5 rounded-sm flex items-center space-x-1.5 uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span>{order.status.replace('_', ' ')}</span>
                    </span>
                  </div>

                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  {/* Sourced Items List */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">
                      Sourced Formulations:
                    </span>
                    <div className="space-y-1.5 bg-paper p-3 rounded-sm border border-cardboard/30">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-xs font-body">
                          <span className="truncate pr-2 font-medium text-ink">
                            {item.product_name || `Recipe Formulation #${item.product_id}`}
                            {item.selected_weight && (
                              <span className="text-[10px] text-herb font-mono ml-1.5 font-bold">({item.selected_weight})</span>
                            )}
                            <span className="text-ink opacity-60 text-[11px] ml-1">× {item.quantity}</span>
                          </span>
                          <span className="font-mono font-bold text-ink shrink-0">${parseFloat(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="space-y-1">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika tracking-wider block">
                      Delivery Destination:
                    </span>
                    <p className="font-body text-xs text-ink opacity-80 truncate flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-turmeric shrink-0 inline mr-1" />
                      <span>{order.shipping_address}</span>
                    </p>
                  </div>
                </div>

                {/* Card Total & Action Footer */}
                <div className="mt-6 pt-4 border-t border-cardboard border-opacity-35 flex justify-between items-center pl-4">
                  <div>
                    <span className="font-mono text-[8.5px] uppercase text-ink opacity-60 font-bold block">
                      TOTAL BILLED
                    </span>
                    <span className="font-mono font-black text-herb text-lg">
                      ${parseFloat(order.total_amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTrackingOrderId(order.id)}
                      className="border border-cardboard border-opacity-60 hover:bg-paper font-body font-bold text-xs uppercase py-2 px-3.5 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 text-turmeric" />
                      <span>Track</span>
                    </button>

                    {['DELIVERED', 'COMPLETED'].includes(order.status.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingOrder(order);
                          setActiveReviewProductId(null);
                        }}
                        className="bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase py-2 px-3.5 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Star className="w-3.5 h-3.5 fill-white" />
                        <span>Rate Items</span>
                      </button>
                    )}

                    {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        className="border border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100 font-body font-bold text-xs uppercase py-2 px-3 rounded-sm tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {cancelMutation.isPending && cancelMutation.variables === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Cancel</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Tracking Journey Modal */}
      {selectedTrackingOrderId !== null && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-2xl max-w-lg w-full max-h-[90dvh] flex flex-col animate-fade-in relative text-left overflow-hidden">
            {/* Sticky Mobile-Friendly Header */}
            <div className="sticky top-0 z-20 bg-paperLight/95 backdrop-blur-xs border-b border-cardboard/40 px-4 sm:px-6 py-3.5 sm:py-4 flex items-start justify-between shrink-0">
              <div className="space-y-0.5 pr-4">
                <Eyebrow label="SOURCED RECIPE JOURNEY" />
                <h3 className="font-display font-black text-lg sm:text-xl text-ink tracking-tight">
                  Tracking Ledger #{selectedTrackingOrderId}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTrackingOrderId(null)}
                aria-label="Close tracking ledger"
                className="w-8 h-8 rounded-full border border-cardboard/60 bg-paper hover:bg-cardboard/20 flex items-center justify-center text-ink opacity-70 hover:opacity-100 transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {trackingLoading ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                    Sourcing courier tracking ledger...
                  </p>
                </div>
              ) : trackingError || !trackingData ? (
                <div className="py-6 text-center space-y-2">
                  <AlertCircle className="w-10 h-10 text-paprika mx-auto stroke-1" />
                  <p className="font-body text-xs text-ink opacity-80">
                    Tracking records are currently being indexed by our logistics carrier.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Fulfillment Timeline Header */}
                  {(() => {
                    const activeStep = getActiveStepIndex(trackingData.order_status);
                    const isCancelled = ['CANCELLED', 'DELIVERY_FAILED'].includes(trackingData.order_status.toUpperCase());
                    return (
                      <div className="w-full bg-paper p-4 sm:p-5 border border-cardboard border-opacity-40 rounded-sm space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-cardboard border-dashed">
                          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink">
                            Fulfillment Stage
                          </span>
                          <span className={`font-mono text-[9px] font-bold px-2.5 py-0.5 border uppercase tracking-wider rounded-sm ${
                            isCancelled 
                              ? 'text-rose-800 bg-rose-50 border-rose-200' 
                              : activeStep === 5
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                : 'text-amber-800 bg-amber-50 border-amber-200'
                          }`}>
                            {trackingData.order_status.replace('_', ' ')}
                          </span>
                        </div>

                        {isCancelled ? (
                          <div className="py-4 text-center space-y-2">
                            <div className="text-3xl">❌</div>
                            <h4 className="font-display font-bold text-sm text-paprika uppercase tracking-wide">This shipment has been cancelled</h4>
                            <p className="font-body text-xs text-ink opacity-70">If you have any questions or require dietary assistance, please reach out to our team.</p>
                          </div>
                        ) : (
                          <div className="relative pt-4 pb-2">
                            {/* Progress Line */}
                            <div className="absolute top-8 left-[5%] right-[5%] h-1 bg-cardboard/25 rounded-full z-0 hidden sm:block">
                              <div 
                                className="h-full bg-turmeric transition-all duration-700 ease-out rounded-full"
                                style={{ width: `${(activeStep / (TRACKING_STEPS.length - 1)) * 100}%` }}
                              />
                            </div>

                            {/* Steps (Desktop) */}
                            <div className="relative justify-between z-10 hidden sm:flex">
                              {TRACKING_STEPS.map((step, idx) => {
                                const isCompleted = idx < activeStep || (activeStep === 5 && idx === 5);
                                const isActive = idx === activeStep && activeStep !== 5;
                                return (
                                  <div key={idx} className="flex flex-col items-center w-[15%] space-y-2">
                                    <div 
                                      className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs border-2 transition-all ${
                                        isActive 
                                          ? 'bg-turmeric text-paper border-turmeric scale-110 shadow-sm animate-pulse'
                                          : isCompleted
                                            ? 'bg-ink text-paper border-ink'
                                            : 'bg-paperLight text-cardboard border-cardboard border-opacity-40'
                                      }`}
                                    >
                                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.icon}
                                    </div>
                                    <span className={`font-mono text-[8.5px] uppercase tracking-tight text-center font-bold ${
                                      isActive ? 'text-turmeric' : isCompleted ? 'text-ink' : 'text-cardboard opacity-65'
                                    }`}>
                                      {step.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Steps (Mobile) */}
                            <div className="flex flex-col space-y-3 sm:hidden pl-1">
                              {TRACKING_STEPS.map((step, idx) => {
                                const isCompleted = idx < activeStep || (activeStep === 5 && idx === 5);
                                const isActive = idx === activeStep && activeStep !== 5;
                                return (
                                  <div key={idx} className="flex items-center space-x-3">
                                    <div 
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs border-2 shrink-0 ${
                                        isActive 
                                          ? 'bg-turmeric text-paper border-turmeric'
                                          : isCompleted
                                            ? 'bg-ink text-paper border-ink'
                                            : 'bg-paperLight text-cardboard border-cardboard border-opacity-40'
                                      }`}
                                    >
                                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.icon}
                                    </div>
                                    <span className={`font-mono text-[10px] uppercase font-bold ${
                                      isActive ? 'text-turmeric' : isCompleted ? 'text-ink font-semibold' : 'text-cardboard opacity-65'
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

                  {/* Courier & Dispatch details */}
                  {trackingData.shipment ? (
                    <div className="p-4 border border-cardboard border-opacity-40 rounded-sm bg-paper space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">
                            CARRIER PARTNER
                          </span>
                          <div className="font-body text-xs text-ink font-bold flex items-center space-x-1 mt-0.5">
                            <Truck className="w-3.5 h-3.5 text-turmeric" />
                            <span className="uppercase">{trackingData.shipment.carrier}</span>
                            <span className="text-[10px] font-normal text-cardboard">({trackingData.shipment.provider})</span>
                          </div>
                        </div>
                        {trackingData.shipment.estimated_delivery && (
                          <div className="text-right">
                            <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                              EST. DELIVERY
                            </span>
                            <div className="font-mono text-xs text-ink font-bold mt-0.5">
                              {new Date(trackingData.shipment.estimated_delivery).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-cardboard border-dashed">
                        <div>
                          <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                            TRACKING ID
                          </span>
                          <span className="font-mono text-xs text-ink font-bold">{trackingData.shipment.tracking_number}</span>
                        </div>
                        <span className="font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider text-herb bg-emerald-50 border-emerald-200">
                          {trackingData.shipment.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-cardboard border-dashed rounded-sm bg-paper flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-cardboard shrink-0" />
                      <div>
                        <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">
                          COURIER DISPATCH
                        </span>
                        <p className="font-body text-xs text-ink opacity-75">
                          Our kitchen team is packaging your order. Tracking details will update once scanned by the courier.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sourcing Timeline */}
                  <div className="space-y-3">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                      JOURNEY STATUS TIMELINE
                    </span>
                    
                    {trackingData.timeline.length === 0 ? (
                      <p className="font-body text-xs text-ink opacity-60 italic">No tracking entries recorded yet.</p>
                    ) : (
                      <div className="relative pl-6 border-l border-cardboard border-dashed space-y-4 ml-2 pt-1 pb-1">
                        {trackingData.timeline.map((item, idx) => {
                          const isLatest = idx === trackingData.timeline.length - 1;
                          return (
                            <div key={idx} className="relative text-xs">
                              <span className={`absolute -left-[30px] top-1.5 w-2.5 h-2.5 rounded-full border border-cardboard ${
                                isLatest ? 'bg-turmeric animate-pulse border-turmeric' : 'bg-paper'
                              }`} />
                              
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
                                <p className="font-body text-ink opacity-80 text-xs">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-paperLight/95 border-t border-cardboard/30 p-3 sm:p-4 shrink-0">
              <button
                onClick={() => setSelectedTrackingOrderId(null)}
                className="w-full bg-paper border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold py-2.5 sm:py-3 tracking-wider rounded-sm transition-colors cursor-pointer active:scale-98"
              >
                Close Tracking Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingOrder !== null && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-paper border border-cardboard rounded-sm shadow-2xl max-w-lg w-full max-h-[90dvh] flex flex-col animate-fade-in relative text-left overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur-xs border-b border-cardboard/40 px-4 sm:px-6 py-3.5 sm:py-4 flex items-start justify-between shrink-0">
              <div className="space-y-0.5 pr-4">
                <Eyebrow label="DELIVERED RECIPE FEEDBACK" />
                <h3 className="font-display font-black text-xl sm:text-2xl text-ink tracking-tight">
                  Rate Sourced Formulations
                </h3>
                <p className="font-body text-xs text-ink opacity-70">
                  Share your companion's experience with the meals in Order #{reviewingOrder.id}.
                </p>
              </div>
              <button 
                onClick={() => setReviewingOrder(null)}
                aria-label="Close review modal"
                className="w-8 h-8 rounded-full border border-cardboard/60 bg-paperLight hover:bg-cardboard/20 flex items-center justify-center text-ink opacity-70 hover:opacity-100 transition-all cursor-pointer shrink-0 mt-0.5 active:scale-95 shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              {reviewingOrder.items?.map((item: any) => {
                const isAlreadyReviewed = reviewedProductIds[item.product_id];
                const isCurrentActive = activeReviewProductId === item.product_id;

                return (
                  <div 
                    key={item.id} 
                    className="border border-cardboard border-opacity-40 p-4 bg-paperLight space-y-3 rounded-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div>
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
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                          Reviewed ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrentActive) {
                              setActiveReviewProductId(null);
                            } else {
                              setActiveReviewProductId(item.product_id);
                              setReviewRating(5);
                              setReviewComment('');
                              setReviewImage(null);
                              setReviewImagePreview(null);
                            }
                          }}
                          className="font-mono text-[9px] uppercase font-bold text-herb hover:underline bg-paper border border-cardboard px-2.5 py-1 rounded-sm cursor-pointer"
                        >
                          {isCurrentActive ? 'Cancel' : 'Write Review'}
                        </button>
                      )}
                    </div>

                    {isCurrentActive && (
                      <form onSubmit={(e) => handleRecipeReviewSubmit(e, item.product_id)} className="pt-3 border-t border-cardboard border-dashed space-y-3">
                        {reviewSubmitSuccess ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm text-xs font-mono">
                            Review submitted successfully! Thank you for your feedback.
                          </div>
                        ) : (
                          <>
                            {reviewSubmitError && (
                              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-sm text-xs">
                                {reviewSubmitError}
                              </div>
                            )}

                            <div>
                              <span className="font-mono text-[9px] uppercase font-bold text-cardboard block mb-1">
                                Rating (1-5 Stars)
                              </span>
                              <div className="flex space-x-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
                                  >
                                    <Star 
                                      className={`w-5 h-5 ${
                                        star <= reviewRating 
                                          ? 'fill-turmeric text-turmeric' 
                                          : 'text-cardboard/40'
                                      }`} 
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="font-mono text-[9px] uppercase font-bold text-cardboard block mb-1">
                                Companion's Feedback
                              </label>
                              <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="How did your pet enjoy this freshly formulated recipe?"
                                rows={3}
                                className="w-full p-2.5 bg-paper border border-cardboard rounded-sm text-xs font-body text-ink focus:outline-hidden focus:border-turmeric resize-none"
                              />
                            </div>

                            <div>
                              <span className="font-mono text-[9px] uppercase font-bold text-cardboard block mb-1">
                                Add a Photo (Optional)
                              </span>
                              <div className="flex items-center space-x-3">
                                <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-paper border border-cardboard hover:bg-paperLight rounded-sm font-mono text-[9px] uppercase font-bold text-ink cursor-pointer">
                                  <Camera className="w-3.5 h-3.5 text-turmeric" />
                                  <span>Choose File</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                  />
                                </label>
                                {reviewImage && (
                                  <span className="text-[10px] font-mono text-ink opacity-70 truncate max-w-[150px]">
                                    {reviewImage.name}
                                  </span>
                                )}
                              </div>
                              {reviewImagePreview && (
                                <div className="mt-2 w-16 h-16 rounded-sm border border-cardboard overflow-hidden">
                                  <img 
                                    src={reviewImagePreview} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end space-x-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setActiveReviewProductId(null)}
                                className="px-3 py-1.5 border border-cardboard font-mono text-[9px] uppercase font-bold text-ink rounded-sm hover:bg-paper cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingReview}
                                className="bg-herb hover:bg-herb/90 text-white font-mono text-[9px] uppercase font-bold px-4 py-2 rounded-sm cursor-pointer shadow-xs disabled:opacity-50 active:scale-98"
                              >
                                {isSubmittingReview ? 'Submitting...' : 'Post Recipe Review'}
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

            {/* Footer */}
            <div className="sticky bottom-0 bg-paper/95 border-t border-cardboard/30 p-3 sm:p-4 shrink-0">
              <button
                onClick={() => setReviewingOrder(null)}
                className="w-full bg-paper border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold py-2.5 tracking-wider rounded-sm transition-colors cursor-pointer active:scale-98"
              >
                Close Feedback Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
