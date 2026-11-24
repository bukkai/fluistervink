import Capacitor
import UIKit
import WebKit

/// alert(), confirm() en prompt() met knoppen in de taal van de app. Capacitor
/// zet er vast "Cancel" en "Ok" op. Deze klasse staat als uiDelegate voor die
/// van Capacitor en geeft al het andere (zoals de vraag om de microfoon) door.
///
/// Tijdens een dialoog staat JavaScript stil, dus de taal moet al bekend zijn:
/// een klein script meldt `<html lang>` (src/main.ts zet die) bij elke wijziging.
final class Dialogen: NSObject, WKUIDelegate, WKScriptMessageHandler {
    private weak var capacitor: WebViewDelegationHandler?
    private weak var viewController: UIViewController?
    private var taal = "nl"

    init(capacitor: WebViewDelegationHandler, viewController: UIViewController) {
        self.capacitor = capacitor
        self.viewController = viewController
    }

    /// Volgt `<html lang>` van de pagina; aanroepen vóór de pagina laadt.
    func volgTaal(in contentController: WKUserContentController) {
        let script = """
            (() => {
              const meld = () => window.webkit.messageHandlers.fluistervinkTaal
                .postMessage(document.documentElement.lang || '');
              new MutationObserver(meld).observe(document.documentElement,
                { attributes: true, attributeFilter: ['lang'] });
              meld();
            })();
            """
        contentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        contentController.add(ZwakkeVerwijzing(self), name: "fluistervinkTaal")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let lang = message.body as? String, !lang.isEmpty { taal = lang }
    }

    private var engels: Bool { taal.hasPrefix("en") }
    private var annuleren: String { engels ? "Cancel" : "Annuleren" }
    private let ok = "OK"

    // MARK: Doorgeven aan Capacitor

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (capacitor?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        capacitor?.responds(to: aSelector) == true ? capacitor : super.forwardingTarget(for: aSelector)
    }

    // MARK: Dialogen

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: ok, style: .default) { _ in completionHandler() })
        toon(alert) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: annuleren, style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: ok, style: .default) { _ in completionHandler(true) })
        toon(alert) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        // Capacitor gebruikt prompt() ook intern (cookies); dat blijft bij Capacitor
        if prompt.contains("\"CapacitorCookies.") {
            capacitor?.webView(webView, runJavaScriptTextInputPanelWithPrompt: prompt,
                               defaultText: defaultText, initiatedByFrame: frame,
                               completionHandler: completionHandler)
            return
        }
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: annuleren, style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: ok, style: .default) { _ in
            completionHandler(alert.textFields?.first?.text ?? defaultText)
        })
        toon(alert) { completionHandler(nil) }
    }

    /// Toont de dialoog; kan dat niet, dan meteen het antwoord "nee",
    /// anders blijft de pagina hangen.
    private func toon(_ alert: UIAlertController, anders: () -> Void) {
        guard var boven = viewController else { return anders() }
        while let getoond = boven.presentedViewController, !getoond.isBeingDismissed { boven = getoond }
        boven.present(alert, animated: true)
    }
}

/// WKUserContentController houdt zijn message handlers vast; zo niet de Dialogen zelf.
private final class ZwakkeVerwijzing: NSObject, WKScriptMessageHandler {
    weak var doel: WKScriptMessageHandler?
    init(_ doel: WKScriptMessageHandler) { self.doel = doel }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        doel?.userContentController(c, didReceive: message)
    }
}
