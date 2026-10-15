package nl.hegmus.fluistervink;

import android.os.Bundle;
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
    }
}
