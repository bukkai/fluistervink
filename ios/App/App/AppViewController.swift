import Capacitor
import UIKit

/// De WebView van Capacitor, met de eigen plugins van Fluistervink. Zelfde
/// namen als de Android-plugins, zodat src/lib/native.ts niet hoeft te weten
/// op welk platform hij draait (docs/plan-ios.md). SceneDelegate.swift maakt hem aan.
class AppViewController: CAPBridgeViewController {
    /// webView.uiDelegate is weak; hier houden we hem vast
    private var dialogen: Dialogen?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TrillenPlugin())
        bridge?.registerPluginInstance(VersiePlugin())
        bridge?.registerPluginInstance(LocatiePlugin())

        // Dialogen met knoppen in de taal van de app (Dialogen.swift)
        if let capacitor = webView?.uiDelegate as? WebViewDelegationHandler {
            let dialogen = Dialogen(capacitor: capacitor, viewController: self)
            dialogen.volgTaal(in: capacitor.contentController)
            webView?.uiDelegate = dialogen
            self.dialogen = dialogen
        }
    }
}
