package nl.hegmus.fluistervink;

import android.content.Context;
import android.util.AttributeSet;
import android.util.Log;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

/**
 * Proef (ontwikkeloptie "schermUit", alleen de beta-build): de WebView blijft
 * zich "in beeld" melden zolang een sessie met het scherm uit loopt.
 *
 * Chromium zet de pagina een minuut nadat de WebView meldt dat hij niet meer
 * in beeld is stil (Page Lifecycle "freeze"); de stukken van een trektelling
 * worden dan pas bij het ontgrendelen verwerkt, zonder tril of gesproken
 * bevestiging (gemeten 18 en 19 nov, `page_frozen`). Een hogere voorrang voor
 * het proces van de WebView (`setRendererPriorityPolicy`) hielp niet: het is
 * Chromium zelf, niet Android. De WebView hoort van het vergrendelen via
 * `onWindowVisibilityChanged`; zolang `zichtbaarHouden` aan staat, geven we
 * hem daar VISIBLE door. Gaat de optie uit, dan krijgt hij de echte stand.
 *
 * Staat in de layout van Capacitor (res/layout/capacitor_bridge_layout_main.xml
 * vervangt die van Capacitor). Zonder SchermUitPlugin (de stabiele build)
 * zet niemand `zichtbaarHouden` aan, en is dit gewoon de WebView van Capacitor.
 */
public class ZichtbareWebView extends CapacitorWebView {

    private static final String TAG = "ZichtbareWebView";

    private boolean zichtbaarHouden = false;
    /** Zo vaak een melding "niet in beeld" tegengehouden, voor het log */
    private int tegengehouden = 0;

    public ZichtbareWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    /** Aan of uit; uit geeft de WebView meteen de echte stand. Op de main thread. */
    void zichtbaarHouden(boolean aan) {
        if (zichtbaarHouden == aan) return;
        zichtbaarHouden = aan;
        if (!aan) super.onWindowVisibilityChanged(getWindowVisibility());
    }

    /** Hoe vaak sinds het aanzetten; zet de teller terug. */
    int tegengehoudenEnTerug() {
        int aantal = tegengehouden;
        tegengehouden = 0;
        return aantal;
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        if (zichtbaarHouden && visibility != View.VISIBLE) {
            tegengehouden++;
            Log.i(TAG, "niet in beeld (" + visibility + "), blijft zichtbaar");
            super.onWindowVisibilityChanged(View.VISIBLE);
            return;
        }
        super.onWindowVisibilityChanged(visibility);
    }
}
