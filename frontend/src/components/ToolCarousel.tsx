import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react';

export interface ToolCarouselItem {
  label: string;
  text: string;
  path: string;
  image?: string;
  /** Overrides the default "Explore {label}" link text. */
  cta?: string;
}

function ToolCard({ item, active = true }: { item: ToolCarouselItem; active?: boolean }) {
  return (
    <Link
      to={item.path}
      tabIndex={active ? 0 : -1}
      draggable={false}
      aria-label={`Explore ${item.label}`}
      data-active={active ? 'true' : undefined}
      className="pet-tool-card relative isolate overflow-hidden flex h-full min-h-[330px] rounded-[28px] flex-col items-center border border-paper/15 bg-[#24201B] p-6 text-center text-paper cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-turmeric"
    >
      <div
        className={`mb-4 flex shrink-0 items-center justify-center ${item.image ? 'h-24 w-24' : 'h-20 w-20 rounded-[20px] border border-dashed border-turmeric/35 bg-midnight/40'}`}
        aria-hidden="true"
      >
        {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" draggable={false} /> : <ImageIcon className="h-7 w-7 text-turmeric/60" strokeWidth={1.2} />}
      </div>
      <h3 className="font-display text-xl font-bold">{item.label}</h3>
      <p className="mb-5 mt-3 font-body text-sm leading-relaxed text-paper/75">{item.text}</p>
      <span className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 font-body text-sm font-semibold text-turmeric underline decoration-turmeric/40 underline-offset-4">
        {item.cta ?? `Explore ${item.label}`}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
      </span>
    </Link>
  );
}

// Billboard-style orbit: cards stay facing the reader, unlike a rotating cylinder.
// Motion values update geometry without rendering React on each animation frame.
function OrbitCard({ item, index, count, rotation, radius, width, active }: {
  item: ToolCarouselItem; index: number; count: number; rotation: MotionValue<number>;
  radius: number; width: number; active: boolean;
}) {
  const angle = (value: number) => (index * 360 / count + value) * Math.PI / 180;
  const x = useTransform(rotation, value => Math.sin(angle(value)) * radius);
  const y = useTransform(rotation, value => -32 * (1 - Math.cos(angle(value))));
  const scale = useTransform(rotation, value => 0.83 + 0.17 * Math.cos(angle(value)));
  const opacity = useTransform(rotation, value => 0.62 + 0.38 * Math.cos(angle(value)));
  const zIndex = useTransform(rotation, value => Math.round(20 + 10 * Math.cos(angle(value))));

  return (
    <motion.div
      role="group" aria-roledescription="slide" aria-label={`${item.label}, ${index + 1} of ${count}`}
      aria-hidden={!active}
      className="absolute left-1/2 top-20 h-[350px]"
      style={{ x, y, scale, opacity, zIndex, width, marginLeft: -width / 2, pointerEvents: active ? 'auto' : 'none' }}
    >
      <ToolCard item={item} active={active} />
    </motion.div>
  );
}

function Orbit({ items }: { items: ToolCarouselItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const rotation = useMotionValue(0);
  const activeRef = useRef(0);
  const [settling, setSettling] = useState(false);
  const driftRef = useRef<ReturnType<typeof animate> | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const count = items.length;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => () => animationRef.current?.stop(), []);

  useEffect(() => rotation.on('change', value => {
    const nearest = ((Math.round(-value / (360 / count)) % count) + count) % count;
    if (nearest !== activeRef.current) {
      activeRef.current = nearest;
      setActive(nearest);
    }
  }), [count, rotation]);

  const move = useCallback((delta: number) => {
    driftRef.current?.stop();
    animationRef.current?.stop();
    setSettling(true);
    const targetStep = Math.round(-rotation.get() / (360 / count)) + delta;
    animationRef.current = animate(rotation, -targetStep * 360 / count, {
      duration: 0.65, ease: [0.22, 1, 0.36, 1],
      onComplete: () => setSettling(false),
    });
  }, [count, rotation]);

  useEffect(() => {
    if (!inView || !visible || hovered || focused || dragging || settling) return;
    // One uninterrupted revolution; restarting resumes from the current angle.
    const start = rotation.get();
    const drift = animate(rotation, [start, start - 360], {
      duration: 18, ease: 'linear', repeat: Infinity, repeatType: 'loop',
    });
    driftRef.current = drift;
    return () => drift.stop();
  }, [inView, visible, hovered, focused, dragging, settling, rotation]);

  const select = (index: number) => {
    const delta = ((index - active + count + count / 2) % count) - count / 2;
    move(Math.round(delta));
  };
  const cardWidth = Math.min(300, Math.max(220, width * 0.78));
  const radius = width < 640 ? cardWidth * 0.74 : Math.min(330, width * 0.28);
  const controlClass = 'flex h-11 w-11 items-center justify-center border border-paper/25 text-paper transition-colors hover:border-turmeric hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turmeric';

  return (
    <div ref={rootRef} className="relative isolate" role="region" aria-roledescription="carousel" aria-label="Pet-care tools"
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); select(event.key === 'Home' ? 0 : count - 1);
        }
      }}
    >
      <div className="relative h-[450px] touch-pan-y overflow-hidden" style={{ visibility: width ? 'visible' : 'hidden' }}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setDragging(true);
        }}
        onPointerMove={event => {
          const start = pointerRef.current;
          if (!start || start.id !== event.pointerId) return;
          if (Math.abs(event.clientX - start.x) > 12 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)) {
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerUp={event => {
          const start = pointerRef.current;
          pointerRef.current = null; setDragging(false);
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
            move(dx < 0 ? 1 : -1);
          }
        }}
        onPointerLeave={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            pointerRef.current = null; setDragging(false);
          }
        }}
        onPointerCancel={() => { pointerRef.current = null; setDragging(false); }}
        onLostPointerCapture={() => { pointerRef.current = null; setDragging(false); }}
        onClickCapture={event => {
          if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        }}
      >
        {items.map((item, index) => <OrbitCard key={item.path} item={item} index={index} count={count} rotation={rotation} radius={radius} width={cardWidth} active={index === active} />)}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <button type="button" aria-label="Previous tool" className={controlClass} onClick={() => { move(-1); }}><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button>
        <div className="flex items-center" aria-label="Choose a tool">
          {items.map((item, index) => <button key={item.path} type="button" aria-label={`Show ${item.label}`} aria-current={index === active ? 'true' : undefined} onClick={() => select(index)} className="flex h-11 w-9 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"><span className={`h-2 w-2 rounded-full ${index === active ? 'bg-turmeric' : 'bg-paper/30'}`} /></button>)}
        </div>
        <button type="button" aria-label="Next tool" className={controlClass} onClick={() => { move(1); }}><ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
      </div>
      <p className="mt-4 text-center font-mono text-xs text-paper/65" aria-live={focused ? 'polite' : 'off'} aria-atomic="true">{active + 1} / {count} · {items[active].label}</p>
    </div>
  );
}

export function ToolCarousel({ items }: { items: ToolCarouselItem[] }) {
  const reducedMotion = useReducedMotion();
  if (!items.length) return null;
  if (reducedMotion || items.length < 3) {
    // Match the column count to how many tools are actually enabled, so two
    // cards sit centred as a pair instead of hugging the left of a 4-up grid.
    const grid = {
      1: 'max-w-sm',
      2: 'max-w-3xl sm:grid-cols-2',
      3: 'max-w-5xl sm:grid-cols-2 lg:grid-cols-3',
      4: 'sm:grid-cols-2 lg:grid-cols-4',
    }[Math.min(items.length, 4) as 1 | 2 | 3 | 4];
    return <div className={`mx-auto grid grid-cols-1 gap-5 ${grid}`}>{items.map(item => <ToolCard key={item.path} item={item} />)}</div>;
  }
  // Remount when feature flags change so the active index and rotation stay valid.
  return <Orbit key={items.map(item => item.path).join('|')} items={items} />;
}
