import { describe, it, expect } from '@jest/globals';
import { computeVetAccess, computeFlagEntry } from '../vetAccess';

describe('computeVetAccess (the vet tab, page and switch rules)', () => {
  it('both sides on: tab shows with no tag, page open', () => {
    const a = computeVetAccess('on', 'on');
    expect(a).toMatchObject({ navVisible: true, navFallback: null, blocked: false });
  });

  it('booking coming soon but GPS on: tab shows with NO tag and the page opens (Consult is tagged on the switch)', () => {
    const a = computeVetAccess('coming_soon', 'on');
    expect(a).toMatchObject({ navVisible: true, navFallback: null, blocked: false, booking: 'coming_soon', gps: 'on' });
  });

  it('GPS coming soon, booking off with fallback hide: the tab still shows (tagged Coming soon) and the page shows only the status', () => {
    const a = computeVetAccess('hide', 'coming_soon');
    expect(a).toMatchObject({ navVisible: true, navFallback: 'coming_soon', blocked: true, blockedVariant: 'coming_soon' });
  });

  it('booking coming soon, GPS off: tab shows tagged Coming soon, page blocked as coming soon', () => {
    const a = computeVetAccess('coming_soon', 'hide');
    expect(a).toMatchObject({ navVisible: true, navFallback: 'coming_soon', blocked: true, blockedVariant: 'coming_soon' });
  });

  it('both unavailable: tab shows tagged Unavailable, page blocked as unavailable', () => {
    const a = computeVetAccess('unavailable', 'unavailable');
    expect(a).toMatchObject({ navVisible: true, navFallback: 'unavailable', blocked: true, blockedVariant: 'unavailable' });
  });

  it('one coming soon and one unavailable: coming soon wins', () => {
    expect(computeVetAccess('unavailable', 'coming_soon')).toMatchObject({ navFallback: 'coming_soon', blockedVariant: 'coming_soon' });
  });

  it('both set to hide: the tab is hidden, and a direct visit shows Unavailable', () => {
    const a = computeVetAccess('hide', 'hide');
    expect(a).toMatchObject({ navVisible: false, blocked: true, blockedVariant: 'unavailable' });
  });
});

describe('computeFlagEntry (a single flag, e.g. the Shop)', () => {
  it('on: visible, no tag, not blocked', () => {
    expect(computeFlagEntry('on')).toMatchObject({ visible: true, tag: null, blocked: false });
  });
  it('coming soon: visible with the coming-soon tag, page blocked as coming soon', () => {
    expect(computeFlagEntry('coming_soon')).toMatchObject({ visible: true, tag: 'coming_soon', blocked: true, variant: 'coming_soon' });
  });
  it('unavailable: visible with the unavailable tag, page blocked as unavailable', () => {
    expect(computeFlagEntry('unavailable')).toMatchObject({ visible: true, tag: 'unavailable', blocked: true, variant: 'unavailable' });
  });
  it('hide: not visible, a direct visit shows Unavailable', () => {
    expect(computeFlagEntry('hide')).toMatchObject({ visible: false, tag: null, blocked: true, variant: 'unavailable' });
  });
});
