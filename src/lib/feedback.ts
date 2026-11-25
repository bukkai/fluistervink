import type { Utterance } from './db';
import { logEvent } from './log';
import { isNativeApp, vibrateNative } from './native';

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
  /**
   * Opname gestart met het scherm uit (proef, screenOff.svelte.ts): het tikje
   * hierboven voel je in een broekzak niet (17 nov). Twee snelle tikjes, sneller
   * dan "niet begrepen".
   */
  screenOffStart: [40, 60, 40],
  /** Opname gestopt met het scherm uit: één stevige tril, korter dan "gepauzeerd" */
  screenOffStop: [200],
  /** Opgeslagen (ook een dev note of een correctie): één korte tril */
  saved: [120],
  /** Opgeslagen maar onzeker: kort, lang */
  uncertain: [120, 150, 450],
  /** Niet begrepen (geen waarneming gevonden): twee korte */
  ignored: [120, 150, 120],
  /**
   * Bewaard, wacht op bereik (geen verbinding, docs/archief/plan-offline.md): lang, kort,
   * het spiegelbeeld van onzeker. Bij het begin van het wachten en bij elke
   * uitspraak zolang er gewacht wordt.
   */
  waiting: [450, 150, 120],
  /** Fout bij verwerken (wachten helpt niet, bv. het plafond per dag): drie korte */
  failed: [120, 150, 120, 150, 120],
  /** Trektelling vanzelf gestopt (maximum bereikt, app naar de achtergrond): twee lange */
  trektelStopped: [500, 200, 500],
  /** Trektelling gepauzeerd (naar een andere app of scherm op slot): één lange */
  trektelPaused: [500],
  /** Tuintelling: nog vijf minuten (tuintelling.ts): twee middellange */
  tuintelBijna: [300, 200, 300],
  /** Tuintelling: het half uur is om, de sessie stopt vanzelf: drie lange */
  tuintelKlaar: [500, 200, 500, 200, 500],
  /** Easter egg "zeemeeuw": boos gepik */
  angry: [70, 40, 70, 40, 70, 40, 250, 80, 70, 40, 70, 40, 400],
  /** Easter egg #tocheenbuizerd: de roep van de buizerd, een lange klagende "pieeeuw" */
  buizerd: [700, 120, 300],
  /** Easter egg lifer: feest, drie korte en een lange */
  party: [80, 60, 80, 60, 80, 60, 500],
};

export type Feedback = keyof typeof PATTERNS;

/** Het patroon zelf, voor de service die zonder de webcode trilt (opnemen met het scherm uit) */
export function vibrationPattern(feedback: Feedback): number[] {
  return PATTERNS[feedback];
}

/**
 * Kan dit toestel trillen? De Android-app altijd; in de browser alleen een
 * telefoon (aanraakscherm) met de Vibration API. Chrome op een laptop heeft
 * `navigator.vibrate` wel, maar daar trilt niets; Safari op de iPhone heeft
 * hem niet. Voor teksten die over trillen gaan.
 */
export function canVibrate(): boolean {
  if (isNativeApp) return true;
  if (typeof navigator.vibrate !== 'function') return false;
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * Trilt, als het apparaat dat kan. In de Android-app via Android zelf; in de
 * browser weigert Chrome als de app op de achtergrond staat of als je de
 * pagina sinds het openen nog niet hebt aangeraakt. Weigeren komt in het
 * gebeurtenissenlog.
 */
export function vibrate(feedback: Feedback): void {
  if (isNativeApp) {
    vibrateNative(PATTERNS[feedback]).then((ok) => {
      if (!ok) logEvent('vibrate_blocked', { feedback, hidden: document.hidden, native: true });
    });
    return;
  }
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

/**
 * Een trektelstuk waarin niets verstaan is (geruis, de tik op Stop): de app
 * knipte het zelf, de gebruiker probeerde niets te zeggen. Dan geen "niet
 * begrepen" (feedback 12 nov).
 */
export function isEmptyTrektelChunk(
  utterance: Pick<Utterance, 'trektel' | 'transcript' | 'result'>,
): boolean {
  return !!utterance.trektel && utterance.result === 'ignored' && !utterance.transcript?.trim();
}
