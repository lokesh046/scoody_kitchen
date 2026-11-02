/**
 * A starting weight for the new-pet form, taken from the scan's adult size category,
 * e.g. "Large (20 - 30 kg)" -> 25, "Giant (40+ kg)" -> 40, "Toy (2 - 4 kg)" -> 3.
 * It is only an estimate of a typical adult, so the form tells the person to correct it.
 */
export function estimateWeightKg(sizeCategory?: string | null): number | undefined {
  if (!sizeCategory) return undefined;
  const range = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i.exec(sizeCategory);
  if (range) {
    const mid = (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    return Number.isFinite(mid) && mid > 0 ? Math.round(mid * 2) / 2 : undefined;
  }
  const atLeast = /(\d+(?:\.\d+)?)\s*\+/.exec(sizeCategory);
  if (atLeast) {
    const kg = parseFloat(atLeast[1]);
    return Number.isFinite(kg) && kg > 0 ? kg : undefined;
  }
  return undefined;
}
