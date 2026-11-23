import Capacitor
import UIKit

/// De WebView van Capacitor, met de eigen plugins van Fluistervink. Zelfde
/// namen als de Android-plugins, zodat src/lib/native.ts niet hoeft te weten
/// op welk platform hij draait (docs/plan-ios.md). Main.storyboard wijst hierheen.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TrillenPlugin())
        bridge?.registerPluginInstance(VersiePlugin())
    }
}
