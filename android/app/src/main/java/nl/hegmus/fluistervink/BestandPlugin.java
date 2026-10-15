package nl.hegmus.fluistervink;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
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
 * die geeft.
 *
 * Vanaf Android 10 rechtstreeks in Downloads, met het type van de webcode
 * erbij, zoals Chrome een download opslaat; daar is geen toestemming voor
 * nodig. Via het "Opslaan als"-venster raadde Android het type zelf uit de
 * extensie, en zo'n CSV was op waarneming.nl uitgegrijsd: het uploadveld
 * accepteert alleen het type "text/csv" (15 okt). Oudere Android-versies
 * houden het venster.
 */
@CapacitorPlugin(name = "Bestand")
public class BestandPlugin extends Plugin {

    /**
     * naam, type (MIME) en data (base64). Geeft { opgeslagen, map }: map is
     * "Downloads" als de app zelf de plek koos; opgeslagen false bij annuleren.
     */
    @PluginMethod
    public void opslaan(PluginCall call) {
        String naam = call.getString("naam");
        String type = call.getString("type", "application/octet-stream");
        if (naam == null || call.getString("data") == null) {
            call.reject("Naam of data ontbreekt");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            inDownloads(call, naam, type);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(type)
            .putExtra(Intent.EXTRA_TITLE, naam);
        startActivityForResult(call, intent, "naKiezen");
    }

    /** Bestaat de naam al, dan maakt Android er "naam (1).csv" van. */
    private void inDownloads(PluginCall call, String naam, String type) {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, naam);
        values.put(MediaStore.MediaColumns.MIME_TYPE, type);
        // Onzichtbaar voor andere apps tot het bestand helemaal geschreven is
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            call.reject("Opslaan mislukt: kan geen bestand maken in Downloads");
            return;
        }
        try {
            schrijf(uri, call.getString("data"));
        } catch (IOException | IllegalArgumentException e) {
            resolver.delete(uri, null, null);
            call.reject("Opslaan mislukt: " + e.getMessage());
            return;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        JSObject uitkomst = new JSObject();
        uitkomst.put("opgeslagen", true);
        uitkomst.put("map", "Downloads");
        call.resolve(uitkomst);
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
        try {
            schrijf(uri, call.getString("data"));
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Opslaan mislukt: " + e.getMessage());
            return;
        }
        uitkomst.put("opgeslagen", true);
        call.resolve(uitkomst);
    }

    private void schrijf(Uri uri, String data) throws IOException {
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("Kan het bestand niet openen");
            out.write(Base64.decode(data, Base64.DEFAULT));
        }
    }
}
