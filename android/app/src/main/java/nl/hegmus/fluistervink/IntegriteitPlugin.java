package nl.hegmus.fluistervink;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;

/**
 * Verklaring van Google Play dat dit de echte app uit Play is, op een echt
 * toestel (Play Integrity API). De proxy geeft daarvoor een token, zodat de
 * app werkt zonder toegangscode (src/lib/install.ts, worker/install.ts).
 * Een debug-APK krijgt geen goedkeuring; dan valt de app terug op Turnstile.
 */
@CapacitorPlugin(name = "Integriteit")
public class IntegriteitPlugin extends Plugin {

    @PluginMethod
    public void verklaring(PluginCall call) {
        String nonce = call.getString("nonce");
        if (nonce == null) {
            call.reject("nonce ontbreekt");
            return;
        }
        IntegrityTokenRequest.Builder request = IntegrityTokenRequest.builder().setNonce(nonce);
        // Projectnummer in Google Cloud; nodig voor een app buiten Play,
        // en ook goed als het project aan de Play Console gekoppeld is
        String project = call.getString("project");
        if (project != null && !project.isEmpty()) {
            try {
                request.setCloudProjectNumber(Long.parseLong(project));
            } catch (NumberFormatException e) {
                call.reject("ongeldig projectnummer");
                return;
            }
        }
        IntegrityManager manager = IntegrityManagerFactory.create(getContext());
        manager
            .requestIntegrityToken(request.build())
            .addOnSuccessListener(response -> {
                JSObject result = new JSObject();
                result.put("token", response.token());
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }
}
