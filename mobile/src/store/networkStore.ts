import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from '../api/client';

interface NetworkState {
  isConnected: boolean;
  isInitialized: boolean;
  init: () => () => void;
}

// NetInfo's default reachability probe pings Google's own connectivity-check
// endpoint. Plenty of real networks (carrier DNS, a custom/private DNS
// provider, a firewall) block or throttle that specific host independently
// of whether the app's own backend is reachable — the app was fully working
// under a red "No internet connection" banner because of exactly that
// mismatch. Probing our own API instead measures the connection that
// actually matters here.
NetInfo.configure({
  reachabilityUrl: `${BASE_URL}/health`,
  // NetInfo defaults this probe to HEAD, but the backend's /health route
  // only handles GET (HEAD hangs for ~75s before a 405) — force GET, which
  // it already answers correctly in well under a second.
  reachabilityMethod: 'GET',
  reachabilityTest: async (response) => response.status === 200,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityLongTimeout: 60 * 1000,
  reachabilityRequestTimeout: 8 * 1000,
});

// A single failed probe is common on an otherwise-fine connection (one slow
// DNS lookup, one dropped packet) and isn't worth alarming the user over —
// only surface the banner once the probe has failed this many times in a
// row. Recovery stays immediate: any single successful probe clears it.
const CONSECUTIVE_FAILURES_TO_FLAG_OFFLINE = 2;

export const useNetworkStore = create<NetworkState>((set) => {
  let consecutiveFailures = 0;

  return {
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

        if (reachable) {
          consecutiveFailures = 0;
          set({ isConnected: true, isInitialized: true });
          return;
        }

        consecutiveFailures += 1;
        set({
          isConnected: consecutiveFailures < CONSECUTIVE_FAILURES_TO_FLAG_OFFLINE,
          isInitialized: true,
        });
      });
      return unsubscribe;
    },
  };
});

// Axios sets `request` once a request was actually sent, but only sets
// `response` once a server actually answered it. No response with a request
// present (or the "Network Error" message some platforms use instead) means
// the request never reached the server — a connectivity failure, not an API
// error the server chose to return.
export function isNetworkError(err: any): boolean {
  if (err?.response) return false;
  return !!err?.request || err?.message === 'Network Error' || err?.code === 'ECONNABORTED';
}
