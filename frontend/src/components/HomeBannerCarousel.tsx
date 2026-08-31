import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchActiveBanners } from '../api/banners';

export const HomeBannerCarousel: React.FC = () => {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(1); // Start at 1 (first real banner)
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const autoPlayTimerRef = useRef<any>(null);

  // Fetch banners from API
  const { data: banners, isLoading } = useQuery({
    queryKey: ['active-banners'],
    queryFn: fetchActiveBanners,
  });

  // Default fallback banners matching the user's reference design with 4K ultra-high resolution
  const fallbackBanners: any[] = [
    {
      id: -1,
      badge: "Family Owned • Since 2016",
      pretitle: "Welcome to",
      title: "THE SCOOBY'S FAM",
      subtitle: "Come be a part of our family's quest for delighted and thriving pets! We craft unique pet meals infused with care and premium ingredients, striving to turn each nibble into a source of joy for your furry companions overall well being.",
      tagline: "Our Recipes are crafted to nurture their Mind, Body and Spirit!",
      image_url: "/images/scoobys_fam_banner.jpg",
      link_url: "/shop",
      button_text: "Know More",
    },
    {
      id: -2,
      pretitle: "100% Transparent",
      title: "Honest Ingredients. Zero Filler.",
      subtitle: "Every single recipe batch contains zero corn, wheat, soy, or rendering byproducts. Certified and tested by pet nutrition specialists.",
      tagline: "Human-grade, small-batch recipes cooked for active pet health.",
      image_url: "https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=95&w=2400",
      link_url: "/shop",
      button_text: "Explore Recipes",
    },
    {
      id: -3,
      pretitle: "Clinical Care",
      title: "Veterinary Audited Diets",
      subtitle: "Schedule online consultations and log active nutritional diagnostics directly with certified pet doctors.",
      tagline: "Tailored dietary blueprints for every life stage.",
      image_url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=95&w=2400",
      link_url: "/consultations",
      button_text: "Book Consultation",
    }
  ];

  const enrichedBanners = (banners && banners.length > 0 ? banners : fallbackBanners).map((b: any, index: number) => {
    const fallback = fallbackBanners[index % fallbackBanners.length] || {};
    return {
      ...fallback,
      ...b,
      badge: b.badge || fallback.badge,
      pretitle: b.pretitle || fallback.pretitle,
      tagline: b.tagline || fallback.tagline,
      button_text: b.button_text || fallback.button_text || "Know More"
    };
  });

  const activeBanners = enrichedBanners.length < 3 
    ? [...enrichedBanners, ...fallbackBanners.slice(0, 3 - enrichedBanners.length)] 
    : enrichedBanners;

  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload and decode all banner images into browser GPU memory before rendering
  useEffect(() => {
    if (activeBanners.length === 0) return;

    let isMounted = true;
    const imagePromises = activeBanners.map((banner: any) => {
      if (!banner.image_url) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = banner.image_url!;
        img.onload = () => {
          if ('decode' in img) {
            img.decode().then(() => resolve()).catch(() => resolve());
          } else {
            resolve();
          }
        };
        img.onerror = () => resolve();
      });
    });

    Promise.all(imagePromises).then(() => {
      if (isMounted) {
        setImagesLoaded(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeBanners]);

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
    if (currentIndex >= clonedBanners.length - 1) return;
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (!transitionEnabled) return;
    if (activeBanners.length <= 1) return;
    if (currentIndex <= 0) return;
    setCurrentIndex((prev) => prev - 1);
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    // CRITICAL: Only respond to the sliding track's own transform
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== 'transform') return;
    if (activeBanners.length <= 1) return;
    
    // If we reached the end clone (First banner copy at index 4) -> silently jump to real index 1
    if (currentIndex === clonedBanners.length - 1) {
      setTransitionEnabled(false);
      setCurrentIndex(1);
      if (trackRef.current) {
        trackRef.current.style.transition = 'none';
        void trackRef.current.offsetHeight; // Force browser layout commit
      }
    }
    // If we reached the start clone (Last banner copy at index 0) -> silently jump to real index N
    else if (currentIndex === 0) {
      setTransitionEnabled(false);
      setCurrentIndex(activeBanners.length);
      if (trackRef.current) {
        trackRef.current.style.transition = 'none';
        void trackRef.current.offsetHeight; // Force browser layout commit
      }
    }
  };

  // Re-enable transition safely after layout has committed
  useEffect(() => {
    if (!transitionEnabled) {
      const timer = setTimeout(() => {
        if (trackRef.current) {
          void trackRef.current.offsetHeight;
        }
        setTransitionEnabled(true);
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [transitionEnabled]);

  // Autoplay functionality: rotates every 6 seconds when not hovered
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      handleNext();
    }, 6000);

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

  const translationIndex = activeBanners.length > 1 ? currentIndex : 0;

  // Touch swipe support for mobile
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchEndXRef.current = e.targetTouches[0].clientX;
    setIsHovered(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsHovered(false);
    const distance = touchStartXRef.current - touchEndXRef.current;
    if (distance > 40) {
      handleNext();
    } else if (distance < -40) {
      handlePrev();
    }
  };

  if (isLoading || !imagesLoaded) {
    return (
      <div className="w-full h-[340px] sm:h-[460px] md:h-[540px] lg:h-[600px] bg-paper flex items-center justify-center border-b border-cardboard border-opacity-35">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-dashed border-turmeric animate-spin mx-auto"></div>
          <span className="font-mono text-[9px] uppercase font-bold text-ink opacity-60">Preloading high-definition banners...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-paper py-8 md:py-14 border-b border-cardboard border-opacity-35 select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide Viewport Container */}
      <div className="w-full relative overflow-hidden flex items-center justify-center py-2">
        {/* Sliding Track */}
        <div
          ref={trackRef}
          className="flex items-center"
          onTransitionEnd={handleTransitionEnd}
          style={{
            display: 'flex',
            width: '100%',
            transform: `translate3d(calc(50vw - (var(--slide-width) / 2) - (${translationIndex} * var(--slide-width))), 0, 0)`,
            WebkitTransform: `translate3d(calc(50vw - (var(--slide-width) / 2) - (${translationIndex} * var(--slide-width))), 0, 0)`,
            transition: transitionEnabled ? 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
            //@ts-ignore
            '--slide-width': typeof window !== 'undefined' && window.innerWidth < 768 ? '92vw' : 'min(88vw, 1380px)',
          }}
        >
          {clonedBanners.map((slide: any, idx) => {
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
                className="flex-shrink-0 px-2 sm:px-3.5 cursor-pointer"
                style={{
                  width: 'var(--slide-width)',
                }}
              >
                {/* Visual Card Banner Panel - Enlarged Hero Dimensions with rounded corners */}
                <div className="relative w-full h-[320px] sm:h-[440px] md:h-[540px] lg:h-[600px] bg-[#3d2314] rounded-[24px] overflow-hidden border border-cardboard shadow-md hover:shadow-xl transition-shadow duration-300">
                  {/* Background Image Banner */}
                  <img
                    src={slide.image_url}
                    alt={slide.title || 'Featured Banner'}
                    className="w-full h-full object-cover select-none pointer-events-none rounded-[24px]"
                    draggable={false}
                    loading="eager"
                    decoding="sync"
                  />

                  {/* Dark gradient shadow vignette for readability anchored at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-10 md:p-12 text-left text-paper rounded-[24px]">
                    <div className="max-w-[92%] sm:max-w-md md:max-w-lg lg:max-w-xl space-y-1.5 sm:space-y-2 drop-shadow-md">
                      {/* Badge / Stamp if present */}
                      {slide.badge && (
                        <div className="inline-flex items-center space-x-1.5 border border-paper/40 rounded-full px-2.5 py-0.5 bg-black/35 backdrop-blur-xs">
                          <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-paper font-semibold">
                            {slide.badge}
                          </span>
                        </div>
                      )}

                      {/* Title */}
                      <div>
                        {slide.pretitle && (
                          <span className="font-display font-medium text-[11px] sm:text-xs md:text-sm text-paperLight block tracking-wide">
                            {slide.pretitle}
                          </span>
                        )}
                        {slide.title && (
                          <h3 className="font-display font-black text-lg sm:text-2xl md:text-3xl lg:text-[32px] text-paper uppercase tracking-tight leading-tight">
                            {slide.title}
                          </h3>
                        )}
                      </div>

                      {/* Subtitle / Description */}
                      {slide.subtitle && (
                        <p className="font-body text-[10px] sm:text-xs md:text-sm text-paperLight opacity-85 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-md">
                          {slide.subtitle}
                        </p>
                      )}

                      {/* Tagline */}
                      {slide.tagline && (
                        <p className="font-display font-bold text-[10px] sm:text-xs md:text-sm text-paper pt-0.5">
                          {slide.tagline}
                        </p>
                      )}

                      {/* CTA Button anchored at bottom */}
                      {slide.link_url && (
                        <div className="pt-1.5 sm:pt-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(slide.link_url);
                            }}
                            className="inline-flex items-center space-x-1.5 bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 text-white font-mono text-[9px] sm:text-[10px] font-bold uppercase px-4 sm:px-5 py-2 sm:py-2.5 rounded-[6px] shadow-md hover:shadow-lg transition-all cursor-pointer"
                          >
                            <span>{slide.button_text || 'Know More'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-6 md:left-10 top-1/2 -translate-y-1/2 z-30 bg-paperLight/90 backdrop-blur-xs hover:bg-turmeric border border-cardboard w-10 h-10 sm:w-12 sm:h-12 rounded-full text-ink shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-ink" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-6 md:right-10 top-1/2 -translate-y-1/2 z-30 bg-paperLight/90 backdrop-blur-xs hover:bg-turmeric border border-cardboard w-10 h-10 sm:w-12 sm:h-12 rounded-full text-ink shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-ink" />
            </button>
          </>
        )}
      </div>

      {/* Slide Dot Indicators */}
      {activeBanners.length > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          {activeBanners.map((_: any, idx: number) => {
            const originalIndex = getOriginalIndex();
            const isDotActive = idx === originalIndex;
            return (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer p-0 ${
                  isDotActive
                    ? 'w-7 bg-turmeric border border-cardboard'
                    : 'w-2.5 bg-cardboard bg-opacity-35 hover:bg-opacity-65'
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
