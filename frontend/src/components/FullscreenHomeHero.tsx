import { HeroScrollHint } from './HeroScrollHint';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchActiveBanners } from '../api/banners';
import { HERO_TITLE_IMAGES, heroTitleKey } from '../constants/heroTitleImages';

// Same real banner images used by the normal contained carousel, so the
// full-screen hero shows genuine content rather than placeholder art even
// before any banners are configured in the admin panel.
const fallbackBanners = [
  {
    id: -1,
    title: 'THE HEARTH & ONE FAM',
    subtitle:
      "Come be a part of our family's quest for delighted and thriving pets! We craft unique pet meals infused with care and premium ingredients.",
    image_url: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg',
    link_url: '/shop',
  },
  {
    id: -2,
    title: 'Honest Ingredients. Zero Filler.',
    subtitle:
      'Every single recipe batch contains zero corn, wheat, soy, or rendering byproducts. Certified and tested by pet nutrition specialists.',
    image_url: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg',
    link_url: '/shop',
  },
  {
    id: -3,
    title: 'Farm-To-Bowl Holistic Meals',
    subtitle: 'Real whole-food chicken and farm-fresh sweet potatoes slow-cooked daily to nurture vitality and active health.',
    image_url: 'https://res.cloudinary.com/utnenyxi/image/upload/v1788521315/scooby_kitchen/nji85annhntaovsycm9q.jpg',
    link_url: '/shop',
  },
];

export const FullscreenHomeHero: React.FC = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: banners, isLoading } = useQuery({
    queryKey: ['active-banners'],
    queryFn: () => fetchActiveBanners(),
  });

  // While the real banners load, show an empty dark hero of the same size rather
  // than the built-in banners, which would flash and then be swapped out.
  const slides = isLoading ? [] : banners && banners.length > 0 ? banners : fallbackBanners;
  const slide = slides[index % Math.max(slides.length, 1)];
  const titleImage = slide?.title ? HERO_TITLE_IMAGES[heroTitleKey(slide.title)] : undefined;

  useEffect(() => {
    if (slides.length <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, isHovered]);

  if (!slide) {
    return <section className="relative w-full min-h-[100svh] overflow-hidden bg-ink" aria-hidden="true" />;
  }

  return (
    <section
      data-scroll-hero
      className="relative w-full min-h-[100svh] overflow-hidden bg-ink"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background image, cross-fading between slides */}
      {slides.map((s, i) => (
        <img
          key={s.id}
          src={s.image_url}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index % slides.length ? 'opacity-100' : 'opacity-0'
          }`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {/* Legibility gradient for both the header and the hero copy */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

      {/* Hero copy, anchored bottom-left */}
      <div className="relative z-10 flex flex-col justify-end min-h-[100svh] px-4 sm:px-8 md:px-12 pb-28 sm:pb-28 max-w-5xl">
        <div className="max-w-2xl space-y-4 text-left animate-fade-in-up">
          {slide.title && (
            <h1 className="font-hero font-normal text-5xl sm:text-6xl md:text-7xl text-paper normal-case tracking-normal leading-[1.1] [text-shadow:0_2px_6px_rgba(0,0,0,0.85),0_4px_28px_rgba(0,0,0,0.8)]">
              {/* Known banner titles are drawn as pictures in the brand display font, so the font file itself is never
                  served; any new or edited title falls back to the script text. */}
              {titleImage ? (
                <picture>
                  <source media="(min-width: 640px)" srcSet={`/images/hero-titles/${titleImage.slug}-wide.webp`} width={titleImage.wide[0]} height={titleImage.wide[1]} />
                  <img
                    src={`/images/hero-titles/${titleImage.slug}-narrow.webp`}
                    alt={slide.title ?? ''}
                    width={titleImage.narrow[0]}
                    height={titleImage.narrow[1]}
                    className="block h-auto w-[min(100%,338px)] sm:w-[min(100%,608px)] [filter:drop-shadow(0_2px_14px_rgba(0,0,0,0.85))]"
                  />
                </picture>
              ) : (
                slide.title
              )}
            </h1>
          )}
          {slide.subtitle && (
            <p className="font-body text-sm sm:text-base text-paperLight opacity-90 leading-relaxed max-w-xl">
              {slide.subtitle}
            </p>
          )}
          {slide.link_url && (
            <div className="pt-2">
              <button
                onClick={() => navigate(slide.link_url!)}
                className="pet-profile-cta cta-glow relative isolate overflow-hidden bg-turmeric text-ink font-body font-bold text-xs uppercase px-8 py-4 tracking-wider rounded-[4px] border border-[#E5BB8E] hover:-translate-y-0.5 active:translate-y-[1px] transition-transform duration-300 cursor-pointer motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="relative">Explore Shop Recipes</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nav arrows + dots, only when there's more than one slide */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
            className="absolute left-3 sm:left-6 top-[30%] -translate-y-1/2 z-10 bg-paperLight/15 backdrop-blur-sm hover:bg-paperLight/30 border border-paper/30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-paper flex items-center justify-center transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
            aria-label="Next slide"
            className="absolute right-3 sm:right-6 top-[30%] -translate-y-1/2 z-10 bg-paperLight/15 backdrop-blur-sm hover:bg-paperLight/30 border border-paper/30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-paper flex items-center justify-center transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="absolute bottom-6 right-4 sm:right-8 z-10 flex items-center space-x-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === index % slides.length ? 'w-6 bg-turmeric' : 'w-2 bg-paper/40 hover:bg-paper/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
      <HeroScrollHint />
    </section>
  );
};
