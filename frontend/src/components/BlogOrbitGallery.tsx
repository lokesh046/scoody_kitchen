import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { BlogPostListItem } from '../types/blog';

function useElementWidth<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const updateWidth = () => setWidth(element.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [elementRef, width] as const;
}

// A drag-to-rotate 3D carousel of real journal cover photos. Each card is a
// direct link to its post -- there's no lightbox, since the point here is
// getting people into an article, not admiring a photo in isolation.
export function BlogOrbitGallery({ posts }: { posts: BlogPostListItem[] }) {
  const navigate = useNavigate();
  const items = posts.filter((p) => p.cover_image_url).slice(0, 10);

  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const rotation = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion();

  const momentumRef = useRef<{ stop: () => void } | null>(null);
  const ignoreClickUntilRef = useRef(0);
  const pointerRef = useRef<{
    id: number;
    x: number;
    time: number;
    velocity: number;
    distance: number;
    captured: boolean;
  } | null>(null);

  const stopMomentum = useCallback(() => {
    momentumRef.current?.stop();
    momentumRef.current = null;
  }, []);

  const rotateTo = useCallback(
    (target: number) => {
      stopMomentum();
      if (prefersReducedMotion) {
        rotation.set(target);
        return;
      }
      momentumRef.current = animate(rotation, target, {
        type: 'spring',
        stiffness: 70,
        damping: 18,
        mass: 0.75,
      });
    },
    [prefersReducedMotion, rotation, stopMomentum]
  );

  useEffect(() => stopMomentum, [stopMomentum]);

  // Needs at least a few real cover photos to feel like an orbit rather
  // than two cards awkwardly facing each other.
  if (items.length < 3) return null;

  const faceWidth = Math.min(200, Math.max(110, containerWidth * (containerWidth < 640 ? 0.3 : 0.17)));
  const cardGap = containerWidth < 640 ? 10 : 18;
  const radius = (faceWidth + cardGap) / (2 * Math.sin(Math.PI / items.length));
  const angleStep = 360 / items.length;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    stopMomentum();
    // Pointer capture is deferred to the first real move (below), not set
    // here -- capturing immediately on pointerdown causes Chromium/WebKit
    // to redirect the click event away from whatever element the pointer
    // is actually over, so a plain tap on a card's button never fires its
    // onClick and the card becomes unopenable. Capturing only once the
    // drag has actually started keeps a tap's native click intact while
    // a real drag still gets move/up events outside the gallery bounds.
    pointerRef.current = { id: event.pointerId, x: event.clientX, time: performance.now(), velocity: 0, distance: 0, captured: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const now = performance.now();
    const deltaX = event.clientX - pointer.x;
    const deltaTime = Math.max(now - pointer.time, 8);

    pointer.velocity = (deltaX / deltaTime) * 1000;
    pointer.distance += Math.abs(deltaX);
    pointer.x = event.clientX;
    pointer.time = now;

    if (!pointer.captured && pointer.distance > 4) {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.captured = true;
    }

    rotation.set(rotation.get() + deltaX * 0.16);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    if (pointer.distance > 7) {
      ignoreClickUntilRef.current = performance.now() + 180;
    }

    const projectedRotation = rotation.get() + Math.max(-140, Math.min(140, pointer.velocity * 0.12));
    pointerRef.current = null;

    if (!prefersReducedMotion && Math.abs(pointer.velocity) > 30) {
      rotateTo(projectedRotation);
    }
  };

  const openPost = (slug: string) => {
    if (performance.now() < ignoreClickUntilRef.current) return;
    navigate(`/blog/${slug}`);
  };

  return (
    <section
      ref={containerRef}
      className="relative h-[420px] sm:h-[480px] md:h-[520px] w-full overflow-hidden rounded-[6px] border border-ink border-opacity-10"
      aria-label="Visual journal gallery"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 18%, rgba(208,158,107,0.28), transparent 34%), radial-gradient(circle at 12% 85%, rgba(143,168,155,0.16), transparent 32%), linear-gradient(180deg, #2E2015 0%, #1C140D 55%, #120D08 100%)',
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-5 sm:p-7">
        <div>
          <p className="font-mono text-sm sm:text-base uppercase tracking-[0.28em] text-turmeric">From The Journal</p>
          <h2 className="font-script font-normal text-2xl sm:text-3xl text-paper mt-1">A look inside.</h2>
        </div>
        <div className="hidden sm:block rounded-full border border-paper border-opacity-15 bg-ink bg-opacity-40 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-paper text-opacity-60">
          {items.length} entries
        </div>
      </div>

      <div
        className="absolute inset-0 cursor-grab select-none overflow-hidden active:cursor-grabbing"
        style={{
          perspective: `${Math.max(700, containerWidth * 1.1)}px`,
          perspectiveOrigin: '50% 56%',
          touchAction: 'pan-y',
        }}
        tabIndex={0}
        role="region"
        aria-label="Draggable journal photo carousel"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            rotateTo(rotation.get() - angleStep);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            rotateTo(rotation.get() + angleStep);
          }
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ rotateY: rotation, transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          {items.map((post, index) => (
            <button
              key={post.id}
              type="button"
              aria-label={`Read ${post.title}`}
              className="group absolute left-1/2 top-[58%] appearance-none border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-turmeric focus-visible:ring-offset-4 focus-visible:ring-offset-ink"
              style={{
                width: faceWidth,
                transform: `translate(-50%, -50%) rotateY(${index * angleStep}deg) translateZ(${radius}px)`,
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
              onClick={() => openPost(post.slug)}
            >
              <motion.div
                className="relative aspect-square overflow-hidden rounded-[10px] border border-paper border-opacity-15 bg-ink shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.045, y: -5 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              >
                <img
                  src={post.cover_image_url ?? ''}
                  alt={post.title}
                  draggable={false}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="truncate font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-paper text-opacity-90">
                    {post.title}
                  </p>
                </div>
              </motion.div>
            </button>
          ))}
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[14%] bg-gradient-to-r from-[#1C140D] via-[#1C140D]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[14%] bg-gradient-to-l from-[#1C140D] via-[#1C140D]/70 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
        <div className="rounded-full border border-paper border-opacity-15 bg-ink bg-opacity-40 px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper text-opacity-55">
          Drag to explore
        </div>
      </div>
    </section>
  );
}
