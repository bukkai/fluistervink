import type { CapacitorConfig } from '@capacitor/cli';

// Android-app (Capacitor), zie docs/plan-capacitor.md. De app laadt de
// webcode live van de site, zodat een gemergde PR meteen ook in de app staat;
// alleen wijzigingen in android/ vragen een nieuwe app-versie. `webDir` is
// verplicht, maar wordt met `server.url` alleen als terugval meegeleverd:
// alleen `dist/client` (wat de site serveert), niet de Worker-build in
// `dist/fluistervink` (proxycode en sourcemap horen niet in de app).
// De app staat op /app/; op / staat de voorpagina, die de Android-app meteen
// doorstuurt (public/naar-app.js). Daarom hoeft `url` niet te veranderen.
// Een branch testen vóór het mergen: `CAP_SERVER_URL=<preview-adres van
// Cloudflare> npx cap sync android` en de app opnieuw installeren.
const config: CapacitorConfig = {
  appId: 'nl.hegmus.fluistervink',
  appName: 'Fluistervink',
  webDir: 'dist/client',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://fluistervink.stephanmullernl.workers.dev',
  },
  // iOS (docs/plan-ios.md): de WebView loopt anders door onder de statusbalk
  // en het Dynamic Island; zo houdt iOS de veilige randen zelf vrij, zonder
  // viewport-fit=cover in de webcode (die ook Android en Safari raakt). De
  // randen krijgen de achtergrondkleur van de app (--bg).
  //
  // Een WebView in een iOS-app krijgt alleen een service worker (en dus
  // opstarten zonder bereik) op "App-Bound Domains": de lijst WKAppBoundDomains
  // in ios/App/App/Info.plist. De WebView komt dan ook nergens anders; een
  // preview van een branch moet er dus eerst bij.
  ios: {
    contentInset: 'always',
    backgroundColor: '#f4f1ed',
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
