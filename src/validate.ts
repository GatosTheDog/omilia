// Pure function: no I/O, no imports. Input is the concatenated digit string, leading zeros kept.

// Fixed-count ASCII 0-9 classes give lengths 10 or 14; the four alternatives are mutually exclusive.
const GREEK_PHONE = /^(?:2[0-9]{9}|69[0-9]{8}|00302[0-9]{9}|003069[0-9]{8})$/;

// Stays a string: converting to a number would drop leading zeros.
export function isValidGreekPhone(s: string): boolean {
  return GREEK_PHONE.test(s);
}
