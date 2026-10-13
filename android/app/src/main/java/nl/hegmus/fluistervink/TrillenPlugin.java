package nl.hegmus.fluistervink;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/**
 * Trilpatronen voor de webcode (src/lib/native.ts). Chrome trilt alleen als
 * "Touch feedback" van Android aan staat en de app op het scherm staat. Hier
 * trilt de app als een melding: los van die instelling, en (met de foreground
 * service van fase 2) ook op de achtergrond. Wel stil bij "Niet storen".
 */
@CapacitorPlugin(name = "Trillen")
public class TrillenPlugin extends Plugin {

    /** Patroon zoals navigator.vibrate: tril, pauze, tril, … in ms. */
    @PluginMethod
    public void patroon(PluginCall call) {
        JSArray input = call.getArray("patroon");
        if (input == null || input.length() == 0) {
            call.reject("Geen patroon");
            return;
        }

        // Android begint met een pauze: [0, tril, pauze, tril, …]
        long[] timings = new long[input.length() + 1];
        try {
            for (int i = 0; i < input.length(); i++) timings[i + 1] = input.getLong(i);
        } catch (JSONException e) {
            call.reject("Ongeldig patroon");
            return;
        }

        Vibrator vibrator = vibrator();
        JSObject result = new JSObject();
        if (vibrator == null || !vibrator.hasVibrator()) {
            result.put("ok", false);
            call.resolve(result);
            return;
        }

        VibrationEffect effect = VibrationEffect.createWaveform(timings, -1);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_NOTIFICATION));
        } else {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            vibrator.vibrate(effect, attributes);
        }
        result.put("ok", true);
        call.resolve(result);
    }

    private Vibrator vibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }
}
