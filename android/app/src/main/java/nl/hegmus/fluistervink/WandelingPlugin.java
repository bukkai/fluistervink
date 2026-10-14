package nl.hegmus.fluistervink;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Zet de foreground service van een wandeling aan en uit (WandelingService),
 * vanuit de webcode (src/lib/native.ts). Aanzetten mag vaker: dat doet niets
 * als hij al draait.
 */
@CapacitorPlugin(
    name = "Wandeling",
    permissions = { @Permission(alias = "meldingen", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class WandelingPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        // Android 13+: zonder toestemming draait de service wel, maar zie je de
        // melding niet. Eén keer vragen; ook bij "nee" gewoon starten.
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("meldingen") == PermissionState.PROMPT
        ) {
            requestPermissionForAlias("meldingen", call, "naMeldingen");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void naMeldingen(PluginCall call) {
        startService(call);
    }

    private void startService(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        // Een service met type "location" mag alleen starten als de
        // locatietoestemming er al is (Android 14+); anders crasht de app.
        // De webcode probeert het opnieuw bij de volgende opname.
        if (!hasLocation(context)) {
            result.put("ok", false);
            result.put("reden", "geen locatietoestemming");
            call.resolve(result);
            return;
        }
        try {
            ContextCompat.startForegroundService(context, new Intent(context, WandelingService.class));
            result.put("ok", true);
        } catch (RuntimeException e) {
            result.put("ok", false);
            result.put("reden", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        result.put("meldingen", notificationsAllowed(context));
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        context.stopService(new Intent(context, WandelingService.class));
        call.resolve();
    }

    /** Draait de service, en waarom startte hij als laatste niet (voor het log)? */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("draait", WandelingService.running);
        result.put("fout", WandelingService.lastError);
        result.put("meldingen", notificationsAllowed(getContext()));
        call.resolve(result);
    }

    private static boolean hasLocation(Context context) {
        return (
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        );
    }

    private static boolean notificationsAllowed(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED;
    }
}
