import { devOptionOn } from '../devOptions';
import { en } from './en';
import { nl } from './nl';

// Teksten van de schermen, per taal in een woordenboek (docs/plan-engels.md).
// `nl.ts` is de bron; `en.ts` heeft hetzelfde type (`Dictionary`), zodat
// TypeScript een vergeten tekst meldt.
//
// Engels staat voorlopig alleen achter de ontwikkeloptie "English" (stap 3).
// Lange pagina's (uitleg, privacy, welkom, Probeer het eens), de changelog en
// de schermen van de eigenaar (Developer, Statistieken, ontwikkelopties) staan
// hier bewust niet in en blijven Nederlands: zie het plan.
//
// Wisselen van taal laadt de app opnieuw, dus `t()` hoeft niet reactief te zijn.

/** Een tekst, of per meervoudsvorm (`Intl.PluralRules`) als hij met `{n}` telt */
export type Entry = string | { one: string; other: string };

export type Key = keyof typeof nl;
export type Dictionary = Record<Key, Entry>;

export type Language = 'nl' | 'en';

/** Taal van de app: van het scherm én van het inspreken (één keuze, zie het plan) */
export const language: Language = devOptionOn('english') ? 'en' : 'nl';

const LOCALES: Record<Language, string> = { nl: 'nl-NL', en: 'en-GB' };

/** Voor `Intl.DateTimeFormat` en `Intl.NumberFormat` */
export const LOCALE = LOCALES[language];

const dictionaries: Record<Language, Dictionary> = { nl, en };
const plurals = Object.fromEntries(
  Object.entries(LOCALES).map(([lang, locale]) => [lang, new Intl.PluralRules(locale)]),
) as Record<Language, Intl.PluralRules>;

type Params = Record<string, string | number>;

/** Zoals `t()`, in een gegeven taal (voor tests en vergelijken) */
export function translate(lang: Language, key: Key, params: Params = {}): string {
  const entry = dictionaries[lang][key];
  const text =
    typeof entry === 'string'
      ? entry
      : plurals[lang].select(Number(params.n ?? 0)) === 'one'
        ? entry.one
        : entry.other;
  return text.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in params ? String(params[name]) : all,
  );
}

/**
 * De tekst bij `key` in de taal van de app. `{naam}` wordt vervangen door
 * `params.naam`; heeft de tekst een enkel- en meervoud, dan kiest `params.n`.
 * Een parameter die niet meegegeven is, blijft als `{naam}` staan, zodat het
 * opvalt.
 */
export function t(key: Key, params: Params = {}): string {
  return translate(language, key, params);
}
