import type { CapacitorConfig } from '@capacitor/cli';

// Android-app (Capacitor), zie docs/plan-capacitor.md. De app laadt de
// webcode live van de site, zodat een gemergde PR meteen ook in de app staat;
// alleen wijzigingen in android/ vragen een nieuwe app-versie. `webDir` is
// verplicht, maar wordt met `server.url` alleen als terugval meegeleverd.
// Een branch testen vóór het mergen: `CAP_SERVER_URL=<preview-adres van
// Cloudflare> npx cap sync android` en de app opnieuw installeren.
const config: CapacitorConfig = {
  appId: 'nl.hegmus.fluistervink',
  appName: 'Fluistervink',
  webDir: 'dist',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://fluistervink.stephanmullernl.workers.dev',
  },
};

export default config;
