import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from '../theme/typography';
import { useTourStore } from '../store/tourStore';

export interface TourStep {
  /** Omit for a centered, non-spotlight step (e.g. the opening/closing card). */
  targetRef?: React.RefObject<View | null>;
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
}

interface AppTourProps {
  steps: TourStep[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 10;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCRIM_COLOR = 'rgba(54, 40, 32, 0.86)'; // Dark Roasted Coffee scrim, not generic black

// First-run coach-mark tour: dims the real Home screen and cuts a rectangular
// "window" over one real element per step (measured live via ref), rather
// than a separate tutorial mode disconnected from the actual product.
export default function AppTour({ steps }: AppTourProps) {
  const isTourActive = useTourStore((s) => s.isTourActive);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const nextStep = useTourStore((s) => s.nextStep);
  const endTour = useTourStore((s) => s.endTour);

  const [rect, setRect] = useState<Rect | null>(null);
  const [isReady, setIsReady] = useState(false);

  const step = steps[stepIndex];

  useEffect(() => {
    if (!isTourActive || !step) return;
    setIsReady(false);
    setRect(null);

    if (!step.targetRef?.current) {
      // Centered step — nothing to measure.
      setIsReady(true);
      return;
    }

    // A short delay lets the underlying screen finish its own layout pass
    // (e.g. right after data loads) before we measure — measuring too early
    // can catch a pre-layout position of 0,0.
    const t = setTimeout(() => {
      step.targetRef?.current?.measureInWindow((x, y, width, height) => {
        setRect({ x, y, width, height });
        setIsReady(true);
      });
    }, 80);
    return () => clearTimeout(t);
  }, [isTourActive, stepIndex, step]);

  const handleAdvance = useCallback(() => {
    nextStep(steps.length);
  }, [nextStep, steps.length]);

  if (!isTourActive || !step || !isReady) return null;

  const Icon = step.icon;
  const isLastStep = stepIndex === steps.length - 1;
  const ctaLabel = step.ctaLabel || (isLastStep ? 'Start Exploring' : 'Next');

  // No Modal wrapper: a transparent RN Modal renders in its own native
  // window, which would block every touch from reaching the real screen
  // beneath it — the opposite of what a "tap the real button" spotlight
  // needs. Rendered as a plain overlay instead, so the untouched hole area
  // passes taps straight through to the real UI. That means HomeScreen must
  // render <AppTour> as a sibling of its SafeAreaView, not a child of it —
  // these coordinates come from measureInWindow (true full-window
  // coordinates), and nesting inside a top-inset SafeAreaView would offset
  // this overlay from the window by that inset.
  const content = !rect ? (
    // No target — full-screen scrim with a centered card.
    <View style={styles.fullScrim} pointerEvents="auto">
      <View style={styles.centeredCard}>
        <TourCardContent
          Icon={Icon}
          title={step.title}
          description={step.description}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          ctaLabel={ctaLabel}
          onAdvance={handleAdvance}
          onSkip={endTour}
          showSkip={!isLastStep}
        />
      </View>
    </View>
  ) : (
    (() => {
      const holeTop = rect.y - SPOTLIGHT_PADDING;
      const holeBottom = rect.y + rect.height + SPOTLIGHT_PADDING;
      const holeLeft = rect.x - SPOTLIGHT_PADDING;
      const holeWidth = rect.width + SPOTLIGHT_PADDING * 2;
      // Place the callout on whichever side of the hole has more room.
      const placeBelow = rect.y < SCREEN_HEIGHT / 2;

      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Four dark strips frame a rectangular window around the target,
              avoiding any SVG/masking dependency for a plain-rect spotlight. */}
          <View style={[styles.scrimStrip, { top: 0, left: 0, right: 0, height: Math.max(holeTop, 0) }]} pointerEvents="auto" />
          <View style={[styles.scrimStrip, { top: holeBottom, left: 0, right: 0, bottom: 0 }]} pointerEvents="auto" />
          <View style={[styles.scrimStrip, { top: holeTop, height: holeBottom - holeTop, left: 0, width: Math.max(holeLeft, 0) }]} pointerEvents="auto" />
          <View style={[styles.scrimStrip, { top: holeTop, height: holeBottom - holeTop, left: holeLeft + holeWidth, right: 0 }]} pointerEvents="auto" />

          {/* Gold outline around the spotlighted element. */}
          <View
            pointerEvents="none"
            style={[
              styles.spotlightOutline,
              { top: holeTop, left: holeLeft, width: holeWidth, height: holeBottom - holeTop },
            ]}
          />

          {/* Deliberately nothing covers the hole itself — the real control
              underneath stays genuinely tappable, so a step spotlighting a
              real button (e.g. "Find a Vet") lets the user actually use it
              rather than only look at it. The screen that owns the target
              is responsible for ending the tour when it loses focus (see
              HomeScreen's useIsFocused effect), so a real interaction that
              navigates away doesn't leave the tour dangling in the background. */}

          <View
            style={[
              styles.calloutWrap,
              placeBelow ? { top: holeBottom + 16 } : { bottom: SCREEN_HEIGHT - holeTop + 16 },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.calloutCard}>
              <TourCardContent
                Icon={Icon}
                title={step.title}
                description={step.description}
                stepIndex={stepIndex}
                totalSteps={steps.length}
                ctaLabel={ctaLabel}
                onAdvance={handleAdvance}
                onSkip={endTour}
                showSkip={!isLastStep}
              />
            </View>
          </View>
        </View>
      );
    })()
  );

  return content;
}

function TourCardContent({
  Icon,
  title,
  description,
  stepIndex,
  totalSteps,
  ctaLabel,
  onAdvance,
  onSkip,
  showSkip,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  ctaLabel: string;
  onAdvance: () => void;
  onSkip: () => void;
  showSkip: boolean;
}) {
  return (
    <>
      <View style={styles.cardTopRow}>
        <View style={styles.iconCircle}>
          <Icon size={20} color={COLORS.brandGold} />
        </View>
        {showSkip && (
          <TouchableOpacity
            onPress={onSkip}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Skip tour"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>

      <View style={styles.cardBottomRow}>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={onAdvance}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fullScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SCRIM_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrimStrip: {
    position: 'absolute',
    backgroundColor: SCRIM_COLOR,
  },
  spotlightOutline: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.brandGold,
    borderRadius: 14,
  },
  calloutWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  centeredCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  calloutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 12.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    marginTop: 12,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.kraftBorder,
  },
  dotActive: {
    backgroundColor: COLORS.brandGold,
    width: 16,
  },
  ctaBtn: {
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  ctaBtnText: {
    fontSize: 12.5,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },
});
