import { randomInt } from 'node:crypto';

// No 0/O/1/I so references survive being read out over the phone or typed on a keypad.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newReference(prefix: 'S' | 'I'): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${s}`;
}
