// Bootst een slecht netwerk na voor de veldtest-review. Uitvoeren in de
// browser (javascript_tool). Vervangt window.fetch, maar alleen voor /api/;
// kaarttegels en de app zelf blijven gewoon laden. Elk verzoek naar /api/
// komt in window.__netwerk.log.
//
// Gebruik daarna bijvoorbeeld:
//   __netwerk.zet('weg')                       // elk /api/-verzoek faalt meteen
//   __netwerk.zet('traag', { ms: 20000 })      // elk /api/-verzoek wacht 20 s
//   __netwerk.zet('halverwege', { pad: '/api/messages' })
//       // transcriberen lukt, interpreteren faalt: netwerk weg tussen de stappen
//   __netwerk.zet('hapering', { aantal: 2 })   // de eerste 2 verzoeken falen, daarna gaat het goed
//   __netwerk.zet('normaal')
//   __netwerk.herstel()                        // originele fetch terug
//
// Let op: de app ziet navigator.onLine nog als true; de wachtrij merkt de
// storing alleen aan mislukte verzoeken, net als bij slecht bereik in het veld.
(() => {
  if (window.__netwerk) return 'netwerk.js was al geladen; gebruik __netwerk.zet(...)';

  const original = window.fetch.bind(window);
  const state = { modus: 'normaal', opties: {}, teller: 0 };
  const log = [];

  const fail = () => Promise.reject(new TypeError('Failed to fetch (nagebootst: netwerk weg)'));
  const wait = (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      });
    });

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, location.href).pathname;
    if (!path.startsWith('/api/')) return original(input, init);

    state.teller += 1;
    const entry = { tijd: new Date().toISOString().slice(11, 19), pad: path, modus: state.modus };
    log.push(entry);
    const { modus, opties } = state;

    try {
      if (modus === 'weg') return await fail();
      if (modus === 'traag') await wait(opties.ms ?? 20000, init?.signal);
      if (modus === 'halverwege' && path.startsWith(opties.pad ?? '/api/messages'))
        return await fail();
      if (modus === 'hapering' && state.teller <= (opties.aantal ?? 1)) return await fail();
      const response = await original(input, init);
      entry.status = response.status;
      return response;
    } catch (error) {
      entry.fout = String(error?.message ?? error);
      throw error;
    }
  };

  window.__netwerk = {
    log,
    zet(modus, opties = {}) {
      state.modus = modus;
      state.opties = opties;
      state.teller = 0;
      return `netwerk: ${modus}`;
    },
    herstel() {
      window.fetch = original;
      delete window.__netwerk;
      return 'fetch hersteld';
    },
  };
  return 'netwerk.js geladen; __netwerk.zet(...) om een storing na te bootsen';
})();
