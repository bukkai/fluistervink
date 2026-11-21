// Voorpagina (/) of meteen de app (/app/)? Sinds november 2026 staat de app op
// /app/ en is / de voorpagina voor nieuwe bezoekers. Wie de app al gebruikt,
// mag daar niets van merken: de Android-app laadt nog steeds / (server.url in
// capacitor.config.ts zit in de geïnstalleerde app), een geïnstalleerde PWA
// opent / en oude links hebben een # (#privacy, #instellingen).
//
// Een gewoon script in de <head> (geen module, die wacht tot de pagina er
// staat), zodat de voorpagina niet eerst even in beeld komt. De gegevens
// (IndexedDB, localStorage) horen bij het adres, niet bij het pad, dus in /app/
// staat alles er nog.
//
// Getest in src/naarApp.test.ts.
(function () {
  function naarApp(win) {
    var loc = win.location;
    // Zelf de voorpagina willen zien, ook als je de app gebruikt: /?voorpagina
    if (/[?&]voorpagina\b/.test(loc.search)) return false;
    // Oude links naar een scherm van de app (#privacy, #sessie/…, #code=…)
    if (loc.hash && loc.hash !== '#') return true;
    // De Android-app (Capacitor zet deze vóór de eerste regel van de pagina)
    if (win.Capacitor || win.androidBridge) return true;
    // Geïnstalleerd als app (PWA)
    try {
      if (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) {
      // geen matchMedia: dan niet
    }
    // In deze browser al eens de app geopend (aangemeld als installatie, of de
    // code van de eigenaar)
    try {
      var store = win.localStorage;
      if (store.getItem('fluistervink.installId') || store.getItem('fluistervink.accessCode')) {
        return true;
      }
    } catch (e) {
      // geen localStorage: dan niet
    }
    return false;
  }

  if (naarApp(window)) location.replace('/app/' + location.search + location.hash);
})();
