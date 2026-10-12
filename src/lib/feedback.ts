import type { Utterance } from './db';
import { logEvent } from './log';

// Trilfeedback, zodat je in het veld niet naar het scherm hoeft te kijken.
// Patronen in milliseconden: tril, pauze, tril, …

const PATTERNS = {
  /** Opname gestart: een heel kort tikje */
  recording: [30],
  /**
   * Opname gestopt en bewaard: hetzelfde tikje, zoals een portofoon (aan, uit).
   * Komt vrijwel altijd door, want je raakt het scherm net aan; de uitkomst hieronder
   * niet als de app intussen op de achtergrond staat.
   */
  recorded: [30],
  /** Opgeslagen (ook een dev note of een correctie): één korte tril */
  saved: [120],
  /** Opgeslagen maar onzeker: kort, lang */
  uncertain: [120, 150, 450],
  /** Niet begrepen (geen waarneming gevonden): twee korte */
  ignored: [120, 150, 120],
  /** Fout bij verwerken (geen verbinding, time-out): drie korte */
  failed: [120, 150, 120, 150, 120],
  /** Easter egg "zeemeeuw": boos gepik */
  angry: [70, 40, 70, 40, 70, 40, 250, 80, 70, 40, 70, 40, 400],
};

export type Feedback = keyof typeof PATTERNS;

/**
 * Trilt, als het apparaat dat kan. Chrome weigert als de app op de achtergrond
 * staat of als je de pagina sinds het openen nog niet hebt aangeraakt; dat
 * komt in het gebeurtenissenlog.
 */
export function vibrate(feedback: Feedback): void {
  if (!navigator.vibrate) return;
  if (!navigator.vibrate(PATTERNS[feedback])) {
    logEvent('vibrate_blocked', {
      feedback,
      hidden: document.hidden,
      userActivation: navigator.userActivation?.hasBeenActive,
    });
  }
}

/** Het patroon dat bij de uitkomst van een verwerkte uitspraak hoort. */
export function utteranceFeedback(utterance: Pick<Utterance, 'status' | 'result'>): Feedback {
  if (utterance.status === 'failed') return 'failed';
  if (utterance.result === 'ignored') return 'ignored';
  if (utterance.result === 'uncertain') return 'uncertain';
  return 'saved';
}
