// Herstel als de app-code niet laadt. Rond een deploy kan de service worker
// een oude index.html in zijn cache zetten naast de nieuwe JavaScript; die
// oude pagina vraagt dan een bestand dat niet meer bestaat, en de app blijft op
// het laadscherm hangen tot de volgende versie (14 okt, in de Android-app).
// Dan: service worker en cache weggooien en één keer opnieuw laden van de
// site. De gegevens (IndexedDB) blijven staan.
//
// Een gewoon script (geen module), zodat het ook werkt als de module niet laadt.
// main.ts logt het herstel en haalt de vlag weg; blijft de vlag staan (laden
// lukte weer niet), dan niet nog eens, om niet eindeloos te herladen.
(function () {
  var FLAG = 'fluistervink-herstel';

  window.addEventListener(
    'error',
    function (event) {
      var el = event.target;
      if (!el || el.tagName !== 'SCRIPT' || el.type !== 'module') return;
      try {
        if (sessionStorage.getItem(FLAG)) return;
        sessionStorage.setItem(FLAG, el.src);
      } catch (e) {
        return;
      }
      var steps = [];
      if (navigator.serviceWorker) {
        steps.push(
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
          }),
        );
      }
      if (window.caches) {
        steps.push(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) { return caches.delete(key); }));
          }),
        );
      }
      Promise.all(steps).then(
        function () { location.reload(); },
        function () { location.reload(); },
      );
    },
    // Fouten bij het laden van een script bubbelen niet op
    true,
  );
})();
