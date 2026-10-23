import { create } from 'zustand';
import type { NearbyClinicCategory, NearbyClinicResult, PlaceDetailsResponse } from '../api/doctors';

// NearbyVetsView re-mounts every time the user navigates away and back
// (tab switch, back button, re-opening the Consult tab) -- its own React
// state was wiped each time, so it re-ran GPS + a fresh network search on
// every single visit, and re-fetched clinic details the user had already
// opened minutes earlier. The backend caches both for 24h, but that only
// saves re-billing Google -- the client still paid a full GPS fix +
// network round trip every time, which is what actually felt slow.
//
// This store lives for the app session (no AsyncStorage persistence --
// stale-across-restarts location data isn't something we want surviving a
// kill, and in-memory is already enough to fix the "re-searches every
// visit" complaint), so a search or a clinic's details fetched once stay
// instantly available for as long as the app stays open, without the
// component itself needing to stay mounted.

export const RESULTS_FRESHNESS_MS = 10 * 60 * 1000; // 10 minutes

export interface SearchSnapshot {
  coords: { lat: number; lng: number };
  category: NearbyClinicCategory;
  radiusKm: 5 | 15 | 25;
  results: NearbyClinicResult[];
  radiusUsed: number | null;
  fallback: boolean;
  fetchedAt: number;
}

interface NearbyVetsState {
  lastSearch: SearchSnapshot | null;
  detailsCache: Record<string, PlaceDetailsResponse>;
  setLastSearch: (snapshot: SearchSnapshot) => void;
  cacheDetails: (placeId: string, details: PlaceDetailsResponse) => void;
}

export const useNearbyVetsStore = create<NearbyVetsState>((set) => ({
  lastSearch: null,
  detailsCache: {},
  setLastSearch: (snapshot) => set({ lastSearch: snapshot }),
  cacheDetails: (placeId, details) =>
    set((state) => ({ detailsCache: { ...state.detailsCache, [placeId]: details } })),
}));

export function isSnapshotFresh(snapshot: SearchSnapshot | null): snapshot is SearchSnapshot {
  return !!snapshot && Date.now() - snapshot.fetchedAt <= RESULTS_FRESHNESS_MS;
}
