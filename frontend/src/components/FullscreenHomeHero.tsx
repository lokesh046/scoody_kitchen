import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchActiveBanners } from '../api/banners';

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

  const { data: banners } = useQuery({
    queryKey: ['active-banners'],
    queryFn: fetchActiveBanners,
  });

  const slides = banners && banners.length > 0 ? banners : fallbackBanners;
  const slide = slides[index % slides.length];

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

  return (
    <section
      className="relative w-full min-h-[100dvh] overflow-hidden bg-ink"
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
      <div className="relative z-10 flex flex-col justify-end min-h-[100dvh] px-4 sm:px-8 md:px-12 pb-16 sm:pb-20 max-w-5xl">
        <div className="max-w-2xl space-y-4 text-left animate-fade-in-up">
          {slide.title && (
            <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-paper uppercase tracking-tight leading-[1.05] drop-shadow-md">
              {slide.title}
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
                className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-8 py-4 tracking-wider transition-all shadow-sm active:translate-y-[1px] hover-bounce cursor-pointer"
              >
                Explore Shop Recipes
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
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 bg-paperLight/15 backdrop-blur-sm hover:bg-paperLight/30 border border-paper/30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-paper flex items-center justify-center transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
            aria-label="Next slide"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 bg-paperLight/15 backdrop-blur-sm hover:bg-paperLight/30 border border-paper/30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-paper flex items-center justify-center transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center space-x-2">
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
    </section>
  );
};
