// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import {
  deviceOf,
  getInstall,
  installName,
  integrityNonce,
  putInstall,
  signInstallToken,
} from './install';
import { keepFrom, pruneUsage, recordUsage, usageSince } from './usage';
import {
  NEW_INSTALLS_PER_DAY,
  NEW_INSTALLS_PER_HOUR,
  SHARED_BYTES_PER_DAY,
  SHARED_BYTES_PER_INSTALL_PER_DAY,
} from '../src/lib/limits';
import { dayOf } from '../src/lib/costs';

// De proxy in Node, met een nep-KV in het geheugen, D1 als SQLite in het
// geheugen (zodat de echte SQL getest wordt) en een nagebootste fetch
// naar OpenAI, Anthropic en waarneming.nl: er gaat nooit iets naar buiten.
// (Cloudflare's eigen testomgeving, vitest-pool-workers, werkt nog niet met
// Vitest 5.)

const OWNER_CODE = 'code-van-de-eigenaar';
const INSTALL_SECRET = 'geheim-voor-tokens';
// Anna en Piet zijn installaties (alleen de eigenaar heeft een code)
const ANNA_ID = 'a0000000-0000-4000-8000-00000000a11a';
const PIET_ID = 'b0000000-0000-4000-8000-00000000b1e7';
const ANNA = installName(ANNA_ID);
const PIET = installName(PIET_ID);
let ANNA_CODE: string;
let PIET_CODE: string;

beforeAll(async () => {
  ANNA_CODE = await signInstallToken(ANNA_ID, INSTALL_SECRET);
  PIET_CODE = await signInstallToken(PIET_ID, INSTALL_SECRET);
});

// Bestaat alleen in de Workers-runtime, niet in Node
beforeAll(() => {
  const subtle = crypto.subtle as unknown as {
    timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
  };
  subtle.timingSafeEqual ??= (a, b) => {
    const x = new Uint8Array(a);
    const y = new Uint8Array(b);
    return x.length === y.length && x.every((byte, i) => byte === y[i]);
  };
});

/** KV in het geheugen, met alleen wat de proxy gebruikt. */
function memoryKv() {
  const store = new Map<string, { value: ArrayBuffer; metadata: unknown; expiresAt?: number }>();
  return {
    store,
    async put(
      key: string,
      value: ArrayBuffer | string,
      options?: { metadata?: unknown; expirationTtl?: number },
    ) {
      const bytes =
        typeof value === 'string' ? (new TextEncoder().encode(value).buffer as ArrayBuffer) : value;
      const ttl = options?.expirationTtl;
      store.set(key, {
        value: bytes,
        metadata: options?.metadata,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
    },
    async get(key: string, type?: string) {
      const entry = store.get(key);
      if (!entry || (entry.expiresAt && entry.expiresAt <= Date.now())) return null;
      const text = new TextDecoder().decode(entry.value);
      return type === 'json' ? JSON.parse(text) : text;
    },
    async getWithMetadata(key: string) {
      const entry = store.get(key);
      return { value: entry?.value ?? null, metadata: entry?.metadata ?? null };
    },
    async list({ prefix = '' }: { prefix?: string; cursor?: string } = {}) {
      const keys = [...store.entries()]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, entry]) => ({ name, metadata: entry.metadata }));
      return { keys, list_complete: true, cursor: '' };
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

/** D1 met alleen wat de proxy gebruikt: prepare, bind, run en all. */
function memoryD1() {
  const db = new DatabaseSync(':memory:');
  type Value = string | number | null;
  const statement = (sql: string, values: Value[] = []) => ({
    bind: (...next: Value[]) => statement(sql, next),
    async run() {
      db.prepare(sql).run(...values);
      return { success: true };
    },
    async all() {
      return { results: db.prepare(sql).all(...values) };
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    /** Zoals D1: alles in één transactie, of niets */
    async batch(statements: ReturnType<typeof statement>[]) {
      db.exec('BEGIN');
      try {
        for (const s of statements) await s.run();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
    exec: (sql: string) => db.exec(sql),
  };
}

/** Zet een teller van worker/guard.ts voor vandaag op `n`. */
async function setGuardCount(key: string, n: number) {
  const db = env.USAGE as ReturnType<typeof memoryD1>;
  db.exec(`CREATE TABLE IF NOT EXISTS guard_counts (
    day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, key))`);
  await db
    .prepare('INSERT OR REPLACE INTO guard_counts (day, key, n) VALUES (?, ?, ?)')
    .bind(dayOf(new Date()), key, n)
    .run();
}

let kv: ReturnType<typeof memoryKv>;
let testersKv: ReturnType<typeof memoryKv>;
let env: Record<string, unknown>;
/** Nagebootste snelheidslimiet: per tester het aantal verzoeken, met een grens */
let limited: { counts: Map<string, number>; max: number };
/** Nagebootste fetch: alle verzoeken naar buiten komen hier binnen */
let upstream: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  limited = { counts: new Map(), max: 60 };
  kv = memoryKv();
  testersKv = memoryKv();
  env = {
    ACCESS_CODE: OWNER_CODE,
    INSTALL_SECRET,
    OPENAI_API_KEY: 'sk-openai-geheim',
    ANTHROPIC_API_KEY: 'sk-ant-geheim',
    FEEDBACK: kv,
    TESTERS: testersKv,
    USAGE: memoryD1(),
    CHANNEL: 'beta',
    AI_LIMIT: {
      async limit({ key }: { key: string }) {
        const count = (limited.counts.get(key) ?? 0) + 1;
        limited.counts.set(key, count);
        return { success: count <= limited.max };
      },
    },
  };
  upstream = vi.fn(async () => {
    throw new Error('onverwacht verzoek naar buiten');
  });
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    upstream(input instanceof Request ? input.url : String(input), init),
  );
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Een verzoek aan de proxy, standaard met de code van Anna. Wacht ook op wat
 * de proxy na het antwoord nog doet (ctx.waitUntil, zoals het verbruik tellen).
 */
async function call(
  path: string,
  { code = ANNA_CODE, ...init }: RequestInit & { code?: string | null } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (code) headers.set('Authorization', `Bearer ${code}`);
  const request = new Request(`https://fluistervink.test${path}`, { ...init, headers });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) };
  const response = await worker.fetch(request as never, env as never, ctx as never);
  await Promise.all(pending);
  return response;
}

describe('toegangscode', () => {
  it('weigert een verzoek zonder code', async () => {
    expect((await call('/api/ping', { code: null })).status).toBe(401);
  });

  it('weigert een verkeerde code', async () => {
    expect((await call('/api/ping', { code: 'geraden' })).status).toBe(401);
  });

  it('herkent de eigenaar en de installaties', async () => {
    expect(await (await call('/api/ping', { code: OWNER_CODE })).json()).toEqual({
      ok: true,
      tester: 'eigenaar',
    });
    expect(await (await call('/api/ping')).json()).toEqual({ ok: true, tester: ANNA });
  });

  it('weigert elke code zonder ACCESS_CODE', async () => {
    delete env.ACCESS_CODE;
    expect((await call('/api/ping', { code: OWNER_CODE })).status).toBe(401);
    expect((await call('/api/ping', { code: '' })).status).toBe(401);
    expect((await call('/api/ping')).status).toBe(200);
  });

  it('gaat zonder geldige code nooit naar buiten', async () => {
    await call('/api/messages', { code: 'geraden', method: 'POST', body: '{}' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('begrenst spraakherkenning en model per tester, niet voor de eigenaar', async () => {
    limited.max = 0;
    const anna = await call('/api/messages', { method: 'POST', body: '{}' });
    expect(anna.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
    expect(limited.counts.get(ANNA)).toBe(1);
    // De eigenaar komt wel door (hier tot de controle van het verzoek zelf)
    const owner = await call('/api/messages', { code: OWNER_CODE, method: 'POST', body: '{}' });
    expect(owner.status).toBe(400);
    expect(limited.counts.has('eigenaar')).toBe(false);
  });

  it('begrenst ook het delen, met een eigen teller', async () => {
    limited.max = 0;
    const put = await call('/api/feedback/sessions/abc', { method: 'PUT', body: '{"a":1}' });
    expect(put.status).toBe(429);
    expect(limited.counts.get(`share:${ANNA}`)).toBe(1);
    expect(await kv.get(`${ANNA}/sessions/abc`)).toBeNull();
    const owner = await call('/api/feedback/sessions/abc', {
      code: OWNER_CODE,
      method: 'PUT',
      body: '{"a":1}',
    });
    expect(owner.status).toBe(200);
  });

  it('telt andere verzoeken niet mee voor de limiet', async () => {
    limited.max = 0;
    expect((await call('/api/ping')).status).toBe(200);
    expect(limited.counts.size).toBe(0);
  });

  it('geeft 404 bij een onbekend adres', async () => {
    expect((await call('/api/bestaat-niet')).status).toBe(404);
  });
});

describe('/api/install (aanmelden zonder code)', () => {
  const ID = '3f9a2b1c-0000-4000-8000-000000000001';

  beforeEach(() => {
    env.TURNSTILE_SECRET = 'turnstile-geheim';
    env.TURNSTILE_SITE_KEY = '0x-site-key';
  });

  /** Turnstile zegt ja bij token "goed", met de actie "install" */
  function turnstileAnswers() {
    upstream.mockImplementation(async (url, init) => {
      if (!url.startsWith('https://challenges.cloudflare.com/')) throw new Error(url);
      const form = init?.body as FormData;
      expect(form.get('secret')).toBe('turnstile-geheim');
      const ok = form.get('response') === 'goed';
      return Response.json({ success: ok, action: 'install' });
    });
  }

  async function register(body: object) {
    return call('/api/install', { code: null, method: 'POST', body: JSON.stringify(body) });
  }

  it('rekent dezelfde nonce uit als de app (zelfde waarde in src/lib/install.test.ts)', async () => {
    expect(await integrityNonce(ID)).toBe('k0l91YJxDrSWOVtsmDgCOYMhex0GEqkoZqz2DjSfkAI');
  });

  it('geeft de openbare instellingen zonder code', async () => {
    const response = await call('/api/install', { code: null });
    expect(await response.json()).toEqual({ turnstileSiteKey: '0x-site-key' });
  });

  it('meldt een installatie aan na Turnstile, en het token werkt daarna', async () => {
    turnstileAnswers();
    const response = await register({ id: ID, turnstile: 'goed' });
    expect(response.status).toBe(200);
    const { token, tester } = (await response.json()) as { token: string; tester: string };
    expect(tester).toBe('app-3f9a2b1c');
    expect(await (await call('/api/ping', { code: token })).json()).toEqual({
      ok: true,
      tester: 'app-3f9a2b1c',
    });
  });

  it('weigert zonder geldig bewijs', async () => {
    turnstileAnswers();
    expect((await register({ id: ID, turnstile: 'fout' })).status).toBe(403);
    expect((await register({ id: ID })).status).toBe(403);
    expect(testersKv.store.size).toBe(0);
  });

  it('weigert een tweede id met hetzelfde begin, want dat geeft dezelfde naam', async () => {
    turnstileAnswers();
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(200);
    const twin = '3f9a2b1c-ffff-4000-8000-000000000009';
    expect((await register({ id: twin, turnstile: 'goed' })).status).toBe(409);
    // Hetzelfde id opnieuw aanmelden mag wel
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(200);
  });

  it('weigert een ongeldig id', async () => {
    expect((await register({ id: 'eigenaar', turnstile: 'goed' })).status).toBe(400);
  });

  it('stopt nieuwe installaties boven de grens per dag, bestaande mogen wel', async () => {
    turnstileAnswers();
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(200);
    await setGuardCount('install', NEW_INSTALLS_PER_DAY);
    const other = '4f9a2b1c-0000-4000-8000-000000000002';
    const response = await register({ id: other, turnstile: 'goed' });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'install_limit' });
    expect(await getInstall(testersKv as never, other)).toBeNull();
    // Een installatie die er al is, krijgt gewoon een token
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(200);
  });

  it('stopt ook boven de grens per uur', async () => {
    turnstileAnswers();
    for (let i = 0; i < NEW_INSTALLS_PER_HOUR; i++) {
      const id = `${(0x10000000 + i).toString(16)}-0000-4000-8000-000000000003`;
      expect((await register({ id, turnstile: 'goed' })).status).toBe(200);
    }
    const response = await register({ id: ID, turnstile: 'goed' });
    expect(response.status).toBe(503);
  });

  it('staat uit zonder INSTALL_SECRET', async () => {
    delete env.INSTALL_SECRET;
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(503);
  });

  it('weigert een vervalst of gewijzigd token', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    const other = token.replace(ID, '3f9a2b1c-0000-4000-8000-000000000002');
    expect((await call('/api/ping', { code: other })).status).toBe(401);
    env.INSTALL_SECRET = 'ander-geheim';
    expect((await call('/api/ping', { code: token })).status).toBe(401);
  });

  it('laat de eigenaar een installatie afsluiten', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    const list = await call('/api/testers', { code: OWNER_CODE });
    const { testers } = (await list.json()) as { testers: { name: string; source: string }[] };
    expect(testers).toContainEqual(
      expect.objectContaining({ name: 'app-3f9a2b1c', source: 'install', via: 'turnstile' }),
    );

    const removed = await call('/api/testers?name=app-3f9a2b1c', {
      code: OWNER_CODE,
      method: 'DELETE',
    });
    expect(removed.status).toBe(200);
    expect((await call('/api/ping', { code: token })).status).toBe(401);
    // Opnieuw aanmelden met hetzelfde id helpt niet
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(403);
  });

  it('haalt een afgesloten installatie uit de lijst, maar hij blijft afgesloten', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    const hide = () =>
      call('/api/testers?name=app-3f9a2b1c&hide=1', { code: OWNER_CODE, method: 'DELETE' });
    const names = async () =>
      (
        (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
          testers: { name: string }[];
        }
      ).testers.map((t) => t.name);

    // Een werkende installatie eerst afsluiten
    expect((await hide()).status).toBe(409);
    expect((await call('/api/ping', { code: token })).status).toBe(200);

    await call('/api/testers?name=app-3f9a2b1c', { code: OWNER_CODE, method: 'DELETE' });
    expect((await hide()).status).toBe(200);
    expect(await names()).not.toContain('app-3f9a2b1c');
    expect((await call('/api/ping', { code: token })).status).toBe(401);
    expect((await register({ id: ID, turnstile: 'goed' })).status).toBe(403);
  });

  it('markeert een installatie als die van de eigenaar, en weer terug', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    const mark = (owner: '0' | '1', code: string = OWNER_CODE, name = 'app-3f9a2b1c') =>
      call(`/api/testers?name=${name}&owner=${owner}`, { code, method: 'PATCH' });
    const listed = async () =>
      (
        (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
          testers: { name: string; owner?: boolean }[];
        }
      ).testers.find((t) => t.name === 'app-3f9a2b1c');

    expect((await listed())?.owner).toBeUndefined();
    expect((await mark('1')).status).toBe(200);
    expect((await listed())?.owner).toBe(true);
    // Twee keer is niet erg (de app meldt het vanzelf)
    expect((await mark('1')).status).toBe(200);
    // De installatie blijft gewoon werken
    expect((await call('/api/ping', { code: token })).status).toBe(200);
    expect((await mark('0')).status).toBe(200);
    expect((await listed())?.owner).toBeUndefined();

    // Alleen de eigenaar, en alleen een bestaande installatie
    expect((await mark('1', token)).status).toBe(403);
    expect((await mark('1', OWNER_CODE, 'app-00000000')).status).toBe(404);
  });

  it('zet een eerdere wijziging niet terug als de lijst van KV achterloopt', async () => {
    turnstileAnswers();
    await register({ id: ID, turnstile: 'goed' });
    // KV's list kan tot een minuut een oude stand geven; get is wel vers
    const stale = await testersKv.list();
    const list = testersKv.list;
    testersKv.list = async ({ prefix = '' } = {}) => ({
      ...stale,
      keys: stale.keys.filter((k) => k.name.startsWith(prefix)),
    });
    try {
      await call('/api/testers?name=app-3f9a2b1c&owner=1', { code: OWNER_CODE, method: 'PATCH' });
      await call('/api/testers?name=app-3f9a2b1c', { code: OWNER_CODE, method: 'DELETE' });
    } finally {
      testersKv.list = list;
    }
    expect(await getInstall(testersKv as never, ID, { fresh: true })).toEqual(
      expect.objectContaining({ owner: true, blocked: true }),
    );
  });

  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

  it('herkent het soort toestel grof aan de User-Agent', () => {
    expect(deviceOf(IPHONE)).toBe('ios');
    expect(
      deviceOf(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36',
      ),
    ).toBe('android');
    expect(
      deviceOf(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      ),
    ).toBe('computer');
    expect(deviceOf(null)).toBeUndefined();
    expect(deviceOf('')).toBeUndefined();
  });

  it('bewaart bij het aanmelden het soort toestel, en toont het de eigenaar', async () => {
    turnstileAnswers();
    const response = await call('/api/install', {
      code: null,
      method: 'POST',
      headers: { 'User-Agent': IPHONE },
      body: JSON.stringify({ id: ID, turnstile: 'goed' }),
    });
    expect(response.status).toBe(200);
    const { testers } = (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
      testers: { name: string; device?: string }[];
    };
    expect(testers.find((t) => t.name === 'app-3f9a2b1c')?.device).toBe('ios');
  });

  it('schrijft het toestel alsnog bij een oude installatie bij, en verder niets', async () => {
    await putInstall(testersKv as never, ID, {
      name: 'app-3f9a2b1c',
      registeredAt: 1000,
      via: 'turnstile',
      displayName: 'Maarten',
    });
    const token = await signInstallToken(ID, INSTALL_SECRET);
    const ping = () => call('/api/ping', { code: token, headers: { 'User-Agent': IPHONE } });

    expect((await ping()).status).toBe(200);
    expect(await getInstall(testersKv as never, ID)).toEqual({
      name: 'app-3f9a2b1c',
      registeredAt: 1000,
      via: 'turnstile',
      displayName: 'Maarten',
      device: 'ios',
    });
  });

  it('schrijft geen toestel bij een afgesloten installatie (die blijft dicht)', async () => {
    await putInstall(testersKv as never, ID, {
      name: 'app-3f9a2b1c',
      registeredAt: 1000,
      via: 'turnstile',
      blocked: true,
    });
    const token = await signInstallToken(ID, INSTALL_SECRET);
    expect(
      (await call('/api/ping', { code: token, headers: { 'User-Agent': IPHONE } })).status,
    ).toBe(401);
    expect((await getInstall(testersKv as never, ID))?.device).toBeUndefined();
    expect((await getInstall(testersKv as never, ID))?.blocked).toBe(true);
  });

  it('bewaart een opgegeven naam bij de installatie', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    const setName = (name: unknown, code: string = token) =>
      call('/api/install/name', { code, method: 'PUT', body: JSON.stringify({ name }) });
    expect((await setName('  Anna   de Vries ')).status).toBe(200);
    const list = async () =>
      (
        (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
          testers: { name: string; displayName?: string }[];
        }
      ).testers.find((t) => t.name === 'app-3f9a2b1c');
    expect((await list())?.displayName).toBe('Anna de Vries');

    expect((await setName('x'.repeat(41))).status).toBe(400);
    expect((await setName('nee\u0000')).status).toBe(400);
    // De eigenaar heeft al een naam
    expect((await setName('Piet', OWNER_CODE)).status).toBe(403);

    expect((await setName('')).status).toBe(200);
    expect((await list())?.displayName).toBeUndefined();
  });

  it('geeft een installatie geen toegang tot beheer', async () => {
    turnstileAnswers();
    const { token } = (await (await register({ id: ID, turnstile: 'goed' })).json()) as {
      token: string;
    };
    expect((await call('/api/testers', { code: token })).status).toBe(403);
  });

  it('maakt geen testers met een code meer aan', async () => {
    const response = await call('/api/testers', {
      code: OWNER_CODE,
      method: 'POST',
      body: JSON.stringify({ name: 'anna' }),
    });
    expect(response.status).toBe(404);
  });

  describe('Play Integrity', () => {
    let verdict: Record<string, unknown>;

    beforeEach(async () => {
      const keys = (await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair;
      const pkcs8 = Buffer.from(
        (await crypto.subtle.exportKey('pkcs8', keys.privateKey)) as ArrayBuffer,
      );
      env.PLAY_SERVICE_ACCOUNT = JSON.stringify({
        client_email: 'fluistervink@project.iam.gserviceaccount.com',
        private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8.toString('base64')}\n-----END PRIVATE KEY-----\n`,
      });
      verdict = {
        requestDetails: {
          requestPackageName: 'nl.hegmus.fluistervink',
          nonce: await integrityNonce(ID),
          timestampMillis: String(Date.now()),
        },
        appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
        deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
      };
      upstream.mockImplementation(async (url, init) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          const assertion = (init?.body as URLSearchParams).get('assertion') ?? '';
          const [header, claims, signature] = assertion.split('.');
          const valid = await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            keys.publicKey,
            Buffer.from(signature, 'base64url'),
            new TextEncoder().encode(`${header}.${claims}`),
          );
          return valid
            ? Response.json({ access_token: 'google-token', expires_in: 3600 })
            : new Response('', { status: 400 });
        }
        if (url.startsWith('https://playintegrity.googleapis.com/v1/nl.hegmus.fluistervink:')) {
          expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer google-token');
          return Response.json({ tokenPayloadExternal: verdict });
        }
        throw new Error(url);
      });
    });

    it('meldt een echte app uit Play aan', async () => {
      const response = await register({ id: ID, integrity: 'verklaring' });
      expect(response.status).toBe(200);
      const list = await call('/api/testers', { code: OWNER_CODE });
      const { testers } = (await list.json()) as { testers: { via?: string }[] };
      expect(testers).toContainEqual(expect.objectContaining({ via: 'play' }));
    });

    it('neemt ook de oude nonce aan (het id zelf, van webcode uit de cache)', async () => {
      verdict.requestDetails = {
        ...(verdict.requestDetails as object),
        nonce: Buffer.from(ID).toString('base64url'),
      };
      expect((await register({ id: ID, integrity: 'verklaring' })).status).toBe(200);
    });

    it('weigert een verklaring voor een andere installatie', async () => {
      verdict.requestDetails = {
        ...(verdict.requestDetails as object),
        nonce: Buffer.from('iets-anders').toString('base64url'),
      };
      expect((await register({ id: ID, integrity: 'verklaring' })).status).toBe(403);
    });

    it('weigert een app die niet uit Play komt of een oude verklaring', async () => {
      verdict.appIntegrity = { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' };
      expect((await register({ id: ID, integrity: 'verklaring' })).status).toBe(403);
      verdict.appIntegrity = { appRecognitionVerdict: 'PLAY_RECOGNIZED' };
      verdict.requestDetails = {
        ...(verdict.requestDetails as object),
        timestampMillis: String(Date.now() - 60 * 60 * 1000),
      };
      expect((await register({ id: ID, integrity: 'verklaring' })).status).toBe(403);
    });

    it('weigert een toestel zonder integriteit', async () => {
      verdict.deviceIntegrity = {};
      expect((await register({ id: ID, integrity: 'verklaring' })).status).toBe(403);
    });
  });
});

describe('/api/messages (Anthropic)', () => {
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };

  function post(body: object) {
    return call('/api/messages', { method: 'POST', body: JSON.stringify(body) });
  }

  it('weigert een model dat niet op de lijst staat', async () => {
    const response = await post({ model: 'claude-duur-model', max_tokens: 10, messages: [] });
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(['claude-sonnet-5-5', 'claude-opus-5-5'])(
    'laat %s alleen door voor de eigenaar',
    async (model) => {
      const response = await post({ model, max_tokens: 10, messages: [] });
      expect(response.status).toBe(400);
      expect(upstream).not.toHaveBeenCalled();

      upstream.mockResolvedValue(Response.json(message));
      const owner = await call('/api/messages', {
        code: OWNER_CODE,
        method: 'POST',
        body: JSON.stringify({ model, max_tokens: 10, messages: [] }),
      });
      expect(owner.status).toBe(200);
    },
  );

  describe('plafond per dag', () => {
    /** Zoveel verzoeken aan het model op naam van een tester, zoals de proxy telt */
    async function asked(times: number, tester = ANNA, at = new Date()) {
      const key = { tester, channel: 'stable', session: 's', model: 'claude-haiku-5-5' };
      for (let i = 0; i < times; i++) await recordUsage(env.USAGE as never, key, {}, at);
    }
    const body = { model: 'claude-haiku-5-5', max_tokens: 10, messages: [] };

    it('weigert boven de 500 verzoeken vandaag, met een eigen code', async () => {
      await asked(500);
      const response = await post(body);
      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: 'message_limit' });
      expect(upstream).not.toHaveBeenCalled();
    });

    it('laat net onder het plafond nog door, en telt gisteren niet mee', async () => {
      await asked(499);
      await asked(10, ANNA, new Date('2000-01-01T12:00:00Z'));
      upstream.mockResolvedValue(Response.json(message));
      expect((await post(body)).status).toBe(200);
    });
  });

  it('stuurt door met onze sleutel en begrenst de uitvoer', async () => {
    upstream.mockResolvedValue(Response.json(message));
    const response = await post({
      model: 'claude-haiku-5-5',
      max_tokens: 100_000,
      messages: [{ role: 'user', content: 'vink' }],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'msg_1' });
    expect(response.headers.get('Server-Timing')).toMatch(/^upstream;dur=\d+$/);

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-ant-geheim');
    expect(JSON.parse(String(init?.body))).toMatchObject({ max_tokens: 4096, stream: false });
  });

  it('laat een verzoek zoals de app het stuurt door', async () => {
    upstream.mockResolvedValue(Response.json(message));
    const response = await post({
      model: 'claude-haiku-5-5',
      max_tokens: 4096,
      output_config: { effort: 'low' },
      tools: [{ name: 'add_observation', description: '…', input_schema: { type: 'object' } }],
      tool_choice: { type: 'auto' },
      system: [{ type: 'text', text: 'soorten…', cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: 'zes houtduiven' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'undo', input: {} }] },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'ok' }] },
          ],
        },
      ],
    });
    expect(response.status).toBe(200);
  });

  // Een toegangscode mag geen vrije toegang tot ons tegoed bij Anthropic zijn
  it.each([
    ['een onbekend veld', { metadata: { user_id: 'x' } }],
    [
      'een tool van Anthropic zelf',
      { tools: [{ type: 'web_search_20250305', name: 'web_search' }] },
    ],
    ['een tool zonder schema', { tools: [{ name: 'x' }] }],
    [
      'een cache van een uur',
      { system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral', ttl: '1h' } }] },
    ],
    [
      'een cache van een uur in een bericht',
      {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'vink', cache_control: { type: 'ephemeral', ttl: '1h' } },
            ],
          },
        ],
      },
    ],
    [
      'een document via een URL',
      {
        messages: [
          {
            role: 'user',
            content: [{ type: 'document', source: { type: 'url', url: 'https://x.test/a.pdf' } }],
          },
        ],
      },
    ],
    [
      'een afbeelding in een tool-resultaat',
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 't1',
                content: [{ type: 'image', source: { type: 'url', url: 'https://x.test/a.png' } }],
              },
            ],
          },
        ],
      },
    ],
  ])('weigert %s', async (_, extra) => {
    const response = await post({
      model: 'claude-haiku-5-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'vink' }],
      ...extra,
    });
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('weigert ongeldige JSON met 400', async () => {
    const response = await call('/api/messages', { method: 'POST', body: '{kapot' });
    expect(response.status).toBe(400);
  });

  it('weigert een te groot verzoek al op de Content-Length', async () => {
    const response = await call('/api/messages', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Length': String(10 * 1024 * 1024) },
    });
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('weigert een te groot verzoek', async () => {
    const response = await post({
      model: 'claude-haiku-5-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'vink '.repeat(60_000) }],
    });
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('meldt een probleem met onze eigen sleutel als 502, niet als 401', async () => {
    upstream.mockResolvedValue(
      Response.json(
        { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
        { status: 401 },
      ),
    );
    const response = await post({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] });
    expect(response.status).toBe(502);
  });
});

describe('/api/transcribe (OpenAI)', () => {
  function post(fields: Record<string, string | Blob>, code = ANNA_CODE) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return call('/api/transcribe', { method: 'POST', body: form, code });
  }
  const audio = () => new File([new Uint8Array(100)], 'opname.webm', { type: 'audio/webm' });

  it('weigert een verzoek zonder audio', async () => {
    expect((await post({ model: 'whisper-1' })).status).toBe(400);
  });

  it('weigert een model dat niet op de lijst staat', async () => {
    expect((await post({ audio: audio(), model: 'gpt-5' })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('weigert audio boven de 10 MB', async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'lang.webm');
    expect((await post({ audio: big })).status).toBe(413);
  });

  it('stuurt door met onze sleutel, Nederlands en de soortenprompt', async () => {
    upstream.mockResolvedValue(Response.json({ text: 'zes houtduiven' }));
    const response = await post({ audio: audio(), prompt: 'Houtduif, Vink' });
    expect(await response.json()).toMatchObject({
      text: 'zes houtduiven',
      model: 'gpt-transcribe',
    });

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sk-openai-geheim');
    const sent = init?.body as FormData;
    // gpt-transcribe: `languages` in plaats van `language`, geen logprobs
    expect(sent.getAll('languages[]')).toEqual(['nl']);
    expect(sent.has('language')).toBe(false);
    expect(sent.get('prompt')).toBe('Houtduif, Vink');
    expect(sent.get('model')).toBe('gpt-transcribe');
    expect(sent.has('include[]')).toBe(false);
  });

  it('geeft Engels door als de app dat vraagt (ontwikkeloptie English)', async () => {
    upstream.mockResolvedValue(Response.json({ text: 'six Woodpigeons' }));
    await post({ audio: audio(), language: 'en' });
    expect((upstream.mock.calls[0][1]?.body as FormData).getAll('languages[]')).toEqual(['en']);

    upstream.mockClear();
    await post({ audio: audio(), model: 'whisper-1', language: 'en' });
    expect((upstream.mock.calls[0][1]?.body as FormData).get('language')).toBe('en');
  });

  it('weigert een taal die niet op de lijst staat', async () => {
    for (const language of ['de', 'nl,en', '']) {
      expect((await post({ audio: audio(), language })).status, language).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('vraagt bij gpt-4o-transcribe om Nederlands en de zekerheid', async () => {
    upstream.mockResolvedValue(Response.json({ text: 'vink' }));
    await post({ audio: audio(), model: 'gpt-4o-transcribe' }, OWNER_CODE);
    const sent = upstream.mock.calls[0][1]?.body as FormData;
    expect(sent.get('language')).toBe('nl');
    expect(sent.has('languages[]')).toBe(false);
    expect(sent.get('include[]')).toBe('logprobs');
  });

  it('geeft de zekerheid mee (meetkundig gemiddelde van de kansen)', async () => {
    upstream.mockResolvedValue(
      Response.json({
        text: 'vink',
        logprobs: [{ logprob: Math.log(0.5) }, { logprob: Math.log(0.125) }],
      }),
    );
    expect(await (await post({ audio: audio() })).json()).toMatchObject({ confidence: 0.25 });
  });

  it('vraagt geen zekerheid bij whisper-1 (kan dat niet)', async () => {
    upstream.mockResolvedValue(Response.json({ text: 'vink' }));
    const body = (await (await post({ audio: audio(), model: 'whisper-1' })).json()) as {
      confidence?: number;
    };
    expect(body.confidence).toBeUndefined();
    expect((upstream.mock.calls[0][1]?.body as FormData).has('include[]')).toBe(false);
  });

  it('laat de gpt-4o-modellen alleen voor de eigenaar door (testset)', async () => {
    expect((await post({ audio: audio(), model: 'gpt-4o-transcribe' })).status).toBe(400);
    expect((await post({ audio: audio(), model: 'gpt-4o-mini-transcribe' })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  describe('plafond per dag', () => {
    /** Zoveel seconden audio op naam van een tester, zoals de proxy telt */
    function spoken(seconds: number, tester = ANNA, at = new Date()) {
      const key = { tester, channel: 'stable', session: 's', model: 'gpt-transcribe' };
      return recordUsage(env.USAGE as never, key, { audioSeconds: seconds }, at);
    }

    it('weigert boven de 5 uur vandaag, met een eigen code voor de app', async () => {
      await spoken(5 * 60 * 60);
      const response = await post({ audio: audio() });
      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: 'audio_limit' });
      expect(upstream).not.toHaveBeenCalled();
    });

    it('laat net onder het plafond nog door', async () => {
      await spoken(5 * 60 * 60 - 1);
      upstream.mockResolvedValue(Response.json({ text: 'vink' }));
      expect((await post({ audio: audio() })).status).toBe(200);
    });

    it('telt alleen vandaag en alleen deze tester', async () => {
      await spoken(6 * 60 * 60, ANNA, new Date('2000-01-01T12:00:00Z'));
      await spoken(6 * 60 * 60, 'iemand-anders');
      upstream.mockResolvedValue(Response.json({ text: 'vink' }));
      expect((await post({ audio: audio() })).status).toBe(200);
    });

    it('geldt niet voor de eigenaar', async () => {
      await spoken(6 * 60 * 60, 'eigenaar');
      upstream.mockResolvedValue(Response.json({ text: 'vink' }));
      expect((await post({ audio: audio() }, OWNER_CODE)).status).toBe(200);
    });
  });

  it('geeft fouten van OpenAI door, behalve een sleutelprobleem (502)', async () => {
    upstream.mockResolvedValueOnce(
      Response.json({ error: { message: 'te veel' } }, { status: 429 }),
    );
    expect((await post({ audio: audio() })).status).toBe(429);
    upstream.mockResolvedValueOnce(
      Response.json({ error: { message: 'sleutel' } }, { status: 401 }),
    );
    expect((await post({ audio: audio() })).status).toBe(502);
  });
});

describe('/api/area (waarneming.nl)', () => {
  it('weigert ongeldige coördinaten', async () => {
    expect((await call('/api/area?lat=abc&lon=5')).status).toBe(400);
    expect((await call('/api/area?lat=91&lon=5')).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('geeft alleen ID en naam van het gebied terug', async () => {
    upstream.mockResolvedValue(
      Response.json({
        features: [
          {
            properties: { id: 1234, title: 'Amsterdamse Waterleidingduinen', area: 'groot' },
            geometry: {},
          },
        ],
      }),
    );
    const response = await call('/api/area?lat=52.36&lon=4.92');
    expect(await response.json()).toEqual({
      area: { id: 1234, name: 'Amsterdamse Waterleidingduinen' },
    });
    expect(upstream.mock.calls[0][0]).toBe(
      'https://waarneming.nl/api/v1/locations/geojson/?coordinates=52.36,4.92',
    );
  });

  it('geeft null als het punt in geen gebied ligt', async () => {
    upstream.mockResolvedValue(Response.json({ features: [] }));
    expect(await (await call('/api/area?lat=52&lon=4')).json()).toEqual({ area: null });
  });
});

describe('/api/feedback (gedeelde gegevens)', () => {
  function put(path: string, body: BodyInit, code = ANNA_CODE) {
    return call(`/api/feedback/${path}`, {
      code,
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('bewaart een sessie onder de naam van de tester', async () => {
    expect((await put('sessions/sessie-1', '{"ok":true}')).status).toBe(200);
    const entry = kv.store.get(`${ANNA}/sessions/sessie-1`);
    expect(new TextDecoder().decode(entry?.value)).toBe('{"ok":true}');
    expect(entry?.metadata).toMatchObject({ contentType: 'application/json', bytes: 11 });
  });

  it('weigert een ongeldige id (ook pogingen om buiten de eigen map te schrijven)', async () => {
    expect((await put('sessions/..%2Fpiet%2Fx', 'x')).status).toBe(400);
    expect((await put('sessions/met spatie', 'x')).status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it('weigert een lege of te grote sessie', async () => {
    expect((await put('sessions/leeg', '')).status).toBe(400);
    expect((await put('sessions/groot', new Uint8Array(5 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it('laat een tester niets lezen of wissen', async () => {
    await put('sessions/w', '{}');
    expect((await call('/api/feedback/list')).status).toBe(403);
    expect((await call(`/api/feedback/file?key=${ANNA}/sessions/w`)).status).toBe(403);
    expect((await call(`/api/feedback/tester?name=${ANNA}`, { method: 'DELETE' })).status).toBe(
      403,
    );
    expect(kv.store.size).toBe(1);
  });

  it('laat de eigenaar alles ophalen', async () => {
    await put('sessions/w', '{"a":1}');
    const list = await (await call('/api/feedback/list', { code: OWNER_CODE })).json();
    expect(list).toEqual({ keys: [expect.objectContaining({ key: `${ANNA}/sessions/w` })] });

    const file = await call(`/api/feedback/file?key=${ANNA}/sessions/w`, { code: OWNER_CODE });
    expect(file.headers.get('Content-Type')).toBe('application/json');
    expect(await file.text()).toBe('{"a":1}');
    expect((await call('/api/feedback/file?key=bestaat/niet', { code: OWNER_CODE })).status).toBe(
      404,
    );
  });

  it('bewaart alleen de typen die de app stuurt, en laat de browser niet raden', async () => {
    const send = (id: string, type: string) =>
      call(`/api/feedback/audio/${id}`, {
        method: 'PUT',
        body: 'x',
        headers: { 'Content-Type': type },
      });
    await send('opname', 'audio/webm;codecs=opus');
    await send('html', 'text/html');
    expect(kv.store.get(`${ANNA}/audio/opname`)?.metadata).toMatchObject({
      contentType: 'audio/webm;codecs=opus',
    });
    expect(kv.store.get(`${ANNA}/audio/html`)?.metadata).toMatchObject({
      contentType: 'application/octet-stream',
    });
    const file = await call(`/api/feedback/file?key=${ANNA}/audio/html`, { code: OWNER_CODE });
    expect(file.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(file.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('wist alles van één tester, en niets van de anderen', async () => {
    await put('sessions/a', '{}');
    await put('audio/b', 'geluid');
    await put('sessions/c', '{}', PIET_CODE);

    const response = await call(`/api/feedback/tester?name=${ANNA}`, {
      code: OWNER_CODE,
      method: 'DELETE',
    });
    expect(await response.json()).toEqual({ ok: true, deleted: 2 });
    expect([...kv.store.keys()]).toEqual([`${PIET}/sessions/c`]);
  });

  it('weigert een ongeldige naam bij wissen', async () => {
    const response = await call('/api/feedback/tester?name=', {
      code: OWNER_CODE,
      method: 'DELETE',
    });
    expect(response.status).toBe(400);
  });
});

describe('/api/feedback/notes (feedback inzien)', () => {
  function share(id: string, data: object, code = ANNA_CODE) {
    return call(`/api/feedback/sessions/${id}`, {
      code,
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function notes(): Promise<{ id: string; processed: boolean }[]> {
    const response = await call('/api/feedback/notes', { code: OWNER_CODE });
    return ((await response.json()) as { notes: { id: string; processed: boolean }[] }).notes;
  }

  function markProcessed(ids: string[], processed: boolean, code = OWNER_CODE) {
    return call('/api/feedback/processed', {
      code,
      method: 'POST',
      body: JSON.stringify({ ids, processed }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  beforeEach(async () => {
    await share('w1', {
      appVersion: 'abc123',
      sessions: [{ name: 'Waterleidingduinen' }],
      utterances: [
        { id: 'u1', recordedAt: 1000, transcript: 'Twee houtduiven' },
        { id: 'n1', recordedAt: 2000, kind: 'dev_note', transcript: 'Feedback: de kaart is traag' },
      ],
    });
    await share('losse-feedback', {
      sessions: [],
      utterances: [{ id: 'n2', recordedAt: 3000, kind: 'dev_note', transcript: 'Getypt' }],
    });
  });

  it('geeft alle feedback, nieuwste eerst, zonder voorvoegsel', async () => {
    expect(await notes()).toEqual([
      { id: 'n2', tester: ANNA, recordedAt: 3000, text: 'Getypt', processed: false },
      {
        id: 'n1',
        tester: ANNA,
        recordedAt: 2000,
        text: 'de kaart is traag',
        appVersion: 'abc123',
        sessionName: 'Waterleidingduinen',
        processed: false,
      },
    ]);
  });

  it('een kapot gedeeld bestand laat de feedback van anderen staan', async () => {
    await share('kapot-1', { sessions: 5, utterances: 'nee' });
    await share('kapot-2', {
      sessions: [null, 'x'],
      utterances: [null, { id: 7, recordedAt: 'gisteren', kind: 'dev_note' }],
    });
    expect((await notes()).map((n) => n.id)).toEqual(['n2', 'n1']);
    expect((await call('/api/testers', { code: OWNER_CODE })).status).toBe(200);
  });

  it('toont feedback die in twee bestanden staat maar één keer', async () => {
    await share('losse-feedback-a1b2c3d4', {
      sessions: [],
      utterances: [{ id: 'n2', recordedAt: 3000, kind: 'dev_note', transcript: 'Getypt' }],
    });
    expect((await notes()).map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('neemt de gebiedsnaam van de sessie mee', async () => {
    await share('w2', {
      sessions: [{ place: { name: 'Gulperberg' }, startedAt: 4000, endedAt: 5000 }],
      utterances: [{ id: 'n3', recordedAt: 4500, kind: 'dev_note', transcript: 'Feedback: ok' }],
    });
    expect(await notes()).toContainEqual(
      expect.objectContaining({ id: 'n3', sessionName: 'Gulperberg' }),
    );
  });

  it('geeft per installatie de laatste dag met een uitspraak, ook zonder delen', async () => {
    await putInstall(testersKv as never, ANNA_ID, {
      name: ANNA,
      registeredAt: 1000,
      via: 'turnstile',
    });
    const list = async () =>
      (
        (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
          testers: { name: string; lastUsed?: string }[];
        }
      ).testers.find((t) => t.name === ANNA);
    expect((await list())?.lastUsed).toBeUndefined(); // maakt ook de tabel aan
    const insert = (day: string, session: string) =>
      (env.USAGE as ReturnType<typeof memoryD1>)
        .prepare(
          `INSERT INTO usage (day, tester, channel, session, model) VALUES (?, ?, 'beta', ?, 'm')`,
        )
        .bind(day, ANNA, session)
        .run();
    await insert('2026-10-01', 's1');
    await insert('2026-11-03', 's2');
    await insert('2026-11-09', ''); // zonder sessie (testset) telt niet
    expect((await list())?.lastUsed).toBe('2026-11-03');
  });

  it('ruimt ongebruikte installaties op; ze blijven werken en komen terug als ze iets doen', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const install = (id: string, extra: Record<string, unknown> = {}) =>
      putInstall(testersKv as never, id, {
        name: installName(id),
        registeredAt: Date.now() - 3 * DAY,
        via: 'turnstile',
        ...extra,
      });
    const OUD = 'c0000000-0000-4000-8000-00000000000c';
    const NIEUW = 'd0000000-0000-4000-8000-00000000000d';
    const NAAM = 'e0000000-0000-4000-8000-00000000000e';
    await install(ANNA_ID); // spreekt in, zonder delen
    await install(OUD);
    await install(NIEUW, { registeredAt: Date.now() - 60 * 1000 });
    await install(NAAM, { displayName: 'Kees' });
    const names = async () =>
      (
        (await (await call('/api/testers', { code: OWNER_CODE })).json()) as {
          testers: { name: string }[];
        }
      ).testers
        .map((t) => t.name)
        .sort();
    await names(); // maakt de tabel aan
    const spoke = (tester: string) =>
      (env.USAGE as ReturnType<typeof memoryD1>)
        .prepare(
          `INSERT INTO usage (day, tester, channel, session, model) VALUES ('2026-11-03', ?, 'beta', 's1', 'm')`,
        )
        .bind(tester)
        .run();
    await spoke(ANNA);
    const cleanup = () => call('/api/testers?cleanup=1', { code: OWNER_CODE, method: 'POST' });

    // Alleen voor de eigenaar
    expect((await call('/api/testers?cleanup=1', { method: 'POST' })).status).toBe(403);

    expect(await (await cleanup()).json()).toEqual({ cleaned: [installName(OUD)] });
    expect(await names()).toEqual([ANNA, installName(NIEUW), installName(NAAM)].sort());
    // Het token werkt nog
    const token = await signInstallToken(OUD, INSTALL_SECRET);
    expect((await call('/api/ping', { code: token })).status).toBe(200);
    // Tweede keer: niets meer
    expect(await (await cleanup()).json()).toEqual({ cleaned: [] });

    // Komt terug zodra hij iets inspreekt
    await spoke(installName(OUD));
    expect(await names()).toContain(installName(OUD));
  });

  it('ruimt niets op als het verbruik niet te lezen is', async () => {
    await putInstall(testersKv as never, ANNA_ID, {
      name: ANNA,
      registeredAt: 1000,
      via: 'turnstile',
    });
    env.USAGE = {
      prepare: () => {
        throw new Error('D1 weg');
      },
    };
    const response = await call('/api/testers?cleanup=1', { code: OWNER_CODE, method: 'POST' });
    expect(response.ok).toBe(false);
    expect((await getInstall(testersKv as never, ANNA_ID))?.hidden).toBeUndefined();
  });

  it('telt per tester sessies, uitspraken, feedback en de laatste actie', async () => {
    await share('w2', {
      sessions: [{ startedAt: 4000, endedAt: 5000 }],
      utterances: [{ id: 'u2', recordedAt: 4500, transcript: 'Vink' }],
    });
    await putInstall(testersKv as never, ANNA_ID, {
      name: ANNA,
      registeredAt: 1000,
      via: 'turnstile',
    });
    const response = await call('/api/testers', { code: OWNER_CODE });
    const { testers } = (await response.json()) as {
      testers: { name: string; usage?: object }[];
    };
    expect(testers.find((t) => t.name === ANNA)?.usage).toEqual({
      sessions: 2,
      utterances: 2,
      notes: 2,
      lastActivity: 5000,
    });
  });

  it('leest voor de telling alleen de sleutels, oude bestanden zonder telling wel', async () => {
    await putInstall(testersKv as never, ANNA_ID, {
      name: ANNA,
      registeredAt: 1000,
      via: 'turnstile',
    });
    // Gedeeld vóór 25 nov: zonder telling in de metadata
    await kv.put(
      `${ANNA}/sessions/oud`,
      JSON.stringify({
        sessions: [{ startedAt: 6000, endedAt: 7000 }],
        utterances: [
          { id: 'u9', recordedAt: 6500, transcript: 'Merel' },
          { id: 'n9', recordedAt: 6600, kind: 'dev_note', transcript: 'Feedback: oud' },
        ],
      }),
      { metadata: { contentType: 'application/json', uploadedAt: 1, bytes: 1 } },
    );
    expect(kv.store.get(`${ANNA}/sessions/w1`)?.metadata).toMatchObject({
      usage: { sessions: 1, utterances: 1, notes: 1, lastActivity: 2000 },
    });
    const get = vi.spyOn(kv, 'get');
    const response = await call('/api/testers', { code: OWNER_CODE });
    const { testers } = (await response.json()) as {
      testers: { name: string; usage?: object }[];
    };
    expect(testers.find((t) => t.name === ANNA)?.usage).toEqual({
      sessions: 2,
      utterances: 2,
      notes: 3,
      lastActivity: 7000,
    });
    expect(get.mock.calls.map(([key]) => key)).toEqual([`${ANNA}/sessions/oud`]);
  });

  it('onthoudt welke feedback verwerkt is, en kan dat terugdraaien', async () => {
    expect((await markProcessed(['n1', 'n2'], true)).status).toBe(200);
    expect((await notes()).map((n) => n.processed)).toEqual([true, true]);
    await markProcessed(['n2'], false);
    expect((await notes()).map((n) => n.processed)).toEqual([false, true]);
  });

  function remove(ids: unknown[], code = OWNER_CODE) {
    return call('/api/feedback/delete', {
      code,
      method: 'POST',
      body: JSON.stringify({ ids }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('wist feedback van de lijst, ook als de sessie opnieuw gedeeld wordt', async () => {
    await markProcessed(['n1'], true);
    expect((await remove(['n1'])).status).toBe(200);
    expect((await notes()).map((n) => n.id)).toEqual(['n2']);
    await share('w1', {
      sessions: [{ name: 'Waterleidingduinen' }],
      utterances: [{ id: 'n1', recordedAt: 2000, kind: 'dev_note', transcript: 'Feedback: x' }],
    });
    expect((await notes()).map((n) => n.id)).toEqual(['n2']);
  });

  it('is alleen voor de eigenaar', async () => {
    expect((await call('/api/feedback/notes')).status).toBe(403);
    expect((await markProcessed(['n1'], true, ANNA_CODE)).status).toBe(403);
    expect((await remove(['n1'], ANNA_CODE)).status).toBe(403);
    expect((await remove(['../x'])).status).toBe(400);
  });

  it("weigert ongeldige id's", async () => {
    expect((await markProcessed([42 as unknown as string], true)).status).toBe(400);
    expect((await markProcessed(['../x'], true)).status).toBe(400);
  });
});

describe('/api/usage (verbruik)', () => {
  const message = (usage: object) => ({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage,
  });

  function interpret(session?: string) {
    return call('/api/messages', {
      method: 'POST',
      headers: session ? { 'X-Session': session } : {},
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }),
    });
  }

  /** Standaard als Anna; de gpt-4o-modellen alleen voor de eigenaar (testset) */
  function transcribe(model: string, session = 'sessie-1', code = ANNA_CODE) {
    const form = new FormData();
    form.set('audio', new File([new Uint8Array(100)], 'opname.webm', { type: 'audio/webm' }));
    form.set('model', model);
    return call('/api/transcribe', {
      method: 'POST',
      headers: { 'X-Session': session },
      body: form,
      code,
    });
  }

  async function rows() {
    const response = await call('/api/usage?from=2000-01-01', { code: OWNER_CODE });
    expect(response.status).toBe(200);
    return ((await response.json()) as { rows: Record<string, unknown>[] }).rows;
  }

  it('telt de tokens van Anthropic op per tester, sessie en model', async () => {
    upstream.mockImplementation(async () =>
      Response.json(
        message({
          input_tokens: 100,
          output_tokens: 20,
          cache_creation_input_tokens: 5000,
          cache_read_input_tokens: 0,
        }),
      ),
    );
    await interpret('sessie-1');
    upstream.mockImplementation(async () =>
      Response.json(
        message({
          input_tokens: 110,
          output_tokens: 30,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 5000,
        }),
      ),
    );
    await interpret('sessie-1');
    await interpret('sessie-2');

    expect(await rows()).toEqual([
      expect.objectContaining({
        tester: ANNA,
        channel: 'beta',
        session: 'sessie-1',
        model: 'claude-haiku-5-5',
        requests: 2,
        inputTokens: 210,
        outputTokens: 50,
        cacheWriteTokens: 5000,
        cacheReadTokens: 5000,
        audioSeconds: 0,
      }),
      expect.objectContaining({ session: 'sessie-2', requests: 1 }),
    ]);
    expect((await rows())[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('telt tokens bij gpt-4o-transcribe en seconden bij whisper-1 en gpt-transcribe', async () => {
    upstream.mockImplementation(async () =>
      Response.json({
        text: 'vink',
        usage: { type: 'tokens', input_tokens: 80, output_tokens: 3, total_tokens: 83 },
      }),
    );
    await transcribe('gpt-4o-transcribe', 'sessie-1', OWNER_CODE);
    upstream.mockImplementation(async () =>
      Response.json({ text: 'vink', usage: { type: 'duration', seconds: 4 } }),
    );
    await transcribe('whisper-1', 'sessie-1', OWNER_CODE);
    await transcribe('gpt-transcribe', 'sessie-1', OWNER_CODE);

    expect(await rows()).toEqual([
      expect.objectContaining({ model: 'gpt-4o-transcribe', inputTokens: 80, outputTokens: 3 }),
      expect.objectContaining({ model: 'gpt-transcribe', audioSeconds: 4, inputTokens: 0 }),
      expect.objectContaining({ model: 'whisper-1', audioSeconds: 4, inputTokens: 0 }),
    ]);
  });

  it('telt een ongeldig of ontbrekend sessie-id als "geen sessie"', async () => {
    upstream.mockImplementation(async () =>
      Response.json(message({ input_tokens: 1, output_tokens: 1 })),
    );
    await interpret();
    await interpret('../../iets anders');
    expect(await rows()).toEqual([expect.objectContaining({ session: '', requests: 2 })]);
  });

  it('telt per soort uitspraak, versie en taal, alleen met bekende waarden', async () => {
    upstream.mockImplementation(async () =>
      Response.json(message({ input_tokens: 1, output_tokens: 1 })),
    );
    const send = (headers: Record<string, string>) =>
      call('/api/messages', {
        method: 'POST',
        headers: { 'X-Session': 'sessie-1', ...headers },
        body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }),
      });
    await send({ 'X-Kind': 'trektel', 'X-App-Version': 'a1b2c3d', 'X-Language': 'en' });
    await send({ 'X-Kind': 'trektel', 'X-App-Version': 'a1b2c3d', 'X-Language': 'en' });
    await send({ 'X-Kind': '<script>', 'X-App-Version': 'x'.repeat(40), 'X-Language': 'fr' });
    const result = await rows();
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(
      expect.objectContaining({ kind: 'trektel', version: 'a1b2c3d', language: 'en', requests: 2 }),
    );
    expect(result).toContainEqual(
      expect.objectContaining({ kind: '', version: '', language: '', requests: 1 }),
    );
  });

  it('telt niets als OpenAI of Anthropic een fout geeft', async () => {
    upstream.mockResolvedValue(Response.json({ error: { message: 'kapot' } }, { status: 500 }));
    await transcribe('gpt-transcribe');
    expect(await rows()).toEqual([]);
  });

  it('laat de uitspraak niet mislukken als tellen niet lukt', async () => {
    env.USAGE = {
      prepare: () => {
        throw new Error('D1 ligt eruit');
      },
    };
    upstream.mockResolvedValue(Response.json({ text: 'vink' }));
    // Ook het plafond is dan niet na te gaan: toch doorlaten
    expect((await transcribe('gpt-transcribe')).status).toBe(200);
  });

  it('geeft alleen regels vanaf de gevraagde datum', async () => {
    upstream.mockImplementation(async () =>
      Response.json(message({ input_tokens: 1, output_tokens: 1 })),
    );
    await interpret('sessie-1');
    const response = await call('/api/usage?from=2999-01-01', { code: OWNER_CODE });
    expect(await response.json()).toEqual({ rows: [] });
  });

  it('is alleen voor de eigenaar, met een geldige datum', async () => {
    expect((await call('/api/usage?from=2026-10-01')).status).toBe(403);
    expect((await call('/api/usage?from=gisteren', { code: OWNER_CODE })).status).toBe(400);
  });
});

describe('/api/stats (gebruik per dag)', () => {
  function transcribe(session?: string) {
    const form = new FormData();
    form.set('audio', new File([new Uint8Array(100)], 'opname.webm', { type: 'audio/webm' }));
    form.set('model', 'gpt-transcribe');
    return call('/api/transcribe', {
      method: 'POST',
      headers: session ? { 'X-Session': session } : {},
      body: form,
    });
  }

  it('telt sessies en uitspraken per dag en tester, zonder de testset', async () => {
    upstream.mockImplementation(async () =>
      Response.json({ text: 'vink', usage: { type: 'duration', seconds: 2 } }),
    );
    await transcribe('sessie-1');
    await transcribe('sessie-1');
    await transcribe('sessie-2');
    await transcribe();
    upstream.mockImplementation(async () =>
      Response.json({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    await call('/api/messages', {
      method: 'POST',
      headers: { 'X-Session': 'sessie-1' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] }),
    });

    const response = await call('/api/stats?from=2000-01-01', { code: OWNER_CODE });
    expect(await response.json()).toEqual({
      rows: [
        {
          day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          tester: ANNA,
          sessions: 2,
          utterances: 3,
        },
      ],
    });
  });

  it('is alleen voor de eigenaar, met een geldige datum', async () => {
    expect((await call('/api/stats?from=2026-10-01')).status).toBe(403);
    expect((await call('/api/stats?from=gisteren', { code: OWNER_CODE })).status).toBe(400);
  });
});

describe('/api/billing (echte rekening)', () => {
  beforeEach(() => {
    env.OPENAI_ADMIN_KEY = 'sk-admin-openai';
    env.ANTHROPIC_ADMIN_KEY = 'sk-ant-admin01-geheim';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000;

  /** OpenAI in dollars, Anthropic in centen als tekst; Anthropic in twee pagina's. */
  function bills() {
    upstream.mockImplementation(async (url) => {
      const { origin, pathname, searchParams } = new URL(url);
      if (origin === 'https://api.openai.com' && pathname === '/v1/organization/costs') {
        return Response.json({
          object: 'page',
          data: [
            {
              start_time: day('2026-10-23'),
              results: [{ amount: { value: 0.25, currency: 'usd' } }],
            },
            {
              start_time: day('2026-10-24'),
              results: [
                { amount: { value: 0.5, currency: 'usd' } },
                { amount: { value: 0.25, currency: 'usd' } },
              ],
            },
          ],
          has_more: false,
          next_page: null,
        });
      }
      if (origin === 'https://api.anthropic.com' && pathname === '/v1/organizations/cost_report') {
        const first = !searchParams.has('page');
        return Response.json({
          data: [
            {
              starting_at: first ? '2026-10-23T00:00:00Z' : '2026-10-24T00:00:00Z',
              results: [{ amount: first ? '150.5' : '20', currency: 'USD' }],
            },
          ],
          has_more: first,
          next_page: first ? 'page_2' : null,
        });
      }
      throw new Error(`onverwacht verzoek naar ${url}`);
    });
  }

  async function billing() {
    const response = await call('/api/billing', { code: OWNER_CODE });
    expect(response.status).toBe(200);
    return (await response.json()) as Record<string, { days?: object; error?: string } | null>;
  }

  it('telt de rekening van deze maand per dag op, in dollars', async () => {
    bills();
    const { openai, anthropic } = await billing();
    expect(openai).toMatchObject({
      month: '2026-10',
      days: { '2026-10-23': 0.25, '2026-10-24': 0.75 },
    });
    expect(anthropic).toMatchObject({ days: { '2026-10-23': 1.505, '2026-10-24': 0.2 } });

    const [openaiUrl, openaiInit] = upstream.mock.calls[0];
    expect(new URL(openaiUrl).searchParams.get('start_time')).toBe(String(day('2026-10-01')));
    expect(new Headers(openaiInit?.headers).get('Authorization')).toBe('Bearer sk-admin-openai');
    const anthropicCalls = upstream.mock.calls.filter(([url]) => url.includes('anthropic'));
    expect(anthropicCalls).toHaveLength(2);
    expect(new URL(anthropicCalls[0][0]).searchParams.get('starting_at')).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(new URL(anthropicCalls[1][0]).searchParams.get('page')).toBe('page_2');
    expect(new Headers(anthropicCalls[0][1]?.headers).get('x-api-key')).toBe(
      'sk-ant-admin01-geheim',
    );
  });

  it('bewaart de rekening een uur', async () => {
    bills();
    await billing();
    const calls = upstream.mock.calls.length;
    vi.setSystemTime(new Date('2026-10-24T12:59:00Z'));
    await billing();
    expect(upstream.mock.calls.length).toBe(calls);
    vi.setSystemTime(new Date('2026-10-24T13:01:00Z'));
    await billing();
    expect(upstream.mock.calls.length).toBe(calls * 2);
  });

  it('haalt hem in een nieuwe maand opnieuw op', async () => {
    bills();
    await billing();
    const calls = upstream.mock.calls.length;
    vi.setSystemTime(new Date('2026-11-01T00:10:00Z'));
    await billing();
    expect(upstream.mock.calls.length).toBe(calls * 2);
  });

  it('slaat een aanbieder zonder beheersleutel over', async () => {
    delete env.ANTHROPIC_ADMIN_KEY;
    bills();
    const { anthropic } = await billing();
    expect(anthropic).toBeNull();
    expect(upstream.mock.calls.every(([url]) => !url.includes('anthropic'))).toBe(true);
  });

  it('geeft de fout van een aanbieder door, en bewaart die niet', async () => {
    upstream.mockImplementation(async (url) =>
      url.includes('anthropic')
        ? Response.json(
            { type: 'error', error: { type: 'permission_error', message: 'Geen organisatie' } },
            { status: 403 },
          )
        : Response.json({ data: [], has_more: false, next_page: null }),
    );
    const { openai, anthropic } = await billing();
    expect(openai).toMatchObject({ days: {} });
    expect(anthropic).toEqual({ error: 'Anthropic 403: Geen organisatie' });
    expect(testersKv.store.has('billing/anthropic/')).toBe(false);
  });

  /** OpenAI weigert met 429, zoals bij meer dan 10 verzoeken per minuut. */
  function openaiBusy() {
    upstream.mockImplementation(async (url) =>
      url.includes('openai')
        ? Response.json({ error: { message: 'Rate limit, please slow down' } }, { status: 429 })
        : Response.json({ data: [], has_more: false, next_page: null }),
    );
  }
  const openaiCalls = () => upstream.mock.calls.filter(([url]) => url.includes('openai')).length;

  it('geeft na een fout de laatst bekende rekening van deze maand, met de fout erbij', async () => {
    bills();
    await billing();
    vi.setSystemTime(new Date('2026-10-24T14:00:00Z'));
    openaiBusy();
    const { openai } = await billing();
    expect(openai).toMatchObject({
      days: { '2026-10-23': 0.25, '2026-10-24': 0.75 },
      fetchedAt: Date.parse('2026-10-24T12:00:00Z'),
      stale: 'OpenAI 429: Rate limit, please slow down',
    });
  });

  it('probeert het na een fout pas na een minuut opnieuw', async () => {
    openaiBusy();
    expect((await billing()).openai).toEqual({ error: 'OpenAI 429: Rate limit, please slow down' });
    expect(openaiCalls()).toBe(1);
    vi.setSystemTime(new Date('2026-10-24T12:00:50Z'));
    expect((await billing()).openai).toEqual({ error: 'OpenAI 429: Rate limit, please slow down' });
    expect(openaiCalls()).toBe(1);
    bills();
    vi.setSystemTime(new Date('2026-10-24T12:01:01Z'));
    expect((await billing()).openai).toMatchObject({ days: { '2026-10-24': 0.75 } });
    expect(openaiCalls()).toBe(2);
  });

  it('geeft in een nieuwe maand niet de rekening van de vorige', async () => {
    bills();
    await billing();
    vi.setSystemTime(new Date('2026-11-01T00:10:00Z'));
    openaiBusy();
    expect((await billing()).openai).toEqual({ error: 'OpenAI 429: Rate limit, please slow down' });
  });

  it('telt alleen het project en de workspace van Fluistervink', async () => {
    env.OPENAI_PROJECT_ID = 'proj_fluistervink';
    env.ANTHROPIC_WORKSPACE_ID = 'wrkspc_fluistervink';
    upstream.mockImplementation(async (url) =>
      url.includes('anthropic')
        ? Response.json({
            data: [
              {
                starting_at: '2026-10-24T00:00:00Z',
                results: [
                  { amount: '100', currency: 'USD', workspace_id: 'wrkspc_fluistervink' },
                  { amount: '900', currency: 'USD', workspace_id: 'wrkspc_masterstock' },
                  { amount: '500', currency: 'USD', workspace_id: null },
                ],
              },
            ],
            has_more: false,
            next_page: null,
          })
        : Response.json({ data: [], has_more: false, next_page: null }),
    );
    const { anthropic } = await billing();
    expect(anthropic).toMatchObject({ days: { '2026-10-24': 1 } });
    const [openaiUrl] = upstream.mock.calls.find(([url]) => url.includes('openai'))!;
    expect(new URL(openaiUrl).searchParams.get('project_ids')).toBe('proj_fluistervink');
    const [anthropicUrl] = upstream.mock.calls.find(([url]) => url.includes('anthropic'))!;
    expect(new URL(anthropicUrl).searchParams.get('group_by[]')).toBe('workspace_id');
  });

  it('is alleen voor de eigenaar', async () => {
    expect((await call('/api/billing')).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('bewaartermijn van het verbruik', () => {
  it('houdt 13 maanden per installatie', () => {
    expect(keepFrom(new Date('2027-12-15T12:00:00Z'))).toBe('2026-11-01');
  });

  it('vat oudere regels per week samen, zonder installatie, en wist ze', async () => {
    const db = memoryD1() as never;
    const key = (tester: string) => ({
      tester,
      channel: 'stable',
      session: 's',
      model: 'gpt-transcribe',
    });
    // Vrijdag 2 en zaterdag 3 oktober 2026: dezelfde week (maandag 28 sep)
    await recordUsage(db, key('anna'), { audioSeconds: 60 }, new Date('2026-10-02T12:00:00Z'));
    await recordUsage(db, key('bert'), { audioSeconds: 30 }, new Date('2026-10-03T12:00:00Z'));
    await recordUsage(db, key('anna'), { audioSeconds: 10 }, new Date('2027-11-20T12:00:00Z'));

    expect(await pruneUsage(db, new Date('2027-12-15T12:00:00Z'))).toBe(2);
    expect((await usageSince(db, '2000-01-01')).map((r) => r.day)).toEqual(['2027-11-20']);
    const { results } = await (db as ReturnType<typeof memoryD1>)
      .prepare('SELECT * FROM usage_weekly')
      .all();
    expect(results).toEqual([
      expect.objectContaining({ week: '2026-09-28', testers: 2, requests: 2, audio_seconds: 90 }),
    ]);
    // Nog een keer: niets meer te doen
    expect(await pruneUsage(db, new Date('2027-12-15T12:00:00Z'))).toBe(0);
  });
});

describe('elke nacht opruimen (scheduled)', () => {
  it('vat oud verbruik samen en haalt oude tellers van de grenzen weg', async () => {
    const db = env.USAGE as ReturnType<typeof memoryD1>;
    const now = new Date('2027-12-15T03:17:00Z');
    const key = { tester: 'anna', channel: 'stable', session: 's', model: 'gpt-transcribe' };
    await recordUsage(db as never, key, { audioSeconds: 60 }, new Date('2026-10-02T12:00:00Z'));
    await recordUsage(db as never, key, { audioSeconds: 10 }, new Date('2027-12-14T12:00:00Z'));
    await setGuardCount('install', 3);
    await db
      .prepare('INSERT INTO guard_counts (day, key, n) VALUES (?, ?, ?)')
      .bind('2027-12-01', `share:${PIET}`, 7)
      .run();

    const pending: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: now.getTime(), cron: '17 3 * * *', noRetry() {} } as never,
      env as never,
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as never,
    );
    await Promise.all(pending);

    expect((await usageSince(db as never, '2000-01-01')).map((r) => r.day)).toEqual(['2027-12-14']);
    const weekly = await db.prepare('SELECT week FROM usage_weekly').all();
    expect(weekly.results).toEqual([{ week: '2026-09-28' }]);
    const { results } = await db.prepare('SELECT day FROM guard_counts').all();
    expect(results).toEqual([]);
  });

  it('een fout in de database komt in het log, niet als onafgehandelde fout', async () => {
    env.USAGE = {
      prepare: () => {
        throw new Error('D1 weg');
      },
    };
    const pending: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: Date.now(), cron: '17 3 * * *', noRetry() {} } as never,
      env as never,
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as never,
    );
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(console.error).toHaveBeenCalledWith('Opruimen mislukt', expect.any(Error));
  });
});

describe('usage-tabel van vóór 23 nov (beta en stable delen de database)', () => {
  it('laat de oude tabel staan, telt hem mee, en de oude code kan er nog in schrijven', async () => {
    const db = memoryD1();
    db.exec(`CREATE TABLE usage (
      day TEXT NOT NULL, tester TEXT NOT NULL, channel TEXT NOT NULL, session TEXT NOT NULL,
      model TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      audio_seconds REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (day, tester, channel, session, model))`);
    const at = new Date('2026-11-23T12:00:00Z');
    const key = { tester: 'anna', channel: 'stable', session: 's', model: 'gpt-transcribe' };
    await recordUsage(
      db as never,
      { ...key, kind: 'knop', version: 'abc1234', language: 'nl' },
      { audioSeconds: 30 },
      at,
    );
    // Zo schrijft de code van stable (van vóór deze wijziging)
    db.exec(`INSERT INTO usage (day, tester, channel, session, model, requests, audio_seconds)
      VALUES ('2026-11-23', 'anna', 'stable', 's', 'gpt-transcribe', 1, 60)
      ON CONFLICT (day, tester, channel, session, model) DO UPDATE SET
        requests = requests + 1, audio_seconds = audio_seconds + excluded.audio_seconds`);

    const all = await usageSince(db as never, '2000-01-01');
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(
      expect.objectContaining({ kind: '', requests: 1, audioSeconds: 60 }),
    );
    expect(all).toContainEqual(
      expect.objectContaining({ kind: 'knop', version: 'abc1234', requests: 1, audioSeconds: 30 }),
    );
  });
});

describe('/api/summaries (anonieme cijfers per sessie)', () => {
  const summary = {
    minutes: 60,
    utterances: 10,
    observations: 8,
    species: 5,
    uncertain: 1,
    notUnderstood: 1,
    corrections: 1,
    failed: 0,
    reviewed: 8,
    offline: false,
    trektel: false,
    tuintelling: false,
    exported: 'waarneming',
    platform: 'android',
  };
  const post = (body: unknown, code?: string) =>
    call('/api/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...(code ? { code } : {}),
    });
  const list = async () =>
    (
      (await (await call('/api/summaries?from=2000-01-01', { code: OWNER_CODE })).json()) as {
        rows: Record<string, unknown>[];
      }
    ).rows;

  it('bewaart zonder installatie, alleen met de week waarin die begon', async () => {
    await putInstall(testersKv as never, ANNA_ID, {
      name: ANNA,
      // Woensdag 11 november 2026
      registeredAt: Date.parse('2026-11-11T12:00:00Z'),
      via: 'play',
    });
    const log = vi.spyOn(console, 'log');
    const response = await post(summary);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stored: true });
    const rows = await list();
    expect(rows).toEqual([
      expect.objectContaining({ ...summary, cohort: '2026-11-09', week: expect.any(String) }),
    ]);
    expect(JSON.stringify(rows)).not.toContain(ANNA);
    // Ook het log koppelt de cijfers niet aan de installatie
    expect(log.mock.calls.flat().some((c) => JSON.stringify(c).includes('/api/summaries'))).toBe(
      false,
    );
    log.mockRestore();
  });

  it('weigert onbekende velden, vrije tekst en onzinwaarden', async () => {
    for (const body of [
      { ...summary, note: 'hallo' },
      { ...summary, exported: 'ergens' },
      { ...summary, minutes: -5 },
      { ...summary, utterances: 1.5 },
      { ...summary, offline: 'ja' },
      { ...summary, platform: undefined },
      { ...summary, platform: 'windows' },
      [summary],
      'tekst',
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(await list()).toEqual([]);
  });

  it('neemt ook sessies uit de iOS-app aan', async () => {
    expect((await post({ ...summary, platform: 'ios' })).status).toBe(200);
    expect(await list()).toEqual([expect.objectContaining({ platform: 'ios' })]);
  });

  it('bewaart niets van de eigenaar, en alleen de eigenaar kan ophalen', async () => {
    expect(await (await post(summary, OWNER_CODE)).json()).toEqual({ ok: true, stored: false });
    expect(await list()).toEqual([]);
    expect((await call('/api/summaries?from=2000-01-01')).status).toBe(403);
  });
});

describe('noodrem en grenzen voor alle installaties samen (guard.ts)', () => {
  const message = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
  const body = JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 10, messages: [] });
  const ask = (code?: string) =>
    call('/api/messages', { method: 'POST', body, ...(code && { code }) });

  it('noodrem: alleen de eigenaar zet hem, daarna wacht iedereen behalve de eigenaar', async () => {
    expect((await call('/api/guard')).status).toBe(403);
    expect(
      (await call('/api/guard', { method: 'PUT', body: JSON.stringify({ paused: true }) })).status,
    ).toBe(403);

    const on = await call('/api/guard', {
      code: OWNER_CODE,
      method: 'PUT',
      body: JSON.stringify({ paused: true }),
    });
    expect(await on.json()).toMatchObject({ paused: true });

    const anna = await ask();
    expect(anna.status).toBe(503);
    expect(await anna.json()).toMatchObject({ code: 'paused' });
    const share = await call('/api/feedback/sessions/abc', { method: 'PUT', body: '{"a":1}' });
    expect(share.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
    expect(kv.store.size).toBe(0);

    upstream.mockImplementation(async () => Response.json(message));
    expect((await ask(OWNER_CODE)).status).toBe(200);

    await call('/api/guard', {
      code: OWNER_CODE,
      method: 'PUT',
      body: JSON.stringify({ paused: false }),
    });
    expect((await ask()).status).toBe(200);
  });

  it('plafond per dag voor alle installaties samen, zonder de eigenaar', async () => {
    upstream.mockImplementation(async () => Response.json(message));
    const usage = (tester: string) =>
      recordUsage(
        env.USAGE as never,
        { tester, channel: 'stable', session: 's', model: 'claude-haiku-5-5' },
        // $10 aan Haiku (invoer $0,10 per miljoen tokens)
        { inputTokens: 100_000_000 },
      );
    // Wat de eigenaar verbruikt (testset), telt niet mee; de installatie van
    // Piet wel. (Apart, want een instantie onthoudt de kosten een halve minuut.)
    await usage('eigenaar');
    await usage(PIET);
    const anna = await ask();
    expect(anna.status).toBe(503);
    expect(await anna.json()).toMatchObject({ code: 'budget' });
    // De eigenaar blijft door kunnen
    expect((await ask(OWNER_CODE)).status).toBe(200);

    const status = await call('/api/guard', { code: OWNER_CODE });
    expect(await status.json()).toMatchObject({ paused: false, costToday: 10, budget: 5 });
  });

  it('telt het verbruik van de eigenaar niet mee', async () => {
    upstream.mockImplementation(async () => Response.json(message));
    await recordUsage(
      env.USAGE as never,
      { tester: 'eigenaar', channel: 'stable', session: 's', model: 'claude-haiku-5-5' },
      { inputTokens: 100_000_000 },
    );
    expect((await ask()).status).toBe(200);
  });

  it('een ander plafond met DAILY_BUDGET_USD', async () => {
    upstream.mockImplementation(async () => Response.json(message));
    env.DAILY_BUDGET_USD = '20';
    await recordUsage(
      env.USAGE as never,
      { tester: PIET, channel: 'stable', session: 's', model: 'claude-haiku-5-5' },
      { inputTokens: 100_000_000 },
    );
    expect((await ask()).status).toBe(200);
  });

  it('ruimt tellers van vóór gisteren op', async () => {
    await setGuardCount(`share:${ANNA}`, 5);
    const db = env.USAGE as ReturnType<typeof memoryD1>;
    await db
      .prepare('INSERT INTO guard_counts (day, key, n) VALUES (?, ?, ?)')
      .bind('2000-01-01', `share:${PIET}`, 7)
      .run();
    await call('/api/guard', { code: OWNER_CODE });
    const { results } = await db.prepare('SELECT key FROM guard_counts').all();
    expect(results).toEqual([{ key: `share:${ANNA}` }]);
  });

  describe('waarschuwing aan de eigenaar (alert.ts)', () => {
    const WEBHOOK = 'https://discord.test/api/webhooks/1/geheim';
    const posts = () =>
      upstream.mock.calls
        .filter(([url]) => url === WEBHOOK)
        .map(([, init]) => JSON.parse(String(init?.body)).content as string);
    const spend = (dollars: number) =>
      recordUsage(
        env.USAGE as never,
        { tester: PIET, channel: 'stable', session: 's', model: 'claude-haiku-5-5' },
        // Haiku-invoer kost $0,10 per miljoen tokens
        { inputTokens: dollars * 10_000_000 },
      );

    beforeEach(() => {
      env.ALERT_WEBHOOK = WEBHOOK;
      upstream.mockImplementation(async (url) =>
        url === WEBHOOK ? new Response(null, { status: 204 }) : Response.json(message),
      );
    });

    it('budget bereikt: één bericht per dag, zonder installatie', async () => {
      await spend(10);
      expect((await ask()).status).toBe(503);
      expect((await ask(PIET_CODE)).status).toBe(503);
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toMatch(
        /^Fluistervink \(beta\): Dagbudget bereikt \(\$10\.00 van \$5\.00\)/,
      );
      expect(posts()[0]).not.toContain(ANNA);
      expect(posts()[0]).not.toContain(PIET);
    });

    it('een andere instantie stuurt hem niet nog eens (KV)', async () => {
      await spend(10);
      await ask();
      const day = dayOf(new Date());
      expect(await testersKv.get(`alert/${day}/budget`)).not.toBeNull();
      // Zelfde KV-inhoud, maar als een verse instantie: andere KV-binding
      const fresh = memoryKv();
      for (const [key, entry] of testersKv.store) fresh.store.set(key, entry);
      env.TESTERS = fresh;
      await ask();
      expect(posts()).toHaveLength(1);
    });

    it('bij 80% een eerste waarschuwing, en het verzoek gaat gewoon door', async () => {
      await spend(4.5);
      expect((await ask()).status).toBe(200);
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toContain('$4.50 van het dagbudget van $5.00 is op');
    });

    it('onder 80% geen bericht', async () => {
      await spend(3);
      expect((await ask()).status).toBe(200);
      expect(posts()).toEqual([]);
    });

    it('zonder ALERT_WEBHOOK alleen het log', async () => {
      delete env.ALERT_WEBHOOK;
      await spend(10);
      expect((await ask()).status).toBe(503);
      expect(posts()).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Dagbudget bereikt'));
    });

    it('een webhook die faalt, laat het verzoek niet mislukken', async () => {
      upstream.mockImplementation(async (url) => {
        if (url === WEBHOOK) throw new Error('geen bereik');
        return Response.json(message);
      });
      await spend(4.5);
      expect((await ask()).status).toBe(200);
    });

    it('grens voor nieuwe installaties', async () => {
      await setGuardCount('install', NEW_INSTALLS_PER_DAY);
      const id = 'c0000000-0000-4000-8000-0000000000c1';
      env.TURNSTILE_SECRET = 'turnstile';
      upstream.mockImplementation(async (url) =>
        url === WEBHOOK
          ? new Response(null, { status: 204 })
          : Response.json({ success: true, action: 'install' }),
      );
      const response = await call('/api/install', {
        code: null,
        method: 'POST',
        body: JSON.stringify({ id, turnstile: 'bewijs' }),
      });
      expect(response.status).toBe(503);
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toContain('Grens voor nieuwe installaties bereikt');
    });

    it('delen: alleen bij de grens voor iedereen, niet bij één installatie', async () => {
      await setGuardCount(`share:${ANNA}`, SHARED_BYTES_PER_INSTALL_PER_DAY);
      await call('/api/feedback/sessions/abc', { method: 'PUT', body: '{"a":1}' });
      expect(posts()).toEqual([]);
      await setGuardCount('share', SHARED_BYTES_PER_DAY);
      await call('/api/feedback/sessions/abc', { code: PIET_CODE, method: 'PUT', body: '{"a":1}' });
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toContain('delen van alle installaties samen');
    });

    it('Anthropic: tegoed op geeft een bericht, gewone drukte niet', async () => {
      upstream.mockImplementation(async (url) => {
        if (url === WEBHOOK) return new Response(null, { status: 204 });
        return Response.json(
          { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
          { status: 529 },
        );
      });
      await ask();
      expect(posts()).toEqual([]);
      upstream.mockImplementation(async (url) => {
        if (url === WEBHOOK) return new Response(null, { status: 204 });
        return Response.json(
          {
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message: 'Your credit balance is too low to access the Anthropic API.',
            },
          },
          { status: 400 },
        );
      });
      await ask();
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toContain('Anthropic weigert de sleutel of het tegoed is op (400)');
    });

    it('OpenAI: insufficient_quota geeft een bericht', async () => {
      upstream.mockImplementation(async (url) => {
        if (url === WEBHOOK) return new Response(null, { status: 204 });
        return Response.json(
          { error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } },
          { status: 429 },
        );
      });
      const form = new FormData();
      form.set('audio', new File([new Uint8Array(10)], 'a.webm', { type: 'audio/webm' }));
      form.set('model', 'gpt-transcribe');
      form.set('language', 'nl');
      await call('/api/transcribe', { method: 'POST', body: form });
      expect(posts()).toHaveLength(1);
      expect(posts()[0]).toContain(
        'OpenAI weigert de sleutel of het tegoed is op (429, insufficient_quota)',
      );
    });
  });

  it('delen: boven de grens per installatie per dag wacht het, en wordt niets bewaard', async () => {
    await setGuardCount(`share:${ANNA}`, SHARED_BYTES_PER_INSTALL_PER_DAY);
    const anna = await call('/api/feedback/sessions/abc', { method: 'PUT', body: '{"a":1}' });
    expect(anna.status).toBe(503);
    expect(await anna.json()).toMatchObject({ code: 'share_limit' });
    expect(kv.store.size).toBe(0);
    // Een ander mag nog
    const piet = await call('/api/feedback/sessions/abc', {
      code: PIET_CODE,
      method: 'PUT',
      body: '{"a":1}',
    });
    expect(piet.status).toBe(200);
  });
});
