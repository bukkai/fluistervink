// Persoonsgegevens weglaten uit wat naar de ontwikkelaar gaat (share.ts;
// docs/plan-robuustheid.md, #18). Aanleiding: een tester sprak op 20 nov
// "feedback, mijn BSN-nummer is …" in, en dat ging mee.
//
// Alleen wat zeker geen waarneming is: lange cijferreeksen (BSN,
// telefoonnummer, rekeningnummer, IBAN) en e-mailadressen. Namen en adressen
// zijn niet betrouwbaar te herkennen; daarvoor zegt de privacypagina "spreek
// geen persoonsgegevens in". Op de telefoon zelf blijft alles zoals het was.

export const REDACTED = '[weggelaten]';

const PATTERNS: RegExp[] = [
  // E-mailadres
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  // IBAN: landcode, controlegetal, bankcode; de cijfers erna vangt de regel hieronder ook
  /(?<![\w])[A-Z]{2}\s?\d{2}\s?[A-Z]{4}(?:\s?\d){7,}(?![\w])/gi,
  // Acht of meer cijfers, ook met spaties of punten ertussen: BSN, telefoon,
  // rekeningnummer. Aantallen ("30.000", "1.200.000") hebben er minder, en een
  // datum met streepjes valt erbuiten. Niet midden in een woord (id's).
  /(?<![\w])\+?\d(?:[\s.]?\d){7,}(?![\w])/g,
];

/** Bevat de tekst iets dat op een persoonsgegeven lijkt? */
export function hasPersonalData(text: string | undefined): boolean {
  return !!text && redactText(text) !== text;
}

/** De tekst met cijferreeksen en e-mailadressen vervangen door [weggelaten]. */
export function redactText(text: string): string {
  return PATTERNS.reduce((result, pattern) => result.replace(pattern, REDACTED), text);
}

/** Alle teksten in een waarde (object, lijst) door `redactText`; de rest blijft. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        // Id's en versies niet: een uuid of hash kan toevallig een lange
        // cijferreeks bevatten, en zonder klopt de gedeelde sessie niet meer
        isReference(key) ? inner : redactDeep(inner),
      ]),
    ) as T;
  }
  return value;
}

const isReference = (key: string) => /^(id|.+Id|.+_id|.+Version)$/.test(key);
