package nl.hegmus.fluistervink;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigen plugins vóór super.onCreate registreren
        registerPlugin(TrillenPlugin.class);
        registerPlugin(WandelingPlugin.class);
        registerPlugin(BestandPlugin.class);
        registerPlugin(VersiePlugin.class);
        super.onCreate(savedInstanceState);

        // Terugknop: een pagina terug in de app (de schermen zijn #-adressen),
        // zoals in Chrome. Zonder dit sloot hij de app (15 okt). Op het
        // hoofdscherm naar de achtergrond in plaats van afsluiten, zodat een
        // lopende wandeling (wachtrij, tril) gewoon doorgaat.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView().canGoBack()) {
                    bridge.getWebView().goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }
}
