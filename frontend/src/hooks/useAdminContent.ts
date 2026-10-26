import { useQuery } from '@tanstack/react-query';
import { fetchActiveBanners } from '../api/banners';
import { fetchActiveFaqs } from '../api/faqs';
import type { BannerPlacement, FaqPage } from '../constants/contentPlacements';

export interface FaqItem {
  q: string;
  a: string;
}

// FAQs for a landing page. Questions added in the admin panel for that page are used;
// until there are any, the built-in questions in the page are shown, so a page is never
// left without a FAQ section.
export function useLandingFaqs(page: FaqPage, fallback: FaqItem[]): FaqItem[] {
  const { data } = useQuery({
    queryKey: ['faqs-active', page],
    queryFn: () => fetchActiveFaqs(page),
    staleTime: 60_000,
  });
  return data && data.length > 0 ? data.map((f) => ({ q: f.question, a: f.answer })) : fallback;
}

export interface HeroContent {
  image: string;
  title: string;
  subtitle: string;
}

// The top image, headline and text of a landing page. The first active banner the admin
// has set for that page wins; any field it leaves empty keeps the built-in default.
// `ready` is false only while the first request is in flight, so the page can wait
// instead of showing the default and then swapping it.
export function useLandingHero(
  placement: BannerPlacement,
  defaults: HeroContent,
): HeroContent & { ready: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['active-banners', placement],
    queryFn: () => fetchActiveBanners(placement),
    staleTime: 60_000,
    retry: 1,
  });
  const banner = data?.[0];
  return {
    image: banner?.image_url || defaults.image,
    title: banner?.title || defaults.title,
    subtitle: banner?.subtitle || defaults.subtitle,
    ready: !isLoading,
  };
}

export interface ToolkitOverride {
  image?: string;
  title?: string;
  text?: string;
}

// Admin overrides for the home page tool cards, keyed by the card's link
// (/pets, /consultations or /onboarding).
export function useToolkitOverrides(): Record<string, ToolkitOverride> {
  const { data } = useQuery({
    queryKey: ['active-banners', 'home_toolkit'],
    queryFn: () => fetchActiveBanners('home_toolkit'),
    staleTime: 60_000,
  });
  const overrides: Record<string, ToolkitOverride> = {};
  (data ?? []).forEach((banner) => {
    if (!banner.link_url || overrides[banner.link_url]) return;
    overrides[banner.link_url] = {
      image: banner.image_url || undefined,
      title: banner.title || undefined,
      text: banner.subtitle || undefined,
    };
  });
  return overrides;
}
