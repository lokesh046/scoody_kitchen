import { isValidPhoneNumber } from 'libphonenumber-js';
import { COUNTRIES, DEFAULT_COUNTRY_ISO2 } from '../constants/countries';

export function getCountry(iso2: string) {
  return COUNTRIES.find((c) => c.iso2 === iso2) || COUNTRIES.find((c) => c.iso2 === DEFAULT_COUNTRY_ISO2)!;
}

// Combines a selected country with whatever the user typed into a single
// E.164 string ("+918825812858"). Strips anything that isn't a digit from
// the national-number part first, so a pasted or pre-filled value with
// spaces/dashes/a stray "+" doesn't end up duplicated into the result.
export function toE164(iso2: string, nationalNumber: string): string {
  const dialCode = getCountry(iso2).dialCode;
  const digits = nationalNumber.replace(/\D/g, '');
  return `+${dialCode}${digits}`;
}

// Real per-country validation (length, leading-digit rules, etc.) via
// libphonenumber-js's metadata, rather than a single hardcoded "10 digits"
// rule that only ever held for India.
export function isValidForCountry(iso2: string, nationalNumber: string): boolean {
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits) return false;
  try {
    return isValidPhoneNumber(toE164(iso2, digits));
  } catch {
    return false;
  }
}
