// Statistieken (scherm Statistieken, alleen de eigenaar): hoeveel mensen de
// app gebruiken en of ze terugkomen. Uit de usage-tabel die de proxy toch al
// bijhoudt voor de kosten (worker/usage.ts, /api/stats), dus zonder een nieuw
// gegeven te verzamelen. "Gebruiken" = minstens één uitspraak in een sessie;
// alleen thuis nalopen telt niet mee.

import { dayOf, rowCost, type UsageRow } from './costs';
import { AUDIO_SECONDS_PER_DAY, MESSAGES_PER_DAY } from './limits';

/** Gebruik per dag en tester, zoals de proxy het samenvat. */
export interface ActivityRow {
  /** Datum in Nederlandse tijd, `2026-11-08` */
  day: string;
  tester: string;
  /** Sessies met minstens één verzoek */
  sessions: number;
  /** Verzoeken aan de spraakherkenning: één per uitspraak */
  utterances: number;
}

export interface DayStats {
  day: string;
  users: number;
  sessions: number;
  utterances: number;
}

export interface WeekStats {
  /** Maandag van de week, `2026-11-02` */
  week: string;
  active: number;
  /** Voor het eerst gezien */
  new: number;
  /** Vorige week ook actief */
  returning: number;
  /** Eerder gezien, vorige week niet: terug na een pauze */
  resumed: number;
  /** Vorige week actief, deze week niet */
  lapsed: number;
  sessions: number;
  utterances: number;
}

/** `day` plus `n` dagen; rekent in UTC, zodat zomertijd niet meetelt. */
export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Maandag van de week waarin `day` valt. */
export function weekOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/** De laatste `count` dagen tot en met vandaag, ook dagen zonder gebruik. */
export function perDay(rows: ActivityRow[], count: number, now = new Date()): DayStats[] {
  const today = dayOf(now);
  const days = new Map<string, DayStats>();
  for (let i = count - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    days.set(day, { day, users: 0, sessions: 0, utterances: 0 });
  }
  for (const row of rows) {
    const stats = days.get(row.day);
    if (!stats) continue;
    stats.users++;
    stats.sessions += row.sessions;
    stats.utterances += row.utterances;
  }
  return [...days.values()];
}

/**
 * De laatste `count` weken tot en met deze, nieuwste eerst. `rows` moet vanaf
 * het begin zijn, anders lijkt iedereen nieuw.
 */
export function perWeek(rows: ActivityRow[], count: number, now = new Date()): WeekStats[] {
  const firstSeen = new Map<string, string>();
  const active = new Map<string, Set<string>>();
  const totals = new Map<string, { sessions: number; utterances: number }>();
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    const week = weekOf(row.day);
    if (!firstSeen.has(row.tester)) firstSeen.set(row.tester, week);
    if (!active.has(week)) active.set(week, new Set());
    active.get(week)!.add(row.tester);
    const total = totals.get(week) ?? { sessions: 0, utterances: 0 };
    total.sessions += row.sessions;
    total.utterances += row.utterances;
    totals.set(week, total);
  }

  const thisWeek = weekOf(dayOf(now));
  const weeks: WeekStats[] = [];
  for (let i = 0; i < count; i++) {
    const week = addDays(thisWeek, -7 * i);
    const now = active.get(week) ?? new Set<string>();
    const before = active.get(addDays(week, -7)) ?? new Set<string>();
    const stats: WeekStats = {
      week,
      active: now.size,
      new: 0,
      returning: 0,
      resumed: 0,
      lapsed: [...before].filter((t) => !now.has(t)).length,
      ...(totals.get(week) ?? { sessions: 0, utterances: 0 }),
    };
    for (const tester of now) {
      if (firstSeen.get(tester) === week) stats.new++;
      else if (before.has(tester)) stats.returning++;
      else stats.resumed++;
    }
    weeks.push(stats);
  }
  return weeks;
}

/** Kosten per actieve gebruiker in één week, voor de betaalde laag. */
export interface WeekCost {
  /** Maandag van de week, `2026-11-16` */
  week: string;
  /** Deze week nog niet om */
  current: boolean;
  /** Gebruikers met minstens één uitspraak in een sessie */
  users: number;
  /** Dollars, alle actieve gebruikers samen */
  cost: number;
  perUser: number;
  median: number;
  max: number;
}

/**
 * Kosten per actieve gebruiker per week, nieuwste eerst: hoeveel kost één
 * gebruiker, en hoeveel de duurste (een trektelling kost veel meer dan een
 * wandeling). Zonder de eigenaar en zonder de testset (geen sessie): die
 * zeggen niets over een gewone gebruiker. Alleen hele weken vanaf `from`
 * (de eerste opgehaalde dag), plus de lopende week.
 */
export function costPerUserWeek(rows: UsageRow[], from: string, now = new Date()): WeekCost[] {
  const perWeek = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!row.session || row.tester === 'eigenaar') continue;
    const cost = rowCost(row);
    if (cost === undefined) continue;
    const week = weekOf(row.day);
    const testers = perWeek.get(week) ?? new Map<string, number>();
    testers.set(row.tester, (testers.get(row.tester) ?? 0) + cost);
    perWeek.set(week, testers);
  }
  // Actief: minstens één uitspraak (spraakherkenning) in een sessie die week
  const active = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.session || row.tester === 'eigenaar' || row.model.startsWith('claude-')) continue;
    if (!row.requests) continue;
    const week = weekOf(row.day);
    if (!active.has(week)) active.set(week, new Set());
    active.get(week)!.add(row.tester);
  }

  const thisWeek = weekOf(dayOf(now));
  const weeks: WeekCost[] = [];
  for (let week = thisWeek; week >= from; week = addDays(week, -7)) {
    const users = [...(active.get(week) ?? [])];
    const costs = users.map((t) => perWeek.get(week)?.get(t) ?? 0).sort((a, b) => a - b);
    const cost = costs.reduce((sum, c) => sum + c, 0);
    const mid = Math.floor(costs.length / 2);
    weeks.push({
      week,
      current: week === thisWeek,
      users: users.length,
      cost,
      perUser: users.length ? cost / users.length : 0,
      median: !costs.length ? 0 : costs.length % 2 ? costs[mid] : (costs[mid - 1] + costs[mid]) / 2,
      max: costs.at(-1) ?? 0,
    });
  }
  return weeks;
}

// --- Stap 1 van "Statistieken en Developer uitbreiden" (22 nov): meer uit wat
// de proxy al telt, zonder nieuw gegeven. Zie docs/proxy.md, Statistieken.

/**
 * Kleinste groep waarvan Statistieken een percentage laat zien: kleiner is één
 * persoon te herkennen ("die ene van de week van 9 nov is gestopt").
 */
export const MIN_GROUP = 5;

/** Weken na de eerste week waarin we kijken of iemand nog vogelt */
export const RETENTION_WEEKS = [1, 2, 4, 8] as const;

export interface Cohort {
  /** Maandag van de week van het eerste gebruik */
  week: string;
  size: number;
  /**
   * Per week in `RETENTION_WEEKS` het deel (0–1) dat die week actief was;
   * `undefined` als die week nog niet voorbij is.
   */
  retained: (number | undefined)[];
}

/**
 * Blijven gebruikers? Per week van het eerste gebruik: welk deel na 1, 2, 4
 * en 8 weken nog actief was (in precies die week). Nieuwste eerst. `rows`
 * moet vanaf het begin zijn, anders lijkt iedereen nieuw.
 */
export function cohorts(rows: ActivityRow[], now = new Date()): Cohort[] {
  const firstWeek = new Map<string, string>();
  const active = new Map<string, Set<string>>();
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    const week = weekOf(row.day);
    if (!firstWeek.has(row.tester)) firstWeek.set(row.tester, week);
    if (!active.has(week)) active.set(week, new Set());
    active.get(week)!.add(row.tester);
  }
  const groups = new Map<string, string[]>();
  for (const [tester, week] of firstWeek) groups.set(week, [...(groups.get(week) ?? []), tester]);

  const thisWeek = weekOf(dayOf(now));
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, testers]) => ({
      week,
      size: testers.length,
      retained: RETENTION_WEEKS.map((offset) => {
        const later = addDays(week, 7 * offset);
        // Alleen weken die helemaal om zijn
        if (later >= thisWeek) return undefined;
        const seen = active.get(later);
        return testers.filter((t) => seen?.has(t)).length / testers.length;
      }),
    }));
}

/** Van installeren tot vaste gebruiker */
export interface Funnel {
  /** Aangemeld (zonder de eigenaar) */
  installed: number;
  /** Minstens één uitspraak in een sessie */
  used: number;
  /** Minstens twee sessies */
  returned: number;
  /** Eerste gebruik minstens vier weken geleden: zij tellen voor `stayed` */
  eligible: number;
  /** Van `eligible`: vier weken of later na het eerste gebruik nog actief */
  stayed: number;
}

/** Dagen na het eerste gebruik waarna iemand als blijver telt */
export const STAY_DAYS = 28;

/**
 * Waar haken mensen af: geïnstalleerd, eerste uitspraak, tweede sessie, en na
 * vier weken nog actief. `installs` zijn de namen van de installaties; wie
 * wel gebruik heeft maar geen installatie (oude testercodes) telt niet mee.
 */
export function funnel(rows: ActivityRow[], installs: string[], now = new Date()): Funnel {
  const names = new Set(installs.filter((name) => name !== 'eigenaar'));
  const perTester = new Map<string, { first: string; last: string; sessions: number }>();
  for (const row of rows) {
    if (!names.has(row.tester)) continue;
    const seen = perTester.get(row.tester);
    if (!seen) perTester.set(row.tester, { first: row.day, last: row.day, sessions: row.sessions });
    else {
      if (row.day < seen.first) seen.first = row.day;
      if (row.day > seen.last) seen.last = row.day;
      seen.sessions += row.sessions;
    }
  }
  const today = dayOf(now);
  const all = [...perTester.values()];
  const eligible = all.filter((t) => addDays(t.first, STAY_DAYS) <= today);
  return {
    installed: names.size,
    used: all.length,
    returned: all.filter((t) => t.sessions >= 2).length,
    eligible: eligible.length,
    stayed: eligible.filter((t) => t.last >= addDays(t.first, STAY_DAYS)).length,
  };
}

/**
 * Grenzen voor de kosten per actieve gebruiker per maand (docs/plan-marketing.md,
 * Kostengrens per stap): eronder mag de volgende stap, ertussen gaat de betaalde
 * laag voor, erboven eerst de kosten omlaag.
 */
export const COST_PER_USER_OK = 1;
export const COST_PER_USER_HIGH = 2;
/** Maandbudget tot de betaalde laag er is: €50, in dollars zoals de rest */
export const MONTH_BUDGET = 55;

/** De dagen van deze maand: verstreken (tot en met vandaag) en in totaal. */
function monthDays(now: Date): { elapsed: number; total: number } {
  const [year, month, day] = dayOf(now).split('-').map(Number);
  return { elapsed: day, total: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

/** Wat deze maand naar verwachting kost, als het zo doorgaat als tot nu toe. */
export function monthForecast(thisMonth: number, now = new Date()): number {
  const { elapsed, total } = monthDays(now);
  return (thisMonth / elapsed) * total;
}

/** Kosten van een sessieregel zonder de eigenaar en de testset, of `undefined` */
function userCost(row: UsageRow): number | undefined {
  if (!row.session || row.tester === 'eigenaar') return undefined;
  return rowCost(row);
}

/**
 * Hoe de kosten van deze maand verdeeld zijn over gebruikers (zonder de
 * eigenaar en de testset): het deel van de duurste 10% (minstens één).
 */
export function topShare(
  rows: UsageRow[],
  now = new Date(),
): { users: number; top: number; share: number } | undefined {
  const month = dayOf(now).slice(0, 7);
  const perTester = new Map<string, number>();
  for (const row of rows) {
    if (!row.day.startsWith(month)) continue;
    const cost = userCost(row);
    if (cost === undefined) continue;
    perTester.set(row.tester, (perTester.get(row.tester) ?? 0) + cost);
  }
  const costs = [...perTester.values()].sort((a, b) => b - a);
  const total = costs.reduce((sum, c) => sum + c, 0);
  if (!total) return undefined;
  const top = Math.max(1, Math.ceil(costs.length / 10));
  return {
    users: costs.length,
    top,
    share: costs.slice(0, top).reduce((s, c) => s + c, 0) / total,
  };
}

/**
 * Kosten van deze maand per groep (zonder de testset; de eigenaar wel, die
 * zit op de beta): per omgeving en per manier van aanmelden.
 */
export function costSplit(
  rows: UsageRow[],
  via: Map<string, 'play' | 'turnstile'>,
  now = new Date(),
): { channel: Record<string, number>; via: Record<string, number> } {
  const month = dayOf(now).slice(0, 7);
  const split = { channel: {} as Record<string, number>, via: {} as Record<string, number> };
  for (const row of rows) {
    if (!row.session || !row.day.startsWith(month)) continue;
    const cost = rowCost(row);
    if (cost === undefined) continue;
    split.channel[row.channel] = (split.channel[row.channel] ?? 0) + cost;
    const how = row.tester === 'eigenaar' ? 'eigenaar' : (via.get(row.tester) ?? 'onbekend');
    split.via[how] = (split.via[how] ?? 0) + cost;
  }
  return split;
}

export interface UnitCostWeek {
  week: string;
  utterances: number;
  cost: number;
  /** Dollars per uitspraak; `undefined` zonder uitspraken */
  perUtterance?: number;
  /** Deel van de invoer aan het model dat uit de cache kwam (0–1) */
  cacheShare?: number;
}

const isTranscribe = (model: string) => model.includes('transcribe') || model === 'whisper-1';

/**
 * Kosten per uitspraak en cachegebruik per week, nieuwste eerst: maakt een
 * nieuwe promptversie het duurder? Alle sessies, ook die van de eigenaar
 * (het gaat om de prompt, niet om de gebruiker); zonder de testset.
 */
export function unitCostPerWeek(rows: UsageRow[], from: string, now = new Date()): UnitCostWeek[] {
  const weeks = new Map<
    string,
    { utterances: number; cost: number; cached: number; input: number }
  >();
  for (const row of rows) {
    if (!row.session) continue;
    const week = weekOf(row.day);
    const w = weeks.get(week) ?? { utterances: 0, cost: 0, cached: 0, input: 0 };
    w.cost += rowCost(row) ?? 0;
    if (isTranscribe(row.model)) w.utterances += row.requests;
    else {
      w.cached += row.cacheReadTokens;
      w.input += row.inputTokens + row.cacheReadTokens + row.cacheWriteTokens;
    }
    weeks.set(week, w);
  }
  const result: UnitCostWeek[] = [];
  for (let week = weekOf(dayOf(now)); week >= weekOf(from); week = addDays(week, -7)) {
    const w = weeks.get(week);
    if (!w) continue;
    result.push({
      week,
      utterances: w.utterances,
      cost: w.cost,
      perUtterance: w.utterances ? w.cost / w.utterances : undefined,
      cacheShare: w.input ? w.cached / w.input : undefined,
    });
  }
  return result;
}

export interface LimitPeaks {
  /** Meeste verzoeken aan het model door één installatie op één dag */
  messages: number;
  /** Meeste seconden spraak door één installatie op één dag */
  audioSeconds: number;
  /** Keren (installatie × dag) dat een plafond bereikt werd */
  hits: number;
}

/**
 * Hoe dicht gebruikers bij de plafonds per dag komen (src/lib/limits.ts),
 * deze maand, zonder de eigenaar (die valt erbuiten).
 */
export function limitPeaks(rows: UsageRow[], now = new Date()): LimitPeaks {
  const month = dayOf(now).slice(0, 7);
  const perDay = new Map<string, { messages: number; audio: number }>();
  for (const row of rows) {
    if (row.tester === 'eigenaar' || !row.day.startsWith(month)) continue;
    const key = `${row.day}/${row.tester}`;
    const d = perDay.get(key) ?? { messages: 0, audio: 0 };
    if (row.model.startsWith('claude-')) d.messages += row.requests;
    d.audio += row.audioSeconds;
    perDay.set(key, d);
  }
  const days = [...perDay.values()];
  return {
    messages: Math.max(0, ...days.map((d) => d.messages)),
    audioSeconds: Math.max(0, ...days.map((d) => d.audio)),
    hits: days.filter((d) => d.messages >= MESSAGES_PER_DAY || d.audio >= AUDIO_SECONDS_PER_DAY)
      .length,
  };
}

// --- Stap 2 (23 nov): per soort uitspraak, versie en taal, zoals de app ze
// meestuurt (`usageHeaders` in api.ts). Regels van vóór 23 nov hebben lege labels.

/** Een gewone gebruiker: niet de eigenaar, en niet de testset (geen sessie en geen soort) */
const fromUser = (row: UsageRow) => row.tester !== 'eigenaar' && (!!row.session || !!row.kind);

export interface KindCost {
  /** knop, trektel, tuintelling, proberen; leeg = onbekend (oudere versie) */
  kind: string;
  utterances: number;
  cost: number;
  perUtterance?: number;
}

/**
 * Kosten per functie deze maand, duurste eerst: wat kost een trektelling
 * tegenover de knop? Voor wat er achter de betaalde laag hoort. Zonder de
 * eigenaar en de testset; "Probeer het eens" (zonder sessie) wel.
 */
export function costPerKind(rows: UsageRow[], now = new Date()): KindCost[] {
  const month = dayOf(now).slice(0, 7);
  const kinds = new Map<string, { utterances: number; cost: number }>();
  for (const row of rows) {
    if (!row.day.startsWith(month) || !fromUser(row)) continue;
    const k = kinds.get(row.kind ?? '') ?? { utterances: 0, cost: 0 };
    k.cost += rowCost(row) ?? 0;
    if (isTranscribe(row.model)) k.utterances += row.requests;
    kinds.set(row.kind ?? '', k);
  }
  return [...kinds.entries()]
    .map(([kind, k]) => ({
      kind,
      ...k,
      perUtterance: k.utterances ? k.cost / k.utterances : undefined,
    }))
    .sort((a, b) => b.cost - a.cost);
}

/**
 * Welke versies van de app de laatste `days` dagen in gebruik waren, met het
 * aantal installaties: zitten na een release de meesten al op de nieuwe? Een
 * installatie die van versie wisselde, telt bij elk mee. Zonder de eigenaar.
 */
export function versionsInUse(
  rows: UsageRow[],
  days = 7,
  now = new Date(),
): { version: string; installs: number; lastDay: string }[] {
  const from = addDays(dayOf(now), -(days - 1));
  const versions = new Map<string, { testers: Set<string>; lastDay: string }>();
  for (const row of rows) {
    if (row.day < from || !row.version || !fromUser(row)) continue;
    const v = versions.get(row.version) ?? { testers: new Set<string>(), lastDay: row.day };
    v.testers.add(row.tester);
    if (row.day > v.lastDay) v.lastDay = row.day;
    versions.set(row.version, v);
  }
  return [...versions.entries()]
    .map(([version, v]) => ({ version, installs: v.testers.size, lastDay: v.lastDay }))
    .sort((a, b) => b.lastDay.localeCompare(a.lastDay) || b.installs - a.installs);
}

/** Uitspraken per taal deze maand (nl, en; leeg = onbekend), zonder de eigenaar en de testset */
export function utterancesPerLanguage(rows: UsageRow[], now = new Date()): Record<string, number> {
  const month = dayOf(now).slice(0, 7);
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (!row.day.startsWith(month) || !fromUser(row) || !isTranscribe(row.model)) continue;
    const language = row.language ?? '';
    result[language] = (result[language] ?? 0) + row.requests;
  }
  return result;
}

// --- Stap 3 (23 nov): anonieme cijfers per sessie (summaries.ts), zonder
// installatie. Per week waarin ze binnenkwamen: tot een week na het stoppen.

/** Wat de app per sessie stuurt (summaries.ts); hier, zodat de proxy het type kan gebruiken zonder browsercode */
export interface SessionSummary {
  /** Duur, afgerond op 5 minuten */
  minutes: number;
  utterances: number;
  observations: number;
  /** Aantal verschillende soorten, niet welke */
  species: number;
  /** Waarnemingen die (nog) onzeker zijn */
  uncertain: number;
  /** Uitspraken zonder waarneming (niet begrepen of niets in gezegd) */
  notUnderstood: number;
  /** Uitspraken die een eerdere waarneming veranderden, wisten of terugdraaiden */
  corrections: number;
  /** Uitspraken die mislukten */
  failed: number;
  /** Waarnemingen die nagelopen of geëxporteerd zijn */
  reviewed: number;
  /** Ergens op bereik gewacht */
  offline: boolean;
  trektel: boolean;
  tuintelling: boolean;
  exported: 'none' | 'waarneming' | 'ebird' | 'both';
  platform: 'android' | 'web';
}

/** Een samenvatting zoals de proxy hem teruggeeft (worker/summaries.ts) */
export interface SummaryRow {
  week: string;
  cohort: string;
  platform: string;
  minutes: number;
  utterances: number;
  observations: number;
  species: number;
  uncertain: number;
  notUnderstood: number;
  corrections: number;
  failed: number;
  reviewed: number;
  offline: boolean;
  trektel: boolean;
  tuintelling: boolean;
  exported: string;
}

export interface SessionStats {
  /** Maandag van de week, of `alle` */
  week: string;
  sessions: number;
  /** Mediaan van de duur in minuten */
  minutes: number;
  /** Gemiddeld per sessie */
  utterances: number;
  /** Delen (0–1): van de uitspraken, de waarnemingen of de sessies */
  notUnderstood: number;
  corrections: number;
  failed: number;
  uncertain: number;
  reviewed: number;
  exported: number;
  offline: number;
  android: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function sessionStats(week: string, rows: SummaryRow[]): SessionStats {
  const sum = (key: keyof SummaryRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
  const share = (part: number, whole: number) => (whole ? part / whole : 0);
  const utterances = sum('utterances');
  const observations = sum('observations');
  return {
    week,
    sessions: rows.length,
    minutes: median(rows.map((r) => r.minutes)),
    utterances: share(utterances, rows.length),
    notUnderstood: share(sum('notUnderstood'), utterances),
    corrections: share(sum('corrections'), utterances),
    failed: share(sum('failed'), utterances),
    uncertain: share(sum('uncertain'), observations),
    reviewed: share(sum('reviewed'), observations),
    exported: share(rows.filter((r) => r.exported !== 'none').length, rows.length),
    offline: share(rows.filter((r) => r.offline).length, rows.length),
    android: share(rows.filter((r) => r.platform === 'android').length, rows.length),
  };
}

/**
 * Per week de cijfers van de sessies die binnenkwamen, nieuwste eerst, plus
 * alles samen (`alle`) als laatste. Alleen weken met samenvattingen.
 */
export function perSessionWeek(rows: SummaryRow[]): SessionStats[] {
  const weeks = new Map<string, SummaryRow[]>();
  for (const row of rows) weeks.set(row.week, [...(weeks.get(row.week) ?? []), row]);
  return [
    ...[...weeks.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([week, list]) => sessionStats(week, list)),
    ...(rows.length ? [sessionStats('alle', rows)] : []),
  ];
}
