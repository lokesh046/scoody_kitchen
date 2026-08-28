import { create } from 'zustand';
import type { NotificationResponse } from '../api/notifications';

interface ToastState {
  toasts: NotificationResponse[];
  addToast: (toast: NotificationResponse) => void;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => set((state) => {
    // Prevent duplicate toast alerts in the stack
    if (state.toasts.some((t) => t.id === toast.id)) return state;
    return { toasts: [...state.toasts, toast] };
  }),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));
