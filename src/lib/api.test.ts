import { describe, expect, it } from 'vitest';
import { transcribeTimeout } from './api';

describe('time-out van de spraakherkenning', () => {
  it('is 30 s voor een korte opname', () => {
    expect(transcribeTimeout(40_000)).toBe(31_000);
  });

  it('groeit mee met een lange opname (3 minuten bij 32 kbit/s)', () => {
    expect(transcribeTimeout(720_000)).toBe(45_000);
  });
});
