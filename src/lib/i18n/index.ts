import { nl } from './nl';

// Teksten van de schermen, per taal in een woordenboek (docs/plan-engels.md,
// stap 1). Nu is er alleen Nederlands; `nl.ts` is de bron, een volgende taal
// krijgt een eigen bestand met hetzelfde type (`Dictionary`), zodat TypeScript
// een vergeten tekst meldt.
//
// Lange pagina's (uitleg, privacy, welkom, Probeer het eens), de changelog en
// de schermen van de eigenaar (Developer, Statistieken, ontwikkelopties) staan
// hier bewust niet in: zie het plan.
//
// Wisselen van taal laadt de app opnieuw, dus `t()` hoeft niet reactief te zijn.

/** Een tekst, of per meervoudsvorm (`Intl.PluralRules`) als hij met `{n}` telt */
export type Entry = string | { one: string; other: string };

export type Key = keyof typeof nl;
export type Dictionary = Record<Key, Entry>;

export type Language = 'nl';

export const language: Language = 'nl';

/** Voor `Intl.DateTimeFormat` en `Intl.NumberFormat` */
export const LOCALE = 'nl-NL';

const dictionaries: Record<Language, Dictionary> = { nl };
const plurals = new Intl.PluralRules(LOCALE);

type Params = Record<string, string | number>;

/**
 * De tekst bij `key` in de taal van de app. `{naam}` wordt vervangen door
 * `params.naam`; heeft de tekst een enkel- en meervoud, dan kiest `params.n`.
 * Een parameter die niet meegegeven is, blijft als `{naam}` staan, zodat het
 * opvalt.
 */
export function t(key: Key, params: Params = {}): string {
  const entry = dictionaries[language][key];
  const text =
    typeof entry === 'string'
      ? entry
      : plurals.select(Number(params.n ?? 0)) === 'one'
        ? entry.one
        : entry.other;
  return text.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in params ? String(params[name]) : all,
  );
}
