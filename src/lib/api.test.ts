import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimOwnInstall, createMessage, proxyErrorText, transcribeTimeout } from './api';
import { STORINGEN } from '../test-helpers';
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

describe('installatie van de eigenaar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function owner() {
    localStorage.setItem('fluistervink.accessCode', 'code');
    localStorage.setItem('fluistervink.tester', 'eigenaar');
    localStorage.setItem('fluistervink.installId', '3f9a2b1c-0000-4000-8000-000000000001');
  }

  it('meldt de installatie van vóór de code één keer als de zijne', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true, owner: true }));
    vi.stubGlobal('fetch', fetch);
    owner();
    await claimOwnInstall();
    await claimOwnInstall();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/testers?name=app-3f9a2b1c&owner=1');
    expect(init.method).toBe('PATCH');
  });

  it('niets zonder installatie of zonder de code van de eigenaar', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    owner();
    localStorage.removeItem('fluistervink.installId');
    await claimOwnInstall();
    owner();
    localStorage.setItem('fluistervink.tester', 'app-3f9a2b1c');
    await claimOwnInstall();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(Object.entries(STORINGEN))(
    'bij %s: geen fout, de volgende keer opnieuw',
    async (_, s) => {
      vi.stubGlobal('fetch', s.fetch());
      owner();
      await expect(claimOwnInstall()).resolves.toBeUndefined();
      const fetch = vi.fn(async () => Response.json({ ok: true, owner: true }));
      vi.stubGlobal('fetch', fetch);
      await claimOwnInstall();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});
