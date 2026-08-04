import { describe, expect, it } from 'vitest';
import { alertMet } from './evaluate';

describe('alertMet', () => {
  it('triggers an above alert at or past the target', () => {
    expect(alertMet('above', 100, 100)).toBe(true);
    expect(alertMet('above', 100, 101)).toBe(true);
    expect(alertMet('above', 100, 99)).toBe(false);
  });

  it('triggers a below alert at or under the target', () => {
    expect(alertMet('below', 100, 100)).toBe(true);
    expect(alertMet('below', 100, 99)).toBe(true);
    expect(alertMet('below', 100, 101)).toBe(false);
  });
});
