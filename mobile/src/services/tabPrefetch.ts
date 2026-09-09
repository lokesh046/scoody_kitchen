import { fetchMyOrders, Order } from '../api/orders';
import { fetchCategories, fetchProducts } from '../api/products';
import { Product, Category } from '../types';
import { fetchMyConsultations, Consultation } from '../api/consultations';
import { fetchMyPets } from '../api/pets';
import { usePetStore } from '../store/petStore';

// Each bottom-tab screen fetches its own data the first time it's mounted
// (React Navigation lazy-mounts tabs on first visit), which is what made
// switching to a tab for the first time feel like a 1-2s freeze behind a
// spinner. This module fires those same requests once, right after login,
// so the data is usually already sitting here by the time the user actually
// taps into a given tab — the screen then seeds its first paint from this
// cache instead of starting from empty.
interface TabPrefetchCache {
  orders?: Order[];
  ordersFetchedAt?: number;
  shopProducts?: Product[];
  shopCategories?: Category[];
  shopFetchedAt?: number;
  consultations?: Consultation[];
  consultationsFetchedAt?: number;
  petsFetchedAt?: number;
}

export const tabPrefetchCache: TabPrefetchCache = {};

let started = false;

/**
 * Fire-and-forget: each request is independent, so one being slow or
 * failing never blocks or breaks the others, and this function itself never
 * throws into its caller. Safe to call multiple times — only the first call
 * per session (since the last reset) actually fires anything.
 */
export function prefetchTabData(hasUser: boolean) {
  if (started) return;
  started = true;

  // Public catalog data — fine to warm even for guests browsing the shop.
  Promise.all([
    fetchCategories().catch(() => [] as Category[]),
    fetchProducts({ limit: 30 }).catch(() => ({ items: [] as Product[], total: 0, page: 1, pages: 1 })),
  ]).then(([categories, prodsRes]) => {
    tabPrefetchCache.shopCategories = categories;
    tabPrefetchCache.shopProducts = prodsRes.items || [];
    tabPrefetchCache.shopFetchedAt = Date.now();
  });

  if (!hasUser) return;

  // Pets already lives in a shared Zustand store, so warming it is mostly
  // just writing straight into that store — PetsScreen reads from it
  // directly. petsFetchedAt still gets recorded so PetsScreen's own
  // throttle can recognize this as already-fresh and skip an immediate,
  // redundant refetch right after mount.
  fetchMyPets()
    .then((pets) => {
      usePetStore.getState().setPets(pets || []);
      tabPrefetchCache.petsFetchedAt = Date.now();
    })
    .catch(() => {});

  fetchMyOrders()
    .then((orders) => {
      tabPrefetchCache.orders = orders || [];
      tabPrefetchCache.ordersFetchedAt = Date.now();
    })
    .catch(() => {});

  fetchMyConsultations()
    .then((res) => {
      tabPrefetchCache.consultations = res.items || [];
      tabPrefetchCache.consultationsFetchedAt = Date.now();
    })
    .catch(() => {});
}

// Called on logout so a new session (guest browsing, or a different account
// signing in on the same device) never seeds its first paint from the
// previous user's cached orders/consultations.
export function resetTabPrefetch() {
  started = false;
  tabPrefetchCache.orders = undefined;
  tabPrefetchCache.ordersFetchedAt = undefined;
  tabPrefetchCache.shopProducts = undefined;
  tabPrefetchCache.shopCategories = undefined;
  tabPrefetchCache.shopFetchedAt = undefined;
  tabPrefetchCache.consultations = undefined;
  tabPrefetchCache.consultationsFetchedAt = undefined;
  tabPrefetchCache.petsFetchedAt = undefined;
}
