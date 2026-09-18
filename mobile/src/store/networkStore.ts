import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  isInitialized: boolean;
  init: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  // Assume connected until the first NetInfo event arrives, so we never
  // flash an offline banner on a normally-connected cold start.
  isConnected: true,
  isInitialized: false,
  init: () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can briefly be null while NetInfo is still
      // probing; fall back to isConnected in that case rather than treating
      // "unknown" as "offline".
      const reachable = state.isInternetReachable ?? state.isConnected ?? true;
      set({ isConnected: reachable, isInitialized: true });
    });
    return unsubscribe;
  },
}));

// Axios sets `request` once a request was actually sent, but only sets
// `response` once a server actually answered it. No response with a request
// present (or the "Network Error" message some platforms use instead) means
// the request never reached the server — a connectivity failure, not an API
// error the server chose to return.
export function isNetworkError(err: any): boolean {
  if (err?.response) return false;
  return !!err?.request || err?.message === 'Network Error' || err?.code === 'ECONNABORTED';
}
