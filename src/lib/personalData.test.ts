import { describe, expect, it } from 'vitest';
import { hasPersonalData, redactDeep, redactText } from './personalData';

describe('redactText', () => {
  it('laat BSN, telefoonnummer, IBAN en e-mailadres weg (feedback 20 nov)', () => {
    expect(redactText('mijn BSN-nummer is 123456782')).toBe('mijn BSN-nummer is [weggelaten]');
    expect(redactText('mijn BSN is 1234 56 782, klopt dat')).toBe(
      'mijn BSN is [weggelaten], klopt dat',
    );
    expect(redactText('bel me op 06 12345678')).toBe('bel me op [weggelaten]');
    expect(redactText('of +31 6 1234 5678.')).toBe('of [weggelaten].');
    expect(redactText('06-12345678')).toBe('06-[weggelaten]');
    expect(redactText('rekening NL91 ABNA 0417 1643 00 graag')).toBe('rekening [weggelaten] graag');
    expect(redactText('mail jan.jansen@example.nl even')).toBe('mail [weggelaten] even');
  });

  it('laat aantallen, tijden, datums en id-achtige woorden staan', () => {
    for (const text of [
      'dertigduizend spreeuwen, 30.000',
      '1.200.000 spreeuwen',
      '12 kauwen en 3 roeken om 14:35',
      'op 2026-11-22 om 08.15',
      '500 m zuid, 52.1 graden',
      'toolu_01AB12345678cd',
    ]) {
      expect(redactText(text), text).toBe(text);
    }
  });
});

describe('hasPersonalData', () => {
  it('ziet het verschil', () => {
    expect(hasPersonalData('feedback, mijn BSN is 123456782')).toBe(true);
    expect(hasPersonalData('zes houtduiven')).toBe(false);
    expect(hasPersonalData(undefined)).toBe(false);
  });
});

describe('redactDeep', () => {
  it('gaat door objecten en lijsten, en laat getallen en de rest staan', () => {
    const output = {
      id: 'msg_1',
      usage: { input_tokens: 123456789 },
      content: [{ type: 'tool_use', input: { text: 'mijn BSN is 123456782' } }],
    };
    expect(redactDeep(output)).toEqual({
      id: 'msg_1',
      usage: { input_tokens: 123456789 },
      content: [{ type: 'tool_use', input: { text: 'mijn BSN is [weggelaten]' } }],
    });
    // Het origineel blijft zoals het was
    expect(output.content[0].input.text).toBe('mijn BSN is 123456782');
    expect(redactDeep(undefined)).toBeUndefined();
  });
});
