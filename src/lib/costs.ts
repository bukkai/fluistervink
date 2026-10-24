// Kostenoverzicht (scherm Developer): het verbruik dat de proxy telt
// (worker/usage.ts, /api/usage) omgerekend naar dollars. De rekeningen van
// OpenAI en Anthropic zijn in dollars, dus geen wisselkoers.

/** Verbruik per dag, tester, omgeving, wandeling en model, zoals de proxy het telt. */
export interface UsageRow {
  /** Datum in Nederlandse tijd, `2026-10-24` */
  day: string;
  tester: string;
  channel: string;
  /** Id van de wandeling; leeg als er geen bij hoort (testset) */
  session: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** Anthropic: naar de cache geschreven (5 minuten) */
  cacheWriteTokens: number;
  /** Anthropic: uit de cache gelezen */
  cacheReadTokens: number;
  /** whisper-1 rekent per minuut audio, niet per token */
  audioSeconds: number;
}

interface Price {
  /** Dollars per miljoen tokens */
  input: number;
  output: number;
  cacheWrite?: number;
  cacheRead?: number;
  /** Dollars per minuut audio (whisper-1) */
  perMinute?: number;
}

/**
 * Prijzen per model, nagekeken op 24 okt 2026 bij
 * https://platform.claude.com/docs/en/about-claude/pricing en
 * https://developers.openai.com/api/docs/pricing. Prijzen veranderen: wijkt
 * het totaal flink af van de rekening, kijk ze dan na.
 *
 * Haiku 5.5 is duurder bij een prompt boven de 100.000 tokens; de proxy laat
 * hooguit 256 kB door en een uitspraak is ~30 kB, dus dat komt niet voor.
 */
export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'gpt-4o-transcribe': { input: 2.5, output: 10 },
  'gpt-4o-mini-transcribe': { input: 1.25, output: 5 },
  'whisper-1': { input: 0, output: 0, perMinute: 0.006 },
};

/** Kosten van een regel in dollars, of undefined als het model niet in de prijstabel staat. */
export function rowCost(row: UsageRow): number | undefined {
  const price = PRICES[row.model];
  if (!price) return undefined;
  const perToken =
    row.inputTokens * price.input +
    row.outputTokens * price.output +
    row.cacheWriteTokens * (price.cacheWrite ?? price.input) +
    row.cacheReadTokens * (price.cacheRead ?? price.input);
  return perToken / 1_000_000 + (row.audioSeconds / 60) * (price.perMinute ?? 0);
}

/** Spraakherkenning: één verzoek per opgenomen uitspraak. */
const isTranscription = (row: UsageRow) => !row.model.startsWith('claude-');

export interface WalkCost {
  session: string;
  tester: string;
  /** Eerste dag met verbruik */
  day: string;
  cost: number;
  utterances: number;
}

export interface CostSummary {
  today: number;
  thisMonth: number;
  lastMonth: number;
  /** Deze maand */
  openai: number;
  anthropic: number;
  /** Deze maand, duurste eerst */
  perTester: { tester: string; cost: number; utterances: number }[];
  /** Gemiddeld per opgenomen uitspraak in een wandeling, deze maand */
  perUtterance?: number;
  /** Gemiddeld per wandeling, deze maand (zonder de testset) */
  perWalk?: number;
  /** Duurste wandelingen over alle opgehaalde regels */
  topWalks: WalkCost[];
  /** Modellen zonder prijs: die tellen niet mee */
  unknownModels: string[];
}

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' });

/** Vandaag als `2026-10-24`, in Nederlandse tijd zoals de proxy telt. */
export function dayOf(date: Date): string {
  return dayFormat.format(date);
}

/** Eerste dag van de vorige maand: vanaf daar haalt Developer het verbruik op. */
export function startOfLastMonth(now: Date): string {
  const [year, month] = dayOf(now).split('-').map(Number);
  const last = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return `${last.year}-${String(last.month).padStart(2, '0')}-01`;
}

export function summarize(rows: UsageRow[], now = new Date()): CostSummary {
  const today = dayOf(now);
  const month = today.slice(0, 7);
  const lastMonth = startOfLastMonth(now).slice(0, 7);

  const summary: CostSummary = {
    today: 0,
    thisMonth: 0,
    lastMonth: 0,
    openai: 0,
    anthropic: 0,
    perTester: [],
    topWalks: [],
    unknownModels: [],
  };
  const testers = new Map<string, { cost: number; utterances: number }>();
  const walks = new Map<string, WalkCost>();
  const unknown = new Set<string>();
  // Alleen wandelingen, niet de testset: die zou het gemiddelde vertekenen
  let walkCost = 0;
  let walkUtterances = 0;

  for (const row of rows) {
    const cost = rowCost(row);
    if (cost === undefined) {
      unknown.add(row.model);
      continue;
    }
    const spoken = isTranscription(row) ? row.requests : 0;
    if (row.day === today) summary.today += cost;
    if (row.day.startsWith(lastMonth)) summary.lastMonth += cost;
    if (row.day.startsWith(month)) {
      summary.thisMonth += cost;
      if (isTranscription(row)) summary.openai += cost;
      else summary.anthropic += cost;
      const tester = testers.get(row.tester) ?? { cost: 0, utterances: 0 };
      tester.cost += cost;
      tester.utterances += spoken;
      testers.set(row.tester, tester);
      if (row.session) {
        walkCost += cost;
        walkUtterances += spoken;
      }
    }
    if (row.session) {
      // Per tester: twee apparaten maken nooit hetzelfde id, maar zo blijft
      // een wandeling bij de tester die hem liep
      const key = `${row.tester}/${row.session}`;
      const walk = walks.get(key) ?? {
        session: row.session,
        tester: row.tester,
        day: row.day,
        cost: 0,
        utterances: 0,
      };
      walk.cost += cost;
      walk.utterances += spoken;
      if (row.day < walk.day) walk.day = row.day;
      walks.set(key, walk);
    }
  }

  summary.perTester = [...testers]
    .map(([tester, totals]) => ({ tester, ...totals }))
    .sort((a, b) => b.cost - a.cost);
  if (walkUtterances) summary.perUtterance = walkCost / walkUtterances;
  const walksThisMonth = [...walks.values()].filter((w) => w.day.startsWith(month));
  if (walksThisMonth.length) {
    summary.perWalk = walksThisMonth.reduce((sum, w) => sum + w.cost, 0) / walksThisMonth.length;
  }
  summary.topWalks = [...walks.values()].sort((a, b) => b.cost - a.cost).slice(0, 5);
  summary.unknownModels = [...unknown];
  return summary;
}
