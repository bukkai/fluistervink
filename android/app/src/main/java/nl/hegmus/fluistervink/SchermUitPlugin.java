package nl.hegmus.fluistervink;

import android.content.Context;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.json.JSONException;

/**
 * Proef: opnemen met het scherm uit (docs/roadmap-android.md stap 3,
 * ontwikkeloptie "schermUit" in src/lib/devOptions.ts). De webcode zet het
 * aan zolang een sessie loopt (src/lib/screenOff.svelte.ts); dan neemt
 * WandelingService op als de volumeknop met het scherm uit wordt ingedrukt.
 *
 * Elke opname staat eerst als bestand op de telefoon en gaat dan als
 * gebeurtenis "opname" naar de webcode (base64, ±250 kB per minuut). De
 * webcode bewaart hem in IndexedDB en zegt dan `klaar`, waarna het bestand
 * weg mag. Mist de webcode hem (app gesloten), dan haalt `wachtend` hem later.
 */
@CapacitorPlugin(name = "SchermUit")
public class SchermUitPlugin extends Plugin implements WandelingService.Listener {

    @Override
    public void load() {
        WandelingService.listener = this;
    }

    /** Aanzetten: { sessieId, maxMs, minMs, trilStart, trilStop } */
    @PluginMethod
    public void aan(PluginCall call) {
        WandelingService.Config config = new WandelingService.Config();
        config.sessionId = call.getString("sessieId", "onbekend");
        config.maxMs = call.getLong("maxMs", 180_000L);
        config.minMs = call.getLong("minMs", 500L);
        try {
            config.trilStart = pattern(call.getArray("trilStart"));
            config.trilStop = pattern(call.getArray("trilStop"));
        } catch (JSONException e) {
            call.reject("Ongeldig trilpatroon");
            return;
        }
        Context context = getContext();
        JSObject result = new JSObject();
        if (!WandelingService.hasMicrophone(context)) {
            // De webknop vraagt de toestemming; tot dan kan dit niet
            result.put("ok", false);
            result.put("reden", "geen microfoontoestemming");
            call.resolve(result);
            return;
        }
        WandelingService.config = config;
        WandelingService service = WandelingService.instance;
        if (service == null) {
            // De service start bij de sessie (WandelingPlugin); dan neemt hij dit mee
            result.put("ok", false);
            result.put("reden", "service draait niet");
            call.resolve(result);
            return;
        }
        service.arm();
        result.put("ok", service.microphoneReady());
        if (WandelingService.microphoneError != null) result.put("reden", WandelingService.microphoneError);
        call.resolve(result);
    }

    @PluginMethod
    public void uit(PluginCall call) {
        WandelingService service = WandelingService.instance;
        if (service != null) service.disarm();
        else WandelingService.config = null;
        WandelingService.webRecording = false;
        call.resolve();
    }

    /** Een lopende opname stoppen (de knop in de app, terwijl het scherm weer aan is) */
    @PluginMethod
    public void stop(PluginCall call) {
        WandelingService service = WandelingService.instance;
        if (service != null) service.finish("app");
        call.resolve();
    }

    /** De webcode neemt zelf op, of niet meer: { bezig } */
    @PluginMethod
    public void webOpname(PluginCall call) {
        WandelingService.webRecording = Boolean.TRUE.equals(call.getBoolean("bezig", false));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("opneemt", WandelingService.isRecording());
        call.resolve(result);
    }

    /** Opnames die de webcode nog niet bewaard heeft */
    @PluginMethod
    public void wachtend(PluginCall call) {
        File[] files = WandelingService.directory(getContext()).listFiles((dir, name) -> name.endsWith(".m4a"));
        JSArray list = new JSArray();
        if (files != null) {
            for (File file : files) {
                JSObject item = payload(file, new JSObject());
                if (item != null) list.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("opnames", list);
        call.resolve(result);
    }

    /** De webcode heeft de opname bewaard: het bestand mag weg */
    @PluginMethod
    public void klaar(PluginCall call) {
        String id = call.getString("id", "");
        // Alleen een bestandsnaam uit de eigen map
        if (id.contains("/") || !id.endsWith(".m4a")) {
            call.reject("Ongeldig id");
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        new File(WandelingService.directory(getContext()), id).delete();
        call.resolve();
    }

    // --- Van de service naar de webcode ---

    @Override
    public void gestart(long startedAt, String via) {
        JSObject data = new JSObject();
        data.put("startedAt", startedAt);
        data.put("via", via);
        notifyListeners("gestart", data, true);
    }

    @Override
    public void opname(File file, JSObject info) {
        // Lezen en omzetten niet op de hoofdthread
        new Thread(() -> {
            JSObject data = payload(file, info);
            if (data == null) return; // blijft liggen voor `wachtend`
            data.put("verstuurdAt", System.currentTimeMillis());
            notifyListeners("opname", data, true);
        }, "OpnameNaarWeb").start();
    }

    @Override
    public void druk(String via) {
        JSObject data = new JSObject();
        data.put("via", via);
        // Niet bewaren voor later: een oude druk zou een nieuwe opname stoppen
        notifyListeners("druk", data);
    }

    @Override
    public void log(String type, JSObject data) {
        JSObject event = new JSObject();
        event.put("type", type);
        event.put("data", data);
        notifyListeners("log", event, true);
    }

    /** { id, sessieId, startedAt, durationMs, type, data } uit de bestandsnaam en het bestand */
    private static JSObject payload(File file, JSObject info) {
        String[] parts = file.getName().replace(".m4a", "").split("_");
        if (parts.length != 3) return null;
        try {
            byte[] bytes = new byte[(int) file.length()];
            try (InputStream in = new FileInputStream(file)) {
                int offset = 0;
                while (offset < bytes.length) {
                    int read = in.read(bytes, offset, bytes.length - offset);
                    if (read < 0) break;
                    offset += read;
                }
            }
            info.put("id", file.getName());
            info.put("sessieId", parts[0]);
            info.put("startedAt", Long.parseLong(parts[1]));
            info.put("durationMs", Long.parseLong(parts[2]));
            info.put("type", Opname.MIME);
            info.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            return info;
        } catch (IOException | NumberFormatException e) {
            return null;
        }
    }

    /** Patroon zoals navigator.vibrate → Android: [pauze, tril, pauze, …] */
    private static long[] pattern(JSArray input) throws JSONException {
        if (input == null) return new long[] { 0, 30 };
        long[] timings = new long[input.length() + 1];
        for (int i = 0; i < input.length(); i++) timings[i + 1] = input.getLong(i);
        return timings;
    }
}
