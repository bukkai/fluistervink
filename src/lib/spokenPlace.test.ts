import { describe, expect, it } from 'vitest';
import { distanceMeters } from './interpret';
import {
  UNKNOWN_PLACE_ACCURACY,
  describePlace,
  offsetPosition,
  placeFromSpeech,
  placeReason,
} from './spokenPlace';

// Rekenen met "500 m zuid van hier": de plek van de vogel vanaf de GPS, met
// een nauwkeurigheid die meegroeit met de geschatte afstand.

const GPS = { lat: 52.0, lon: 5.9, accuracy: 8, fixedAt: 1000 };

describe('offsetPosition', () => {
  it.each([
    ['zuid', 180, 500],
    ['oost', 90, 500],
    ['noordwest', 315, 2000],
  ])('%s: de goede afstand in de goede richting', (_name, bearing, meters) => {
    const moved = offsetPosition(GPS, meters, bearing);
    expect(distanceMeters(GPS, moved)).toBeCloseTo(meters, -1);
    const north = Math.round(Math.cos((bearing * Math.PI) / 180));
    const east = Math.round(Math.sin((bearing * Math.PI) / 180));
    expect(Math.sign(Math.round((moved.lat - GPS.lat) * 1e5))).toBe(north);
    expect(Math.sign(Math.round((moved.lon - GPS.lon) * 1e5))).toBe(east);
  });
});

describe('placeFromSpeech', () => {
  it('afstand en richting: verschuift, nauwkeurigheid groeit met de afstand', () => {
    const place = placeFromSpeech(GPS, { text: '500 m zuid', distanceM: 500, direction: 'Z' });
    expect(place.position!.lat).toBeLessThan(GPS.lat);
    expect(place.position!.accuracy).toBe(150); // √(8² + 150²)
    expect(place.position!.fixedAt).toBe(GPS.fixedAt);
    expect(place.recordedPosition).toEqual(GPS);
    expect(place.placedByVoice).toBe(true);
  });

  it('alleen een afstand: blijft staan, met een cirkel tot zo ver', () => {
    const place = placeFromSpeech(GPS, { text: '300 m verderop', distanceM: 300 });
    expect(place.position).toMatchObject({ lat: GPS.lat, lon: GPS.lon, accuracy: 300 });
  });

  it('alleen een omschrijving: blijft staan, ruimere nauwkeurigheid', () => {
    const place = placeFromSpeech(GPS, { text: 'aan de overkant van de rivier' });
    expect(place.position).toMatchObject({ lat: GPS.lat, accuracy: UNKNOWN_PLACE_ACCURACY });
    // Een slechtere GPS wordt niet beter gemaakt
    const rough = placeFromSpeech({ ...GPS, accuracy: 400 }, { text: 'ergens daar' });
    expect(rough.position!.accuracy).toBe(400);
  });
});

describe('placeReason', () => {
  it('alleen als de plek niet uit te rekenen is', () => {
    expect(placeReason({ text: '500 m zuid', distanceM: 500, direction: 'Z' })).toBeUndefined();
    expect(placeReason({ text: 'aan de overkant van de rivier' })).toMatch(
      /"aan de overkant van de rivier"/,
    );
    expect(placeReason({ text: 'ten zuiden', direction: 'Z' })).toBeDefined();
  });
});

describe('describePlace', () => {
  it('maakt een korte omschrijving', () => {
    expect(describePlace(500, 'Z')).toBe('500 m Z');
    expect(describePlace(1500, 'NO')).toBe('1,5 km NO');
    expect(describePlace(undefined, 'W')).toBe('W');
    expect(describePlace()).toBe('');
  });
});
