import { COLORS } from '../../theme/colors';

export const QUICK_SYMPTOMS = [
  '🐾 Skin Itching & Allergies',
  '🥗 Transition to Fresh Food',
  '🤢 Digestive Issues & Vomiting',
  '⚖️ Weight & Portion Guidance',
  '🦴 Joint & Mobility Health',
  '🩺 General Nutrition Review',
];

export const formatLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed' || s === 'in_progress') {
    return {
      bg: '#EDF5F0',
      text: COLORS.forestGreen,
      label: s === 'in_progress' ? 'LIVE NOW' : 'CONFIRMED',
    };
  }
  if (s === 'completed') {
    return { bg: '#F3F4F6', text: '#4B5563', label: 'COMPLETED' };
  }
  if (s === 'cancelled') {
    return { bg: '#FEE2E2', text: '#DC2626', label: 'CANCELLED' };
  }
  return { bg: '#FAF5EE', text: '#B45309', label: 'PENDING' };
};

export const formatDate = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

export const getDoctorImageUrl = (doc: any) => {
  return doc?.profile_image_url || doc?.user?.profile_image_url || null;
};

export const formatTime12h = (time24: string) => {
  if (!time24) return 'Select a Slot';
  try {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${mStr} ${ampm}`;
  } catch {
    return time24;
  }
};
