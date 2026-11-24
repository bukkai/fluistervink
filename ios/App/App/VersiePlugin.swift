import Capacitor
import Foundation

/// Versie van de geïnstalleerde app (src/lib/native.ts), zoals VersiePlugin.java.
/// `FluistervinkVersie` zet de buildstap "Versie uit git" in Info.plist
/// (scripts/ios-versie.sh): "0.6 (<hash>)", net als op Android.
@objc(VersiePlugin)
public class VersiePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VersiePlugin"
    public let jsName = "Versie"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise)
    ]

    @objc func info(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary ?? [:]
        let versie =
            info["FluistervinkVersie"] as? String
            ?? info["CFBundleShortVersionString"] as? String
            ?? "onbekend"
        let build = Int(info["CFBundleVersion"] as? String ?? "") ?? 0
        call.resolve(["versie": versie, "build": build])
    }
}
