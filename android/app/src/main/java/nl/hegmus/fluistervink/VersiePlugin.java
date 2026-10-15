package nl.hegmus.fluistervink;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Versie van de geïnstalleerde app (src/lib/native.ts), voor het log en
 * Instellingen. De webcode komt live van de site en heeft een eigen versie;
 * deze zegt welke native code er op de telefoon staat (zie build.gradle).
 */
@CapacitorPlugin(name = "Versie")
public class VersiePlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String naam = getContext().getPackageName();
            PackageInfo info = Build.VERSION.SDK_INT >= 33
                ? pm.getPackageInfo(naam, PackageManager.PackageInfoFlags.of(0))
                : pm.getPackageInfo(naam, 0);
            JSObject result = new JSObject();
            result.put("versie", info.versionName);
            result.put("build", PackageInfoCompat.getLongVersionCode(info));
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject(e.getMessage());
        }
    }
}
