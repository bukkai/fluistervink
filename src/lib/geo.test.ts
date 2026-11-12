import { describe, expect, it } from 'vitest';
import { distanceMeters } from './geo';

describe('distanceMeters', () => {
  const at = (lat: number, lon: number) => ({ lat, lon, accuracy: 10, fixedAt: 0 });

  it('meet afstanden in meters', () => {
    // 0,01° noorderbreedte is ruim 1,1 km
    expect(distanceMeters(at(52.0557, 5.4), at(52.0657, 5.4))).toBeCloseTo(1112, -1);
  });

  it('is nul voor dezelfde plek', () => {
    expect(distanceMeters(at(52.0557, 5.4), at(52.0557, 5.4))).toBe(0);
  });
});
