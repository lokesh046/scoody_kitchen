import type { MouseEvent } from 'react';
import { ChevronDown, PawPrint } from 'lucide-react';

export function HeroScrollHint({ light = false }: { light?: boolean }) {
  const scrollBelowHero = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const hero = event.currentTarget.closest('[data-scroll-hero]');
    if (!hero) return;
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    window.scrollTo({
      top: window.scrollY + hero.getBoundingClientRect().bottom - headerHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={scrollBelowHero}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      aria-label="Scroll to the section below"
      className={`absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex min-h-12 min-w-28 flex-col items-center gap-1 rounded-lg px-3 py-1 cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric ${light ? 'text-ink hover:text-ctaBrown' : 'text-paper hover:text-turmeric [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.65))]'}`}
    >
      <PawPrint size={22} strokeWidth={1.4} aria-hidden="true" />
      <span className="font-body text-[10px] tracking-wider whitespace-nowrap">Scroll to explore</span>
      <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="motion-safe:animate-[bounce_2.5s_infinite]" />
    </button>
  );
}
