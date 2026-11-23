import AVFoundation
import Capacitor
import CoreHaptics

/// Trilpatronen voor de webcode (src/lib/native.ts), zoals TrillenPlugin.java.
/// Safari en de WebView kunnen niet trillen (geen navigator.vibrate); Core
/// Haptics speelt het patroon af als een reeks trillingen van gekozen lengte.
/// Alleen als de app op het scherm staat: op de achtergrond stopt iOS de
/// haptische motor (docs/plan-ios.md, fase 2). Op de simulator: ok false.
@objc(TrillenPlugin)
public class TrillenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TrillenPlugin"
    public let jsName = "Trillen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "patroon", returnType: CAPPluginReturnPromise)
    ]

    private var engine: CHHapticEngine?

    override public func load() {
        // Tijdens een opname (de trektelling neemt doorlopend op) houdt iOS
        // trillen anders tegen
        try? AVAudioSession.sharedInstance().setAllowHapticsAndSystemSoundsDuringRecording(true)
    }

    /// Patroon zoals navigator.vibrate: tril, pauze, tril, … in ms.
    @objc func patroon(_ call: CAPPluginCall) {
        guard let input = call.getArray("patroon") as? [NSNumber], !input.isEmpty else {
            call.reject("Geen patroon")
            return
        }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            call.resolve(["ok": false])
            return
        }

        var events: [CHHapticEvent] = []
        var time: TimeInterval = 0
        for (index, value) in input.enumerated() {
            let duration = max(value.doubleValue, 0) / 1000
            if index % 2 == 0 && duration > 0 {
                events.append(
                    CHHapticEvent(
                        eventType: .hapticContinuous,
                        parameters: [
                            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
                            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.4),
                        ],
                        relativeTime: time,
                        duration: duration))
            }
            time += duration
        }

        do {
            let engine = try startedEngine()
            let player = try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))
            try player.start(atTime: CHHapticTimeImmediate)
            call.resolve(["ok": true])
        } catch {
            // Bv. een motor die iOS net stopte: de volgende keer opnieuw
            self.engine = nil
            call.resolve(["ok": false])
        }
    }

    private func startedEngine() throws -> CHHapticEngine {
        if let engine = engine {
            try engine.start()
            return engine
        }
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = true
        // iOS stopt de motor bij naar de achtergrond gaan of een storing
        engine.stoppedHandler = { [weak self] _ in self?.engine = nil }
        engine.resetHandler = { [weak self] in self?.engine = nil }
        try engine.start()
        self.engine = engine
        return engine
    }
}
