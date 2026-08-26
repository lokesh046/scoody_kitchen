import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchActiveBanners } from '../api/banners';
import type { BannerResponse } from '../types/banner';

export const HomeBannerCarousel: React.FC = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(1); // Start at 1 (first real banner)
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const autoPlayTimerRef = useRef<any>(null);

  // Fetch banners from API
  const { data: banners, isLoading } = useQuery({
    queryKey: ['active-banners'],
    queryFn: fetchActiveBanners,
  });

  // Default fallback banners matching the visual design tokens
  const fallbackBanners: Partial<BannerResponse>[] = [
    {
      id: -1,
      title: "Welcome to Scooby's Kitchen",
      subtitle: "Human-grade, small-batch recipes cooked for active pet health. Sourced with 100% transparent ingredients.",
      image_url: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=1200",
      link_url: "/shop",
    },
    {
      id: -2,
      title: "Honest Ingredients. Zero Filler.",
      subtitle: "Every single recipe batch contains zero corn, wheat, soy, or rendering byproducts. Certified by pet nutritionists.",
      image_url: "https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=80&w=1200",
      link_url: "/shop",
    },
    {
      id: -3,
      title: "Veterinary Audited Diets",
      subtitle: "Schedule online consultations and log active nutritional diagnostics directly with certified pet doctors.",
      image_url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=1200",
      link_url: "/consultations",
    }
  ];

  const activeBanners = banners && banners.length > 0 ? banners : fallbackBanners;

  // Cloned banners for infinite circular loop: [Last, A, B, C, First]
  const clonedBanners = activeBanners.length > 1
    ? [
        activeBanners[activeBanners.length - 1],
        ...activeBanners,
        activeBanners[0]
      ]
    : activeBanners;

  const handleNext = () => {
    if (!transitionEnabled) return;
    if (activeBanners.length <= 1) return;
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (!transitionEnabled) return;
    if (activeBanners.length <= 1) return;
    setCurrentIndex((prev) => prev - 1);
  };

  const handleTransitionEnd = () => {
    if (activeBanners.length <= 1) return;
    
    // If we reached the end clone (First banner copy)
    if (currentIndex === clonedBanners.length - 1) {
      setTransitionEnabled(false);
      setCurrentIndex(1);
    }
    // If we reached the start clone (Last banner copy)
    else if (currentIndex === 0) {
      setTransitionEnabled(false);
      setCurrentIndex(activeBanners.length);
    }
  };

  // Re-enable transition after silent jump
  useEffect(() => {
    if (!transitionEnabled) {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [transitionEnabled]);

  // Autoplay functionality: rotates every 6.5 seconds when not hovered
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      handleNext();
    }, 6500);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [currentIndex, activeBanners.length, isHovered, transitionEnabled]);

  const getOriginalIndex = () => {
    if (activeBanners.length <= 1) return 0;
    if (currentIndex === 0) return activeBanners.length - 1;
    if (currentIndex === clonedBanners.length - 1) return 0;
    return currentIndex - 1;
  };

  const handleDotClick = (index: number) => {
    if (!transitionEnabled) return;
    setCurrentIndex(index + 1);
  };

  if (isLoading) {
    return (
      <div className="w-full h-[320px] sm:h-[380px] md:h-[450px] bg-paper flex items-center justify-center border-b border-cardboard border-opacity-35">
        <div className="animate-pulse space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-dashed border-turmeric animate-spin mx-auto"></div>
          <span className="font-mono text-[9px] uppercase font-bold text-ink opacity-60">Setting up carousel...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-paper py-14 border-b border-cardboard border-opacity-35 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slide Container Wrapper */}
      <div 
        className="w-full relative overflow-visible flex items-center justify-center"
        style={{
          perspective: '1200px',
        }}
      >
        {/* Sliding Track utilizing CSS layout variables */}
        <div
          className="flex items-center"
          onTransitionEnd={handleTransitionEnd}
          style={{
            display: 'flex',
            width: '100%',
            // Calculation computes the offset centering current slide while peeking left and right
            transform: `translate3d(calc(50vw - (var(--slide-width) / 2) - (${currentIndex} * var(--slide-width))), 0, 0)`,
            WebkitTransform: `translate3d(calc(50vw - (var(--slide-width) / 2) - (${currentIndex} * var(--slide-width))), 0, 0)`,
            transition: transitionEnabled ? 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
            //@ts-ignore
            '--slide-width': window.innerWidth < 768 ? '92vw' : '80vw',
          }}
        >
          {clonedBanners.map((slide, idx) => {
            const isActive = activeBanners.length > 1
              ? idx === currentIndex
              : idx === 0;

            const isPrev = activeBanners.length > 1 && idx === (currentIndex - 1 + clonedBanners.length) % clonedBanners.length;
            const isNext = activeBanners.length > 1 && idx === (currentIndex + 1) % clonedBanners.length;

            return (
              <div
                key={`${slide.id}-${idx}`}
                onClick={() => {
                  if (isActive) {
                    if (slide.link_url) navigate(slide.link_url);
                  } else if (isPrev) {
                    handlePrev();
                  } else if (isNext) {
                    handleNext();
                  }
                }}
                className={`flex-shrink-0 px-2 sm:px-4 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                  isActive ? 'cursor-pointer scale-100 opacity-100' : 'cursor-pointer scale-[0.93] opacity-45 hover:opacity-75'
                }`}
                style={{
                  width: 'var(--slide-width)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Visual Card Banner Panel */}
                <div 
                  className={`relative w-full h-[320px] sm:h-[440px] md:h-[540px] bg-ink rounded-[16px] overflow-hidden border border-cardboard shadow-md transition-shadow duration-300 ${
                    isActive ? 'shadow-lg ring-1 ring-cardboard ring-opacity-25' : ''
                  }`}
                >
                  {/* Background Image Banner */}
                  <img
                    src={slide.image_url}
                    alt={slide.title || 'Featured Banner'}
                    className="w-full h-full object-cover select-none"
                    draggable={false}
                  />

                  {/* Dark gradient shadow vignette for readability */}
                  {(slide.title || slide.subtitle) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-10 text-left text-paper">
                      <div className="max-w-xl space-y-2 animate-fade-in-up">
                        {slide.title && (
                          <h3 className="font-display font-black text-lg sm:text-2xl md:text-3xl text-turmeric uppercase tracking-tight leading-tight">
                            {slide.title}
                          </h3>
                        )}
                        {slide.subtitle && (
                          <p className="font-body text-[10px] sm:text-xs md:text-sm text-paperLight opacity-90 line-clamp-2 leading-relaxed">
                            {slide.subtitle}
                          </p>
                        )}
                        {slide.link_url && (
                          <span className="inline-flex items-center space-x-1 font-mono text-[9px] uppercase font-bold text-turmeric pt-1 hover:underline">
                            <span>Explore Recipe</span>
                            <span>&rarr;</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons (Visible on hover) */}
      {activeBanners.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className={`absolute left-4 sm:left-12 top-1/2 -translate-y-1/2 z-20 bg-paperLight border border-cardboard p-3 rounded-full text-ink shadow-md hover:bg-paper hover:scale-105 active:scale-95 transition-all cursor-pointer ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleNext}
            className={`absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 z-20 bg-paperLight border border-cardboard p-3 rounded-full text-ink shadow-md hover:bg-paper hover:scale-105 active:scale-95 transition-all cursor-pointer ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Next Slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Slide Dot Indicators */}
      {activeBanners.length > 1 && (
        <div className="flex justify-center space-x-2 mt-6">
          {activeBanners.map((_, idx) => {
            const originalIndex = getOriginalIndex();
            return (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === originalIndex
                    ? 'w-6 bg-turmeric border border-cardboard'
                    : 'w-2.5 bg-cardboard bg-opacity-40 hover:bg-opacity-65'
                }`}
                title={`Go to slide ${idx + 1}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
