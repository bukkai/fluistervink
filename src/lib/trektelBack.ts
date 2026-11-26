/**
 * Terugknop tijdens een trektelling (feedback 26 nov): de Android-terugknop
 * (MainActivity: een pagina terug in de WebView) of terug in de browser ging
 * zonder vraag naar het vorige scherm, en daar stopt de telling. Links in de app
 * vragen het al (`guardTrektel` in App.svelte); dit doet hetzelfde voor terug.
 *
 * Hoe: zolang de telling loopt, staat er een extra stap in de geschiedenis op
 * hetzelfde adres (`trektelBack` in `history.state`). Terug haalt eerst die stap
 * weg; dan vraagt de app. Nee: de stap komt terug en de telling loopt door. Ja:
 * de telling stopt en de app gaat alsnog terug. Werkt in de app en in de
 * browser, zonder native code.
 *
 * Na de telling blijft de stap soms staan (gestopt met de knop, of weg via een
 * link). Hij heeft hetzelfde adres als het scherm eronder, dus terug zou dan
 * niets lijken te doen: die keer gaat de app er zelf nog een stap overheen.
 */
const GUARD = 'trektelBack';

export interface TrektelBackGuard {
  /** Telling begonnen: de extra stap zetten (één keer) */
  arm(): void;
  /** Telling gestopt */
  disarm(): void;
  dispose(): void;
}

function onGuard(): boolean {
  return (history.state as Record<string, unknown> | null)?.[GUARD] === true;
}

export function trektelBackGuard(options: {
  /** Loopt er een trektelling (ook gepauzeerd of aan het starten)? */
  active: () => boolean;
  /** Vraag of de gebruiker toch weg wil */
  ask: () => boolean;
  /** De telling stoppen, vóór het teruggaan */
  stop: () => void;
}): TrektelBackGuard {
  let armed = false;
  /** Bij het stoppen stond de extra stap bovenaan, op dit adres */
  let staleAt: string | undefined;

  const onPopState = () => {
    if (onGuard()) {
      // Terug op de extra stap (een editor gesloten, of vanaf een ander
      // scherm): loopt de telling, dan is er niets te doen; anders overslaan
      if (!options.active()) history.back();
      return;
    }
    if (staleAt !== undefined) {
      const same = staleAt === location.href;
      staleAt = undefined;
      if (same) history.back();
      return;
    }
    if (!armed || !options.active()) return;
    if (options.ask()) {
      armed = false;
      options.stop();
      history.back();
    } else {
      history.pushState({ [GUARD]: true }, '');
    }
  };
  // Een ander scherm via een link: de oude stap is dan niet meer bovenaan
  const onHashChange = () => (staleAt = undefined);
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);

  return {
    arm() {
      if (armed) return;
      // Een open editor (SessionLog, UncertainReview) gebruikt zelf een stap;
      // daarbovenop zou terug eerst deze weghalen in plaats van de editor
      // sluiten. Dan niet bewaken (zeldzaam: de telling start je zonder editor).
      const state = history.state as Record<string, unknown> | null;
      if (state?.editor) return;
      armed = true;
      staleAt = undefined;
      if (!onGuard()) history.pushState({ [GUARD]: true }, '');
    },
    disarm() {
      if (!armed) return;
      armed = false;
      if (onGuard()) staleAt = location.href;
    },
    dispose() {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
    },
  };
}
