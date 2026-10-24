// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

// De proxy in Node, met een nep-KV in het geheugen en een nagebootste fetch
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

/** Een verzoek aan de proxy, standaard met de code van Anna. */
function call(
  path: string,
  { code = ANNA_CODE, ...init }: RequestInit & { code?: string | null } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (code) headers.set('Authorization', `Bearer ${code}`);
  const request = new Request(`https://fluistervink.test${path}`, { ...init, headers });
  return worker.fetch(request as never, env as never);
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
    expect(new Headers(init?.headers).get('x-api-key')).toBe('sk-ant-geheim');
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
          { properties: { id: 1234, title: 'Landgoed Mariëndaal', area: 'groot' }, geometry: {} },
        ],
      }),
    );
    const response = await call('/api/area?lat=51.98&lon=5.88');
    expect(await response.json()).toEqual({ area: { id: 1234, name: 'Landgoed Mariëndaal' } });
    expect(upstream.mock.calls[0][0]).toBe(
      'https://waarneming.nl/api/v1/locations/geojson/?coordinates=51.98,5.88',
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
      sessions: [{ name: 'Mariëndaal' }],
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
        sessionName: 'Mariëndaal',
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
