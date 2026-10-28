import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTester, ping, setAccessCode } from './api';
import { getInstallToken, integrityNonce } from './install';

// Aanmelden zonder code, met een nagebootste proxy en Turnstile: er gaat
// niets naar buiten.

let requests: { url: string; method: string; auth: string | null; body?: unknown }[];

beforeEach(() => {
  localStorage.clear();
  requests = [];
  window.turnstile = {
    render: (_container, options) => {
      setTimeout(() => (options.callback as (token: string) => void)('turnstile-token'));
      return 'widget';
    },
    remove: () => {},
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const auth = new Headers(init.headers).get('Authorization');
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method: init.method ?? 'GET', auth, body });
      if (url === '/api/install' && init.method === 'POST') {
        return Response.json({ token: 'i1.token', tester: 'app-3f9a2b1c' });
      }
      if (url === '/api/install') return Response.json({ turnstileSiteKey: 'site-key' });
      if (auth === 'Bearer i1.oud') return Response.json({ error: 'nee' }, { status: 401 });
      return Response.json({
        ok: true,
        tester: auth === 'Bearer i1.token' ? 'app-3f9a2b1c' : 'anna',
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.turnstile;
});

describe('aanmelden zonder code', () => {
  it('meldt zich aan met Turnstile en gebruikt daarna het token', async () => {
    expect(await ping()).toBe('app-3f9a2b1c');
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /api/install',
      'POST /api/install',
      'GET /api/ping',
    ]);
    expect(requests[1].body).toMatchObject({ turnstile: 'turnstile-token' });
    expect(requests[2].auth).toBe('Bearer i1.token');
    expect(getInstallToken()).toBe('i1.token');
    expect(getTester()).toBe('app-3f9a2b1c');

    // Een tweede keer zonder opnieuw aan te melden
    await ping();
    expect(requests).toHaveLength(4);
  });

  it('houdt hetzelfde id bij opnieuw aanmelden', async () => {
    await ping();
    localStorage.removeItem('fluistervink.installToken');
    await ping();
    const ids = requests
      .filter((r) => r.method === 'POST')
      .map((r) => (r.body as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('gebruikt een toegangscode als die er is', async () => {
    setAccessCode('code-van-anna');
    expect(await ping()).toBe('anna');
    expect(requests.map((r) => r.url)).toEqual(['/api/ping']);
  });

  it('vergeet een token dat niet (meer) werkt', async () => {
    localStorage.setItem('fluistervink.installToken', 'i1.oud');
    await expect(ping()).rejects.toMatchObject({ status: 401 });
    expect(getInstallToken()).toBe('');
  });

  it('rekent dezelfde nonce uit als de proxy (zelfde waarde in worker/index.test.ts)', () => {
    expect(integrityNonce('3f9a2b1c-0000-4000-8000-000000000001')).toBe(
      'M2Y5YTJiMWMtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAx',
    );
  });
});
