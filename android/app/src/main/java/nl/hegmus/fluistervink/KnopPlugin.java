package nl.hegmus.fluistervink;

import android.view.KeyEvent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * De volumeknoppen als inspreekknop (docs/roadmap-android.md, stap 1).
 * Alleen als de webcode hem aanzet: tijdens een sessie, met de instelling aan
 * (src/lib/volumeKey.ts). Dan vangt MainActivity de volumetoetsen op en geeft
 * elke druk als gebeurtenis "druk" door; het volume verandert dan niet.
 * Bluetooth-sluiterknopjes sturen dezelfde toets, dus die werken ook.
 * Alleen met de app op het scherm: met het scherm uit gaan de toetsen naar
 * Android zelf (dat komt pas met stap 3).
 */
@CapacitorPlugin(name = "Knop")
public class KnopPlugin extends Plugin {

    private static KnopPlugin instance;
    private static volatile boolean active = false;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void aan(PluginCall call) {
        active = true;
        call.resolve();
    }

    @PluginMethod
    public void uit(PluginCall call) {
        active = false;
        call.resolve();
    }

    /**
     * Aangeroepen door MainActivity voor elke toets. True = opgevangen, dan
     * doet Android er verder niets mee (geen volumebalk).
     */
    static boolean handle(KeyEvent event) {
        int code = event.getKeyCode();
        if (!active || instance == null) return false;
        if (code != KeyEvent.KEYCODE_VOLUME_UP && code != KeyEvent.KEYCODE_VOLUME_DOWN) return false;
        // Alleen het indrukken telt; vasthouden (herhaling) en loslaten slikken
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            JSObject data = new JSObject();
            data.put("toets", code == KeyEvent.KEYCODE_VOLUME_UP ? "volume_up" : "volume_down");
            instance.notifyListeners("druk", data);
        }
        return true;
    }
}
