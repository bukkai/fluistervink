import { describe, expect, it } from 'vitest';
import { describePlace, parseEnglishNumber, parsePlaceText } from './spokenPlace';

const en = (text: string) => parsePlaceText(text, 'en');

describe('parseEnglishNumber', () => {
  it('leest cijfers en woorden', () => {
    expect(parseEnglishNumber(['200'])).toBe(200);
    expect(parseEnglishNumber(['1.5'])).toBe(1.5);
    expect(parseEnglishNumber(['two', 'hundred'])).toBe(200);
    expect(parseEnglishNumber(['two', 'hundred', 'and', 'fifty'])).toBe(250);
    expect(parseEnglishNumber(['twenty-five'])).toBe(25);
    expect(parseEnglishNumber(['a', 'hundred'])).toBe(100);
    expect(parseEnglishNumber(['a', 'thousand'])).toBe(1000);
    expect(parseEnglishNumber(['half', 'a'])).toBe(0.5);
    expect(parseEnglishNumber(['one', 'and', 'a', 'half'])).toBe(1.5);
    expect(parseEnglishNumber(['a'])).toBe(1);
  });

  it('geeft niets bij een woord dat geen getal is', () => {
    expect(parseEnglishNumber(['about', 'two'])).toBeUndefined();
    expect(parseEnglishNumber([])).toBeUndefined();
  });
});

describe('parsePlaceText in het Engels', () => {
  it('leest afstand en richting', () => {
    expect(en('200 metres south')).toEqual({ distanceM: 200, direction: 'Z' });
    expect(en('500 m south of here')).toEqual({ distanceM: 500, direction: 'Z' });
    expect(en('about two hundred meters to the north-east')).toEqual({
      distanceM: 200,
      direction: 'NO',
    });
    expect(en('1.5 km southwest')).toEqual({ distanceM: 1500, direction: 'ZW' });
  });

  it('rekent yards en miles om', () => {
    expect(en('300 yards west')).toEqual({ distanceM: 274, direction: 'W' });
    expect(en('half a mile east')).toEqual({ distanceM: 805, direction: 'O' });
    expect(en('a mile to the north')).toEqual({ distanceM: 1609, direction: 'N' });
  });

  it('herkent bijvoeglijke richtingen', () => {
    expect(en('on the eastern side').direction).toBe('O');
    expect(en('heading northwards').direction).toBe('N');
    expect(en('south-westerly').direction).toBe('ZW');
  });

  it('ziet geen afstand of richting waar die niet staat', () => {
    expect(en('across the river')).toEqual({});
    expect(en('in the mist')).toEqual({});
    // "westminster" is geen richting, "meadow" geen eenheid
    expect(en('near Westminster meadow')).toEqual({});
  });

  it('laat het Nederlands zoals het was', () => {
    expect(parsePlaceText('500 meter ten zuiden')).toEqual({ distanceM: 500, direction: 'Z' });
  });
});

describe('describePlace in het Engels', () => {
  it('gebruikt Engelse richtingen en een punt', () => {
    expect(describePlace(500, 'ZO', 'en')).toBe('500 m SE');
    expect(describePlace(1500, 'O', 'en')).toBe('1.5 km E');
    expect(describePlace(1500, 'O')).toBe('1,5 km O');
  });
});
