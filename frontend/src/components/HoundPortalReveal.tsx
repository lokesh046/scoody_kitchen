import { useEffect, useRef, useState } from 'react';

// A one-shot editorial reveal on "Hearth & Hound": the ampersand opens into
// a portal, a sequence of real product/lifestyle photos cuts through it --
// then, instead of staying split, the "&" reforms and the full wordmark
// recombines as one line while a full-bleed photo fades in behind
// everything and stays there permanently. Plays once when scrolled into
// view, never loops.

const IMAGES = [
  'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg',
  'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg',
  'https://res.cloudinary.com/utnenyxi/image/upload/v1788521315/scooby_kitchen/nji85annhntaovsycm9q.jpg',
];
const HERO_IMAGE = IMAGES[0];

const PHRASE = 'Coming Soon';
const LOGO = '/images/brand/hearth-hound-gold.png';
const REST_WIDTH = 72; // width of the portal slot at rest, just enough to show "&"
const TOTAL_DURATION = 2900;

function easeInCubic(p: number) {
  return p * p * p;
}
function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function HoundPortalReveal() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const restWidthRef = useRef(REST_WIDTH);
  const portalRef = useRef<HTMLDivElement>(null);
  const ampRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const resize = () => {
      const width = Math.max(120, Math.min(440, node.clientWidth - 104));
      node.style.setProperty('--wordmark-width', `${width}px`);
      restWidthRef.current = width * 0.18;
      if (portalRef.current && rafRef.current === null) portalRef.current.style.width = `${restWidthRef.current}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion.current) {
      setImagesReady(true);
      if (bgRef.current) bgRef.current.style.opacity = '1';
      if (gradientRef.current) gradientRef.current.style.opacity = '1';
      if (phraseRef.current) phraseRef.current.style.opacity = '1';
      if (portalRef.current) portalRef.current.style.width = `${restWidthRef.current}px`;
      if (ampRef.current) ampRef.current.style.opacity = '1';
      return;
    }
    let loaded = 0;
    IMAGES.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        if (loaded === IMAGES.length) setImagesReady(true);
      };
      img.src = src;
    });
  }, []);

  useEffect(() => {
    if (!imagesReady || hasPlayed || prefersReducedMotion.current) return;
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [imagesReady, hasPlayed]);

  useEffect(() => {
    if (!hasPlayed) return;

    const setImage = (index: number | null) => {
      imageRefs.current.forEach((img, i) => {
        if (img) img.style.opacity = index === i ? '1' : '0';
      });
    };
    const setPortalWidth = (px: number) => {
      if (portalRef.current) portalRef.current.style.width = `${px}px`;
    };

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = now - startRef.current;
      const REST_WIDTH = restWidthRef.current;
      const MAX_PORTAL_WIDTH = REST_WIDTH + 70;

      // The "&" sits in the portal slot at rest, then fades as the portal
      // opens past it, then fades back in as the portal returns to rest.
      if (t < 400) {
        setPortalWidth(REST_WIDTH);
        if (ampRef.current) ampRef.current.style.opacity = '1';
      } else if (t < 1000) {
        const p = clamp01((t - 400) / 600);
        const eased = easeInCubic(p);
        setPortalWidth(REST_WIDTH + eased * (MAX_PORTAL_WIDTH - REST_WIDTH));
        if (ampRef.current) ampRef.current.style.opacity = String(1 - clamp01(p / 0.3));
        if (p < 0.4) setImage(0);
        else if (p < 0.8) setImage(1);
        else setImage(2);
      } else if (t < 1400) {
        setPortalWidth(MAX_PORTAL_WIDTH);
        setImage(2);
      } else if (t < 1900) {
        const p = clamp01((t - 1400) / 500);
        setPortalWidth(MAX_PORTAL_WIDTH - Math.pow(p, 3) * (MAX_PORTAL_WIDTH - REST_WIDTH));
        setImage(2);
        if (ampRef.current) ampRef.current.style.opacity = String(clamp01((p - 0.6) / 0.4));
      } else {
        setPortalWidth(REST_WIDTH);
        setImage(null);
        if (ampRef.current) ampRef.current.style.opacity = '1';
      }

      // Independently, from 1400ms, the full photo fades in behind
      // everything and stays -- overlaps with the ampersand reforming.
      if (t >= 1400) {
        const p = clamp01((t - 1400) / 900);
        const eased = easeOutCubic(p);
        if (bgRef.current) bgRef.current.style.opacity = String(eased);
        if (gradientRef.current) gradientRef.current.style.opacity = String(eased);
      }

      if (t >= 2300) {
        const p = clamp01((t - 2300) / 500);
        if (phraseRef.current) phraseRef.current.style.opacity = String(p);
      }

      if (t < TOTAL_DURATION) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null; // permanent end state, no restart
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasPlayed]);

  return (
    <div
      ref={sectionRef}
      className="relative h-[360px] sm:h-[440px] rounded-[4px] overflow-hidden border border-paper border-opacity-10 bg-obsidian flex items-center justify-center px-4"
    >
      <img
        ref={bgRef}
        src={HERO_IMAGE}
        alt="Hearth and Hound premium dog food"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0, filter: 'saturate(0.9)' }}
        loading="eager"
        decoding="async"
      />
      <div
        ref={gradientRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background: 'linear-gradient(180deg, rgba(14,11,8,0.3) 0%, rgba(14,11,8,0.45) 45%, rgba(14,11,8,0.8) 100%)',
        }}
      />

      <div role="img" aria-label="Hearth & Hound" className="relative z-10 flex items-center justify-center select-none">
        <span aria-hidden="true" className="block shrink-0" style={{ width: 'calc(var(--wordmark-width) * 0.41)', height: 'calc(var(--wordmark-width) * 0.26425)', backgroundImage: `url(${LOGO})`, backgroundSize: '243.902439% 100%', backgroundPosition: 'left center', backgroundRepeat: 'no-repeat' }} />

        <div
          ref={portalRef}
          className="relative shrink-0 will-change-[width]"
          style={{ width: REST_WIDTH, height: 1 }}
        >
          <span
            ref={ampRef}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ opacity: 1, width: 'calc(var(--wordmark-width) * 0.18)', height: 'calc(var(--wordmark-width) * 0.26425)', backgroundImage: `url(${LOGO})`, backgroundSize: '555.555556% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          />
          {IMAGES.map((src, i) => (
            <img
              key={src}
              ref={(el) => { imageRefs.current[i] = el; }}
              src={src}
              alt={i === 0 ? 'Hearth and Hound' : ''}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-24 sm:h-32 object-cover"
              style={{ opacity: 0 }}
              loading="eager"
              decoding="async"
            />
          ))}
        </div>

        <span aria-hidden="true" className="block shrink-0" style={{ width: 'calc(var(--wordmark-width) * 0.41)', height: 'calc(var(--wordmark-width) * 0.26425)', backgroundImage: `url(${LOGO})`, backgroundSize: '243.902439% 100%', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat' }} />
      </div>

      <div
        ref={phraseRef}
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{ opacity: 0, top: '70%' }}
      >
        <span className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] text-turmeric whitespace-nowrap">
          {PHRASE}
        </span>
      </div>
    </div>
  );
}
