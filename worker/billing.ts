// De echte rekening van OpenAI en Anthropic, als controle op wat de proxy zelf
// telt (worker/usage.ts) en de prijstabel in src/lib/costs.ts. Elk met een
// eigen beheersleutel (OPENAI_ADMIN_KEY, ANTHROPIC_ADMIN_KEY), die alleen hier
// staat. Zonder sleutel slaat de proxy die aanbieder over.
//
// - OpenAI: Costs API, https://platform.openai.com/docs/api-reference/usage/costs
// - Anthropic: Cost API (Admin API), alleen met een organisatie, niet met een
//   persoonlijk account: https://platform.claude.com/docs/en/manage-claude/usage-cost-api
//
// Alleen de kosten van Fluistervink: bij OpenAI van één project
// (OPENAI_PROJECT_ID), bij Anthropic van één workspace (ANTHROPIC_WORKSPACE_ID).
// Zonder die id de hele organisatie, dus ook andere projecten.
//
// Beide geven kosten per dag in UTC. De proxy haalt de rekening hooguit één
// keer per uur op en bewaart hem in KV (TESTERS), zodat niet elk bezoek aan
// Developer de API's aanroept. De Costs API van OpenAI staat maar 10 verzoeken
// per minuut toe (voor de hele organisatie). Mislukt het ophalen, dan geeft de
// proxy de laatst bekende rekening van deze maand terug met de fout erbij
// (`stale`), en probeert hij het pas na een minuut opnieuw.

import type { Bill, Provider } from '../src/lib/costs';

export interface BillingKeys {
  OPENAI_ADMIN_KEY?: string;
  ANTHROPIC_ADMIN_KEY?: string;
  /** Project van Fluistervink bij OpenAI (`proj_…`), in wrangler.jsonc */
  OPENAI_PROJECT_ID?: string;
  /** Workspace van Fluistervink bij Anthropic (`wrkspc_…`), in wrangler.jsonc */
  ANTHROPIC_WORKSPACE_ID?: string;
}

/** Zo lang geldt een opgehaalde rekening. */
export const BILL_MAX_AGE = 60 * 60 * 1000;
/** Zo lang blijft een rekening bewaard als terugval (ruim een maand). */
const BILL_KEEP = 40 * 24 * 60 * 60;
/** Na een fout zo lang niet opnieuw proberen (seconden; minimum van KV). */
export const BILL_RETRY_AFTER = 60;
/** Een maand heeft hooguit 31 dagen; meer pagina's is een fout. */
const MAX_PAGES = 3;

// Met de id erin, zodat een andere id meteen een nieuwe rekening geeft
const kvKey = (provider: Provider, scope = '') => `billing/${provider}/${scope}`;
// De laatste fout, zolang niet opnieuw proberen
const pauseKey = (provider: Provider, scope = '') => `billing-pause/${provider}/${scope}`;

/**
 * De rekening van deze maand (UTC) per dag, uit KV of vers opgehaald. Null
 * zonder beheersleutel. Bij een fout de laatst bekende rekening van deze maand
 * met `stale`, of `{ error }` als die er niet is; een minuut lang niet opnieuw.
 */
export async function bill(
  kv: KVNamespace,
  provider: Provider,
  key: string | undefined,
  /** Project (OpenAI) of workspace (Anthropic); leeg voor de hele organisatie */
  scope?: string,
  now = new Date(),
): Promise<Bill | { error: string } | null> {
  if (!key) return null;
  const month = now.toISOString().slice(0, 7);
  const cached = await kv.get<Bill>(kvKey(provider, scope), 'json');
  const thisMonth = cached?.month === month ? cached : null;
  if (thisMonth && now.getTime() - thisMonth.fetchedAt < BILL_MAX_AGE) return thisMonth;
  const failed = (error: string) => (thisMonth ? { ...thisMonth, stale: error } : { error });

  const pause = await kv.get(pauseKey(provider, scope));
  if (pause) return failed(pause);
  try {
    const start = new Date(`${month}-01T00:00:00Z`);
    const days = await (provider === 'openai' ? openaiCosts : anthropicCosts)(key, start, scope);
    const fresh: Bill = { month, days, fetchedAt: now.getTime() };
    await kv.put(kvKey(provider, scope), JSON.stringify(fresh), { expirationTtl: BILL_KEEP });
    return fresh;
  } catch (error) {
    console.error({ billing: provider, error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    await kv.put(pauseKey(provider, scope), message, { expirationTtl: BILL_RETRY_AFTER });
    return failed(message);
  }
}

/** Fout van een aanbieder, met de melding uit het antwoord als die er is. */
async function upstreamError(name: string, response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } };
  return new Error(`${name} ${response.status}: ${body?.error?.message ?? response.statusText}`);
}

/** Dollars per dag (`2026-10-24`), OpenAI: bedragen in dollars. */
async function openaiCosts(
  key: string,
  start: Date,
  project?: string,
): Promise<Record<string, number>> {
  const days: Record<string, number> = {};
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time', String(start.getTime() / 1000));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (project) url.searchParams.set('project_ids', project);
    if (page) url.searchParams.set('page', page);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw await upstreamError('OpenAI', response);
    const result = (await response.json()) as {
      data: {
        start_time: number;
        results: { amount?: { value?: number; currency?: string } }[];
      }[];
      has_more: boolean;
      next_page: string | null;
    };
    for (const bucket of result.data) {
      const day = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      for (const { amount } of bucket.results) {
        if (amount?.currency?.toLowerCase() !== 'usd') continue;
        days[day] = (days[day] ?? 0) + (amount.value ?? 0);
      }
    }
    if (!result.has_more || !result.next_page) return days;
    page = result.next_page;
  }
  throw new Error('OpenAI: te veel pagina’s');
}

/**
 * Dollars per dag, Anthropic: bedragen in centen, als tekst. Filteren op
 * workspace kan niet, wel opsplitsen; dan tellen we alleen die van ons.
 */
async function anthropicCosts(
  key: string,
  start: Date,
  workspace?: string,
): Promise<Record<string, number>> {
  const days: Record<string, number> = {};
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
    url.searchParams.set('starting_at', start.toISOString());
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (workspace) url.searchParams.set('group_by[]', 'workspace_id');
    if (page) url.searchParams.set('page', page);
    const response = await fetch(url, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!response.ok) throw await upstreamError('Anthropic', response);
    const result = (await response.json()) as {
      data: {
        starting_at: string;
        results: { amount?: string; currency?: string; workspace_id?: string | null }[];
      }[];
      has_more: boolean;
      next_page: string | null;
    };
    for (const bucket of result.data) {
      const day = bucket.starting_at.slice(0, 10);
      for (const { amount, currency, workspace_id } of bucket.results) {
        if (currency !== 'USD' || (workspace && workspace_id !== workspace)) continue;
        days[day] = (days[day] ?? 0) + Number(amount ?? 0) / 100;
      }
    }
    if (!result.has_more || !result.next_page) return days;
    page = result.next_page;
  }
  throw new Error('Anthropic: te veel pagina’s');
}
