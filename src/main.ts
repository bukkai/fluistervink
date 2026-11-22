import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { logEvent, startLogging } from './lib/log';
import './lib/update';
import { language } from './lib/i18n';
import { insectsWanted, loadInsects, syncInsects } from './lib/insects';

// Taal van de pagina (index.html zegt nl), voor schermlezers en afbreken
document.documentElement.lang = language;

startLogging();
// De app-code laadde eerst niet en public/herstel.js heeft de cache gewist:
// loggen, en de vlag weg zodat het een volgende keer weer kan
try {
  const failedScript = sessionStorage.getItem('fluistervink-herstel');
  if (failedScript) {
    logEvent('cache_recovered', { failedScript });
    sessionStorage.removeItem('fluistervink-herstel');
  }
} catch {
  // Geen sessionStorage: dan ook geen herstel gebeurd
}

function start() {
  mount(App, {
    target: document.getElementById('app')!,
  });

  // Laadscherm uit index.html wegfaden zodra de app er staat
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    splash.addEventListener('transitionend', () => splash.remove());
    // Vangnet als er geen overgang is (bv. "minder beweging")
    setTimeout(() => splash.remove(), 600);
  }
}

// Insecten (ontwikkeloptie, insects.ts): de lijst eerst laden, zodat namen en
// het model meteen kloppen; anders later op de achtergrond, voor eerder
// ingesproken insecten. Lukt het laden niet, dan start de app gewoon.
if (insectsWanted()) void syncInsects().finally(start);
else {
  start();
  setTimeout(() => void loadInsects().catch(() => {}), 3000);
}
