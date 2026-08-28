import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { Header } from '../../components/Header';
import { AdminBroadcastCard } from '../../components/AdminBroadcastCard';
import { 
  fetchAdminOrders, 
  updateAdminOrderStatus, 
  createOrderShipment, 
  fetchAdminOrderById,
  fetchAdminOrderStats
} from '../../api/admin';
import { 
  Loader2, 
  ArrowLeft, 
  Truck, 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock 
} from 'lucide-react';

const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['processing'],
  processing: ['packed', 'shipped'],
  packed: ['shipped'],
  shipped: ['in_transit', 'delivered', 'returned', 'delivery_failed'],
  in_transit: ['out_for_delivery', 'delivered', 'returned', 'delivery_failed'],
  out_for_delivery: ['delivered', 'returned', 'delivery_failed'],
  delivered: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

type OrderTab = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState<OrderTab>('pending');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<number | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['adminOrderStats'],
    queryFn: () => fetchAdminOrderStats(),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['adminOrders', activeSubTab, currentPage],
    queryFn: () => fetchAdminOrders(activeSubTab, currentPage, pageSize),
  });

  const { data: orderDetails, isLoading: orderDetailsLoading } = useQuery({
    queryKey: ['adminOrderDetails', selectedOrderId],
    queryFn: () => fetchAdminOrderById(selectedOrderId!),
    enabled: selectedOrderId !== null,
  });

  // Mutations
  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) => 
      updateAdminOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
    }
  });

  const addShipmentMutation = useMutation({
    mutationFn: ({ orderId, carrier, tracking }: { orderId: number; carrier: string; tracking: string }) => 
      createOrderShipment(orderId, carrier, tracking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
      setShippingOrderId(null);
      setCarrier('');
      setTrackingNumber('');
    }
  });

  const downloadSingleOrderTXT = (order: any) => {
    let content = `=========================================\n`;
    content += `SCOOBY'S KITCHEN - SHIPPING MANIFEST\n`;
    content += `=========================================\n`;
    content += `Order ID: #${order.id}\n`;
    content += `Date: ${new Date(order.created_at).toLocaleString()}\n`;
    content += `Status: ${order.status.toUpperCase()}\n`;
    content += `-----------------------------------------\n`;
    content += `RECIPIENT & CONTACT:\n`;
    content += `Customer Name: ${order.user_name || 'Anonymous'}\n`;
    const rawPhone = order.user_phone || 'N/A';
    const formattedPhone = rawPhone.startsWith('+91') ? rawPhone : `+91 ${rawPhone}`;
    content += `Phone Number: ${formattedPhone}\n`;
    content += `Email Address: ${order.user_email || 'N/A'}\n`;
    content += `Shipping Address:\n${order.shipping_address}\n`;
    content += `-----------------------------------------\n`;
    content += `ITEMS ORDERED:\n`;
    order.items?.forEach((item: any) => {
      content += `- ${item.product_name || `Product #${item.product_id}`} [Weight: ${item.selected_weight || 'N/A'}] x${item.quantity} (Price: ₹${Number(item.price).toFixed(2)})\n`;
    });
    content += `-----------------------------------------\n`;
    content += `TOTAL AMOUNT DUE: ₹${Number(order.total_amount).toFixed(2)}\n`;
    content += `=========================================\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `order_manifest_${order.id}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadConfirmedOrdersCSV = async () => {
    try {
      const allConfirmed = await fetchAdminOrders('confirmed', 1, 1000);
      const targets = allConfirmed.filter(o => o.status.toUpperCase() === 'CONFIRMED');
      if (targets.length === 0) {
        alert("No orders with status 'CONFIRMED' found to export.");
        return;
      }

      let csvContent = "Order ID,Date,Customer Name,Email,Phone,Shipping Address,Items,Total Amount (INR)\n";
      targets.forEach(o => {
        const date = new Date(o.created_at).toLocaleString().replace(/,/g, '');
        const customerName = (o.user_name || 'Anonymous').replace(/,/g, '');
        const email = (o.user_email || 'N/A').replace(/,/g, '');
        const phone = (o.user_phone || 'N/A').replace(/,/g, '').replace(/^\+/, '');
        const address = (o.shipping_address || '').replace(/,/g, ';').replace(/\n/g, ' ');
        const items = o.items.map((i: any) => `${i.product_name || `Product #${i.product_id}`} (x${i.quantity})`).join('; ');
        const total = Number(o.total_amount).toFixed(2);
        
        csvContent += `${o.id},${date},${customerName},${email},${phone},"${address}","${items}",${total}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `confirmed_orders_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV Export failed:", err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const downloadDeliveredOrdersCSV = async () => {
    try {
      const allDelivered = await fetchAdminOrders('delivered', 1, 1000);
      const targets = allDelivered.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status.toUpperCase()));
      if (targets.length === 0) {
        alert("No delivered or completed orders found to export.");
        return;
      }

      let csvContent = "Order ID,Date,Status,Customer Name,Email,Phone,Shipping Address,Items,Total Amount (INR)\n";
      targets.forEach(o => {
        const date = new Date(o.created_at).toLocaleString().replace(/,/g, '');
        const customerName = (o.user_name || 'Anonymous').replace(/,/g, '');
        const email = (o.user_email || 'N/A').replace(/,/g, '');
        const phone = (o.user_phone || 'N/A').replace(/,/g, '').replace(/^\+/, '');
        const address = (o.shipping_address || '').replace(/,/g, ';').replace(/\n/g, ' ');
        const items = o.items.map((i: any) => `${i.product_name || `Product #${i.product_id}`} (x${i.quantity})`).join('; ');
        const total = Number(o.total_amount).toFixed(2);
        
        csvContent += `${o.id},${date},${o.status.toUpperCase()},${customerName},${email},${phone},"${address}","${items}",${total}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `delivered_orders_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV Export failed:", err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const getTargetOrders = () => {
    return orders || [];
  };

  const renderOrderCard = (order: any) => {
    return (
      <div key={order.id} className="border border-cardboard bg-paperLight p-5 rounded-sm space-y-4 text-xs relative flex flex-col justify-between">
        <div className="space-y-4">
          {/* Card Header */}
          <div className="flex justify-between items-start gap-2 border-b border-cardboard border-dashed pb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold flex items-center space-x-1.5">
                <span>ORDER RECORD #{order.id}</span>
                <button
                  onClick={() => setSelectedOrderId(order.id)}
                  className="text-cardboard hover:text-ink hover:underline lowercase font-semibold text-[8px] transition-colors cursor-pointer border-0 bg-transparent"
                >
                  (details)
                </button>
                <button
                  onClick={() => downloadSingleOrderTXT(order)}
                  className="text-herb hover:text-ink hover:underline lowercase font-semibold text-[8px] transition-colors cursor-pointer border-0 bg-transparent"
                >
                  (download manifest)
                </button>
              </div>
              <div className="text-[10px] text-ink opacity-60 mt-0.5 font-mono">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
            <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
              order.status.toUpperCase() === 'COMPLETED' || order.status.toLowerCase() === 'delivered'
                ? 'bg-green-100 text-green-800'
                : order.status.toUpperCase() === 'CANCELLED'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {order.status}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-50">Sourced Recipe Items:</div>
            <ul className="divide-y divide-cardboard divide-dashed divide-opacity-40">
              {order.items.map((item: any) => (
                <li key={item.id} className="py-1.5 flex justify-between font-body text-[11px] text-ink">
                  <span className="font-semibold truncate max-w-[200px]">
                    {item.product_name || `Product #${item.product_id}`}
                    {item.selected_weight && <span className="text-[9px] text-herb font-mono ml-1 font-bold">({item.selected_weight})</span>}
                    <span className="opacity-60 font-normal"> x{item.quantity}</span>
                  </span>
                  <span className="font-mono opacity-95">₹{Number(item.price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-cardboard pt-2 flex justify-between font-bold text-ink text-xs">
              <span>Total Sourcing Fee:</span>
              <span className="font-mono text-turmeric">₹{Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="space-y-1 bg-paper bg-opacity-40 p-2.5 border border-cardboard border-opacity-35 rounded-sm">
            <div className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-50">Recipient & Contact:</div>
            <div className="font-body text-[10px] text-ink font-semibold">{order.shipping_address}</div>
            <div className="font-body text-[9px] text-ink opacity-70">
              Customer: {order.user_name || 'Anonymous'} | Ph: {order.user_phone || 'N/A'}
            </div>
            {order.user_email && (
              <div className="font-mono text-[8px] text-ink opacity-55">Email: {order.user_email}</div>
            )}
          </div>

          {/* Shipment Tracking details */}
          {order.tracking_number ? (
            <div className="p-2.5 border border-cardboard rounded-sm bg-paper bg-opacity-70 space-y-1">
              <div className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold flex items-center space-x-1">
                <Truck className="w-3.5 h-3.5" />
                <span>Active Shipment Tracking</span>
              </div>
              <div className="font-body text-[9px] text-ink">
                Carrier: <strong className="uppercase">{order.carrier}</strong>
              </div>
              <div className="font-mono text-[9px] text-ink truncate">
                Tracking No: <strong>{order.tracking_number}</strong>
              </div>
            </div>
          ) : ['SHIPPED', 'PROCESSING', 'PACKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(order.status.toUpperCase()) ? (
            <div className="space-y-2">
              {shippingOrderId === order.id ? (
                <div className="p-2.5 border border-dashed border-cardboard rounded-sm space-y-2 bg-paper bg-opacity-50">
                  <div className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-70">Assign Courier Tracker:</div>
                  <input
                    placeholder="Carrier (e.g. BlueDart)"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="bg-paperLight border border-cardboard p-1.5 text-[10px] text-ink outline-none w-full rounded-xs font-body"
                  />
                  <input
                    placeholder="Tracking Number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="bg-paperLight border border-cardboard p-1.5 text-[10px] text-ink outline-none w-full rounded-xs font-mono"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => addShipmentMutation.mutate({ orderId: order.id, carrier, tracking: trackingNumber })}
                      disabled={addShipmentMutation.isPending}
                      className="bg-turmeric text-ink font-mono text-[8px] uppercase px-3 py-1 font-bold rounded-xs disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                    >
                      {addShipmentMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setShippingOrderId(null)}
                      className="border border-cardboard font-mono text-[8px] uppercase px-3 py-1 font-bold rounded-xs text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShippingOrderId(order.id)}
                  className="border border-cardboard hover:bg-paper font-mono text-[8px] uppercase px-2.5 py-1.5 font-bold rounded-sm text-ink flex items-center justify-center space-x-1.5 w-full cursor-pointer transition-colors"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Register Shipment Carrier</span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Quick Progression Actions */}
        <div className="pt-3 border-t border-cardboard border-dashed mt-4">
          {(() => {
            const statusUpper = order.status.toUpperCase();
            if (statusUpper === 'PENDING') {
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'CONFIRMED' })}
                    disabled={updateOrderStatusMutation.isPending}
                    className="bg-turmeric text-ink font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm flex-1 hover-bounce disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Order
                  </button>
                  <button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'CANCELLED' })}
                    disabled={updateOrderStatusMutation.isPending}
                    className="border border-cardboard text-paprika hover:bg-paprika hover:text-white font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              );
            }
            if (statusUpper === 'CONFIRMED') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'processing' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Process Order
                </button>
              );
            }
            if (statusUpper === 'PROCESSING') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'shipped' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Mark as Shipped
                </button>
              );
            }
            if (statusUpper === 'PACKED') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'shipped' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Mark as Shipped
                </button>
              );
            }
            if (statusUpper === 'SHIPPED') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'in_transit' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Set In Transit
                </button>
              );
            }
            if (statusUpper === 'IN_TRANSIT') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'out_for_delivery' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Set Out for Delivery
                </button>
              );
            }
            if (statusUpper === 'OUT_FOR_DELIVERY') {
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'delivered' })}
                    disabled={updateOrderStatusMutation.isPending}
                    className="bg-turmeric text-ink font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm flex-1 hover-bounce disabled:opacity-50 cursor-pointer"
                  >
                    Delivered
                  </button>
                  <button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'delivery_failed' })}
                    disabled={updateOrderStatusMutation.isPending}
                    className="border border-cardboard text-paprika hover:bg-paprika hover:text-white font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Failed
                  </button>
                </div>
              );
            }
            if (statusUpper === 'DELIVERED') {
              return (
                <button
                  onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'COMPLETED' })}
                  disabled={updateOrderStatusMutation.isPending}
                  className="bg-herb hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2 px-3 font-bold rounded-sm w-full disabled:opacity-50 cursor-pointer"
                >
                  Complete Transaction
                </button>
              );
            }
            return (
              <span className="text-[10px] font-mono text-cardboard block text-center uppercase tracking-wider font-bold">
                Archived & Closed
              </span>
            );
          })()}
        </div>
      </div>
    );
  };

  const targetOrders = getTargetOrders();

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Header component */}
      <Header activeTab="admin" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Back Link */}
        <div className="mb-8 text-left">
          <button
            onClick={() => navigate('/admin')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to Administrative Core</span>
          </button>
        </div>

        {/* Title Area */}
        <div className="mb-10 text-left border-b border-cardboard pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Eyebrow label="VETERINARY COMMERCE ADMINISTRATIVE CORE" />
            <h2 className="font-display font-bold text-4xl text-ink mt-1">
              Fulfillment & Orders Center
            </h2>
            <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-2xl">
              Fulfill recipe batches, manage courier trackers, and verify delivery transitions.
            </p>
          </div>

          <button
            onClick={() => navigate('/admin')}
            className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wide hover-bounce cursor-pointer shadow-xs flex items-center space-x-1.5 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Admin Panel</span>
          </button>
        </div>

        {/* Global Announcement Broadcast */}
        <div className="mb-8 max-w-xl text-left">
          <AdminBroadcastCard />
        </div>

        {/* Horizontal Sub-tabs selection */}
        <div className="flex overflow-x-auto flex-nowrap border-b border-cardboard gap-1 mb-8 scrollbar-none scroll-smooth">
          {(['pending', 'confirmed', 'delivered', 'cancelled'] as OrderTab[]).map((tab) => {
            const countMap = {
              pending: stats?.pending ?? 0,
              confirmed: stats?.confirmed ?? 0,
              delivered: stats?.delivered ?? 0,
              cancelled: stats?.cancelled ?? 0
            };
            const labelMap = {
              pending: 'Pending Confirmations',
              confirmed: 'Fulfillment & Shipped',
              delivered: 'Delivered & Completed',
              cancelled: 'Cancelled & Failed'
            };
            const iconMap = {
              pending: Clock,
              confirmed: Truck,
              delivered: CheckCircle2,
              cancelled: XCircle
            };

            const Icon = iconMap[tab];
            const isActive = activeSubTab === tab;

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveSubTab(tab);
                  setCurrentPage(1);
                }}
                className={`flex items-center space-x-2 px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-wider border-t border-x transition-all duration-150 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-paperLight border-cardboard border-t-turmeric border-t-2 text-ink -mb-[1px] relative z-10'
                    : 'bg-transparent border-transparent text-ink opacity-70 hover:opacity-100 hover:bg-paperLight hover:border-cardboard'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-turmeric' : ''}`} />
                <span>{labelMap[tab]}</span>
                <span className="font-mono text-[9px] bg-paper px-1.5 py-0.5 rounded-sm border border-cardboard font-bold ml-1.5 opacity-90">
                  {countMap[tab]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Notebook spine motif viewport container */}
        <div className="w-full relative pl-4 md:pl-6">
          <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>
          
          <div className="w-full pl-6">
            {ordersLoading ? (
              <div className="flex items-center space-x-2 text-ink opacity-60 py-12 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-mono text-xs uppercase">Loading Platform Ledger...</span>
              </div>
            ) : targetOrders.length === 0 ? (
              <div className="text-center py-20 border border-cardboard border-dashed bg-paperLight rounded-sm">
                <ClipboardList className="w-10 h-10 text-cardboard mx-auto opacity-40 mb-3" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-cardboard block font-bold">
                  No Order Records Found
                </span>
                <p className="font-body text-xs text-ink opacity-65 mt-1">
                  There are no orders registered under the "{activeSubTab}" state category.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeSubTab === 'confirmed' && (
                  <div className="flex justify-end">
                    <button
                      onClick={downloadConfirmedOrdersCSV}
                      className="bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer hover-bounce"
                    >
                      <span>📥 Export All Confirmed Orders (CSV)</span>
                    </button>
                  </div>
                )}
                {activeSubTab === 'delivered' && (
                  <div className="flex justify-end">
                    <button
                      onClick={downloadDeliveredOrdersCSV}
                      className="bg-turmeric text-ink hover:bg-opacity-95 font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer hover-bounce"
                    >
                      <span>📥 Export All Delivered Orders (CSV)</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start animate-fade-in-up">
                  {targetOrders.map(renderOrderCard)}
                </div>

                {/* Pagination Controls */}
                {(() => {
                  const totalForTab = stats?.[activeSubTab] ?? 0;
                  const totalPages = Math.ceil(totalForTab / pageSize) || 1;
                  if (totalPages <= 1) return null;
                  return (
                    <div className="flex items-center justify-between border-t border-cardboard border-dashed pt-6 mt-6">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="bg-paper border border-cardboard text-ink px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-sm hover:bg-paperLight disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        ← Previous Page
                      </button>
                      <span className="font-mono text-[10px] text-ink uppercase opacity-75">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="bg-paper border border-cardboard text-ink px-4 py-2 text-[10px] font-mono font-bold uppercase rounded-sm hover:bg-paperLight disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Next Page →
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cart side drawer fallback */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Order Transaction Detail Modal Drawer */}
      {selectedOrderId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-lg w-full p-6 space-y-6 animate-fade-in-up relative text-left">
            <button 
              onClick={() => setSelectedOrderId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="SCOOBY PLATFORM TRANSACTION LEDGER" />
              <h3 className="font-display font-bold text-xl text-ink">
                Order Sourcing Record #{selectedOrderId}
              </h3>
            </div>

            {orderDetailsLoading ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <span className="font-mono text-xs uppercase text-ink opacity-60">Loading Order Sourcing Record...</span>
              </div>
            ) : !orderDetails ? (
              <p className="font-body text-xs text-ink opacity-60">Failed to load order transaction details.</p>
            ) : (
              <div className="space-y-5 text-xs font-body">
                {/* Status Indicator banner */}
                <div className="flex justify-between items-center p-3 border border-cardboard rounded-sm bg-paper bg-opacity-50">
                  <div>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">PLACED DATE</span>
                    <span className="font-mono text-xs text-ink font-bold">{new Date(orderDetails.created_at).toLocaleString()}</span>
                  </div>
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                    orderDetails.status.toUpperCase() === 'COMPLETED' || orderDetails.status.toLowerCase() === 'delivered'
                      ? 'text-herb bg-emerald-50 border-emerald-200'
                      : orderDetails.status.toUpperCase() === 'CANCELLED'
                      ? 'text-paprika bg-red-50 border-red-200'
                      : 'text-turmeric bg-amber-50 border-amber-200'
                  }`}>
                    {orderDetails.status}
                  </span>
                </div>

                {/* Sourced Recipe list */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">SOURCED RECIPE ITEMS</span>
                  <ul className="divide-y divide-cardboard divide-dashed border-t border-b border-cardboard">
                    {orderDetails.items?.map((item: any) => (
                      <li key={item.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-body font-bold text-ink">
                            {item.product_name ? `${item.product_name} (ID: #${item.product_id})` : `Product #${item.product_id}`}
                          </span>
                          {item.selected_weight && (
                            <span className="text-[9px] text-herb font-mono ml-1.5 font-bold">({item.selected_weight})</span>
                          )}
                          <div className="text-[10px] text-ink opacity-60 font-mono mt-0.5">Quantity: x{item.quantity} | Unit Price: ₹{Number(item.price).toFixed(2)}</div>
                        </div>
                        <span className="font-mono font-bold text-ink">₹{(Number(item.price) * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between font-bold text-ink text-sm pt-1">
                    <span>Total Sourcing Fee:</span>
                    <span className="font-mono text-turmeric">₹{Number(orderDetails.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-2 gap-4 border-t border-cardboard border-dashed pt-4">
                  <div className="space-y-1">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">SHIPPING RECIPIENT</span>
                    <p className="font-body font-bold text-ink">{orderDetails.shipping_address}</p>
                    <p className="font-body text-ink opacity-70">Customer: {orderDetails.user_name || 'Anonymous'}</p>
                    <p className="font-body text-ink opacity-70">Phone: {orderDetails.user_phone || 'N/A'}</p>
                    {orderDetails.user_email && (
                      <p className="font-body text-ink opacity-75">Email: {orderDetails.user_email}</p>
                    )}
                  </div>
                  <div className="space-y-2 border-l border-cardboard border-dashed pl-4">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">STATUS MANAGEMENT</span>
                    
                    <div className="space-y-1.5">
                      <select
                        value={orderDetails.status}
                        disabled={updateOrderStatusMutation.isPending}
                        onChange={(e) => {
                          updateOrderStatusMutation.mutate({ orderId: orderDetails.id, status: e.target.value });
                          setSelectedOrderId(null);
                        }}
                        className="w-full bg-paper border border-cardboard font-mono text-[9px] uppercase px-2 py-2 rounded-sm text-ink outline-none disabled:opacity-50"
                      >
                        <option value={orderDetails.status} disabled>{orderDetails.status} (Current)</option>
                        <option value="PENDING" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('PENDING')}>Set Pending</option>
                        <option value="CONFIRMED" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('CONFIRMED')}>Confirm Order</option>
                        <option value="processing" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('processing')}>Process Order</option>
                        <option value="shipped" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('shipped')}>Ship Order</option>
                        <option value="delivered" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('delivered')}>Set Delivered</option>
                        <option value="COMPLETED" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('COMPLETED')}>Complete Order</option>
                        <option value="CANCELLED" disabled={!VALID_ORDER_TRANSITIONS[orderDetails.status]?.includes('CANCELLED')}>Cancel Order</option>
                      </select>
                      <p className="text-[9px] text-ink opacity-60 leading-normal">Status transitions are governed by platform ledger constraints.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => downloadSingleOrderTXT(orderDetails)}
                    className="flex-1 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm cursor-pointer transition-colors text-center"
                  >
                    📥 Download Manifest
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="flex-1 bg-paper border border-cardboard font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm text-ink hover-bounce cursor-pointer text-center"
                  >
                    Dismiss Ledger
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
