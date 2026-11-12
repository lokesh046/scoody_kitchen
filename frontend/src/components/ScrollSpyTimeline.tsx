import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion, useScroll } from 'framer-motion';

export interface TimelineStep {
  icon: LucideIcon;
  // Optional custom artwork shown instead of `icon`. 'mono' artwork is drawn
  // in the marker's text colour (so it dims/glows with the step); 'color'
  // artwork keeps its own colours.
  iconSrc?: string;
  iconTone?: 'mono' | 'color';
  title: string;
  text: string;
  image?: string;
  imageAlt?: string;
}

// Placeholder for a real photo per step -- swap the src in once available,
// matching the same dashed "Add Image" convention used elsewhere on the
// site (Why Hearth & One, the homepage's Toolkit cards).
function StepImage({ image, alt, compact = false }: { image?: string; alt?: string; compact?: boolean }) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt ?? ''}
        width={1200}
        height={900}
        loading="lazy"
        className={`${compact ? 'mt-3 h-32 sm:h-40' : 'mt-5 aspect-[4/3]'} w-full rounded-[20px] border border-paper border-opacity-10 object-cover`}
      />
    );
  }
  return (
    <div className={`${compact ? 'mt-3 h-32 sm:h-40' : 'mt-5 aspect-[4/3]'} rounded-[20px] border border-paper border-opacity-10 bg-midnight flex flex-col items-center justify-center gap-2 text-paper text-opacity-30`}>
      <ImageIcon className="w-6 h-6" strokeWidth={1.2} />
      <span className="font-mono text-[9px] uppercase tracking-wider">Add Image</span>
    </div>
  );
}

function StepIcon({
  icon: Icon,
  iconSrc,
  iconTone = 'mono',
  active,
  size,
}: {
  icon: LucideIcon;
  iconSrc?: string;
  iconTone?: 'mono' | 'color';
  active: boolean;
  size: 'sm' | 'md';
}) {
  const box = size === 'md' ? 'w-8 h-8' : 'w-6 h-6';
  if (!iconSrc) return <Icon className={size === 'md' ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={1.6} />;
  if (iconTone === 'color') {
    return (
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        className={`${box} object-contain transition-opacity duration-200 motion-reduce:transition-none`}
        style={{ opacity: active ? 1 : 0.4 }}
      />
    );
  }
  const mask = `url(${iconSrc}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={`${box} block bg-current`}
      style={{ WebkitMask: mask, mask }}
    />
  );
}

// Compact timelines use natural scrolling with card reveals and a progress line.
// The full desktop variant retains its alternating cards and sticky markers.
export function ScrollSpyTimeline({ steps, compact = false }: { steps: TimelineStep[]; compact?: boolean }) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const mobileRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start center', 'end center'],
  });
  const reveal = {
    initial: compact && !reduceMotion ? { opacity: 0, y: 16 } : false as const,
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' as const },
  };
  const gold = compact ? '#D09E6B' : '#FFDD43';
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLDivElement).dataset.timelineStep);
          if (index !== -1) setActiveIndex(index);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    [...rowRefs.current, ...(compact ? mobileRowRefs.current : [])].forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [steps.length, compact]);

  return (
    <div ref={timelineRef} className="relative">
      {/* Desktop: dashed center line + alternating zigzag with a sticky marker */}
      <div className="hidden md:block relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 border-l border-dashed border-paper border-opacity-20" />
        {compact && (
          <motion.div
            aria-hidden="true"
            className="absolute left-1/2 inset-y-0 w-px origin-top bg-turmeric"
            style={{ scaleY: reduceMotion ? 1 : scrollYProgress }}
          />
        )}
        {steps.map(({ icon, iconSrc, iconTone, title, text, image, imageAlt }, index) => {
          const reversed = index % 2 === 1;
          const isActive = index === activeIndex;
          return (
            <div
              key={title}
              data-timeline-step={index}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              className={`relative grid grid-cols-[1fr_88px_1fr] gap-x-10 ${
                compact
                  ? (index === steps.length - 1 ? '' : 'pb-6')
                  : (index === steps.length - 1 ? 'min-h-[480px]' : 'min-h-[680px]')
              }`}
            >
              <div className={reversed ? '' : `flex justify-end items-start ${compact ? '' : 'pt-20'}`}>
                {!reversed && (
                  <motion.div {...reveal} className={`w-full max-w-md bg-ink border border-paper border-opacity-15 rounded-[28px] ${compact ? 'p-4' : 'p-6'} shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] text-right`}>
                    <h3 className="font-display font-bold text-lg text-paper">{title}</h3>
                    <p className="font-body text-sm text-paper opacity-90 leading-relaxed mt-2">{text}</p>
                    <StepImage image={image} alt={imageAlt} compact={compact} />
                  </motion.div>
                )}
              </div>
              <div className="flex justify-center">
                <div
                  className={`${compact ? 'relative transition-[color,border-color,box-shadow] duration-200 motion-reduce:transition-none' : 'sticky top-32 transition-all duration-500'} z-10 w-16 h-16 rounded-full flex items-center justify-center bg-ink`}
                  style={{
                    border: isActive ? `2px solid ${gold}` : '2px solid rgba(249,246,240,0.15)',
                    boxShadow: isActive ? (compact ? '0 0 16px -6px rgba(208,158,107,0.5)' : '0 0 0 1px rgba(255,221,67,0.25), 0 0 28px -4px rgba(255,221,67,0.7)') : 'none',
                    color: isActive ? gold : 'rgba(249,246,240,0.3)',
                  }}
                >
                  <StepIcon icon={icon} iconSrc={iconSrc} iconTone={iconTone} active={isActive} size="md" />
                </div>
              </div>
              <div className={reversed ? `flex justify-start items-start ${compact ? '' : 'pt-20'}` : ''}>
                {reversed && (
                  <motion.div {...reveal} className={`w-full max-w-md bg-ink border border-paper border-opacity-15 rounded-[28px] ${compact ? 'p-4' : 'p-6'} shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] text-left`}>
                    <h3 className="font-display font-bold text-lg text-paper">{title}</h3>
                    <p className="font-body text-sm text-paper opacity-90 leading-relaxed mt-2">{text}</p>
                    <StepImage image={image} alt={imageAlt} compact={compact} />
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: a compact vertical line connects the naturally scrolling steps. */}
      <div className={`relative md:hidden ${compact ? 'space-y-4' : 'space-y-8'}`}>
        {compact && (
          <>
            <div aria-hidden="true" className="absolute left-6 inset-y-0 border-l border-dashed border-paper/20" />
            <motion.div
              aria-hidden="true"
              className="absolute left-6 inset-y-0 w-px origin-top bg-turmeric"
              style={{ scaleY: reduceMotion ? 1 : scrollYProgress }}
            />
          </>
        )}
        {steps.map(({ icon, iconSrc, iconTone, title, text, image, imageAlt }, index) => (
          <div
            key={title}
            data-timeline-step={index}
            ref={(el) => { mobileRowRefs.current[index] = el; }}
            className="relative flex gap-4 items-start"
          >
            <div
              className="shrink-0 w-12 h-12 rounded-full bg-ink border-2 flex items-center justify-center transition-[color,border-color,box-shadow] duration-200 motion-reduce:transition-none"
              style={{
                borderColor: !compact || index === activeIndex ? gold : 'rgba(249,246,240,0.15)',
                color: !compact || index === activeIndex ? gold : 'rgba(249,246,240,0.3)',
                boxShadow: compact ? 'none' : '0 0 20px -4px rgba(255,221,67,0.6)',
              }}
            >
              <StepIcon icon={icon} iconSrc={iconSrc} iconTone={iconTone} active={!compact || index === activeIndex} size="sm" />
            </div>
            <motion.div {...reveal} className={`min-w-0 bg-ink border border-paper border-opacity-15 rounded-[24px] ${compact ? 'p-4' : 'p-5'} shadow-[0_20px_40px_-18px_rgba(0,0,0,0.7)] flex-1`}>
              <h3 className="font-display font-bold text-base text-paper">{title}</h3>
              <p className="font-body text-sm text-paper opacity-90 leading-relaxed mt-1.5">{text}</p>
              <StepImage image={image} alt={imageAlt} compact={compact} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
