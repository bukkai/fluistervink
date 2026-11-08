// Statistieken (scherm Statistieken, alleen de eigenaar): hoeveel mensen de
// app gebruiken en of ze terugkomen. Uit de usage-tabel die de proxy toch al
// bijhoudt voor de kosten (worker/usage.ts, /api/stats), dus zonder een nieuw
// gegeven te verzamelen. "Gebruiken" = minstens één uitspraak in een sessie;
// alleen thuis nalopen telt niet mee.

import { dayOf } from './costs';

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
