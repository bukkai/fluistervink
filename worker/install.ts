// Gebruik zonder toegangscode: elke installatie van de app (Android of PWA)
// meldt zich bij de eerste keer openen onzichtbaar aan (POST /api/install) en
// krijgt een token. Om te voorkomen dat iemand met een script duizenden
// installaties aanmaakt, bewijst de app eerst dat hij echt is: de Android-app
// met de Play Integrity API van Google, de browser met Cloudflare Turnstile.
// Zie docs/plan-laagdrempelig.md.
//
// Het token is ondertekend (HMAC met het geheim INSTALL_SECRET), zodat de
// proxy het niet bij elk verzoek hoeft op te zoeken. Wel staat elke
// installatie in KV (TESTERS, `install/<id>`, alles in de metadata), zodat de
// eigenaar ze op Developer ziet en er één kan afsluiten.

/** App-ID in Google Play; de verklaring van Play Integrity moet hierover gaan. */
export const APP_ID = 'nl.hegmus.fluistervink';

/** Id van een installatie: `crypto.randomUUID()` in de app. */
export const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const TOKEN_PREFIX = 'i1.';
const KEY_PREFIX = 'install/';

/** Een verklaring van Play Integrity mag hooguit zo oud zijn. */
const MAX_VERDICT_AGE_MS = 10 * 60 * 1000;

export interface InstallSecrets {
  INSTALL_SECRET?: string;
  TURNSTILE_SECRET?: string;
  /** JSON-sleutel van een serviceaccount in Google Cloud, met toegang tot de Play Integrity API */
  PLAY_SERVICE_ACCOUNT?: string;
}

/** Wat er van een installatie in KV staat (als metadata). */
export interface InstallRecord {
  name: string;
  registeredAt: number;
  /** Hoe de app bewees dat hij echt is */
  via: 'play' | 'turnstile';
  blocked?: boolean;
}

/** Naam van een installatie, zoals een testernaam: "app-3f9a2b1c". */
export function installName(id: string): string {
  return `app-${id.slice(0, 8)}`;
}

export function isInstallToken(credential: string): boolean {
  return credential.startsWith(TOKEN_PREFIX);
}

/** `i1.<id>.<handtekening>` */
export async function signInstallToken(id: string, secret: string): Promise<string> {
  return `${TOKEN_PREFIX}${id}.${await hmac(id, secret)}`;
}

/** Het id uit een geldig token, anders null. */
export async function verifyInstallToken(token: string, secret: string): Promise<string | null> {
  const [id, signature] = token.slice(TOKEN_PREFIX.length).split('.');
  if (!id || !signature || !INSTALL_ID.test(id)) return null;
  const encoder = new TextEncoder();
  const expected = encoder.encode(await hmac(id, secret));
  const given = encoder.encode(signature);
  if (expected.byteLength !== given.byteLength) return null;
  return crypto.subtle.timingSafeEqual(expected, given) ? id : null;
}

async function hmac(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return base64url(new Uint8Array(signature));
}

export async function getInstall(kv: KVNamespace, id: string): Promise<InstallRecord | null> {
  // Een minuut in de cache van de edge: dit gebeurt bij elk verzoek, en
  // afsluiten hoeft niet op de seconde
  const { metadata } = await kv.getWithMetadata<InstallRecord>(KEY_PREFIX + id, {
    cacheTtl: 60,
  });
  return metadata;
}

export async function putInstall(kv: KVNamespace, id: string, record: InstallRecord) {
  await kv.put(KEY_PREFIX + id, '', { metadata: record });
}

/** Alle installaties, met hun id. */
export async function listInstalls(kv: KVNamespace): Promise<(InstallRecord & { id: string })[]> {
  const installs: (InstallRecord & { id: string })[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<InstallRecord>({ prefix: KEY_PREFIX, cursor });
    for (const key of page.keys) {
      if (key.metadata) installs.push({ ...key.metadata, id: key.name.slice(KEY_PREFIX.length) });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return installs;
}

/**
 * Nonce voor Play Integrity: het id van de installatie, base64 (web-safe,
 * zonder opvulling). Zo hoort een verklaring bij één installatie en is hij
 * niet voor een andere te gebruiken. De app rekent hem net zo uit
 * (src/lib/install.ts).
 */
export function integrityNonce(id: string): string {
  return base64url(new TextEncoder().encode(id));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Controleert een token van Turnstile bij Cloudflare. */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
): Promise<boolean> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) return false;
  const result = (await response.json()) as {
    success?: boolean;
    action?: string;
    metadata?: { result_with_testing_key?: boolean };
  };
  // De testsleutels (lokaal, .dev.vars) geven geen actie terug
  const action = result.metadata?.result_with_testing_key ? 'install' : result.action;
  return result.success === true && action === 'install';
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** Wat Google van de verklaring teruggeeft, voor zover we het gebruiken. */
interface IntegrityVerdict {
  tokenPayloadExternal?: {
    requestDetails?: { requestPackageName?: string; nonce?: string; timestampMillis?: string };
    appIntegrity?: { appRecognitionVerdict?: string };
    deviceIntegrity?: { deviceRecognitionVerdict?: string[] };
  };
}

/**
 * Laat een verklaring van Play Integrity ontsleutelen door Google en
 * controleert hem: over deze app, voor deze installatie, recent, de app
 * ongewijzigd uit Play, en een echt Android-toestel.
 */
export async function verifyPlayIntegrity(
  token: string,
  id: string,
  serviceAccountJson: string,
): Promise<boolean> {
  const account = JSON.parse(serviceAccountJson) as ServiceAccount;
  const response = await fetch(
    `https://playintegrity.googleapis.com/v1/${APP_ID}:decodeIntegrityToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await googleAccessToken(account)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ integrity_token: token }),
    },
  );
  if (!response.ok) {
    console.error('Play Integrity', response.status, await response.text());
    return false;
  }
  const payload = ((await response.json()) as IntegrityVerdict).tokenPayloadExternal;
  const request = payload?.requestDetails;
  const age = Date.now() - Number(request?.timestampMillis);
  const verdict = payload?.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  return (
    request?.requestPackageName === APP_ID &&
    request.nonce?.replace(/=+$/, '') === integrityNonce(id) &&
    age >= -60_000 &&
    age < MAX_VERDICT_AGE_MS &&
    payload?.appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED' &&
    verdict.includes('MEETS_DEVICE_INTEGRITY')
  );
}

/** Toegangstoken van Google voor het serviceaccount, bewaard zolang het geldig is. */
let cachedGoogleToken: { email: string; token: string; expires: number } | undefined;

async function googleAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken?.email === account.client_email && cachedGoogleToken.expires > now + 60) {
    return cachedGoogleToken.token;
  }
  // JWT, ondertekend met de sleutel van het serviceaccount (RS256), in te
  // wisselen voor een toegangstoken (OAuth 2.0 voor serviceaccounts)
  const encode = (data: object) => base64url(new TextEncoder().encode(JSON.stringify(data)));
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth: HTTP ${response.status}`);
  const { access_token, expires_in } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedGoogleToken = {
    email: account.client_email,
    token: access_token,
    expires: now + expires_in,
  };
  return access_token;
}
