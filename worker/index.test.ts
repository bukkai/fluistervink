// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { integrityNonce } from './install';

// De proxy in Node, met een nep-KV in het geheugen, D1 als SQLite in het
// geheugen (zodat de echte SQL getest wordt) en een nagebootste fetch
// naar OpenAI, Anthropic en waarneming.nl: er gaat nooit iets naar buiten.
// (Cloudflare's eigen testomgeving, vitest-pool-workers, werkt nog niet met
// Vitest 5.)

const OWNER_CODE = 'code-van-de-eigenaar';
const ANNA_CODE = 'code-van-anna';

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
  const store = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  return {
    store,
    async put(key: string, value: ArrayBuffer | string, options?: { metadata?: unknown }) {
      const bytes =
        typeof value === 'string' ? (new TextEncoder().encode(value).buffer as ArrayBuffer) : value;
      store.set(key, { value: bytes, metadata: options?.metadata });
    },
    async get(key: string, type?: string) {
      const entry = store.get(key);
      if (!entry) return null;
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
  return { prepare: (sql: string) => statement(sql) };
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
    ACCESS_CODES: JSON.stringify({ anna: ANNA_CODE }),
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

  it('herkent de eigenaar en de testers', async () => {
    expect(await (await call('/api/ping', { code: OWNER_CODE })).json()).toEqual({
      ok: true,
      tester: 'eigenaar',
    });
    expect(await (await call('/api/ping')).json()).toEqual({ ok: true, tester: 'anna' });
  });

  it('laat een tester met de naam "eigenaar" niet binnen', async () => {
    env.ACCESS_CODES = JSON.stringify({ eigenaar: 'nep-eigenaar' });
    expect((await call('/api/ping', { code: 'nep-eigenaar' })).status).toBe(401);
  });

  it('blijft werken voor de eigenaar als ACCESS_CODES kapot is', async () => {
    env.ACCESS_CODES = '{kapot';
    expect((await call('/api/ping', { code: OWNER_CODE })).status).toBe(200);
    expect((await call('/api/ping')).status).toBe(401);
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
    expect(limited.counts.get('anna')).toBe(1);
    // De eigenaar komt wel door (hier tot de controle van het verzoek zelf)
    const owner = await call('/api/messages', { code: OWNER_CODE, method: 'POST', body: '{}' });
    expect(owner.status).toBe(400);
    expect(limited.counts.has('eigenaar')).toBe(false);
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
    env.INSTALL_SECRET = 'geheim-voor-tokens';
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

  it('rekent dezelfde nonce uit als de app (zelfde waarde in src/lib/install.test.ts)', () => {
    expect(integrityNonce(ID)).toBe('M2Y5YTJiMWMtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAx');
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

  it('weigert een ongeldig id', async () => {
    expect((await register({ id: 'eigenaar', turnstile: 'goed' })).status).toBe(400);
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
    // Een tester met code heeft al een naam
    expect((await setName('Piet', ANNA_CODE)).status).toBe(403);

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

  it('laat geen tester aanmaken met een naam als een installatie', async () => {
    const response = await call('/api/testers', {
      code: OWNER_CODE,
      method: 'POST',
      body: JSON.stringify({ name: 'app-3f9a2b1c' }),
    });
    expect(response.status).toBe(400);
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
          nonce: Buffer.from(ID).toString('base64url'),
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
  function post(fields: Record<string, string | Blob>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return call('/api/transcribe', { method: 'POST', body: form });
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
      model: 'gpt-4o-transcribe',
    });

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sk-openai-geheim');
    const sent = init?.body as FormData;
    expect(sent.get('language')).toBe('nl');
    expect(sent.get('prompt')).toBe('Houtduif, Vink');
    expect(sent.get('model')).toBe('gpt-4o-transcribe');
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

  it('bewaart een wandeling onder de naam van de tester', async () => {
    expect((await put('sessions/wandeling-1', '{"ok":true}')).status).toBe(200);
    const entry = kv.store.get('anna/sessions/wandeling-1');
    expect(new TextDecoder().decode(entry?.value)).toBe('{"ok":true}');
    expect(entry?.metadata).toMatchObject({ contentType: 'application/json', bytes: 11 });
  });

  it('weigert een ongeldige id (ook pogingen om buiten de eigen map te schrijven)', async () => {
    expect((await put('sessions/..%2Fpiet%2Fx', 'x')).status).toBe(400);
    expect((await put('sessions/met spatie', 'x')).status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it('weigert een lege of te grote wandeling', async () => {
    expect((await put('sessions/leeg', '')).status).toBe(400);
    expect((await put('sessions/groot', new Uint8Array(5 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it('laat een tester niets lezen of wissen', async () => {
    await put('sessions/w', '{}');
    expect((await call('/api/feedback/list')).status).toBe(403);
    expect((await call('/api/feedback/file?key=anna/sessions/w')).status).toBe(403);
    expect((await call('/api/feedback/tester?name=anna', { method: 'DELETE' })).status).toBe(403);
    expect(kv.store.size).toBe(1);
  });

  it('laat de eigenaar alles ophalen', async () => {
    await put('sessions/w', '{"a":1}');
    const list = await (await call('/api/feedback/list', { code: OWNER_CODE })).json();
    expect(list).toEqual({ keys: [expect.objectContaining({ key: 'anna/sessions/w' })] });

    const file = await call('/api/feedback/file?key=anna/sessions/w', { code: OWNER_CODE });
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
    expect(kv.store.get('anna/audio/opname')?.metadata).toMatchObject({
      contentType: 'audio/webm;codecs=opus',
    });
    expect(kv.store.get('anna/audio/html')?.metadata).toMatchObject({
      contentType: 'application/octet-stream',
    });
    const file = await call('/api/feedback/file?key=anna/audio/html', { code: OWNER_CODE });
    expect(file.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(file.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('wist alles van één tester, en niets van de anderen', async () => {
    env.ACCESS_CODES = JSON.stringify({ anna: ANNA_CODE, piet: 'code-van-piet' });
    await put('sessions/a', '{}');
    await put('audio/b', 'geluid');
    await put('sessions/c', '{}', 'code-van-piet');

    const response = await call('/api/feedback/tester?name=anna', {
      code: OWNER_CODE,
      method: 'DELETE',
    });
    expect(await response.json()).toEqual({ ok: true, deleted: 2 });
    expect([...kv.store.keys()]).toEqual(['piet/sessions/c']);
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
      { id: 'n2', tester: 'anna', recordedAt: 3000, text: 'Getypt', processed: false },
      {
        id: 'n1',
        tester: 'anna',
        recordedAt: 2000,
        text: 'de kaart is traag',
        appVersion: 'abc123',
        sessionName: 'Waterleidingduinen',
        processed: false,
      },
    ]);
  });

  it('toont feedback die in twee bestanden staat maar één keer', async () => {
    await share('losse-feedback-a1b2c3d4', {
      sessions: [],
      utterances: [{ id: 'n2', recordedAt: 3000, kind: 'dev_note', transcript: 'Getypt' }],
    });
    expect((await notes()).map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('neemt de gebiedsnaam van de wandeling mee', async () => {
    await share('w2', {
      sessions: [{ place: { name: 'Gulperberg' }, startedAt: 4000, endedAt: 5000 }],
      utterances: [{ id: 'n3', recordedAt: 4500, kind: 'dev_note', transcript: 'Feedback: ok' }],
    });
    expect(await notes()).toContainEqual(
      expect.objectContaining({ id: 'n3', sessionName: 'Gulperberg' }),
    );
  });

  it('telt per tester wandelingen, uitspraken, feedback en de laatste actie', async () => {
    await share('w2', {
      sessions: [{ startedAt: 4000, endedAt: 5000 }],
      utterances: [{ id: 'u2', recordedAt: 4500, transcript: 'Vink' }],
    });
    const response = await call('/api/testers', { code: OWNER_CODE });
    const { testers } = (await response.json()) as {
      testers: { name: string; usage?: object }[];
    };
    expect(testers.find((t) => t.name === 'anna')?.usage).toEqual({
      walks: 2,
      utterances: 2,
      notes: 2,
      lastActivity: 5000,
    });
  });

  it('onthoudt welke feedback verwerkt is, en kan dat terugdraaien', async () => {
    expect((await markProcessed(['n1', 'n2'], true)).status).toBe(200);
    expect((await notes()).map((n) => n.processed)).toEqual([true, true]);
    await markProcessed(['n2'], false);
    expect((await notes()).map((n) => n.processed)).toEqual([false, true]);
  });

  it('is alleen voor de eigenaar', async () => {
    expect((await call('/api/feedback/notes')).status).toBe(403);
    expect((await markProcessed(['n1'], true, ANNA_CODE)).status).toBe(403);
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

  function transcribe(model: string, session = 'wandeling-1') {
    const form = new FormData();
    form.set('audio', new File([new Uint8Array(100)], 'opname.webm', { type: 'audio/webm' }));
    form.set('model', model);
    return call('/api/transcribe', {
      method: 'POST',
      headers: { 'X-Session': session },
      body: form,
    });
  }

  async function rows() {
    const response = await call('/api/usage?from=2000-01-01', { code: OWNER_CODE });
    expect(response.status).toBe(200);
    return ((await response.json()) as { rows: Record<string, unknown>[] }).rows;
  }

  it('telt de tokens van Anthropic op per tester, wandeling en model', async () => {
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
    await interpret('wandeling-1');
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
    await interpret('wandeling-1');
    await interpret('wandeling-2');

    expect(await rows()).toEqual([
      expect.objectContaining({
        tester: 'anna',
        channel: 'beta',
        session: 'wandeling-1',
        model: 'claude-haiku-5-5',
        requests: 2,
        inputTokens: 210,
        outputTokens: 50,
        cacheWriteTokens: 5000,
        cacheReadTokens: 5000,
        audioSeconds: 0,
      }),
      expect.objectContaining({ session: 'wandeling-2', requests: 1 }),
    ]);
    expect((await rows())[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('telt tokens bij gpt-4o-transcribe en seconden bij whisper-1', async () => {
    upstream.mockImplementation(async () =>
      Response.json({
        text: 'vink',
        usage: { type: 'tokens', input_tokens: 80, output_tokens: 3, total_tokens: 83 },
      }),
    );
    await transcribe('gpt-4o-transcribe');
    upstream.mockImplementation(async () =>
      Response.json({ text: 'vink', usage: { type: 'duration', seconds: 4 } }),
    );
    await transcribe('whisper-1');

    expect(await rows()).toEqual([
      expect.objectContaining({ model: 'gpt-4o-transcribe', inputTokens: 80, outputTokens: 3 }),
      expect.objectContaining({ model: 'whisper-1', audioSeconds: 4, inputTokens: 0 }),
    ]);
  });

  it('telt een ongeldig of ontbrekend wandeling-id als "geen wandeling"', async () => {
    upstream.mockImplementation(async () =>
      Response.json(message({ input_tokens: 1, output_tokens: 1 })),
    );
    await interpret();
    await interpret('../../iets anders');
    expect(await rows()).toEqual([expect.objectContaining({ session: '', requests: 2 })]);
  });

  it('telt niets als OpenAI of Anthropic een fout geeft', async () => {
    upstream.mockResolvedValue(Response.json({ error: { message: 'kapot' } }, { status: 500 }));
    await transcribe('gpt-4o-transcribe');
    expect(await rows()).toEqual([]);
  });

  it('laat de uitspraak niet mislukken als tellen niet lukt', async () => {
    env.USAGE = {
      prepare: () => {
        throw new Error('D1 ligt eruit');
      },
    };
    upstream.mockResolvedValue(Response.json({ text: 'vink' }));
    expect((await transcribe('gpt-4o-transcribe')).status).toBe(200);
  });

  it('geeft alleen regels vanaf de gevraagde datum', async () => {
    upstream.mockImplementation(async () =>
      Response.json(message({ input_tokens: 1, output_tokens: 1 })),
    );
    await interpret('wandeling-1');
    const response = await call('/api/usage?from=2999-01-01', { code: OWNER_CODE });
    expect(await response.json()).toEqual({ rows: [] });
  });

  it('is alleen voor de eigenaar, met een geldige datum', async () => {
    expect((await call('/api/usage?from=2026-10-01')).status).toBe(403);
    expect((await call('/api/usage?from=gisteren', { code: OWNER_CODE })).status).toBe(400);
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
    expect([...testersKv.store.keys()].some((key) => key.includes('anthropic'))).toBe(false);
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
