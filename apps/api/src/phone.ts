/**
 * Normalises Kenyan mobile numbers to E.164 (+2547XXXXXXXX / +2541XXXXXXXX).
 * Accepts 07.., 01.., 7.., 1.., 2547.., +2547.. with spaces or dashes.
 * Returns null for anything that is not a Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '');
  const m = /^(?:254|0)?([17]\d{8})$/.exec(digits);
  return m ? `+254${m[1]}` : null;
}
