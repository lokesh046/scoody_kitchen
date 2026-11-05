import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Flame, SlidersHorizontal } from 'lucide-react';

// The same staged "Getting started" animation as the Know Your Pet page: each step fades in, and its
// numbered circle fills in turn (one after another on desktop, as each step scrolls into view on phones).
const STEPS = [
  {
    title: 'Share their details',
    text: "Provide the information requested by the calculator to help estimate your pet's daily energy requirements.",
  },
  {
    title: 'Calculate their needs',
    text: 'Let the calculator use the details provided to estimate their daily energy requirements.',
  },
  {
    title: 'Understand the result',
    text: "Use the estimate as a starting point for feeding decisions, keeping your pet's individual needs and veterinary guidance in mind.",
  },
];

// Illustrative previews of the meal planner, not interactive forms or live account information.
// The sample figures follow the planner's own formula: 70 x 28^0.75 x 1.4 = about 1,196 kcal.
function StepPreview({ step }: { step: number }) {
  const row = 'flex items-center justify-between gap-2 rounded-sm border border-cardboard bg-paperLight px-3 py-2.5';

  return (
    <div aria-hidden="true" className="flex h-[210px] sm:h-[230px] items-center justify-center overflow-hidden rounded-[24px] border border-cardboard bg-cardboard/30 p-4 xl:p-5">
      {step === 0 && (
        <div className="w-full space-y-2">
          {[['Weight', '28 kg'], ['Activity', 'Active'], ['Sensitivities', 'None selected']].map(([label, value]) => (
            <div key={label} className={row}>
              <div className="min-w-0"><p className="text-[10px] text-ink/60">{label}</p><p className="font-display text-sm font-semibold text-ink">{value}</p></div>
              <Check className="h-4 w-4 shrink-0 text-paprika" />
            </div>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="flex w-full flex-col items-center gap-4">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[20px] border border-turmeric/60 bg-paper">
            <SlidersHorizontal className="h-10 w-10 text-turmeric" strokeWidth={1.4} />
          </div>
          <div className="w-full space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full w-2/3 rounded-full bg-turmeric" /></div>
            <div className="flex items-center justify-between rounded-sm bg-ink px-3 py-3 text-xs font-bold text-paper"><span>Calculate</span><Flame className="h-4 w-4" /></div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-3 pb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10"><Flame className="h-5 w-5 text-paprika" /></div>
            <div><p className="font-display font-semibold text-ink">Daily estimate</p><p className="text-[10px] text-ink/60">A starting point</p></div>
          </div>
          <div className={row}><span className="text-xs text-ink/80">Estimated energy</span><span className="font-mono text-sm font-bold text-ink">1,196 kcal</span></div>
          <div className={row}><span className="text-xs text-ink/80">Sample figures only</span><Check className="h-4 w-4 shrink-0 text-paprika" /></div>
        </div>
      )}
    </div>
  );
}

export function CalculatorGettingStarted() {
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <section aria-labelledby="calc-getting-started-heading" className="bg-paper px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-5xl text-center md:mb-16">
          <h2 id="calc-getting-started-heading" className="font-script text-3xl font-normal tracking-normal leading-snug text-ink sm:text-4xl xl:text-5xl lg:whitespace-nowrap">
            A clearer starting point, in a few simple steps.
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-body text-sm leading-relaxed text-ink/75">
            Enter the relevant details, calculate their estimated energy needs, and use the result as a guide when planning their meals.
          </p>
        </div>
        <motion.ol onViewportEnter={() => setHasEntered(true)} viewport={{ once: true, amount: 0.25 }} className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={reduceMotion || (hasEntered && activeStep >= index) ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: reduceMotion ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, amount: 0.35 }}
              onViewportEnter={() => {
                if (!isDesktop) {
                  setHasEntered(true);
                  setActiveStep((current) => Math.max(current, index));
                }
              }}
              className="relative min-w-0 pl-12 sm:pl-0"
            >
              {index < STEPS.length - 1 && <span aria-hidden="true" className="absolute bottom-[-32px] left-[18px] top-9 w-px bg-cardboard sm:hidden" />}
              <StepPreview step={index} />
              <div className="absolute left-0 top-0 sm:relative sm:my-6">
                {index < STEPS.length - 1 && <span aria-hidden="true" className="absolute left-0 top-1/2 hidden h-px w-[calc(100%+24px)] bg-ink/25 lg:block" />}
                <span
                  aria-current={activeStep === index ? 'step' : undefined}
                  className="relative isolate flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-ink/20 bg-white font-mono text-xs font-bold sm:h-10 sm:w-10"
                >
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 origin-bottom bg-black"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: reduceMotion || (hasEntered && activeStep >= index) ? 1 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 1, ease: 'linear' }}
                    onAnimationComplete={() => {
                      if (hasEntered && isDesktop && !reduceMotion && activeStep === index && index < STEPS.length - 1) {
                        setActiveStep(index + 1);
                      }
                    }}
                  />
                  <span className="relative text-white mix-blend-difference">{String(index + 1).padStart(2, '0')}</span>
                </span>
              </div>
              <h3 className="mb-3 mt-5 font-display text-xl font-bold leading-snug tracking-tight text-ink sm:mt-0">{step.title}</h3>
              <p className="font-body text-sm leading-relaxed text-ink/75">{step.text}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
