<script lang="ts">
  // Vraag aan wie de beta-app uit de interne test van Google Play heeft, om
  // over te stappen naar de gewone app (gesloten test). Beide zijn dezelfde app
  // in Play, maar de beta heeft het hogere versienummer, dus Play zet niemand
  // vanzelf terug: verwijderen en opnieuw installeren, met een back-up ertussen
  // (de sessies staan in de app en gaan bij het verwijderen weg). Alleen in de
  // beta-app en niet bij de eigenaar; "Later" verbergt hem tot de volgende keer
  // dat de app opent.
  const CLOSED_TEST_URL = 'https://play.google.com/apps/testing/nl.hegmus.fluistervink';
  const STORE_URL = 'https://play.google.com/store/apps/details?id=nl.hegmus.fluistervink';

  let { onlater }: { onlater: () => void } = $props();
</script>

<section class="card move">
  <div class="card-head"><h2>Graag overstappen naar de gewone app</h2></div>
  <div class="card-body stack">
    <p>
      Je gebruikt Fluistervink Beta, de versie waarop de ontwikkelaar nieuwe dingen eerst
      uitprobeert. De test met andere vogelaars loopt nu op de gewone Fluistervink, en daar telt
      jouw deelname mee. Overstappen kost een paar minuten:
    </p>
    <ol>
      <li>
        Heb je sessies die nog niet naar waarneming.nl zijn geëxporteerd? Maak dan eerst bij
        <a class="link" href="#instellingen">Instellingen</a> een back-up (kaart Back-up). Het bestand
        komt in Downloads. Alles al geëxporteerd: deze stap kun je overslaan.
      </li>
      <li>
        Open <a class="link" href={CLOSED_TEST_URL} target="_blank" rel="noopener">deze link</a> en tik
        op "Word tester".
      </li>
      <li>
        Verwijder Fluistervink Beta van je telefoon en installeer
        <a class="link" href={STORE_URL} target="_blank" rel="noopener">Fluistervink</a> uit Google Play.
      </li>
      <li>Had je een back-up gemaakt? Zet die in de nieuwe app bij Instellingen terug.</li>
    </ol>
    <p class="hint">
      Bij het verwijderen gaan de sessies in de app weg; wat al bij waarneming.nl staat, blijft daar
      gewoon. Lukt stap 2 of 3 niet, laat het dan weten via Feedback in het menu.
    </p>
    <button class="btn secondary block" onclick={onlater}>Later</button>
  </div>
</section>

<style>
  .move {
    text-align: left;
  }

  ol {
    margin: 0;
    padding-left: 1.25rem;
  }

  li + li {
    margin-top: 0.4rem;
  }
</style>
