// Typen tijdens een sessie: zolang het toetsenbord open is, staat het waar de
// inspreekknop zit, dus die gaat dan weg (ActiveSession.svelte).

/** Een veld waarvoor het toetsenbord opengaat (geen keuzelijst of vinkje) */
export function isTextField(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'color'].includes(
    element.type,
  );
}

/** Zoveel moet het zichtbare deel krimpen voordat het toetsenbord open telt */
const KEYBOARD_MIN_PX = 100;
/** Zo dicht bij de hoogte van voor het aantikken telt het als weer dicht */
const CLOSED_MARGIN_PX = 50;

export interface KeyboardClosed {
  /** Hoogte bij het aantikken, de kleinste daarna, en nu */
  before: number;
  smallest: number;
  height: number;
}

/**
 * Houdt bij of er getypt wordt (`onTyping`). Toetsenbord dicht (terugknop of
 * -veeg op Android) zonder dat het veld zijn focus verliest: dan zou de knop
 * weg blijven. Laat het veld dan los, maar alleen als het toetsenbord eerst
 * echt open was: het zichtbare deel van het scherm kromp na het aantikken
 * flink en is nu weer terug op de hoogte van toen. Eerder telde elke groei, en
 * in de Android-app verloor het veld dan meteen na het aantikken zijn focus
 * (feedback 13 nov). Geeft een functie om te stoppen.
 */
export function watchKeyboard(
  onTyping: (typing: boolean) => void,
  onClosed: (sizes: KeyboardClosed) => void,
  viewport: VisualViewport | null = window.visualViewport,
): () => void {
  /** Hoogte bij het aantikken, en de kleinste daarna */
  let before: number | undefined;
  let smallest = Infinity;
  function onFocusIn(event: FocusEvent) {
    const typing = isTextField(event.target as Element);
    onTyping(typing);
    if (!typing || !viewport) return;
    before = viewport.height;
    smallest = before;
  }
  function onFocusOut() {
    before = undefined;
    // Even later, naar wat dan de focus heeft: naar een ander veld is nog
    // steeds typen, en sluit een waarneming terwijl een veld de focus had,
    // dan komt dit midden in het opruimen, waar Svelte geen state toestaat
    queueMicrotask(() => onTyping(isTextField(document.activeElement)));
  }
  function onResize() {
    const field = document.activeElement;
    if (before === undefined || !viewport || !isTextField(field)) return;
    const height = viewport.height;
    smallest = Math.min(smallest, height);
    const keyboardWasOpen = before - smallest > KEYBOARD_MIN_PX;
    if (keyboardWasOpen && height >= before - CLOSED_MARGIN_PX) {
      onClosed({ before, smallest, height });
      field.blur();
    }
  }
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  viewport?.addEventListener('resize', onResize);
  return () => {
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    viewport?.removeEventListener('resize', onResize);
  };
}
