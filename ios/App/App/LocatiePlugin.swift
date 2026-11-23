import Capacitor
import CoreLocation

/// GPS uit CoreLocation voor de webcode (`geolocation()` in src/lib/native.ts).
/// De WebView vraagt bij navigator.geolocation na elke start van de app opnieuw
/// om toestemming, met het adres van de site erin; zo vraagt alleen iOS het,
/// één keer (docs/plan-ios.md). Fouten als bij de browser: code 1 = geen
/// toestemming, 2 = geen plek, 3 = te lang gewacht.
@objc(LocatiePlugin)
public class LocatiePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "LocatiePlugin"
    public let jsName = "Locatie"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "huidige", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "volg", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "stopVolgen", returnType: CAPPluginReturnPromise),
    ]

    private let manager = CLLocationManager()
    /// Wachten op één plek (huidige), met hun eigen time-out
    private var eenmalig: [(call: CAPPluginCall, timer: DispatchWorkItem?)] = []
    /// Lopende watchPosition's, op callbackId
    private var volgers: [String: CAPPluginCall] = [:]
    /// Wacht op het antwoord op de vraag om toestemming
    private var wachtOpToestemming: [() -> Void] = []

    override public func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    @objc func huidige(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.metToestemming(call) {
                let maxLeeftijd = call.getDouble("maxLeeftijd") ?? 0
                if let plek = self.manager.location,
                    -plek.timestamp.timeIntervalSinceNow * 1000 <= maxLeeftijd
                {
                    call.resolve(self.json(plek))
                    return
                }
                var timer: DispatchWorkItem?
                if let timeout = call.getDouble("timeout"), timeout.isFinite {
                    let item = DispatchWorkItem { [weak self] in
                        guard let self = self else { return }
                        self.eenmalig.removeAll { $0.call.callbackId == call.callbackId }
                        call.reject("Geen plek binnen de tijd", "3")
                        self.stopAlsNiemandWacht()
                    }
                    timer = item
                    DispatchQueue.main.asyncAfter(deadline: .now() + timeout / 1000, execute: item)
                }
                self.eenmalig.append((call, timer))
                self.manager.startUpdatingLocation()
            }
        }
    }

    @objc func volg(_ call: CAPPluginCall) {
        call.keepAlive = true
        DispatchQueue.main.async {
            self.metToestemming(call) {
                self.volgers[call.callbackId] = call
                self.manager.startUpdatingLocation()
            }
        }
    }

    @objc func stopVolgen(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async {
            if let volger = self.volgers.removeValue(forKey: id) {
                self.bridge?.releaseCall(volger)
            }
            self.stopAlsNiemandWacht()
            call.resolve()
        }
    }

    // MARK: CLLocationManagerDelegate

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard manager.authorizationStatus != .notDetermined else { return }
        let wachtend = wachtOpToestemming
        wachtOpToestemming = []
        wachtend.forEach { $0() }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let plek = locations.last else { return }
        let data = json(plek)
        for wacht in eenmalig {
            wacht.timer?.cancel()
            wacht.call.resolve(data)
        }
        eenmalig = []
        for volger in volgers.values { volger.resolve(data) }
        stopAlsNiemandWacht()
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // locationUnknown is tijdelijk: CoreLocation blijft zoeken
        guard let fout = error as? CLError, fout.code == .denied else { return }
        weigerAlles()
    }

    // MARK: Hulp

    /// Eerst toestemming vragen als dat nog niet gebeurd is; bij een weigering code 1.
    private func metToestemming(_ call: CAPPluginCall, _ daarna: @escaping () -> Void) {
        switch manager.authorizationStatus {
        case .notDetermined:
            wachtOpToestemming.append { [weak self] in self?.metToestemming(call, daarna) }
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            call.reject("Geen toestemming voor de locatie", "1")
            if call.keepAlive { bridge?.releaseCall(call) }
        default:
            daarna()
        }
    }

    private func weigerAlles() {
        for wacht in eenmalig {
            wacht.timer?.cancel()
            wacht.call.reject("Geen toestemming voor de locatie", "1")
        }
        eenmalig = []
        for volger in volgers.values {
            volger.reject("Geen toestemming voor de locatie", "1")
            bridge?.releaseCall(volger)
        }
        volgers = [:]
        manager.stopUpdatingLocation()
    }

    private func stopAlsNiemandWacht() {
        if eenmalig.isEmpty && volgers.isEmpty { manager.stopUpdatingLocation() }
    }

    private func json(_ plek: CLLocation) -> [String: Any] {
        [
            "lat": plek.coordinate.latitude,
            "lon": plek.coordinate.longitude,
            "nauwkeurigheid": plek.horizontalAccuracy,
            "tijd": plek.timestamp.timeIntervalSince1970 * 1000,
        ]
    }
}
