import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyOrders, cancelOrder, fetchOrderTracking } from '../../api/orders';

import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, 
  Clock, CheckCircle, XCircle, Loader2, AlertCircle,
  Truck, Calendar, Check
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<number | null>(null);

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
    onError: (err) => {
      console.error('Failed to cancel order:', err);
    }
  });



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

                    {order.status.toUpperCase() === 'PENDING' && (
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
      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      </div>
      </main>
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
    </div>
  );
};
