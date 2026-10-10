import type { Utterance } from './db';

// Trilfeedback, zodat je in het veld niet naar het scherm hoeft te kijken.
// Patronen in milliseconden: tril, pauze, tril, …

const PATTERNS = {
  /** Opname gestart: een heel kort tikje */
  recording: [30],
  /** Opgeslagen (ook een dev note of een correctie): één korte tril */
  saved: [120],
  /** Opgeslagen maar onzeker: kort, lang */
  uncertain: [120, 150, 450],
  /** Niet begrepen (geen waarneming gevonden): twee korte */
  ignored: [120, 150, 120],
  /** Fout bij verwerken (geen verbinding, time-out): drie korte */
  failed: [120, 150, 120, 150, 120],
};

export type Feedback = keyof typeof PATTERNS;

/** Trilt, als het apparaat dat kan. Werkt niet als de app op de achtergrond staat. */
export function vibrate(feedback: Feedback): void {
  navigator.vibrate?.(PATTERNS[feedback]);
}

/** Het patroon dat bij de uitkomst van een verwerkte uitspraak hoort. */
export function utteranceFeedback(utterance: Pick<Utterance, 'status' | 'result'>): Feedback {
  if (utterance.status === 'failed') return 'failed';
  if (utterance.result === 'ignored') return 'ignored';
  if (utterance.result === 'uncertain') return 'uncertain';
  return 'saved';
}
