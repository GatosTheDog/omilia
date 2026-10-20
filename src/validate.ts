// 10 digits starting 2 or 69, or 14 digits starting 00302 or 003069.
const GREEK_PHONE = /^(?:2[0-9]{9}|69[0-9]{8}|00302[0-9]{9}|003069[0-9]{8})$/;

export function isValidGreekPhone(s: string): boolean {
  return GREEK_PHONE.test(s);
}
