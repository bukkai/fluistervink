package nl.hegmus.fluistervink;

import android.app.StatusBarManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;

/**
 * Snelkoppeling "Begin met vogelen" (lang drukken op het app-pictogram;
 * docs/roadmap-android.md, stap 1). De webcode zet hem aan of uit
 * (src/lib/shortcut.ts), zodat hij eerst alleen bij de eigenaar verschijnt.
 * Tikken opent de app met een extra in de intent; de webcode haalt die op
 * met wachtend() (koude start) of krijgt hem als gebeurtenis "actie" (de app
 * draaide al, launchMode singleTask). Dezelfde intent gebruikt de tegel in de
 * snelle instellingen (BeginTegel); tegelVragen() biedt aan hem toe te voegen.
 */
@CapacitorPlugin(name = "Snelkoppeling")
public class SnelkoppelingPlugin extends Plugin {

    private static final String EXTRA = "nl.hegmus.fluistervink.SNELKOPPELING";
    private static final String BEGIN = "begin";

    /** Actie uit de intent waarmee de app opende, tot de webcode hem ophaalt */
    private String pending;

    @Override
    public void load() {
        if (getActivity() != null) pending = actionOf(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String action = actionOf(intent);
        if (action == null) return;
        // Luistert de webcode nog niet (net opgestart), dan bewaren voor wachtend()
        if (!hasListeners("actie")) {
            pending = action;
            return;
        }
        JSObject data = new JSObject();
        data.put("actie", action);
        notifyListeners("actie", data);
    }

    @PluginMethod
    public void zetten(PluginCall call) {
        Context context = getContext();
        boolean on = Boolean.TRUE.equals(call.getBoolean("aan", false));
        try {
            if (on) {
                Intent intent = beginIntent(context);
                ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, BEGIN)
                    .setShortLabel("Begin met vogelen")
                    .setLongLabel("Begin met vogelen")
                    .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                    .setIntent(intent)
                    .build();
                ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);
            } else {
                ShortcutManagerCompat.removeDynamicShortcuts(context, Collections.singletonList(BEGIN));
            }
            call.resolve();
        } catch (RuntimeException e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    /** Intent die de app opent en een sessie laat starten */
    static Intent beginIntent(Context context) {
        return new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW).putExtra(EXTRA, BEGIN);
    }

    /**
     * Vraagt Android de tegel aan de snelle instellingen toe te voegen (vanaf
     * Android 13). Uitkomst: "toegevoegd", "stond_er_al", "niet_toegevoegd",
     * of "niet_mogelijk" (ouder Android of een fout: dan zelf via het potloodje).
     */
    @PluginMethod
    public void tegelVragen(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < 33) {
            result.put("uitkomst", "niet_mogelijk");
            call.resolve(result);
            return;
        }
        Context context = getContext();
        StatusBarManager manager = context.getSystemService(StatusBarManager.class);
        if (manager == null) {
            result.put("uitkomst", "niet_mogelijk");
            call.resolve(result);
            return;
        }
        manager.requestAddTileService(
            new ComponentName(context, BeginTegel.class),
            "Begin met vogelen",
            Icon.createWithResource(context, R.drawable.ic_stat_vink),
            context.getMainExecutor(),
            code -> {
                String uitkomst;
                if (code == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED) uitkomst = "toegevoegd";
                else if (code == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED) uitkomst = "stond_er_al";
                else if (code == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_NOT_ADDED) uitkomst = "niet_toegevoegd";
                else uitkomst = "niet_mogelijk";
                result.put("uitkomst", uitkomst);
                call.resolve(result);
            }
        );
    }

    /** De actie waarmee de app geopend werd (één keer), of niets */
    @PluginMethod
    public void wachtend(PluginCall call) {
        JSObject result = new JSObject();
        if (pending != null) result.put("actie", pending);
        pending = null;
        call.resolve(result);
    }

    private static String actionOf(Intent intent) {
        if (intent == null) return null;
        String action = intent.getStringExtra(EXTRA);
        // Niet nog eens bij een herstart van de activity met dezelfde intent
        intent.removeExtra(EXTRA);
        return action;
    }
}
