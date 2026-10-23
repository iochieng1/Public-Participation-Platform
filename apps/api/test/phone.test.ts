import { describe, expect, it } from 'vitest';
import { normalizeKenyanPhone } from '../src/phone.js';

describe('normalizeKenyanPhone', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['0712 345 678', '+254712345678'],
    ['+254712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['0110-123-456', '+254110123456'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(['0212345678', '+255712345678', '07123456', 'hello', ''])('rejects %s', (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
  });
});
