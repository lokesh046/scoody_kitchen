import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, type LucideIcon } from 'lucide-react';

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
function StepImage({ image, alt }: { image?: string; alt?: string }) {
  if (image) {
    return (
      <img
        src={image}
        alt={alt ?? ''}
        width={1200}
        height={900}
        loading="lazy"
        className="mt-5 aspect-[4/3] w-full rounded-[20px] border border-paper border-opacity-10 object-cover"
      />
    );
  }
  return (
    <div className="mt-5 aspect-[4/3] rounded-[20px] border border-paper border-opacity-10 bg-midnight flex flex-col items-center justify-center gap-2 text-paper text-opacity-30">
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
        className={`${box} object-contain transition-opacity duration-500`}
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

// A scroll-driven vertical timeline: a dashed center line, alternating
// left/right cards, and a sticky icon marker per step that pins near the
// top of the viewport while its card is in view, lighting up gold when
// its step is the active one, then handing off to the next marker.
// Desktop only gets the zigzag + sticky treatment; mobile falls back to a
// simple top-to-bottom list since there's no room to alternate sides.
export function ScrollSpyTimeline({ steps }: { steps: TimelineStep[] }) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = rowRefs.current.findIndex((el) => el === entry.target);
          if (index !== -1) setActiveIndex(index);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    rowRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [steps.length]);

  return (
    <div className="relative">
      {/* Desktop: dashed center line + alternating zigzag with a sticky marker */}
      <div className="hidden md:block relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 border-l border-dashed border-paper border-opacity-20" />
        {steps.map(({ icon, iconSrc, iconTone, title, text, image, imageAlt }, index) => {
          const reversed = index % 2 === 1;
          const isActive = index === activeIndex;
          return (
            <div
              key={title}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              className={`relative grid grid-cols-[1fr_88px_1fr] gap-x-10 min-h-[680px] ${
                index === steps.length - 1 ? 'min-h-[480px]' : ''
              }`}
            >
              <div className={reversed ? '' : 'flex justify-end items-start pt-20'}>
                {!reversed && (
                  <div className="w-full max-w-md bg-ink border border-paper border-opacity-15 rounded-[28px] p-6 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] text-right">
                    <h3 className="font-display font-bold text-lg text-paper">{title}</h3>
                    <p className="font-body text-sm text-paper opacity-70 leading-relaxed mt-2">{text}</p>
                    <StepImage image={image} alt={imageAlt} />
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <div
                  className="sticky top-32 z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 bg-ink"
                  style={{
                    border: isActive ? '2px solid #FFDD43' : '2px solid rgba(249,246,240,0.15)',
                    boxShadow: isActive ? '0 0 0 1px rgba(255,221,67,0.25), 0 0 28px -4px rgba(255,221,67,0.7)' : 'none',
                    color: isActive ? '#FFDD43' : 'rgba(249,246,240,0.3)',
                  }}
                >
                  <StepIcon icon={icon} iconSrc={iconSrc} iconTone={iconTone} active={isActive} size="md" />
                </div>
              </div>
              <div className={reversed ? 'flex justify-start items-start pt-20' : ''}>
                {reversed && (
                  <div className="w-full max-w-md bg-ink border border-paper border-opacity-15 rounded-[28px] p-6 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] text-left">
                    <h3 className="font-display font-bold text-lg text-paper">{title}</h3>
                    <p className="font-body text-sm text-paper opacity-70 leading-relaxed mt-2">{text}</p>
                    <StepImage image={image} alt={imageAlt} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: simple top-to-bottom list, no zigzag, no scroll-spy */}
      <div className="md:hidden space-y-8">
        {steps.map(({ icon, iconSrc, iconTone, title, text, image, imageAlt }) => (
          <div key={title} className="flex gap-4 items-start">
            <div
              className="shrink-0 w-12 h-12 rounded-full bg-ink border-2 flex items-center justify-center"
              style={{ borderColor: '#FFDD43', color: '#FFDD43', boxShadow: '0 0 20px -4px rgba(255,221,67,0.6)' }}
            >
              <StepIcon icon={icon} iconSrc={iconSrc} iconTone={iconTone} active size="sm" />
            </div>
            <div className="bg-ink border border-paper border-opacity-15 rounded-[24px] p-5 shadow-[0_20px_40px_-18px_rgba(0,0,0,0.7)] flex-1">
              <h3 className="font-display font-bold text-base text-paper">{title}</h3>
              <p className="font-body text-sm text-paper opacity-70 leading-relaxed mt-1.5">{text}</p>
              <StepImage image={image} alt={imageAlt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
