import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMessage, proxyErrorText, transcribeTimeout } from './api';
import { usageKind } from './queue';

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

describe('labels voor het verbruik', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('stuurt sessie, soort uitspraak, taal en versie mee, geen inhoud', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    // Met een code, zodat de app zich niet eerst aanmeldt
    localStorage.setItem('fluistervink.accessCode', 'code');
    await createMessage({}, { sessionId: 's-1', kind: 'trektel', language: 'nl' });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = new Headers(init.headers);
    expect(headers.get('X-Session')).toBe('s-1');
    expect(headers.get('X-Kind')).toBe('trektel');
    expect(headers.get('X-Language')).toBe('nl');
    expect(headers.get('X-App-Version')).toBe('test');
  });

  it('kiest tuintelling boven trektel boven knop', () => {
    const utterance = { trektel: true } as never;
    expect(usageKind(utterance, { tuintelling: true } as never)).toBe('tuintelling');
    expect(usageKind(utterance, undefined)).toBe('trektel');
    expect(usageKind({} as never, {} as never)).toBe('knop');
  });
});
