import { describe, expect, it } from 'vitest';
import { proxyErrorText, transcribeTimeout } from './api';

describe('time-out van de spraakherkenning', () => {
  it('is 30 s voor een korte opname', () => {
    expect(transcribeTimeout(40_000)).toBe(31_000);
  });

  it('groeit mee met een lange opname (3 minuten bij 32 kbit/s)', () => {
    expect(transcribeTimeout(720_000)).toBe(45_000);
  });
});

describe('foutmelding van de proxy', () => {
  it('plafonds en bekende statussen uit het woordenboek', () => {
    expect(proxyErrorText(429, 'audio_limit', 'Daglimiet')).toMatch(/5 uur ingesproken/);
    expect(proxyErrorText(429, 'message_limit')).toMatch(/heel veel uitspraken/);
    expect(proxyErrorText(429)).toBe('Te veel verzoeken achter elkaar; probeer het zo opnieuw');
    expect(proxyErrorText(401)).toBe('Ongeldige of ontbrekende toegangscode of installatie');
    expect(proxyErrorText(500, undefined, 'iets anders')).toBe('Interne fout in de proxy');
  });

  it('de rest: de tekst van de proxy, of anders de status', () => {
    expect(proxyErrorText(400, undefined, 'Ongeldige JSON')).toBe('Ongeldige JSON');
    expect(proxyErrorText(502, undefined, 'Overloaded')).toBe('Overloaded');
    expect(proxyErrorText(418)).toBe('Verzoek geweigerd (HTTP 418)');
  });
});
