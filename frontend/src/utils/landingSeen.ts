// Remembers, on this device, that a visitor has already opened a feature's landing page.
// The home-page feature cards use it: the first time, a card takes the visitor to the landing page that
// explains the feature; after that, the card's main button goes straight to the feature itself.
const PREFIX = 'hno_seen_landing_';

export type LandingKey = 'pets' | 'vet' | 'calculator' | 'shop';

export function markLandingSeen(key: LandingKey): void {
  try {
    window.localStorage.setItem(PREFIX + key, '1');
  } catch {
    /* storage blocked (private window): the card simply keeps opening the landing page */
  }
}

export function hasSeenLanding(key: LandingKey): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return false;
  }
}
