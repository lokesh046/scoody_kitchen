import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { TimelineStep } from '../../components/ScrollSpyTimeline';

export function PetHorizontalTimeline({ steps }: { steps: TimelineStep[] }) {
  const trackRef = useRef<HTMLOListElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();

  const selectStep = (index: number) => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    setActiveStep(index);
    if (track.scrollWidth > track.clientWidth) {
      track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: reduceMotion ? 'instant' : 'smooth' });
    }
  };

  return (
    <div aria-label="Explore your pet’s profile" className="min-w-0">
      <ol
        ref={trackRef}
        onScroll={() => {
          const track = trackRef.current;
          if (!track || track.scrollWidth <= track.clientWidth) return;
          if (track.scrollLeft <= 1) { setActiveStep(0); return; }
          if (track.scrollWidth - track.clientWidth - track.scrollLeft <= 1) { setActiveStep(steps.length - 1); return; }
          const center = track.getBoundingClientRect().left + track.clientWidth / 2;
          let closest = 0;
          let distance = Infinity;
          Array.from(track.children).forEach((child, index) => {
            const rect = child.getBoundingClientRect();
            const nextDistance = Math.abs(rect.left + rect.width / 2 - center);
            if (nextDistance < distance) { distance = nextDistance; closest = index; }
          });
          setActiveStep(closest);
        }}
        className="relative grid grid-flow-col auto-cols-[calc(100%-32px)] sm:auto-cols-[calc((100%-24px)/2)] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 gap-6 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {steps.map((step, index) => (
          <motion.li
            key={step.title}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="min-w-0 snap-center text-center"
          >
            <div className="h-[210px] sm:h-[230px] overflow-hidden rounded-[24px] border border-turmeric bg-paper">
              {step.image && <img src={step.image} alt={step.imageAlt ?? ''} width={1200} height={900} loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="relative my-6 flex justify-center">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-px w-[calc(100%+24px)] bg-paper/20">
                  <span className={`block h-full origin-left bg-turmeric transition-transform duration-200 motion-reduce:transition-none ${index < activeStep ? 'scale-x-100' : 'scale-x-0'}`} />
                </span>
              )}
              <button
                type="button"
                aria-label={`Step ${index + 1}: ${step.title}`}
                aria-current={activeStep === index ? 'step' : undefined}
                onClick={() => selectStep(index)}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full border bg-midnight font-mono text-xs font-bold cursor-pointer transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric focus-visible:ring-offset-4 focus-visible:ring-offset-midnight ${index <= activeStep ? 'border-turmeric text-turmeric' : 'border-paper/30 text-paper/75'}`}
              >
                {String(index + 1).padStart(2, '0')}
              </button>
            </div>
            <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-paper">{step.title}</h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-paper/90">{step.text}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
