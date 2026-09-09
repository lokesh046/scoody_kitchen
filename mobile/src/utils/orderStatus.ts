import { COLORS } from '../theme/colors';

// Shared order-status classification, used by both the orders list
// (OrdersScreen) and the order detail screen so a given order's status
// always maps to the same badge color/label wherever it's shown.

export const isConfirmedAndPaid = (status: string) => {
  const s = (status || '').toUpperCase();
  return s === 'PAID' || s === 'CONFIRMED';
};

export const isDelivered = (status: string) => {
  const s = (status || '').toUpperCase();
  return s === 'DELIVERED' || s === 'COMPLETED';
};

export const isCancelled = (status: string) => {
  const s = (status || '').toUpperCase();
  return s === 'CANCELLED';
};

export const getStatusBadgeStyle = (status: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'DELIVERED' || s === 'COMPLETED') {
    return { bg: '#EDF5F0', text: COLORS.forestGreen, label: 'DELIVERED' };
  }
  if (s === 'SHIPPED' || s === 'DISPATCHED' || s === 'IN_TRANSIT' || s === 'OUT_FOR_DELIVERY') {
    return { bg: '#EBF3FB', text: '#2563EB', label: 'OUT FOR DELIVERY' };
  }
  if (s === 'PREPARING' || s === 'PROCESSING' || s === 'PACKED') {
    return { bg: '#FAF5EE', text: '#B45309', label: 'KITCHEN PREP' };
  }
  if (s === 'PAID' || s === 'CONFIRMED') {
    return { bg: '#EDF5F0', text: COLORS.forestGreen, label: 'CONFIRMED & PAID' };
  }
  if (s === 'CANCELLED') {
    return { bg: '#FEE2E2', text: '#DC2626', label: 'CANCELLED' };
  }
  return { bg: '#F3F4F6', text: COLORS.textMuted, label: s || 'PENDING' };
};
