package nl.hegmus.fluistervink;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Een bestand opslaan (CSV voor waarneming.nl, JSON-export) vanuit de webcode
 * (src/lib/native.ts). De WebView doet niets met een download zoals Chrome
 * die geeft, dus hier het "Opslaan als"-venster van Android: de gebruiker
 * kiest de plek (Downloads, Drive), en de app heeft geen toestemming voor de
 * opslag nodig.
 */
@CapacitorPlugin(name = "Bestand")
public class BestandPlugin extends Plugin {

    /** naam, type (MIME) en data (base64). Geeft { opgeslagen: false } bij annuleren. */
    @PluginMethod
    public void opslaan(PluginCall call) {
        String naam = call.getString("naam");
        String type = typeVoor(naam, call.getString("type", "application/octet-stream"));
        if (naam == null || call.getString("data") == null) {
            call.reject("Naam of data ontbreekt");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(type)
            .putExtra(Intent.EXTRA_TITLE, naam);
        startActivityForResult(call, intent, "naKiezen");
    }

    /**
     * Het type dat Android zelf bij de extensie hoort. Chrome zet accept=".csv"
     * van een uploadveld (waarneming.nl) met dezelfde tabel om naar een type,
     * en grijst in het kiesvenster bestanden met een ander type uit; een CSV
     * met "text/csv" was daar niet te kiezen (15 okt).
     */
    private static String typeVoor(String naam, String type) {
        if (naam == null) return type;
        String extensie = MimeTypeMap.getFileExtensionFromUrl(Uri.encode(naam));
        String vanAndroid = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extensie.toLowerCase());
        return vanAndroid != null ? vanAndroid : type;
    }

    @ActivityCallback
    private void naKiezen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject uitkomst = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            uitkomst.put("opgeslagen", false);
            call.resolve(uitkomst);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("Kan het bestand niet openen");
            out.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Opslaan mislukt: " + e.getMessage());
            return;
        }
        uitkomst.put("opgeslagen", true);
        call.resolve(uitkomst);
    }
}
